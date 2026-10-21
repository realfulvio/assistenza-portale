// Mantiene le misure originali a 100%, scalando anche i testi espressi in px.
// Rieseguire quando style.css cambia: node scripts/genera-leggibilita.js
const fs = require('fs');
const path = require('path');
const directory = path.join(__dirname, '..', 'public');
const css = fs.readFileSync(path.join(directory, 'style.css'), 'utf8');
// Conserva i contesti @media e l'ordine della cascata; esclude @font-face e animazioni.
function extract(source) {
  let result = '', cursor = 0;
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
  while (cursor < clean.length) {
    const start = clean.indexOf('{', cursor); if (start < 0) break;
    let end = start + 1, depth = 1;
    while (end < clean.length && depth) { if (clean[end] === '{') depth++; if (clean[end] === '}') depth--; end++; }
    const selector = clean.slice(cursor, start).trim(), body = clean.slice(start + 1, end - 1);
    if (selector.startsWith('@media')) { const inner = extract(body); if (inner) result += selector + '{\n' + inner + '}\n'; }
    else if (!selector.startsWith('@')) {
      const sizes = [...body.matchAll(/(?:^|;)\s*font(?:-size)?\s*:\s*(?:[^;{}]*?\s)?(\d+(?:\.\d+)?)px/g)];
      if (sizes.length) result += selector + '{font-size:calc(' + sizes.at(-1)[1] + 'px * var(--text-scale,1))}\n';
    }
    cursor = end;
  }
  return result;
}
const generated = '/* Generato da scripts/genera-leggibilita.js; non modificare a mano. */\n' + extract(css);
const target = path.join(directory, 'readability.css');
if (process.argv.includes('--verifica')) {
  if (fs.readFileSync(target, 'utf8') !== generated) { console.error('readability.css non aggiornato: eseguire node scripts/genera-leggibilita.js'); process.exitCode = 1; }
} else fs.writeFileSync(target, generated);
