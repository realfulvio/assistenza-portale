const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
process.env.DEMO = '1';
const { verificaHtml, verificaUrl } = require('../scripts/verifica-rilascio');
const template = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const html = template.replaceAll('__BASE__', '/assistenza').replaceAll('__V__', 'test').replaceAll('__VERSIONE__', '2.0.0').replaceAll('__DATA_VERSIONE__', '16 ottobre 2026').replaceAll('__APPEARANCE__', '').replace(/\{\{[\w.]+\}\}/g, 'Esempio');

test('rilascio: riconosce i CSS mancanti del porting che aveva rotto la v2', () => {
  assert.deepEqual(verificaHtml(html).errori, []);
  for (const name of ['theme.css', 'temi.css']) {
    const senza = html.split('\n').filter(line => !line.includes('/' + name + '?')).join('\n');
    assert.ok(verificaHtml(senza).errori.includes('Risorsa non collegata: ' + name));
    const commentato = html.replace(new RegExp('<link[^>]+/' + name.replace('.', '\\.') + '[^>]*>'), '<!-- $& -->');
    assert.ok(verificaHtml(commentato).errori.includes('Risorsa non collegata: ' + name));
  }
  assert.ok(verificaHtml(template).errori.some(e => e.includes('Segnaposto')));
});

test('rilascio: verifica HTML e risorse del server reale, senza autenticazione', async () => {
  const app = require('../src/server');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const result = await verificaUrl(`http://127.0.0.1:${server.address().port}/assistenza/`);
    assert.deepEqual(result.errori, []);
    assert.equal(result.assets.length, 15);
  } finally { server.close(); }
});

test('rilascio: HTTP 200 con HTML al posto del CSS non è un successo', async () => {
  const http = require('http');
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const result = await verificaUrl(`http://127.0.0.1:${server.address().port}/assistenza/`);
    assert.ok(result.errori.some(e => e.includes('theme.css: Content-Type errato')));
  } finally { server.close(); }
});
