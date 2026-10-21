// Barriera di qualità di un'installazione (locale, sviluppo, copia di staging o produzione), guardando ciò che il server serve davvero.
//   node scripts/verifica-deploy.js http://127.0.0.1:3000/assistenza/                       controlli pubblici (anche in produzione)
//   node scripts/verifica-deploy.js URL --accesso-demo --screenshot verifica-v2/staging      con l'accesso di prova (DEMO o staging)
// Controlla: HTML finale e segnaposto, ogni CSS/JS collegato (200 e tipo giusto), variabili dei temi definite e sfondo non trasparente
// per ogni tema, nessun errore in console né richieste fallite o esterne, accesso servito. Con --accesso-demo anche le pagine
// Nuova richiesta, Dettaglio, Riepilogo/Stampa, PDF e Profilo, e gli screenshot dei temi su desktop (1440x900) e telefono (390x844).
// Non invia richieste di assistenza e non scrive dati, salvo la preferenza del tema dell'utente di prova (ripristinata alla fine).
// Opzioni: --temi classic,spazio,...  --chromium /percorso/chrome (o CHROMIUM_PATH)  --browser chrome|msedge  --timeout 20000
const fs = require('fs');
const path = require('path');
const { verificaUrl } = require('./verifica-rilascio');

const TEMI = ['classic', 'spazio', 'giardino', 'autunno'];
const VARIABILI = ['--primary', '--bg', '--card', '--text', '--muted', '--line', '--accent', '--top', '--head', '--bar', '--foot', '--hero', '--herotext', '--soft', '--dk'];
const VISTE = { desktop: { width: 1440, height: 900 }, telefono: { width: 390, height: 844 } };

