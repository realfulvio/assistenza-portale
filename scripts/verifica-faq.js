// Controllo dei contenuti delle guide (content/faq.json e content/suggerimenti.json).
// Uso: node scripts/verifica-faq.js            controlla e segnala gli errori
//      node scripts/verifica-faq.js --report   riscrive docs/faq-da-completare.md (immagini mancanti e verifiche)
// Lo usa anche npm run lint.
const fs = require('fs');
const path = require('path');

const ID_OK = /^[a-z0-9-]{1,60}$/;
const MAX_IMG_BYTES = 200 * 1024;

// Dimensioni di un'immagine WebP o PNG leggendo solo l'intestazione
function dimensioni(buf) {
  if (buf.length > 24 && buf.toString('latin1', 1, 4) === 'PNG') return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    const t = buf.toString('latin1', 12, 16);
    if (t === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    if (t === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (t === 'VP8L') { const b = buf.readUInt32LE(21); return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff) }; }
  }
  return null;
}

function verifica(root = path.join(__dirname, '..')) {
  const errori = [];
  const mancanti = []; // { guida, passo, testo }
  const verifiche = []; // { guida, testo }
  let voci = [];
  try { voci = JSON.parse(fs.readFileSync(path.join(root, 'content', 'faq.json'), 'utf8')); } catch (e) { errori.push('content/faq.json: ' + e.message); }
  if (!Array.isArray(voci)) { errori.push('content/faq.json deve essere un elenco'); voci = []; }

  const ids = new Set();
  const titoli = new Set();
  for (const [i, v] of voci.entries()) {
    const nome = (v && (v.id || v.d)) || '#' + (i + 1);
    const err = (m) => errori.push(`${nome}: ${m}`);
    if (!v || typeof v.d !== 'string' || !v.d.trim()) { err('manca il titolo "d"'); continue; }
    if (v.id !== undefined) {
      if (!ID_OK.test(v.id)) err('"id" non valido (solo minuscole, numeri e trattini)');
      else if (ids.has(v.id)) err('"id" duplicato');
      ids.add(v.id);
    }
    if (titoli.has(v.d.trim().toLowerCase())) err('titolo duplicato');
    titoli.add(v.d.trim().toLowerCase());
    const strutturata = Array.isArray(v.passi) && v.passi.length > 0;
    if (!strutturata && !(typeof v.r === 'string' && v.r.trim())) err('serve "passi" oppure "r"');
    if (strutturata) {
      for (const k of ['intro', 'ok', 'stop', 'richiesta']) if (typeof v[k] !== 'string' || !v[k].trim()) err(`manca "${k}"`);
      if (!v.cat) err('manca "cat"');
      v.passi.forEach((p, n) => {
        if (!p || typeof p.t !== 'string' || !p.t.trim()) { err(`passo ${n + 1} senza testo`); return; }
        if (p.mancante) mancanti.push({ guida: v.id || v.d, passo: n + 1, testo: String(p.mancante) });
        if (!p.img) return;
        const file = path.join(root, 'public', p.img);
        if (!/^img\/faq\/[A-Za-z0-9._-]+\.(webp|png|jpe?g)$/.test(p.img)) { err(`passo ${n + 1}: percorso immagine non valido`); return; }
        if (!fs.existsSync(file)) { err(`passo ${n + 1}: immagine mancante (${p.img})`); return; }
        if (!p.alt || !String(p.alt).trim()) err(`passo ${n + 1}: manca il testo alternativo "alt"`);
        const buf = fs.readFileSync(file);
        if (buf.length > MAX_IMG_BYTES) err(`passo ${n + 1}: immagine troppo pesante (${Math.round(buf.length / 1024)} KB, massimo ${MAX_IMG_BYTES / 1024})`);
        const d = dimensioni(buf);
        if (!d) err(`passo ${n + 1}: formato immagine non riconosciuto`);
        else if (p.w !== d.w || p.h !== d.h) err(`passo ${n + 1}: "w" e "h" devono essere ${d.w} e ${d.h}`);
      });
    }
    if (v.verifica) verifiche.push({ guida: v.id || v.d, testo: String(v.verifica) });
  }
  for (const v of voci) for (const x of (v && v.vedi) || []) if (!ids.has(x)) errori.push(`${v.id || v.d}: "vedi" punta a una guida che non esiste (${x})`);

  try {
    const sug = JSON.parse(fs.readFileSync(path.join(root, 'content', 'suggerimenti.json'), 'utf8'));
    for (const [i, s] of sug.entries()) {
      if (s.guida && !ids.has(s.guida)) errori.push(`suggerimenti.json voce ${i + 1}: la guida "${s.guida}" non esiste`);
      if (!s.guida && !(s.titolo && s.passi)) errori.push(`suggerimenti.json voce ${i + 1}: serve "guida" oppure "titolo" e "passi"`);
      if (!Array.isArray(s.parole) || !s.parole.length) errori.push(`suggerimenti.json voce ${i + 1}: mancano le "parole"`);
    }
  } catch (e) { if (e.code !== 'ENOENT') errori.push('content/suggerimenti.json: ' + e.message); }

  return { errori, mancanti, verifiche, guide: voci.length };
}

function rapporto(r) {
  const righe = ['# Guide: immagini da acquisire e punti da verificare', '',
    'File generato da `node scripts/verifica-faq.js --report` a partire da `content/faq.json` (campi `mancante` dei passi e `verifica` delle guide). Non modificarlo a mano.', '',
    '## Immagini mancanti', ''];
  if (!r.mancanti.length) righe.push('Nessuna.');
  for (const m of r.mancanti) righe.push(`- **${m.guida}**, passo ${m.passo}: ${m.testo}`);
  righe.push('', '## Verifiche da fare prima della pubblicazione', '');
  if (!r.verifiche.length) righe.push('Nessuna.');
  for (const v of r.verifiche) righe.push(`- **${v.guida}**: ${v.testo}`);
  return righe.join('\n') + '\n';
}

module.exports = { verifica, dimensioni, rapporto };

if (require.main === module) {
  const r = verifica();
  if (process.argv.includes('--report')) {
    fs.writeFileSync(path.join(__dirname, '..', 'docs', 'faq-da-completare.md'), rapporto(r));
    console.log('docs/faq-da-completare.md aggiornato');
  }
  for (const e of r.errori) console.error('ERRORE', e);
  console.log(`${r.guide} guide controllate, ${r.errori.length} errori, ${r.mancanti.length} immagini mancanti, ${r.verifiche.length} verifiche aperte`);
  process.exit(r.errori.length ? 1 : 0);
}
