// Prepara content/numeri-interni.json da un foglio Excel salvato come CSV.
// Uso: node scripts/numeri-interni-da-csv.js elenco.csv [uscita.json]   (senza uscita: scrive sullo schermo)
//
// Il foglio ha due coppie di colonne per riga: nome e numero | (colonna vuota) | nome e numero.
// Una riga con solo la prima cella piena è il titolo di una sezione. Un nome che finisce con * indica un numero
// raggiungibile anche dagli utenti esterni. «Nome - ruolo» e «Nome (nota)» diventano nome e nota.
// I nomi tutti in maiuscolo passano a «Maiuscole Iniziali». Il risultato è una bozza: rileggilo e ritoccalo a mano
// (abbreviazioni, note dentro il nome, e il campo facoltativo "aggiornato": "AAAA-MM-GG" da aggiungere in cima).
const fs = require('fs');
const { normalizza } = require('../public/numeri-interni');

const SIGLE = new Set(['URP', 'IAL', 'CAS', 'PM', 'SS', 'ICT', 'WC']);
const PICCOLE = new Set(['di', 'del', 'della', 'dei', 'delle', 'e', 'a', 'al', 'in', 'per', 'da', 'con']);

// Legge il CSV (virgolette doppie, virgole e a capo dentro le virgolette)
function leggiCsv(testo) {
  const righe = []; let riga = [], cella = '', fra = false;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (fra) { if (c === '"') { if (testo[i + 1] === '"') { cella += '"'; i++; } else fra = false; } else cella += c; }
    else if (c === '"') fra = true;
    else if (c === ',') { riga.push(cella); cella = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && testo[i + 1] === '\n') i++; riga.push(cella); righe.push(riga); riga = []; cella = ''; }
    else cella += c;
  }
  if (cella || riga.length) { riga.push(cella); righe.push(riga); }
  return righe;
}

function maiuscoleIniziali(nome, primo) {
  if (/[a-zàèéìòù]/.test(nome)) return nome; // già scritto in modo misto: si lascia com'è
  return nome.toLowerCase().replace(/[^\s]+/g, (parola, pos) => {
    if (SIGLE.has(parola.toUpperCase().replace(/\./g, '')) && !/\./.test(parola)) return parola.toUpperCase();
    if (/^(\p{L}{1,2}\.){2,}\p{L}{0,2}\.?$/u.test(parola)) return parola.toUpperCase(); // P.M., VV.F.
    if (!(primo && pos === 0) && PICCOLE.has(parola)) return parola;
    return parola.replace(/(^|[\p{P}])(\p{L})/gu, (m, a, l) => a + l.toUpperCase());
  });
}

function voce(nomeGrezzo, numero) {
  let nome = nomeGrezzo.replace(/\s+/g, ' ').trim();
  const esterno = /\*$/.test(nome);
  nome = nome.replace(/\*$/, '').trim();
  let nota = '';
  const par = nome.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (par) { nome = par[1]; nota = par[2]; }
  const trattino = nome.split(' - ');
  if (trattino.length > 1) { nome = trattino[0]; nota = [trattino.slice(1).join(' - '), nota].filter(Boolean).join(', '); }
  const out = { nome: maiuscoleIniziali(nome, true), numero: numero.trim() };
  if (nota) out.nota = maiuscoleIniziali(nota, false);
  if (esterno) out.esterno = true;
  return out;
}

function daCsv(testo) {
  const sezioni = [];
  for (const r of leggiCsv(testo)) {
    const c = [0, 1, 2, 3, 4].map((i) => (r[i] ?? '').trim());
    if (!c.some(Boolean)) continue;
    if (c[0] && !c[1] && !c[3] && !c[4]) { // titolo di sezione
      const titolo = c[0].replace(/\s*\([^)]*\)\s*$/, '');
      sezioni.push({ titolo: titolo.charAt(0) + titolo.slice(1).toLowerCase(), voci: [] }); // «PALAZZO MUNICIPALE» -> «Palazzo municipale»
      continue;
    }
    if (!sezioni.length) sezioni.push({ titolo: 'Numeri', voci: [] });
    const corrente = sezioni.at(-1).voci;
    if (c[0] && c[1]) corrente.push(voce(c[0], c[1]));
    if (c[3] && c[4]) corrente.push(voce(c[3], c[4]));
  }
  for (const s of sezioni) s.voci.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  return compatta(normalizza({ sezioni }));
}

// Toglie i campi vuoti (nota, esterno, aggiornato e id): il file resta corto e facile da ritoccare a mano
function compatta(dati) {
  const voci = (s) => s.voci.map(({ nome, numero, nota, esterno }) => ({ nome, numero, ...(nota && { nota }), ...(esterno && { esterno }) }));
  return { ...(dati.aggiornato && { aggiornato: dati.aggiornato }), sezioni: dati.sezioni.map((s) => ({ titolo: s.titolo, voci: voci(s) })) };
}

if (require.main === module) {
  const [entrata, uscita] = process.argv.slice(2);
  if (!entrata) { console.error('Uso: node scripts/numeri-interni-da-csv.js elenco.csv [uscita.json]'); process.exit(2); }
  const dati = daCsv(fs.readFileSync(entrata, 'utf8').replace(/^﻿/, ''));
  const json = JSON.stringify(dati, null, 2) + '\n';
  if (uscita) { fs.writeFileSync(uscita, json); console.log(`${dati.sezioni.length} sezioni, ${dati.sezioni.reduce((n, s) => n + s.voci.length, 0)} numeri scritti in ${uscita}`); }
  else process.stdout.write(json);
}

module.exports = { daCsv, compatta, leggiCsv, maiuscoleIniziali };
