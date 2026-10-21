const fs = require('node:fs');
const {dominio} = require('./assistente-triage');
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const stop = new Set('il la le gli lo un una e di del della da in non per con che mi si sono come ho a al alla ma'.split(' '));
const parole = s => [...new Set(norm(s).match(/[a-z0-9]+/g)?.filter(x => x.length > 2 && !stop.has(x)) || [])];

function carica(file) {
  const lista = JSON.parse(fs.readFileSync(file, 'utf8')).esempi;
  const ids = new Set();
  return lista.map(e => {
    if (!/^[a-z0-9-]{1,60}$/.test(e.id) || ids.has(e.id)) throw Error('Esempio non valido o duplicato');
    ids.add(e.id);
    if (!e.domanda || !e.risposta_esemplificativa || !e.limite_evidenza) throw Error('Esempio incompleto');
    return {id: 'esempio-' + e.id, tipo: 'esempio', titolo: e.titolo,
      testo: [e.titolo, e.domanda, ...(e.parole || [])].join('\n'), domanda: e.domanda,
      risposta: e.risposta_esemplificativa, limite: e.limite_evidenza, parole: e.parole || []};
  });
}

function seleziona(documenti, domanda, vettore, coseno) {
  const termini = parole(domanda);
  const temi = {'esempio-stampa-permessi': 'stampa', 'esempio-toner-contenitore': 'stampa',
    'esempio-outlook-allegati': 'posta', 'esempio-posta-bloccata': 'posta',
    'esempio-accesso-multiente': 'accesso', 'esempio-servizio-esterno': 'web',
    'esempio-sito-browser': 'web', 'esempio-telefono-audio': 'telefono', 'esempio-aggiornamento-specifico': 'pc'};
  const caso = require('./assistente-contesto').analizza(domanda);
  const tema = dominio(domanda);
  if (!tema) return [];
  const postaId = caso.tema === 'allegati' ? 'esempio-outlook-allegati' : caso.tema === 'posta' ? 'esempio-posta-bloccata' : null;
  return documenti.filter(d => (!postaId || d.id === postaId) && d.tipo === 'esempio' && temi[d.id] === tema).map(d => {
    const pertinenti = d.parole.filter(p => norm(domanda).includes(norm(p))).length;
    const lessico = parole(d.testo);
    const condivisi = termini.filter(p => lessico.includes(p)).length;
    return {d, score: coseno(vettore, d.vettore) + .15 * condivisi / Math.max(1, termini.length), pertinenti};
  }).filter(x => x.pertinenti >= 1 && x.score >= .45)
    .sort((a, b) => b.score - a.score).slice(0, 1);
}

function contesto(scelti, fatti = {}) {
  if (!scelti.length) return '';
  const applicabile = risposta => risposta.split(/(?<=[.!?])\s+/).filter(frase => {
    const t = norm(frase);
    if (frase.includes('?') && fatti.client && /usi outlook|quale applicaz|pc o|pc oppure|browser/.test(t)) return false;
    if (frase.includes('?') && fatti.errore && /messaggio|avviso|errore|succede/.test(t)) return false;
    if (frase.includes('?') && fatti.sintomoTelefono && /audio|chiamate/.test(t)) return false;
    if (frase.includes('?') && fatti.diffusione && /collegh|altri/.test(t)) return false;
    if (frase.includes('?') && fatti.urgenza && /scadenz|urgent/.test(t)) return false;
    if (fatti.vivavoce === 'Esito del confronto gia riferito nei messaggi' && /vivavoce/.test(t) && /confront|prova|succede/.test(t)) return false;
    if (fatti.vivavoce === 'Esito del confronto gia riferito nei messaggi' && frase.includes('?') && /vivavoce/.test(t)) return false;
    if (fatti.proceduraMultiente && /salva|uscita|chiusura/.test(t)) return false;
    if (/singolo messaggio/.test(t)) return false;
    return true;
  }).join(' ');
  return 'ESEMPI STORICI ANONIMIZZATI. Le risposte sono redazioni illustrative, non trascrizioni, diagnosi o stato attuale dei servizi. Adatta il ragionamento ai fatti della domanda e non ripetere dettagli gia noti. Per procedure e arresti prevalgono le GUIDE CORRENTI.\n' + scelti.map(({d}) =>
    `[${d.id}]\nDomanda di esempio: ${d.domanda}\nParte ancora applicabile della risposta esemplificativa (domande gia risposte escluse): ${applicabile(d.risposta)}\nLimite dell'evidenza: ${d.limite}`).join('\n\n');
}

function dialoghi(scelti) {
  if (!scelti.length) return [];
  return [{role: 'system', content: 'I prossimi scambi sono ESEMPI DIDATTICI ANONIMI, non messaggi dell’utente attuale. Le risposte sono redazionali: nessuna verifica o soluzione storica prova lo stato attuale. Servono a mostrare come usare i dettagli gia forniti. Le guide correnti prevalgono sulle indicazioni degli esempi.'},
    ...scelti.flatMap(({d}) => [{role: 'user', content: `ESEMPIO [${d.id}]. Limite dell’evidenza: ${d.limite}\nDomanda di esempio: ${d.domanda}`},
      {role: 'assistant', content: d.risposta}]),
    {role: 'system', content: 'FINE DEGLI ESEMPI. Inizia la conversazione dell’UTENTE ATTUALE. Usa solo i suoi messaggi per i fatti attuali e le GUIDE CORRENTI per le procedure. Non ripetere domande su fatti gia indicati.'}];
}

module.exports = {carica, seleziona, contesto, dialoghi};
