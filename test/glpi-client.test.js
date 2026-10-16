// Contratto HTTP del client operativo: non usa il GLPI mock dell'applicazione.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
process.env.DEMO = '0'; process.env.NODE_ENV = 'test'; delete process.env.GLPI_MOCK;
let server, glpi;
const calls = [];
let taskStatus = 200, capPagina = 200, interrompiPost = false;
const ticket = { id: 42, status: 5, name: 'Ticket di prova', content: '<p>Richiesta</p>', date: '2026-10-16 10:00:00' };
const followups = [{ id: 1, users_id: 9, is_private: 0, date: '2026-10-16 10:01:00', content: '<p>Pubblico</p>' }, { id: 2, users_id: 777, is_private: 1, content: '<p>NOTA RISERVATA</p>' }];
test.before(async () => {
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let body = ''; for await (const chunk of req) body += chunk;
    calls.push({ method: req.method, path: url.pathname, query: url.searchParams, body: body ? JSON.parse(body) : null });
    const send = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
    const p = url.pathname.replace('/apirest.php', '');
    if (p === '/initSession') return send({ session_token: 'sessione-fittizia' });
    if (p === '/killSession') return send({});
    if (p === '/Ticket/42') return send(ticket);
    if (p === '/Ticket/42/Ticket_User') return send([{ type: 1, users_id: 9 }, { type: 2, users_id: 11 }]);
    if (p === '/Ticket/42/ITILFollowup') {
      const [da, richiesto] = (url.searchParams.get('range') || '0-49').split('-').map(Number);
      const a = Math.min(richiesto, da + capPagina - 1);
      if (da >= followups.length) return send(['ERROR_RANGE_EXCEED_TOTAL'], 416);
      res.setHeader('Content-Range', `${da}-${Math.min(a, followups.length - 1)}/${followups.length}`);
      return send(followups.slice(da, a + 1));
    }
    if (p === '/Ticket/42/TicketTask') return send(taskStatus === 200 ? [{ id: 3, users_id_tech: 11, is_private: 0, date: '2026-10-16 11:00:00', content: '<p>Attività pubblica</p>' }, { id: 4, users_id_tech: 888, is_private: 1, content: 'ATTIVITÀ RISERVATA' }] : ['ERROR_RIGHT_MISSING', 'Permesso mancante'], taskStatus);
    if (p === '/Ticket/42/ITILSolution' || p === '/Ticket/42/Log') return send([]);
    if (p === '/search/User') {
      const ids = [...url.searchParams].filter(([key]) => /^criteria\[\d+\]\[value\]$/.test(key)).map(([, value]) => Number(value));
      return send({ data: ids.map(id => id === 9 ? { 2: 9, 34: 'Maria', 9: 'Bianchi', 5: 'maria@esempio.it' } : id === 11 ? { 2: 11, 34: 'Tecnico', 9: 'Prova', 5: 'tecnico@esempio.it' } : { 2: id, 1: 'login-' + id + '@esempio.it', 5: 'login-' + id + '@esempio.it', ...(id === 100 ? {} : { 34: 'Tecnico', 9: 'Prova ' + id }) }) });
    }
    if (p === '/ITILFollowup' && req.method === 'POST') { if (interrompiPost) return req.socket.destroy(); return send({ id: 99 }, 201); }
    send(['ERROR_ITEM_NOT_FOUND'], 404);
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  process.env.GLPI_URL = `http://127.0.0.1:${server.address().port}`;
  glpi = require('../src/glpi-client');
});
test.after(async () => { await glpi.killSession(); server.close(); });

test('client HTTP: proprietario controllato prima di leggere attività o utenti; privati esclusi anche dai nomi', async () => {
  calls.length = 0;
  assert.equal(await glpi.dettaglio(123, 42), null);
  assert.ok(!calls.some(c => /ITILFollowup|TicketTask|search\/User/.test(c.path)));
  calls.length = 0;
  const d = await glpi.dettaglio(9, 42);
  assert.ok(d.eventi.some(e => e.tipo === 'attivita' && e.testo === 'Attività pubblica'));
  assert.ok(!JSON.stringify(d).includes('RISERVAT'));
  const query = calls.find(c => c.path.endsWith('/search/User')).query;
  assert.ok(![...query.values()].includes('777'));
  assert.ok(![...query.values()].includes('888'));
});

