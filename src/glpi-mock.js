// GLPI finto in memoria: usato dalla modalita' DEMO (DEMO=1) e dai test automatici (GLPI_MOCK=1).
// Non salva nulla su disco: al riavvio i dati tornano quelli di esempio. I ticket hanno la stessa forma
// dei dati dell'API di GLPI, cosi' il dettaglio passa dalla stessa composizione (ticket-dettaglio.js).
const { contenutoTicket } = require('./contenuto');
const { componi } = require('./ticket-dettaglio');
let seq = 100;
let uid = 1;
let fid = 1;
const utenti = new Map(); // email -> id
const nomi = new Map([[900, { nome: 'Rossi Giulia', email: 'giulia.rossi@esempio.it' }], [901, { nome: 'Verdi Paolo', email: 'paolo.verdi@esempio.it' }], [902, { nome: 'Neri Anna', email: 'anna.neri@esempio.it' }]]);
const tickets = new Map(); // id -> { ticket, ticketUsers, followups, solutions, tasks, logs }
const nomiStato = { 1: 'In attesa', 2: 'In lavorazione', 3: 'In lavorazione', 4: 'In sospeso', 5: 'Risolta', 6: 'Chiusa' };

// Data in formato GLPI ("AAAA-MM-GG hh:mm:ss") nell'ora locale del server
function fmt(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
const ora = (minutiFa = 0) => fmt(new Date(Date.now() - minutiFa * 60000));
const nuovoTicket = (id, userId, titolo, contenuto, minFa) => ({
  ticket: { id, name: titolo, content: contenuto, status: 1, date: ora(minFa), date_mod: ora(minFa), takeintoaccountdate: null, solvedate: null, closedate: null, users_id_recipient: 999 },
  ticketUsers: [{ type: 1, users_id: userId }], followups: [], solutions: [], tasks: [], logs: [], files: []
});
const tocca = (r, minFa = 0) => { r.ticket.date_mod = ora(minFa); };
const fu = (r, users_id, minFa, testo, privato = false) => { r.followups.push({ id: fid++, users_id, is_private: privato ? 1 : 0, date_creation: ora(minFa), content: `<p>${testo}</p>` }); tocca(r, minFa); };
function prendi(r, tecnico, minFa) {
  r.ticketUsers.push({ type: 2, users_id: tecnico });
  r.ticket.takeintoaccountdate = ora(minFa); r.ticket.status = 2;
  r.logs.push({ id_search_option: 150, user_name: `${nomi.get(tecnico).nome} (${tecnico})`, old_value: '0' });
  tocca(r, minFa);
}
function soluzione(r, tecnico, minFa, testo) {
  r.solutions.push({ id: fid++, users_id: tecnico, status: 2, date_creation: ora(minFa), content: `<p>${testo}</p>`, date_approval: null, users_id_approval: 0 });
  r.ticket.status = 5; r.ticket.solvedate = ora(minFa); tocca(r, minFa);
}

const api = {
  async risolviRichiedente({ email, name }) {
    if (!utenti.has(email)) utenti.set(email, uid++);
    const id = utenti.get(email);
    if (!nomi.has(id)) nomi.set(id, { nome: name || email, email });
    return id;
  },
  async creaTicket({ userId, categoria, sottotipo, descrizione, telefono, reperibilita, pc, ip, ua }) {
    const id = ++seq;
    const r = nuovoTicket(id, userId, `[${categoria.nome}] ${descrizione.replace(/\s+/g, ' ').slice(0, 60)}`, contenutoTicket({ sottotipo, descrizione, telefono, reperibilita, pc, ip, ua }), 0);
    r.categoria = categoria.id; r.sottotipo = sottotipo || null; r.reperibilita = reperibilita || null; r.telefono = telefono || null;
    tickets.set(id, r);
    return id;
  },
  async allega(id, f) { tickets.get(id).files.push(f.originalname); },
  async elencoTicket(userId) {
    return [...tickets.values()].filter((r) => r.ticketUsers.some((u) => u.type === 1 && u.users_id === userId))
      .sort((a, b) => b.ticket.date_mod.localeCompare(a.ticket.date_mod))
      .map(({ ticket: t }) => ({ id: t.id, titolo: t.name, aperta: t.date, aggiornata: t.date_mod, stato: nomiStato[t.status], chiusa: t.status >= 5 }));
  },
  async dettaglioGrezzo(userId, id) {
    const r = tickets.get(id);
    if (!r || !r.ticketUsers.some((u) => u.type === 1 && u.users_id === userId)) return null;
    const ids = new Set([...r.ticketUsers.map((u) => u.users_id), ...r.followups.map((f) => f.users_id), ...r.solutions.flatMap((s) => [s.users_id, s.users_id_approval])]);
    const users = {};
    for (const i of ids) if (nomi.has(i)) users[i] = nomi.get(i);
    // come l'API reale: i contenuti privati vengono scartati prima di uscire dal client
    return { ticket: r.ticket, ticketUsers: r.ticketUsers, followups: r.followups.filter((f) => !f.is_private), solutions: r.solutions, tasks: r.tasks.filter((k) => !k.is_private), logs: r.logs, users };
  },
  async dettaglio(userId, id) {
    const raw = await api.dettaglioGrezzo(userId, id);
    return raw ? { ...componi(raw, userId), _users: raw.users } : null;
  },
  async aggiungiMessaggio(userId, id, nome, testo) { fu(tickets.get(id), userId, 0, `<b>${nome} (dal portale):</b></p><p>${testo}`); },
  async esitoSoluzione(userId, id, nome, esito) {
    const r = tickets.get(id);
    if (!r || !r.ticketUsers.some((u) => u.type === 1 && u.users_id === userId)) return null;
    if (r.ticket.status !== 5) return 'stato';
    const s = r.solutions.at(-1);
    s.status = esito === 'risolto' ? 3 : 4; s.date_approval = ora(); s.users_id_approval = userId;
    fu(r, userId, 0, `<b>${nome} (dal portale):</b></p><p>` + (esito === 'risolto' ? 'Il richiedente conferma che il problema è risolto.' : 'L\'utente segnala che il problema non è risolto.'));
    if (esito === 'risolto') { r.ticket.status = 6; r.ticket.closedate = ora(); } else r.ticket.status = 2;
    return 'ok';
  },
  async ticketDi(userId, id) { const r = tickets.get(id); return r && r.ticketUsers.some((u) => u.type === 1 && u.users_id === userId) ? r.ticket : null; },
  async killSession() {},
  // Barra «Live»: numeri finti ma plausibili (STATS_MOCK_ERRORE=1 simula GLPI non raggiungibile)
  async statsSorgente(da) {
    if (process.env.STATS_MOCK_ERRORE === '1') throw new Error('GLPI finto non raggiungibile');
    const righe = [];
    const due = (n) => String(n).padStart(2, '0');
    const f = (d) => `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())} ${due(d.getHours())}:${due(d.getMinutes())}:00`;
    for (let t = da.getTime(), i = 0; t < Date.now(); t += 3 * 3600 * 1000, i++) {
      const d = new Date(t);
      if (d.getHours() < 8 || d.getHours() > 17 || d.getDay() === 0 || d.getDay() === 6) continue;
      righe.push({ data: f(d), stato: Date.now() - t < 2 * 86400000 && i % 3 ? 2 : (i % 11 ? 6 : 4), presa: 600 + (i % 7) * 420 });
    }
    for (const r of tickets.values()) righe.push({ data: r.ticket.date, stato: r.ticket.status, presa: 0 });
    return { righe, inLavorazione: righe.filter((r) => r.stato < 5).length, ultimaSoluzione: f(new Date(Date.now() - 17 * 60000)) };
  },
  _tickets: tickets,
  _risolvi(id) { const r = tickets.get(id); if (!r.ticketUsers.some((x) => x.type === 2)) prendi(r, 900, 1); soluzione(r, 900, 0, 'Risolto (test).'); },
  _esempi: creaEsempi
};

// Richieste di esempio (modalita' DEMO e test): stessi casi da verificare sul server reale
function creaEsempi(u) {
  const lista = [];
  const add = (titolo, testo, min) => { const id = ++seq; const r = nuovoTicket(id, u, titolo, `<p>${testo}</p>`, min); tickets.set(id, r); lista.push(r); return r; };
  // 1) completa: presa in carico, soluzione di un altro tecnico, approvazione, chiusura
  const a = add('[Computer] Avvio del server di consultazione', 'Chiedo l\'accensione del server per una consultazione dell\'archivio.', 87);
  prendi(a, 900, 83); a.ticketUsers.push({ type: 2, users_id: 901 });
  soluzione(a, 901, 15, 'Server avviato. Prova ad accedere e dimmi se è tutto a posto.');
  a.solutions[0].status = 3; a.solutions[0].date_approval = ora(0.5); a.solutions[0].users_id_approval = u;
  fu(a, u, 0.5, 'Soluzione approvata'); a.ticket.status = 6; a.ticket.closedate = ora(0.4);
  // 2) in lavorazione con un messaggio pubblico e una nota PRIVATA (non deve comparire)
  const b = add('[Stampante] La stampante del secondo piano non stampa', 'La stampante del secondo piano non stampa e dice «offline».', 90);
  prendi(b, 902, 70); fu(b, 902, 60, 'Ho riavviato lo spooler, passo in ufficio a controllare il cavo di rete.');
  fu(b, 902, 55, 'NOTA PRIVATA: cavo da sostituire, chiedere preventivo', true);
  b.tasks.push({ id: fid++, users_id_tech: 902, is_private: 1, date_creation: ora(50), content: '<p>ATTIVITA PRIVATA</p>' });
  // 3) appena aperta: nessun tecnico, nessun aggiornamento
  add('[Posta e M365] Outlook chiede la password ogni volta', 'Outlook chiede la password ogni volta che lo apro.', 20);
  // 4) risolta, in attesa della conferma del richiedente
  const d = add('[Computer] Il computer è molto lento all\'avvio', 'Il computer è molto lento all\'avvio.', 7200);
  prendi(d, 900, 7000); soluzione(d, 900, 6000, 'Abbiamo installato gli aggiornamenti e liberato spazio sul disco. Ora dovrebbe andare meglio.');
  return lista;
}

if (process.env.DEMO === '1') {
  const u = 1; // primo utente creato = utente demo
  utenti.set('maria.bianchi@esempio.it', u); nomi.set(u, { nome: 'Bianchi Maria', email: 'maria.bianchi@esempio.it' }); uid = 2;
  creaEsempi(u);
}

module.exports = api;
