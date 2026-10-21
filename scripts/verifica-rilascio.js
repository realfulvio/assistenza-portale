// Controlla i file effettivamente serviti (anche dopo un porting), senza login né scritture.
const stili = ['theme.css', 'ente.css', 'style.css', 'readability.css', 'appearance.css', 'stats-bar.css', 'avatar.css', 'temi.css', 'mascotte.css', 'remota.css', 'link-utili.css', 'assistente-link.css'];
const script = ['appearance-model.js', 'temi.js', 'appearance.js', 'faq.js', 'numeri-interni.js', 'app.js', 'stats-bar.js', 'avatar.js', 'numeri-interni.js', 'mascotte.js', 'risorse-hover.js', 'link-utili.js'];
function risorse(html, tag, attribute) {
  return [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(new RegExp('<' + tag + '\\b[^>]*>', 'gi'))].flatMap(([markup]) => {
    if (tag === 'link' && !/\brel\s*=\s*["']stylesheet["']/i.test(markup)) return [];
    const value = new RegExp('\\b' + attribute + '\\s*=\\s*(["\'])(.*?)\\1', 'i').exec(markup);
    return value ? [{ tipo: tag === 'link' ? 'css' : 'js', url: value[2].replace(/&amp;/g, '&') }] : [];
  });
}
function verificaHtml(html) {
  const errori = [];
  if (/__(?:BASE|V|VERSIONE|DATA_VERSIONE|APPEARANCE|NOVITA|LINK_UTILI)__|\{\{[\w.]+\}\}/.test(html)) errori.push('Segnaposto non sostituiti nella pagina servita.');
  const assets = [...risorse(html, 'link', 'href'), ...risorse(html, 'script', 'src')];
  for (const [tipo, richiesti] of [['css', stili], ['js', script]]) {
    const nomi = assets.filter(a => a.tipo === tipo).map(a => a.url.split('?')[0].split('/').pop());
    for (const nome of richiesti) if (!nomi.includes(nome)) errori.push('Risorsa non collegata: ' + nome);
    if (tipo === 'css' && nomi.indexOf('theme.css') > nomi.indexOf('style.css')) errori.push('theme.css deve precedere style.css.');
    if (tipo === 'js' && nomi.indexOf('appearance-model.js') > nomi.indexOf('appearance.js')) errori.push('appearance-model.js deve precedere appearance.js.');
  }
  return { errori, assets };
}
async function verificaUrl(url) {
  const fetchText = async target => {
    const r = await fetch(target, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return { text: await r.text(), type: r.headers.get('content-type') || '', url: r.url };
  };
  const pagina = await fetchText(url);
  const result = verificaHtml(pagina.text);
  if (!/^text\/html\b/.test(pagina.type)) result.errori.push('La pagina non è HTML.');
  const origin = new URL(pagina.url).origin;
  for (const asset of result.assets) {
    const target = new URL(asset.url, pagina.url);
    if (target.origin !== origin) { result.errori.push('Risorsa esterna non prevista: ' + target.pathname); continue; }
    try {
      const r = await fetchText(target);
      if (!(asset.tipo === 'css' ? /^text\/css\b/ : /^(?:text|application)\/javascript\b/).test(r.type)) throw new Error('Content-Type errato');
      if (!r.text.trim() || /^\s*<!doctype html/i.test(r.text)) throw new Error('Contenuto vuoto o pagina HTML al posto della risorsa');
      if (target.pathname.endsWith('/theme.css') && !/--card\s*:/.test(r.text)) throw new Error('Variabili dei temi assenti');
    } catch (e) { result.errori.push(target.pathname + ': ' + e.message); }
  }
  return result;
}
async function main(args) {
  if (args.length !== 1 || !/^https?:\/\//.test(args[0])) throw new Error('Uso: npm run verifica:rilascio -- http://127.0.0.1:3000/assistenza/');
  const result = await verificaUrl(args[0]);
  if (result.errori.length) throw new Error(result.errori.join('\n'));
  console.log('Rilascio verificato: HTML finale, ' + result.assets.length + ' CSS/script collegati e serviti con il tipo corretto.');
  console.log('Completare con la verifica visiva e la prova di accesso/GLPI sul sistema di destinazione.');
}
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { verificaHtml, verificaUrl, stili, script };
