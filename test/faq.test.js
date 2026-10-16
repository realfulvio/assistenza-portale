// Test delle guide (FAQ): logica, contenuti e API. Nessun browser: npm test
process.env.DEMO = '1';
process.env.BASE_PATH = '/assistenza';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const app = require('../src/server');
const L = require('../public/faq.js');
const { verifica } = require('../scripts/verifica-faq');

const root = path.join(__dirname, '..');
const faqRaw = JSON.parse(fs.readFileSync(path.join(root, 'content', 'faq.json'), 'utf8'));

let server, url;
test.before(() => new Promise((ok) => { server = app.listen(0, '127.0.0.1', () => { url = `http://127.0.0.1:${server.address().port}/assistenza`; ok(); }); }));
test.after(() => server.close());

async function sessione() {
  let cookie = '';
  const rq = async (p, o = {}) => {
    const r = await fetch(url + p, { redirect: 'manual', ...o, headers: { cookie, ...(o.headers || {}) } });
    const sc = r.headers.getSetCookie?.() || [];
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
    return r;
  };
  return rq;
}

// ---------- formato dati e compatibilità con il vecchio formato ----------
test('vecchio formato { d, r }: resta valido e riceve id e categoria', () => {
  const v = L.normalizza([{ d: 'Il PC è lento', r: 'Riavvia.' }, { d: 'Il PC è lento', r: 'Altro.' }, { r: 'senza titolo' }, null, 'testo']);
  assert.equal(v.length, 2);
  assert.equal(v[0].r, 'Riavvia.');
  assert.equal(v[0].cat, 'altro');
  assert.deepEqual(v[0].passi, []);
  assert.notEqual(v[0].id, v[1].id, 'gli id devono essere unici');
  assert.match(v[0].id, /^[a-z0-9-]+$/);
});

test('formato esteso: campi, id dato e valori non validi scartati', () => {
  const [g] = L.normalizza([{ id: 'prova', cat: 'rete', d: 'Titolo', intro: ' i ', controlli: ['a', '', 7], passi: ['uno', { t: 'due', img: 'img/faq/x.webp', alt: 'alt', w: 10, h: 5 }, { t: '' }, { t: 'tre', img: '../../etc/passwd.png', alt: 'x' }, { t: 'quattro', img: 'https://esempio.it/x.png' }], vedi: ['altra', 'NON VALIDO!'] }]);
  assert.equal(g.id, 'prova');
  assert.equal(g.cat, 'rete');
  assert.deepEqual(g.controlli, ['a', '7']);
  assert.equal(g.passi.length, 4);
  assert.equal(g.passi[1].img, 'img/faq/x.webp');
  assert.equal(g.passi[1].w, 10);
  assert.equal(g.passi[2].img, '', 'percorsi con .. non ammessi');
  assert.equal(g.passi[3].img, '', 'indirizzi esterni non ammessi');
  assert.deepEqual(g.vedi, ['altra']);
  assert.deepEqual(L.normalizza('non un elenco'), []);
});

// ---------- ricerca e filtri ----------
test('ricerca: senza accenti, senza maiuscole, tutte le parole, ordine per titolo', () => {
  const v = L.normalizza(faqRaw);
  assert.equal(L.filtra(v, '', 'tutte').length, v.length);
  const s = L.filtra(v, 'STAMPANTE offline', 'tutte');
  assert.ok(s.length >= 1);
  assert.equal(s[0].id, 'stampante-offline');
  assert.ok(L.filtra(v, 'pc è lento', 'tutte').some((x) => x.id === 'pc-lento-bloccato'));
  assert.ok(L.filtra(v, 'pc e lento', 'tutte').some((x) => x.id === 'pc-lento-bloccato'), 'accento ignorato');
  assert.equal(L.filtra(v, 'zzzzqqqq', 'tutte').length, 0);
  assert.ok(L.filtra(v, 'outlook', 'tutte').some((x) => x.id === 'outlook-non-si-apre'));
  assert.ok(L.filtra(v, 'phishing', 'tutte').some((x) => x.id === 'mail-sospetta'), 'cerca anche nelle parole chiave');
});

test('filtri per categoria', () => {
  const v = L.normalizza(faqRaw);
  const cats = L.categorie(v);
  assert.equal(cats.reduce((n, c) => n + c.n, 0), v.length);
  for (const c of cats) {
    const r = L.filtra(v, '', c.id);
    assert.equal(r.length, c.n);
    assert.ok(r.every((x) => x.cat === c.id));
  }
  assert.ok(cats.every((c) => c.nome && c.nome[0] === c.nome[0].toUpperCase()));
  const st = L.filtra(v, 'stampante', 'stampanti');
  assert.ok(st.length > 0 && st.every((x) => x.cat === 'stampanti'));
  assert.equal(L.filtra(v, 'stampante', 'rete').length, 0);
});

