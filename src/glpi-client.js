// Client minimale per l'API REST legacy di GLPI (/apirest.php).
// Usa solo l'utente di servizio: i dipendenti non accedono mai a GLPI.
const config = require('./config');
const { contenutoTicket } = require('./contenuto');
const { componi } = require('./ticket-dettaglio');

const STATI = { 1: 'In attesa', 2: 'In lavorazione', 3: 'In lavorazione', 4: 'In sospeso', 5: 'Risolta', 6: 'Chiusa' };
const stato = (n) => STATI[Number(n)] || 'In attesa';
const aperto = (n) => Number(n) < 5;

class GlpiError extends Error {
  constructor(msg, status) { super(msg); this.status = status; }
}

let sessionToken = null;
let sessionAt = 0;
const totaleRighe = Symbol('totaleRighe');
const SESSION_TTL = 20 * 60 * 1000; // rinnovo preventivo

async function raw(method, path, { body, headers = {}, session = true, timeoutMs = config.glpi.timeoutMs } = {}) {
  const h = { 'App-Token': config.glpi.appToken, ...headers };
  if (session) h['Session-Token'] = await getSession();
  const isForm = body instanceof FormData;
  if (body && !isForm) h['Content-Type'] = 'application/json';
  const res = await fetch(config.glpi.url + '/apirest.php' + path, {
    method, headers: h, signal: AbortSignal.timeout(timeoutMs),
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const codice = Array.isArray(data) && typeof data[0] === 'string' ? ' ' + data[0] + (data[1] ? ': ' + String(data[1]).slice(0, 120) : '') : ''; // codice e messaggio di GLPI, mai dati utente
    throw new GlpiError(`GLPI ${method} ${path.split('?')[0]} -> ${res.status}${codice}`, res.status);
  }
  if (Array.isArray(data)) {
    const m = /\/(\d+)$/.exec(res.headers.get('content-range') || '');
    if (m) Object.defineProperty(data, totaleRighe, { value: Number(m[1]) });
  }
  return data;
}

async function getSession() {
  if (sessionToken && Date.now() - sessionAt < SESSION_TTL) return sessionToken;
  const d = await raw('GET', '/initSession', { session: false, headers: { Authorization: 'user_token ' + config.glpi.userToken } });
  sessionToken = d.session_token; sessionAt = Date.now();
  return sessionToken;
}

// Chiamata con un solo retry: se la sessione e' scaduta la rinnova
async function call(method, path, opts) {
  for (let i = 0; ; i++) {
    try { return await raw(method, path, opts); } catch (err) {
      // Un POST potrebbe essere già arrivato a GLPI anche se la risposta si perde.
      // Ripeterlo dopo un timeout può creare due ticket/messaggi/allegati.
      const ritenta = err.status === 401 || (method === 'GET' && ['TimeoutError', 'TypeError'].includes(err.name));
      if (i === 0 && ritenta) { sessionToken = null; continue; }
      throw err;
    }
  }
}

async function killSession() {
  if (!sessionToken) return;
  try { await raw('GET', '/killSession', { timeoutMs: 5000 }); } catch { /* ignorato */ }
  sessionToken = null;
}

const q = (o) => new URLSearchParams(o).toString();
const rows = (r) => (r && Array.isArray(r.data) ? r.data : []);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const daHtml = (s) => String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/<br\s*\/?>|<\/p>/g, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

let selfServiceId = null;
async function profiloSelfService() {
  if (config.glpi.selfServiceProfileId) return config.glpi.selfServiceProfileId;
  if (selfServiceId) return selfServiceId;
  const r = await call('GET', '/search/Profile?' + q({ 'criteria[0][field]': '1', 'criteria[0][searchtype]': 'contains', 'criteria[0][value]': 'Self-Service', 'forcedisplay[0]': '2' }));
  if (!rows(r)[0]) throw new GlpiError('Profilo Self-Service non trovato in GLPI', 500);
  selfServiceId = rows(r)[0]['2'];
  return selfServiceId;
}

// Il campo E-mail di una ricerca GLPI e' una stringa con un solo indirizzo, ma un array se l'utente ne ha piu' di uno.
// Restituisce gli indirizzi in minuscolo, anche se separati da spazi, virgole o punti e virgola.
const indirizzi = (valore) => [].concat(valore ?? []).flatMap((v) => String(v).toLowerCase().split(/[\s,;]+/)).filter(Boolean);

// Trova l'utente GLPI per email; se manca lo crea (Self-Service, senza password).
// MAI modifica profilo/dati di un utente gia' esistente (es. i tecnici Super-Admin): solo lettura dell'id.
async function risolviRichiedente({ email, name }) {
  const mail = email.toLowerCase();
  // 'equals' sull'email non funziona su GLPI 11: cerco con 'contains' e confronto l'indirizzo esatto
  const cerca = async (campo, tipo) => rows(await call('GET', '/search/User?' + q({ 'criteria[0][field]': campo, 'criteria[0][searchtype]': tipo, 'criteria[0][value]': mail, 'forcedisplay[0]': '2', 'forcedisplay[1]': '5', 'forcedisplay[2]': '1' })));
  const trovato = (await cerca('5', 'contains')).find((x) => indirizzi(x['5']).includes(mail))
    || (await cerca('1', 'equals'))[0];
  if (trovato) return Number(trovato['2']);
  // Solo per utenti NUOVI: nome e cognome dal formato dell'email (GLPI_FORMATO_EMAIL) o dal nome visualizzato
  const { firstname, realname } = nomeCognome(mail, name);
  const c = await call('POST', '/User', { body: { input: {
    name: mail, firstname, realname, is_active: 1,
    _useremails: { 0: mail }, _profiles_id: await profiloSelfService(), _is_recursive: 1,
    ...(config.glpi.entityId !== null ? { _entities_id: config.glpi.entityId, entities_id: config.glpi.entityId } : {})
  } } });
  return Number(c.id);
}

// Ricava nome e cognome per un utente nuovo.
// GLPI_FORMATO_EMAIL = "nome.cognome" | "cognome.nome" | vuoto (usa il nome visualizzato "Nome Cognome")
function nomeCognome(mail, name) {
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  const loc = mail.split('@')[0].split('.');
  const formato = config.glpi.formatoEmail;
  if (loc.length === 2 && formato === 'cognome.nome') return { realname: cap(loc[0]), firstname: cap(loc[1]) };
  if (loc.length === 2 && formato === 'nome.cognome') return { firstname: cap(loc[0]), realname: cap(loc[1]) };
  const parti = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parti.length >= 2) return { firstname: parti[0], realname: parti.slice(1).join(' ') };
  return { firstname: parti[0] || cap(loc[0]), realname: parti[0] || cap(loc[0]) };
}

