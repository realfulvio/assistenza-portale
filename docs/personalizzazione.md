# Personalizzazione

Tutto si fa con file di testo, senza programmare. Dopo ogni modifica a `config/*.json`:
```bash
sudo systemctl restart portale-assistenza
```
(`content/faq.json` invece viene riletto a ogni richiesta). Puoi provare le modifiche in locale con `npm run demo`.

## Ente, nomi e testi – `config/ente.json`

Copia `config/ente.example.json` in `config/ente.json`.

| Campo | Esempio | Dove si vede |
|---|---|---|
| `ente.nome` | Comune di Esempio | barra in alto, titolo della pagina, piè di pagina |
| `ente.sito` | https://www.esempio.it | link «Torna al sito» |
| `ente.piede` | Servizio Sistemi Informativi | piè di pagina |
| `servizio.nome` | Assistenza Informatica | testata |
| `servizio.sottotitolo` | Comune di Esempio · Servizio … | sotto il nome del servizio |
| `servizio.ufficio` | Servizio Sistemi Informativi | pagina Contatti |
| `servizio.email` | assistenza@esempio.it | pagina Contatti (vuoto = non mostrato) |
| `servizio.telefonoUrgenze` | 0123 456 789 | pagina Contatti (vuoto = non mostrato) |
| `testi.pulsanteAccesso` | Accedi con Microsoft 365 | pagina di accesso |
| `testi.esempioTelefono` | es. 0123 456 789 | suggerimento nel campo telefono |
| `testi.urgenze` | … | pagina Contatti |
| `crediti.*` | Powered by Accorsi Luca | piè di pagina e in alto a destra |

## Logo e colori

