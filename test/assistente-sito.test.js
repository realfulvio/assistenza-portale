const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { creaSito, sezioneOrari, periodoScaduto } = require('../src/assistente-sito');
const { estrai } = require('../scripts/scarica-sito-comune');

const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sito-')), 'sito.json');
fs.writeFileSync(file, JSON.stringify({ modello: 'x', pagine: [
  { url: 'https://c.it/uo/anagrafe/', tipo: 'unita_organizzativa', lastmod: '2026-01-10T10:00:00', titolo: 'Anagrafe', pezzi: [
    { id: 'a0', testo: 'Ufficio: Anagrafe\n## Orari\nOrari in vigore da gennaio a marzo 2026\n- lunedì 8.30-12\n- mercoledì chiuso', vettore: [1, 0] },
  ] },
  { url: 'https://c.it/novita/b/', tipo: 'notizia', lastmod: '2026-11-04T10:00:00', titolo: 'Notizia B', pezzi: [{ id: 'b0', testo: 'Notizia: B', vettore: [0, 1] }] },
  { url: 'https://c.it/novita/a/', tipo: 'notizia', lastmod: '2026-10-01T10:00:00', titolo: 'Notizia A', pezzi: [{ id: 'c0', testo: 'Notizia: A', vettore: [0, 1] }] },
] }));

test('orari copiati dalla pagina con avviso di periodo concluso', async () => {
  const sito = creaSito({ config: {}, file, ai: async () => { throw new Error('qwen non deve servire'); }, embed: async () => [[1, 0]] });
  const out = await sito.rispondi('che orari ha l anagrafe?');
  assert.match(out.risposta, /lunedì 8\.30-12/);
  assert.match(out.risposta, /mercoledì chiuso/);
  assert.match(out.risposta, /periodo già concluso/);
  assert.equal(out.fonti[0].url, 'https://c.it/uo/anagrafe/');
  assert.equal(out.sito, true);
});

test('novità in ordine di data', () => {
  const sito = creaSito({ config: {}, file, ai: async () => ({}), embed: async () => [[0, 1]] });
  const out = sito.novita();
  assert.ok(out.risposta.indexOf('Notizia B') < out.risposta.indexOf('Notizia A'));
  assert.match(out.risposta, /4 novembre 2026/);
});

test('instradamento: azione sconosciuta o JSON rotto -> null', async () => {
  const s1 = creaSito({ config: {}, file, ai: async () => ({ message: { content: '{"azione":"boh","ricerca":"x"}' } }), embed: async () => [[1, 0]] });
  assert.equal(await s1.instrada('ciao'), null);
  const s2 = creaSito({ config: {}, file, ai: async () => ({ message: { content: 'non json' } }), embed: async () => [[1, 0]] });
  assert.equal(await s2.instrada('ciao'), null);
  const s3 = creaSito({ config: {}, file, ai: async () => ({ message: { content: '{"azione":"novita","ricerca":"notizie"}' } }), embed: async () => [[1, 0]] });
  assert.deepEqual(await s3.instrada('novità?'), { azione: 'novita', ricerca: 'notizie' });
});

test('senza file il sito è spento', () => {
  const sito = creaSito({ config: {}, file: '', ai: async () => ({}), embed: async () => [] });
  assert.equal(sito.attivo(), false);
});

test('helper orari e estrazione HTML', () => {
  assert.equal(periodoScaduto('in vigore da gennaio a marzo 2026', new Date('2026-11-05')), true);
  assert.equal(periodoScaduto('in vigore da novembre a dicembre 2026', new Date('2026-11-05')), false);
  assert.deepEqual(sezioneOrari('## Orari\n- martedì 9-12\n## Contatti\n- tel'), ['Orari', '- martedì 9-12']);
  const e = estrai('<html><h1>Cerca</h1><main><h1>Tributi</h1><p>IMU &amp; TARI</p><h2>Contatta il comune</h2><p>footer</p></main></html>');
  assert.equal(e.titolo, 'Tributi');
  assert.match(e.testo, /IMU & TARI/);
  assert.doesNotMatch(e.testo, /footer/);
});

const filePersone = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sito-')), 'sito.json');
fs.writeFileSync(filePersone, JSON.stringify({ modello: 'x', pagine: [
  { url: 'https://c.it/persona_pubblica/mario-rossi/', tipo: 'persona_pubblica', titolo: 'Mario Rossi', pezzi: [
    { id: 'p0', testo: 'Persona: Mario Rossi\n## Mario Rossi\nResponsabile ufficio esempio\n## Incarico\nResponsabile dell’ufficio Esempio – Parte economica\n## Organizzazione\n##\nEsempio - Parte economica\nUfficio\n## Contatti\n##\nMario Rossi\nTelefono: 0532 000001\nEmail:\nrossi.mario@example.it', vettore: [1, 0] } ] },
  { url: 'https://c.it/persona_pubblica/anna-rossi/', tipo: 'persona_pubblica', titolo: 'Anna Rossi', pezzi: [
    { id: 'p1', testo: 'Persona: Anna Rossi\n## Incarico\nPersonale dell’ufficio Tributi\n## Contatti\n##\nTelefono: 0532 000002', vettore: [1, 0] } ] },
] }));

test('persone: scheda copiata dal sito, senza modello', async () => {
  const sito = creaSito({ config: {}, file: filePersone, ai: async () => { throw new Error('qwen non deve servire'); }, embed: async () => [[1, 0]] });
  const out = sito.rispondiPersona('mario rossi');
  assert.match(out.risposta, /Incarico: Responsabile dell’ufficio Esempio – Parte economica/);
  assert.doesNotMatch(out.risposta, /^Ufficio:/m);
  assert.match(out.risposta, /Telefono: 0532 000001/);
  assert.match(out.risposta, /Email: rossi\.mario@example\.it/);
  assert.deepEqual(out.persone, ['Mario Rossi']);
  assert.equal(sito.rispondiPersona('rossi'), null);
  assert.deepEqual(sito.rispondiPersona('rossi', { parziale: true }).persone, ['Mario Rossi', 'Anna Rossi']);
  assert.equal(sito.persone('il signor bianchi').length, 0);
});