function opzioni(argv) {
  const o = { url: null, demo: false, dir: null, temi: TEMI, chromium: process.env.CHROMIUM_PATH || '', browser: '', timeout: 20000 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--accesso-demo') o.demo = true;
    else if (a === '--screenshot') o.dir = argv[++i];
    else if (a === '--temi') o.temi = argv[++i].split(',').filter(Boolean);
    else if (a === '--chromium') o.chromium = argv[++i];
    else if (a === '--browser') o.browser = argv[++i];
    else if (a === '--timeout') o.timeout = Number(argv[++i]);
    else if (/^https?:\/\//.test(a)) o.url = a;
    else throw new Error('Opzione sconosciuta: ' + a);
  }
  if (!o.url) throw new Error('Uso: node scripts/verifica-deploy.js http://host:porta/assistenza/ [--accesso-demo] [--screenshot DIR] [--temi a,b]');
  if (!o.url.endsWith('/')) o.url += '/';
  return o;
}

async function verifica(o) {
  const { chromium } = require('playwright');
  const errori = [];
  const esiti = [];
  const ok = (m) => { esiti.push(m); console.log('  ok ', m); };
  const ko = (m) => { errori.push(m); console.log('  ERRORE', m); };
  if (o.dir) fs.mkdirSync(o.dir, { recursive: true });

  console.log('1. HTML finale e risorse collegate:', o.url);
  const http = await verificaUrl(o.url).catch((e) => ({ errori: ['Pagina non raggiungibile: ' + e.message], assets: [] }));
  http.errori.forEach(ko);
  if (!http.errori.length) ok(`HTML senza segnaposto, ${http.assets.length} CSS/JS collegati, tutti 200 con il tipo giusto`);

  // Accesso servito: /auth/login deve rimandare al fornitore d'identità (o, in demo, alla pagina del portale)
  try {
    const r = await fetch(new URL('auth/login', o.url), { redirect: 'manual', signal: AbortSignal.timeout(o.timeout) });
    const dove = r.headers.get('location') || '';
    if ([302, 303].includes(r.status) && dove) ok(`accesso servito: /auth/login → ${r.status} verso ${new URL(dove, o.url).origin}`);
    else ko(`/auth/login risponde ${r.status} senza rinvio all'accesso`);
  } catch (e) { ko('/auth/login non raggiungibile: ' + e.message); }

  const browser = await chromium.launch({ headless: true, ...(o.chromium ? { executablePath: o.chromium } : {}), ...(o.browser ? { channel: o.browser } : {}) });
  const origine = new URL(o.url).origin;
  const problemi = [];
  const contesto = await browser.newContext({ viewport: VISTE.desktop, reducedMotion: 'reduce', acceptDownloads: true });
  contesto.setDefaultTimeout(o.timeout);
  const page = await contesto.newPage();
  // «Failed to load resource» non dice quale risorsa: le risposte HTTP sono controllate sotto, con il percorso
  page.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) problemi.push('console: ' + m.text()); });
  page.on('pageerror', (e) => problemi.push('errore JavaScript: ' + e.message));
  page.on('requestfailed', (r) => { if (!/net::ERR_ABORTED/.test(r.failure()?.errorText || '')) problemi.push(`richiesta fallita: ${new URL(r.url()).pathname} (${r.failure()?.errorText})`); });
  page.on('request', (r) => { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol) && u.origin !== origine) problemi.push('richiesta esterna: ' + u.origin + u.pathname); });
  page.on('response', (r) => { if (r.status() >= 400 && !/\/api\/(me|profilo\/foto)(\?|$)/.test(r.url())) problemi.push(`HTTP ${r.status()}: ${new URL(r.url()).pathname}`); });

  const leggiTema = () => page.evaluate((vars) => {
    const st = getComputedStyle(document.documentElement);
    const valori = Object.fromEntries(vars.map((v) => [v, st.getPropertyValue(v).trim()]));
    return { valori, sfondo: getComputedStyle(document.body).backgroundColor, tema: document.documentElement.dataset.theme };
  }, VARIABILI);
  const controllaTema = async (id, dove) => {
    const t = await leggiTema();
    const mancanti = Object.entries(t.valori).filter(([, v]) => !v).map(([k]) => k);
    if (t.tema !== id) ko(`${dove}: tema attivo ${t.tema}, atteso ${id}`);
    if (mancanti.length) ko(`${dove}, tema ${id}: variabili non definite ${mancanti.join(' ')}`);
    if (/rgba\(0, 0, 0, 0\)|transparent/.test(t.sfondo)) ko(`${dove}, tema ${id}: sfondo della pagina trasparente`);
    if (!mancanti.length && t.tema === id && !/rgba\(0, 0, 0, 0\)/.test(t.sfondo)) ok(`${dove}, tema ${id}: ${VARIABILI.length} variabili definite (--primary ${t.valori['--primary']}, --card ${t.valori['--card']}), sfondo ${t.sfondo}`);
  };
  const foto = async (nome) => { if (o.dir) await page.screenshot({ path: path.join(o.dir, nome + '.png'), fullPage: true }); };

  try {
    console.log('2. Pagina di accesso e temi senza login');
    await page.goto(o.url, { waitUntil: 'networkidle' });
    if (await page.locator('#schermata').isVisible() && await page.locator('#schermata-azioni a').count()) ok('pagina di accesso mostrata con il pulsante di accesso');
    else if (!o.demo) ko('pagina di accesso non mostrata');
    for (const id of o.temi) {
      await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, id);
      await controllaTema(id, 'accesso');
    }
    await page.evaluate(() => { document.documentElement.dataset.theme = 'classic'; });
    await foto('accesso-desktop');

    if (o.demo) {
      console.log('3. Pagine con l\'accesso di prova');
      await page.goto(new URL('auth/login', o.url).href, { waitUntil: 'networkidle' });
      await page.locator('#aspetto').waitFor();
      const temaIniziale = await page.locator('html').getAttribute('data-theme');
      const richieste = await page.evaluate(async (base) => (await fetch(base + 'api/richieste', { credentials: 'same-origin' })).json(), o.url);
      const id = Array.isArray(richieste) && richieste.length ? richieste[0].id : null;
      if (!id) ko('nessuna richiesta disponibile per il dettaglio');
      const vai = async (hash, attesa) => { await page.goto(o.url + '#' + hash); await page.locator(attesa).first().waitFor(); };
      const scegliTema = async (t) => {
        await page.locator('#aspetto').click(); await page.locator('#aspetto-pannello').waitFor();
        const b = page.locator(`[data-tema="${t}"]`);
        await b.evaluate((e) => { const d = e.closest('details'); if (d) d.open = true; });
        await b.click();
        await page.waitForFunction(() => /salvate sul tuo account/.test(document.getElementById('aspetto-stato').textContent));
        await page.keyboard.press('Escape'); await page.locator('#aspetto-pannello').waitFor({ state: 'hidden' });
      };
      for (const t of o.temi) {
        await vai('nuova', '#tiles .tile');
        await scegliTema(t);
        await controllaTema(t, 'nuova richiesta');
        for (const [vista, dim] of Object.entries(VISTE)) {
          await page.setViewportSize(dim);
          await vai('nuova', '#tiles .tile');
          await page.locator('#tiles .tile').first().click();
          await page.locator('#descrizione').fill('Prova di verifica: il computer non si accende da stamattina.');
          await page.locator('#rep-dalle').fill('09:00'); await page.locator('#rep-alle').fill('12:00');
          const largo = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
          if (largo) ko(`nuova richiesta, ${t}, ${vista}: scorrimento orizzontale`);
          await foto(`${t}-${vista}-nuova`);
          if (id) {
            await vai('richiesta/' + id, '#d-thread .bubble');
            if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) ko(`dettaglio, ${t}, ${vista}: scorrimento orizzontale`);
            await foto(`${t}-${vista}-dettaglio`);
          }
          await vai('richieste', '#righe .lrow');
          await foto(`${t}-${vista}-richieste`);
        }
        await page.setViewportSize(VISTE.desktop);
      }
      ok(`pagine Nuova richiesta, Dettaglio e Le mie richieste caricate con ${o.temi.length} temi su desktop e telefono`);
      if (id) {
        await vai('richiesta/' + id, '#d-thread .bubble');
        await page.emulateMedia({ media: 'print' });
        if (await page.locator('#stampa .pr-tab').isVisible()) ok('riepilogo di stampa A4 visibile in modalità stampa'); else ko('riepilogo di stampa non visibile');
        if (o.dir) await page.pdf({ path: path.join(o.dir, 'stampa.pdf'), format: 'A4' }).catch(() => {});
        await page.emulateMedia({ media: 'screen' });
        const scarico = page.waitForEvent('download');
        await page.locator('#d-pdf').click();
        const d = await scarico;
        const file = await d.path();
        const inizio = fs.readFileSync(file).subarray(0, 5).toString();
        if (inizio === '%PDF-') ok(`PDF scaricato: ${d.suggestedFilename()}`); else ko('PDF non valido');
        if (o.dir) await d.saveAs(path.join(o.dir, d.suggestedFilename()));
      }
      // Blocco esito originale su una richiesta risolta in attesa di conferma (solo lettura: nessun clic)
      const risolta = Array.isArray(richieste) && richieste.find((r) => r.stato === 'Risolta');
      if (risolta) {
        await vai('richiesta/' + risolta.id, '#d-thread .bubble');
        const testo = (await page.locator('#esito').isVisible()) ? await page.locator('#esito').innerText() : '';
        if (/La richiesta risulta risolta\. È tutto a posto\?/.test(testo) && /Risolto, grazie/.test(testo) && /Non è risolto, riapri/.test(testo)) ok('blocco esito «La richiesta risulta risolta. È tutto a posto?» con «Risolto, grazie» / «Non è risolto, riapri»');
        else ko('blocco esito della richiesta risolta assente o con testi diversi');
        await foto('esito-desktop');
      }
      await vai('profilo', '#pf-chip');
      ok('pagina Profilo caricata');
      await foto('profilo-desktop');
      if (temaIniziale && temaIniziale !== o.temi.at(-1)) await scegliTema(temaIniziale);
    }
  } catch (e) {
    ko('verifica interrotta: ' + e.message.split('\n')[0]);
  } finally {
    await browser.close();
  }
  const unici = [...new Set(problemi)];
  if (unici.length) unici.forEach(ko); else ok('nessun errore in console, nessuna richiesta fallita o verso domini esterni');
  const rapporto = { url: o.url, data: new Date().toISOString(), accessoDemo: o.demo, temi: o.temi, esiti, errori };
  if (o.dir) fs.writeFileSync(path.join(o.dir, 'verifica-deploy.json'), JSON.stringify(rapporto, null, 2));
  return rapporto;
}

if (require.main === module) {
  (async () => {
    const o = opzioni(process.argv.slice(2));
    const r = await verifica(o);
    console.log(r.errori.length ? `\nVERIFICA FALLITA: ${r.errori.length} problemi.` : `\nVerifica superata: ${r.esiti.length} controlli.`);
    process.exitCode = r.errori.length ? 1 : 0;
  })().catch((e) => { console.error(e.message); process.exitCode = 2; });
}
module.exports = { verifica, opzioni, TEMI, VARIABILI };
