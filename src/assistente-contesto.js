// Fatti tratti solo dai messaggi dell'utente; istruzioni, non risposte precostituite.
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function analizza(domanda, storia = []) {
  const messaggi = [...storia.filter(m => m.ruolo === 'utente').slice(-3).map(m => m.testo), domanda];
  const q = norm(messaggi.join('\n'));
  let tema = '';
  if (/stamp|multifunzion|toner/.test(q)) tema = /toner|vaschetta|contenitore/.test(q) ? 'toner' : /autorizz|abilitaz|permess|accesso negat/.test(q) ? 'stampa-permessi' : /offline/.test(q) ? 'stampa-offline' : 'stampa';
  else if (/halley|x.?desk/.test(q) && /ent[ei]|ambient|workspace|comun/.test(q)) tema = 'multiente';
  else if (/outlook|posta|\bmail\b/.test(q)) tema = /allegat/.test(q) && /salv|scaric|download/.test(q) ? 'allegati' : 'posta';
  else if (/cartell/.test(q) && /rete|condivis/.test(q)) tema = /accesso negat/.test(q) ? 'rete-permessi' : 'rete';
  else if (/pdf|p7m/.test(q)) tema = !/errore|non si apre|non si scarica|download|gestional/.test(q) ? 'lettura-documento' : 'pdf';
  else if (/cornetta|vivavoce|telefono/.test(q)) tema = 'telefono';
  else if (/sito|servizio|unimoney|unavailable/.test(q)) tema = 'web';
  const fatti = {};
  if (/outlook.{0,25}(?:desktop|sul pc|dal pc)|programma.{0,20}outlook/.test(q)) fatti.client = 'Outlook sul PC';
  if (/outlook.{0,25}(?:browser|web)|(?:browser|web).{0,20}outlook/.test(q)) fatti.client = 'Outlook nel browser';
  if (/accesso negat/.test(q)) fatti.errore = 'Accesso negato';
  else if (/503|service unavailable/.test(q)) fatti.errore = '503 / Service Unavailable riferito dall utente';
  else if (/non succede (?:niente|nulla)/.test(q)) fatti.errore = 'Al clic per salvare non succede niente: questa e la reazione gia descritta';
  else if (/nessun errore|nessun avviso/.test(q)) fatti.errore = 'Nessun messaggio di errore riferito';
  if (/tutti gli allegati/.test(q)) fatti.ambitoAllegati = 'Tutti gli allegati';
  else if (/anche (?:quelli|le mail|mail) (?:vecchi|vecchie|precedent)/.test(q)) fatti.ambitoAllegati = 'Anche allegati di mail precedenti';
  if (/mail di ieri|mail.{0,18}(?:vecchi|precedent)/.test(q)) fatti.mailPrecedente = 'Gia provato su una mail precedente';
  if (/(?:gia|ho).{0,12}riavvi/.test(q)) fatti.riavvio = 'Gia eseguito senza risolvere';
  if (/non (?:parte|partono|invia)|restano in uscita/.test(q) && /non (?:ricevo|vedo arrivare)|ultimo ricevuto.{0,15}ieri/.test(q)) fatti.posta = 'Problema sia di invio sia di ricezione, non risolto';
  if (/colleg.{0,30}stampa(?:no)?|colleg.{0,30}riesc.{0,15}stamp/.test(q) && !/colleg.{0,20}non.{0,12}stamp/.test(q)) fatti.altriStampano = true;
  if (/altri colleghi.{0,30}stesso problema|anche.{0,20}colleghi|tre utenti|due colleghi/.test(q)) fatti.diffusione = 'Problema presente anche ad altri, come gia riferito';
  if (/scadenz|urgente/.test(q)) fatti.urgenza = 'Gia indicata';
  if (/non abbiamo scorte|manca.{0,12}ricambio|non abbiamo.{0,15}ricambio/.test(q)) fatti.ricambio = 'Assente';
  if (/vivavoce.{0,20}non.{0,15}provat|non.{0,20}provat.{0,20}vivavoce/.test(q)) fatti.vivavoce = 'Non ancora provato';
  else if (/vivavoce.{0,20}(?:bene|funziona|gracchia|uguale|stesso)/.test(q)) fatti.vivavoce = 'Esito del confronto gia riferito nei messaggi';
  if (/cornetta/.test(q) && /gracch|sento male|audio/.test(q)) fatti.sintomoTelefono = 'Difetto audio della cornetta riferito';
  if (/tre browser|3 browser|piu browser/.test(q)) fatti.browser = 'Gia provati piu browser';
  if (/due pc|2 pc|piu pc/.test(q)) fatti.postazioni = 'Gia provate piu postazioni';
  if (/resta bianco|pagina bianca|schermo bianco/.test(q)) fatti.sintomoWeb = 'Pagina bianca gia riferita';
  if (/soltanto chiuso la scheda|chiuso solo la scheda/.test(q)) fatti.uscitaBrowser = 'Chiusa solo una scheda: non equivale a ESCI e chiusura di tutte le finestre';
  if (/salvat/.test(q) && /esci/.test(q) && /tutte le finestre/.test(q) && /riapert/.test(q)) fatti.proceduraMultiente = 'Interamente eseguita senza risolvere';
  const guide = {
    'toner': [], 'stampa-permessi': [], 'stampa-offline': ['stampante-offline'],
    'allegati': ['outlook-allegati-microsoft'], 'posta': ['outlook-non-si-apre'], 'multiente': ['xdesk-accesso-multiente'],
    'rete-permessi': ['cartella-rete'], 'rete': ['cartella-rete'],
    'lettura-documento': [], 'pdf': ['pdf-gestionale-non-apre'], 'telefono': [], 'web': []
  };
  const schede = {'toner': 'stampa-contenitore-toner', 'stampa-permessi': 'stampa-solo-alcuni-utenti',
    'allegati': 'outlook-salvataggio-allegati', 'posta': 'posta-entrata-uscita', 'telefono': 'telefono-fisso-audio', 'web': 'servizio-web-non-disponibile'};
  const regole = [];
  const domande = [];
  if (tema === 'allegati') {
    regole.push('Concentrati sulla funzione di salvataggio. La fonte Microsoft ne documenta la disponibilita generale; non documenta la causa del caso attuale. Riporta soltanto i fatti attuali e chiedi solo i dettagli mancanti elencati sotto.');
    if (!fatti.client) domande.push('client sul PC oppure browser');
    if (!fatti.errore) domande.push('messaggio o comportamento al salvataggio');
    if (!fatti.ambitoAllegati && domande.length < 2) domande.push('un solo allegato oppure anche altri');
    if (fatti.client && fatti.errore && fatti.ambitoAllegati) regole.push('Le informazioni essenziali sono GIA sufficienti. Nessun altro test e richiesto dalle fonti: il prossimo passo e una richiesta al CED con i dati gia riferiti. Non chiedere se dipende da file o messaggi particolari.');
    else if (fatti.client && fatti.errore) regole.push('Manca soltanto sapere se accade anche con altri allegati: chiedi questo, non quanti allegati sta scaricando nella singola operazione.');
  }
  if (tema === 'posta') {
    regole.push('Mantieni separati invio e ricezione. Non dedurre che uno dei due funzioni. Nessuna attesa di un giorno per una casella bloccata. Non dichiarare che Outlook non si collega al server: questo stato NON e stato verificato. Il controllo dal browser, se non fatto, serve solo a raccogliere un esito: non prova la causa e NON equivale a provare un secondo dispositivo.');
    if (!fatti.client) domande.push('client sul PC oppure browser');
    if (!fatti.errore) domande.push('errore oppure comportamento durante invio');
    if (!fatti.errore) regole.push('Prima manca il comportamento all invio: chiedi solo quello, senza altri controlli. Non dare nomi alle cartelle.');
    regole.push('Non inventare nomi di cartelle e non proporre invii di prova. Il controllo documentato e accedere alla casella dal browser e riferire al CED cio che si osserva.');
  }
  if (tema === 'toner') regole.push('Avviso fisico/consumabile. Segnala ricambio assente se riferito. Niente coda, permessi, riavvii o svuotamenti improvvisati.');
  if (tema === 'stampa-permessi') regole.push('L utente riferisce un avviso di autorizzazione, ma NON hai accertato la causa e non puoi escludere guasti. Per verificare il permesso serve il CED; non puoi assegnarlo. Raccogli soltanto identificazione stampante se manca. Non verificare di nuovo se i colleghi stampano; niente riavvio della stampante.');
  if (tema === 'stampa-offline') regole.push('Usa la guida Offline, non quella di altro argomento. I controlli ancora pertinenti sono accensione e cavo esterno inserito. Non ripetere il controllo display se gia descritto. Su dispositivo condiviso non far eseguire il riavvio: coinvolgi il CED se resta offline.');
  if (tema === 'rete-permessi') regole.push('ARRESTO DELLA GUIDA: con Accesso negato fermarsi subito e segnalare al CED percorso ed errore. Omettere TUTTI i tentativi, controlli di rete, riavvii e cambi di permessi.');
  if (tema === 'multiente') regole.push('Segui la guida corrente: salva il lavoro, ESCI nel servizio, chiudi tutte le finestre del browser, riapri e accedi, Halley e verifica ente. Chiudere soltanto una scheda non esaurisce questa procedura. Non inventare recupero password o cambio firewall. Non ripetere i passi se TUTTI gia eseguiti senza risultato.');
  if (tema === 'multiente' && fatti.proceduraMultiente) regole.push('TUTTA la procedura e gia stata eseguita: NON proporre di nuovo salvataggio, ESCI, chiusura o riapertura. Raccogli al massimo due dettagli per turno.');
  if (tema === 'lettura-documento') {
    regole.push('Nessuna fonte disponibile per scegliere un programma di lettura/verifica firma. Non presumere errore, download fallito o gestionale. Programmi del Comune e una categoria di richiesta, NON un programma. Chiedi solo estensione completa: non elencare esempi di estensioni o programmi preinstallati non documentati.');
    domande.push('estensione completa del file');
  }
  if (tema === 'telefono') {
    regole.push('Sintomo audio gia noto se cornetta gracchia. Cavo guasto non dimostrato. Il confronto e tra UNA cornetta e vivavoce, non tra due cornette. Il test raccoglie un sintomo, NON distingue con certezza linea e dispositivo. Niente spostamenti, sostituzioni o modifiche linea/centralino. Non dichiarare eseguito un test ancora da fare.');
    if (fatti.vivavoce === 'Non ancora provato') domande.push('esito di un confronto con il vivavoce');
    if (fatti.vivavoce === 'Esito del confronto gia riferito nei messaggi') {
      regole.push('Il confronto e COMPLETATO: nessun altro esperimento telefonico. Per il CED basta la differenza gia riferita, insieme a identificazione o sede del telefono.');
      domande.push('identificazione o sede del telefono per il CED');
    }
  }
  if (tema === 'web') {
    regole.push('Non ho verifiche in tempo reale. Non dedurre ripristino da episodi storici. Non ripetere browser, numero colleghi o urgenza gia riferiti.');
    if (fatti.browser) domande.push('pagina o URL e orario del sintomo');
  }
  // Nei casi deboli il contesto contiene solo l'azione della fase attuale.
  // Elencare alternative escluse induceva il modello piccolo a ripeterle come fatti.
  let compito = '', fase = '';
  if (tema === 'multiente' && fatti.proceduraMultiente) {
    fase='raccolta-per-ced';
    domande.push('ente atteso', 'punto in cui si blocca');
    compito='Riconosci che la procedura completa non ha risolto. Per preparare il testo al CED chiedi soltanto due dettagli: ente atteso e punto in cui si blocca. Concludi dopo queste due richieste; l invio della segnalazione spetta all utente.';
  }
  if (tema === 'toner') {
    regole.length=0;fase='segnalazione';
    compito='Invita l utente a segnalare al CED il dispositivo, l avviso fisico e il ricambio mancante quando riferito. L utente invia la richiesta; tu aiuti soltanto a preparare il testo.';
  }
  if (tema === 'allegati' && fatti.client && fatti.errore && fatti.ambitoAllegati) {
    regole.length=0;domande.length=0;fase='segnalazione';
    compito='Invita l utente a preparare una richiesta al CED riportando client, errore, sintomo e ambito gia riferiti. Riassumi solo questi dati. L invio spetta all utente.';
  }
  if (tema === 'posta') {
    regole.length=0;domande.length=0;
    if (!fatti.client || !fatti.errore) {
      fase='chiarimento';guide.posta=[];
      if (!fatti.client) domande.push('applicazione sul PC oppure browser');
      if (!fatti.errore) domande.push('che cosa osservi quando tenti di inviare');
      compito='Formula soltanto le domande sui dettagli mancanti elencati. Mantieni come fatti i problemi di invio e ricezione riferiti dall utente. Concludi dopo le domande.';
    } else {
      fase='controllo-documentato';
      compito='Proponi il solo controllo documentato: aprire la casella in outlook.office.com e osservare messaggi o avvisi. Invita ad annotare l esito per preparare il testo di una richiesta al CED. L utente decide se inviarla.';
    }
  }
  if (tema === 'telefono' && fatti.sintomoTelefono) {
    regole.length=0;domande.length=0;
    if (fatti.vivavoce === 'Esito del confronto gia riferito nei messaggi') {
      fase='identificazione';domande.push('identificazione o sede del telefono');
      compito='Riassumi la differenza audio gia riferita e chiedi soltanto identificazione o sede del telefono, per preparare il testo destinato al CED. L invio della richiesta spetta all utente.';
    } else {
      fase='raccolta-sintomo';domande.push('come si sente l audio in vivavoce rispetto alla cornetta');
      compito='Chiedi di confrontare l audio della cornetta con il vivavoce sullo stesso telefono e di riferire al CED la differenza osservata. E soltanto raccolta di un sintomo. Concludi qui.';
    }
  }
  if (tema === 'web' && fatti.errore && fatti.diffusione && fatti.urgenza) {
    regole.length=0;domande.length=0;fase='segnalazione';
    domande.push('orario di inizio, se ancora da indicare');
    compito='Indica di segnalare al CED servizio, errore, persone coinvolte e scadenza gia riferiti. L unico eventuale dettaglio mancante e quando e iniziato il problema. L esito attuale del servizio resta non verificato.';
  }
  if (tema === 'lettura-documento') {
    regole.length=0;fase='chiarimento';
    compito='Dichiara che le fonti disponibili non specificano il programma adatto. Chiedi l estensione completa del file. Scrivi soltanto queste due frasi direttamente all utente.';
  }
  return {tema, fatti, messaggi, guide: guide[tema], scheda: schede[tema] && 'scheda-' + schede[tema], regole, domande: domande.slice(0, 2), compito, fase};
}
function seleziona(graduatoria, a) {
  if (a.guide !== undefined) {
    const ids = new Set([...a.guide, a.scheda].filter(Boolean));
    return graduatoria.filter(x => ids.has(x.d.id)).sort((x,y) => (y.d.tipo === 'guida') - (x.d.tipo === 'guida')).slice(0, 3);
  }
  // Una scheda non deve escludere una guida pertinente solo perche non collegata.
  return graduatoria.filter(x => x.d.tipo !== 'esempio' && x.score >= .4).slice(0, 2);
}
function verifica(testo, a) {
  const q = norm(testo), errori = [];
  const azioni = q.replace(/\b(?:non (?:devi |serve |occorre )?|senza |evita di )(?:riavvi\w*|riprov\w*|prova\w*|cambi\w*|sostitui\w*|spost\w*)/g, '');
  const domande = (testo.match(/[^.!?\n]*(?:\?|devo sapere|ho bisogno di sapere|dimmi|indicami|puoi dirmi|specificami|necessario verificare se|verifica se|indica se)[^.!?\n]*[.!?]?/gi) || []).map(norm).join(' ');
  if ((testo.match(/\?/g) || []).length > 2) errori.push('Troppe domande: massimo due dettagli mancanti.');
  if (a.compito && (testo.match(/\?/g) || []).length > Math.max(1,a.domande.length)) errori.push('Chiedi soltanto i dettagli mancanti elencati per la fase attuale, in una sola domanda quando manca un solo dato.');
  if (a.fatti.client && /usi.{0,30}(?:outlook|browser|pc)|browser o|pc o|desktop o/.test(domande)) errori.push('Client gia noto: non richiederlo.');
  if (a.fatti.ambitoAllegati && /tutti|solo|alcuni|sempre|un file/.test(domande)) errori.push('Ambito degli allegati gia noto: non richiederlo.');
  if (a.fatti.errore && /(?:quale|che|un|qualche|nessun).{0,15}(?:errore|messaggio|avviso)|messaggio esatto|(?:errore|messaggio|avviso).{0,18}(?:compare|appare|visibile)|succede (?:nulla|niente)|compare|reazion/.test(domande)) errori.push('Errore o assenza di reazione gia riferiti: non fare domande su questo.');
  if (a.tema === 'allegati' && /salvataggio.{0,60}non e supportat|reazione attesa|non un errore da risolvere/.test(q)) errori.push('La fonte Microsoft documenta il salvataggio degli allegati: non dichiararlo impossibile o non supportato.');
  if (a.tema === 'allegati' && /controllo suggerito|verifica gia suggerita/.test(q) && !/suggerit|consigliat/.test(a.messaggi.join(' '))) errori.push('Non risulta un controllo precedentemente suggerito: non inventarne l esistenza.');
  if (a.tema === 'allegati' && /protocollo|nome dell.?ente|nome ente/.test(q) && !/protocollo|ente/.test(norm(a.messaggi.join(' ')))) errori.push('Non servono identificativi amministrativi non riferiti: per il CED usa soltanto client, errore e sintomo gia noti.');
  if (a.fatti.mailPrecedente && /mail.{0,25}(?:vecchi|precedent|ieri)/.test(domande)) errori.push('La prova su mail precedente e gia riferita.');
  if (a.fatti.altriStampano && /altri|collegh/.test(domande)) errori.push('I colleghi stampano gia: non richiederlo.');
  if (a.fatti.browser && /prova.{0,25}browser|cambia.{0,15}browser/.test(q)) errori.push('Altri browser gia provati.');
  if (a.fatti.browser && /escluso (?:il )?problema/.test(q)) errori.push('Provare altri browser non esclude con certezza una causa: riconosci soltanto la prova fatta.');
  if (a.fatti.sintomoWeb && /messaggio.{0,15}errore|che cosa compare/.test(domande)) errori.push('Pagina bianca gia riferita: chiedi URL e orario, non nuovamente il sintomo.');
  if (/(?<!non )\bho (?:verificato|controllato|testato|ripristinato|risolto)/.test(q)) errori.push('Non hai verificato alcun dispositivo o servizio: non attribuirti controlli o interventi.');
  if (a.fatti.vivavoce === 'Esito del confronto gia riferito nei messaggi' && /vivavoce/.test(domande)) errori.push('Il confronto con vivavoce e gia stato riferito: non richiederlo.');
  if (a.tema === 'telefono' && a.fatti.vivavoce === 'Esito del confronto gia riferito nei messaggi' && /prova|persiste|succede|altro|altri/.test(domande)) errori.push('Il confronto e gia completo: chiedi solo sede/identificazione per il CED, nessun altro esperimento.');
  if (a.tema === 'rete-permessi' && /riavvi|riprova|prova (?:a|ad)|controlla se altri/.test(azioni)) errori.push('La guida impone arresto immediato: niente tentativi o riavvii.');
  if (a.fatti.posta && /(?:se |la )posta arriva|ricezione funziona|ricevi (?:normalmente|regolarmente)/.test(q)) errori.push('La ricezione NON risulta funzionante.');
  if (a.tema === 'posta' && /outlook.{0,20}non si collega|inattivo su piu dispositivi|servizio e bloccato|server (?:e )?fermo/.test(q)) errori.push('Stato di collegamento, causa e prove su altri dispositivi non verificati: descrivi solo il sintomo riferito.');
  if (a.tema === 'posta' && !a.fatti.postazioni && /piu dispositivi|entrambi i dispositivi|due dispositivi|due pc|entrambi i pc/.test(q)) errori.push('Browser e programma sul PC NON sono due dispositivi: non affermare prove su altre macchine.');
  if (a.tema === 'telefono' && /due cornette|tra le.{0,15}cornette|difetto della linea o del dispositivo/.test(q)) errori.push('Non ci sono due cornette ne una diagnosi: chiedi solo esito cornetta/vivavoce.');
  if (a.tema === 'telefono' && /cambi.{0,15}linea|sostitui.{0,20}(?:cornetta|cavo)|sposta.{0,20}cornetta/.test(azioni)) errori.push('Non chiedere o proporre cambi di linea, sostituzioni o spostamenti. Basta la differenza audio gia descritta per il CED.');
  if (a.tema === 'telefono' && /cambio ente|halley|x.?desk|protocollo/.test(q) && !/cambio ente|halley|x.?desk|protocollo/.test(norm(a.messaggi.join(' ')))) errori.push('Questa e una segnalazione telefonica: niente cambio ente o altri applicativi. Chiedi soltanto identificazione/sede e riporta il sintomo al CED.');
  if (a.tema === 'posta' && /cartella[\s«"']+invia(?:ti)?\b/.test(q)) errori.push('Non inventare o confondere cartelle: parla solo dei messaggi rimasti in uscita.');
  if (a.tema === 'stampa-permessi' && /non (?:e |un )(?:un )?guasto hardware|problema riguarda i tuoi permessi|permessi specifici/.test(q)) errori.push('La causa non e verificata: invita il CED a verificare l autorizzazione senza escludere guasti.');
  if (a.tema === 'lettura-documento' && /gestionale|programmi del comune|errore persiste/.test(q)) errori.push('Nessun errore o gestionale riferito; nessun programma documentato.');
  if (a.tema === 'lettura-documento' && /\.[a-z0-9]{2,8}\b/.test(q)) errori.push('Non elencare estensioni di esempio non documentate: chiedi solo quella reale del file.');
  if (a.tema === 'lettura-documento' && /(?:una volta|poi|dopo|potrai|potro|proceder).{0,100}(?:verific|firm|aprir|programma)/.test(q)) errori.push('Il seguito dipende dalla risposta: termina con la sola domanda sull estensione.');
  if (a.tema === 'posta' && a.fase === 'chiarimento' && (!q.trim().endsWith('?') || /outlook\.office|accedi|apri.{0,25}browser|prova|se l.invio funziona|procediamo|verifica.{0,35}(?:rete|connessione)/.test(q))) errori.push('Fase di chiarimento: formula soltanto le domande mancanti, termina col punto interrogativo e concludi senza proporre controlli.');
  if (a.tema === 'telefono' && /per (?:capire|verificare|stabilire|distinguere).{0,90}(?:linea|guasto|dispositivo)|(?:guasto|difetto) (?:e |sia )?(?:della|alla) linea/.test(q)) errori.push('Il confronto raccoglie soltanto un sintomo: chiedi come si sente in vivavoce e concludi.');
  if (a.tema === 'telefono' && a.fatti.sintomoTelefono && /due dispositivi|due apparecchi|entrambi i dispositivi/.test(q)) errori.push('Cornetta e vivavoce sono due modalita dello stesso telefono: usa questo riferimento.');
  if (a.tema === 'web' && a.fase === 'segnalazione' && /descriv.{0,20}(?:meglio|problema)|dettagli.{0,15}specific|problema specifico/.test(q)) errori.push('Servizio, errore, diffusione e urgenza sono gia indicati: resta solo l eventuale orario di inizio.');
  if (/(?:procediamo|provvedo|inserisco|inoltro|registro|apriremo|registreremo).{0,70}(?:pratica|richiesta|segnalazione|inserimento)/.test(q)) errori.push('Puoi aiutare soltanto a preparare il testo; l invio resta all utente.');
  if (/\b(?:segnalo|inoltro|invio|trasmetto|contatto)\b.{0,80}(?:al ced|la richiesta|la segnalazione)|attendo conferma.{0,70}(?:disponibilita|consumabil|ricambio)/.test(q)) errori.push('Invita l utente a segnalare al CED: non stai inviando richieste ne contattando uffici o attendendo conferme esterne.');
  const ticketRiferito = /(?:apert|inviat|inoltrat|registrat).{0,25}(?:richiesta|segnalazione|ticket)|(?:richiesta|ticket)\s*#?\d/.test(norm(a.messaggi.join(' ')));
  if (!ticketRiferito && /(?:richiesta|segnalazione).{0,12}gia (?:fornita|inviata|inoltrata|registrata)/.test(q)) errori.push('Non risulta una richiesta gia inviata: invita a preparare il testo che l utente potra inviare.');
  if (a.tema === 'multiente' && !a.fatti.proceduraMultiente && /verifica.{0,45}ente.{0,35}prima di aprire halley/.test(q)) errori.push('Mantieni l ordine della guida: riaprire il browser, accedere, usare Halley, verificare l ente prima di lavorare.');
  if (a.tema === 'multiente' && a.fatti.uscitaBrowser && (!/salva/.test(q) || !/esci/.test(q) || !/tutte le finestre/.test(q))) errori.push('La sola scheda chiusa non basta: riporta salvataggio, ESCI e tutte le finestre.');
  if (a.fatti.proceduraMultiente && /(?:usa|premi|clicca).{0,15}esci|chiudi tutte le finestre|riapri il browser/.test(q)) errori.push('Intera procedura gia fallita: non riproporla.');
  if (a.tema === 'multiente' && a.fatti.proceduraMultiente && /ente/.test(q) && /punto|dove|quale fase/.test(q) && /messaggio|errore|schermata|ritaglio/.test(q)) errori.push('Stai chiedendo tre dettagli anche senza tre punti interrogativi: in questo turno chiedi soltanto ente atteso e punto del blocco.');
  return errori;
}
module.exports = {analizza, seleziona, verifica};
