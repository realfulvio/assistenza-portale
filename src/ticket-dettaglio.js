// Dettaglio di una richiesta come «conversazione»: dai dati grezzi di GLPI ricava persone, tappe, eventi e durate.
// Funzione pura (nessuna chiamata di rete): la usano la pagina, la stampa e il PDF.
// Solo contenuti pubblici: i followup e le attivita' privati vengono scartati PRIMA di qualsiasi altra elaborazione,
// quindi non entrano ne' nella cronologia ne' in «Gestita da».

const STATI = { 1: 'In attesa', 2: 'In lavorazione', 3: 'In lavorazione', 4: 'In sospeso', 5: 'Risolta', 6: 'Chiusa' };
const pubblico = (x) => !!x && [0, '0', false].includes(x.is_private);
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const dataValida = (s) => (s && !String(s).startsWith('0000') ? String(s) : null);
const ms = (s) => { const d = dataValida(s); return d ? new Date(d.replace(' ', 'T')).getTime() : NaN; };

const daHtml = (s) => String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/<br\s*\/?>|<\/p>/g, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"')
  .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
// I messaggi scritti dal portale iniziano con «Nome (dal portale):»: l'autore e' gia' mostrato a parte
const senzaFirma = (t, nome, richiedente = false) => {
  const m = /^([^\n]{1,120})\(dal portale\):\s*/.exec(t);
  // Le vecchie risposte erano attribuite all'account API: non perdere il nome
  // contenuto nella firma quando non coincide con l'autore restituito da GLPI.
  // Per un richiedente verificato il nome OIDC può avere un ordine diverso da GLPI.
  return m && (richiedente || m[1].trim() === String(nome || '').trim()) ? t.slice(m[0].length).trim() : t;
};

function iniziali(nome) {
  return String(nome || '').trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}
// «Nome Cognome (9)» nel registro di GLPI → 9
const idDaLog = (s) => { const m = /\((\d+)\)\s*$/.exec(String(s || '')); return m ? Number(m[1]) : null; };

function durata(daMs, aMs) {
  if (!Number.isFinite(daMs) || !Number.isFinite(aMs) || aMs < daMs) return null;
  const min = Math.round((aMs - daMs) / 60000);
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.floor(min / 60), m = min % 60;
  if (h < 48) return m ? `${h} h ${m} min` : `${h} h`;
  const g = Math.floor(h / 24), hh = h % 24;
  return hh ? `${g} gg ${hh} h` : `${g} gg`;
}

/**
 * @param raw { ticket, ticketUsers, followups, solutions, tasks, logs, users: {id: {nome, email}} }
 * @param userId id GLPI dell'utente collegato (il richiedente che sta guardando)
 */
