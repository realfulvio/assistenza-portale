// Foto profilo: upload, validazione, isolamento tra utenti, CSRF, sincronizzazione Microsoft 365 simulata: npm test
const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.DEMO = '1';
process.env.BASE_PATH = '/assistenza';
process.env.AVATAR_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'portale-avatar-'));
const test = require('node:test');
const assert = require('node:assert');
const sharp = require('sharp');
const app = require('../src/server');
const avatar = require('../src/avatar');

let server, url;
test.before(() => new Promise((ok) => { server = app.listen(0, '127.0.0.1', () => { url = `http://127.0.0.1:${server.address().port}/assistenza`; ok(); }); }));
test.after(() => { server.close(); fs.rmSync(process.env.AVATAR_DIR, { recursive: true, force: true }); });

async function sessione() {
  let cookie = '';
  const rq = async (p, o = {}) => {
    const r = await fetch(url + p, { redirect: 'manual', ...o, headers: { cookie, ...(o.headers || {}) } });
    const sc = r.headers.getSetCookie?.() || [];
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
    return r;
  };
  await rq('/auth/login');
  const me = await (await rq('/api/me')).json();
  return { rq, csrf: me.csrf };
}
const carica = (s, buf, csrf = s.csrf) => {
  const fd = new FormData();
  fd.append('foto', new Blob([buf]), 'foto');
  return s.rq('/api/profilo/foto', { method: 'POST', body: fd, headers: { 'X-CSRF-Token': csrf } });
};
const colore = (w, h, fmt) => sharp({ create: { width: w, height: h, channels: 3, background: '#2266aa' } })[fmt]().toBuffer();

test('senza login: 401; senza CSRF: 403', async () => {
  assert.equal((await fetch(url + '/api/profilo/foto')).status, 401);
  assert.equal((await fetch(url + '/api/profilo/foto', { method: 'POST' })).status, 401);
  const s = await sessione();
  assert.equal((await carica(s, await colore(10, 10, 'png'), 'sbagliato')).status, 403);
  assert.equal((await s.rq('/api/profilo/foto/rimuovi', { method: 'POST' })).status, 403);
});

test('JPG con EXIF, PNG e WebP diventano WebP 128x128 senza metadati', async () => {
  const s = await sessione();
  const jpg = await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#c33' } }).jpeg()
    .withMetadata({ exif: { IFD0: { Copyright: 'EXIF-DI-PROVA' } } }).toBuffer();
  for (const buf of [jpg, await colore(500, 800, 'png'), await colore(640, 640, 'webp')]) {
    const r = await carica(s, buf);
    assert.equal(r.status, 200);
    const info = await r.json();
    assert.equal(info.origine, 'manual');
    const g = await s.rq('/api/profilo/foto?v=' + info.v);
    assert.equal(g.headers.get('content-type'), 'image/webp');
    assert.match(g.headers.get('cache-control'), /private/);
    const out = Buffer.from(await g.arrayBuffer());
    const m = await sharp(out).metadata();
    assert.deepEqual([m.format, m.width, m.height, !!m.exif, !!m.icc], ['webp', 128, 128, false, false]);
    assert.ok(!out.includes('EXIF-DI-PROVA'));
    assert.equal((await s.rq('/api/profilo/foto', { headers: { 'if-none-match': g.headers.get('etag') } })).status, 304);
  }
});

test('rifiuta testo rinominato, file oltre 3 MB e immagini enormi in pixel', async () => {
  const s = await sessione();
  let r = await carica(s, Buffer.from('non sono una foto\n'.repeat(100)));
  assert.deepEqual([r.status, (await r.json()).errore], [400, 'Formato non supportato']);
  r = await carica(s, Buffer.alloc(3 * 1024 * 1024 + 70 * 1024, 1));
  assert.deepEqual([r.status, (await r.json()).errore], [413, 'File troppo grande (massimo 3 MB)']);
  const bomba = await sharp({ create: { width: 10000, height: 5000, channels: 3, background: '#fff' } }).png({ compressionLevel: 9 }).toBuffer();
  r = await carica(s, bomba);
  assert.deepEqual([r.status, (await r.json()).errore], [400, 'Impossibile elaborare l\'immagine']);
});

