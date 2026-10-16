// Test della sezione Guide in un vero browser (Chrome/Chromium senza finestra, via puppeteer-core).
// Se il browser non si trova viene saltato; per indicare il percorso: CHROME_PATH=... npm test
process.env.DEMO = '1';
process.env.BASE_PATH = '/assistenza';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const app = require('../src/server');

const faqRaw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'faq.json'), 'utf8'));

function trovaChrome() {
  const c = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  return c.find((p) => p && fs.existsSync(p));
}
let puppeteer = null;
try { puppeteer = require('puppeteer-core'); } catch { /* non installato */ }
const chrome = trovaChrome();
const salta = !puppeteer || !chrome ? 'puppeteer-core o Chrome non disponibili' : false;

let server, url, browser;
test.before(async () => {
  await new Promise((ok) => { server = app.listen(0, '127.0.0.1', () => { url = `http://127.0.0.1:${server.address().port}/assistenza/`; ok(); }); });
  if (!salta) browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
});
test.after(async () => { if (browser) await browser.close(); server.close(); });

// Pagina nuova con utente di prova già collegato; raccoglie errori JavaScript e della console
async function pagina(hash = '', opz = {}) {
  const p = await browser.newPage();
  p.errori = [];
  p.on('pageerror', (e) => p.errori.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') p.errori.push('console: ' + m.text()); });
  p.on('requestfailed', (r) => p.errori.push('richiesta fallita: ' + r.url()));
  await p.setViewport(opz.viewport || { width: 1100, height: 900 });
  await p.goto(url + 'auth/login', { waitUntil: 'networkidle0' });
  if (opz.prima) await opz.prima(p);
  await p.goto(url + hash, { waitUntil: 'networkidle0' });
  return p;
}
const visibili = (p) => p.$$eval('#faq-lista details', (d) => d.filter((x) => !x.hidden).map((x) => x.id.slice(2)));
const aperte = (p) => p.$$eval('#faq-lista details[open]', (d) => d.map((x) => x.id.slice(2)));
const chiudi = (p) => p.close();

test('guide: si caricano tutte, senza errori JavaScript', { skip: salta, timeout: 60000 }, async () => {
  const p = await pagina('#faq');
  await p.waitForSelector('#faq-lista details');
  assert.equal((await visibili(p)).length, faqRaw.length);
  assert.equal(await p.$eval('#faq-conta', (e) => e.textContent), `${faqRaw.length} guide`);
  assert.deepEqual(await aperte(p), []);
  assert.equal(await p.$eval('#n-faq', (e) => e.getAttribute('aria-current')), 'page');
  assert.deepEqual(p.errori, []);
  await chiudi(p);
});

test('guide: il resto del portale continua a funzionare', { skip: salta, timeout: 60000 }, async () => {
  const p = await pagina('#nuova');
  await p.waitForSelector('#tiles .card');
  assert.ok((await p.$$('#tiles .card')).length >= 5);
  await p.goto(url + '#richieste', { waitUntil: 'networkidle0' });
  await p.waitForSelector('#righe tr');
  assert.ok((await p.$$('#righe tr')).length >= 1);
  await p.goto(url + '#contatti', { waitUntil: 'networkidle0' });
  assert.equal(await p.$eval('#v-contatti', (e) => e.hidden), false);
  assert.deepEqual(p.errori, []);
  await chiudi(p);
});

test('ricerca istantanea: filtra, ordina per pertinenza, mostra "nessuna guida" e si azzera', { skip: salta, timeout: 60000 }, async () => {
  const p = await pagina('#faq');
  await p.waitForSelector('#faq-lista details');
  await p.type('#faq-cerca', 'stampante offline');
  const trovate = await visibili(p);
  assert.ok(trovate.includes('stampante-offline') && trovate.length < faqRaw.length);
  assert.equal(await p.$eval('#faq-lista details:not([hidden])', (e) => e.id), 'g-stampante-offline', 'la più pertinente è la prima');
  assert.match(await p.$eval('#faq-conta', (e) => e.textContent), /guid[ae] trovat[ae]/);
  await p.$eval('#faq-cerca', (e) => { e.value = ''; });
  await p.type('#faq-cerca', 'zzzqqq');
  assert.equal((await visibili(p)).length, 0);
  assert.equal(await p.$eval('#faq-vuoto', (e) => e.hidden), false);
  assert.equal(await p.$eval('#faq-vuoto a, #v-faq .send', (e) => e.getAttribute('href')), '#nuova');
  await p.$eval('#faq-cerca', (e) => { e.value = ''; });
  await p.type('#faq-cerca', 'è');  // accento: non deve causare errori
  await p.$eval('#faq-cerca', (e) => { e.value = ''; e.dispatchEvent(new Event('input')); });
  assert.equal((await visibili(p)).length, faqRaw.length);
  assert.equal(await p.$eval('#faq-vuoto', (e) => e.hidden), true);
  assert.deepEqual(p.errori, []);
  await chiudi(p);
});

test('filtri per argomento: un solo gruppo alla volta, combinabili con la ricerca', { skip: salta, timeout: 60000 }, async () => {
  const p = await pagina('#faq');
  await p.waitForSelector('.faq-chip');
  const chip = (nome) => p.evaluateHandle((n) => [...document.querySelectorAll('.faq-chip')].find((b) => b.textContent === n), nome);
  assert.equal(await p.$eval('.faq-chip.on', (e) => e.textContent), 'Tutte');
  await (await chip('Stampanti')).click();
  const st = await visibili(p);
  assert.ok(st.length >= 5 && st.every((id) => faqRaw.find((v) => v.id === id).cat === 'stampanti'));
  assert.equal(await p.$eval('.faq-chip.on', (e) => e.getAttribute('aria-pressed')), 'true');
  assert.equal((await p.$$('.faq-chip.on')).length, 1);
  await p.type('#faq-cerca', 'offline');
  assert.deepEqual(await visibili(p), ['stampante-offline']);
  await (await chip('Rete')).click();
  assert.equal((await visibili(p)).length, 0, 'ricerca e filtro insieme');
  await (await chip('Tutte')).click();
  assert.ok((await visibili(p)).includes('stampante-offline'));
  assert.deepEqual(p.errori, []);
  await chiudi(p);
});

test('guida con passi numerati e immagini: si apre, mostra tutti gli elementi e le immagini si caricano', { skip: salta, timeout: 60000 }, async () => {
  const p = await pagina('#faq');
  await p.waitForSelector('#g-pc-lento-bloccato');
  const g = faqRaw.find((v) => v.id === 'pc-lento-bloccato');
  await p.click('#g-pc-lento-bloccato summary');
  assert.deepEqual(await aperte(p), ['pc-lento-bloccato']);
  assert.equal(await p.$$eval('#g-pc-lento-bloccato .faq-passi ol > li', (l) => l.length), g.passi.length);
  for (const sel of ['.faq-controlli', '.faq-ok', '.faq-stop', '.faq-richiesta']) assert.ok(await p.$(`#g-pc-lento-bloccato ${sel}`), sel);
  assert.equal(await p.$eval('#g-pc-lento-bloccato .faq-richiesta a.send', (a) => a.getAttribute('href')), '#nuova');
  const img = await p.$$eval('#g-pc-lento-bloccato img', (i) => i.map((x) => ({ alt: x.alt, src: x.getAttribute('src') })));
  assert.equal(img.length, g.passi.filter((s) => s.img).length);
  assert.ok(img.every((x) => x.alt.length > 10 && x.src.includes('/img/faq/')));
  await p.$eval('#g-pc-lento-bloccato img', (i) => i.scrollIntoView());
  await p.waitForFunction(() => [...document.querySelectorAll('#g-pc-lento-bloccato img')].every((i) => i.complete && i.naturalWidth > 0), { timeout: 10000 });
  // l'indirizzo segue la guida aperta e torna a #faq quando si chiude
  await p.waitForFunction(() => location.hash === '#faq/pc-lento-bloccato');
  await p.click('#g-pc-lento-bloccato summary');
  await p.waitForFunction(() => location.hash === '#faq');
  assert.deepEqual(p.errori, []);
  await chiudi(p);
});

test('immagini ingrandibili: il dialog si apre con un clic, mostra l\'immagine e si chiude con Esc', { skip: salta, timeout: 60000 }, async () => {
  const p = await pagina('#faq/aprire-richiesta');
  await p.waitForSelector('#g-aprire-richiesta[open] .faq-img');
  const src = await p.$eval('#g-aprire-richiesta .faq-img img', (i) => i.src);
  await p.click('#g-aprire-richiesta .faq-img');
  assert.equal(await p.$eval('#faq-zoom', (d) => d.open), true);
  assert.equal(await p.$eval('#faq-zoom-img', (i) => i.src), src);
  assert.ok((await p.$eval('#faq-zoom-img', (i) => i.alt)).length > 10);
  await p.keyboard.press('Escape');
  assert.equal(await p.$eval('#faq-zoom', (d) => d.open), false);
  // anche con il pulsante «Chiudi»
  await p.click('#g-aprire-richiesta .faq-img');
  await p.click('#faq-zoom-chiudi');
  assert.equal(await p.$eval('#faq-zoom', (d) => d.open), false);
  assert.deepEqual(p.errori, []);
  await chiudi(p);
});

test('link diretti: la guida si apre, il filtro non la nasconde, gli altri link e gli id sconosciuti funzionano', { skip: salta, timeout: 60000 }, async () => {
  const p = await pagina('#faq/stampante-offline');
  await p.waitForSelector('#g-stampante-offline[open]');
  assert.deepEqual(await aperte(p), ['stampante-offline']);
  assert.equal(await p.evaluate(() => location.hash), '#faq/stampante-offline');
  // da una guida a quella collegata
  await p.click('#g-stampante-offline .faq-vedi a[href="#faq/coda-stampa"]');
  await p.waitForSelector('#g-coda-stampa[open]');
  assert.ok((await aperte(p)).includes('coda-stampa'));
  assert.equal(await p.evaluate(() => location.hash), '#faq/coda-stampa');
  // ricerca e filtro attivi: il link diretto li azzera
  await p.type('#faq-cerca', 'zzzqqq');
  await p.evaluate(() => { location.hash = '#faq/password-dimenticata'; });
  await p.waitForSelector('#g-password-dimenticata[open]');
  assert.equal(await p.$eval('#faq-cerca', (e) => e.value), '');
  assert.equal(await p.$eval('#g-password-dimenticata', (e) => e.hidden), false);
  // guida inesistente: avviso e nessuna guida nascosta
  await p.evaluate(() => { location.hash = '#faq/non-esiste'; });
  await p.waitForFunction(() => /non esiste/.test(document.getElementById('faq-conta').textContent));
  assert.equal((await visibili(p)).length, faqRaw.length);
  // il link «Link diretto» di ogni guida punta a se stessa
  assert.equal(await p.$eval('#g-internet .faq-link a', (a) => a.getAttribute('href')), '#faq/internet');
  assert.deepEqual(p.errori, []);
  await chiudi(p);
});

test('tastiera: Tab raggiunge le guide, Invio e Spazio le aprono, i controlli hanno un nome', { skip: salta, timeout: 60000 }, async () => {
  const p = await pagina('#faq');
  await p.waitForSelector('#faq-lista details');
  await p.focus('#faq-cerca');
  await p.keyboard.press('Tab');
  assert.ok(await p.evaluate(() => document.activeElement.classList.contains('faq-chip')));
  await p.keyboard.press('Space'); // attiva il filtro «Tutte» senza uscire dalla tastiera
  await p.focus('#g-nome-pc summary');
  await p.keyboard.press('Enter');
  assert.ok((await aperte(p)).includes('nome-pc'));
  await p.keyboard.press('Space');
  assert.ok(!(await aperte(p)).includes('nome-pc'));
  assert.equal(await p.$eval('label[for=faq-cerca]', (l) => l.textContent), 'Cerca nelle guide');
  assert.equal(await p.$eval('#faq-chips', (e) => e.getAttribute('role')), 'group');
  assert.equal(await p.$eval('#faq-conta', (e) => e.getAttribute('aria-live')), 'polite');
  // ogni immagine ha un pulsante raggiungibile con un testo per chi usa lo screen reader
  await p.click('#g-nome-pc summary');
  assert.match(await p.$eval('#g-nome-pc .faq-img', (b) => b.textContent), /Ingrandisci/);
  await p.focus('#g-nome-pc .faq-img');
  await p.keyboard.press('Enter');
  assert.equal(await p.$eval('#faq-zoom', (d) => d.open), true);
  await p.keyboard.press('Escape');
  assert.deepEqual(p.errori, []);
  await chiudi(p);
});

test('vecchio formato { d, r }: le guide semplici continuano a funzionare', { skip: salta, timeout: 60000 }, async () => {
  const vecchio = [{ d: 'Vecchia domanda', r: 'Vecchia risposta.' }, { d: 'Seconda domanda', r: 'Seconda risposta.' }];
  const p = await pagina('', {
    prima: async (pg) => {
      await pg.setRequestInterception(true);
      pg.on('request', (r) => (r.url().endsWith('/api/faq') ? r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(vecchio) }) : r.continue()));
    }
  });
  await p.goto(url + '#faq', { waitUntil: 'networkidle0' });
  await p.waitForSelector('#faq-lista details');
  assert.equal((await visibili(p)).length, 2);
  await p.click('#faq-lista details summary');
  assert.equal(await p.$eval('#faq-lista details[open] .faq-testo', (e) => e.textContent), 'Vecchia risposta.');
  assert.equal(await p.$$eval('#faq-lista details[open] ol', (o) => o.length), 0);
  await p.type('#faq-cerca', 'seconda');
  assert.equal((await visibili(p)).length, 1);
  assert.deepEqual(p.errori, []);
  await chiudi(p);
});

