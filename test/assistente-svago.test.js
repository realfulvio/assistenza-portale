const test = require('node:test');
const assert = require('node:assert/strict');
const { creaServizio } = require('../src/assistente');

function ambiente() {
  const servizio = creaServizio({config: {}, chiamaAI: async () => { throw new Error('Lo svago non usa AI'); }});
  const req = {sessionID: 'prova', session: {}, body: {}};
  return {servizio, req, invia: async testo => {req.body={testo};return servizio.gestisci(req);}};
}

for (const testo of ['Raccontami una barzelletta', 'Mi dici una freddura?', 'Fammi ridere', 'Una barzelletta', 'Un’altra freddura', 'mi racconti una barzeleta?', 'Mi diresti una fredura?', 'Mi fai ridere?']) {
  test(`richiesta di svago: ${testo}`, async () => {
    const out = await ambiente().invia(testo);
    assert.equal(out.tipo, 'svago');
    assert.ok(out.risposta.length > 15);
    assert.equal(out.opzioni.length, 2);
    assert.equal(out.fonti.length, 0);
    if (/freddura/.test(testo)) assert.equal(out.genere, 'freddura');
  });
}

test('nessuna ripetizione prima di esaurire le freddure, poi il ciclo riparte', async () => {
  const {catalogo} = require('../src/assistente-svago');
  const a=ambiente(), viste=new Set();
  const n=catalogo.filter(v=>v.tipo==='freddura').length;
  for(let i=0;i<n;i++) {
    const out=await a.invia(i ? 'Un’altra' : 'Una freddura');
    assert.equal(out.genere,'freddura');
    assert.ok(!viste.has(out.risposta));viste.add(out.risposta);
  }
  assert.ok(viste.has((await a.invia('Ancora')).risposta));
});

test('nuova conversazione cancella anche lo stato di svago', async () => {
  const a=ambiente();await a.invia('Una freddura');
  a.req.body={azione:'nuova'};await a.servizio.gestisci(a.req);
  assert.equal(a.req.session.assistente.svago,undefined);
});

test('una pausa non compila ne cancella una bozza di ticket', async () => {
  const a=ambiente();a.req.body={azione:'ticket'};await a.servizio.gestisci(a.req);
  const prima=structuredClone(a.req.session.assistente.bozza);
  assert.equal((await a.invia('Raccontami una barzelletta')).tipo,'svago');
  assert.deepEqual(a.req.session.assistente.bozza,prima);
});

test('non interpreta guasti, negazioni o la parola altra fuori dallo svago', () => {
  const {richiesta}=require('../src/assistente-svago');
  for(const q of ['La stampante è una barzelletta, non stampa','Non raccontarmi barzellette','Un’altra','Un altro numero interno','La password è una barzelletta','Vorrei aprire un ticket: questo PC è una barzelletta','La stampante è una barzelletta: hai una soluzione?']) assert.equal(richiesta(q,{}),null,q);
});

test('la parola barzelletta in una segnalazione non impedisce di preparare il ticket', async () => {
  const out=await ambiente().invia('Vorrei aprire un ticket: questo PC è una barzelletta');
  assert.equal(out.tipo,'bozza');
});

test('la raccolta contiene entrambi i generi senza duplicati', () => {
  const {catalogo}=require('../src/assistente-svago');
  assert.equal(new Set(catalogo.map(v=>v.testo)).size,catalogo.length);
  assert.ok(catalogo.filter(v=>v.tipo==='barzelletta').length>=40);
  assert.ok(catalogo.filter(v=>v.tipo==='freddura').length>=60);
});
