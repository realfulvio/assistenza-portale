// Elenco dei numeri interni dell'ente: file locale non versionato (content/numeri-interni.json o NUMERI_INTERNI_FILE).
// File assente o illeggibile: elenco vuoto e la sezione non compare. Solo in DEMO, al suo posto, il file di esempio.
const fs = require('fs');
const { normalizza } = require('../public/numeri-interni');

const leggi = (file) => normalizza(JSON.parse(fs.readFileSync(file, 'utf8')));

function carica({ file, esempio, demo }) {
  try { return leggi(file); } catch { /* assente o non valido */ }
  if (demo) { try { return leggi(esempio); } catch { /* esempio non valido */ } }
  return { aggiornato: '', sezioni: [] };
}

module.exports = { carica };