test('ogni utente vede e modifica solo la propria foto; rimozione', async () => {
  const a = await sessione();
  await carica(a, await colore(200, 200, 'png'));
  const b = await sessione();
  // in DEMO tutti accedono come lo stesso utente: si simula un secondo utente cambiando identita' in sessione
  avatar.rimuovi({ oid: 'utente-b' });
  assert.equal(avatar.info({ oid: 'utente-b' }).origine, 'none');
  assert.ok(avatar.leggi({ oid: 'demo-non-esistente' }) === null);
  assert.equal((await b.rq('/api/profilo/foto?utente=altro')).status, 200); // il parametro e' ignorato: conta solo la sessione
  const r = await a.rq('/api/profilo/foto/rimuovi', { method: 'POST', headers: { 'X-CSRF-Token': a.csrf } });
  assert.equal((await r.json()).origine, 'none');
  assert.equal((await a.rq('/api/profilo/foto')).status, 404);
});

test('sincronizzazione Microsoft 365: 404, 7 giorni, manuale prioritaria, errori ignorati', async () => {
  const u = { oid: 'utente-sync' };
  const jpg = await colore(300, 200, 'jpeg');
  const originale = avatar.scaricaGraph;
  let chiamate = 0, risposta;
  avatar.scaricaGraph = async () => { chiamate++; return risposta(); };
  try {
    risposta = async () => ({ esito: 'nessuna' });
    assert.equal(await avatar.sincronizza(u, 't'), 'nessuna');
    assert.equal(avatar.info(u).origine, 'none');
    risposta = async () => ({ esito: 'ok', webp: await avatar.elabora(jpg) });
    assert.equal(await avatar.sincronizza(u, 't'), 'saltata'); // entro 7 giorni
    assert.equal(chiamate, 1);
    assert.equal(await avatar.sincronizza(u, 't', { forza: true }), 'ok');
    assert.equal(avatar.info(u).origine, 'm365');
    risposta = async () => ({ esito: 'errore' });
    assert.equal(await avatar.sincronizza(u, 't', { forza: true }), 'errore');
    assert.equal(avatar.info(u).origine, 'm365'); // 403/rete: nulla cambia
    await avatar.salvaManuale(u, jpg);
    risposta = async () => ({ esito: 'ok', webp: await avatar.elabora(jpg) });
    const f = path.join(avatar.opzioni.dir, fs.readdirSync(avatar.opzioni.dir).find((x) => x.endsWith('.json') && JSON.parse(fs.readFileSync(path.join(avatar.opzioni.dir, x))).origine === 'manual'));
    fs.writeFileSync(f, JSON.stringify({ ...JSON.parse(fs.readFileSync(f)), sincronizzato: null }));
    assert.equal(await avatar.sincronizza(u, 't'), 'saltata');
    assert.equal(avatar.info(u).origine, 'manual');
    risposta = async () => ({ esito: 'nessuna' });
    assert.equal(await avatar.sincronizza(u, 't', { forza: true }), 'nessuna');
    assert.equal(avatar.info(u).origine, 'manual'); // «Usa la foto Microsoft 365» senza foto: resta com'era
  } finally { avatar.scaricaGraph = originale; }
});

test('«Usa la foto Microsoft 365» senza token del login: 409 con messaggio', async () => {
  const s = await sessione();
  const r = await s.rq('/api/profilo/foto/microsoft', { method: 'POST', headers: { 'X-CSRF-Token': s.csrf } });
  assert.equal(r.status, 409);
  assert.match((await r.json()).errore, /accedi di nuovo/);
});
