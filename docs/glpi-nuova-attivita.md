# Riquadro «Nuova attività» nel cruscotto GLPI

Configurazione opzionale del backend **GLPI 11.0.8**: aggiunge un riquadro cliccabile sotto i contatori, con lo stesso stile, un grande «+» e la scritta «Nuova attività». Apre il modulo nativo di creazione ticket. Non modifica il codice del portale, il core GLPI o i permessi e non richiede plugin né CSS aggiuntivo.

## Configurazione finale

L'esempio completo è in [nuova-attivita.json.example](../deploy/glpi/nuova-attivita.json.example). È una configurazione di riferimento, non un file da caricare direttamente nell'interfaccia GLPI.

La scheda usa `card_id=markdown_editable` con `card_options.widgettype=bigNumber`: il renderer nativo dei contatori fornisce colori, tipografia, icona, hover e collegamento sull'intera superficie. Il contenuto finale non è Markdown e non usa `markdown_content`.

**Questo abbinamento è una personalizzazione della configurazione persistita**, non una combinazione garantita dall'editor grafico: la scheda Markdown dichiara normalmente il widget `markdown`. Una modifica o un nuovo salvataggio dall'editor potrebbe ripristinare quel widget. Verificare nuovamente dopo aggiornamenti GLPI o modifiche della dashboard.

Riferimenti al codice della versione verificata: [Widget.php](https://github.com/glpi-project/glpi/blob/11.0.8/src/Glpi/Dashboard/Widget.php), [Grid.php](https://github.com/glpi-project/glpi/blob/11.0.8/src/Glpi/Dashboard/Grid.php).

## Applicazione su un'altra installazione

1. Individuare il cruscotto corretto e verificare che sia condiviso solo con gli utenti previsti. Non riutilizzare ID di altre installazioni.
2. Conservare una copia della configurazione del cruscotto e dei suoi elementi prima dell'intervento.
3. Aggiungere una sola riga in `glpi_dashboards_items`, associata al cruscotto scelto tramite `dashboards_dashboards_id`. Generare un `gridstack_id` univoco; usare un ID DOM univoco anche in `card_options.id`. Il campo database `card_options` contiene l'oggetto dell'esempio serializzato come JSON.
4. Adattare posizione e dimensioni: nell'esempio i contatori terminano a `y=6`, la larghezza occupata è `12` e l'altezza del riquadro è `3`, uguale agli altri contatori. Non sovrapporre elementi esistenti.
5. Adattare il link se GLPI è pubblicato in una sottocartella: `/front/ticket.form.php` presume l'installazione alla radice del sito.
6. Ricaricare il cruscotto con un profilo tecnico e verificare aspetto, intera superficie cliccabile e apertura del modulo senza inviarlo. Verificare che gli altri contatori siano invariati.

L'esempio non include uno script SQL universale: destinazione, identificativi e disposizione dipendono dall'installazione. Conservare ID della riga inserita, dashboard e `gridstack_id` per un rollback preciso.

## Utilizzo

Per aprire un ticket per un dipendente, selezionarlo come **Richiedente** nel modulo nativo. Per attività interne, utilizzare richiedente e assegnazione appropriati. Il riquadro non concede nuovi permessi e non rende automaticamente riservati i ticket: verificare visibilità e selezione del richiedente con il profilo effettivo. [Apertura ticket nella documentazione GLPI](https://help.glpi-project.org/documentation/modules/assistance/tickets/ticketopening).

## Verifica e rollback

Il risultato finale è stato verificato visivamente su GLPI 11.0.8: stile coerente con i contatori, grande «+», icona in alto a destra e collegamento al modulo. La configurazione persistita è stata riletta via SSH. Non sono stati creati ticket di prova; creazione per altri richiedenti, notifiche e riservatezza non sono validate da questo controllo.

Per rimuovere l'aggiunta, eliminare esclusivamente la riga identificata congiuntamente da ID, dashboard e `gridstack_id` salvati, verificando prima che corrisponda al riquadro. Se si sta sostituendo una scheda preesistente, ripristinare invece i suoi campi precedenti. Non ripristinare l'intero database né cancellare altri elementi. Ricaricare e verificare il cruscotto.

Nel repository non sono inclusi dump, backup operativi, credenziali o screenshot con dati reali.
