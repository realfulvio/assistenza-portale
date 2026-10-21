const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { creaServizio, collega } = require('../src/assistente');
function ambiente(extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assistente-test-'));
  const faqPath = path.join(dir, 'faq.json');
  fs.writeFileSync(faqPath, JSON.stringify([{ id: 'stampante', d: 'Stampante bloccata', intro: 'Controlla se ci sono fogli incastrati senza smontare la stampante.' }]));
  let calls = [];
  const deps = { config: { base: '/assistenza', faqPath, categorie: { categorie: [{ id: 'pc', nome: 'Computer' }, { id: 'stampante', titolo: 'Stampanti' }] }, ente: {} },
    cacheFile: path.join(dir, 'indice.json'),
    numeriInterni: { carica: () => ({ sezioni: [{ titolo: 'Anagrafe', voci: [{ nome: 'Sportello', numero: '123' }] }] }) },
    utenteGlpi: async (req) => req.session.user.oid,
    glpi: { elencoTicket: async (id) => { calls.push(id); return [{ id: 1, titolo: 'Esempio', stato: 'In attesa', aperta: '2026-10-20' }]; },
      dettaglio: async (user, id) => { calls.push([user, id]); return user === 'alice' && id === 1 ? { titolo: 'Visibile', stato: 'Aperta', descrizione: 'Pubblico', _users: { segreto: 'non esporre' } } : null; } },
    chiamaAI: async (endpoint, body) => { calls.push(endpoint); return endpoint === '/api/embed' ? { embeddings: body.input.map(() => [1, 0]) } : { message: { content: 'Controlla la guida della stampante.' } }; }, ...extra };
  return { deps, calls, dir, servizio: creaServizio(deps), req: (id = 'alice') => ({ sessionID: id, session: { user: { oid: id } }, body: {} }),
    pulisci: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
async function invia(s, req, body) { req.body = body; return s.gestisci(req); }
test('contatti precisi disponibili anche con AI fuori servizio', async () => {
  const a = ambiente({ chiamaAI: async () => { throw new Error('offline'); } });
  try {
    const out = await invia(a.servizio, a.req(), { testo: 'Qual è il numero dell’anagrafe?' });
    assert.equal(out.contatti[0].numero, '123');
    assert.equal((await invia(a.servizio, a.req(), { testo: 'Numero del reparto inesistente' })).contatti.length, 0);
  } finally { a.pulisci(); }
});
test('suggerimenti di testo: fatti esatti, categorie validate, nessuna scrittura', async () => {
  const a = ambiente(), req = a.req();
  try {
    await invia(a.servizio, req, { azione: 'ticket' });
    await invia(a.servizio, req, { testo: 'La stampante non stampa' });
    await assert.rejects(invia(a.servizio, req, { azione: 'categoria', categoria: 'inesistente' }), { status: 400 });
    await invia(a.servizio, req, { azione: 'categoria', categoria: 'stampante' });
    await invia(a.servizio, req, { testo: 'Carta esaurita' });
    await invia(a.servizio, req, { testo: 'Ho aggiunto carta ma non cambia' });
    const out = await invia(a.servizio, req, { testo: 'Stampante corridoio' });
    assert.equal(out.bozza.categoria, 'Stampanti');
    assert.equal(out.bozza.descrizione, 'La stampante non stampa\n\nMessaggio di errore: Carta esaurita\n\nVerifiche già effettuate: Ho aggiunto carta ma non cambia\n\nPostazione o programma: Stampante corridoio');
    assert.deepEqual(a.calls, []);
  } finally { a.pulisci(); }
});
test('stato ticket rispetta utente e non espone utenti interni', async () => {
  const a = ambiente();
  try {
    const out = await invia(a.servizio, a.req(), { testo: 'Stato ticket #1' });
    assert.equal(out.richieste[0].titolo, 'Visibile');
    assert.ok(!JSON.stringify(out).includes('segreto'));
    assert.deepEqual((await invia(a.servizio, a.req('bob'), { testo: 'Stato ticket #1' })).richieste, []);
    assert.deepEqual(a.calls, [['alice', 1], ['bob', 1]]);
  } finally { a.pulisci(); }
});
test('sessione cambiata azzera la conversazione', async () => {
  const a = ambiente(), req = a.req();
  try {
    await invia(a.servizio, req, { testo: 'Numero anagrafe' });
    req.session.user.oid = 'bob';
    assert.deepEqual(a.servizio.stato(req).messaggi, []);
  } finally { a.pulisci(); }
});
test('problema non risolto non viene scambiato per stato dei ticket', async () => {
  const a = ambiente();
  try {
    assert.equal((await invia(a.servizio, a.req(), { testo: 'Non ho risolto il problema della stampante' })).tipo, 'chat');
    assert.ok(a.calls.includes('/api/chat'));
  } finally { a.pulisci(); }
});
test('FAQ rilette: modifica invalida indice e aggiorna fonti', async () => {
  const a = ambiente();
  try {
    const primo = await a.servizio.preparaIndice();
    fs.writeFileSync(a.deps.config.faqPath, JSON.stringify([{ id: 'rete', d: 'Rete', intro: 'Controlla il cavo di rete.' }]));
    const secondo = await a.servizio.preparaIndice();
    assert.notEqual(primo.impronta, secondo.impronta);
    assert.ok(secondo.documenti.some((d) => d.id === 'rete'));
    assert.ok(!secondo.documenti.some((d) => d.id === 'stampante'));
  } finally { a.pulisci(); }
});
test('API: autenticazione, CSRF e logout mentre il modello risponde', async () => {
  const express = require('express'), session = require('express-session');
  let sblocca, iniziata;
  const attesa = new Promise((r) => { iniziata = r; });
  const a = ambiente({ chiamaAI: async (endpoint, body) => endpoint === '/api/embed' ? { embeddings: body.input.map(() => [1, 0]) } : (iniziata(), await new Promise((r) => { sblocca = () => r({ message: { content: 'Risposta' } }); })) });
  const app = express(), api = express.Router();
  app.use(express.json()); app.use(session({ secret: 'solo-test-isolato', resave: false, saveUninitialized: false }));
  app.post('/test-login', (req, res) => { req.session.user = { oid: 'alice' }; res.json({ ok: true }); });
  app.post('/test-logout', (req, res) => req.session.destroy(() => res.end()));
  collega(api, { ...a.deps, serveLogin: (req, res, next) => req.session.user ? next() : res.sendStatus(401), csrf: (req, res, next) => req.get('X-CSRF-Token') === 'prova' ? next() : res.sendStatus(403) });
  app.use('/api', api);
  const server = app.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    assert.equal((await fetch(base + '/api/assistente')).status, 401);
    const login = await fetch(base + '/test-login', { method: 'POST' });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(base + '/api/assistente', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    const pendente = fetch(base + '/api/assistente', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': 'prova' }, body: JSON.stringify({ testo: 'La stampante è bloccata' }) });
    await attesa;
    await fetch(base + '/test-logout', { method: 'POST', headers: { Cookie: cookie } });
    sblocca();
    assert.equal((await pendente).status, 401);
    assert.equal((await fetch(base + '/api/assistente', { headers: { Cookie: cookie } })).status, 401);
  } finally { server.closeAllConnections(); await new Promise((r) => server.close(r)); a.pulisci(); }
});