test('client HTTP: messaggi e conferme attribuiti al richiedente invece che all’account API', async () => {
  calls.length = 0;
  await glpi.aggiungiMessaggio(9, 42, 'Maria Bianchi', 'Messaggio dal portale');
  assert.equal(await glpi.esitoSoluzione(9, 42, 'Maria Bianchi', 'risolto'), 'ok');
  const posts = calls.filter(c => c.method === 'POST');
  assert.equal(posts.length, 2);
  for (const c of posts) assert.equal(c.body.input.users_id, 9);
  assert.equal(posts[1].body.input.add_close, 1);
  assert.equal(await glpi.esitoSoluzione(123, 42, 'Altro', 'risolto'), null);
});


test('client HTTP: una conversazione oltre 200 eventi include anche i messaggi più recenti', async () => {
  const originali = [...followups];
  try {
    followups.length = 0; capPagina = 37;
    for (let i = 0; i < 205; i++) followups.push({ id: i + 1, users_id: 9, is_private: 0, date: '2026-10-16 11:00:00', content: '<p>Messaggio ' + i + '</p>' });
    const d = await glpi.dettaglio(9, 42);
    assert.equal(d.eventi.filter(e => e.tipo === 'messaggio').length, 205);
    assert.ok(d.eventi.some(e => e.testo === 'Messaggio 204'));
  } finally { followups.splice(0, followups.length, ...originali); capPagina = 200; }
});


test('client HTTP: oltre 50 autori letti a blocchi e nessuna email usata come nome', async () => {
  const originali = [...followups];
  try {
    followups.length = 0; calls.length = 0;
    for (let id = 100; id < 160; id++) followups.push({ id, users_id: id, is_private: 0, date: '2026-10-16 11:00:00', content: 'Messaggio' });
    const d = await glpi.dettaglio(9, 42);
    assert.equal(calls.filter(c => c.path.endsWith('/search/User')).length, 2);
    assert.equal(d.persone[159].nome, 'Tecnico Prova 159');
    assert.equal(d.persone[100].nome, 'Assistenza');
    assert.ok(!JSON.stringify(d.persone).includes('@'));
  } finally { followups.splice(0, followups.length, ...originali); }
});

test('client HTTP: risposta persa dopo un POST non ripete un messaggio forse già salvato', async () => {
  calls.length = 0; interrompiPost = true;
  try {
    await assert.rejects(glpi.aggiungiMessaggio(9, 42, 'Maria Bianchi', 'Messaggio unico'));
    assert.equal(calls.filter(c => c.method === 'POST').length, 1);
  } finally { interrompiPost = false; }
});

test('client HTTP: attività pubbliche negate dal profilo API, pagina utilizzabile e un solo avviso nel log', async () => {
  const avvisi = [];
  const warn = console.warn;
  console.warn = (...a) => avvisi.push(a.join(' '));
  taskStatus = 401;
  try {
    const d = await glpi.dettaglio(9, 42);
    assert.ok(d && d.eventi.length, 'il dettaglio resta disponibile');
    assert.ok(!d.eventi.some(e => e.tipo === 'attivita'));
    await glpi.dettaglio(9, 42);
    const mie = avvisi.filter(t => t.includes('TicketTask'));
    assert.equal(mie.length, 1, 'avviso ripetuto al massimo una volta l’ora');
    assert.match(mie[0], /lettura negata, controlla i diritti del profilo API/);
    assert.ok(!/Maria|Bianchi|Ticket di prova/.test(mie[0]), 'nessun dato del ticket nel log');
  } finally { console.warn = warn; taskStatus = 200; }
});
