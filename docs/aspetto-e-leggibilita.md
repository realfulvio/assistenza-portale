# Aspetto personale e leggibilità

Il tema predefinito è **Classico Bondeno**. Conserva i font locali Titillium Web e Lora, le categorie con i colori configurati, le icone originali e la disposizione del portale. Le skin aggiuntive sono in `public/appearance.css`; non duplicano le pagine. Le icone delle skin sono centralizzate in `public/theme-icons.svg`, adattate dall'HTML di riferimento fornito per il progetto. Il laboratorio non viene distribuito.

Il nome utente nella barra apre **Il mio profilo**. Il pulsante **Aa · Aspetto** apre lo stesso pannello anche durante la compilazione. Cambiare aspetto aggiorna attributi CSS e riferimenti SVG: il modulo e gli allegati non vengono ricreati. Il pannello si usa con Tab, frecce sui temi e sui cursori, Spazio per le caselle, Esc per chiudere. Il focus torna al pulsante di apertura.

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

Il servizio di esempio usa `ProtectSystem=strict`: la directory deve essere esplicitamente scrivibile. È fornito un drop-in **da rivedere e applicare solo dopo autorizzazione**, `deploy/aspetto-systemd.conf.example`. Preparare una directory privata con proprietario uguale all'utente del servizio e impostare `PREFERENCES_DIR`; il drop-in non rimuove le protezioni del servizio. Non sono stati eseguiti comandi Debian, restart, deploy, push o modifiche al servizio operativo.

Rollback futuro: ripristinare i file applicativi precedenti e l'eventuale drop-in precedente. I JSON possono essere conservati per un successivo aggiornamento e non influenzano i ticket. Non cancellarli durante un semplice rollback.

## Verifiche ripetibili

```powershell
npm run lint
npm test
```

Il controllo browser usa dipendenze soltanto di sviluppo, senza introdurre risorse esterne nel portale:

```powershell
npm install --no-save --package-lock=false playwright @axe-core/playwright
$env:QA_BROWSER = 'chrome' # oppure msedge; browser installato localmente
npm run test:aspetto
```

Il test browser avvia esclusivamente un server su loopback con `DEMO=1`, GLPI simulato e archivio temporaneo. Il secondo account è iniettato solo dal test nel processo effimero, senza aggiungere accessi speciali all'applicazione. Genera schermate e rapporto in `screenshots/appearance`. Non usa il backend operativo.

Dopo modifiche a `style.css` rigenerare `public/readability.css` con `node scripts/genera-leggibilita.js`: serve a scalare anche le misure espresse in pixel mantenendo i valori originali al 100%.

I risultati e gli eventuali limiti della verifica di questa consegna sono in `screenshots/appearance/README.md`.
