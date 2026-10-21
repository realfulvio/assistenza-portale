// QA della v2 su loopback, senza GLPI/Microsoft reali. Non modifica screenshot di riferimento.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
const root = path.join(__dirname, '..');
const output = path.resolve(process.env.QA_OUTPUT || path.join(root, 'artifacts', 'v2-browser'));
fs.mkdirSync(output, { recursive: true });
const temporary = fs.mkdtempSync(path.join(output, 'profiles-'));
process.env.DEMO = '1'; process.env.BASE_PATH = '/assistenza';
process.env.PREFERENCES_DIR = path.join(temporary, 'preferences');
process.env.AVATAR_DIR = path.join(temporary, 'avatars');
const app = require('../src/server');
const model = require('../public/appearance-model');
// Middleware disponibile soltanto nel processo effimero di test.
const qaHelper = require('express').Router();
qaHelper.use((req, res, next) => {
  if (req.session.user && req.get('x-qa-account') === 'b') req.session.user = { oid: 'qa-b', tenant: 'qa', name: 'Utente Prova B', email: 'prova.b@esempio.it' };
  next();
});
app._router.stack.find(layer => layer.name === 'router').handle.stack.splice(1, 0, qaHelper.stack[0]);
const report = { matrix: [], accessibility: [], checks: [], errors: [], assets: [] };
let server, browser;
async function saved(page) { await page.waitForFunction(() => document.getElementById('aspetto-stato').textContent.includes('salvate sul tuo account')); }
async function open(page) { await page.locator('#aspetto').click(); await page.locator('#aspetto-pannello').waitFor(); }
async function close(page) { await page.keyboard.press('Escape'); await page.locator('#aspetto-pannello').waitFor({ state: 'hidden' }); }
async function theme(page, id) {
  const button = page.locator(`[data-tema="${id}"]`);
  await button.evaluate(el => { const details = el.closest('details'); if (details) details.open = true; });
  await button.click(); await saved(page);
}
async function dimensions(page, maximum) {
  await page.locator('#aspetto-testo').evaluate(el => { el.closest('details').open = true; });
  for (const id of ['aspetto-testo', 'aspetto-icone']) await page.locator('#' + id).evaluate((el, value) => {
    el.value = value; el.dispatchEvent(new Event('input', { bubbles: true }));
  }, maximum ? 150 : 100);
  await page.locator(`button[data-density="${maximum ? 'a' : 'n'}"]`).click();
  await page.locator(`button[data-size="${maximum ? 'l' : 'm'}"]`).click();
  await saved(page);
}
async function noOverflow(page, context) {
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
  assert.ok(size.scroll <= size.width + 1, `${context}: scorrimento orizzontale ${JSON.stringify(size)}`);
  if (await page.locator('#aspetto-pannello').isVisible()) {
    const box = await page.locator('#aspetto-pannello').boundingBox();
    assert.ok(box.x >= -1 && box.x + box.width <= size.width + 1, `${context}: pannello fuori dallo schermo`);
  }
}
async function accessibility(page, context) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  report.accessibility.push({ context, violations: result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
}
async function go(page, url, hash) {
  await page.goto(url + '/#' + hash);
  await page.locator('#v-' + (hash.startsWith('richiesta/') ? 'dettaglio' : hash)).waitFor();
  if (hash.startsWith('richiesta/')) await page.locator('#d-thread .bubble').first().waitFor();
  if (hash === 'faq') await page.locator('#faq-lista details').first().waitFor();
}
(async () => {
  try {
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const url = `http://127.0.0.1:${server.address().port}/assistenza`;
    browser = await chromium.launch({ headless: true, ...(process.env.QA_BROWSER ? { channel: process.env.QA_BROWSER } : {}) });
    report.environment = { browser: browser.version(), node: process.version, platform: process.platform, date: new Date().toISOString() };
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('response', r => { if (/\.(css|js|woff2|svg)(\?|$)/.test(r.url()) && r.status() >= 400) report.assets.push({ url: r.url(), status: r.status() }); });
    await page.goto(url + '/auth/login'); await page.locator('#aspetto').waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'classic');
    assert.ok(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--card').trim()));
    await page.locator('.tile[data-id="computer"]').click();
    const description = 'Prova grafica: il computer non risponde da questa mattina. Riferimento: https://esempio.it/' + 'a'.repeat(120);
    await page.locator('#descrizione').fill(description); await page.locator('#telefono').fill('0123 456');
    await page.locator('#rep-dalle').fill('09:00'); await page.locator('#rep-alle').fill('12:00');
    assert.equal(await page.locator('#reperibilita').inputValue(), 'dalle 09:00 alle 12:00');
    await page.locator('#allegati').setInputFiles({ name: 'prova.txt', mimeType: 'text/plain', buffer: Buffer.from('Prova locale.') });
    if (process.env.QA_FOCUS !== 'flows') {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      for (const maximum of [false, true]) {
        for (const [id] of model.themes) {
          await open(page); await dimensions(page, maximum); await theme(page, id);
          const name = `${width}-${id}-${maximum ? '150' : '100'}`;
          await noOverflow(page, name + '-pannello');
          if (width === 390) await accessibility(page, name + '-pannello');
          await close(page); await noOverflow(page, name);
          assert.equal(await page.locator('#descrizione').inputValue(), description);
          assert.equal(await page.locator('#telefono').inputValue(), '0123 456');
          assert.equal(await page.locator('#reperibilita').inputValue(), 'dalle 09:00 alle 12:00');
          assert.equal(await page.locator('.tile[data-id="computer"]').getAttribute('aria-pressed'), 'true');
          assert.match(await page.locator('#lista-all').textContent(), /prova.txt/);
          if (width !== 320) await accessibility(page, name);
          if (width !== 320) await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
          report.matrix.push(name); console.log('QA', name);
        }
      }
    }
    report.checks.push(`${report.matrix.length} combinazioni: ${model.themes.length} temi, 3 viewport, dimensioni normali e massime; modulo, fascia oraria e allegato conservati.`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await open(page); await dimensions(page, false); await theme(page, 'dark'); await close(page);
    await page.reload(); await page.locator('#aspetto').waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    const second = await browser.newContext(); const other = await second.newPage();
    await other.goto(url + '/auth/login'); await other.locator('#aspetto').waitFor();
    assert.equal(await other.locator('html').getAttribute('data-theme'), 'dark'); await second.close();
    report.checks.push('Preferenze persistenti dopo reload e accesso da un altro browser.');
    await open(page);
    await page.route('**/api/preferenze', route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ errore: 'Salvataggio non disponibile.' }) }) : route.continue());
    await page.locator('[data-tema="spazio"]').click(); await page.locator('#aspetto-riprova').waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'spazio');
    await page.unroute('**/api/preferenze'); await page.locator('#aspetto-riprova').click(); await saved(page);
    await page.locator('#aspetto-reset').evaluate(el => { el.closest('details').open = true; });
    await page.locator('#aspetto-reset').click(); await saved(page); await close(page);
    report.checks.push('Errore salvataggio: anteprima utilizzabile, riprova e ripristino.');
    await open(page);
    await page.locator('#aspetto-movimenti').evaluate(el => { el.closest('details').open = true; });
    assert.equal(await page.locator('#aspetto-movimenti').isChecked(), true);
    await page.locator('#aspetto-movimenti').uncheck(); await saved(page); await close(page);
    assert.equal(await page.locator('html').getAttribute('data-motion'), 'full');
    assert.notEqual(await page.locator('.t-spin').first().evaluate(el => getComputedStyle(el).animationName), 'none');
    await open(page); await page.locator('#aspetto-movimenti').check(); await saved(page); await close(page);
    assert.equal(await page.locator('.t-spin').first().evaluate(el => getComputedStyle(el).animationName), 'none');
    await open(page); await page.locator('#aspetto-sistema').click(); await saved(page); await close(page);
    report.checks.push('Movimento ridotto di sistema e scelta esplicita, con animazioni attivate/disattivate.');
    await page.locator('.tile[data-id="computer"]').click(); await page.locator('#descrizione').fill(description);
    await page.locator('#allegati').setInputFiles({ name: 'prova.txt', mimeType: 'text/plain', buffer: Buffer.from('Prova.') });
    await page.locator('#invia').click(); await page.locator('#conf-numero').waitFor();
    const id = (await page.locator('#conf-numero').textContent()).replace(/\D/g, '');
    await go(page, url, 'richiesta/' + id); await page.locator('#msg').fill('Risposta di prova nel backend simulato.');
    await page.locator('#invia-msg').click(); await page.waitForFunction(() => document.getElementById('d-thread').textContent.includes('Risposta di prova'));
    const download = page.waitForEvent('download'); await page.locator('#d-pdf').click(); const pdf = await download; await pdf.saveAs(path.join(output, 'richiesta.pdf'));
    assert.equal(fs.readFileSync(path.join(output, 'richiesta.pdf')).subarray(0, 5).toString(), '%PDF-');
    await page.emulateMedia({ media: 'print' }); assert.ok(await page.locator('#stampa').isVisible()); await page.emulateMedia({ media: 'screen' });
    report.checks.push('Invio con allegato, messaggio, PDF scaricato e vista di stampa.');
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [themeId] of model.themes) {
        await open(page); await dimensions(page, true); await theme(page, themeId); await close(page);
        for (const hash of ['richieste', 'richiesta/' + id, 'richiesta/101', 'faq', 'contatti', 'profilo']) {
          await go(page, url, hash); await noOverflow(page, `${width}-${themeId}-${hash}`); await accessibility(page, `${width}-${themeId}-${hash}`);
          if (width === 390 && ['classic', 'spazio', 'autunno'].includes(themeId) && ['richiesta/101', 'profilo'].includes(hash)) await page.screenshot({ path: path.join(output, `${width}-${themeId}-${hash.replace('/', '-')}.png`), fullPage: true });
        }
        console.log('QA pagine', width, themeId);
      }
    }
    await page.locator('#pf-carica').click();
    await page.locator('#pf-file').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: await require('sharp')({ create: { width: 200, height: 200, channels: 3, background: '#2266aa' } }).png().toBuffer() });
    await page.locator('#pf-salva').click(); await page.locator('#pf-rimuovi').waitFor();
    await page.locator('#pf-rimuovi').click(); await page.waitForFunction(() => document.getElementById('pf-chip-t').textContent.includes('Nessuna foto'));
    report.checks.push('Foto caricata dal browser, elaborata e rimossa.');
    await open(page); await theme(page, 'dark'); await close(page);
    await page.locator('#esci').click(); await page.getByRole('link', { name: /Entra nella demo/ }).waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'classic');
    await context.setExtraHTTPHeaders({ 'x-qa-account': 'b' }); await page.goto(url + '/auth/login'); await page.locator('#aspetto').waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'classic');
    report.checks.push('Logout e cambio account: nessuna preferenza ereditata.');
    assert.deepEqual(report.errors, [], 'Errori JavaScript'); assert.deepEqual(report.assets, [], 'Risorse statiche mancanti');
    const failures = report.accessibility.filter(r => r.violations.length);
    assert.deepEqual(failures, [], 'Violazioni WCAG AA: vedere qa-report.json');
    console.log('QA completa:', report.matrix.length, 'combinazioni,', report.accessibility.length, 'scansioni axe.');
  } finally {
    fs.writeFileSync(path.join(output, 'qa-report.json'), JSON.stringify(report, null, 2));
    if (browser) await browser.close(); if (server) server.close();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
