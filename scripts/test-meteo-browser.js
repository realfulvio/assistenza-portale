// Browser isolato: orologio controllato e meteo fittizio, nessuna chiamata a servizi reali.
process.env.DEMO = '1';
process.env.BASE_PATH = '/assistenza';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const config = require('../src/config');
config.ente.meteo = { attivo: true, localita: 'Esempiopoli', latitudine: 0, longitudine: 0 };
const app = require('../src/server');
const meteo = { tipo: 'meteo', risposta: 'Meteo di prova', meteo: { localita: 'Esempiopoli', giorno: 'Oggi', icona: '☀️', descrizione: 'Sereno', temperatura: 15, minima: 8, massima: 19, pioggia: 0, aggiornato: '2026-11-03T10:00' } };
async function verifica() {
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.QA_BROWSER ? { channel: process.env.QA_BROWSER } : {}) });
    const url = `http://127.0.0.1:${server.address().port}/assistenza`;
    const contesto = await browser.newContext();
    const page = await contesto.newPage();
    const errori = []; page.on('pageerror', e => errori.push(e.message));
    await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.addInitScript(() => { Math.random = () => 0; localStorage.setItem('portale.assistente.meteo.prossimo', String(Date.now() + 50 * 60000)); });
    await page.route('**/api/meteo', route => route.fulfill({ json: meteo }));
    await page.goto(url + '/auth/login');
    await page.clock.runFor(100);
    await page.waitForFunction(() => document.getElementById('mascotte') !== null);
    assert.equal(await page.locator('#msc-meteo').isVisible(), true, 'Il meteo deve essere il primo fumetto, anche con una scadenza precedente salvata');
    assert.equal(await page.locator('.msc-nota:not(.msc-meteo)').count(), 0);
    await page.locator('.msc-meteo-chiudi').click();
    await page.clock.runFor(11999);
    assert.equal(await page.locator('.msc-nota:not(.msc-meteo)').count(), 0, 'La battuta non deve anticipare 12 secondi');
    await page.clock.runFor(10);
    assert.equal(await page.locator('.msc-nota:not(.msc-meteo)').count(), 1, 'Con casualità minima la battuta compare dopo 12 secondi');
    await page.reload(); await page.clock.runFor(100);
    assert.equal(await page.locator('#msc-meteo').isVisible(), true, 'Ricaricando la pagina il meteo torna per primo');
    await page.locator('.msc-meteo-silenzia').click();
    await page.reload(); await page.clock.runFor(60001);
    assert.equal(await page.locator('#msc-meteo').count(), 0, 'Il silenziamento resta valido anche al caricamento');
    assert.deepEqual(errori, []);
    await contesto.close();
    console.log('OK: meteo immediato e prioritario, ritorno al ricaricamento, battute da 12 secondi e silenziamento persistente.');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
verifica().catch(e => { console.error(e); process.exitCode = 1; });
