const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { html } = require('../src/link-utili');
test('immagini locali e schede in fondo rispettano il percorso base senza accettare URL esterni', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'link-test-'));
  fs.mkdirSync(path.join(dir, 'config'));
  const file = path.join(dir, 'config/link-utili.example.json');
  const dati = [{ nome: 'Alfa', url: 'https://example.org', immagine: 'img/link-utili/icona.png', inFondo: true }, { nome: 'Zeta', url: 'https://example.org' }];
  try {
    fs.writeFileSync(file, JSON.stringify(dati));
    const out = html(dir, '/help');
    assert.ok(out.indexOf('<strong>Zeta') < out.indexOf('<strong>Alfa'));
    assert.match(out, /src="\/help\/img\/link-utili\/icona.png"/);
    for (const immagine of ['https://example.org/a.png', '//example.org/a.png', 'img/../a.png', 'img/a.png" onerror="alert(1)', null]) {
      dati[0].immagine = immagine;
      fs.writeFileSync(file, JSON.stringify(dati));
      assert.throws(() => html(dir));
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('link configurabili: escape HTML, protocolli e credenziali', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'link-test-'));
  fs.mkdirSync(path.join(dir, 'config'));
  const file = path.join(dir, 'config/link-utili.example.json');
  const scrivi = url => fs.writeFileSync(file, JSON.stringify([{ nome: '<script>', descrizione: '"prova"', url }]));
  try {
    scrivi('https://example.org/?a=1&b=2');
    assert.match(html(dir), /&lt;script&gt;/);
    assert.match(html(dir), /a=1&amp;b=2/);
    for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'https://utente:password@example.org']) {
      scrivi(url); assert.throws(() => html(dir));
    }
    fs.writeFileSync(path.join(dir, 'config/link-utili.json'), '[]');
    assert.equal(html(dir), '');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('icone locali, ordine alfabetico e risorse accessibili senza un URL principale', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'link-test-'));
  fs.mkdirSync(path.join(dir, 'config'));
  const file = path.join(dir, 'config/link-utili.example.json');
  try {
    const dati = [
      { nome: 'Zeta', descrizione: 'Accesso remoto', icona: '<script>', risorse: [{ nome: '<Tutorial>', url: 'https://example.org/?a=1&b=2' }] },
      { nome: 'Alfa', icona: 'calendario', url: 'https://example.org/calendario' }
    ];
    fs.writeFileSync(file, JSON.stringify(dati));
    const out = html(dir);
    assert.ok(out.indexOf('<strong>Alfa') < out.indexOf('<strong>Zeta'));
    assert.equal((out.match(/<svg /g) || []).length, 2);
    assert.match(out, /<button[^>]+aria-expanded="false" aria-controls="link-risorse-1"/);
    assert.match(out, /class="resources-drawer" id="link-risorse-1"/);
    assert.match(out, /&lt;Tutorial&gt;/);
    assert.match(out, /a=1&amp;b=2/);
    assert.ok(!out.includes('<script>'));
    for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'https://utente:password@example.org']) {
      dati[0].risorse[0].url = url;
      fs.writeFileSync(file, JSON.stringify(dati));
      assert.throws(() => html(dir));
    }
    fs.writeFileSync(file, JSON.stringify([{ nome: 'Vuoto' }]));
    assert.throws(() => html(dir));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
