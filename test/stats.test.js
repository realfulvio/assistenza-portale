// Barra «Live»: calcolo dei contatori ed endpoint /api/stats in modalita' DEMO (GLPI finto): npm test
process.env.DEMO = '1';
process.env.BASE_PATH = '/assistenza';
const test = require('node:test');
const assert = require('node:assert');
const app = require('../src/server');
const glpi = require('../src/glpi-client');
const stats = require('../src/stats');

let server, url;
test.before(() => new Promise((ok) => { server = app.listen(0, '127.0.0.1', () => { url = `http://127.0.0.1:${server.address().port}/assistenza`; ok(); }); }));
test.after(() => server.close());

async function sessione() {
  let cookie = '';
  const rq = async (p) => {
    const r = await fetch(url + p, { redirect: 'manual', headers: { cookie } });
    const sc = r.headers.getSetCookie?.() || [];
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
    return r;
  };
  await rq('/auth/login');
  return rq;
}

test('calcolo: periodo, risolte, percentuale, sparkline, oggi, presa in carico', () => {
  const ora = new Date(2026, 9, 16, 12, 0, 0);
  const righe = [
    { data: '2025-12-31 10:00:00', stato: 6, presa: 999 }, // anno precedente: solo fuori periodo
    { data: '2026-03-02 09:00:00', stato: 6, presa: 600 },
    { data: '2026-10-10 09:00:00', stato: 2, presa: 0 },
    { data: '2026-10-15 09:00:00', stato: 5, presa: 1200 },
    { data: '2026-10-16 08:00:00', stato: 6, presa: 1800 },
    { data: '2026-10-16 09:00:00', stato: 1, presa: 0 }
  ];
  const o = { periodo: 'anno', daData: '' };
  const d = stats.calcola(o, { righe, inLavorazione: 7, ultimaSoluzione: '2026-10-16 11:15:00' }, ora);
  assert.equal(d.ok, true);
  assert.equal(d.periodo.etichetta, 'nel 2026');
  assert.equal(d.ricevute, 5);
  assert.equal(d.risolte, 3);
  assert.equal(d.percentuale_risolte, 60);
  assert.equal(d.in_lavorazione, 7);
  assert.equal(d.presa_in_carico_media_sec, 1200);
  assert.deepEqual(d.sparkline, [1, 0, 0, 0, 0, 1, 2]);
  assert.equal(d.oggi_ricevute, 2);
  assert.equal(d.oggi_risolte, 1);
  assert.equal(d.ultima_risolta_min, 45);
  const g = stats.calcola({ periodo: 'giorni', giorni: 30 }, { righe, inLavorazione: 0, ultimaSoluzione: null }, ora);
  assert.equal(g.periodo.etichetta, 'negli ultimi 30 giorni');
  assert.equal(g.ricevute, 4); // dal 17/09 compreso
  assert.equal(stats.calcola({ periodo: 'mese' }, { righe, inLavorazione: 0, ultimaSoluzione: null }, ora).ricevute, 4);
  assert.equal(stats.calcola({ periodo: 'da_data', daData: '2026-10-15' }, { righe, inLavorazione: 0, ultimaSoluzione: null }, ora).periodo.etichetta, 'dal 15/10/2026');
  const vuoto = stats.calcola(o, { righe: [], inLavorazione: 0, ultimaSoluzione: null }, ora);
  assert.equal(vuoto.percentuale_risolte, 0);
  assert.equal(vuoto.ultima_risolta_min, null);
  assert.equal(vuoto.presa_in_carico_media_sec, null);
});

test('endpoint: login obbligatorio, solo numeri, seconda chiamata dalla cache', async () => {
  assert.equal((await fetch(url + '/api/stats')).status, 401);
  stats.svuotaCache();
  const rq = await sessione();
  const r1 = await rq('/api/stats');
  const d = await r1.json();
  assert.equal(r1.status, 200);
  assert.equal(r1.headers.get('x-cache'), 'MISS');
  assert.equal(d.ok, true);
  for (const k of ['ricevute', 'risolte', 'in_lavorazione', 'percentuale_risolte', 'oggi_ricevute', 'oggi_risolte']) assert.equal(typeof d[k], 'number', k);
  assert.equal(d.sparkline.length, 7);
  assert.ok(!Number.isNaN(Date.parse(d.aggiornato_il)));
  assert.doesNotMatch(JSON.stringify(d), /@|titolo|nome/i);
  const r2 = await rq('/api/stats');
  assert.equal(r2.headers.get('x-cache'), 'HIT');
  assert.deepEqual(await r2.json(), d);
});

test('endpoint: GLPI in errore -> 200 con ok:false', async () => {
  stats.svuotaCache();
  const originale = glpi.statsSorgente;
  glpi.statsSorgente = async () => { throw new Error('GLPI non raggiungibile'); };
  try {
    const r = await (await sessione())('/api/stats');
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: false });
  } finally { glpi.statsSorgente = originale; stats.svuotaCache(); }
});

test('pagina: barra presente sotto il menu con CSS e JS dedicati', async () => {
  const html = await (await (await sessione())('/')).text();
  assert.match(html, /<\/nav>\s*<div class="live" id="live"[^>]*aria-label=/);
  assert.match(html, /stats-bar\.css\?v=/);
  assert.match(html, /stats-bar\.js\?v=/);
  assert.match(html, /aria-live="polite"/);
});
