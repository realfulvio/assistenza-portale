const fs = require('node:fs');
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function leggiSchede(file, base, faq) {
  const ids = new Set(faq.map(g => g.id));
  const seen = new Set();
  return JSON.parse(fs.readFileSync(file, 'utf8')).schede.map(s => {
    if (!/^[a-z0-9-]{1,60}$/.test(s.id) || seen.has(s.id)) throw new Error('ID scheda non valido o duplicato');
    seen.add(s.id);
    if (!s.faq.every(id => ids.has(id))) throw new Error('Riferimento FAQ inesistente');
    // Il racconto storico e i metadati delle mail non entrano nel contesto del modello.
    return {id: 'scheda-' + s.id, tipo: 'scheda', titolo: s.titolo, url: null, faq: s.faq,
      testo: [s.titolo, 'Domande utili: ' + s.domande.join(' '), 'Criteri: ' + s.indicazione_proposta,
        'Non dedurre: ' + s.da_non_dedurre.join('; ')].join('\n')};
  });
}

function rispostaControllata(domanda, messaggi, base) {
  const q = norm(domanda);
  const precedenti = messaggi.filter(m => m.ruolo === 'utente').slice(-2).map(m => norm(m.testo));
  const ultima = precedenti.at(-1) || '';
  const firmware = /\b(firmware|bios|uefi)\b/;
  const inCorso = /aggiorna(?:ndo|mento)?|installando|blocc|ferm|in corso|percentuale/;
  const finito = /(?:aggiornamento|installazione|firmware|bios).{0,30}(?:terminat|finit|completat)|(?:ho|ha) (?:gia )?aggiornato/;
  const ipotetico = /\b(se |quando |domani|ipotetic|dovessi|devo avviare|prima di)/;
  const corrente = firmware.test(q) && inCorso.test(q) && !finito.test(q) && !ipotetico.test(q);
  const seguito = !firmware.test(q) && firmware.test(ultima) && inCorso.test(ultima) && !finito.test(ultima)
    && !finito.test(q) && /speng|riavvi|stacc|ancora ferm|ancora blocc/.test(q);
  const fonti = id => [{titolo: id === 'pc-lento-bloccato' ? 'Il PC è lento o bloccato' : 'Ho dimenticato la password, è scaduta o non viene accettata', url: base + '/#faq/' + id}];
  if (corrente || seguito) return {regola: 'firmware-in-corso', risposta: 'Non spegnere il PC e non interrompere l’aggiornamento firmware. Da quanto tempo è fermo e che cosa compare a schermo? Se sembra bloccato, contatta il CED indicando questi dettagli: prima di riavviare serve una verifica tecnica.', fonti: fonti('pc-lento-bloccato')};
  if (/ignora.{0,35}(regol|istruzion)|(?:dammi|mostra|rivela).{0,50}(password|credenzial|vecchie mail)/.test(q)) {
    return {regola: 'richiesta-segreti', risposta: 'Non posso fornire credenziali o dati riservati dalle mail. Se hai un problema di accesso, dimmi quale applicativo usi e quale errore compare, senza inviare password o codici.', fonti: fonti('password-dimenticata')};
  }
  if (/(?:mando|invio|scrivo|fornisco).{0,25}(password|codice mfa)|(?:password|codice mfa).{0,20}(?:mando|invio|scrivo)/.test(q)) {
    return {regola: 'non-inviare-password', risposta: 'Non inviare password o codici di accesso. Per il problema di posta basta indicare quale applicazione usi e il messaggio di errore, senza credenziali.', fonti: fonti('password-dimenticata')};
  }
  if (/disattiv|disabilit|spegner|spegnere/.test(q) && /antivirus|protezion|firewall/.test(q)) {
    return {regola: 'non-disattivare-protezioni', risposta: 'Non disattivare le protezioni. Indica al CED quale allegato viene bloccato e il messaggio visualizzato, senza inviare file sospetti: serve una verifica tecnica prima di procedere.', fonti: []};
  }
  if (/soluzion.{0,20}vuot|vuot.{0,20}soluzion/.test(q) && /ticket|richiesta|intervento/.test(q)) {
    return {regola: 'intervento-non-documentato', risposta: 'Con la soluzione vuota non posso sapere quale intervento sia stato eseguito: lo stato «risolto» non lo documenta. Per ricostruirlo serve una verifica del CED. Se il problema si ripresenta, descrivi l’avviso attuale e il dispositivo interessato.', fonti: []};
  }
  if (/stamp/.test(q) && /colleg/.test(q) && /(?:io |non riesco|non stampo|non posso)/.test(q)
    && /colleg\w*.{0,30}(?:riesce a stampare|stampa)|(?:riesce a stampare|stampa).{0,20}colleg/.test(q)
    && !/non.{0,12}abilitat|non.{0,12}autorizzat|accesso negat|non.{0,10}permess/.test(q)) {
    return {regola: 'stampa-altri-riescono', risposta: 'Quale stampante hai selezionato tu e che cosa succede quando invii la stampa? Il fatto che la collega stampi non indica un guasto generale: se compare un errore di abilitazione, riportalo nella richiesta al CED.', fonti: [{titolo: 'Come scegliere la stampante giusta', url: base + '/#faq/stampante-scelta'}]};
  }
  if (/colleg/.test(q) && /aggiorn/.test(q) && /(?:anche io|anch.?io|tutti)/.test(q)) {
    return {regola: 'eccezione-non-generale', risposta: 'Un’indicazione data per il PC di un collega non vale automaticamente per il tuo. Prima di bloccare o modificare gli aggiornamenti, chiedi al CED indicando il programma e la tua postazione.', fonti: []};
  }
  if (/verific|controll/.test(q) && /account|mail/.test(q) && /recupero|password/.test(q)) {
    return {regola: 'verifica-account-ced', risposta: 'Non posso verificare l’indirizzo associato al tuo account. Di quale applicativo si tratta? Se la mail di recupero non arriva, il CED può controllare la configurazione: descrivi il problema nella richiesta senza inviare password o codici.', fonti: fonti('password-dimenticata')};
  }
  return null;
}

