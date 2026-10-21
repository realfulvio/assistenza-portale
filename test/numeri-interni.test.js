// Test dei numeri interni (sotto Contatti): logica, lettura del file locale, API e pagina. Nessun browser: npm test
process.env.DEMO = '1';
process.env.BASE_PATH = '/assistenza';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const app = require('../src/server');
const N = require('../public/numeri-interni.js');
const { carica } = require('../src/numeri-interni');
const { daCsv } = require('../scripts/numeri-interni-da-csv');

const root = path.join(__dirname, '..');
const esempio = path.join(root, 'content', 'numeri-interni.example.json');

let server, url;
test.before(() => new Promise((ok) => { server = app.listen(0, '127.0.0.1', () => { url = `http://127.0.0.1:${server.address().port}/assistenza`; ok(); }); }));
test.after(() => server.close());

const dati = {
  sezioni: [
    { titolo: 'Sede', voci: [{ nome: 'Anagrafe', numero: '121', nota: 'Città' }, { nome: 'Centralino', numero: 100 }, { nome: 'Senza numero' }, { numero: '5' }] },
    { titolo: 'Sede', voci: [{ nome: 'Polizia locale', numero: '600', esterno: true }] },
    { titolo: 'Vuota', voci: [] },
    { voci: [{ nome: 'x', numero: '1' }] }
  ]
};

test('normalizza: scarta voci e sezioni incomplete, id unici, numeri come testo', () => {
  const r = N.normalizza(dati);
  assert.equal(r.sezioni.length, 2);
  assert.deepEqual(r.sezioni[0].voci.map((v) => v.nome), ['Anagrafe', 'Centralino']);
  assert.equal(r.sezioni[0].voci[1].numero, '100');
  assert.notEqual(r.sezioni[0].id, r.sezioni[1].id);
  assert.equal(r.sezioni[1].voci[0].esterno, true);
  assert.deepEqual(N.normalizza(null), { aggiornato: '', sezioni: [] });
  assert.deepEqual(N.normalizza({ sezioni: 'no' }).sezioni, []);
  assert.equal(N.normalizza({ aggiornato: '20/10/2026', sezioni: [] }).aggiornato, '', 'solo la data AAAA-MM-GG');
});

test('normalizza: tronca i testi lunghi e limita il numero di voci', () => {
  const lungo = 'x'.repeat(500);
  const r = N.normalizza({ sezioni: [{ titolo: lungo, voci: Array.from({ length: 400 }, () => ({ nome: lungo, numero: lungo })) }] });
  assert.equal(r.sezioni[0].titolo.length, 80);
  assert.equal(r.sezioni[0].voci.length, 300);
  assert.equal(r.sezioni[0].voci[0].nome.length, 120);
  assert.equal(r.sezioni[0].voci[0].numero.length, 30);
});

test('filtra: senza accenti né maiuscole, per nome, nota, numero e sezione', () => {
  const { sezioni } = N.normalizza(dati);
  assert.equal(N.conta(N.filtra(sezioni, '')), 3);
  assert.deepEqual(N.filtra(sezioni, 'CITTA')[0].voci.map((v) => v.nome), ['Anagrafe']);
  assert.deepEqual(N.filtra(sezioni, '600')[0].voci.map((v) => v.nome), ['Polizia locale']);
  assert.equal(N.conta(N.filtra(sezioni, 'sede')), 3, 'il titolo della sezione conta');
  assert.equal(N.conta(N.filtra(sezioni, 'anagrafe 121')), 1, 'tutte le parole devono comparire');
  assert.equal(N.conta(N.filtra(sezioni, 'anagrafe 999')), 0);
  assert.equal(N.conta(N.filtra(sezioni, '', sezioni[1].id)), 1);
  assert.equal(N.conta(N.filtra(sezioni, '', 'tutte')), 3);
});