function componi(raw, userId) {
  const t = raw.ticket;
  const tu = raw.ticketUsers || [];
  const richiedenti = tu.filter((u) => Number(u.type) === 1).map((u) => Number(u.users_id));
  const assegnati = [...new Set(tu.filter((u) => Number(u.type) === 2).map((u) => Number(u.users_id)))];
  const followups = (raw.followups || []).filter(pubblico);
  const tasks = (raw.tasks || []).filter(pubblico);
  const solutions = (raw.solutions || []).filter((s) => dataValida(s.date_creation || s.date));
  const users = raw.users || {};

  const ruolo = (id) => (id === Number(userId) ? 'tu' : richiedenti.includes(id) ? 'richiedente' : 'tecnico');
  const persone = {};
  const persona = (id) => {
    id = num(id);
    if (!id) return null;
    if (!persone[id]) {
      const u = users[id] || {};
      const nome = u.nome || (id === Number(userId) ? 'Tu' : 'Assistenza');
      persone[id] = { id, nome, iniziali: iniziali(nome), ruolo: ruolo(id) };
    }
    return id;
  };

  const eventi = [];
  const aperta = dataValida(t.date);
  const chiApre = persona(richiedenti[0] || t.users_id_recipient);
  eventi.push({ tipo: 'apertura', chi: chiApre, data: aperta, testo: daHtml(t.content) });

  // Presa in carico: data di GLPI; autore dal registro (voce «tempo di presa in carico») o, in mancanza, primo assegnato
  const presa = dataValida(t.takeintoaccountdate);
  let chiPresa = null;
  if (presa) {
    const voce = (raw.logs || []).find((l) => Number(l.id_search_option) === 150) || (raw.logs || []).find((l) => Number(l.id_search_option) === 12 && String(l.old_value) === '1');
    chiPresa = persona(voce ? idDaLog(voce.user_name) : assegnati[0]);
    if (chiPresa) eventi.push({ tipo: 'presa', chi: chiPresa, data: presa });
  }

  const usati = new Set();
  for (const s of solutions) {
    const dataSol = dataValida(s.date_creation || s.date);
    eventi.push({ tipo: 'soluzione', chi: persona(s.users_id), data: dataSol, testo: daHtml(s.content) });
    const st = Number(s.status); // 2 in attesa, 3 approvata, 4 rifiutata
    if ((st === 3 || st === 4) && dataValida(s.date_approval)) {
      const quando = ms(s.date_approval);
      const vicini = followups.filter((x) => !usati.has(x) && Math.abs(ms(x.date_creation || x.date) - quando) <= 5000);
      // GLPI 11 registra l'approvazione con l'account della sessione API anche
      // quando il followup ha l'autore corretto. Riconciliare solo la risposta
      // pubblica del richiedente con il testo esatto dell'esito scritto dal server.
      const testoEsito = st === 3 ? 'Il richiedente conferma che il problema è risolto.' : "L'utente segnala che il problema non è risolto.";
      const risposta = !richiedenti.includes(num(s.users_id_approval)) && vicini.find((x) => richiedenti.includes(num(x.users_id)) && senzaFirma(daHtml(x.content), (users[num(x.users_id)] || {}).nome, true) === testoEsito);
      const chi = persona(risposta ? risposta.users_id : s.users_id_approval) || chiApre;
      // Il followup dell'esito diventa il testo dell'evento, non un messaggio doppio.
      const f = risposta || vicini.find((x) => num(x.users_id) === chi);
      if (f) usati.add(f);
      eventi.push({ tipo: st === 3 ? 'approvazione' : 'rifiuto', chi, data: dataValida(s.date_approval), testo: f ? senzaFirma(daHtml(f.content), (users[num(f.users_id)] || {}).nome, richiedenti.includes(num(f.users_id))) : '' });
    }
  }
  for (const f of followups) {
    if (usati.has(f)) continue;
    eventi.push({ tipo: 'messaggio', chi: persona(f.users_id), data: dataValida(f.date_creation || f.date), testo: senzaFirma(daHtml(f.content), (users[num(f.users_id)] || {}).nome, richiedenti.includes(num(f.users_id))) });
  }
  for (const k of tasks) {
    const testo = daHtml(k.content);
    eventi.push({ tipo: 'attivita', chi: persona(k.users_id_tech) || persona(k.users_id), data: dataValida(k.date_creation || k.date), testo });
  }
  const chiusa = dataValida(t.closedate);
  if (chiusa && Number(t.status) === 6) eventi.push({ tipo: 'chiusura', chi: null, data: chiusa });

  const ordine = { apertura: 0, presa: 1, attivita: 2, messaggio: 2, soluzione: 3, approvazione: 4, rifiuto: 4, chiusura: 5 };
  eventi.sort((a, b) => (ms(a.data) || 0) - (ms(b.data) || 0) || ordine[a.tipo] - ordine[b.tipo]);

  const solUltima = [...solutions].sort((a, b) => ms(b.date_creation || b.date) - ms(a.date_creation || a.date))[0];
  const appr = eventi.filter((e) => e.tipo === 'approvazione').pop();
  const soluzioneData = dataValida(t.solvedate) || (solUltima && dataValida(solUltima.date_creation || solUltima.date));
  const tappe = [
    { id: 'aperta', data: aperta, chi: chiApre },
    { id: 'carico', data: presa, chi: chiPresa },
    { id: 'soluzione', data: Number(t.status) >= 5 || solUltima ? soluzioneData : null, chi: solUltima ? persona(solUltima.users_id) : null },
    { id: 'chiusa', data: Number(t.status) === 6 ? chiusa : null, chi: appr ? appr.chi : null }
  ].map((p) => ({ ...p, fatta: !!p.data }));

  // «Gestita da»: solo i tecnici assegnati (dato pubblico del ticket), mai dedotti da contenuti privati
  const gestitaDa = assegnati.map(persona).filter((id) => id && persone[id].ruolo !== 'tu');
  const statoN = Number(t.status);
  const chiusaFlag = statoN >= 5;
  return {
    id: Number(t.id), titolo: t.name, stato: STATI[statoN] || 'In attesa', chiusa: chiusaFlag, statoN,
    aperta, aggiornata: dataValida(t.date_mod), presaInCarico: presa, risolta: soluzioneData, chiusaIl: chiusa,
    descrizione: daHtml(t.content),
    durata: statoN === 6 ? durata(ms(aperta), ms(chiusa)) : null,
    inCaricoDopo: presa ? durata(ms(aperta), ms(presa)) : null,
    aggiornamenti: eventi.filter((e) => ['messaggio', 'soluzione', 'approvazione', 'rifiuto', 'attivita', 'presa'].includes(e.tipo)).length,
    persone, gestitaDa, tappe, eventi,
    // compatibilita' con la 1.x: elenco semplice dei messaggi pubblici
    timeline: eventi.filter((e) => e.tipo === 'messaggio').map((e) => ({ data: e.data, testo: e.testo }))
  };
}

// «A», «A e B», «A, B e C», «A, B e altri N»
function elencoNomi(nomi) {
  if (!nomi.length) return '';
  if (nomi.length === 1) return nomi[0];
  if (nomi.length <= 3) return nomi.slice(0, -1).join(', ') + ' e ' + nomi.at(-1);
  return `${nomi[0]}, ${nomi[1]} e altri ${nomi.length - 2}`;
}

module.exports = { componi, elencoNomi, iniziali, durata, daHtml, idDaLog };
