const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const sintomi = require('./assistente-sintomi');

function dominio(testo) {
  const q = norm(testo);
  const specifico = sintomi.tema(q);
  if (specifico) return specifico === 'stampa-assente' ? 'stampa' : specifico === 'allegati-apertura' ? 'posta' : specifico === 'accesso-credenziali' ? 'accesso' : specifico === 'lingua-windows' ? 'pc' : specifico === 'servizio-indisponibile' ? 'web' : 'documenti';
  if (/stamp|multifunzion|fotocopiat|toner|contenitore.{0,20}(toner|scarto)/.test(q)) return 'stampa';
  if (/halley|x.?desk|workspace|recupero password/.test(q)) return 'accesso';
  if (/outlook|posta|\bmail\b|allegat/.test(q)) return 'posta';
  if (/\bpdf\b|\bp7m\b|sl\s?pct|document.{0,20}firmat/.test(q)) return 'documenti';
  if (/telefon|cornetta|vivavoce/.test(q)) return 'telefono';
  if (/sito|servizio|unimoney|unavailable/.test(q)) return 'web';
  if (/firmware|bios|\bpc\b|computer|logo lenovo/.test(q)) return 'pc';
  return null;
}

function storiaPertinente(domanda, messaggi) {
  const utenti = messaggi.filter(m => m.ruolo === 'utente');
  const attivo = dominio(domanda) || utenti.map(m => dominio(m.testo)).filter(Boolean).at(-1);
  if (!attivo) return messaggi;
  for (let i = messaggi.length - 1; i >= 0; i--) {
    if (messaggi[i].ruolo !== 'utente') continue;
    const tema = dominio(messaggi[i].testo);
    if (tema && tema !== attivo) {
      const primoUtente = messaggi.findIndex((m, j) => j > i && m.ruolo === 'utente');
      return primoUtente >= 0 ? messaggi.slice(primoUtente) : [];
    }
  }
  return messaggi;
}

