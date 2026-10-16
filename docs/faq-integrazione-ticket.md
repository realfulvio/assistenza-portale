# Integrazione delle guide dai ticket

Le guide per i dipendenti devono aiutare a riconoscere il problema, eseguire i controlli consentiti e raccogliere le informazioni utili per l'assistenza. Un ticket risolto dal fornitore non dimostra che la stessa operazione sia ripetibile da ogni operatore.

Questa integrazione aggiunge 13 guide alle 30 del ramo `feature/faq-2`, senza sostituire quelle esistenti. La categoria «Programmi del Comune» compare nella ricerca e nei filtri come le altre categorie. Non cambia l'autenticazione, non introduce una sezione amministrativa e non modifica GLPI o le configurazioni dei gestionali.

## Contenuti per i dipendenti

- Ricerca delle guide e uso dei filtri.
- Ricerca dei ticket chiusi e aggiornamento delle segnalazioni nel portale del fornitore.
- Gestionale non raggiungibile e funzioni non abilitate.
- Annualità IMU non visibili.
- Fascicolazione che non resta modificata dopo la copia di un protocollo.
- Copia PDF con riferimenti di protocollo e documenti firmati.
- PDF che non si aprono o che hanno pagine mancanti.
- Allegati assenti dalla pagina pubblicata e durata di pubblicazione inattesa.
- Destinatario email diverso da quello di lavoro previsto.

Le guide relative ad anomalie applicative descrivono controlli e richiesta di intervento; non promettono una soluzione autonoma quando la risposta esaminata non la documenta. La guida sulla risposta in X-Desk richiede ancora una prova di invio su un ticket di test autorizzato: durante la ricerca non è stato inviato alcun messaggio.

## Materiale riservato

Conversazioni, riferimenti ai ticket reali, indirizzi, configurazioni operative e procedure di amministrazione devono restare in un archivio riservato esterno al repository pubblico. Non inserirli in `content/faq.json`, nei file statici o nei commenti del codice. Un campo `riservato` nel JSON inviato a tutti gli utenti non sarebbe una protezione.

Per un'eventuale area tecnica futura occorre un'autorizzazione verificata sul server. La semplice visibilità di un pulsante o di una categoria non costituisce controllo degli accessi.

## Screenshot

Le tre nuove immagini sono catture reali delle interfacce. Il ritaglio esclude intestazioni personali, identificativi dei ticket, conversazioni e dati degli utenti; non sono ricostruzioni grafiche. Sono stati salvati solo i ritagli utili. Il numero di guide e la disposizione dei comandi possono cambiare dopo un aggiornamento.

Le immagini sotto `public/img/faq` sono file statici accessibili anche senza login: devono quindi essere prive di dati riservati già nel file. La lettura delle guide tramite API continua a richiedere l'accesso.

## Verifica e rilascio

La base di questa integrazione è il commit `b12d693121304fa5df8cedbb0fc6fd8e63ad6f54`. Il ramo principale aveva un insieme di guide precedente: verificare sempre il ramo di destinazione prima di applicare il cambiamento. Questo commit contiene il sistema delle 30 guide osservate, ma non è stato dimostrato che coincida con l'intero codice operativo: il portale in uso espone anche funzioni aggiuntive. Applicare il solo diff pertinente dopo il confronto con la versione operativa, senza sostituire l'intera applicazione con questa copia.

Prima del rilascio eseguire i controlli previsti dal progetto:

```sh
npm ci
npm run lint
npm test
git -c core.whitespace=cr-at-eol diff --check
```

Controllare inoltre ricerca per argomento, nuovo filtro, collegamenti alle guide, ingrandimento delle immagini e visualizzazione da telefono. Verificare l'assenza di informazioni riservate nel diff e nelle immagini. Le informazioni tratte dalle email devono essere integrate solo dopo aver verificato l'accesso alla casella corretta.

La preparazione di questi file non autorizza il rilascio. Pubblicazione e modifiche ai sistemi operativi richiedono una conferma esplicita del responsabile. Il rollback del contenuto consiste nel ripristinare il commit precedente; eventuali configurazioni del gestionale richiedono invece il proprio backup e un intervento separato.
