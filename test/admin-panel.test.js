// Voce «Admin panel»: l'indirizzo arriva solo agli amministratori configurati
process.env.DEMO = '1';
process.env.BASE_PATH = '/assistenza';
process.env.ADMIN_EMAILS = ' Maria.Bianchi@esempio.it , altro@esempio.it';
process.env.ADMIN_PANEL_URL = 'https://glpi.esempio.it/sso';
const test = require('node:test');
const assert = require('node:assert');
const config = require('../src/config');
const app = require('../src/server');

let server, url;
test.before(() => new Promise((ok) => { server = app.listen(0, '127.0.0.1', () => { url = `http://127.0.0.1:${server.address().port}/assistenza`; ok(); }); }));
test.after(() => server.close());

async function me() {
  let cookie = '';
  const rq = async (p) => { const r = await fetch(url + p, { redirect: 'manual', headers: { cookie } }); const sc = r.headers.getSetCookie?.() || []; if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; '); return r; };
  await rq('/auth/login');
  return (await rq('/api/me')).json();
}

test('amministratore in elenco: riceve l\'indirizzo', async () => {
  assert.equal((await me()).adminUrl, 'https://glpi.esempio.it/sso');
});

test('utente non in elenco o indirizzo non https: nessuna voce', async () => {
  const prima = [config.admin.emails, config.admin.url];
  config.admin.emails = ['altro@esempio.it'];
  assert.equal((await me()).adminUrl, null);
  config.admin.emails = prima[0]; config.admin.url = '';
  assert.equal((await me()).adminUrl, null);
  config.admin.url = prima[1];
});