function proceduraGuidata(domanda, messaggi, documenti) {
  const sintomo = sintomi.procedura(domanda, messaggi, documenti);
  if (sintomo) return sintomo;
  const tema = dominio(domanda) || messaggi.filter(m => m.ruolo === 'utente').map(m => dominio(m.testo)).filter(Boolean).at(-1);
  const q = norm([...messaggi.filter(m => m.ruolo === 'utente').map(m => m.testo), domanda].join('\n'));
  const schede = new Set(documenti.filter(d => d.tipo === 'scheda').map(d => d.id));
  const out = (regola, risposta, guide = []) => ({regola, risposta, guide});
  if (tema === 'stampa' && schede.has('scheda-stampa-contenitore-toner') && /toner|contenitore.{0,20}scarto/.test(q)
    && /pien|esaur|ricambio|sostitu/.test(q)
    && !/(?:sostituito|cambiato).{0,30}(?:contenitore|toner)|(?:contenitore|toner).{0,30}(?:sostituito|cambiato)/.test(norm(domanda))) {
    return out('toner-avviso-fisico', 'L’avviso riguarda il contenitore o il consumabile della stampante: non è un problema da risolvere svuotando la coda o cambiando le abilitazioni. Segnala al CED il nome della stampante e il messaggio esatto; se manca il ricambio, indicalo nella richiesta. Non svuotare o smontare il contenitore senza una procedura autorizzata.', ['stampante-non-stampa']);
  }
  if (tema === 'stampa' && schede.has('scheda-stampa-solo-alcuni-utenti') && /non.{0,12}abilitat|non.{0,12}autorizzat|manca.{0,15}abilitaz|accesso negat|permess.{0,20}(?:manc|negat)|non.{0,10}permess/.test(q)) {
    return out('stampa-abilitazione-ced', 'Per verificare l’abilitazione serve il CED: non posso assegnare permessi. Nella richiesta indica il nome della stampante e l’errore visualizzato, se presente. Se hai già scelto quella corretta, non occorre ripetere quel controllo.', ['stampante-non-stampa']);
  }
  if (tema === 'stampa' && schede.has('scheda-stampa-solo-alcuni-utenti')
    && /(?:non|impossibile).{0,20}stamp|stamp.{0,15}(?:non|niente)|non esce.{0,20}foglio/.test(q)
    && !/offline|coda|carta|errore|sportell|incepp|stampante.{0,10}(?:piano|corridoio|ufficio)/.test(q)) {
    return out('stampa-dettagli-iniziali', 'Quale stampante stai usando? Quando invii la stampa compare un errore, il documento resta in coda oppure non succede nulla?', ['stampante-non-stampa', 'stampante-scelta']);
  }
  if (tema === 'posta' && schede.has('scheda-posta-entrata-uscita')
    && /non.{0,20}(?:part|invi)|(?:invio|uscita).{0,15}(?:blocc|non)/.test(q)
    && /non.{0,20}ricev|(?:ricezione|entrata).{0,15}(?:blocc|non)/.test(q)) {
    const client = /outlook.{0,20}(?:sul pc|dal pc|browser|web)|outlook (?:web|desktop)/.test(q);
    const errore = /errore|messaggio|codice|nessun avviso/.test(q);
    if (!client || !errore) {
      const domande = [];
      if (!client) domande.push('Usi Outlook dal programma sul PC oppure dal browser?');
      if (!errore) domande.push('Quando provi a inviare compare un messaggio di errore, oppure il messaggio resta in uscita?');
      return out('posta-invio-ricezione', 'Invio e ricezione vanno verificati separatamente; una mail ricevuta non dimostra che tutto funzioni. ' + domande.join(' '), ['posta-non-arriva', 'outlook-non-si-apre']);
    }
    return out('posta-blocco-persistente', 'Hai già indicato applicazione e messaggio: riportali nella richiesta al CED insieme all’orario di inizio e al fatto che sono coinvolti sia invio sia ricezione. Non occorre attendere un giorno per segnalare un blocco della casella.', ['posta-non-arriva']);
  }
  if (tema === 'accesso' && schede.has('scheda-accesso-halley-xdesk') && /x.?desk|halley/.test(q)
    && /cambiat.{0,20}ent|passagg.{0,20}ent|cambio.{0,20}ent|workspace|ambient.{0,15}altro ent/.test(q)) {
    if (/gia.{0,50}(?:esci|uscit|chius|riapert)|(?:esci|chius|riapert).{0,50}gia/.test(q)) {
      return out('multiente-controlli-gia-fatti', 'Non ripetere i passaggi già eseguiti. Indica al CED l’ente che devi raggiungere, il punto in cui l’accesso si blocca e il messaggio esatto. Non modificare firewall, rete o autorizzazioni e non usare credenziali di altri.', ['xdesk-accesso-multiente']);
    }
    // Procedura tratta dalla guida corrente, non da una ricostruzione libera del modello.
    const guida = documenti.find(d => d.id === 'xdesk-accesso-multiente');
    if (guida?.passi?.length) {
      return out('multiente-guida-corrente', [...guida.passi.map(p => typeof p === 'string' ? p : p.t), 'Se il blocco resta, fermati e indica al CED ente atteso, punto del blocco e messaggio esatto.'].join(' '), ['xdesk-accesso-multiente']);
    }
    return out('multiente-guida-non-disponibile', 'Non ho una procedura corrente disponibile per questo passaggio. Indica al CED l’ente atteso e il messaggio esatto, senza condividere credenziali.', []);
  }
  if (tema === 'telefono' && schede.has('scheda-telefono-fisso-audio') && /non funzion|funzion.{0,10}male|va male|non va|malfunzion|sento|audio|cornetta|gracch|muto/.test(q)) {
    const sintomo = /audio|sento|sente|gracch|muto|non squilla|non riceve|non chiama/.test(q);
    const viva = /(?:anche|solo|non|bene|male|provato).{0,15}vivavoce|vivavoce.{0,15}(?:bene|male|uguale|stesso|funziona|gracch)/.test(q);
    if (sintomo && viva) return out('telefono-dettagli-raccolti', 'Indica nella richiesta al CED il telefono o la sede interessata e la differenza che hai notato tra cornetta e vivavoce. Questi dettagli aiutano la verifica tecnica; non posso confermare un guasto al cavo. Non cambiare linea o configurazione del centralino.', []);
    const domande = [];
    if (!sintomo) domande.push('Il problema riguarda chiamate in entrata, in uscita oppure l’audio?');
    if (!viva) domande.push('Se riguarda l’audio, succede anche usando il vivavoce?');
    return out('telefono-raccolta-sintomo', 'Il cavo è soltanto un’ipotesi, non una diagnosi. ' + domande.join(' '), []);
  }
  if (tema === 'telefono' && schede.has('scheda-telefono-fisso-audio') && /(?:non riesco|non posso|non si riesce).{0,20}chiam|non chiama|non riceve/.test(q)) {
    return out('telefono-chiamate', 'Quando provi a chiamare senti un tono, compare un errore oppure non succede nulla? Succede anche agli altri telefoni dello stesso ufficio? Non modificare linea o centralino: questi dettagli servono al CED per la verifica.', []);
  }
  return null;
}

module.exports = {dominio, storiaPertinente, proceduraGuidata};
