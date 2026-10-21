const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
process.env.DEMO = '1';
const { componi } = require('../src/ticket-dettaglio');
const pdf = require('../src/pdf');
const poppler = spawnSync('pdftotext', ['-v']).status === 0;
test('PDF: una risposta molto lunga continua senza sovrapporsi al piè di pagina né perdere il messaggio successivo', { skip: !poppler && 'pdftotext non installato' }, async () => {
  const parole = (prefix, n) => Array.from({ length: n }, (_, i) => prefix + String(i).padStart(3, '0')).join(' ');
  const descrizione = parole('descrizione', 400) + ' FINEDESCRIZIONE';
  const messaggio = parole('messaggio', 600) + ' FINEMESSAGGIO';
  const d = componi({ ticket: { id: 1, status: 2, name: 'Prova di impaginazione', content: descrizione, date: '2026-10-16 10:00:00' }, ticketUsers: [{ type: 1, users_id: 9 }], users: { 9: { nome: 'Utente Prova' } }, followups: [
    { users_id: 9, is_private: 0, date: '2026-10-16 11:00:00', content: messaggio },
    { users_id: 9, is_private: 0, date: '2026-10-16 12:00:00', content: 'MESSAGGIOSUCCESSIVO' }
  ] }, 9);
  const buffer = await pdf.genera(d, 'Collaudatore');
  const result = spawnSync('pdftotext', ['-bbox', '-', '-'], { input: buffer, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  const words = [...result.stdout.matchAll(/<word\b[^>]*yMax="([\d.]+)"[^>]*>([^<]*)<\/word>/g)].map(m => ({ bottom: Number(m[1]), text: m[2] }));
  const testo = words.map(w => w.text).join(' ');
  for (const marker of ['FINEDESCRIZIONE', 'FINEMESSAGGIO', 'MESSAGGIOSUCCESSIVO']) assert.ok(testo.includes(marker), marker);
  for (let i = 0; i < 600; i++) assert.ok(testo.includes('messaggio' + String(i).padStart(3, '0')), 'Parola persa: ' + i);
  for (const word of words.filter(w => /^(descrizione|messaggio)\d|FINE|MESSAGGIOSUCCESSIVO/.test(w.text))) assert.ok(word.bottom < 785, 'Testo nel piè di pagina: ' + JSON.stringify(word));
  assert.ok((result.stdout.match(/<page\b/g) || []).length >= 4);
});
