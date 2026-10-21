// Test end-to-end in modalita' DEMO (GLPI finto e accesso simulato): npm test
process.env.DEMO = '1';
process.env.MAX_TICKETS_PER_HOUR = '30';
process.env.BASE_PATH = '/assistenza';
const test = require('node:test');
const assert = require('node:assert');
const app = require('../src/server');
const glpi = require('../src/glpi-client');

let server, url;
test.before(() => new Promise((ok) => { server = app.listen(0, '127.0.0.1', () => { url = `http://127.0.0.1:${server.address().port}/assistenza`; ok(); }); }));
test.after(() => server.close());

// piccolo "browser" con cookie
async function sessione() {
  let cookie = '';
  const rq = async (p, o = {}) => {
    const r = await fetch(url + p, { redirect: 'manual', ...o, headers: { cookie, ...(o.headers || {}) } });
    const sc = r.headers.getSetCookie?.() || [];
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
    return r;
  };
  return { rq, get cookie() { return cookie; } };
}
async function login(s) { await s.rq('/auth/login'); const me = await (await s.rq('/api/me')).json(); return me; }
function form(campi, files = []) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campi)) fd.append(k, v);
  for (const [n, buf] of files) fd.append('allegati', new Blob([buf]), n);
  return fd;
}
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(50)]);
const ok = { categoria: 'computer', telefono: '0123 456', reperibilita: 'mattina', descrizione: 'Il computer non si accende da stamattina' };

test('senza login: API 401', async () => {
  const s = await sessione();
  assert.equal((await s.rq('/api/me')).status, 401);
  assert.equal((await s.rq('/api/richieste')).status, 401);
});

test('CSRF obbligatorio sull\'invio', async () => {
  const s = await sessione(); await login(s);
  const r = await s.rq('/api/richieste', { method: 'POST', body: form(ok) });
  assert.equal(r.status, 403);
});

test('crea richiesta con allegato e la ritrova', async () => {
  const s = await sessione(); const me = await login(s);
  const r = await s.rq('/api/richieste', { method: 'POST', headers: { 'x-csrf-token': me.csrf }, body: form(ok, [['shot.png', PNG]]) });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  const lista = await (await s.rq('/api/richieste')).json();
  assert.ok(lista.some((t) => t.id === id));
  assert.deepEqual(glpi._tickets.get(id).files, ['shot.png']);
});

test('validazioni: descrizione corta, categoria, tipo file, contenuto finto, troppi file', async () => {
  const s = await sessione(); const me = await login(s);
  const h = { 'x-csrf-token': me.csrf };
  const post = (c, f) => s.rq('/api/richieste', { method: 'POST', headers: h, body: form(c, f) });
  assert.equal((await post({ ...ok, descrizione: 'corta' })).status, 400);
  assert.equal((await post({ ...ok, categoria: 'xx' })).status, 400);
  assert.equal((await post(ok, [['virus.exe', Buffer.from('MZ')]])).status, 400);
  assert.equal((await post(ok, [['finto.png', Buffer.from('non sono un png')]])).status, 400);
  assert.equal((await post(ok, Array.from({ length: 6 }, (_, i) => [`a${i}.png`, PNG]))).status, 400);
});

test('utente B non vede né apre i ticket di A', async () => {
  const a = await sessione(); const meA = await login(a);
  const id = (await (await a.rq('/api/richieste', { method: 'POST', headers: { 'x-csrf-token': meA.csrf }, body: form(ok) })).json()).id;
  const b = await sessione(); await b.rq('/auth/login');
  // il login di sviluppo e' sempre lo stesso utente: simulo un secondo utente cambiando email in sessione mock
  const glpiB = await glpi.risolviRichiedente({ email: 'altro.utente@esempio.it' });
  assert.equal(await glpi.dettaglio(glpiB, id), null);
  assert.equal(await glpi.ticketDi(glpiB, id), null);
  assert.equal((await a.rq('/api/richieste/' + id)).status, 200);
  assert.equal((await a.rq('/api/richieste/abc')).status, 404);
  assert.equal((await a.rq('/api/richieste/99999')).status, 404);
});

test('messaggio su richiesta propria', async () => {
  const s = await sessione(); const me = await login(s);
  const id = (await (await s.rq('/api/richieste', { method: 'POST', headers: { 'x-csrf-token': me.csrf }, body: form(ok) })).json()).id;
  const r = await s.rq(`/api/richieste/${id}/messaggi`, { method: 'POST', headers: { 'x-csrf-token': me.csrf, 'content-type': 'application/json' }, body: JSON.stringify({ testo: 'Aggiungo un dettaglio' }) });
  assert.equal(r.status, 201);
  assert.equal((await (await s.rq('/api/richieste/' + id)).json()).timeline.length, 1);
});

