const {test}=require('node:test'),assert=require('node:assert/strict'),express=require('express'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {collega}=require('../src/assistente-feedback');
test('API: autenticazione, CSRF, accesso amministratore e scambio proveniente dalla sessione',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'feedback-api-')),app=express();app.use(express.json());
 const s={proprietario:'owner',messaggi:[{ruolo:'utente',testo:'Domanda reale'},{ruolo:'assistente',testo:'Risposta reale',dettagli:{feedbackId:'00000000-0000-4000-8000-000000000001',tipo:'chat'}}]};
 app.use((req,res,next)=>{req.sessionID='sess';req.session={user:req.get('user')?{email:req.get('user')}:null};next();});
 collega(app,{config:{root:dir,admin:{emails:['admin@esempio.it']},assistenteFeedbackFile:path.join(dir,'dati.json')},serveLogin:(req,res,next)=>req.session.user?next():res.sendStatus(401),csrf:(req,res,next)=>req.get('csrf')==='ok'?next():res.sendStatus(403),stato:()=>s});
 app.use((e,req,res,next)=>res.status(e.status||500).json({errore:e.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const rq=(method,url,body,extra={})=>fetch(base+'/assistente/feedback'+url,{method,headers:{'Content-Type':'application/json',...extra},body:body?JSON.stringify(body):undefined});
 try{
 assert.equal((await rq('GET','')).status,401);assert.equal((await rq('GET','',null,{user:'altro@esempio.it'})).status,403);
 assert.equal((await rq('POST','',{id:s.messaggi[1].dettagli.feedbackId,motivo:'sbagliata'},{user:'altro@esempio.it'})).status,403);
 assert.equal((await rq('POST','',{motivo:'sbagliata'},{user:'altro@esempio.it',csrf:'ok'})).status,404);
 const h={user:'altro@esempio.it',csrf:'ok'};assert.equal((await rq('POST','',{id:s.messaggi[1].dettagli.feedbackId,motivo:'sbagliata',domanda:'FALSA',risposta:'FALSA'},h)).status,200);
 const r=await rq('GET','',null,{user:'admin@esempio.it'});assert.equal(r.headers.get('cache-control'),'no-store');const d=await r.json();assert.equal(d.feedback[0].domanda,'Domanda reale');assert.equal(d.feedback[0].risposta,'Risposta reale');assert(!JSON.stringify(d).includes('owner'));
 assert.equal((await rq('PATCH','/'+d.feedback[0].id,{},h)).status,403);assert.equal((await rq('PATCH','/'+d.feedback[0].id,{}, {user:'admin@esempio.it',csrf:'ok'})).status,200);
 assert.equal((await rq('GET','?stato=nuovo',null,{user:'admin@esempio.it'})).status,200);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
