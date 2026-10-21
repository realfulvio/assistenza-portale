# Stabilizzazione della v2.0 — 16 ottobre 2026

> **Aggiornamento del 2026-10-19:** il report descrive lo stato del 16 ottobre. La v2.0.0 è poi stata collaudata e messa in produzione il 2026-10-19 ed è stata pubblicata su GitHub (merge della PR 5, tag e release `v2.0.0`). Le frasi qui sotto su «da collaudare» e «nessun merge, tag o release» valgono per la data del report. Vedi [v2-sospesa.md](v2-sospesa.md).

## Esito e ambito

Il lavoro è nella copia di sviluppo, ramo
`fix/v2-stabilizzazione`, a partire da `v2.0` (`8b727852`). Sono stati corretti i
problemi riproducibili elencati sotto. Il server Debian del lavoro non è stato
contattato né modificato. Nessun push, merge su `main`, tag o release.

La versione rimane **da collaudare sulla copia effettiva di destinazione**:
questa usa Express 5/MSAL, mentre il repository usa Express 4/OIDC. Lo script
usato per il precedente porting/rollback non è presente nel repository.

## Il problema che aveva fermato il rilascio

La PR 5 e le
[note del rollback](v2-sospesa.md) descrivono un trasferimento manuale nel quale
mancavano i collegamenti a `theme.css` e `temi.css` nell'HTML di produzione.
Il repository li conteneva già correttamente; la CI risultava verde.

La mancanza è stata riprodotta nel browser sulla demo, togliendo quei collegamenti
dalla pagina servita: `--card`, `--text` e `--line` diventano vuote. Ripristinando i
collegamenti tornano rispettivamente `#ffffff`, `#191919` e `#dde3ea` nel Classico.
Le schermate prima/dopo sono in `artifacts/v2-browser/porting-*.png` nella copia di sviluppo.

**Questo dimostra il difetto simulato, non conferma la causa storica sul server.**
Non sono disponibili qui l'HTML effettivamente servito al momento del guasto, i
suoi log o la copia del porting. Anche il doppio rollback citato nelle vecchie
note resta da verificare sullo script originale.

È stato aggiunto `npm run verifica:rilascio -- URL`: controlla in sola lettura la
pagina finale, i segnaposto, i CSS e gli script obbligatori, stato HTTP, tipo dei
contenuti e presenza delle variabili dei temi. Rileva anche una risposta HTML
con HTTP 200 al posto di un CSS. Il controllo non effettua login, invii o deploy.

## Problemi corretti

| Area | Difetto | Correzione e prova |
|---|---|---|
| Persistenza in produzione | `ProtectSystem=strict` rendeva non scrivibile l'archivio predefinito sotto `/opt`. | `StateDirectory` privata nell'unità standard; percorsi espliciti per preferenze e foto. Upload e salvataggio provati su Debian con codice in sola lettura e utente senza privilegi, directory 0700 e file 0600. |
| Backup e migrazione | La documentazione dichiarava che il portale non salvasse dati e ometteva preferenze/foto. | Guide aggiornate con tutti i file di profilo, percorsi personalizzati, migrazione e conservazione dei dati durante il rollback. Nessuna procedura eseguita sul server operativo. |
| Attività GLPI | Il profilo API documentato non concedeva il diritto di leggere le attività pubbliche. | Aggiunto `Task/SEEPUBLIC` alle istruzioni, senza richiedere accesso alle attività private; filtro dei privati verificato anche tramite il client HTTP operativo. |
| Foto Microsoft | Il refresh forzato aggirava il limite dei caricamenti manuali. | Limite condiviso di 10 operazioni/ora per identità OIDC, anche tra sessioni diverse; prova che dopo il limite non partano altre richieste Graph. |
| Libreria immagini | `sharp` 0.34.4 aveva vulnerabilità note. | Aggiornata a 0.35.5; audit senza vulnerabilità rilevate e prove di decodifica, ridimensionamento e rimozione dei metadati. |
| Contrasti | Categoria selezionata, crediti della testata, numero Live Hawaii e orari della conversazione Giardino non sempre leggibili. | Colori corretti, focus adattato al contesto e controlli aggiunti al generatore delle palette. |
| Mobile e testo grande | Retro usciva dallo schermo a 390/320 px; le etichette lunghe delle guide allargavano la pagina. | Contenitori flessibili e guide su griglia con categoria sotto il titolo su mobile; prove anche con testo/icone 150%, dimensioni grandi e spaziatura ampia. |
| PDF lunghi | Descrizioni e singoli messaggi molto lunghi potevano invadere il piè di pagina. | Spazio riservato al footer e righe della cronologia continuate su più fogli; verifica visiva e controllo del testo estratto e delle coordinate con Poppler. |
| Autori dei messaggi | GLPI poteva attribuire i messaggi del portale all'account di servizio. | Autore esplicito dal richiedente verificato lato server; le firme storiche vengono conservate se non coincidono con l'autore restituito da GLPI. |
| Esiti delle soluzioni | GLPI registra l'approvazione/rifiuto con l'account della sessione API, anche con autore corretto nel followup. | La conversazione riconcilia soltanto il followup pubblico del richiedente vicino all'esito, con il testo esatto scritto dal server; niente messaggio duplicato. L'audit nativo GLPI resta invariato. |
| Cronologia e nomi | Dettagli tagliati ai primi 200 eventi e nomi limitati a 50 utenti. | Lettura delle pagine usando `Content-Range`, anche se GLPI limita la dimensione della pagina; utenti in blocchi di 50; login email non usato come nome di ripiego. |
| Scritture GLPI | Un timeout/una risposta persa poteva provocare la ripetizione di un POST già applicato. | Nessun retry automatico delle scritture per errori di rete; rimangono rinnovo della sessione su 401 e retry delle letture. Prova con connessione interrotta dopo il POST. |
| CSRF | Un token multibyte errato della stessa lunghezza in caratteri poteva causare errore interno. | Confronto sulla lunghezza in byte prima di `timingSafeEqual`; risposta 403 verificata. |
| Verifiche del progetto | Test browser saltati senza Chrome; QA Aspetto ancora basata sui selettori 1.x; CSS generati non controllati; metadati npm ancora 1.1.0. | Browser e axe dichiarati tra le dipendenze di sviluppo; QA v2 aggiornata; lint dei file generati; CI predisposta con browser/Poppler; metadati coerenti con `VERSION`. |
| Fine riga | Alcuni file erano ancora CRLF nonostante `.gitattributes` dichiarasse LF, risultando modificati appena clonati. | Normalizzazione separata nel commit `7cd87be`, senza cambiamenti di contenuto. |

