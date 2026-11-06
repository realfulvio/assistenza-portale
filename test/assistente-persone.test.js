const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { creaServizio } = require('../src/assistente');

// Domande su un collega: risposta dal sito del Comune e dalla rubrica, mai proposta di ricerca web.
const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'persone-')), 'sito.json');
fs.writeFileSync(file, JSON.stringify({ modello: 'x', pagine: [
  { url: 'https://c.it/persona_pubblica/mario-rossi/', tipo: 'persona_pubblica', titolo: 'Mario Rossi', pezzi: [
    { id: 'p0', testo: 'Persona: Mario Rossi\n## Incarico\nResponsabile dell’ufficio Esempio\n## Contatti\n##\nTelefono: 0532 000001', vettore: [1, 0] } ] },
] }));

function servizio(chiamaAI = async () => { throw new Error('Il modello AI non deve servire'); }) {
  return creaServizio({
    config: { base: '/assistenza', assistenteSitoFile: file },
    numeriInterni: { carica: () => ({ sezioni: [{ titolo: 'Sede di esempio', voci: [
      { nome: 'Rossi Mario', numero: '241' },
      { nome: 'Ufficio esempio', numero: '230' }
    ] }] }) },
    chiamaAI,
    ricercaWeb: { attiva: true, cerca: async () => { throw new Error('La ricerca web non deve partire'); } }
  });
}

for (const testo of ['cosa fa mario rossi', 'chi è Mario Rossi?', 'di cosa si occupa rossi', 'in che ufficio lavora mario rossi']) {
  test(`persona dal sito con interno della rubrica: ${testo}`, async () => {
    const out = await servizio().gestisci({ sessionID: 'prova', session: {}, body: { testo } });
    assert.equal(out.sito, true);
    assert.match(out.risposta, /Responsabile dell’ufficio Esempio/);
    assert.match(out.risposta, /0532 000001/);
    assert.deepEqual(out.contatti.map((v) => v.numero), ['241']);
  });
}

test('solo nome e cognome: resta la rubrica', async () => {
  const out = await servizio().gestisci({ sessionID: 'prova', session: {}, body: { testo: 'mario rossi' } });
  assert.equal(out.tipo, 'contatti');
  assert.deepEqual(out.contatti.map((v) => v.numero), ['241']);
});

test('nome di un collega: mai proposta di ricerca web, anche se il modello sceglie «web»', async () => {
  let instradata = false;
  const chiamaAI = async (endpoint, body) => {
    if (endpoint === '/api/chat' && body.format) { instradata = true; return { message: { content: '{"azione":"web","ricerca":"mario rossi ferie"}' } }; }
    throw new Error('fine prova');
  };
  const out = await servizio(chiamaAI).gestisci({ sessionID: 'prova', session: {}, body: { testo: 'quando torna mario rossi dalle ferie?' } }).catch(() => ({}));
  assert.equal(instradata, true);
  assert.notEqual(out.tipo, 'web-proposta');
});
