// Prova completa su dati sintetici, senza Qwen o GLPI reali.
process.env.DEMO='1';process.env.BASE_PATH='/assistenza';process.env.ADMIN_EMAILS='maria.bianchi@esempio.it';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),express=require('express');
const {chromium}=require('playwright'),{default:AxeBuilder}=require('@axe-core/playwright');
const root=path.join(__dirname,'..'),dir=path.join(root,'artifacts/feedback-browser');fs.mkdirSync(dir,{recursive:true});
process.env.ASSISTENTE_CACHE_FILE=path.join(dir,'indice.json');process.env.ASSISTENTE_FEEDBACK_FILE=path.join(dir,'feedback-'+Date.now()+'.json');
const config=require('../src/config');
async function main(){
 const mock=express();mock.use(express.json());mock.post('/api/embed',(q,r)=>r.json({embeddings:q.body.input.map(()=>[1,0])}));mock.post('/api/chat',(q,r)=>r.json({message:{content:'Consulta la guida indicata. Se non risolvi, prepara la richiesta con i dettagli già raccolti.'}}));
 const ai=mock.listen(0,'127.0.0.1');await new Promise(r=>ai.once('listening',r));config.assistenteAiUrl='http://127.0.0.1:'+ai.address().port;
 const server=require('../src/server').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let b;
 try{
 b=await chromium.launch({headless:true,...(process.env.QA_BROWSER?{channel:process.env.QA_BROWSER}:{})});const context=await b.newContext({viewport:{width:1280,height:900}}),p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));const base='http://127.0.0.1:'+server.address().port+'/assistenza';
 await p.goto(base+'/auth/login');await p.locator('#mascotte-btn').click();const scrivi=async t=>{await p.locator('#msc-domanda').fill(t);await p.locator('.msc-invia').click();await p.waitForFunction(()=>!document.querySelector('.msc-invia')?.disabled);};
 await scrivi('Una freddura');await p.waitForSelector('.msc-ride',{timeout:4000});assert.equal(await p.getByRole('button',{name:'Non ho risolto',exact:true}).count(),0);await p.screenshot({path:path.join(dir,'risata.png')});await p.waitForSelector('.msc-ride',{state:'detached',timeout:5000});
 await scrivi('La stampante non stampa');await p.getByRole('button',{name:'Non ho risolto',exact:true,disabled:false}).waitFor();
 await p.getByRole('button',{name:'👎 Segnala risposta',exact:true}).last().click();await p.screenshot({path:path.join(dir,'feedback-form.png')});await p.getByLabel('Motivo della segnalazione').selectOption('sbagliata');await p.getByLabel('Nota facoltativa, massimo 500 caratteri').fill('Nota sintetica <img src=x onerror=alert(1)>');
 await p.getByRole('button',{name:'Invia segnalazione',exact:true}).click();await p.getByText('Segnalazione ricevuta, grazie.',{exact:true}).waitFor();
 await p.getByRole('button',{name:'Non ho risolto',exact:true,disabled:false}).click();await p.getByText('Le indicazioni non hanno risolto.',{exact:false}).waitFor();
 await p.getByRole('button',{name:'Prepara la richiesta',exact:true,disabled:false}).click();await p.getByText('Uso quanto hai già descritto',{exact:false}).waitFor();
 const stato=await p.evaluate(async base=>(await(await fetch(base+'/api/assistente')).json()),base);assert.equal(stato.ultima.tipo,'bozza');assert.match(stato.messaggi.map(x=>x.testo).join(' '),/stampante/);
 await p.locator('#msc-chiudi').click();await p.locator('#slim-feedback').click();await p.locator('.feedback-scheda').first().waitFor();
 assert.match(await p.locator('.feedback-scheda').first().innerText(),/stampante/);assert.equal(await p.locator('.feedback-scheda img').count(),0);
 await p.screenshot({path:path.join(dir,'feedback-admin.png'),fullPage:true});await p.setViewportSize({width:390,height:844});assert((await p.locator('.feedback-scheda').first().boundingBox()).width<390);
 const violations=(await new AxeBuilder({page:p}).include('#v-feedback-assistente').analyze()).violations;assert.deepEqual(violations.map(x=>x.id),[]);
 await p.getByRole('button',{name:'Segna come verificata',exact:true}).first().click();await p.getByText('Nessuna segnalazione da mostrare.',{exact:true}).waitFor();
 await p.getByLabel('Filtra le segnalazioni').selectOption('verificato');await p.locator('.feedback-scheda').waitFor();
 await p.locator('#mascotte-btn').click();await p.locator('.msc-nuova').click();await scrivi('Una freddura');
 await p.evaluate(()=>document.documentElement.dataset.motion='reduce');await p.waitForSelector('.msc-ride');assert.equal(await p.locator('.msc-testa').evaluate(e=>getComputedStyle(e).animationName),'none');
 await p.evaluate(()=>document.documentElement.dataset.motion='full');
 for(const theme of ['classic','giardino','autunno','dark','contrast','mountain']){
   await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await scrivi('Una freddura');await p.waitForSelector('.msc-ride');assert.equal(await p.locator('.msc-testa').evaluate(e=>getComputedStyle(e).animationName),'msc-risata-testa');
 }
 const c2=await b.newContext({timezoneId:'Europe/Rome'}),p2=await c2.newPage();await p2.clock.install({time:new Date('2026-11-04T09:00:00Z')});
 await p2.route('**/api/meteo',r=>r.fulfill({status:503,json:{}}));await p2.route('**/api/allerte-meteo',r=>r.fulfill({json:{stato:'disabilitato'}}));
 await p2.addInitScript(()=>{Math.random=()=>.5;localStorage.setItem('portale.assistente.meteo.silenzioso','1');localStorage.setItem('portale.assistente.spot.silenzioso','1');});
 await p2.goto(base+'/auth/login');await p2.clock.runFor(9500);await p2.locator('.msc-ride').waitFor({timeout:2000});
 await p2.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));assert.equal(await p2.locator('.msc-ride').count(),0);
 await p2.clock.setSystemTime(new Date('2026-11-04T10:00:00Z'));
 await p2.clock.runFor(17000);
 await p2.getByText('Le 11??? Non ho ancora fatto la pausa caffè!',{exact:true}).waitFor({timeout:2000});
 assert.equal(await p2.locator('#mascotte').getAttribute('data-gesto-mascotte'),'sorpresa');
 assert(await p2.locator('.msc-bocca-sorpresa').isVisible());
 assert((await p2.locator('.msc-raccordo-collo').getAttribute('d')).startsWith('M'));
 await p2.clock.runFor(17000);
 assert.equal(await p2.getByText('Le 11??? Non ho ancora fatto la pausa caffè!',{exact:true}).count(),0);
 await c2.close();
 assert.deepEqual(errors,[]);console.log('OK: risata e movimento ridotto, pulsanti contestuali, feedback reale persistito, nessun HTML eseguito, admin mobile/axe e verifica.');
 }finally{if(b)await b.close();server.closeAllConnections();ai.closeAllConnections();await new Promise(r=>server.close(r));await new Promise(r=>ai.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
