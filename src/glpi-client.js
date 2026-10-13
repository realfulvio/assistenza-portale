// Client minimale per l'API REST legacy di GLPI (/apirest.php).
// Usa solo l'utente di servizio: i dipendenti non accedono mai a GLPI.
const config = require('./config');

const STATI = { 1: 'In attesa', 2: 'In lavorazione', 3: 'In lavorazione', 4: 'In sospeso', 5: 'Risolta', 6: 'Chiusa' };
const stato = (n) => STATI[Number(n)] || 'In attesa';
const aperto = (n) => Number(n) < 5;

class GlpiError extends Error {
  constructor(msg, status) { super(msg); this.status = status; }
}

let sessionToken = null;
let sessionAt = 0;
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
      const ritenta = err.status === 401 || err.name === 'TimeoutError' || err.name === 'TypeError';
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

// Trova l'utente GLPI per email; se manca lo crea (Self-Service, senza password).
// MAI modifica profilo/dati di un utente gia' esistente (es. i tecnici Super-Admin): solo lettura dell'id.
async function risolviRichiedente({ email, name }) {
  const mail = email.toLowerCase();
  // 'equals' sull'email non funziona su GLPI 11: cerco con 'contains' e confronto l'indirizzo esatto
  const cerca = async (campo, tipo) => rows(await call('GET', '/search/User?' + q({ 'criteria[0][field]': campo, 'criteria[0][searchtype]': tipo, 'criteria[0][value]': mail, 'forcedisplay[0]': '2', 'forcedisplay[1]': '5', 'forcedisplay[2]': '1' })));
  const trovato = (await cerca('5', 'contains')).find((x) => String(x['5'] || '').toLowerCase().split(/\s+/).includes(mail))
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

// Contenuto del ticket: descrizione e, se indicati, telefono e reperibilita' (richiedente e origine sono gia' campi del ticket)
function contenutoTicket({ descrizione, telefono, reperibilita }) {
  const contatti = [telefono && `Telefono: ${esc(telefono)}`, reperibilita && `Reperibilità: ${esc(reperibilita)}`].filter(Boolean).join(' · ');
  return `<p>${esc(descrizione).replace(/\n/g, '<br>')}</p>` + (contatti ? `<p>${contatti}</p>` : '');
}

async function creaTicket({ userId, categoria, descrizione, telefono, reperibilita, nome, email }) {
  const sintesi = descrizione.replace(/\s+/g, ' ').trim().slice(0, 60);
  const input = {
    name: `[${categoria.nome}] ${sintesi}${descrizione.length > 60 ? '…' : ''}`,
    content: contenutoTicket({ descrizione, telefono, reperibilita, nome, email }),
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

// Controllo di proprieta' LATO SERVER: il ticket deve avere userId come richiedente
async function ticketDi(userId, ticketId) {
  let t;
  try { t = await call('GET', `/Ticket/${ticketId}`); } catch (e) { if (e.status === 404 || e.status === 403) return null; throw e; }
  const utenti = await call('GET', `/Ticket/${ticketId}/Ticket_User`);
  const mio = (utenti || []).some((u) => Number(u.type) === 1 && Number(u.users_id) === Number(userId));
  return mio ? t : null;
}

async function dettaglio(userId, ticketId) {
  const t = await ticketDi(userId, ticketId);
  if (!t) return null;
  const fu = await call('GET', `/Ticket/${ticketId}/ITILFollowup?` + q({ range: '0-99' }));
  const timeline = (fu || []).filter((f) => Number(f.is_private) === 0)
    .map((f) => ({ data: f.date_creation || f.date, testo: daHtml(f.content) }));
  return { id: Number(t.id), titolo: t.name, aperta: t.date, aggiornata: t.date_mod, stato: stato(t.status), chiusa: !aperto(t.status),
    descrizione: daHtml(t.content), timeline };
}

async function aggiungiMessaggio(userId, ticketId, nome, testo) {
  const html = `<p><b>${esc(nome)} (dal portale):</b></p><p>${esc(testo).replace(/\n/g, '<br>')}</p>`;
  await call('POST', '/ITILFollowup', { body: { input: { itemtype: 'Ticket', items_id: ticketId, is_private: 0, content: html } } });
}

// In modalita' DEMO (o GLPI_MOCK=1, usato dai test) si usa un GLPI finto in memoria
module.exports = (config.demo || process.env.GLPI_MOCK === '1') ? require('./glpi-mock') : {
  risolviRichiedente, creaTicket, allega, elencoTicket, dettaglio, aggiungiMessaggio, ticketDi, killSession, call, GlpiError
};
