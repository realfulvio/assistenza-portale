const test=require('node:test');
const assert=require('node:assert/strict');
const {richiesta,creaMeteo}=require('../src/meteo');
const dati=()=>({current:{time:'2026-11-03T10:00',temperature_2m:12,weather_code:3,is_day:1},daily:{time:['2026-11-03','2026-11-04','2026-11-05'],weather_code:[3,61,0],temperature_2m_min:[7,8,9],temperature_2m_max:[14,15,16],precipitation_probability_max:[0,80,10]}});
test('frase del problema: periodo distinto dal nome della citta',()=>{
 const q=richiesta('meteo esempiopoli prossimi giorni');
 assert.equal(q.luogo,'esempiopoli');assert.deepEqual(q.giorni,[0,1,2]);
 for(const s of ['meteo a Milano nei prossimi giorni','previsioni Milano prossimi giorni','meteo Milano prossimi tre giorni']){const p=richiesta(s);assert.equal(p.luogo,'milano');assert.deepEqual(p.giorni,[0,1,2]);}
 const seconda=richiesta('meteo per i prossimi giorni a esempiopoli');assert.equal(seconda.luogo,'esempiopoli');assert.deepEqual(seconda.giorni,[0,1,2]);
 assert.equal(richiesta('Meteo per i prossimi giorni').luogo,undefined);
 assert.equal(richiesta('meteo a Milano domani visita medica').luogo,'milano');
 assert.equal(richiesta('meteo a Milano domani colloquio di lavoro').luogo,'milano');
 assert.deepEqual(richiesta('E nei prossimi giorni?',{ultimoTipo:'meteo'}).giorni,[0,1,2]);
});
test('giorni espliciti e date fuori finestra non diventano oggi',()=>{
 assert.deepEqual(richiesta('Meteo Milano oggi e domani').giorni,[0,1]);
 assert.deepEqual(richiesta('Meteo Milano domani e dopodomani').giorni,[1,2]);
 assert.equal(richiesta('Meteo Milano fra due giorni').giorno,2);
 // Finestra di previsione: oggi più i sette giorni successivi.
 assert.equal(richiesta('Meteo Milano tra 5 giorni').giorno,5);
 for(const s of ['Meteo Milano tra 9 giorni','Meteo Milano prossimi 10 giorni','Meteo Milano settimana prossima']) assert.equal(richiesta(s).oltre,true,s);
});
test('weekend e giorni della settimana dentro la finestra di otto giorni',()=>{
 const mercoledi=Date.UTC(2026,10,4,10);
 assert.deepEqual(richiesta('meteo Milano weekend',{},'',mercoledi).giorni,[3,4]);
 assert.equal(richiesta('che tempo fa sabato a Ferrara?',{},'',mercoledi).giorno,3);
 assert.equal(richiesta('meteo Milano lunedì prossimo',{},'',mercoledi).giorno,5);
 assert.equal(richiesta('meteo Milano sabato',{},'',mercoledi).oltre,false);
});
test('riepilogo reale di tre giorni, con tre date e dati diversi, senza geocodificare il periodo',async()=>{
 let n=0;const m=creaMeteo({attivo:true,localita:'Esempiopoli',latitudine:1,longitudine:2,scarica:async u=>{assert.equal(new URL(u).hostname,'api.open-meteo.com');n++;return {ok:true,json:async()=>dati()};}});
 const out=await m.rispondi(richiesta('meteo esempiopoli prossimi giorni'),{});
 assert.equal(out.meteo,undefined);assert.equal(out.previsioni.length,3);assert.deepEqual(out.previsioni.map(p=>p.data),dati().daily.time);
 assert.deepEqual(out.previsioni.map(p=>p.massima),[14,15,16]);assert.deepEqual(out.previsioni.map(p=>p.pioggia),[0,80,10]);assert.match(out.risposta,/Domani.*04\/11/);assert.equal(n,1);
 assert.equal((await m.rispondi()).meteo.giorno,'Oggi','Il fumetto automatico resta sulle condizioni attuali');
});
test('citta estera e chiarimento omonimi conservano il periodo',async()=>{
 const geo=[{name:'Newcastle',latitude:54,longitude:-1,timezone:'Europe/London',country:'Regno Unito',admin1:'Inghilterra',population:100000},{name:'Newcastle',latitude:-32,longitude:151,timezone:'Australia/Sydney',country:'Australia',admin1:'Nuovo Galles del Sud',population:120000}];
 const m=creaMeteo({attivo:true,localita:'Esempiopoli',latitudine:1,longitudine:2,scarica:async u=>({ok:true,json:async()=>new URL(u).hostname.startsWith('geocoding-')?{results:geo}:dati()})}),s={};
 const a=await m.rispondi(richiesta('meteo Newcastle prossimi giorni'),s);assert.equal(a.opzioni.length,2);
 const scelta=richiesta(a.opzioni[0].testo,{ultimoTipo:'meteo',meteo:s.meteo});const b=await m.rispondi(scelta,s);
 assert.equal(b.previsioni.length,3);assert.equal(b.previsioni[1].localita,'Newcastle');assert.equal(b.previsioni[1].fuso,'Europe/London');
});
