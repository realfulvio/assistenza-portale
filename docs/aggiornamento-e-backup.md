# Aggiornamento e backup

## Dati da salvare

Richieste, utenti e allegati sono in GLPI. Dalla v2 il portale conserva **preferenze
personali e foto profilo** sul proprio filesystem. Il backup deve comprendere:

- `/opt/portale-assistenza/.env`: segreti, da conservare cifrato o in un archivio protetto;
- `config/`, `content/` e le immagini personalizzate in `public/img/`;
- `PREFERENCES_DIR`: JSON delle preferenze di ciascun account;
- `AVATAR_DIR`: foto WebP, stato JSON e indice email (hash), necessari insieme;
- unità systemd, eventuali drop-in e configurazione Apache personalizzata.

L'unità v2 usa `/var/lib/portale-assistenza/preferences` e
`/var/lib/portale-assistenza/avatars`. Nell'avvio manuale, senza queste variabili,
i percorsi sono `data/preferences` e `data/avatars` nel progetto; in demo le
preferenze usano `data/preferences-demo`. Se è impostato solo `PREFERENCES_DIR`,
le foto vanno nella directory `avatars` accanto alle preferenze.
**Controllare `.env`, unità e drop-in per conoscere i percorsi effettivi**;
non eseguire `source .env` per leggerli. Se sono personalizzati, aggiungerli
esplicitamente al backup e ripristinarli negli stessi percorsi.

Esempio per l'installazione systemd standard, durante una breve manutenzione:

```bash
sudo systemctl stop portale-assistenza
sudo tar czf /root/portale-config-$(date +%F).tgz -C /opt/portale-assistenza .env config content public/img
sudo tar czf /root/portale-profili-$(date +%F).tgz -C /var/lib portale-assistenza
sudo systemctl start portale-assistenza
```

Il secondo comando `tar` richiede che il servizio v2 sia già stato avviato almeno
una volta. Prima del primo passaggio alla v2, salvare invece le eventuali directory
`data/preferences` e `data/avatars` esistenti. Controllare gli esiti di ogni comando:
non proseguire con un aggiornamento se un backup è fallito.

Per GLPI seguire la [documentazione ufficiale](https://glpi-user-documentation.readthedocs.io/):
database (`mariadb-dump`), cartella `files/` e **`config/glpicrypt.key`**.
Senza questa chiave i token e le password cifrate nel backup non sono recuperabili.

## Aggiornare il portale

Questa procedura vale per installazioni che usano **questo repository**.
La precedente installazione con Express 5 e MSAL è una linea diversa:
non sovrascriverla né trasferire porzioni di HTML a mano. Preparare prima una copia
di collaudo con la stessa autenticazione e configurazione del server di lavoro.

1. Leggere il [CHANGELOG](../CHANGELOG.md), scegliere un commit/tag verificato e
   scaricarlo in una nuova directory temporanea, senza cancellare copie precedenti:
   `git clone https://github.com/realfulvio/assistenza-portale.git /tmp/portale-aggiornamento-UNIVOCO`.
   Selezionare il commit/tag da installare; non rilasciare un ramo che cambia durante il collaudo.
2. Eseguire i backup indicati sopra. Salvare anche il codice precedente
   (`--exclude=node_modules`) e una copia della unità systemd e dei suoi drop-in.
3. Arrestare il servizio. Copiare i file preservando `.env`, `config/ente.json`,
   `config/categorie.json`, `content/`, `public/img/` personalizzati e `data/`.
   Non usare `rsync --delete` su directory contenenti dati degli utenti.
4. Eseguire `npm ci --omit=dev` nella directory di destinazione. Confrontare le nuove
   opzioni di `.env.example` con la configurazione attiva.
5. Alla prima migrazione alla v2, prima del riavvio, trasferire gli eventuali dati
   dalle directory precedenti in quelle scelte per `PREFERENCES_DIR` e `AVATAR_DIR`.
   Copiare le foto **insieme a tutti i JSON**. Assegnare directory e file all'utente
   `portale`; directory 0700, file 0600. Non cancellare gli originali fino al collaudo.
6. Aggiornare l'unità standard da `deploy/portale-assistenza.service` (oppure integrare
   le direttive del drop-in di esempio nella propria unità). `StateDirectory` crea
   automaticamente l'archivio scrivibile, mantenendo `ProtectSystem=strict`.
   Eseguire `sudo systemctl daemon-reload` e `sudo systemctl restart portale-assistenza`.
7. Dal server eseguire `npm run verifica:rilascio -- http://127.0.0.1:3000/assistenza/`.
   Ripetere sull'URL HTTPS pubblico per controllare anche Apache e i file serviti.
8. Controllare a vista tutti i temi, accesso reale, preferenze dopo un nuovo accesso,
   caricamento/rimozione foto, ticket con attività pubblica e privata, allegati e PDF.
   Annotare il commit installato e il risultato del collaudo.

Per directory personalizzate fuori da `StateDirectory` occorre anche un
`ReadWritePaths` esplicito nella unità: una variabile d'ambiente da sola non supera
`ProtectSystem=strict`. Non rimuovere la protezione per aggirare il problema.

## Ripristino e rollback

- Ripristinare codice e dipendenze della versione precedente durante una manutenzione.
  Ripristinare anche la unità e i drop-in precedenti, poi `daemon-reload` e riavvio.
- **Un rollback del codice non deve cancellare o sovrascrivere preferenze e foto.**
  Conservare `/var/lib/portale-assistenza` per il successivo aggiornamento.
- Per un ripristino completo da backup, arrestare il servizio, ripristinare anche
  l'archivio dei profili nei percorsi configurati, con proprietario `portale`, directory
  0700 e file 0600. Riavviare e verificare preferenze e foto con un account di prova.
- Il portale non gestisce il backup/rollback dei dati GLPI: questi richiedono la
  procedura separata del prodotto.

## Controlli periodici

- `npm audit --omit=dev`: vulnerabilità note delle dipendenze operative.
- Aggiornamenti di sistema e scadenza del client secret OIDC e del certificato HTTPS.
- Dopo aggiornamenti di GLPI, provare apertura richiesta, messaggio, attività pubblica
  e privata, allegato, approvazione della soluzione e notifiche.
