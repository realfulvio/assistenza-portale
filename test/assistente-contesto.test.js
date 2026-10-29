const {test} = require('node:test');
const assert = require('node:assert/strict');
const {analizza, seleziona, verifica} = require('../src/assistente-contesto');

test('sintomi specifici escludono guide di invio, lentezza e cambio ente', () => {
  const casi = [
    ['La posta da Firefox non apre gli allegati.', 'allegati-apertura', []],
    ['Windows ha i menu in inglese.', 'lingua-windows', []],
    ['Halley non accetta la password.', 'accesso-credenziali', ['password-dimenticata']],
    ['SLpct non vede il documento p7m.', 'documenti-caricamento', []]
  ];
  const docs = ['outlook-non-si-apre','pc-lento-bloccato','xdesk-accesso-multiente','password-dimenticata'].map(id => ({d:{id,tipo:'guida'},score:1}));
  for (const [testo,tema,guide] of casi) {
    const a = analizza(testo);
    assert.equal(a.tema,tema);
    assert.deepEqual(seleziona(docs,a).map(x => x.d.id),guide);
  }
  assert.equal(analizza('Nella posta Firefox non salva gli allegati.').fatti.client,'Posta nel browser');
  assert.equal(analizza('SLpct non vede il documento p7m.').fatti.estensione,'p7m');
  assert.equal(analizza('Outlook non invia un allegato.').tema,'posta');
});
test('regressione: il contesto conserva i fatti utente tra i turni della posta', () => {
  const a = analizza('Nessun errore, restano in uscita. Ho gia riavviato.', [{ruolo: 'utente', testo: 'Outlook desktop non parte la posta e non vedo arrivare messaggi.'}, {ruolo: 'assistente', testo: 'La posta funziona.'}]);
  assert.equal(a.fatti.client, 'Outlook sul PC');
  assert.match(a.fatti.posta, /sia di invio sia di ricezione/);
  assert.ok(a.fatti.riavvio);
  assert.ok(verifica('La posta arriva regolarmente.', a).length);
});
test('regressione: allegati non recuperano istruzioni per invio o avvio Outlook', () => {
  const a = analizza('Outlook desktop non salva tutti gli allegati: Accesso negato.');
  const docs = ['scheda-outlook-salvataggio-allegati','outlook-non-si-apre','posta-non-arriva'].map(id => ({d: {id, tipo: id.startsWith('scheda') ? 'scheda' : 'guida'}, score: 1}));
  assert.deepEqual(seleziona(docs,a).map(x => x.d.id), ['scheda-outlook-salvataggio-allegati']);
  assert.ok(verifica('Usi Outlook dal browser o dal PC?', a).length);
  assert.ok(verifica('Succede con tutti gli allegati o solo un file?', a).length);
});
test('regressione: guida offline non esclusa da scheda non pertinente', () => {
  const a = analizza('La stampante risulta Offline.');
  const docs = ['scheda-stampa-solo-alcuni-utenti','stampante-non-stampa','stampante-offline'].map(id => ({d: {id, tipo: id.startsWith('scheda') ? 'scheda' : 'guida'}, score: .9}));
  assert.deepEqual(seleziona(docs,a).map(x => x.d.id), ['stampante-offline']);
});
test('regressione: negazione del test vivavoce e chiusura parziale browser restano tali', () => {
  assert.equal(analizza('La cornetta gracchia. Il vivavoce non lo ho ancora provato.').fatti.vivavoce, 'Non ancora provato');
  const a=analizza('X-Desk dopo cambio ente: ho soltanto chiuso la scheda.');
  assert.ok(a.fatti.uscitaBrowser);
  assert.ok(verifica('Hai gia fatto tutto, segnala al CED.',a).length);
});
test('regressione: un arresto della guida non diventa un riavvio suggerito', () => {
  const a=analizza('Cartella di rete, Accesso negato.');
  assert.deepEqual(verifica('Fermati e segnala al CED il percorso e Accesso negato.',a), []);
  assert.ok(verifica('Riavvia il PC e riprova.',a).length);
});
test('regressione: lettura documento senza errore non introduce un gestionale', () => {
  const a=analizza('Con quale programma leggo un PDF firmato?');
  assert.deepEqual(a.guide, []);
  assert.ok(verifica('Apri Programmi del Comune e indica il gestionale.',a).length);
});
test('domande ripetute su assenza di reazione intercettate anche con formulazioni diverse', () => {
  const a=analizza('Da Outlook nel browser salvo un allegato ma non succede niente.');
  for(const r of ['Compare un errore oppure non succede nulla?', 'Quale avviso appare?']) assert.ok(verifica(r,a).length);
});
test('negazione sui colleghi e test vivavoce completato conservano il loro significato', () => {
  assert.equal(analizza('La collega non stampa sulla stampante.').fatti.altriStampano, undefined);
  const a=analizza('La cornetta gracchia ma in vivavoce si sente bene.');
  assert.ok(verifica('Succede anche in vivavoce?',a).length);
  assert.deepEqual(verifica('Indica al CED il telefono e la differenza tra cornetta e vivavoce.',a),[]);
});
test('richiesta implicita senza punto interrogativo non aggira i fatti gia noti', () => {
  const a=analizza('Outlook desktop non salva tutti gli allegati con Accesso negato.');
  assert.ok(verifica('Devo sapere se accade con alcuni file o sempre.',a).length);
  assert.ok(verifica('E necessario verificare se riguarda solo messaggi specifici.',a).length);
});
test('nessuna verifica reale viene inventata; negazione esplicita conservata', () => {
  const a=analizza('La stampante e offline.');
  assert.ok(verifica('Ho verificato che il cavo e inserito.',a).length);
  assert.deepEqual(verifica('Non ho verificato la stampante.',a),[]);
});
test('arresto: non riprovare e corretto, un nuovo tentativo resta vietato', () => {
  const a=analizza('Cartella di rete: Accesso negato.');
  assert.deepEqual(verifica('Non riprovare ad aprire la cartella. Segnala al CED.',a),[]);
  assert.deepEqual(verifica('Segnala senza riprovare.',a),[]);
  assert.ok(verifica('Non riavviare. Riprova ad aprire la cartella.',a).length);
});
test('l ambito ancora mancante non e una ripetizione dell errore gia noto', () => {
  const a=analizza('Outlook nel browser: salvo un allegato ma non succede niente.');
  assert.deepEqual(verifica('Il problema si verifica con un singolo o con piu allegati?',a),[]);
  assert.ok(verifica('Il salvataggio degli allegati non e supportato.',a).length);
});
test('nomi di cartelle ed estensioni non documentati non vengono inventati', () => {
  assert.ok(verifica('Apri la cartella "Invia".',analizza('Outlook desktop non invia la posta.')).length);
  assert.ok(verifica('I messaggi restano nella cartella "Inviati".',analizza('Outlook desktop non invia la posta.')).length);
  assert.ok(verifica('Il file e .pdfa?',analizza('Con quale programma leggo un PDF firmato?')).length);
});
test('la raccolta dati non diventa un invito a cambiare linea telefonica', () => {
  const a=analizza('La cornetta gracchia ma in vivavoce si sente bene.');
  assert.ok(verifica('Succede anche quando cambi linea?',a).length);
  assert.ok(verifica('Ho bisogno di sapere se persiste con un altro telefono collegato.',a).length);
  assert.deepEqual(verifica('Non cambiare linea e segnala la differenza al CED.',a),[]);
});
test('identificativi e ambienti estranei non contaminano la segnalazione', () => {
  assert.ok(verifica('Fornisci il numero di protocollo della mail.',analizza('Outlook desktop non salva tutti gli allegati: Accesso negato.')).length);
  assert.ok(verifica('Per la richiesta di cambio ente indica il telefono.',analizza('La cornetta gracchia ma in vivavoce si sente bene.')).length);
  assert.ok(verifica('Il guasto e su entrambi i dispositivi.',analizza('Outlook desktop non invia la posta.')).length);
});
