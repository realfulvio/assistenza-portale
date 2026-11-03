// Archivio riservato: solo gli scambi segnalati, senza identità o intera cronologia.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const MOTIVI={sbagliata:'Risposta sbagliata','non-pertinente':'Non pertinente','poco-chiara':'Poco chiara'};
const errore=(msg,status=400)=>Object.assign(new Error(msg),{status});
function creaArchivio(file){
 function leggi(){try{const a=JSON.parse(fs.readFileSync(file,'utf8'));if(!Array.isArray(a))throw Error();const attivi=a.filter(x=>Date.parse(x.data)>Date.now()-90*86400000);if(attivi.length!==a.length)salva(attivi);return attivi;}catch(e){if(e.code==='ENOENT')return [];throw errore('Archivio feedback non disponibile.',503);}}
 function salva(a){fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const tmp=file+'.'+crypto.randomUUID()+'.tmp';try{fs.writeFileSync(tmp,JSON.stringify(a),{mode:0o600,flag:'wx',flush:true});fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
 function pubblica(x){const {chiave,...r}=x;return r;}
 return {
  segnala(scambio,body,owner){
   if(!Object.hasOwn(MOTIVI,body.motivo))throw errore('Scegli un motivo valido.');
   if(body.nota!==undefined&&(typeof body.nota!=='string'||body.nota.length>500))throw errore('La nota può contenere al massimo 500 caratteri.');
   const a=leggi(),chiave=crypto.createHash('sha256').update(owner+':'+scambio.id).digest('hex');
   if(a.some(x=>x.chiave===chiave))return {nuovo:false};
   if(a.length>=1000)throw errore('Archivio feedback pieno. Riprova più tardi.',503);
   a.unshift({id:crypto.randomUUID(),chiave,data:new Date().toISOString(),stato:'nuovo',motivo:body.motivo,nota:(body.nota||'').trim(),domanda:scambio.domanda,risposta:scambio.risposta,tipo:scambio.tipo,fonti:scambio.fonti||[]});salva(a);return {nuovo:true};
  },
  elenca({stato='',pagina=0}={}){const a=leggi().filter(x=>!stato||x.stato===stato);return {feedback:a.slice(pagina*25,pagina*25+25).map(pubblica),totale:a.length};},
  verifica(id){const a=leggi(),x=a.find(x=>x.id===id);if(!x)throw errore('Segnalazione non trovata.',404);x.stato='verificato';salva(a);}
 };
}
function collega(api,{config,serveLogin,csrf,stato}){
 const archivio=creaArchivio(config.assistenteFeedbackFile||(process.platform==='linux'&&!config.demo?'/var/lib/portale-assistenza/assistente/feedback.json':path.join(config.root||path.join(__dirname,'..'),'data',config.demo?'feedback-assistente-demo.json':'feedback-assistente.json')));
 const admin=(req,res,next)=>(config.admin?.emails||[]).includes(String(req.session.user.email||'').toLowerCase())?next():res.status(403).json({errore:'Accesso riservato agli amministratori.'});
 const limite=require('express-rate-limit').rateLimit({windowMs:3600000,limit:20,keyGenerator:req=>req.sessionID,standardHeaders:true,legacyHeaders:false,message:{errore:'Hai inviato molte segnalazioni. Riprova più tardi.'}});
 api.use('/assistente/feedback',(req,res,next)=>{res.set('Cache-Control','no-store');next();});
 api.post('/assistente/feedback',serveLogin,csrf,limite,(req,res,next)=>{try{
  if(typeof req.body?.id!=='string'||!req.body.id)return res.status(404).json({errore:'Risposta non più disponibile in questa conversazione.'});
  const s=stato(req),m=s.messaggi.find(m=>m.ruolo==='assistente'&&m.dettagli?.feedbackId===req.body?.id);
  if(!m)return res.status(404).json({errore:'Risposta non più disponibile in questa conversazione.'});
  const i=s.messaggi.indexOf(m),domanda=s.messaggi[i-1]?.testo||'';
  archivio.segnala({id:m.dettagli.feedbackId,domanda,risposta:m.testo,tipo:m.dettagli.tipo,fonti:m.dettagli.fonti},req.body,s.proprietario);
  m.dettagli.feedbackInviato=true;if(s.ultima?.feedbackId===m.dettagli.feedbackId)s.ultima.feedbackInviato=true;res.json({ok:true});
 }catch(e){next(e);}});
 api.get('/assistente/feedback',serveLogin,admin,(req,res,next)=>{try{
  const pagina=Number(req.query.pagina||0),stato=req.query.stato||'';
  if(!Number.isInteger(pagina)||pagina<0||pagina>40||!['','nuovo','verificato'].includes(stato))return res.status(400).json({errore:'Filtro non valido.'});
  res.json(archivio.elenca({pagina,stato}));
 }catch(e){next(e);}});
 api.patch('/assistente/feedback/:id',serveLogin,admin,csrf,(req,res,next)=>{try{archivio.verifica(req.params.id);res.json({ok:true});}catch(e){next(e);}});
}
module.exports={creaArchivio,collega,MOTIVI};
