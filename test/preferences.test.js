const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.DEMO = '1';
process.env.BASE_PATH = '/assistenza';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'portale-preferences-test-'));
process.env.PREFERENCES_DIR = directory;
process.env.AVATAR_DIR = path.join(directory, 'avatars');
const app = require('../src/server');
const store = require('../src/preferences');
const model = require('../public/appearance-model');
const userA = { oid: 'test-a', tenant: 'tenant-a' }, userB = { oid: 'test-b', tenant: 'tenant-a' };
let server, url;
test.before(() => new Promise(resolve => { server = app.listen(0, '127.0.0.1', () => { url = `http://127.0.0.1:${server.address().port}/assistenza`; resolve(); }); }));
test.after(() => { server.close(); fs.rmSync(directory, { recursive: true, force: true }); });
test('archivio: isolamento identita e tenant, persistenza e ripristino', () => {
  const chosen = { ...model.defaults(), theme: 'dark', text: 150, icon: 150, roomy: true };
  store.write(userA, chosen);
  assert.deepEqual(store.read(userA).preferences, chosen);
  assert.deepEqual(store.read(userB).preferences, model.defaults());
  assert.notEqual(store.key(userA), store.key({ ...userA, tenant: 'tenant-b' }));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, store.key(userA) + '.json'))), chosen);
  store.write(userA, model.defaults());
  assert.deepEqual(store.read(userA).preferences, model.defaults());
});
test('tema tolto dal selettore: le preferenze salvate ricadono sul Classico', () => {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, store.key(userB) + '.json'), JSON.stringify({ ...model.defaults(), theme: 'cyber', text: 120 }));
  assert.deepEqual(store.read(userB), { preferences: { ...model.defaults(), text: 120 }, available: true });
});
test('corruzione o archivio non disponibile: fallback senza bloccare il portale', () => {
  fs.writeFileSync(path.join(directory, store.key(userB) + '.json'), '{');
  assert.deepEqual(store.read(userB), { preferences: model.defaults(), available: false });
});
test('API: login, CSRF, valori ammessi, HTML iniziale, nuova sessione e logout', async () => {
  let cookie = '';
  async function request(route, options = {}) {
    const response = await fetch(url + route, { ...options, redirect: 'manual', headers: { cookie, ...options.headers } });
    const cookies = response.headers.getSetCookie(); if (cookies.length) cookie = cookies.map(c => c.split(';')[0]).join('; ');
    return response;
  }
  assert.equal((await request('/api/preferenze')).status, 401);
  await request('/auth/login');
  let me = await (await request('/api/me')).json();
  const chosen = { theme: 'spazio', text: 150, icon: 80, roomy: true, motion: false };
  const put = (body, csrf = me.csrf) => request('/api/preferenze', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(body) });
  assert.equal((await put(chosen, '')).status, 403);
  for (const patch of [{ theme: 'unknown' }, { text: 99 }, { text: 151 }, { text: 115 }, { text: '150' }, { icon: 79 }, { icon: 151 }, { roomy: 'true' }, { motion: 'yes' }, { oid: 'other' }, { userId: 'other' }]) {
    assert.equal((await put({ ...chosen, ...patch })).status, 400, JSON.stringify(patch));
  }
  for (const [theme] of model.themes) assert.equal((await put({ ...chosen, theme })).status, 200);
  assert.equal((await put(chosen)).status, 200);
  const initial = await request('/');
  assert.equal(initial.headers.get('cache-control'), 'no-store');
  const html = await initial.text();
  assert.match(html, /data-theme="spazio" data-text="150" data-icon="80" data-roomy="true" data-size="m" data-density="a" data-motion="full"/);
  assert.doesNotMatch(html, /__APPEARANCE__/);
  cookie = ''; // altro browser, stesso account
  await request('/auth/login'); me = await (await request('/api/me')).json();
  assert.deepEqual((await (await request("/api/preferenze")).json()).preferences, model.validate(chosen));
  // Errore reale del filesystem: il percorso e' temporaneamente un file.
  // Opera esclusivamente nella directory effimera creata da questo test.
  const backup = directory + '-saved';
  fs.renameSync(directory, backup);
  try {
    fs.writeFileSync(directory, 'archivio non scrivibile');
    assert.equal((await put(chosen)).status, 503);
    assert.equal((await request('/api/me')).status, 200);
    assert.equal((await (await request('/api/preferenze')).json()).available, false);
  } finally { fs.unlinkSync(directory); fs.renameSync(backup, directory); }
  await request('/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': me.csrf } });
  assert.equal((await request('/api/preferenze')).status, 401);
  assert.match(await (await request('/')).text(), /data-theme="classic" data-text="100"/);
});
