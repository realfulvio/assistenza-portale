# Registro delle modifiche

Il formato segue [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/) e il progetto usa il [versionamento semantico](https://semver.org/lang/it/).

## [2.5.6] - 2026-10-29

### Novità per gli utenti

- Assistente più grande: 190 × 199 pixel su PC e 120 × 126 pixel sugli schermi piccoli.
- Più distanza dai bordi e ombra più visibile per distinguere l’assistente dal piè di pagina, mantenendolo fisso in basso a destra nella finestra.
- Altezza della chat adattata alle nuove dimensioni, con disposizione laterale sulle finestre basse.

## [2.5.5] - 2026-10-29

### Novità per gli utenti

- Riconosciute anche domande brevi su screenshot e audio nelle chiamate, senza richiedere parole aggiuntive per attivare l’assistente.
- Corretto il cambio di argomento fra screenshot, audio e recupero password nella stessa conversazione.
- Recupero password distinto dai problemi di invio della posta; informazioni sull’identità aziendale configurabili e disattivate per default, senza applicarle agli account personali.
- Le risposte di questi percorsi continuano a essere generate da Qwen.

## [2.5.4] - 2026-10-29

### Novità per gli utenti

- Risposte generate da Qwen con contesto più breve, senza ripetizioni dei fatti e senza esempi storici estranei nelle domande generiche.
- Guide selezionate per argomento e riferimenti Microsoft per i concetti su memoria, archiviazione, condivisione e sincronizzazione.
- Conservati programmi e verifiche già citati; una semplice lentezza non diventa un blocco nella risposta.
- Permanenza del modello configurabile, con valore predefinito di 5 minuti; contesto ridotto per le domande brevi senza aumentare i limiti di risorse.

## [2.5.3] - 2026-10-29

### Novità per gli utenti

- Riconosciuti anche messaggi brevi sulla stampante con un comune refuso di digitazione.
- Verificata la continuità della conversazione quando si passa dalla stampa alla lingua di Windows.

## [2.5.2] - 2026-10-29

### Novità per gli utenti

- L’assistente distingue stampanti assenti, apertura degli allegati, lingua di Windows, credenziali rifiutate, caricamento di documenti firmati e servizi non disponibili.
- I dettagli già forniti restano nel contesto: browser utilizzato, prove eseguite, formato del file ed esito sui PC dei colleghi.
- Percorsi guidati disponibili senza attendere il modello; guide collegate soltanto quando pertinenti al sintomo.
- Nessuna diagnosi di manutenzione dedotta dal solo errore 503 e nessun invio automatico delle richieste.

### Sicurezza

- Dipendenza `qs` aggiornata alla 6.16.2; verifiche di sicurezza mantenute attive nella CI.

## [2.5.1] - 2026-10-28

### Novità per gli utenti

- Cedro usa la sua icona ufficiale ed è collocato in fondo ai Link utili.
- Immagini locali e posizionamento finale configurabili per le schede dei servizi; aggiornata l’icona VDI nelle installazioni che la prevedono.

## [2.5.0] - 2026-10-28

### Novità per gli utenti

- Link utili: nuova scheda Cedro per la conversione dei file sul PC.
- Nel menu Smart working è disponibile il progetto open source Smart Working Istituzionale su GitHub.

- Il tema **Spazio** è sostituito da **Halloween**: zucca in testata, fantasma che avanza a ogni passo, icone delle categorie a tema, cimitero con lanterne-zucca, fantasmi e pipistrelli animati, cappello da strega sulla mascotte. Chi aveva scelto Spazio vede il Classico.
- Voce «Admin panel» nella barra in alto, visibile solo agli amministratori indicati nella configurazione del server (`ADMIN_EMAILS`, `ADMIN_PANEL_URL`).

## [2.4.1] - 2026-10-22

### Novità per gli utenti

- Aggiornato il pacchetto di assistenza SSH distribuito dall'organizzazione: installazione offline, attesa del servizio e strumento di disattivazione.
- Il download degli strumenti resta riservato agli utenti autenticati.

### Distribuzione

- I pacchetti operativi e le relative configurazioni restano separati dai sorgenti pubblici.

## [2.4.0] - 2026-10-21

### Novità per gli utenti

- L'assistente ricorda meglio i dettagli già forniti e distingue controlli da eseguire e tentativi già completati.
- Risposte più pertinenti su posta, allegati, stampanti, telefono e accesso ai gestionali.
- Domande più brevi, al massimo due dettagli mancanti per turno, e indicazioni più chiare quando manca una guida.
- La preparazione del testo resta separata dall'invio della richiesta, che spetta all'utente.

### Distribuzione

- Schede, istruzioni ed esempi didattici configurabili in file locali; nella distribuzione soltanto esempi inventati.
- Modello e servizio di inferenza configurabili, con controlli di coerenza e test di regressione.

## [2.3.1] - 2026-10-21

### Novità per gli utenti

- Footer con icona GitHub, collegamento al progetto open source, licenza e crediti.
- Accesso rapido a Guide e FAQ, Contatti e mappa espandibile delle pagine del portale.
- Link utili ordinati per nome, con icone SVG locali e risorse secondarie accessibili al mouse, da tastiera e su telefono.
- Collegamenti raggruppati per gli accessi alternativi a uno stesso servizio.

### Distribuzione

- Esempi generici per calendari, tutorial e postazioni virtuali; configurazioni dell'organizzazione mantenute in un file locale escluso da Git.
- Il rilascio conserva anche config/link-utili.json.

## [2.1.0] - 2026-10-21

### Novità per gli utenti
- Assistente animato con chat, contatti, proprie richieste e preparazione del testo.
- Risposte sulle guide con un modello locale facoltativo.
- Pagina Link utili configurabile e istruzioni generiche per l’assistenza remota.
- Novità del portale consultabili per versione.

### Distribuzione
- Presentazione aggiornata con schermate sintetiche della demo.
- Configurazioni dell’istanza separate e verifica automatica dei file pubblicabili.
- Istruzioni per scaricare, avviare, verificare e personalizzare i sorgenti.

## [Non rilasciato]

### Aggiunto
- **Numeri interni** in fondo alla pagina «Contatti»: elenco per sede o servizio, ricerca per nome, ufficio o numero, anche da telefono. I dati stanno in `content/numeri-interni.json`, file locale non versionato (nel repository solo un esempio con dati inventati; senza file la sezione non compare). `scripts/numeri-interni-da-csv.js` prepara il file da un foglio Excel; `scripts/rilascio.sh` lo conserva negli aggiornamenti.

### Rimosso
- Cinque temi dal selettore «Aspetto»: Cyberpunk, Terminale, Retro, Hawaii e Nebbia padana. Restano Classico, Spazio, Giardino, Autunno, Scuro, Contrasto elevato e Montagna, in un elenco unico (senza «Altri temi»). Tolti anche i loro CSS, le icone, i disegni animati e il font Press Start 2P.
- Le preferenze già salvate con uno dei temi tolti ricadono sul Classico, senza errori e senza dover riscrivere i file.

## [2.0.0] - 2026-10-19

Aggiornamento di interfaccia: nuova pagina «Nuova richiesta», richieste a conversazione, riepilogo PDF, temi animati e foto profilo. Nessuna modifica a regole, notifiche o configurazione di GLPI.

### Aggiunto
- **Versioni**: file `VERSION` come fonte unica, mostrata nel piè di pagina; cliccando la versione si apre il pannello «Novità». Regole nel README, sezione «Versioni».
- **Temi animati** Classico, Hawaii, Spazio, Giardino e Retro, con icona di testata, indicatore di avanzamento, decorazione sopra il piè di pagina e particelle di conferma. I temi 1.x (Scuro, Contrasto elevato, Cyberpunk, Montagna, Terminale, Nebbia padana) restano, con gli stessi id e le preferenze già salvate. Palette in `scripts/genera-temi.js` (genera `public/theme.css` e verifica i contrasti, minimo 4,5:1).
- **Pannello Aspetto** sotto la barra: Tema, Dimensioni (Piccole/Normali/Grandi) e Spaziatura (Compatta/Normale/Ampia), salvati nell'account. Le altre opzioni di leggibilità restano in «Altre opzioni».
- **Nuova richiesta** ridisegnata: testata con avanzamento, quattro passi, sette caselle, pulsanti rapidi per categoria (`rapidi` e `temaColore` in `config/categorie.json`; il pulsante scelto diventa la prima riga del ticket), «Quando sei raggiungibile?» e conferma animata.
- **Richieste a conversazione**: avanzamento a quattro tappe, «Gestita da», tecnici a sinistra, tu a destra, sistema al centro, con foto o iniziali. Solo contenuti pubblici: note e attività private non compaiono e non determinano «Gestita da». Lettura degli utenti in blocco, nessuna email esposta.
- **Riepilogo PDF** A4 (`GET /api/richieste/:id/pdf`, `pdfkit`, nessun browser) e **Stampa** in bianco e nero.
- Foto profilo, barra «Live» e guide (vedi sotto).
- `.gitattributes` con fine riga LF per script e file di configurazione.

### Modificato
- Tutti i colori dell'interfaccia passano da variabili dei temi; i colori dell'ente in `config/ente.json` valgono per il tema Classico.
- Font Press Start 2P (licenza SIL OFL) in locale per il tema Retro: nessuna richiesta a CDN.

### Corretto durante la stabilizzazione
- Archivio persistente incluso nell'unità systemd standard (`StateDirectory`, directory private), con istruzioni di migrazione e backup di preferenze e foto.
- Limite di frequenza condiviso tra upload e aggiornamento forzato della foto Microsoft, legato all'identità OIDC.
- Aggiornamento di `sharp` a 0.35.5 e requisito Node almeno 20.19.
- Contrasti della categoria selezionata, dei crediti e del numero Live di Hawaii e degli orari nelle conversazioni di Giardino; focus visibile; layout Retro e categorie delle guide con caratteri ingranditi su mobile.
- PDF: descrizioni e singoli messaggi lunghi continuano su più pagine senza sovrapporsi al piè di pagina.
- Messaggi/conferme del portale attribuiti al richiedente in GLPI; firme storiche conservate quando l'autore è ancora l'account API; riconciliazione dell'autore visualizzato degli esiti, anche con nomi OIDC/GLPI in ordine diverso.
- Nessun retry automatico delle scritture GLPI dopo timeout o risposta persa, per evitare duplicati.
- Cronologia GLPI paginata, compresi gli eventi oltre i primi 200; nomi letti in blocchi; visibilità dei contenuti pubblici controllata esplicitamente.
- Profilo API documentato con il diritto di vedere le attività pubbliche.
- Token CSRF non validi con caratteri multibyte restituiscono 403.
- Controllo `verifica:rilascio` sull'HTML effettivamente servito e sui CSS/script, con prove negative per riprodurre il porting incompleto.
- QA browser aggiornata alla UI v2, dipendenze di sviluppo dichiarate, controlli dei CSS generati nel lint e test browser/PDF previsti in CI.

### Versioni precedenti (1.x)

Portale per aprire e seguire richieste su GLPI con accesso OpenID Connect, consigli prima dell'invio, nome del PC e dati tecnici nel ticket, conferma della soluzione dalla mail, personalizzazione dell'ente e, tra le novità di fine ciclo, guide 2.0, barra «Live», foto profilo e preferenze di aspetto per account.

## [Unreleased]

### Aggiunto
- Foto profilo in «Il mio profilo» e nella barra in alto: foto personale (JPG/PNG/WebP fino a 3 MB, ritaglio centrato 128×128 WebP senza metadati con `sharp`) con precedenza sulla foto di Microsoft 365 (Graph `/me/photo/$value` al login, ogni 7 giorni, con `User.Read`), altrimenti iniziali. Rotte `/api/profilo/foto*` solo sulla propria foto, CSRF, 10 caricamenti l'ora. Nuovi `src/avatar.js`, `public/avatar.css`, `public/avatar.js`, `test/avatar.test.js`; opzioni `AVATAR_DIR`, `AVATAR_SYNC_GIORNI`.
- Barra «Live»: nuovo periodo `giorni` (ultimi N giorni, `barraLive.giorni` o `STATS_GIORNI`), ora predefinito con 30 giorni: «N richieste negli ultimi 30 giorni».
- Barra «Live» sotto il menu: richieste del periodo con sparkline dei 7 giorni, risolte, in lavorazione, presa in carico media, messaggi a rotazione e linea della percentuale risolte. Nuovo endpoint `GET /api/stats` (solo login, numeri aggregati, cache in memoria di 5 minuti, `killSession` a ogni aggiornamento, `{ok:false}` se GLPI non risponde). Opzioni in `barraLive` di `config/ente.json` o `STATS_*` nel `.env`. Nuovi `src/stats.js`, `public/stats-bar.css`, `public/stats-bar.js`, `test/stats.test.js`.
- Guide (FAQ) 2.0: 30 guide con passi numerati, controlli, risultato atteso, «quando fermarti» e «quando aprire una richiesta»; ricerca istantanea, filtri per argomento, link diretti `#faq/<id>`, immagini ingrandibili (`<dialog>` nativo), collegamento dai consigli del modulo. Formato `{ d, r }` ancora valido. Nuovi `public/faq.js`, `scripts/verifica-faq.js` (anche in `npm run lint`) e test (`test/faq.test.js`, `test/faq-browser.test.js`, quest'ultimo con `puppeteer-core` e Chrome, saltato se assenti). Elenco di immagini e verifiche ancora aperte in `docs/faq-da-completare.md`.
- Banner, percorso visivo e screenshot aggiornati della demo con dati inventati, con diagramma del ruolo di GLPI e sorgenti SVG delle composizioni.
- Guida alla fiducia della CA interna sui PC Windows in dominio (`docs/https-ca-dominio.md`): distribuzione del solo certificato pubblico, impronta esatta, ambito GPO e Computers, browser e diagnosi su una singola postazione, con limiti delle verifiche espliciti.
- Guida al flusso dei ticket per i tecnici GLPI (`docs/flusso-ticket-tecnici.md`): Risposta, note private, Attività, stati, ricerca dei ticket chiusi e distinzione tra chiusura automatica ed eliminazione.
- Esempio CSS opzionale per l'altezza minima della nuova Risposta nei ticket GLPI 11.0.8, con istruzioni per la personalizzazione nativa dell'entità, prove osservate e rollback.

### Modificato
- README riorganizzato per spiegare il portale, il percorso del dipendente, il lavoro dei tecnici, i vantaggi e l'accesso alla demo locale; mantenuti requisiti, installazione, guide, sicurezza e crediti. Nessuna modifica al comportamento del portale.
- Guida di creazione della CA: corretti i riferimenti generali ad autofirmati e durata del certificato; rimossa l'indicazione di disabilitare la revoca. Distribuzione e diagnosi client consolidate nella nuova guida di dominio; guida tecnici precedente mantenuta come indice verso il flusso aggiornato.
- Collegamenti dal README e nuovo indice delle guide. Solo documentazione e personalizzazione opzionale del backend GLPI: codice e versione del portale invariati.

## [1.1.0] - 2026-10-13

### Aggiunto
- Nome del PC dall'indirizzo (`?pc=NOMEPC`, parametro configurabile con `PC_PARAM`), IP (da `X-Forwarded-For` del reverse proxy) e browser/sistema in coda al ticket; script PowerShell per l'icona sul desktop via GPO (`deploy/gpo/`).
- Incolla screenshot con Ctrl+V negli allegati (nome automatico, miniatura, limiti invariati).
- Consigli prima di inviare (`content/suggerimenti.json`), al massimo 2, senza bloccare l'invio.
- Mail: pulsante «Apri la richiesta»; nella mail «Chiamata risolta» pulsanti «Risolto, grazie» / «Non è risolto, riapri» con conferma nel portale (approvazione/rifiuto della soluzione in GLPI).
- `MAX_TICKETS_PER_HOUR` già configurabile; documentata la scelta tra ticket «Nuova» e assegnati subito (`GLPI_GROUP_ID`).

### Modificato
- Notifiche: nessuna mail «Chiusura» quando la chiusura è quella automatica di GLPI (regola nel trigger facoltativo); restano quelle manuali e la conferma «Risolto, grazie».
- Notifiche: oggetto «Richiesta n. N · Stato · titolo» e destinatari per assegnazione (casella condivisa solo senza tecnico assegnato) tramite il trigger facoltativo `deploy/glpi/trigger-anti-duplicati.sql`; documentati i destinatari reali di GLPI 11.
- Testo dello stato «Risolta»: rimanda ai pulsanti di conferma/riapertura.
- Guida HTTPS: CA interna + certificato del sito (`docs/certificati-ca-interna.md`) al posto del certificato autofirmato.
- Testo dello stato «In attesa»: «Abbiamo ricevuto la tua richiesta, a breve la prenderemo in carico.»

## [1.0.0] - 2026-10-13

Prima versione pubblica.

### Aggiunto
- Apertura delle richieste in tre passi: scelta del problema (caselle colorate), descrizione guidata, invio.
- «Le mie richieste» con stati (In attesa, In lavorazione, In sospeso, Risolta, Chiusa), dettaglio e messaggi al tecnico.
- Allegati (numero, dimensione e tipo configurabili, controllo del tipo reale del file).
- Accesso con OpenID Connect generico (Microsoft Entra ID come esempio principale), con limitazione facoltativa a tenant, gruppo o dominio e-mail.
- Integrazione con GLPI tramite API REST e utente di servizio; creazione automatica dei richiedenti con profilo Self-Service.
- Personalizzazione dell'ente in `config/ente.json` (nomi, logo, colori, testi, crediti), categorie in `config/categorie.json`, FAQ in `content/faq.json`.
- Modalità demo (`npm run demo`) con GLPI finto e accesso simulato.
- Modello HTML delle notifiche GLPI, trigger anti-mail duplicate, profilo GLPI «Tecnico Ticket», esempi di configurazione Apache e systemd.
- Test automatici (`npm test`) e controllo minimo del codice (`npm run lint`).
