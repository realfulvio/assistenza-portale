# Aspetto personale e leggibilità

Il tema predefinito è **Classico**. I temi disponibili sono Classico, Spazio, Giardino, Autunno, Scuro, Contrasto elevato e Montagna; un'eventuale preferenza salvata con un tema rimosso (Cyberpunk, Terminale, Retro, Hawaii, Nebbia padana) viene letta come Classico (`retired` in `public/appearance-model.js`). Conserva i font locali Titillium Web e Lora, le categorie configurate e le preferenze esistenti. Le skin aggiuntive sono in `public/appearance.css`; non duplicano le pagine. Le icone delle skin sono centralizzate in `public/theme-icons.svg`, adattate dall'HTML di riferimento fornito per il progetto. Il laboratorio non viene distribuito.

Il nome utente nella barra apre **Il mio profilo**. Il pulsante **Aa · Aspetto** apre lo stesso pannello anche durante la compilazione. Cambiare aspetto aggiorna attributi CSS e riferimenti SVG: il modulo e gli allegati non vengono ricreati. Il pannello si usa con Tab, Invio e Spazio sui temi, frecce sui cursori e Spazio per le caselle, Esc per chiudere. Il focus torna al pulsante di apertura.

Testo 100–150% a scatti di 10, icone 80–150% a scatti di 10, spaziatura normale/ampia. Il movimento segue inizialmente il sistema; può essere ridotto o riattivato esplicitamente. Il ripristino riporta al tema Classico, testo e icone al 100%, spaziatura normale e movimento di sistema.

## Archivio e API

Non esisteva un database dei profili: le sessioni esistenti sono temporanee. Le preferenze sono quindi archiviate sul server in file JSON separati, con nome SHA-256 di issuer, tenant e identificativo OIDC immutabile (`oid`/`sub`). L'indirizzo email non identifica il file. Il nuovo claim `tenant` separa anche gli identificativi omonimi di tenant diversi; autenticazione e integrazione GLPI rimangono invariate.

- Directory: `PREFERENCES_DIR`, altrimenti `data/preferences` (`data/preferences-demo` in demo), esclusa da Git.
- `GET /api/preferenze`: preferenze e disponibilità dell'archivio, autenticazione richiesta, `Cache-Control: no-store`.
- `PUT /api/preferenze`: autenticazione e CSRF esistenti, oggetto completo validato; nessun id utente accettato dal client. Le chiavi extra sono respinte.
- Scrittura atomica con file temporaneo, flush e rename; file 0600 e directory 0700 sui sistemi che supportano questi permessi.
- Nessuna cache delle preferenze in localStorage/sessionStorage. Al logout o alla scadenza della sessione si torna al Classico. L'HTML personalizzato per la sessione non è memorizzabile in cache e include il tema prima del caricamento degli stili.
- Gli aggiornamenti rapidi vengono accorpati e serializzati. In caso di errore l'anteprima rimane utilizzabile; il pannello segnala che il salvataggio non è riuscito e offre **Riprova salvataggio**.

## Preparazione di un futuro rilascio (non eseguita)

Nessuna migrazione SQL e nessuna modifica GLPI. Le preferenze vengono create al primo salvataggio; gli utenti preesistenti partono dal Classico. Salvare la directory delle preferenze insieme ai backup del portale. Per un singolo processo/istanza Node il filesystem persistente è sufficiente. Per più server occorre un archivio condiviso o un adattatore database; non usare dischi effimeri.

Il servizio standard v2 include `StateDirectory=portale-assistenza` (0700),
`PREFERENCES_DIR=/var/lib/portale-assistenza/preferences` e
`AVATAR_DIR=/var/lib/portale-assistenza/avatars`. Systemd crea l'archivio con il
proprietario del servizio e lo rende scrivibile mantenendo `ProtectSystem=strict`.
Il drop-in `deploy/aspetto-systemd.conf.example` serve solo per unità precedenti
o personalizzate. Per percorsi diversi impostare anche `ReadWritePaths`.
Per migrazione dei dati e ripristino vedere [aggiornamento e backup](aggiornamento-e-backup.md).

Rollback futuro: ripristinare i file applicativi precedenti e l'eventuale drop-in precedente. I JSON possono essere conservati per un successivo aggiornamento e non influenzano i ticket. Non cancellarli durante un semplice rollback.

## Verifiche ripetibili

```powershell
npm run lint
npm test
```

Il controllo browser usa dipendenze di sviluppo dichiarate nel lockfile:

```bash
npm ci
npx playwright install chromium
npm run test:aspetto
```

Per usare Chrome o Edge già installato, impostare `QA_BROWSER=chrome` o `msedge`.
Il controllo avvia solo un server su loopback con `DEMO=1`, GLPI simulato e archivi
temporanei. Le identità di test sono iniettate soltanto nel processo di prova.
Schermate e rapporto vengono salvati in `artifacts/v2-browser/`, escluso da Git.
La matrice copre tutti i 7 temi a 1440, 390 e 320 px, dimensioni normali e
massime, pagine del portale, invio, messaggio, PDF, foto, persistenza e logout.
Le violazioni axe WCAG AA causano il fallimento del controllo.

Dopo modifiche a `style.css`, rigenerare `public/readability.css` con
`node scripts/genera-leggibilita.js`; dopo modifiche alle palette usare
`node scripts/genera-temi.js`. Il lint controlla anche questi file generati.
