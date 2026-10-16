# Registro delle modifiche

Il formato segue [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/) e il progetto usa il [versionamento semantico](https://semver.org/lang/it/).

## [Unreleased]

### Aggiunto

- Barra «Live» sotto il menu: richieste del periodo con sparkline dei 7 giorni, risolte, in lavorazione, presa in carico media, messaggi a rotazione e linea della percentuale risolte. Nuovo endpoint `GET /api/stats` (solo login, numeri aggregati, cache in memoria di 5 minuti, `killSession` a ogni aggiornamento, `{ok:false}` se GLPI non risponde). Opzioni in `barraLive` di `config/ente.json` o `STATS_*` nel `.env`. Nuovi `src/stats.js`, `public/stats-bar.css`, `public/stats-bar.js`, `test/stats.test.js`.
- Guide (FAQ) 2.0: 30 guide con passi numerati, controlli, risultato atteso, «quando fermarti» e «quando aprire una richiesta»; ricerca istantanea, filtri per argomento, link diretti `#faq/<id>`, immagini ingrandibili (`<dialog>` nativo), collegamento dai consigli del modulo. Formato `{ d, r }` ancora valido. Nuovi `public/faq.js`, `scripts/verifica-faq.js` (anche in `npm run lint`) e test (`test/faq.test.js`, `test/faq-browser.test.js`, quest'ultimo con `puppeteer-core` e Chrome, saltato se assenti). Elenco di immagini e verifiche ancora aperte in `docs/faq-da-completare.md`.
- Guida alla fiducia della CA interna sui PC Windows in dominio (`docs/https-ca-dominio.md`): distribuzione del solo certificato pubblico, impronta esatta, ambito GPO e Computers, browser e diagnosi su una singola postazione, con limiti delle verifiche espliciti.
- Guida al flusso dei ticket per i tecnici GLPI (`docs/flusso-ticket-tecnici.md`): Risposta, note private, Attività, stati, ricerca dei ticket chiusi e distinzione tra chiusura automatica ed eliminazione.
- Esempio CSS opzionale per l'altezza minima della nuova Risposta nei ticket GLPI 11.0.8, con istruzioni per la personalizzazione nativa dell'entità, prove osservate e rollback.

### Modificato

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
