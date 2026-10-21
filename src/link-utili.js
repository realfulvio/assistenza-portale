const fs = require('node:fs');
const path = require('node:path');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icone = {
  libro: '<path d="M12 6c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v15"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2m-8 3h2"/>',
  mondo: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  posta: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/>',
  schermo: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4m-5 0h10"/>',
  applicazioni: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17h7m-3.5-3.5v7"/>',
  pagamenti: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  mappa: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/>'
};
function indirizzo(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('link-utili: URL non valido'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('link-utili: usare URL HTTP(S) senza credenziali');
  return esc(url.href);
}
function html(root) {
  const locale = path.join(root, 'config/link-utili.json');
  const file = fs.existsSync(locale) ? locale : path.join(root, 'config/link-utili.example.json');
  const dati = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(dati)) throw new Error('link-utili: serve un elenco JSON');
  return [...dati].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it', { sensitivity: 'base' })).map((voce, i) => {
    if (voce.risorse !== undefined && !Array.isArray(voce.risorse)) throw new Error('link-utili: risorse deve essere un elenco');
    const risorse = voce.risorse || [];
    if (!voce.url && !risorse.length) throw new Error('link-utili: serve un URL o almeno una risorsa');
    const id = `link-risorse-${i}`;
    const icona = Object.hasOwn(icone, voce.icona) ? icone[voce.icona] : icone.applicazioni;
    const mark = `<span class="useful-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icona}</svg></span>`;
    const label = `<span class="useful-label"><strong>${esc(voce.nome)}</strong><small>${esc(voce.descrizione)}</small>${risorse.length ? '<span class="resource-cue">Risorse <span aria-hidden="true">⌄</span></span>' : ''}</span>`;
    const primary = voce.url
      ? `<a class="useful-link" href="${indirizzo(voce.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(voce.nome)} (si apre in una nuova scheda)">${mark}${label}<span class="useful-arrow" aria-hidden="true">↗</span></a>`
      : `<button class="useful-link" type="button" aria-expanded="false" aria-controls="${id}">${mark}${label}</button>`;
    const drawer = risorse.length ? `<div class="resources-drawer" id="${id}"><div class="useful-resources"><span class="useful-resources-label">Risorse</span>${risorse.map(r => `<a class="useful-resource" href="${indirizzo(r.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(r.nome)} (si apre in una nuova scheda)"><span>${esc(r.nome)}</span><span class="useful-resource-arrow" aria-hidden="true">↗</span></a>`).join('')}</div></div>` : '';
    return `<li class="useful-item${risorse.length ? ' has-resources' : ''}" data-order="${i}" data-brand="#005e8e">${primary}${drawer}</li>`;
  }).join('\n');
}
module.exports = { html };