test('link diretti: idDaHash', () => {
  assert.equal(L.idDaHash('#faq/stampante-offline'), 'stampante-offline');
  assert.equal(L.idDaHash('faq/Stampante-Offline/'), 'stampante-offline');
  assert.equal(L.idDaHash('#faq'), null);
  assert.equal(L.idDaHash('#richieste'), null);
  assert.equal(L.idDaHash('#faq/../x'), null);
  assert.equal(L.idDaHash(''), null);
});

// ---------- contenuti ----------
test('contenuti: nessun errore di struttura, id unici, immagini presenti e della giusta dimensione', () => {
  const r = verifica(root);
  assert.deepEqual(r.errori, []);
  assert.ok(r.guide >= 30);
});

test('contenuti: ogni guida ha tutti gli elementi e non ci sono duplicati', () => {
  const ids = new Set(); const titoli = new Set();
  for (const v of faqRaw) {
    assert.ok(v.id && !ids.has(v.id), 'id mancante o duplicato: ' + v.id); ids.add(v.id);
    assert.ok(!titoli.has(v.d), 'titolo duplicato: ' + v.d); titoli.add(v.d);
    if (!v.passi) continue; // guida nel vecchio formato
    for (const k of ['intro', 'ok', 'stop', 'richiesta']) assert.ok(v[k], `${v.id}: manca ${k}`);
    assert.ok(v.passi.length >= 1 && v.passi.length <= 8, `${v.id}: numero di passi anomalo`);
    for (const p of v.passi) assert.ok(p.t.length < 400, `${v.id}: passo troppo lungo`);
  }
  assert.ok(faqRaw.some((v) => !v.passi && v.r), 'deve esserci ancora almeno una voce nel vecchio formato');
});

test('contenuti: nessun dato riservato (indirizzi IP, e-mail, nomi di host) nei testi delle guide', () => {
  const testo = fs.readFileSync(path.join(root, 'content', 'faq.json'), 'utf8') + fs.readFileSync(path.join(root, 'content', 'suggerimenti.json'), 'utf8');
  assert.doesNotMatch(testo, /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, 'indirizzo IP');
  assert.doesNotMatch(testo, /[\w.-]+@[\w-]+\.[a-z]{2,}/i, 'indirizzo e-mail');
  assert.doesNotMatch(testo, /\.local\b|bondeno|comune\.bondeno/i, 'nome interno');
});

// ---------- API e file statici ----------
test('API guide: richiede il login, restituisce un elenco valido', async () => {
  const rq = await sessione();
  assert.equal((await rq('/api/faq')).status, 401);
  await rq('/auth/login');
  const r = await rq('/api/faq');
  assert.equal(r.status, 200);
  const dati = await r.json();
  assert.equal(dati.length, faqRaw.length);
  assert.equal(L.normalizza(dati).length, faqRaw.length);
});

test('suggerimenti: ogni voce con "guida" punta a una guida esistente', async () => {
  const rq = await sessione(); await rq('/auth/login');
  const sug = await (await rq('/api/suggerimenti')).json();
  const ids = new Set(faqRaw.map((v) => v.id));
  assert.ok(sug.length >= 7);
  assert.ok(sug.some((s) => s.guida), 'almeno una voce collegata alle guide');
  assert.ok(sug.some((s) => !s.guida && s.titolo && s.passi), 'il vecchio formato dei suggerimenti resta valido');
  for (const s of sug) if (s.guida) assert.ok(ids.has(s.guida), s.guida);
});

test('immagini delle guide: servite come immagini e CSP invariata', async () => {
  const rq = await sessione();
  const imgs = faqRaw.flatMap((v) => (v.passi || []).map((p) => p.img)).filter(Boolean);
  assert.ok(imgs.length >= 8, 'servono almeno 8 immagini');
  for (const i of imgs) {
    const r = await rq('/' + i);
    assert.equal(r.status, 200, i);
    assert.match(r.headers.get('content-type'), /^image\//, i);
    const buf = Buffer.from(await r.arrayBuffer());
    assert.ok(buf.length > 500, i);
  }
  const csp = (await rq('/')).headers.get('content-security-policy');
  assert.match(csp, /img-src 'self' data: blob:/);
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.doesNotMatch(csp, /unsafe-inline/);
});

test('pagina: carica faq.js prima di app.js e contiene i comandi della sezione Guide', async () => {
  const rq = await sessione();
  const html = await (await rq('/')).text();
  assert.ok(html.indexOf('faq.js') > 0 && html.indexOf('faq.js') < html.indexOf('app.js'));
  for (const id of ['faq-cerca', 'faq-chips', 'faq-lista', 'faq-zoom', 'faq-vuoto']) assert.match(html, new RegExp(`id="${id}"`));
  const js = await rq('/faq.js');
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /javascript/);
});