function pertinenteScheda(id, testo) {
  const q = norm(testo);
  const temi = {
    'scheda-stampa-solo-alcuni-utenti': /stamp/,
    'scheda-stampa-contenitore-toner': /toner|contenitore|ricambio/,
    'scheda-outlook-salvataggio-allegati': /outlook|allegat/,
    'scheda-posta-entrata-uscita': /posta|mail|outlook/,
    'scheda-pc-fermo-dopo-aggiornamento': /\bpc\b|computer|aggiorn|firmware|bios|logo/,
    'scheda-accesso-halley-xdesk': /halley|x.?desk|password|workspace|recupero|account/,
    'scheda-servizio-web-non-disponibile': /sito|servizio|unimoney|unavailable|server/,
    'scheda-telefono-fisso-audio': /telefon|cornetta|vivavoce/
  };
  return temi[id]?.test(q) || false;
}

function raccogliDettagli(id, domanda, messaggi) {
  const storia = messaggi.filter(m => m.ruolo === 'utente').slice(-2).map(m => m.testo);
  const q = norm([...storia, domanda].join('\n'));
  if (id === 'scheda-outlook-salvataggio-allegati' && /(?:salv|scaric).{0,30}allegat|allegat.{0,30}(?:salv|scaric)/.test(q)) {
    const client = /(?:outlook|programma|client).{0,20}(?:sul pc|dal pc|browser|web)|outlook (?:web|desktop)|(?:sul pc|dal browser).{0,15}outlook/.test(q);
    const errore = /messaggio|errore|accesso negato|codice|nessun avviso|impossibile/.test(q);
    if (!client || !errore) {
      const prefix = /gia riavvi|gia.*riavvio/.test(q) ? 'Hai già riavviato senza risolvere. ' : '';
      const domande = [];
      if (!client) domande.push('Usi Outlook dal programma sul PC oppure dal browser?');
      if (!errore) domande.push('Che messaggio compare quando provi a salvare l’allegato, oppure non compare nessun avviso?');
      if (domande.length < 2 && !/tutti|anche quelli vecchi|anche.*precedent/.test(q)) domande.push('Succede con tutti gli allegati o soltanto con un file?');
      return {regola: 'dettagli-allegati', risposta: prefix + domande.join(' ')};
    }
  }
  if (id === 'scheda-servizio-web-non-disponibile' && /service unavailable/.test(q)
    && !/solo a me|anche.{0,20}colleg|tutti|nessun altro|urgente|scadenza/.test(q)) {
    return {regola: 'dettagli-servizio-indisponibile', risposta: 'Altri colleghi vedono lo stesso errore? Hai una scadenza urgente? Non ho una verifica in tempo reale del servizio: per questo non posso confermare la causa del disservizio.'};
  }
  if (id === 'scheda-servizio-web-non-disponibile' && /sito non si apre|sito.{0,15}non funziona/.test(q)
    && /gia.{0,20}browser|tre browser|3 browser/.test(q)) {
    return {regola: 'dettagli-sito-gia-provato', risposta: 'Hai già provato altri browser senza risolvere. Quale sito stai aprendo e che messaggio compare? Con questi dettagli possiamo distinguere il servizio interessato e preparare una richiesta utile al CED.'};
  }
  return null;
}

function cercaNumero(q) {
  const s = norm(q);
  if (/(?:non riesco|non posso).{0,20}(?:chiam|telefon)/.test(s)) return false;
  if (/telefon[oa].{0,25}(?:non funzion|funzion.{0,8}male|sente|audio|cornetta)|(?:mio |il )telefono.{0,30}(?:male|guast|blocc)/.test(s)) return false;
  return /\bnumer[oi]\b|\bcontatt[oi]\b|(?:chi|come|posso).{0,15}chiamare|\bintern[oi]\b.{0,25}(?:di |del |dell)|\bcentralino\b/.test(s);
}

module.exports = {leggiSchede, rispostaControllata, cercaNumero, pertinenteScheda, raccogliDettagli};
