const test = require('node:test');
const assert = require('node:assert/strict');
const { creaMeteo: creaBase, richiesta: richiestaBase } = require('../src/meteo');
const creaMeteo = opzioni => creaBase({attivo:true,localita:'Esempiopoli',latitudine:0,longitudine:0,...opzioni});
const richiesta = (q, s) => richiestaBase(q, s, 'Esempiopoli');
const dati = () => ({current:{time:'2026-11-03T10:00',temperature_2m:14.4,weather_code:3,is_day:1},daily:{time:['2026-11-03','2026-11-04','2026-11-05'],weather_code:[3,61,0],temperature_2m_min:[8,9,6],temperature_2m_max:[16,15,17],precipitation_probability_max:[20,85,0]}});
test('battute locali solo alle soglie di freddo e caldo, mai senza dati',async()=>{
  for(const [t,attesa] of [[8,'Che freddo'],[8.1,''],[29.9,''],[30,'Che caldo']]) {
    const d=dati();d.current.temperature_2m=t;
    const m=creaMeteo({battutaFreddo:'Che freddo',battutaCaldo:'Che caldo',scarica:async()=>({ok:true,json:async()=>d})});
    const out=await m.rispondi();assert.equal(out.meteo.battuta,attesa);
    if(attesa) assert.ok(out.risposta.includes(attesa));
  }
});
test('riconosce meteo colloquiale senza catturare problemi informatici', () => {
  for(const q of ['che tempo fa a esempiopoli','Meteo','Oggi piove?','Domani serve l’ombrello?','Quanti gradi ci sono?','Le previsioni per Esempiopoli']) assert.ok(richiesta(q),q);
  for(const q of ['Quanto tempo ci vuole per aprire Outlook?','Il PC è lento','La mail contiene la parola meteo','Non funziona il sito del meteo']) assert.equal(richiesta(q),null,q);
  assert.equal(richiesta('Domani piove a Esempiopoli?').giorno,1);
  assert.equal(richiesta('Che tempo fa a Roma?').luogo,'roma');
  assert.equal(richiesta('Che tempo fa a Roma domani?').luogo,'roma');
  assert.equal(richiesta('Domani che tempo fa a Ferrara?').luogo,'ferrara');
  assert.equal(richiesta('Qual è la probabilità di pioggia a Esempiopoli?').luogo,'esempiopoli');
  assert.equal(richiesta('Raccontami una barzelletta sul meteo'),null);
  assert.ok(richiesta('Che tempo c’è a Esempiopoli?'));
  assert.ok(richiesta('Come sarà il tempo domani?'));
  assert.equal(richiesta('E domani?'),null);
  assert.equal(richiesta('E domani?',{ultimoTipo:'meteo'}).giorno,1);
});
test('condivide cache e richiesta in corso, distingue oggi e domani', async () => {
  let chiamate=0, ora=0;
  const m=creaMeteo({orologio:()=>ora,scarica:async()=>{chiamate++;return {ok:true,json:async()=>dati()};}});
  const [a,b]=await Promise.all([m.rispondi(richiesta('meteo')),m.rispondi(richiesta('domani piove?'))]);
  assert.equal(chiamate,1); assert.match(a.risposta,/14/);assert.match(b.risposta,/85%/);
  assert.equal(a.meteo.icona,'☁️');assert.equal(b.meteo.icona,'🌧️');
  ora=16*60_000; await m.leggi(); assert.equal(chiamate,2);
});
test('guasto del fornitore: nessun dato inventato, niente raffica di tentativi',async()=>{
  let chiamate=0;
  const m=creaMeteo({scarica:async()=>{chiamate++;throw Error('offline');}});
  const a=await m.rispondi(richiesta('meteo')); const b=await m.rispondi(richiesta('meteo'));
  assert.equal(a.meteo,undefined);assert.match(b.risposta,/non riesco/i);assert.equal(chiamate,1);
});
test('rifiuta dati incompleti o non numerici',async()=>{
  const d=dati();d.current.temperature_2m=null;
  const m=creaMeteo({scarica:async()=>({ok:true,json:async()=>d})});
  await assert.rejects(m.leggi());
});
test('giorni non coperti: chiarimento senza interrogare il fornitore',async()=>{
  const m=creaMeteo({scarica:async()=>{throw Error('Non deve chiamare il fornitore');}});
  assert.match((await m.rispondi(richiesta('Meteo settimana prossima'))).risposta,/oggi.*domani/i);
});
test('la domanda sul tempo passa dal servizio meteo prima delle guide e del modello',async()=>{
  const {creaServizio}=require('../src/assistente');
  const servizio=creaServizio({config:{},meteo:{rispondi:async()=>({tipo:'meteo',risposta:'☀️ Esempiopoli: 14 °C',fonti:[]})},chiamaAI:async()=>{throw Error('Il meteo non deve usare AI');}});
  const req={sessionID:'meteo',session:{},body:{testo:'che tempo fa a esempiopoli'}};
  const out=await servizio.gestisci(req);
  assert.equal(out.tipo,'meteo');assert.match(out.risposta,/Esempiopoli/);
  assert.equal(req.session.assistente.bozza,null);
  req.body={testo:'Raccontami una barzelletta sul meteo'};
  assert.equal((await servizio.gestisci(req)).tipo,'svago');
});

test('meteo colloquiale, refusi e città senza preposizione', () => {
  const {richiesta}=require('../src/meteo');
  for(const testo of ['meto domnai Ferrara','che temppo fa domani Ferrara','Mi dici il metteo a Ferrara domani?']){
    const out=richiesta(testo);
    assert.equal(out?.luogo,'ferrara',testo);
    assert.equal(out?.giorno,1,testo);
  }
  assert.equal(richiesta('Il metteo non si apre sul computer'),null);
});
