// Indirizzo di ritorno dell'accesso gia' registrato in Entra diverso da <base>/auth/callback (migrazione): npm test
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.DEMO = '1'; process.env.BASE_PATH = '/assistenza';
process.env.OIDC_REDIRECT_URI = 'https://portale.esempio.it/assistenza/accesso/ritorno';
const app = require('../src/server');

test('accesso: il ritorno risponde anche sul percorso registrato, con gli stessi controlli dello stato', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/assistenza`;
  try {
    for (const p of ['/accesso/ritorno?code=x&state=y', '/auth/callback?code=x&state=y']) {
      const r = await fetch(base + p, { redirect: 'manual' });
      assert.equal(r.status, 302, p);
      assert.equal(r.headers.get('location'), '/assistenza/errore?c=accesso', p); // nessuno stato in sessione: accesso rifiutato
    }
    assert.equal((await fetch(base + '/accesso/altro', { redirect: 'manual' })).status, 404);
  } finally { server.close(); }
});
