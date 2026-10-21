// Rigenera le immagini dalla demo isolata, senza accesso a GLPI/OIDC o a un modello.
process.env.DEMO = '1';
process.env.BASE_PATH = '/assistenza';
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { chromium } = require('playwright');
const app = require('../src/server');
const out = path.join(__dirname, '../docs/img');
async function main() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const base = `http://127.0.0.1:${server.address().port}/assistenza/`;
    await page.goto(base + 'auth/login', { waitUntil: 'networkidle' });
    await page.locator('#v-nuova').waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(out, 'nuova-2026.png') });
    await page.goto(base + '?presentazione=richieste#richieste', { waitUntil: 'networkidle' });
    await page.locator('#v-richieste').waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(out, 'richieste-2026.png') });
    await page.goto(base + '?presentazione=servizi#link-utili', { waitUntil: 'networkidle' });
    await page.locator('#v-link-utili').waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(out, 'servizi-2026.png') });
    await page.goto(base + '?presentazione=assistente#nuova', { waitUntil: 'networkidle' });
    await page.locator('#mascotte-btn').click();
    await page.getByRole('button', { name: 'Aiutami a descrivere il problema' }).click();
    await page.getByText('Descrivi il problema che vuoi segnalare.', { exact: false }).waitFor();
    await page.screenshot({ path: path.join(out, 'assistente-2026.png') });
    await page.locator('#msc-chiudi').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '?presentazione=richieste#richieste', { waitUntil: 'networkidle' });
    await page.locator('#v-richieste').waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(out, 'mobile-2026.png') });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) errors.push('Overflow mobile');
    if (errors.length) throw new Error(errors.join('\n'));
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1000"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#06142d"/><stop offset="1" stop-color="#093b59"/></linearGradient></defs><rect width="1800" height="1000" rx="28" fill="url(#g)"/><circle cx="1500" cy="180" r="330" fill="#31b6ae" opacity=".08"/><circle cx="140" cy="970" r="400" fill="#35a0ff" opacity=".06"/><g font-family="sans-serif"><text x="86" y="100" fill="#70e6d0" font-size="23" letter-spacing="6">OPEN SOURCE · SELF HOSTED · GLPI</text><text x="80" y="202" fill="#fff" font-size="86" font-weight="700">Assistenza Portale</text><text x="85" y="263" fill="#bed2e1" font-size="31">Meno passaggi. Richieste chiare. Tutto sotto controllo.</text><rect x="85" y="312" width="580" height="46" rx="23" fill="#123f59"/><text x="111" y="343" fill="#e4f4ff" font-size="21">Ticket · Guide · Contatti · Assistente locale</text><rect x="80" y="402" width="1302" height="523" rx="18" fill="#ecf4fa"/><rect x="91" y="413" width="1280" height="27" rx="9" fill="#d6e2eb"/><circle cx="110" cy="426" r="4" fill="#ed7a7a"/><circle cx="125" cy="426" r="4" fill="#e8bc69"/><circle cx="140" cy="426" r="4" fill="#72bfaa"/><rect x="1430" y="365" width="296" height="604" rx="38" fill="#071121" stroke="#547487" stroke-width="3"/></g></svg>`);
    const desktop = await sharp(path.join(out, 'nuova-2026.png')).resize(1280, 475, { fit: 'cover', position: 'top' }).toBuffer();
    const mobile = await sharp(path.join(out, 'mobile-2026.png')).resize(268, 570, { fit: 'cover', position: 'top' }).toBuffer();
    await sharp(svg).composite([{ input: desktop, left: 91, top: 440 }, { input: mobile, left: 1444, top: 382 }]).png().toFile(path.join(out, 'banner-2026.png'));
    console.log('6 immagini generate dalla demo; zero errori JavaScript e nessun overflow mobile.');
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise(r => server.close(r));
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
