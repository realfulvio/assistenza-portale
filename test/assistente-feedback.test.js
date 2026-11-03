const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {creaArchivio}=require('../src/assistente-feedback');
test('feedback: salva solo lo scambio segnalato, deduplica, conserva dopo riapertura e consente la verifica',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'feedback-test-'));try{
 const file=path.join(dir,'dati.json');const a=creaArchivio(file);const scambio={id:'risposta-1',domanda:'La stampante non stampa',risposta:'Controlla la guida',tipo:'chat',fonti:[{titolo:'Stampante',url:'/assistenza/#faq/stampa'}]};
 const x=a.segnala(scambio,{motivo:'sbagliata',nota:'Non risolve'},'utente-A');assert.equal(x.nuovo,true);
 assert.equal(a.segnala(scambio,{motivo:'sbagliata',nota:'duplicato'},'utente-A').nuovo,false);
 assert.equal(a.segnala(scambio,{motivo:'poco-chiara'},'utente-B').nuovo,true);
 assert.throws(()=>a.segnala(scambio,{motivo:'inventato'},'utente-C'),/motivo/i);
 assert.throws(()=>a.segnala(scambio,{motivo:'sbagliata',nota:'x'.repeat(501)},'utente-C'),/500/);
 const b=creaArchivio(file);assert.equal(b.elenca().totale,2);const r=b.elenca().feedback[0];assert.equal(r.stato,'nuovo');assert.equal(r.domanda,scambio.domanda);assert(!('utente' in r));
 b.verifica(r.id);assert.equal(b.elenca({stato:'nuovo'}).totale,1);assert.throws(()=>b.verifica('../altro'),/valida|trovata/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('azioni contestuali: guide solo di assistenza, nessuna azione per meteo o svago',()=>{
 const {aggiungiAzioni}=require('../src/assistente-azioni');
 for(const out of [{tipo:'meteo',fonti:[]},{tipo:'svago',fonti:[]},{tipo:'chat',fonti:[]},{tipo:'contatti',fonti:[{url:'/assistenza/#contatti'}]}])assert.equal(aggiungiAzioni(out,'/assistenza').opzioni,undefined);
 const out=aggiungiAzioni({tipo:'chat',fonti:[{url:'/assistenza/#faq/stampante'}]},'/assistenza');assert.deepEqual(out.opzioni.map(x=>x.azione),['non_risolto','ticket_contesto']);
});
test('prepara richiesta: conserva i fatti dell’utente e rifiuta un pulsante non più attuale',async()=>{
 const {creaServizio}=require('../src/assistente'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'azioni-test-'));
 try{
 const faqPath=path.join(dir,'faq.json');fs.writeFileSync(faqPath,'[]');
 const servizio=creaServizio({config:{base:'/assistenza',faqPath,categorie:{categorie:[{id:'pc',nome:'Computer'}]},ente:{}},numeriInterni:{}});
 const req={sessionID:'x',session:{user:{oid:'alice'}},body:{azione:'ticket_contesto',riferimento:'attuale'}};
 const s=servizio.stato(req);s.messaggi=[{ruolo:'utente',testo:'La stampante ABC non stampa da stamattina'},{ruolo:'assistente',testo:'Prova la guida'},{ruolo:'utente',testo:'Non ho risolto'}];s.ultima={feedbackId:'attuale',opzioni:[{azione:'ticket_contesto'}]};
 const out=await servizio.gestisci(req);assert.equal(out.tipo,'bozza');assert.equal(s.bozza.problema,'La stampante ABC non stampa da stamattina');assert.equal(s.bozza.passo,'categoria');assert(out.opzioni.some(x=>x.categoria==='pc'));
 await assert.rejects(()=>servizio.gestisci(req),/non è più/);
 req.body={azione:'categoria',categoria:'pc'};await servizio.gestisci(req);
 for(const testo of ['Nessun errore','Ho provato a stampare due volte','Stampante ABC']){req.body={testo};await servizio.gestisci(req);}
 assert.match(s.ultima.bozza.descrizione,/ABC non stampa da stamattina/);assert.doesNotMatch(s.ultima.bozza.descrizione,/Prova la guida/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('Non ho risolto: esito successivo conservato senza ripetere il percorso o interrogare AI',async()=>{
 const {creaServizio}=require('../src/assistente');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'esito-test-'));
 try{
 const faqPath=path.join(dir,'faq.json');fs.writeFileSync(faqPath,'[]');const servizio=creaServizio({config:{base:'/assistenza',faqPath,categorie:{categorie:[{id:'pc',nome:'Computer'}]},ente:{}},numeriInterni:{},chiamaAI:()=>{throw Error('AI non deve essere chiamata');}});
 const req={sessionID:'esito',session:{user:{oid:'alice'}}},s=servizio.stato(req);const iniziale='X-Desk dopo cambio ente: '+ 'dettaglio utile '.repeat(100);
 s.messaggi=[{ruolo:'utente',testo:iniziale},{ruolo:'assistente',testo:'Esci da X-Desk e riaprilo'}];s.ultima={feedbackId:'prima',opzioni:[{azione:'non_risolto'}],fonti:[{url:'/assistenza/#faq/ente'}]};
 req.body={azione:'non_risolto',riferimento:'prima'};await servizio.gestisci(req);
 req.body={testo:'Compare ancora la schermata iniziale'};const out=await servizio.gestisci(req);assert.equal(out.tipo,'verifica');assert.doesNotMatch(out.risposta,/Esci da X-Desk/);
 req.body={azione:'ticket_contesto',riferimento:out.feedbackId};await servizio.gestisci(req);assert(s.bozza.problema.startsWith('X-Desk dopo cambio ente:'));assert(s.bozza.problema.endsWith('Compare ancora la schermata iniziale'));assert(s.bozza.problema.length>1500);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