test('header di sicurezza e cookie', async () => {
  const s = await sessione();
  const r = await s.rq('/');
  assert.ok(r.headers.get('content-security-policy').includes("default-src 'self'"));
  assert.equal(r.headers.get('x-frame-options'), 'SAMEORIGIN' && r.headers.get('x-frame-options'));
  const l = await s.rq('/auth/login');
  assert.match(l.headers.getSetCookie().join(';'), /HttpOnly/i);
  assert.match(l.headers.getSetCookie().join(';'), /SameSite=Lax/i);
});

test("personalizzazione dell'ente: segnaposto sostituiti e colori serviti", async () => {
  const s = await sessione();
  const html = await (await s.rq('/')).text();
  assert.ok(html.includes('Comune di Esempio'));
  assert.ok(!/\{\{[\w.]+\}\}/.test(html), 'segnaposto non sostituiti');
  assert.ok(html.includes('Powered by Servizio Sistemi Informativi'));
  const css = await (await s.rq('/ente.css')).text();
  assert.match(css, /--primary:#005e8e/);
});

test("modalita' demo: richieste di esempio visibili", async () => {
  const s = await sessione(); await login(s);
  const lista = await (await s.rq('/api/richieste')).json();
  assert.ok(lista.length >= 3);
  assert.ok(lista.some((t) => t.stato === 'Risolta'));
});

test('nome PC da ?pc=, IP da X-Forwarded-For (ultimo valore) e browser nel ticket', async () => {
  const s = await sessione();
  await s.rq('/?pc=PC-UFF-01');
  const me = await login(s);
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0';
  const r = await s.rq('/api/richieste', { method: 'POST', headers: { 'x-csrf-token': me.csrf, 'user-agent': ua, 'x-forwarded-for': '6.6.6.6, 192.0.2.40' }, body: form(ok) });
  const { id } = await r.json();
  const c = glpi._tickets.get(id).ticket.content;
  assert.match(c, /PC: PC-UFF-01 · IP: 192\.0\.2\.40 · Browser: Edge 141 su Windows 10\/11/);
  assert.ok(!c.includes('6.6.6.6'));
});

test('nome PC non valido ignorato', async () => {
  const s = await sessione();
  await s.rq('/?pc=' + encodeURIComponent('<script>x</script>'));
  const me = await login(s);
  const { id } = await (await s.rq('/api/richieste', { method: 'POST', headers: { 'x-csrf-token': me.csrf }, body: form(ok) })).json();
  assert.ok(!glpi._tickets.get(id).ticket.content.includes('PC:'));
});

test('esito della soluzione: risolto chiude, riapri rimette in lavorazione, solo se Risolta', async () => {
  const s = await sessione(); const me = await login(s);
  const h = { 'x-csrf-token': me.csrf, 'content-type': 'application/json' };
  const nuovo = async () => (await (await s.rq('/api/richieste', { method: 'POST', headers: { 'x-csrf-token': me.csrf }, body: form(ok) })).json()).id;
  const esito = (id, e) => s.rq(`/api/richieste/${id}/esito`, { method: 'POST', headers: h, body: JSON.stringify({ esito: e }) });
  const a = await nuovo();
  assert.equal((await esito(a, 'risolto')).status, 409);
  glpi._risolvi(a);
  assert.equal((await esito(a, 'boh')).status, 400);
  assert.equal((await esito(a, 'risolto')).status, 200);
  assert.equal((await (await s.rq('/api/richieste/' + a)).json()).stato, 'Chiusa');
  const b = await nuovo(); glpi._risolvi(b);
  assert.equal((await esito(b, 'riapri')).status, 200);
  assert.equal((await (await s.rq('/api/richieste/' + b)).json()).stato, 'In lavorazione');
  const altro = await glpi.risolviRichiedente({ email: 'altro3@esempio.it' });
  glpi._risolvi(b);
  assert.equal(await glpi.esitoSoluzione(altro, b, 'X', 'risolto'), null);
});

test('consigli prima di inviare disponibili', async () => {
  const s = await sessione(); await login(s);
  const c = await (await s.rq('/api/suggerimenti')).json();
  assert.ok(Array.isArray(c) && c.length >= 7);
});

// Ultimo: consuma il limite di invii dell'utente di prova
test('rate limit sull\'invio', async () => {
  const s = await sessione(); const me = await login(s);
  let ultimo;
  for (let i = 0; i < 35; i++) ultimo = (await s.rq('/api/richieste', { method: 'POST', headers: { 'x-csrf-token': me.csrf }, body: form(ok) })).status;
  assert.equal(ultimo, 429);
});