async function creaTicket({ userId, categoria, sottotipo, descrizione, telefono, reperibilita, pc, ip, ua }) {
  const sintesi = descrizione.replace(/\s+/g, ' ').trim().slice(0, 60);
  const input = {
    name: `[${categoria.nome}] ${sintesi}${descrizione.length > 60 ? '…' : ''}`,
    content: contenutoTicket({ sottotipo, descrizione, telefono, reperibilita, pc, ip, ua }),
    type: categoria.tipo, priority: 3, urgency: 3, impact: 3,
    _users_id_requester: userId
  };
  if (categoria.glpiId) input.itilcategories_id = categoria.glpiId;
  if (config.glpi.entityId !== null) input.entities_id = config.glpi.entityId;
  if (config.glpi.groupId !== null) input._groups_id_assign = config.glpi.groupId;
  const r = await call('POST', '/Ticket', { body: { input } });
  return Number(r.id);
}

// Allegato: prima si carica il documento SENZA collegarlo, poi lo si collega al ticket con le notifiche disabilitate
// (il collegamento fatto da GLPI nel POST /Document genera una mail «Aggiornamento» per ogni file).
async function allega(ticketId, file) {
  const fd = new FormData();
  fd.append('uploadManifest', JSON.stringify({ input: { name: file.originalname, _filename: [file.originalname] } }));
  fd.append('filename[0]', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
  const doc = await call('POST', '/Document', { body: fd, timeoutMs: 60000 });
  await call('POST', '/Document_Item', { body: { input: { documents_id: doc.id, itemtype: 'Ticket', items_id: ticketId, _do_notif: false, _disablenotif: true } } });
}

async function elencoTicket(userId) {
  const r = await call('GET', '/search/Ticket?' + q({
    'criteria[0][field]': '4', 'criteria[0][searchtype]': 'equals', 'criteria[0][value]': String(userId),
    'forcedisplay[0]': '2', 'forcedisplay[1]': '1', 'forcedisplay[2]': '15', 'forcedisplay[3]': '19', 'forcedisplay[4]': '12',
    sort: '19', order: 'DESC', range: '0-199'
  }));
  return rows(r).map((x) => ({ id: Number(x['2']), titolo: x['1'], aperta: x['15'], aggiornata: x['19'], stato: stato(x['12']), chiusa: !aperto(x['12']) }));
}

// Tutte le pagine: il limite predefinito di GLPI non deve tagliare i messaggi
// recenti o nascondere un richiedente oltre la prima pagina di Ticket_User.
async function elencoCompleto(percorso) {
  const out = [], pagina = 200, massimo = 10000;
  while (out.length < massimo) {
    let parte;
    try { parte = await call('GET', percorso + '?' + q({ range: `${out.length}-${out.length + pagina - 1}`, sort: 'id', order: 'ASC' })); }
    catch (e) { if (e.status === 416 && out.length) return out; throw e; }
    if (!Array.isArray(parte)) throw new GlpiError('Elenco GLPI non valido', 502);
    out.push(...parte);
    const totale = parte[totaleRighe];
    if (!parte.length || (totale !== undefined ? out.length >= totale : parte.length < pagina)) return out;
  }
  throw new GlpiError('Cronologia GLPI oltre il limite di sicurezza', 502);
}

// Controllo di proprieta' LATO SERVER: il ticket deve avere userId come richiedente
async function ticketEUtenti(userId, ticketId) {
  let t;
  try { t = await call('GET', `/Ticket/${ticketId}`); } catch (e) { if (e.status === 404 || e.status === 403) return null; throw e; }
  const utenti = await elencoCompleto(`/Ticket/${ticketId}/Ticket_User`);
  const mio = utenti.some((u) => Number(u.type) === 1 && Number(u.users_id) === Number(userId));
  return mio ? { t, utenti } : null;
}
async function ticketDi(userId, ticketId) {
  const r = await ticketEUtenti(userId, ticketId);
  return r ? r.t : null;
}

// Nomi ed email in blocchi di 50 (niente N+1). Le email restano sul server, solo per le foto.
async function utentiInBlocco(ids) {
  const unici = [...new Set(ids.map(Number).filter((x) => x > 0))];
  const out = {};
  for (let offset = 0; offset < unici.length; offset += 50) {
    const par = { 'forcedisplay[0]': '2', 'forcedisplay[1]': '34', 'forcedisplay[2]': '9', 'forcedisplay[3]': '5', 'forcedisplay[4]': '1', range: '0-49' };
    unici.slice(offset, offset + 50).forEach((id, i) => {
      if (i) par[`criteria[${i}][link]`] = 'OR';
      par[`criteria[${i}][field]`] = '2'; par[`criteria[${i}][searchtype]`] = 'equals'; par[`criteria[${i}][value]`] = String(id);
    });
    for (const x of rows(await call('GET', '/search/User?' + q(par)))) {
      const email = [].concat(x['5'] || []).map(String).find((e) => e.includes('@')) || '';
      const login = String(x['1'] || '');
      const nome = [x['34'], x['9']].filter(Boolean).join(' ').trim() || (!login.includes('@') ? login : '') || 'Assistenza';
      out[Number(x['2'])] = { nome, email: email.toLowerCase() };
    }
  }
  return out;
}

// Letture accessorie del dettaglio (soluzioni, attivita' pubbliche, storico): se GLPI le nega la pagina resta
// utilizzabile, ma il log lo segnala (al massimo una volta l'ora per tipo, senza dati del ticket o dell'utente).
// Caso tipico: il profilo dell'utente API senza il diritto «Attività > Vedere le attività pubbliche» (docs/glpi.md).
const ultimoAvviso = new Map();
async function facoltativo(p, cosa) {
  try { return (await p) || []; } catch (e) {
    const adesso = Date.now();
    if (adesso - (ultimoAvviso.get(cosa) || 0) >= 3600_000) {
      ultimoAvviso.set(cosa, adesso);
      const negato = [401, 403].includes(e.status) || /RIGHT/.test(e.message);
      console.warn(new Date().toISOString(), `avviso GLPI: lettura ${cosa} non riuscita (${e.status || e.name})` + (negato ? ': lettura negata, controlla i diritti del profilo API (docs/glpi.md)' : '') + '. La richiesta viene mostrata senza questi dati.');
    }
    return [];
  }
}

// Dati grezzi del dettaglio (solo dopo il controllo di proprieta'). La composizione e' in ticket-dettaglio.js
async function dettaglioGrezzo(userId, ticketId) {
  const base = await ticketEUtenti(userId, ticketId);
  if (!base) return null;
  const [followups, solutions, tasks, logs] = await Promise.all([
    elencoCompleto(`/Ticket/${ticketId}/ITILFollowup`),
    facoltativo(elencoCompleto(`/Ticket/${ticketId}/ITILSolution`), 'soluzioni (ITILSolution)'),
    facoltativo(elencoCompleto(`/Ticket/${ticketId}/TicketTask`), 'attività pubbliche (TicketTask)'),
    facoltativo(elencoCompleto(`/Ticket/${ticketId}/Log`), 'storico (Log)')
  ]);
  const pub = (a) => (a || []).filter((x) => [0, '0', false].includes(x.is_private));
  const fPub = pub(followups), tPub = pub(tasks);
  const presa = (logs || []).filter((l) => [150, 12].includes(Number(l.id_search_option))).map((l) => ({ id_search_option: l.id_search_option, user_name: l.user_name, old_value: l.old_value }));
  const ids = [...base.utenti.map((u) => u.users_id), base.t.users_id_recipient, ...fPub.map((f) => f.users_id),
    ...(solutions || []).flatMap((s) => [s.users_id, s.users_id_approval]), ...tPub.flatMap((k) => [k.users_id, k.users_id_tech]),
    ...presa.map((l) => { const m = /\((\d+)\)\s*$/.exec(String(l.user_name || '')); return m ? m[1] : 0; })];
  return { ticket: base.t, ticketUsers: base.utenti, followups: fPub, solutions: solutions || [], tasks: tPub, logs: presa, users: await utentiInBlocco(ids) };
}

async function dettaglio(userId, ticketId) {
  const raw = await dettaglioGrezzo(userId, ticketId);
  return raw ? { ...componi(raw, userId), _users: raw.users } : null;
}

// Esito della soluzione indicato dal richiedente (pulsanti nella mail «Chiamata risolta»).
// Stesso meccanismo di GLPI per approvare/rifiutare una soluzione: followup con add_close (chiude)
// oppure add_reopen (rifiuta e riapre). Ritorna 'ok' | 'stato' (non e' «Risolta») | null (non e' del richiedente)
async function esitoSoluzione(userId, ticketId, nome, esito) {
  const t = await ticketDi(userId, ticketId);
  if (!t) return null;
  if (Number(t.status) !== 5) return 'stato';
  const testo = esito === 'risolto' ? 'Il richiedente conferma che il problema è risolto.' : 'L\'utente segnala che il problema non è risolto.';
  const input = { itemtype: 'Ticket', items_id: ticketId, users_id: userId, is_private: 0, content: `<p><b>${esc(nome)} (dal portale):</b></p><p>${testo}</p>` };
  if (esito === 'risolto') input.add_close = 1; else input.add_reopen = 1;
  await call('POST', '/ITILFollowup', { body: { input } });
  return 'ok';
}

async function aggiungiMessaggio(userId, ticketId, nome, testo) {
  const html = `<p><b>${esc(nome)} (dal portale):</b></p><p>${esc(testo).replace(/\n/g, '<br>')}</p>`;
  await call('POST', '/ITILFollowup', { body: { input: { itemtype: 'Ticket', items_id: ticketId, users_id: userId, is_private: 0, content: html } } });
}

// In modalita' DEMO (o GLPI_MOCK=1, usato dai test) si usa un GLPI finto in memoria
module.exports = (config.demo || process.env.GLPI_MOCK === '1') ? require('./glpi-mock') : {
  risolviRichiedente, creaTicket, allega, elencoTicket, dettaglio, dettaglioGrezzo, aggiungiMessaggio, esitoSoluzione, ticketDi, killSession, call, GlpiError
};
