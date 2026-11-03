# Assistente locale

Il personaggio animato apre una chat con quattro percorsi: guide, contatti, proprie richieste e preparazione della descrizione. La sessione è individuale; le API richiedono autenticazione e CSRF per le scritture della conversazione. I dati delle richieste sono recuperati con gli stessi controlli del portale. Il modello viene usato soltanto per le risposte sulle guide, con fonti collegate: non riceve un elenco generale di ticket o la rubrica completa.

Il testo preparato rimane nella chat e va copiato nel modulo dall’utente. Non ci sono invii o chiusure automatiche.

## Avvio senza modello

`npm run demo` include contatti inventati e ticket simulati. Chiedi «Mostra le mie richieste» oppure premi il pulsante per preparare una richiesta. Le risposte generative non sono disponibili finché non configuri Ollama; la pagina Guide rimane utilizzabile.

## Ollama facoltativo

Installa Ollama seguendo le [istruzioni ufficiali](https://docs.ollama.com/quickstart). Su una macchina dedicata al test, scarica i modelli indicati nella configurazione:

```bash
ollama pull qwen3.5:4b-q4_K_M
ollama pull embeddinggemma-2:270m
```

I tag sono quelli predefiniti nell’integrazione; disponibilità, licenze dei modelli e requisiti hardware vanno verificati nel catalogo Ollama prima dell’installazione. Il repository non distribuisce pesi né garantisce prestazioni su ogni CPU. La prima risposta può richiedere tempo per caricamento e indicizzazione.

Nel `.env` esistente sono disponibili `ASSISTENTE_URL` (predefinito `http://127.0.0.1:11434`), `ASSISTENTE_MODELLO`, `ASSISTENTE_EMBEDDING` e `ASSISTENTE_CACHE_FILE`. L’esempio completo è in [`.env.example`](../.env.example). L’unità systemd inclusa imposta la cache in `/var/lib/portale-assistenza/assistente/indice.json`, dentro la directory persistente scrivibile del servizio. Se usi un’unità personalizzata, configura un percorso equivalente e autorizzane la scrittura.

Conserva Ollama su loopback o su una rete privata controllata. Il contenuto delle guide e le domande vengono inviati all’endpoint configurato: scegli un’istanza sotto il tuo controllo. Per escludere le funzioni cloud consulta la [FAQ ufficiale Ollama](https://docs.ollama.com/faq). Le chiamate usano le API ufficiali [chat](https://docs.ollama.com/api/chat) ed [embedding](https://docs.ollama.com/api/embed).

La cache viene aggiornata quando cambiano le guide. Se cambi il modello di embedding, elimina soltanto il file di indice configurato, a servizio fermo: sarà ricostruito alla domanda successiva. Non eliminare l’intera directory dati.

## Verifica

`node --test test/assistente.test.js` verifica contatti senza modello, preparazione del testo, isolamento dei ticket, CSRF, logout durante una risposta e aggiornamento delle fonti con un backend AI simulato. Queste prove non misurano la qualità delle risposte di un modello reale.


## Riassumere un testo

Il pulsante «Riassumi un testo» apre un'area separata dalla chat. Sono ammessi fino a 6.000 caratteri e 12.000 byte UTF-8; l'incolla troppo lungo viene rifiutato esplicitamente, senza tagli. Anche «riassumi: testo…» apre lo strumento. Il documento e la sintesi restano nella memoria della pagina e non entrano nella cronologia chat o nella bozza della richiesta. Il pulsante Copia richiede un gesto dell'utente; Annulla interrompe la chiamata al modello. Uscendo dall'account i dati dello strumento vengono cancellati.

Il testo viene inviato solo all'endpoint AI già configurato. Il servizio suddivide il documento in blocchi, li sintetizza e unisce le sintesi senza troncare l'originale. Usa il modello configurato, contesto 4096, quattro thread e un limite complessivo di 120 secondi, condividendo il blocco delle chiamate AI della chat. Non cerca guide e non consulta GLPI o il meteo. Rifiuta alcuni formati evidenti di credenziali; questo controllo non sostituisce la verifica del contenuto da parte di chi lo incolla. Verificare sempre date, cifre e passaggi essenziali del risultato.

## Dimensione del pannello

Il pulsante Allarga/Ripristina aumenta lo spazio disponibile. Sul desktop si può trascinare l'angolo superiore sinistro o, mettendo a fuoco la maniglia, usare le frecce (Maiusc per passi maggiori) e Home per ripristinare. Sul telefono il pulsante espande il pannello quasi a tutto schermo. Le dimensioni restano entro la finestra e durano per la pagina corrente; ridimensionare non modifica i messaggi o la bozza.

I pulsanti contestuali sono determinati dal portale, senza chiedere al modello di inventare azioni. Le risposte di assistenza con una guida collegata offrono «Non ho risolto» e «Prepara la richiesta». Il primo raccoglie l'esito della prova senza ripetere automaticamente la procedura; il secondo riprende i messaggi dell'utente pertinenti e avvia la preparazione guidata del testo, da controllare e copiare manualmente. Nessun ticket viene inviato da questi pulsanti.

«Segnala risposta» consente di scegliere un motivo e aggiungere una nota di massimo 500 caratteri. Solo lo scambio segnalato e le relative fonti vengono salvati sul server, senza nome, email o intera cronologia. L'avviso nel modulo chiarisce cosa verrà conservato. I feedback non addestrano automaticamente il modello.

La pagina «Feedback assistente» è riservata agli account in ADMIN_EMAILS, anche senza ADMIN_PANEL_URL, e consente di filtrare e segnare le segnalazioni come verificate. Le API richiedono autenticazione, autorizzazione amministrativa per la lettura/verifica e CSRF sulle scritture. Gli invii sono limitati e deduplicati per scambio e identità di sessione.

ASSISTENTE_FEEDBACK_FILE permette di scegliere un percorso fuori dalla directory pubblica e scrivibile dal servizio. Predefinito Linux non demo: /var/lib/portale-assistenza/assistente/feedback.json, compatibile con StateDirectory del servizio distribuito. In demo/Windows: data/feedback-assistente[-demo].json. Archivio con scrittura atomica e permessi600, massimo1000 segnalazioni; conservazione90 giorni, con rimozione degli elementi scaduti al successivo accesso. Includerlo nei backup riservati, mai nei sorgenti pubblici. Gli amministratori vedono i dati dello scambio segnalato: evitare credenziali e dati non necessari anche nella domanda.

Dopo una battuta spontanea o una nuova risposta di tipo svago la mascotte sorride e ride per circa due secondi, senza audio. Non si riattiva leggendo una vecchia conversazione. Le preferenze di movimento ridotto mantengono soltanto il sorriso statico.
