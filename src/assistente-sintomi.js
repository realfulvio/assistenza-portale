// Percorsi di raccolta dei sintomi: soltanto fatti dell'utente, nessuna diagnosi o modifica.
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\bstamparte\b/g, 'stampante');

function tema(testo) {
  const q = norm(testo);
  if (/stampant|multifunzion/.test(q) && /scompar|sparit|non.{0,25}(?:compar|present|visualizz|visibil)|non (?:vedo|trovo).{0,25}stampant/.test(q)) return 'stampa-assente';
  if (/allegat/.test(q) && /posta|outlook|email|e-mail/.test(q) && /apr[ei]|aprono|apertur|visualizz/.test(q) && !/non.{0,15}invi/.test(q)) return 'allegati-apertura';
  if (/windows|menu|interfaccia/.test(q) && /inglese|lingua italiana|lingua.{0,15}italiano/.test(q)) return 'lingua-windows';
  if (/halley|x.?desk/.test(q) && /credenzial|password|recupero/.test(q) && !/cambio.{0,15}ent|cambiat.{0,20}ent|passagg.{0,20}ent|workspace/.test(q)) return 'accesso-credenziali';
  if (/sl\s?pct/.test(q) && /file|document|p7m|caric/.test(q)) return 'documenti-caricamento';
  if (/unimoney|servizio|sito|portale/.test(q) && /\b503\b|service unavailable/.test(q)) return 'servizio-indisponibile';
  return '';
}

function procedura(domanda, messaggi, documenti) {
  const utenti = [...messaggi.filter(m => m.ruolo === 'utente').map(m => m.testo), domanda];
  const q = norm(utenti.join('\n'));
  const t = tema(q);
  const out = (risposta, ids = []) => ({regola: t, risposta, guide: ids.filter(id => documenti.some(d => d.id === id && d.tipo === 'guida'))});
  if (t === 'stampa-assente') {
    const altri = /colleg[ah].{0,35}(?:riesc.{0,15}(?:usar|stamp)|stampa)|altri.{0,25}stampano/.test(q)
      && !/colleg[ah].{0,25}non.{0,15}(?:riesc|stamp)/.test(q);
    const note = [/(?:gia|ho).{0,15}riavvi/.test(q) ? 'Il riavvio del PC non ha risolto.' : '', altri ? 'Hai già indicato che gli altri colleghi stampano.' : ''].filter(Boolean).join(' ');
    return out('La stampante manca dall’elenco. ' + (note ? note + ' ' : '') +
      'Segnala al CED il nome della stampante e del PC, specificando quando è scomparsa' + (/aggiorn/.test(q) ? ' e che è successo dopo gli aggiornamenti' : '') + '. Non aggiungere o rimuovere driver da solo.');
  }
  if (t === 'allegati-apertura') {
    const browsers = ['firefox', 'chrome', 'edge', 'safari'].filter(b => q.includes(b));
    const confronto = browsers.length > 1 && /si apre|si aprono|funziona/.test(q);
    const reazione = /nessun errore|nessun avviso|non succede (?:nulla|niente)|compare.{0,30}errore|errore.{0,30}compare/.test(q);
    if (confronto) return out('Lo stesso allegato si apre nell’altro browser. Per proseguire puoi usare il browser aziendale in cui funziona; segnala al CED i due browser e l’esito diverso, senza allegare documenti riservati.');
    const domande = [];
    if (!browsers.length && !/browser|web|desktop|sul pc/.test(q)) domande.push('Usi la posta dal browser oppure dall’applicazione sul PC?');
    if (!reazione) domande.push('Quando clicchi sull’allegato compare un avviso oppure non succede nulla?');
    if (domande.length < 2) domande.push('Lo stesso allegato si apre con un altro browser aziendale già disponibile?');
    return out('Il problema riguarda l’apertura degli allegati. ' + domande.slice(0, 2).join(' '));
  }
  if (t === 'lingua-windows') return out('La lingua dell’interfaccia di Windows va verificata dal CED' + (/aggiorn/.test(q) ? ' dopo l’aggiornamento' : '') +
    '. ' + (/(?:gia|ho).{0,15}riavvi/.test(q) ? 'Il riavvio che hai già eseguito non ha risolto: non occorre ripeterlo. ' : '') +
    'Indica nella richiesta il nome del PC e quali menu sono in inglese; puoi aggiungere una schermata priva di dati riservati. Non ho una procedura documentata per reinstallare la lingua e non posso confermare la causa.');
  if (t === 'accesso-credenziali') {
    const tentato = /(?:gia|provato|tentato|fallit|senza riusc).{0,55}(?:recuper|reset|reimpost)|(?:recuper|reset|reimpost).{0,55}(?:senza riusc|non funzion|fallit)/.test(q);
    return out((tentato ? 'Hai già tentato il recupero della password senza riuscirci. ' : 'L’applicativo non accetta le credenziali. ') +
      'Chiedi al CED di verificare l’utenza e l’eventuale blocco, indicando l’applicativo e l’avviso visualizzato. Non insistere con tentativi di accesso e non inviare password o codici.', ['password-dimenticata']);
  }
  if (t === 'documenti-caricamento') {
    const estensione = /\b(p7m|pdf|docx|odt)\b/.exec(q)?.[1];
    const domande = [];
    if (!estensione) domande.push('Qual è l’estensione completa del file che non compare?');
    if (!/cartella|percorso/.test(q)) domande.push('In quale cartella si trova il documento?');
    if (domande.length < 2) domande.push('Il file si apre dal suo percorso fuori da SLpct, oppure compare un errore?');
    return out('L’icona bianca da sola non dimostra che il file sia danneggiato: va distinta dal problema di caricamento in SLpct. ' +
      (estensione ? 'Hai già indicato il formato ' + estensione + '. ' : '') + domande.slice(0, 2).join(' ') + ' Per la verifica basta descrivere l’esito, senza inviare il documento.');
  }
  if (t === 'servizio-indisponibile') return out('L’avviso indica che il servizio non è disponibile, ma non dimostra che sia in manutenzione: non ho una verifica in tempo reale della causa. ' +
    'Segnala al CED il servizio e l’errore che hai già riportato, aggiungendo l’orario di inizio' + (/scadenz|urgent/.test(q) ? ' e la scadenza urgente che hai indicato' : '') + '. Posso aiutarti a preparare il testo; l’invio resta a te.');
  return null;
}

module.exports = {tema, procedura};
