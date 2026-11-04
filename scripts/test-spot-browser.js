// Demo isolata e richieste inventate: nessuna chiamata a GLPI o al modello AI.
process.env.DEMO='1';process.env.BASE_PATH='/assistenza';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');const {default:AxeBuilder}=require('@axe-core/playwright');
const config=require('../src/config');
const cartella=path.join(__dirname,'../artifacts/spot-browser');fs.mkdirSync(cartella,{recursive:true});
const catalogo=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/spot-assistente.example.json'),'utf8'));
catalogo.spot.forEach(v=>{v.attivo=true;});
config.spotAssistentePath=path.join(cartella,'catalogo-di-prova.json');fs.writeFileSync(config.spotAssistentePath,JSON.stringify(catalogo));
config.ente.meteo={attivo:true,localita:'Esempiopoli',latitudine:0,longitudine:0};
const app=require('../src/server');
async function main(){
 const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});let browser;
 const base='http://127.0.0.1:'+server.address().port+'/assistenza';
 try{
  browser=await chromium.launch({headless:true,args:['--mute-audio'],...(process.env.QA_BROWSER?{channel:process.env.QA_BROWSER}:{})});
  // Comandi manuali: nessuna attesa, anche con silenziamento e cooldown.
  const c=await browser.newContext(),p=await c.newPage();let invii=0;const errori=[];p.on('pageerror',e=>errori.push(e.message));
  await p.route('**/api/meteo',r=>r.fulfill({status:503,json:{}}));
  await p.route('**/api/allerte-meteo',r=>r.fulfill({json:{stato:'disabilitato'}}));
  await p.route('**/api/assistente',r=>r.request().method()==='POST'?(invii++,r.fulfill({status:503,json:{errore:'Il comando spot non deve usare AI'}})):r.continue());
  await p.addInitScript(()=>{localStorage.setItem('portale.assistente.spot.silenzioso','1');localStorage.setItem('portale.assistente.spot.prossimo',String(Date.now()+3600000));});
  await p.goto(base+'/auth/login');await p.waitForFunction(n=>window.SpotAssistente?.disponibili?.()===n,catalogo.spot.length);
  const risposta=await c.request.get(base+'/api/spot-assistente');assert.equal(risposta.status(),200);assert.equal(risposta.headers()['cache-control'],'no-store');
  const range=await c.request.get(base+'/media/spot/rimbalzoff.mp4',{headers:{Range:'bytes=0-1023'}});assert.equal(range.status(),206);assert.equal((await range.body()).length,1024);assert.match(range.headers()['content-type'],/^video\/mp4/);
  await p.evaluate(()=>{document.getElementById('descrizione').value='Bozza fittizia da conservare';});
  await p.locator('#mascotte-btn').click();await p.waitForSelector('#msc-domanda');const prima=await(await c.request.get(base+'/api/assistente')).json();let ultimo=null;
  for(const domanda of ['lista di tutti gli spot','lista spot','Mi fai vedere tutte le pubblicità?','Mi fai vedere tutti gli spot?','Vorrei sapere quali pubblicità avete','Puoi farmi vedere gli spot pubblicitari?']){
   await p.locator('#msc-domanda').fill(domanda);
   await p.locator('.msc-invia').click();
   await p.getByRole('heading',{name:'Spot disponibili'}).waitFor();
   for(const titolo of catalogo.spot.map(v=>v.titolo))await p.getByRole('button',{name:titolo,exact:true}).waitFor();
  }
  assert.equal(await p.locator('#msc-spot video').count(),0);
  await p.getByRole('button',{name:'Rebootol',exact:true}).click();
  await p.waitForFunction(()=>{const v=document.querySelector('#msc-spot video');return v?.getAttribute('src')?.endsWith('/rebootol.mp4')&&!v.paused&&v.readyState>=2;});
  await p.getByRole('button',{name:'Chiudi lo spot',exact:true}).click();
  await p.getByRole('heading',{name:'Spot disponibili'}).waitFor();
  for(const comando of ['Cedro','Dipendentin','Rimbalzoff','Ticketol','Rebootol','Cedro','Cedro','spot','pubblicità']){
   await p.locator('#msc-domanda').fill(comando);await p.locator('.msc-invia').click();await p.locator('#msc-spot video').waitFor({timeout:5000});
   assert.equal(await p.locator('dialog[open]').count(),0);assert.equal(await p.locator('#mascotte-fumetto').isVisible(),false);
   const titolo=await p.locator('#msc-spot').getAttribute('aria-label');const richiesto={Cedro:'cedro.mp4',Dipendentin:'dipendentin-nuovo.mp4',Rimbalzoff:'rimbalzoff.mp4',Ticketol:'ticketol.mp4',Rebootol:'rebootol.mp4'}[comando];if(richiesto)assert((await p.locator('#msc-spot video').getAttribute('src')).endsWith('/'+richiesto));else assert.notEqual(titolo,ultimo);ultimo=titolo;
   await p.waitForFunction(()=>{const v=document.querySelector('#msc-spot video');return v&&!v.paused&&v.readyState>=2;});
   assert.equal(await p.locator('#msc-spot video').evaluate(v=>v.muted),false);
   await p.getByRole('button',{name:'Chiudi lo spot',exact:true}).click();await p.waitForSelector('#msc-spot',{state:'detached'});
   await p.waitForFunction(()=>document.activeElement?.id==='msc-domanda');assert.equal(await p.locator('#msc-domanda').inputValue(),'');
   assert.equal(await p.locator('#descrizione').inputValue(),'Bozza fittizia da conservare');
  }
  assert.equal(invii,0);assert.deepEqual(await(await c.request.get(base+'/api/assistente')).json(),prima);assert.deepEqual(errori,[]);await c.close();
  // Meteo prioritario e spot spontaneo: riproduzione muta nella nuvoletta.
  const c2=await browser.newContext({viewport:{width:1280,height:960}}),p2=await c2.newPage();
  await p2.clock.install({time:new Date('2026-11-03T10:00:00Z')});await p2.clock.pauseAt(new Date('2026-11-03T10:00:01Z'));
  await p2.addInitScript(()=>{Math.random=()=>0;localStorage.setItem('tel','0123456789');});
  await p2.route('**/api/meteo',r=>r.fulfill({json:{tipo:'meteo',meteo:{localita:'Esempiopoli',giorno:'Oggi',icona:'☀️',descrizione:'Sereno',temperatura:15,minima:8,massima:19,pioggia:0,aggiornato:'2026-11-03T10:00'}}}));
  await p2.route('**/api/allerte-meteo',r=>r.fulfill({json:{stato:'verde'}}));
  await p2.route('**/api/spot-assistente',r=>r.fulfill({json:{spot:catalogo.spot.filter(v=>v.id==='rimbalzoff')}}));
  await p2.goto(base+'/auth/login');await p2.clock.runFor(100);await p2.waitForFunction(()=>window.SpotAssistente?.disponibili?.()===1);
  await p2.waitForSelector('#msc-meteo',{timeout:3000});assert.equal(await p2.locator('#msc-spot').count(),0);
  await p2.clock.runFor(50000);assert.equal(await p2.locator('#msc-spot').count(),0);
  for(let i=0;i<100&&await p2.locator('#msc-spot video').count()===0;i++)await p2.clock.runFor(1000);
  await p2.clock.resume();await p2.waitForFunction(()=>{const v=document.querySelector('#msc-spot video');return v&&!v.paused&&v.readyState>=2;});
  const v=p2.locator('#msc-spot video');assert.equal(await v.evaluate(e=>e.muted),true);
  await p2.clock.runFor(11000);assert.equal(await p2.locator('#msc-spot').isVisible(),true);
  await p2.screenshot({path:path.join(cartella,'spot-desktop.png')});await p2.setViewportSize({width:390,height:844});
  const r=await p2.locator('#msc-spot').boundingBox();assert(r.x>=0&&r.y>=0&&r.x+r.width<=390);
  await p2.screenshot({path:path.join(cartella,'spot-mobile.png')});assert.deepEqual((await new AxeBuilder({page:p2}).include('#msc-spot').analyze()).violations.map(v=>v.id),[]);
  const filmato=await v.elementHandle();await p2.getByRole('button',{name:'Chiudi lo spot',exact:true}).click();
  assert.equal(await filmato.evaluate(e=>e.paused),true);assert.equal(await filmato.evaluate(e=>e.getAttribute('src')),null);await c2.close();
  console.log('OK: spot nella nuvoletta, comandi immediati senza AI, casualità senza ripetizioni, chat/bozza/focus, meteo primo, avvio automatico muto, durata, mobile/axe, streaming206 e chiusura.');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
