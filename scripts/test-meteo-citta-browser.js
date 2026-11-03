// Demo effimera con fornitori simulati: nessun accesso a GLPI, Qwen o meteo reali.
process.env.DEMO='1'; process.env.BASE_PATH='/assistenza';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs'); const path=require('node:path');
const {default:AxeBuilder}=require('@axe-core/playwright');
const config=require('../src/config');
config.ente.meteo={attivo:true,localita:'Esempiopoli',latitudine:1,longitudine:2};
const originale=global.fetch;
global.fetch=async(url,opts)=>{
  const u=new URL(url);
  if(u.hostname==='geocoding-api.open-meteo.com') {
    const q=u.searchParams.get('name');
    const p=(name,latitude,longitude,timezone,country,admin1)=>({name,latitude,longitude,timezone,country,admin1,population:100000,feature_code:'PPLA'});
    return Response.json({results:q==='milano'?[p('Milano',45,9,'Europe/Rome','Italia','Lombardia')]:q==='tokyo'?[p('Tokyo',35,139,'Asia/Tokyo','Giappone','Tokyo')]:q==='newcastle'?[p('Newcastle',54.98,-1.61,'Europe/London','Regno Unito','Inghilterra'),p('Newcastle',-32.92,151.78,'Australia/Sydney','Australia','Nuovo Galles del Sud')]:[]});
  }
  if(u.hostname==='api.open-meteo.com') return Response.json({current:{time:'2026-11-03T10:00',temperature_2m:14,weather_code:0,is_day:1},daily:{time:['2026-11-03','2026-11-04','2026-11-05'],weather_code:[0,3,61],temperature_2m_min:[8,9,10],temperature_2m_max:[18,19,20],precipitation_probability_max:[0,20,80]}});
  throw new Error('Rete esterna vietata nel test: '+u.hostname);
};
const app=require('../src/server');
(async()=>{
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});let browser;
  try{
    browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER?{channel:process.env.QA_BROWSER}:{})});
    const context=await browser.newContext({viewport:{width:1280,height:960}}),page=await context.newPage();
    const errori=[];page.on('pageerror',e=>errori.push(e.message));
    const url=`http://127.0.0.1:${server.address().port}/assistenza`;
    await page.goto(url+'/auth/login');await page.waitForSelector('#msc-meteo');
    assert.match(await page.locator('#msc-meteo').innerText(),/Esempiopoli/);
    await page.locator('#mascotte-btn').click();
    async function chiedi(q,attesa){await page.locator('#msc-domanda').fill(q);const risposta=page.waitForResponse(r=>r.url().endsWith('/api/assistente')&&r.request().method()==='POST');await page.locator('.msc-invia').click();await risposta;await page.waitForSelector('.msc-invia:not([disabled])');await page.waitForFunction(t=>[...document.querySelectorAll('.msc-risposta')].at(-1)?.innerText.includes(t),attesa);}
    await chiedi('Che tempo fa a Milano?','Oggi a Milano');
    await chiedi('E domani?','Domani a Milano');
    const output=path.resolve(process.env.QA_OUTPUT||path.join(__dirname,'..','artifacts','meteo-citta'));fs.mkdirSync(output,{recursive:true});
    await page.screenshot({path:path.join(output,'milano.png')});
    await chiedi('Meteo a Tokyo','Oggi a Tokyo');assert.match(await page.locator('.msc-risposta').last().innerText(),/Asia\/Tokyo/);
    assert.deepEqual((await new AxeBuilder({page}).include('.msc-meteo-scheda').analyze()).violations.map(v=>v.id),[]);
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'tokyo-mobile.png')});
    await chiedi('meteo esempiopoli prossimi giorni','Previsioni a Esempiopoli');
    assert.equal(await page.locator('.msc-risposta').last().locator('.msc-previsioni-giorno').count(),3);
    await chiedi('meteo per i prossimi giorni a esempiopoli','Previsioni a Esempiopoli');
    const riepilogo=page.locator('.msc-risposta').last();assert.equal(await riepilogo.locator('.msc-previsioni-giorno').count(),3);
    assert.match(await riepilogo.innerText(),/Domani · 04\/11/);assert.match(await riepilogo.innerText(),/Dopodomani · 05\/11/);
    assert.deepEqual((await new AxeBuilder({page}).include('.msc-previsioni').analyze()).violations.map(v=>v.id),[]);
    await page.screenshot({path:path.join(output,'prossimi-giorni-mobile.png')});
    await chiedi('Meteo a Newcastle','Quale intendi');await page.getByRole('button',{name:'Newcastle (Inghilterra, Regno Unito)',exact:true}).click();
    await page.waitForFunction(()=>[...document.querySelectorAll('.msc-risposta')].at(-1)?.innerText.includes('Europe/London'));
    await page.locator('#msc-chiudi').click();await page.reload();await page.waitForSelector('#msc-meteo');
    assert.match(await page.locator('#msc-meteo').innerText(),/Esempiopoli/);
    assert.equal(await page.locator('[data-tema="halloween"]').count(),0);
    assert.deepEqual(errori,[]);await context.close();
    console.log('OK: Milano, seguito domani, Tokyo/fuso, omonimi, automatico locale isolato, mobile, accessibilita e Halloween rimosso.');
  }finally{if(browser)await browser.close();global.fetch=originale;await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