- Metti il logo (meglio SVG o PNG quadrato, almeno 112×112, sfondo bianco o trasparente) in `public/img/` e indica il nome in `grafica.logo` (es. `img/stemma.png`), con il testo alternativo in `grafica.logoAlt`.
- Colori in `grafica`: `colorePrimario` (`#005e8e`), `colorePrimarioScuro` (`#004a70`), `coloreBarra` (`#001a4d`), `coloreSfondo` (`#f2f2f2`). Solo codici esadecimali. Controlla il contrasto con il testo bianco (almeno 4.5:1, es. con https://webaim.org/resources/contrastchecker/).
- Il logo del servizio (scudo con cuffia) è in `public/img/logo-servizio*.svg`; favicon in `public/favicon.ico` e `public/img/icon-192.png`, `icon-512.png`.

## Barra «Live» – `barraLive` in `config/ente.json`

Sotto il menu principale una barra sottile mostra i numeri del servizio, presi da GLPI con l'utente di servizio del portale (sola lettura, solo numeri aggregati, nessun dato personale): richieste del periodo con l'andamento degli ultimi 7 giorni, risolte, in lavorazione (stati da «Nuovo» a «In attesa», senza filtro di periodo), tempo medio di presa in carico e, a rotazione, ultima soluzione, richieste di oggi e percentuale di risolte.

```json
"barraLive": { "attiva": true, "periodo": "giorni", "giorni": 30, "daData": "", "cacheSecondi": 300 }
```

- `periodo`: `giorni` (ultimi `giorni` giorni compreso oggi, predefinito 30: «negli ultimi 30 giorni»), `anno` (dal 1° gennaio), `mese` (dal 1° del mese) oppure `da_data` con `daData` nel formato `AAAA-MM-GG` (es. la data di avvio del portale). Il testo si adegua: «nel 2026», «a ottobre», «dal 01/10/2026».
- `attiva: false` nasconde la barra; `cacheSecondi` (minimo 10, predefinito 300) è ogni quanto il portale interroga GLPI. A ogni aggiornamento la sessione API viene chiusa (`killSession`).
- Le stesse opzioni si possono impostare nel `.env` (`STATS_BAR`, `STATS_PERIODO`, `STATS_GIORNI`, `STATS_DA_DATA`, `STATS_CACHE_SEC`), che ha la precedenza.
- La cache è in memoria: per svuotarla subito riavvia il servizio (`sudo systemctl restart portale-assistenza`).
- L'endpoint è `GET /assistenza/api/stats` (solo utenti autenticati). Se GLPI non risponde restituisce `{"ok":false}` e la barra si nasconde senza mostrare errori.
- Con «movimento ridotto» (preferenza del sistema o «Aspetto») non ci sono animazioni; sotto i 900 px spariscono andamento e messaggi, sotto i 600 px restano solo LIVE, risolte e in lavorazione.

## Foto profilo

In «Il mio profilo» ogni dipendente vede la propria foto (anche piccola nella barra in alto, accanto al nome). Precedenza: **foto personale** caricata dal portale > **foto di Microsoft 365** > **iniziali**.

- **Microsoft 365**: al login, se l'utente non ha una foto personale e l'ultima sincronizzazione ha più di `AVATAR_SYNC_GIORNI` giorni (predefinito 7), il portale chiede la foto a Microsoft Graph (`/me/photo/$value`) con il token del login. Serve lo scope `User.Read` in `OIDC_SCOPE` (nessun permesso amministrativo). Se Microsoft non ha foto si usano le iniziali; altri errori vengono ignorati senza bloccare l'accesso. Il token resta solo nella sessione lato server.
- **Foto personale**: JPG, PNG o WebP fino a 3 MB e 25 megapixel. Il server decodifica davvero l'immagine (non si fida di estensione o tipo dichiarato), prende il primo fotogramma, ritaglia un quadrato centrato, riduce a 128×128 e salva in WebP qualità 80 senza EXIF né altri metadati (pochi KB). L'originale non viene conservato. Massimo 10 operazioni l'ora per account, condivise tra caricamenti manuali e aggiornamenti forzati da Microsoft 365.
- **Dove stanno**: `AVATAR_DIR` (predefinito accanto a `PREFERENCES_DIR`, altrimenti `data/avatars`), un file `<hash>.webp` e un piccolo `<hash>.json` (origine e date) per utente. Il nome è un hash dell'identità generato dal server. Nessuna foto in database.
- **Endpoint** (sempre la foto dell'utente in sessione, mai di un altro): `GET /api/profilo/foto` (WebP, `Cache-Control: private`, ETag; 404 se non c'è), `GET /api/profilo/foto/info`, `POST /api/profilo/foto` (campo `foto`), `POST /api/profilo/foto/rimuovi`, `POST /api/profilo/foto/microsoft`. Le POST richiedono il token CSRF del portale.
- **Elaborazione**: libreria [sharp](https://sharp.pixelplumbing.com/) (dipendenza npm con binari precompilati, nessun pacchetto di sistema).
- **Web server**: il portale rifiuta con 413 i corpi oltre 3 MB sulla rotta di upload già dagli header, prima di login e parsing. Con Apache come reverse proxy un `LimitRequestBody` in `<Location>` non ferma in modo affidabile le richieste proxate, quindi il limite resta nel portale.

## Categorie – `config/categorie.json`

Copia `config/categorie.example.json` in `config/categorie.json`. Per ogni categoria:

| Campo | Significato |
|---|---|
| `id` | codice interno, minuscolo, senza spazi. Non cambiarlo dopo l'uso |
| `nome` | prefisso del titolo del ticket in GLPI, es. `[Stampante] ...` |
| `glpiId` | id della categoria ITIL in GLPI (`null` = nessuna) |
| `tipo` | `1` incidente, `2` richiesta |
| `titolo`, `sotto` | testo grande e descrizione della casella |
| `colore` | colore della casella (esadecimale) |
| `icona` | una tra `pc`, `pr`, `nt`, `ml`, `ky`, `ap`, `ot` (computer, stampante, rete, posta, chiave, applicazioni, punto di domanda) |
| `placeholder` | esempio mostrato nella descrizione |

Le icone sono simboli SVG in `public/index.html` (blocco `<svg class="sprite">`): per aggiungerne una nuova aggiungi un `<symbol id="...">`.

## Domande frequenti – `content/faq.json`

Elenco di guide, mostrate nella pagina «Guide» con ricerca, filtri per argomento e link diretti (`#faq/<id>`). Il formato semplice `{"d": "domanda", "r": "risposta"}` continua a funzionare; una guida completa usa questi campi:

```json
{ "id": "stampante-offline", "cat": "stampanti",
  "d": "La stampante risulta «Offline»",
  "intro": "Il problema, in una frase.",
  "controlli": ["Cosa guardare prima di cominciare."],
  "passi": [
    { "t": "Un'azione per passo.", "nota": "Dettaglio facoltativo.",
      "img": "img/faq/stampante-offline-01.webp", "alt": "Descrizione dell'immagine", "w": 900, "h": 400 }
  ],
  "ok": "Cosa dovresti vedere se è andato tutto bene.",
  "stop": "Quando fermarti e non insistere.",
  "richiesta": "Quando aprire una richiesta e cosa scrivere.",
  "vedi": ["coda-stampa"], "parole": ["offline", "non raggiungibile"] }
```

- `id`: minuscole, numeri e trattini; è il link diretto e deve essere unico. `cat`: argomento del filtro (`computer`, `stampanti`, `posta`, `rete`, `accessi`, `sicurezza`, `portale`, oppure un nome tuo).
- `intro`, `ok`, `stop`, `richiesta` sono obbligatori nelle guide con `passi`. `controlli`, `vedi` e `parole` (sinonimi per la ricerca) sono facoltativi.
- Immagini: file in `public/img/faq/` (WebP o PNG, max 200 KB), con `alt` e le dimensioni `w`/`h` reali. Un clic le ingrandisce. Usa solo schermate anonime, senza nomi, indirizzi o dati riservati: `public/` è servito anche senza accesso.
- Campi `mancante` (passo: immagine ancora da acquisire) e `verifica` (guida: punto da controllare) non compaiono agli utenti; `node scripts/verifica-faq.js --report` li raccoglie in `docs/faq-da-completare.md`.
- `npm run lint` controlla id, campi, immagini e collegamenti; `content/suggerimenti.json` può riusare una guida con `"guida": "<id>"` al posto di `titolo` e `passi`.

## Consigli prima di inviare – `content/suggerimenti.json`

Mentre il dipendente scrive la descrizione (dopo una breve pausa e almeno 8 caratteri) il portale mostra al massimo 2 riquadri «Prima di inviare, prova così» se il testo contiene una delle parole chiave. Non bloccano mai l'invio. Ogni voce:

```json
{ "categoria": "stampante", "parole": ["non stampa", "offline"], "titolo": "La stampante non stampa",
  "passi": ["Spegni e riaccendi la stampante.", "Controlla carta e toner."], "link": "#faq" }
```

- `parole`: confronto senza maiuscole e accenti; vale anche una parte di parola (es. `inceppat`).
- Le voci della categoria scelta hanno la precedenza.
- Il file viene riletto a ogni richiesta: non serve riavviare.

## Testi delle mail

Vedi [notifiche-mail.md](notifiche-mail.md): il modello usa gli stessi dati di `config/ente.json`.
