const fs = require('node:fs');
const path = require('node:path');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function html(root) {
  const locale = path.join(root, 'config/link-utili.json');
  const file = fs.existsSync(locale) ? locale : path.join(root, 'config/link-utili.example.json');
  const dati = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(dati)) throw new Error('link-utili: serve un elenco JSON');
  return dati.map((voce, i) => {
    let url;
    try { url = new URL(voce.url); } catch { throw new Error('link-utili: URL non valido'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('link-utili: usare URL HTTP(S) senza credenziali');
    return `<li class="useful-item" data-order="${i}" data-brand="#005e8e"><a class="useful-link" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer"><span class="useful-mark" aria-hidden="true">↗</span><span class="useful-label"><strong>${esc(voce.nome)}</strong><small>${esc(voce.descrizione)}</small></span><span class="useful-arrow" aria-hidden="true">↗</span></a></li>`;
  }).join('\n');
}
module.exports = { html };
