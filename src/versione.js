// VERSION e CHANGELOG sono le uniche fonti per versione e novita mostrate nel portale.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const testo = s => s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`]/g, '').trim();
const confronta = (a, b) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};
function dataBreve(data) {
  const [anno, mese, giorno] = data.split('-').map(Number);
  return `${giorno} ${MESI[mese - 1]} ${anno}`;
}
function estrai(registro, numero) {
  const rilasci = [];
  for (const sezione of registro.split(/^## /m).slice(1)) {
    const intestazione = /^\[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})\s*\r?\n/.exec(sezione);
    if (!intestazione || confronta(intestazione[1], numero) > 0) continue;
    const corpo = sezione.slice(intestazione[0].length);
    // Espone solo il riepilogo destinato ai dipendenti, mai le note operative.
    const pubblico = /^### Novità per gli utenti\s*\r?\n([\s\S]*?)(?=^### |$(?![\s\S]))/m.exec(corpo);
    const righe = pubblico ? pubblico[1].split(/\r?\n/).filter(r => /^- /.test(r)).map(r => testo(r.slice(2))) : [];
    if (!righe.length) continue;
    rilasci.push({ numero: intestazione[1], data: intestazione[2], dataBreve: dataBreve(intestazione[2]), righe: righe.slice(0, 10) });
  }
  return rilasci.sort((a, b) => confronta(b.numero, a.numero)).slice(0, 5);
}
let cache;
function leggi() {
  const versionePath = path.join(root, 'VERSION'), registroPath = path.join(root, 'CHANGELOG.md');
  const vs = fs.statSync(versionePath);
  let cs;
  try { cs = fs.statSync(registroPath); } catch { /* registro facoltativo */ }
  const firma = `${vs.mtimeMs}:${vs.ctimeMs}:${vs.size}:${cs?.mtimeMs}:${cs?.ctimeMs}:${cs?.size}`;
  if (cache?.firma === firma) return cache;
  const numero = fs.readFileSync(versionePath, 'utf8').trim();
  if (!/^\d+\.\d+\.\d+$/.test(numero)) throw new Error('VERSION non valido');
  const registro = cs ? fs.readFileSync(registroPath, 'utf8') : '';
  const rilasci = estrai(registro, numero);
  const voce = new RegExp('^## \\[' + numero.replace(/\./g, '\\.') + '\\] - (\\d{4}-\\d{2}-\\d{2})', 'm').exec(registro);
  cache = { firma, numero, dataBreve: voce ? dataBreve(voce[1]) : '', rilasci };
  return cache;
}
function htmlNovita(info = leggi()) {
  if (!info.rilasci.length) return '<p class="nv-vuoto">Nessuna novità disponibile.</p>';
  return info.rilasci.map((r, i) => `<details class="nv-release"${i === 0 ? ' open' : ''}><summary><strong>v${esc(r.numero)}</strong><time datetime="${esc(r.data)}">${esc(r.dataBreve)}</time></summary><ul>${r.righe.map(t => `<li>${esc(t)}</li>`).join('')}</ul></details>`).join('\n');
}
module.exports = { leggi, estrai, htmlNovita, get numero() { return leggi().numero; }, get dataBreve() { return leggi().dataBreve; } };
