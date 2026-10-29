const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analizza,seleziona,verifica}=require('../src/assistente-contesto');
test('posta: il comportamento mancante non viene mescolato al controllo browser',()=>{
  const a=analizza('In Outlook desktop non parte la posta e non vedo arrivare nuovi messaggi.');
  assert.equal(a.fase,'chiarimento');
  assert.equal(a.domande.length,1);
  assert.deepEqual(seleziona([{d:{id:'outlook-non-si-apre',tipo:'guida'},score:1}],a),[]);
  assert.ok(verifica('Accedi a outlook.office.com e poi indica quale errore compare.',a).length);
  assert.ok(verifica('Che cosa succede quando invii? Hai ricevuto un messaggio stamattina?',a).length);
  assert.ok(verifica('Che cosa succede quando invii? Se non hai altri dettagli procediamo con la verifica della connessione di rete.',a).length);
  assert.deepEqual(verifica('Quando tenti di inviare compare un avviso oppure il messaggio rimane in uscita?',a),[]);
});
test('posta: il seguito conserva invio e ricezione senza richiedere il riavvio',()=>{
  const a=analizza('Nessun errore, i messaggi restano in uscita. Ho gia riavviato.',[{ruolo:'utente',testo:'Outlook desktop non parte la posta e non vedo arrivare messaggi.'}]);
  assert.equal(a.fase,'controllo-documentato');
  assert.ok(a.fatti.posta && a.fatti.riavvio);
  assert.deepEqual(a.domande,[]);
});
test('telefono: raccolta del sintomo distinta da diagnosi di guasto',()=>{
  const a=analizza('La cornetta gracchia e non ho provato il vivavoce.');
  assert.equal(a.fase,'raccolta-sintomo');
  assert.ok(verifica('Per verificare se il guasto e della linea, prova il vivavoce.',a).length);
  assert.deepEqual(verifica('Come si sente in vivavoce rispetto alla cornetta? Riferisci al CED la differenza.',a),[]);
  assert.ok(verifica('Confronta la qualita tra i due dispositivi.',a).length);
});
test('i passi multiente mantengono l ordine della guida',()=>{
  const a=analizza('X-Desk dopo il cambio di ente: ho soltanto chiuso la scheda.');
  assert.ok(verifica('Salva, usa ESCI, chiudi tutte le finestre. Verifica l ente prima di aprire Halley.',a).length);
  assert.deepEqual(verifica('Salva, usa ESCI, chiudi tutte le finestre. Riapri il browser, accedi, usa Halley e verifica l ente.',a),[]);
});
test('servizio: dati noti sufficienti, resta soltanto l orario',()=>{
  const a=analizza('UNIMONEY mostra 503 Service Unavailable, anche due colleghi sono bloccati e la scadenza e oggi.');
  assert.equal(a.tema,'servizio-indisponibile');
  assert.deepEqual(a.guide,[]);
  assert.ok(a.fatti.errore && a.fatti.diffusione && a.fatti.urgenza);
});

test('X-Desk completato: due dettagli anche quando le richieste non hanno punti interrogativi',()=>{
  const a=analizza('Dopo il cambio di ente in X-Desk ho salvato, usato ESCI, chiuso tutte le finestre e riaperto Halley. Ancora bloccato.');
  assert.equal(a.fase,'raccolta-per-ced');
  assert.deepEqual(a.domande,['ente atteso','punto in cui si blocca']);
  assert.ok(verifica('La procedura completa e gia stata eseguita. Mi servono l ente atteso, il punto esatto del blocco e il messaggio di errore.',a).length);
  assert.ok(verifica('Quali sono ente atteso, punto del blocco e messaggio visualizzato?',a).length);
  assert.deepEqual(verifica('La procedura non ha risolto. Per preparare il testo al CED, indicami l ente atteso e il punto in cui si blocca.',a),[]);
  assert.ok(verifica('Chiudi tutte le finestre e riapri il browser.',a).length);
});
test('documento: estensione da chiarire senza promettere una verifica firma',()=>{
  const a=analizza('Con quale programma apro un PDF firmato?');
  assert.ok(verifica('Qual e l estensione? Una volta ricevuta potrai verificare la firma.',a).length);
  assert.deepEqual(verifica('Nelle fonti disponibili manca il programma adatto. Qual e l estensione completa del file?',a),[]);
});
test('preparare il testo non equivale a registrare una richiesta',()=>{
  const a=analizza('La cornetta gracchia ma il vivavoce si sente bene.');
  assert.ok(verifica('Procediamo con l inserimento nella pratica.',a).length);
  assert.deepEqual(verifica('Indica la sede per preparare il testo; invierai tu la richiesta.',a),[]);
  assert.ok(verifica('Segnalo il multifunzione al CED.',analizza('La vaschetta toner e piena.')).length);
  assert.deepEqual(verifica('Segnala il multifunzione al CED.',analizza('La vaschetta toner e piena.')),[]);
});
test('i dati gia completi degli allegati passano alla segnalazione, senza altri identificativi',()=>{
  const a=analizza('Outlook desktop non salva tutti gli allegati: Accesso negato.');
  assert.equal(a.fatti.ambitoAllegati,'Tutti gli allegati');
  assert.equal(a.fase,'segnalazione');
  assert.deepEqual(a.domande,[]);
});
test('la descrizione del problema in chat non diventa una richiesta gia inviata',()=>{
  const a=analizza('Nessun errore in Outlook desktop; ho gia riavviato.');
  assert.ok(verifica('Riporta lo stato insieme alla segnalazione gia fornita al CED.',a).length);
  assert.deepEqual(verifica('Annota l esito per preparare una richiesta al CED che invierai tu.',a),[]);
});
