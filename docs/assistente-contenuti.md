# Contenuti dell'assistente locale

L'assistente recupera guide correnti e può ricevere esempi didattici. Non addestra i pesi del modello. I messaggi della sessione restano distinti dagli esempi; un episodio passato non prova la causa o lo stato attuale di un servizio. Le operazioni sulle richieste richiedono sempre l'azione dell'utente.

La distribuzione include solo file `content/assistente-*.example.*`: esempi inventati, nessuna mail o dato di un'installazione. Per personalizzare, copiare questi file togliendo `.example` dal nome. I file locali sono esclusi da Git e prevalgono sui corrispondenti esempi. Non inserirvi password, codici, rubriche o mail integrali; usare sintesi minime approvate dall'organizzazione. Le schede possono collegare solo ID di FAQ esistenti. Le istruzioni e le procedure devono essere revisionate da chi gestisce il servizio.

`ASSISTENTE_ESEMPI=1` abilita il recupero degli esempi. `ASSISTENTE_RISPOSTE_GUIDATE=0` usa la generazione con contesto e controlli di coerenza anche per i casi ordinari; i controlli essenziali su credenziali e operazioni pericolose restano attivi. `ASSISTENTE_KEEP_ALIVE=0` scarica il modello dalla RAM dopo ogni chiamata, aumentando il tempo di risposta. Indirizzo del servizio, modello ed embedding sono configurabili con le variabili nel file `.env.example`.

Le variabili già presenti nel processo prevalgono sul file `.env`: anche un override del gestore del servizio può quindi disattivare i percorsi guidati. Le prove di rilascio devono usare i valori effettivi del processo in servizio, senza stampare l'intero ambiente perché può contenere credenziali. Verificare sia le frasi complete sia messaggi brevi e cambi di argomento nella stessa conversazione.

La generazione usa un contesto compatto per le domande generiche: fonti pertinenti, fatti utente e vincoli compaiono una sola volta. Le spiegazioni concettuali non ricevono guide di guasto estranee; quando disponibili ricevono riferimenti informativi Microsoft, distinti dalle procedure. Il testo finale continua a essere prodotto dal modello, non dai riferimenti. I prompt brevi usano un contesto di 2048 token; i casi più lunghi conservano quello di 4096.

Il valore predefinito di `ASSISTENTE_KEEP_ALIVE` è `5m`: mantiene il modello disponibile per domande vicine, a costo di conservarne l'occupazione RAM durante quel periodo. `0` lo scarica dopo la risposta. Non aumentare i limiti di memoria per compensare questa scelta: misurare consumo e picco sull'installazione, mantenere margine per gli altri servizi e distinguere primo caricamento dalle richieste successive.

Le fonti del modello non vanno esposte come risorse statiche. Il rilascio conserva i quattro file locali; il backup deve includere anche la cache dell'indice se si desidera un ripristino immediato. L'indice si aggiorna automaticamente quando cambiano i contenuti. I riferimenti a prodotti nei moduli sono riconoscitori di argomenti, non procedure amministrative: il comportamento operativo dipende dalle FAQ correnti dell'installazione.

Prima della pubblicazione eseguire i test e la verifica dei file pubblicabili. Le regole testuali riducono errori noti, senza garantire la correttezza di ogni risposta nuova. Non eseguire test creando ticket reali.
