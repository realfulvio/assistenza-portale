const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { html } = require('../src/link-utili');
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
