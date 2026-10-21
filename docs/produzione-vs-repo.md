# Produzione e repository: differenze note e strada scelta

Questa pagina serve a chi installa o aggiorna il portale su un server che **non** è nato da questo repository.
Non contiene dati del Comune: nomi host, indirizzi, account e valori di configurazione restano sul server.

## Situazione (17 ottobre 2026)

Il rilascio v2.0.0 era stato installato in produzione e annullato subito con il rollback: l'interfaccia «si vedeva
tutta rotta». La produzione non esegue il codice di questo repository ma un'altra linea di codice, adattata a mano;
la v2 vi era stata portata con uno script, poi andato perso. Il server non era raggiungibile durante la ripresa del
lavoro (fase A, da remoto): la mappa qui sotto distingue ciò che è **noto** da ciò che va **verificato in fase B**
(vedi [fase-b.md](fase-b.md)).

## Mappa delle differenze

| Aspetto | Repository (v2.0) | Produzione (noto) | Da verificare in fase B |
|---|---|---|---|
| Struttura | `src/` (server Express), `public/` (pagina unica e risorse), `config/`, `content/` | linea di codice separata, file adattati a mano | percorso dell'app, file aggiunti o tolti rispetto al repository, unità systemd |
| Framework | Express 4 (`express@^4.22`) | Express 5 | versione esatta, rotte con sintassi diversa (Express 5 usa `path-to-regexp` 8) |
| Accesso | OpenID Connect con `openid-client` (codice + PKCE), callback `<base>/auth/callback` o il percorso di `OIDC_REDIRECT_URI` | libreria `msal` | nomi delle variabili d'ambiente, indirizzo di ritorno registrato, scope richiesti (es. `User.Read`) |
| Testi dell'ente | segnaposto `{{ente.nome}}` ecc. in `public/index.html`, valori in `config/ente.json` (non versionato) | scritti direttamente nell'HTML | elenco dei testi, logo/stemma, colori |
| Pagina servita | `index.html` letto all'avvio, segnaposto sostituiti dal server (`__BASE__`, `__V__`, `__VERSIONE__`, `__DATA_VERSIONE__`, `__APPEARANCE__`, testi dell'ente) | non documentato | come viene servita: dal server Node o come file statico da Apache; chi sostituisce `__VERSIONE__` |
| Fogli di stile | `theme.css` (variabili dei temi), `ente.css` (colori dell'ente, generato), `style.css`, `readability.css`, `appearance.css`, `stats-bar.css`, `avatar.css`, `temi.css` | nel rilascio annullato mancavano `theme.css` e `temi.css` | elenco reale nell'HTML servito (`npm run verifica:rilascio`) |
| File statici | `express.static(public)`, CSS/JS con `Cache-Control: no-cache` | non documentato | eventuale cache del reverse proxy |
| Dati locali | preferenze in `PREFERENCES_DIR`, foto in `AVATAR_DIR` (`/var/lib/portale-assistenza` con l'unità standard) | assenti nella 1.x | cartelle scrivibili dall'utente del servizio con `ProtectSystem=strict` |
| GLPI | API REST legacy con token di app e utente | come il repository (stesso profilo di servizio) | diritto di lettura delle attività pubbliche (`TicketTask`), vedi [glpi.md](glpi.md) |

## Riproduzione del difetto (fase A, in sviluppo)

`scripts/simula-produzione.sh` costruisce una «build adattata» che imita la produzione: testi dell'ente scritti
nell'HTML, percorso base fisso, Express 5, accesso di prova al posto di MSAL (modalità DEMO, GLPI finto).
Con `--difetto-css` toglie da `index.html` i collegamenti a `theme.css` e `temi.css`, come nel porting annullato.

Esito con `scripts/verifica-deploy.js` sulla build con il difetto:

- `Risorsa non collegata: theme.css`, `Risorsa non collegata: temi.css`;
- in tutti i temi restano definite solo le variabili che arrivano da `ente.css` (`--primary`, `--bg`, `--top`,
  `--head`, `--foot`, `--herotext`); sono **vuote** `--card --text --muted --line --accent --bar --hero --soft --dk`;
- a vista: caselle senza colori di categoria e senza sfondo, bordi spariti, testo del pulsante «Invia richiesta»
  illeggibile, testi del piè di pagina invisibili. È il quadro descritto dopo il rollback.

La stessa build **senza** il difetto (Express 5, testi nell'HTML) supera tutti i controlli, con gli screenshot dei
5 temi su desktop e telefono. **Conclusione:** l'ipotesi è confermata sulla simulazione; sul server vero va
confermata in fase B confrontando l'HTML effettivamente servito durante il guasto, se ancora disponibile.

## Strada scelta: A — allineare la produzione al repository

**Scelta: A.** La produzione esegue il codice del repository; tutto ciò che è dell'istanza sta in file non versionati
sul server: `.env` (segreti, OIDC, GLPI, percorsi), `config/ente.json` (testi, logo, colori), `config/categorie.json`,
le immagini dell'ente in `public/img/`.

Perché:

1. Il guasto è nato proprio dal porting a mano su una linea di codice divergente. Con la strada B ogni rilascio
   futuro richiederebbe un nuovo porting, con lo stesso rischio.
2. Le differenze note sono già coperte dal repository senza codice dedicato: testi e grafica in `config/ente.json`,
   percorso base in `BASE_PATH`, accesso Microsoft con OpenID Connect sulla **stessa registrazione dell'app**
   (stesso client id e segreto, stesso indirizzo di ritorno: il portale risponde anche su un percorso di ritorno
   diverso da `/auth/callback`, letto da `OIDC_REDIRECT_URI`). Express 5 contro 4 è un dettaglio interno.
3. Il passaggio è reversibile: `scripts/rilascio.sh` sostituisce la cartella in servizio con due rinomine, fa il
   backup completo (codice, configurazione, dati), verifica l'istanza vera e, se un controllo fallisce, ripristina
   la versione precedente **una sola volta** (collaudato in sviluppo forzando un errore).

Limiti e condizione per cambiare strada: se in fase B il confronto mostra funzioni presenti solo in produzione
(non nel repository) o un accesso che non si può riprodurre con OpenID Connect senza toccare Entra, si passa alla
**strada B**: script di porting ripetibile, mai a mano, seguito sempre da `scripts/verifica-deploy.js` sulla pagina
servita (collegamenti a tutti i fogli di stile e gli script, `__VERSIONE__` sostituito, nessun segnaposto rimasto,
variabili dei temi definite). In entrambi i casi nessuna modifica a Entra né a GLPI.

## Corrispondenza della configurazione (da compilare in fase B, senza valori)

| Repository (`.env`) | Significato | Produzione (nome della variabile o del file) |
|---|---|---|
| `OIDC_ISSUER` | `https://login.microsoftonline.com/<tenant>/v2.0` | da ricavare dal tenant usato da MSAL |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | stessa registrazione dell'app | |
| `OIDC_REDIRECT_URI` | **identico** a quello registrato in Entra | |
| `OIDC_SCOPE` | `openid profile email` (+ `User.Read` solo se già concesso) | |
| `GLPI_URL`, `GLPI_APP_TOKEN`, `GLPI_USER_TOKEN` | stesso profilo di servizio | |
| `SESSION_SECRET`, `PUBLIC_URL`, `BASE_PATH`, `PORT` | | |
| `PREFERENCES_DIR`, `AVATAR_DIR` | `/var/lib/portale-assistenza/...` (unità standard) | |
