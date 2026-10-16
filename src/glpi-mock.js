// GLPI finto in memoria: usato dalla modalita' DEMO (DEMO=1) e dai test automatici (GLPI_MOCK=1).
// Non salva nulla su disco: al riavvio i dati tornano quelli di esempio.
const { contenutoTicket } = require('./contenuto');
let seq = 100;
let uid = 1;
const utenti = new Map();
const tickets = new Map();
const nomiStato = { 1: 'In attesa', 2: 'In lavorazione', 4: 'In sospeso', 5: 'Risolta', 6: 'Chiusa' };

// Data in formato GLPI ("AAAA-MM-GG hh:mm:ss") nell'ora locale del server
function fmt(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
const ora = (minutiFa = 0) => fmt(new Date(Date.now() - minutiFa * 60000));

const api = {
  async risolviRichiedente({ email }) { if (!utenti.has(email)) utenti.set(email, uid++); return utenti.get(email); },
  async creaTicket({ userId, categoria, descrizione, telefono, reperibilita, pc, ip, ua }) {
    const id = ++seq;
    tickets.set(id, { id, userId, categoria: categoria.id, contenuto: contenutoTicket({ descrizione, telefono, reperibilita, pc, ip, ua }), titolo: `[${categoria.nome}] ${descrizione.replace(/\s+/g, ' ').slice(0, 60)}`, descrizione, st: 1, aperta: ora(), aggiornata: ora(), tl: [], files: [] });
    return id;
  },
  async allega(id, f) { tickets.get(id).files.push(f.originalname); },
  async elencoTicket(userId) {
    return [...tickets.values()].filter((t) => t.userId === userId)
      .sort((a, b) => b.aggiornata.localeCompare(a.aggiornata))
      .map((t) => ({ id: t.id, titolo: t.titolo, aperta: t.aperta, aggiornata: t.aggiornata, stato: nomiStato[t.st], chiusa: t.st >= 5 }));
  },
  async dettaglio(userId, id) {
    const t = tickets.get(id);
    if (!t || t.userId !== userId) return null;
    return { id, titolo: t.titolo, aperta: t.aperta, aggiornata: t.aggiornata, stato: nomiStato[t.st], chiusa: t.st >= 5, descrizione: t.descrizione, timeline: t.tl };
  },
  async aggiungiMessaggio(userId, id, nome, testo) { const t = tickets.get(id); t.tl.push({ data: ora(), testo: `${nome} (dal portale): ${testo}` }); t.aggiornata = ora(); },
  async esitoSoluzione(userId, id, nome, esito) {
    const t = tickets.get(id);
    if (!t || t.userId !== userId) return null;
    if (t.st !== 5) return 'stato';
    t.st = esito === 'risolto' ? 6 : 2;
    t.tl.push({ data: ora(), testo: `${nome} (dal portale): ` + (esito === 'risolto' ? 'Il richiedente conferma che il problema è risolto.' : 'L\'utente segnala che il problema non è risolto.') });
    t.aggiornata = ora();
    return 'ok';
  },
  async ticketDi(userId, id) { const t = tickets.get(id); return t && t.userId === userId ? t : null; },
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
    for (const t of tickets.values()) righe.push({ data: t.aperta, stato: t.st, presa: 0 });
    return { righe, inLavorazione: righe.filter((r) => r.stato < 5).length, ultimaSoluzione: f(new Date(Date.now() - 17 * 60000)) };
  },
  _tickets: tickets
};

// Dati di esempio per la modalita' DEMO: richieste inventate dell'utente demo
if (process.env.DEMO === '1') {
  const u = 1; // primo utente creato = utente demo
  utenti.set('maria.bianchi@esempio.it', u); uid = 2;
  const esempi = [
    { cat: 'Stampante', st: 2, min: 90, txt: 'La stampante del secondo piano non stampa e dice «offline».', tl: [[60, 'Tecnico: ho riavviato lo spooler, passo in ufficio a controllare il cavo di rete.']] },
    { cat: 'Posta e M365', st: 4, min: 2880, txt: 'Outlook chiede la password ogni volta che lo apro.', tl: [[2000, 'Tecnico: puoi indicarmi quando sei in ufficio? Serve accedere al tuo PC.']] },
    { cat: 'Computer', st: 5, min: 7200, txt: 'Il computer è molto lento all\'avvio.', tl: [[6000, 'Tecnico: abbiamo installato gli aggiornamenti e liberato spazio sul disco. Ora dovrebbe andare meglio.']] }
  ];
  for (const e of esempi) {
    const id = ++seq;
    tickets.set(id, { id, userId: u, categoria: e.cat, titolo: `[${e.cat}] ${e.txt.slice(0, 60)}`, descrizione: e.txt, st: e.st, aperta: ora(e.min), aggiornata: ora(e.tl[0][0]), tl: e.tl.map(([m, t]) => ({ data: ora(m), testo: t })), files: [] });
  }
}

module.exports = api;
