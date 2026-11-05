const test = require('node:test');
const assert = require('node:assert/strict');
const { creaServizio } = require('../src/assistente');

function servizio() {
  return creaServizio({
    config: { base: '/assistenza' },
    numeriInterni: { carica: () => ({ sezioni: [{ titolo: 'Sede di esempio', voci: [
      { nome: 'Ufficio esempio', numero: '230', nota: 'Anna Verdi' },
      { nome: 'Altro ufficio', numero: '1230' },
      { nome: 'Segreteria esempio', numero: '237' },
      { nome: 'Sportello condiviso', numero: '230' }
    ] }] }) },
    chiamaAI: async () => { throw new Error('La rubrica non richiede il modello AI'); }
  });
}

for (const domanda of ['di chi è questo numero interno 230', 'di chi è l’interno 230?', 'interno 230', 'a chi corrisponde il 230?', 'il 230 di chi è?', '230']) {
  test(`ricerca inversa: ${domanda}`, async () => {
    const out = await servizio().gestisci({ sessionID: 'prova', session: {}, body: { testo: domanda } });
    assert.equal(out.tipo, 'contatti');
    assert.deepEqual(out.contatti.map(v => v.nome), ['Ufficio esempio', 'Sportello condiviso']);
    assert.match(out.risposta, /230/);
    assert.match(out.risposta, /Ufficio esempio/);
    assert.match(out.risposta, /Anna Verdi/);
  });
}

test('riconosce anche la prima domanda dello screenshot', async () => {
  const out = await servizio().gestisci({ sessionID: 'prova', session: {}, body: { testo: 'che interno è 237' } });
  assert.deepEqual(out.contatti.map(v => v.nome), ['Segreteria esempio']);
});

test('interno assente: nessuna corrispondenza parziale o inventata', async () => {
  const out = await servizio().gestisci({ sessionID: 'prova', session: {}, body: { testo: 'interno 999' } });
  assert.equal(out.tipo, 'contatti');
  assert.deepEqual(out.contatti, []);
  assert.match(out.risposta, /999/);
});

test('resta disponibile la ricerca per nome', async () => {
  const out = await servizio().gestisci({ sessionID: 'prova', session: {}, body: { testo: 'numero di Anna Verdi' } });
  assert.deepEqual(out.contatti.map(v => v.nome), ['Ufficio esempio']);
});

test('contatti in linguaggio naturale, senza inoltrare a Qwen', async () => {
  for (const testo of ['Mi dici il recapito di Anna Verdi?', 'nr. Anna Verdi']) {
    const out = await servizio().gestisci({sessionID:'prova',session:{},body:{testo}});
    assert.equal(out.tipo,'contatti');
    assert.equal(out.contatti[0]?.nome,'Ufficio esempio');
  }
});

test('solo nome della persona o nome con refuso: risponde la rubrica', async () => {
  const s = creaServizio({
    config: { base: '/assistenza' },
    numeriInterni: { carica: () => ({ sezioni: [{ titolo: 'Sede di esempio', voci: [
      { nome: 'Mario Rossi', numero: '241' },
      { nome: 'Ufficio esempio', numero: '230' }
    ] }] }) },
    chiamaAI: async () => { throw new Error('La rubrica non richiede il modello AI'); }
  });
  for (const testo of ['mario', 'Mario Rossi', 'teleono mario', 'numero di mario']) {
    const out = await s.gestisci({ sessionID: 'prova', session: {}, body: { testo } });
    assert.equal(out.tipo, 'contatti', testo);
    assert.deepEqual(out.contatti.map(v => v.nome), ['Mario Rossi'], testo);
  }
});