## Verifiche eseguite

| Verifica | Risultato |
|---|---|
| Suite completa su Node 20.20.2, 22.23.3 e 24.22.0, macchina di sviluppo Linux | 70/70 per ciascuna versione, nessun test saltato. Log in `.cache/node20.log`, `.cache/node22.log`, `.cache/node24.log`. |
| Installazione pulita su Debian 13, Node del sistema, Chromium e Poppler | 70/70, nessun test saltato, Node 20.19.2; log in `.cache/debian-final.log`. Ulteriori regressioni finali sul modello/client verificate in Debian senza privilegi. |
| Interfaccia nel browser | 66 combinazioni: 11 temi × 3 viewport (1440/390/320) × dimensioni normali/massime, mantenendo modulo e allegato. |
| Scansioni axe | 264 scansioni, zero violazioni rilevate. È una verifica automatica, non una certificazione di accessibilità completa. |
| Pulsanti PDF/stampa su mobile | Ulteriori 33 verifiche (11 temi × 3 viewport) a dimensioni massime; etichette intere e nessun testo fuori dal pulsante. |
| Flussi UI | Invio con allegato, risposta, download PDF, stampa, caricamento/rimozione foto, persistenza preferenze, errore/riprova, movimento ridotto, logout e isolamento tra account: superati. |
| Ambiente con codice in sola lettura | Preferenze HTTP 200, foto HTTP 200, permessi privati corretti; eseguito in contenitore Debian senza rete e senza privilegi. Non è un avvio reale di systemd. |
| Controllo rilascio | Comando CLI provato sulla demo servita: tutti i 15 CSS/script validi. Test negativi per collegamenti mancanti/commentati e HTML al posto del CSS. |
| Unità systemd | `systemd-analyze verify --man=no` senza errori; nessun servizio installato o abilitato sull'host. |
| Dipendenze | `npm audit --omit=dev`: zero vulnerabilità rilevate alla data della prova. |
| Lint | Sintassi, JSON, 68 guide e coerenza dei CSS generati: superato. |
| Git | `git diff --check` senza errori. |

Le schermate e il rapporto automatico sono in `artifacts/v2-browser/`; i PDF di
stress e le relative immagini sono in `artifacts/pdf/`. Queste directory e i log
sono esclusi da Git. Le immagini sono state controllate anche tramite tavole di
confronto degli 11 temi e rendering delle pagine PDF lunghe.

La CI GitHub è stata aggiornata nel ramo locale, ma non eseguita su GitHub:
non è stato effettuato alcun push.

## Come ripetere le prove

```bash
cd <cartella-del-repo>
npm ci
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npx playwright install chromium
npm run lint
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm test
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm run test:aspetto
npm audit --omit=dev
```

Per la prova geometrica dei PDF serve anche `pdftotext` (Poppler); nel contenitore
Debian è stato installato ed eseguito. Con `QA_BROWSER=chrome` o `msedge` si può
usare un browser già installato al posto di quello scaricato da Playwright.

## Prima della pubblicazione sul server del lavoro

1. Recuperare la copia effettiva Express 5/MSAL e lo script originale di porting/rollback.
2. Preparare una copia di collaudo di quella linea e applicare gli adattamenti mantenendo accesso e configurazione esistenti.
3. Verificare l'HTML/risorse effettivamente serviti con il nuovo comando, e controllare a vista desktop e telefono.
4. Provare accesso Entra reale, permessi GLPI, attività pubbliche/private, allegati, autore dei messaggi ed esiti delle soluzioni.
5. Verificare backup, dati dei profili e rollback sullo script originale; solo dopo decidere il rilascio.

Nessun ticket o messaggio è stato inviato a GLPI reale e nessuna richiesta è stata
inviata a Microsoft Graph reale. Le prove HTTP del client operativo usano un
server GLPI fittizio su loopback; il browser usa la modalità demo.

## Riferimenti tecnici

- [GLPI 11.0.8 — diritti di lettura delle attività](https://github.com/glpi-project/glpi/blob/11.0.8/src/CommonITILTask.php).
- [GLPI 11.0.8 — autore dei followup](https://github.com/glpi-project/glpi/blob/11.0.8/src/ITILFollowup.php) e [audit degli esiti](https://github.com/glpi-project/glpi/blob/11.0.8/src/CommonITILObject.php).
- [Sharp 0.35.5 — rilascio ufficiale](https://sharp.pixelplumbing.com/changelog/v0.35.5/).
