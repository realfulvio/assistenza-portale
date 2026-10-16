// QA solo loopback, DEMO e GLPI mock. Playwright/axe sono strumenti di sviluppo opzionali.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
process.env.DEMO = '1';
process.env.BASE_PATH = '/assistenza';
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'portale-browser-qa-'));
process.env.PREFERENCES_DIR = temporary;
const app = require('../src/server');
const model = require('../public/appearance-model');
// Seconda identita' esclusivamente nel server effimero di questo test.
// Non aggiunge route o scorciatoie di autenticazione all'applicazione distribuita.
const helper = require('express').Router();
helper.use((req, res, next) => {
  if (req.session.user && req.get('x-qa-account') === 'b') req.session.user = { oid: 'qa-b', tenant: 'qa', name: 'Utente Prova B', email: 'prova.b@esempio.it' };
  next();
});
app._router.stack.find(layer => layer.name === 'router').handle.stack.splice(1, 0, helper.stack[0]);
const output = path.join(__dirname, '..', 'screenshots', 'appearance');
fs.mkdirSync(output, { recursive: true });
const report = { matrix: [], accessibility: [], contrasts: [], checks: [], errors: [] };
let server, browser;
async function saved(page) { await page.waitForFunction(() => document.getElementById('aspetto-stato').textContent.includes('salvate sul tuo account')); }
async function open(page) { await page.locator('#aspetto').click(); await page.locator('#aspetto-pannello').waitFor({ state: 'visible' }); }
async function close(page) { await page.keyboard.press('Escape'); await page.locator('#aspetto-pannello').waitFor({ state: 'hidden' }); }
async function dimensions(page, maximum) {
  for (const [id, value] of [['aspetto-testo', maximum ? 150 : 100], ['aspetto-icone', maximum ? 150 : 100]]) {
    await page.locator('#' + id).evaluate((input, v) => { input.value = v; input.dispatchEvent(new Event('input', { bubbles: true })); }, value);
  }
  await page.locator('#aspetto-spazio').setChecked(maximum);
}
async function noOverflow(page, context) {
  const overflow = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]');
    const node = dialog || document.documentElement;
    return { scroll: node.scrollWidth, width: node.clientWidth };
  });
  assert.ok(overflow.scroll <= overflow.width + 1, `${context}: overflow ${JSON.stringify(overflow)}`);
}
async function accessibility(page, context) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  report.accessibility.push({ context, violations: results.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })), contrastNeedsReview: results.incomplete.filter(v => v.id === 'color-contrast').map(v => v.nodes.map(n => ({ target: n.target, summary: n.failureSummary }))) });
}
async function contrast(page, theme) {
  const pairs = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    const rgb = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const luminance = color => rgb(color).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const get = name => style.getPropertyValue('--' + name).trim();
    const combinations = [['txt', 'surface'], ['txt', 'field'], ['m', 'surface'], ['m', 'soft'], ['accent', 'surface'], ['accent', 'soft'], ['button-text', 'button']];
    return combinations.map(([fg, bg]) => ({ foreground: get(fg), background: get(bg), role: fg + '/' + bg, ratio: Number(ratio(get(fg), get(bg)).toFixed(2)) }));
  });
  report.contrasts.push({ theme, pairs });
  for (const pair of pairs) assert.ok(pair.ratio >= 4.5, `${theme}: contrasto ${pair.role} = ${pair.ratio}`);
}
(async () => {
  try {
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const url = `http://127.0.0.1:${server.address().port}/assistenza`;
    browser = await chromium.launch({ channel: process.env.QA_BROWSER || 'chrome', headless: true });
    report.environment = { browser: process.env.QA_BROWSER || 'chrome', version: browser.version(), node: process.version, platform: process.platform, generatedAt: new Date().toISOString() };
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(url + '/auth/login'); await page.locator('#aspetto').waitFor({ state: 'visible' });
    await page.locator('#cat-computer').check();
    const description = 'Prova grafica locale: il computer non risponde da questa mattina.';
    await page.locator('#descrizione').fill(description); await page.locator('#telefono').fill('0123 456');
    await page.locator('#reperibilita').fill('Solo ambiente simulato');
    await page.locator('#allegati').setInputFiles({ name: 'prova-locale.txt', mimeType: 'text/plain', buffer: Buffer.from('Allegato di prova per QA locale.') });
    const labels = await page.locator('.tile b').allTextContents();
    const baseline = await page.evaluate(() => {
      const snapshot = () => [...document.querySelectorAll('.intro h2,.tile b,.tile small,.tile .ic,.form textarea,.form .send')].map(node => {
        const style = getComputedStyle(node); return [style.fontFamily, style.fontSize, style.color, style.backgroundColor, style.width, style.height];
      });
      const current = snapshot();
      const sheets = [...document.styleSheets].filter(sheet => /\/(appearance|readability)\.css/.test(sheet.href || ''));
      sheets.forEach(sheet => { sheet.disabled = true; }); const original = snapshot(); sheets.forEach(sheet => { sheet.disabled = false; });
      return { current, original };
    });
    assert.deepEqual(baseline.current, baseline.original);
    report.checks.push('Classico: font, colori e misure di titoli, categorie, icone, textarea e invio confrontati con il CSS originale.');
    await open(page);
    assert.equal(await page.locator('#aspetto-movimenti').isChecked(), true);
    for (let i = 0; i < 35; i++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), true); }
    await close(page); assert.equal(await page.evaluate(() => document.activeElement.id), 'aspetto');
    report.checks.push('Tastiera: Tab contenuto nel dialog, Esc e ritorno del focus; movimento iniziale da sistema.');
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
      await page.setViewportSize(viewport);
      for (const maximum of [false, true]) {
        for (const [theme] of model.themes) {
          await open(page); await dimensions(page, maximum);
          await page.locator(`#temi input[value="${theme}"]`).check(); await saved(page);
          const name = `${viewport.width}-${theme}-${maximum ? '150' : '100'}`;
          await noOverflow(page, name + '-dialog');
          if ((viewport.width === 1440 && !maximum) || (viewport.width === 390 && maximum)) await accessibility(page, name + '-dialog');
          if (theme === 'classic' && viewport.width === 1440 && !maximum) await page.screenshot({ path: path.join(output, 'pannello-desktop.png') });
          if (theme === 'contrast' && viewport.width === 390 && maximum) {
            await page.locator('#aspetto-pannello').evaluate(dialog => { dialog.scrollTop = 0; });
            await page.screenshot({ path: path.join(output, 'pannello-mobile-150.png') });
          }
          await close(page); await noOverflow(page, name);
          assert.deepEqual(await page.locator('.tile b').allTextContents(), labels);
          assert.equal(await page.locator('#descrizione').inputValue(), description);
          assert.equal(await page.locator('#telefono').inputValue(), '0123 456');
          assert.equal(await page.locator('#reperibilita').inputValue(), 'Solo ambiente simulato');
          assert.equal(await page.locator('#cat-computer').isChecked(), true);
          assert.match(await page.locator('#lista-all').textContent(), /prova-locale.txt/);
          assert.equal(await page.locator('.ic svg').first().evaluate(svg => Math.round(svg.getBoundingClientRect().width)), maximum ? 69 : 46);
          if ((viewport.width === 1440 && !maximum) || (viewport.width === 390 && maximum)) await accessibility(page, name);
          if (viewport.width === 1440 && !maximum) await contrast(page, theme);
          if ((viewport.width === 1440 && !maximum) || (viewport.width === 390 && maximum)) {
            await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
          }
          report.matrix.push(name);
        }
      }
    }
    report.checks.push('48 combinazioni di tema, viewport e dimensioni; campi, categoria e allegato conservati.');
    await open(page); await page.locator('#temi input[value="cyber"]').check(); await saved(page); await close(page);
    await page.reload(); await page.locator('#aspetto').waitFor({ state: 'visible' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'cyber');
    const second = await browser.newContext(); const secondPage = await second.newPage();
    await secondPage.goto(url + '/auth/login'); await secondPage.locator('#aspetto').waitFor({ state: 'visible' });
    assert.equal(await secondPage.locator('html').getAttribute('data-theme'), 'cyber'); await second.close();
    report.checks.push('Persistenza dopo reload e accesso dello stesso account da un contesto browser distinto.');
    await open(page);
    await page.route('**/api/preferenze', async route => {
      if (route.request().method() === 'PUT') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ errore: 'Salvataggio non disponibile: riprova.' }) });
      return route.continue();
    });
    await page.locator('#temi input[value="mountain"]').check(); await page.locator('#aspetto-riprova').waitFor({ state: 'visible' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'mountain');
    await close(page); await page.locator('#aspetto-avviso').waitFor({ state: 'visible' }); await page.locator('#aspetto-rivedi').click();
    await page.unroute('**/api/preferenze'); await page.locator('#aspetto-riprova').click(); await saved(page);
    await page.locator('#aspetto-reset').click(); await saved(page);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'classic');
    assert.equal(await page.locator('#aspetto-testo').inputValue(), '100'); assert.equal(await page.locator('#aspetto-icone').inputValue(), '100');
    assert.equal(await page.locator('#aspetto-spazio').isChecked(), false);
    await close(page);
    report.checks.push('Errore salvataggio, anteprima utilizzabile, riprova e ripristino completo.');
    await page.locator('#slim-utente').click(); await page.locator('#profilo-aspetto').click(); await close(page);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'profilo-aspetto');
    await page.locator('#n-nuova').click(); await page.locator('#cat-computer').check();
    await page.locator('#descrizione').fill(description);
    await page.locator('#allegati').setInputFiles({ name: 'prova-locale.txt', mimeType: 'text/plain', buffer: Buffer.from('QA locale.') });
    await page.locator('#invia').click(); await page.locator('#conf-numero').waitFor({ state: 'visible' });
    const id = (await page.locator('#conf-numero').textContent()).replace(/\D/g, '');
    await page.goto(url + '/#richiesta/' + id); await page.locator('#msg').fill('Risposta di prova nel backend simulato.');
    await page.locator('#invia-msg').click(); await page.waitForFunction(() => document.getElementById('d-timeline').textContent.includes('Risposta di prova'));
    report.checks.push('Invio tramite UI con allegato e risposta nel backend GLPI mock.');
    for (const [theme] of model.themes) {
      await open(page); await dimensions(page, true); await page.locator(`#temi input[value="${theme}"]`).check(); await saved(page); await close(page);
      for (const hash of ['richieste', 'richiesta/' + id, 'faq', 'contatti', 'profilo']) {
        await page.goto(url + '/#' + hash);
        await page.locator('#v-' + (hash.startsWith('richiesta/') ? 'dettaglio' : hash)).waitFor({ state: 'visible' });
        await noOverflow(page, `${theme}-${hash}`);
        await accessibility(page, `${theme}-${hash}-150`);
      }
    }
    await open(page); await page.locator('#temi input[value="cyber"]').check(); await saved(page); await close(page);
    await page.locator('#esci').click(); await page.getByRole('link', { name: /Entra nella demo/ }).waitFor({ state: 'visible' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'classic');
    await context.setExtraHTTPHeaders({ 'x-qa-account': 'b' });
    await page.goto(url + '/auth/login'); await page.locator('#aspetto').waitFor({ state: 'visible' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'classic');
    await open(page); await page.locator('#temi input[value="hawaii"]').check(); await saved(page); await close(page);
    const a = await browser.newContext(); const aPage = await a.newPage(); await aPage.goto(url + '/auth/login');
    await aPage.locator('#aspetto').waitFor({ state: 'visible' }); assert.equal(await aPage.locator('html').getAttribute('data-theme'), 'cyber'); await a.close();
    report.checks.push('Logout e cambio account nello stesso browser; preferenze di A e B isolate.');
    assert.deepEqual(report.errors, []);
    // Colore arancio originale della categoria Posta: 4.26:1 sul bianco per
    // il piccolo comando SCEGLI. Conservato per rispettare il Classico approvato.
    const unexpected = report.accessibility.flatMap(result => result.violations.filter(violation =>
      !(result.context.includes('classic') && violation.id === 'color-contrast' && violation.nodes.every(node => node.target.every(target => target.includes('cat-posta') && target.includes('.go'))))));
    assert.deepEqual(unexpected, [], 'Nuove violazioni axe WCAG AA');
    console.log(JSON.stringify({ matrix: report.matrix.length, checks: report.checks, accessibility: report.accessibility.filter(r => r.violations.length) }, null, 2));
  } finally {
    fs.writeFileSync(path.join(output, 'qa-report.json'), JSON.stringify(report, null, 2));
    if (browser) await browser.close(); if (server) server.close();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
