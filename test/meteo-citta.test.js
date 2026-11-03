const test=require('node:test');
const assert=require('node:assert/strict');
const {creaMeteo,richiesta}=require('../src/meteo');
const posizione=(name,latitude,longitude,timezone,country='Italia',admin1='Regione',population=1000000)=>({id:Math.round(latitude*100+longitude),name,latitude,longitude,timezone,country,admin1,population,feature_code:'PPLA'});
const milano=posizione('Milano',45.46,9.19,'Europe/Rome');
const tokyo=posizione('Tokyo',35.68,139.69,'Asia/Tokyo','Giappone');
const dati=()=>({current:{time:'2026-11-03T10:00',temperature_2m:14,weather_code:0,is_day:1},daily:{time:['2026-11-03','2026-11-04','2026-11-05'],weather_code:[0,3,61],temperature_2m_min:[8,9,10],temperature_2m_max:[18,19,20],precipitation_probability_max:[0,20,80]}});
function ambiente(ricerca=()=>[milano]){
 const chiamate=[];
 const m=creaMeteo({attivo:true,localita:'Esempiopoli',latitudine:1,longitudine:2,scarica:async url=>{
  const u=new URL(url);chiamate.push(u);
  return {ok:true,json:async()=>u.hostname.startsWith('geocoding-')?{results:ricerca(u)}:dati()};
 }});
 return {m,chiamate};
}
test('estrae citta, nomi composti e seguiti senza inviare la conversazione al fornitore',()=>{
 for(const [q,luogo] of [['Che tempo fa a Milano?','milano'],['Domani piove a New York?','new york'],['Meteo São Paulo','são paulo'],['Qual è la probabilità di pioggia a Tokyo?','tokyo'],['Meteo a Parigi, Francia','parigi, francia']]) assert.equal(richiesta(q).luogo,luogo,q);
 assert.equal(richiesta('E a Londra?',{ultimoTipo:'meteo'}).luogo,'londra');
 assert.equal(richiesta('Che tempo fa a Milano domani?').luogo,'milano');
 assert.equal(richiesta('Non funziona il sito del meteo di Milano'),null);
  assert.equal(richiesta('Che tempo fa a Milano perché devo andare dal medico').luogo,'milano');
  assert.equal(richiesta('Meteo a Londra e poi devo passare da mia sorella').luogo,'londra');
  assert.equal(richiesta('Che tempo fa a Milano? Ti scrivo la password qui'),null);
});
test('Milano in chat, automatico locale isolato, seguito domani resta a Milano',async()=>{
 const {m,chiamate}=ambiente(),s={};
 const a=await m.rispondi(richiesta('Meteo a Milano'),s);assert.equal(a.meteo.localita,'Milano');
 assert.equal(a.meteo.paese,'Italia');assert.equal(chiamate[0].searchParams.get('name'),'milano');
 const b=await m.rispondi({giorno:1},s);assert.equal(b.meteo.localita,'Milano');assert.equal(b.meteo.giorno,'Domani');
 const c=await m.rispondi();assert.equal(c.meteo.localita,'Esempiopoli');
 assert.equal(chiamate.filter(u=>u.hostname.startsWith('geocoding-')).length,1);
 assert.equal(chiamate.filter(u=>u.hostname==='api.open-meteo.com').length,2);
});
test('Tokyo usa il proprio fuso e non contamina cache o fuso della localita automatica',async()=>{
 const {m,chiamate}=ambiente(()=>[tokyo]);
 const a=await m.rispondi(richiesta('Meteo Tokyo'),{});assert.equal(a.meteo.fuso,'Asia/Tokyo');
 await m.rispondi();const urls=chiamate.filter(u=>u.hostname==='api.open-meteo.com');
 assert.equal(urls[0].searchParams.get('timezone'),'Asia/Tokyo');assert.equal(urls[1].searchParams.get('timezone'),'Europe/Rome');
});
test('omonimi: chiede quale citta, accetta una scelta e conserva il giorno richiesto',async()=>{
 const {m,chiamate}=ambiente(()=>[posizione('Newcastle',54.98,-1.61,'Europe/London','Regno Unito','Inghilterra',110000),posizione('Newcastle',-32.92,151.78,'Australia/Sydney','Australia','Nuovo Galles del Sud',150000)]),s={};
 const a=await m.rispondi(richiesta('Meteo a Newcastle domani'),s);assert.equal(a.meteo,undefined);assert.equal(a.opzioni.length,2);
 assert.match(a.risposta,/quale/i);assert.equal(chiamate.length,1);
 const scelta=richiesta(a.opzioni[1].testo,{ultimoTipo:'meteo',meteo:s.meteo});assert.ok(scelta);
 const b=await m.rispondi(scelta,s);assert.equal(b.meteo.regione,'Nuovo Galles del Sud');assert.equal(b.meteo.giorno,'Domani');assert.equal(chiamate.length,2);
});
test('cambiare giorno durante un chiarimento non ripiega sulla localita automatica',async()=>{
 const {m}=ambiente(()=>[posizione('Newcastle',54.98,-1.61,'Europe/London','Regno Unito','Inghilterra',110000),posizione('Newcastle',-32.92,151.78,'Australia/Sydney','Australia','Nuovo Galles del Sud',150000)]),s={};
 await m.rispondi(richiesta('Meteo a Newcastle'),s);
 const b=await m.rispondi({giorno:1},s);assert.equal(b.meteo,undefined);assert.equal(b.opzioni.length,2);assert.equal(s.meteo.giorno,1);
});
test('localita inesistente e geocoding guasto non restituiscono il meteo locale',async()=>{
 const {m}=ambiente(()=>[]);const a=await m.rispondi(richiesta('Meteo a Xyzxyz'),{});assert.equal(a.meteo,undefined);assert.match(a.risposta,/non.*trovat/i);
 let n=0;const guasto=creaMeteo({attivo:true,localita:'Esempiopoli',latitudine:1,longitudine:2,scarica:async()=>{n++;throw Error('offline')}});
 for(let i=0;i<2;i++){const b=await guasto.rispondi(richiesta('Meteo a Milano'),{});assert.equal(b.meteo,undefined);assert.match(b.risposta,/non riesco/i);}
 assert.equal(n,1);
});
