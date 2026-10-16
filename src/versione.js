// Versione del portale: unica fonte il file VERSION nella radice; la data viene dalla voce corrispondente del CHANGELOG.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

const numero = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
if (!/^\d+\.\d+\.\d+$/.test(numero)) throw new Error('VERSION non valido: ' + numero);
let data = '';
try {
  const voce = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8').match(new RegExp('^## \\[' + numero.replace(/\./g, '\\.') + '\\] - (\\d{4})-(\\d{2})-(\\d{2})', 'm'));
  if (voce) data = `${Number(voce[3])} ${MESI[Number(voce[2]) - 1]} ${voce[1]}`;
} catch { /* nessun CHANGELOG: solo il numero */ }

module.exports = { numero, dataBreve: data };