test('carica: file assente o rotto = elenco vuoto, tranne in DEMO dove vale l\'esempio', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'numeri-'));
  const assente = path.join(dir, 'non-c-e.json');
  const rotto = path.join(dir, 'rotto.json');
  fs.writeFileSync(rotto, '{ non json');
  const vuoto = { aggiornato: '', sezioni: [] };
  assert.deepEqual(carica({ file: assente, esempio, demo: false }), vuoto, 'in produzione l\'esempio non compare mai');
  assert.deepEqual(carica({ file: rotto, esempio, demo: false }), vuoto);
  assert.ok(carica({ file: assente, esempio, demo: true }).sezioni.length >= 2);
  const locale = path.join(dir, 'locale.json');
  fs.writeFileSync(locale, JSON.stringify({ sezioni: [{ titolo: 'Mia sede', voci: [{ nome: 'Ufficio', numero: '7' }] }] }));
  assert.equal(carica({ file: locale, esempio, demo: true }).sezioni[0].titolo, 'Mia sede', 'il file locale vince sull\'esempio');
});

test('esempio nel repository: formato valido, numeri brevi inventati; il file vero è ignorato da git', () => {
  const grezzo = JSON.parse(fs.readFileSync(esempio, 'utf8'));
  const r = N.normalizza(grezzo);
  assert.equal(r.sezioni.length, grezzo.sezioni.length);
  for (const s of r.sezioni) for (const v of s.voci) assert.ok(/^\d{3,6}$/.test(v.numero), v.numero);
  assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), /^content\/numeri-interni\.json$/m);
});

test('API: serve il login e restituisce i dati ripuliti', async () => {
  let cookie = '';
  const rq = async (p) => {
    const r = await fetch(url + p, { redirect: 'manual', headers: { cookie } });
    const sc = r.headers.getSetCookie?.() || [];
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
    return r;
  };
  assert.equal((await rq('/api/numeri-interni')).status, 401);
  await rq('/auth/login');
  const r = await rq('/api/numeri-interni');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const j = await r.json();
  assert.ok(j.sezioni.length >= 2 && j.sezioni.every((s) => s.id && s.titolo && s.voci.length));
  const html = await (await rq('/')).text();
  assert.ok(html.indexOf('numeri-interni.js') > 0 && html.indexOf('numeri-interni.js') < html.indexOf('app.js'));
  for (const id of ['nu-box', 'nu-cerca', 'nu-chips', 'nu-elenco', 'nu-vuoto', 'nu-conta']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /id="nu-box"[^>]*hidden/, 'senza dati la sezione resta nascosta');
  assert.equal((await rq('/numeri-interni.js')).status, 200);
});

test('script CSV: sezioni, coppie di colonne, note, numeri per gli esterni, maiuscole', () => {
  const csv = [
    'SEDE UNO,,,,', 'ROSSI MARIO,101,,BIANCHI ANNA - CAPO,102', 'UFFICIO (LUN./MER.),103,,"CENTRALE ""ALFA""*",104', ',,,,',
    'ALTRA SEDE (NOTA),,,,', 'FAX P.M.,199,,Ufficio urp,198'
  ].join('\n');
  const r = daCsv(csv);
  assert.deepEqual(r.sezioni.map((s) => s.titolo), ['Sede uno', 'Altra sede']);
  const uno = Object.fromEntries(r.sezioni[0].voci.map((v) => [v.nome, v]));
  assert.equal(uno['Rossi Mario'].numero, '101');
  assert.equal(uno['Bianchi Anna'].nota, 'Capo');
  assert.equal(uno['Ufficio'].nota, 'Lun./Mer.');
  assert.equal(uno['Centrale "Alfa"'].esterno, true);
  assert.ok(r.sezioni[1].voci.some((v) => v.nome === 'Fax P.M.'));
  assert.deepEqual(r.sezioni[1].voci.map((v) => v.nome), ['Fax P.M.', 'Ufficio urp'].sort((a, b) => a.localeCompare(b, 'it')));
});
