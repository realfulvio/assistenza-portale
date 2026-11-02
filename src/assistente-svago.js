// Raccolta locale: risposta immediata, stato separato dalla bozza del ticket.
const { randomInt } = require('node:crypto');
const raccolta = require('../content/assistente-svago.json');
const catalogo = [
  ...raccolta.freddure.map((testo, i) => ({ id: `f${i}`, tipo: 'freddura', testo })),
  ...raccolta.barzellette.map((testo, i) => ({ id: `b${i}`, tipo: 'barzelletta', testo }))
];
const normalizza = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function richiesta(testo, stato) {
  const q = normalizza(testo);
  if (/\bnon\b.*(?:raccont|barzellett|freddur|ridere)/.test(q)) return null;
  const genere = /\bfreddur[ae]\b/.test(q) ? 'freddura' : /\bbarzellett[ae]\b/.test(q) ? 'barzelletta' : null;
  if (genere && (/\b(?:raccont[a-z]*|dimmi|dici|dimmene|fammi|vorrei|voglio|conosci|hai|sparane)\s+(?:(?:una?|delle|qualche|altra|altre|bella|breve|corta|divertente|ancora|per|favore)\s+){0,6}(?:barzellett[ae]|freddur[ae])\b/.test(q)
    || /^(?:una? |un altra |un altro |altre |altra |ancora una? )?(?:barzellett[ae]|freddur[ae])(?: breve| corta| divertente)?$/.test(q))) return genere;
  if (/^(?:fammi|facci|fateci) ridere$/.test(q)) return 'barzelletta';
  if (stato.ultimoTipo === 'svago' && /^(?:ancora|un altra|un altro|altra|altre|continua|raccontamene un altra|dimmene un altra|una migliore|piu bella)$/.test(q)) return stato.svago?.tipo || 'barzelletta';
  return null;
}

function rispondi(stato, tipo) {
  const memoria = stato.svago ||= { usate: [], tipo };
  const gruppo = catalogo.filter(v => v.tipo === tipo);
  let disponibili = gruppo.filter(v => !memoria.usate.includes(v.id));
  if (!disponibili.length) {
    const ultimo = memoria.usate.at(-1);
    memoria.usate = memoria.usate.filter(id => !gruppo.some(v => v.id === id));
    // All'inizio del nuovo giro evita anche di ripetere subito l'ultima.
    disponibili = gruppo.filter(v => gruppo.length === 1 || v.id !== ultimo);
  }
  const scelta = disponibili[randomInt(disponibili.length)];
  memoria.usate.push(scelta.id); memoria.tipo = tipo;
  return { tipo: 'svago', genere: tipo, risposta: scelta.testo, fonti: [], opzioni: [
    { testo: 'Un’altra barzelletta', azione: 'messaggio' },
    { testo: 'Un’altra freddura', azione: 'messaggio' }
  ] };
}

module.exports = { richiesta, rispondi, catalogo };
