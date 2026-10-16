// Controllo minimo senza dipendenze: sintassi di tutti i file JavaScript e validita' dei file JSON.
// Uso: npm run lint
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const salta = new Set(['node_modules', '.git', 'screenshots', 'docs', 'data', '.cache', 'artifacts']);
const file = [];
(function giro(dir) {
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    if (salta.has(n.name)) continue;
    const p = path.join(dir, n.name);
    if (n.isDirectory()) giro(p);
    else if (/\.(js|json)$/.test(n.name) && n.name !== 'package-lock.json') file.push(p);
  }
})(root);

let errori = 0;
for (const f of file) {
  try {
    if (f.endsWith('.json')) JSON.parse(fs.readFileSync(f, 'utf8'));
    else execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    errori++;
    console.error('ERRORE in', path.relative(root, f), '\n', String(e.stderr || e.message).trim());
  }
}
for (const script of ['genera-temi.js', 'genera-leggibilita.js']) {
  try { execFileSync(process.execPath, [path.join(__dirname, script), '--verifica'], { stdio: 'pipe' }); }
  catch (e) { errori++; console.error(String(e.stdout || '') + String(e.stderr || e.message)); }
}
// Contenuto delle guide: id, campi obbligatori, immagini, collegamenti
const guide = require('./verifica-faq').verifica(root);
for (const e of guide.errori) { errori++; console.error('ERRORE guide:', e); }
console.log(`${file.length} file controllati, ${guide.guide} guide controllate, ${errori} errori`);
process.exit(errori ? 1 : 0);