test('errore nel caricamento delle guide: messaggio chiaro, nessun errore non gestito', { skip: salta, timeout: 60000 }, async () => {
  const p = await pagina('', {
    prima: async (pg) => {
      await pg.setRequestInterception(true);
      pg.on('request', (r) => (r.url().endsWith('/api/faq') ? r.respond({ status: 500, contentType: 'application/json', body: '{"errore":"x"}' }) : r.continue()));
    }
  });
  await p.goto(url + '#faq', { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => !document.getElementById('faq-errore').hidden);
  assert.equal((await p.$$('#faq-lista details')).length, 0);
  assert.equal(await p.$eval('#v-faq a.send', (a) => a.getAttribute('href')), '#nuova');
  assert.equal(p.errori.filter((e) => e.startsWith('pageerror')).length, 0);
  await chiudi(p);
});

test('consigli del modulo: puntano alla guida giusta, con titolo e primi passi presi dalla guida', { skip: salta, timeout: 60000 }, async () => {
  const p = await pagina('#nuova');
  await p.waitForSelector('#tiles .card');
  await p.evaluate(() => document.querySelector('#tiles input[value=stampante]').click());
  await p.type('#descrizione', 'la stampante risulta offline e non stampa');
  await p.waitForSelector('#consigli:not([hidden]) .consiglio', { timeout: 6000 });
  const link = await p.$$eval('#consigli .consiglio a', (a) => a.map((x) => x.getAttribute('href')));
  assert.ok(link.length >= 1 && link.every((l) => /^#faq\/[a-z0-9-]+$/.test(l)), link.join());
  const ids = new Set(faqRaw.map((v) => v.id));
  assert.ok(link.every((l) => ids.has(l.slice(5))));
  const titolo = await p.$eval('#consigli .consiglio .tit', (e) => e.textContent);
  assert.ok(faqRaw.some((v) => v.d === titolo), titolo);
  assert.ok((await p.$$eval('#consigli .consiglio ol li', (l) => l.length)) >= 1);
  // il collegamento porta alla guida
  await p.click('#consigli .consiglio a');
  await p.waitForSelector('#v-faq:not([hidden]) details[open]');
  assert.equal(await p.evaluate(() => location.hash.slice(0, 5)), '#faq/');
  assert.deepEqual(p.errori, []);
  await chiudi(p);
});

test('mobile (375 px): nessuno scorrimento orizzontale, immagini e dialog entro lo schermo', { skip: salta, timeout: 60000 }, async () => {
  const p = await pagina('#faq', { viewport: { width: 375, height: 800, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } });
  await p.waitForSelector('#faq-lista details');
  const larghezze = () => p.evaluate(() => ({ doc: document.documentElement.scrollWidth, vista: window.innerWidth }));
  let l = await larghezze();
  assert.ok(l.doc <= l.vista, `elenco: ${l.doc} > ${l.vista}`);
  // la guida con più immagini e testo lungo
  await p.tap('#g-aprire-richiesta summary');
  await p.waitForSelector('#g-aprire-richiesta[open] img');
  await p.$$eval('#g-aprire-richiesta img', (i) => i.forEach((x) => { x.loading = 'eager'; }));
  await p.waitForFunction(() => [...document.querySelectorAll('#g-aprire-richiesta img')].every((i) => i.complete && i.naturalWidth > 0), { timeout: 10000 });
  l = await larghezze();
  assert.ok(l.doc <= l.vista, `guida aperta: ${l.doc} > ${l.vista}`);
  const fuori = await p.$$eval('#g-aprire-richiesta img', (i) => i.filter((x) => x.getBoundingClientRect().right > window.innerWidth).length);
  assert.equal(fuori, 0);
  // i filtri vanno a capo invece di allargare la pagina
  const chips = await p.$eval('#faq-chips', (e) => ({ w: e.scrollWidth, c: e.clientWidth }));
  assert.ok(chips.w <= chips.c + 1, 'i filtri non devono uscire dallo schermo');
  // area toccabile dei controlli principali
  const alt = await p.$$eval('.faq-chip, #faq-lista summary', (e) => Math.min(...e.filter((x) => x.offsetParent).map((x) => x.getBoundingClientRect().height)));
  assert.ok(alt >= 30, 'controlli troppo piccoli: ' + alt);
  // dialog entro lo schermo
  await p.tap('#g-aprire-richiesta .faq-img');
  const d = await p.$eval('#faq-zoom', (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: window.innerWidth, open: e.open }; });
  assert.equal(d.open, true);
  assert.ok(d.l >= 0 && d.r <= d.w, `dialog fuori schermo: ${d.l}-${d.r} su ${d.w}`);
  await p.keyboard.press('Escape');
  assert.deepEqual(p.errori, []);
  await chiudi(p);
});
