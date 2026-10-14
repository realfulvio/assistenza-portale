# Flusso dei ticket per i tecnici

I tecnici lavorano i ticket in **GLPI**. Il dipendente usa il portale e non entra in GLPI. Questa pagina descrive il significato di risposta, nota privata, attività e degli stati di sospensione, soluzione e chiusura. Non modifica ticket, profili, entità o azioni automatiche: i tempi e i permessi si leggono sull'installazione, non si copiano da un esempio.

Il progetto è stato provato con **GLPI 11.0.8**. Gli stati descritti sotto sono quelli della [documentazione sul ciclo di vita](https://help.glpi-project.org/documentation/modules/assistance/tickets/ticketlifecycle.md): non si possono rinominare. I menu inglesi di quella documentazione sono *Administration* e *Setup*. In [glpi.md](glpi.md), sull'interfaccia italiana di GLPI 11, le stesse aree sono *Amministrazione* e *Configurazione*. Se una voce non coincide, conta il nome della funzione, non la memoria del menu.

Nel catalogo italiano di GLPI 11.0.8 gli stati sono: New «Nuova», Processing (assigned) «In lavorazione (assegnata)», Processing (planned) «In lavorazione (pianificata)», Pending «In sospeso», Solved «Risolto», Closed «Chiusa». Un pacchetto lingua diverso può cambiare le parole.

Il portale mostra gli stessi codici con etichette proprie: 1 «In attesa», 2 e 3 «In lavorazione», 4 «In sospeso», 5 «Risolta», 6 «Chiusa». «In attesa» nel portale è il ticket nuovo, non lo stato In sospeso di GLPI.

## Risposta

La **risposta** è il messaggio scritto nella cronologia durante la gestione. In GLPI 11.0.8 il pulsante italiano è «Risposta» (la stringa inglese del pulsante è `Answer`). La stessa funzione, il *follow-up*, nel resto del catalogo si chiama spesso «commento»: «Nuovo commento per la chiamata», «Commento privato», «Commento pubblico». Non sono due operazioni. In [glpi.md](glpi.md) il diritto del profilo è indicato come «Seguiti»: nel catalogo 11.0.8 quel tipo si chiama «Commento». Se l'etichetta del profilo non coincide, è comunque il permesso sui follow-up.

Una risposta pubblica è il modo per aggiornare il richiedente: presa in carico, richiesta di un dato, esito parziale. Il portale mostra al dipendente solo le risposte pubbliche. Un messaggio che il dipendente scrive dal portale arriva in GLPI come risposta pubblica.

Una risposta non chiude il ticket. Sulla 10.0.5 i manutentori di GLPI hanno indicato che lo stato di attesa si toglie se risponde il richiedente, e resta se risponde il tecnico ([issue 13583](https://github.com/glpi-project/glpi/issues/13583)). Non ho riverificato quel passaggio sull'interfaccia di GLPI 11: controllalo prima di contarci.

## Nota privata

La **nota privata** è una risposta con il segno «Privato». Nel catalogo 11.0.8 la stringa è «Commento privato»; il diritto per vederle è «Visualizza privati». La [FAQ sui ticket](https://help.glpi-project.org/faq/glpi/ticket) distingue così: la risposta pubblica è visibile anche a richiedenti e utenti del servizio; la risposta privata è visibile a chi ha il diritto di vedere i follow-up privati.

Il profilo dell'utente di servizio del portale, in [glpi.md](glpi.md), legge i seguiti pubblici e non le note private. Il portale, in più, scarta le risposte con il segno privato prima di mostrarle al dipendente. Usa la nota privata per un'annotazione interna (diagnosi, nome di un fornitore, promemoria). Usa la risposta pubblica per ciò che il richiedente deve leggere.

## Attività

L'**attività** registra l'intervento: chi ha lavorato, che cosa ha fatto, la durata e, se serve, una pianificazione. In GLPI 11.0.8 i pulsanti italiani sono «Attività» e «Crea una attività». Non è il messaggio al richiedente. Il portale non elenca le attività nella cronologia della richiesta: lì compaiono le risposte pubbliche.

Un'attività pianificata può portare il ticket allo stato Processing (planned), «In lavorazione (pianificata)». Il portale continua a mostrarlo come «In lavorazione». Lo stato pianificato resta un ticket aperto, non una soluzione.

## In sospeso

**In sospeso** (Pending) significa che il problema è ancora aperto e si aspetta qualcuno fuori dal lavoro immediato del tecnico: il richiedente, un fornitore, un ricambio. Non è una soluzione e non è una chiusura.

La matrice del ciclo di vita del profilo decide se il tecnico può impostare questo stato. La documentazione ITIL richiamata da GLPI preferisce che l'attesa nasca dal richiedente (dati mancanti, persona non disponibile); in GLPI anche il tecnico può metterlo, se il profilo lo consente. Vedi il [ciclo di vita](https://help.glpi-project.org/documentation/modules/assistance/tickets/ticketlifecycle.md).

I motivi di sospensione sono una funzione a parte, con promemoria e azioni proprie. Non vanno confusi con la chiusura automatica e questa guida non li configura.

## Soluzione e stato Risolto

La **soluzione** è la descrizione di come l'intervento si è concluso. In GLPI 11.0.8 i pulsanti sono «Soluzione» e «Aggiungi una soluzione». Aggiungerla porta il ticket allo stato **Risolto**. Il tipo di soluzione è un dato in più, utile alle statistiche; l'elenco dei tipi dipende dai menu a discesa dell'installazione. La pagina inglese fa esempi (soluzione applicata, soluzione temporanea, informazione fornita): non sono voci obbligatorie.

Il richiedente può approvare o rifiutare la soluzione. Se la rifiuta, il ticket resta aperto finché non c'è un'altra soluzione. Se la approva, o se non risponde, il passaggio a **Chiuso** avviene quando qualcuno lo chiude oppure quando scade il tempo di chiusura automatica dell'entità. Lo descrivono la sezione *Solution approval* e la sezione *Automatic closing* di [Solution](https://help.glpi-project.org/documentation/modules/assistance/tabs/solution.md).

Il paragrafo iniziale di quella stessa pagina parla di 15 giorni e di un ticket «marked as resolved». Più sotto, la stessa pagina rimanda al campo dell'entità e non fissa un numero. La guida delle entità indica per la chiusura un intervallo da «never» a 365 giorni ([Entities](https://glpi-user-documentation.readthedocs.io/fr/latest/modules/administration/entity/entities.html)). Non usare 15 giorni, né qualunque altro numero, come valore di questa installazione.

Dal portale, con la richiesta nello stato «Risolta», il dipendente può confermare o riaprire. La conferma invia una risposta pubblica con la chiusura prevista da GLPI (`add_close`); il rifiuto riapre in lavorazione (`add_reopen`). Vale solo per il richiedente e solo se il ticket è risolto. Il dettaglio, compresi i limiti della prova, è in [notifiche-mail.md](notifiche-mail.md).

Nel portale i pulsanti di conferma compaiono solo sullo stato «Risolta». Il filtro delle richieste aperte nasconde sia le risolte sia le chiuse: per il dipendente una richiesta risolta non è più tra le aperte, ma non è ancora «Chiusa» finché GLPI non cambia stato.

## Chiuso

**Chiuso** è la conclusione amministrativa, dopo l'accettazione della soluzione oppure per l'automazione configurata sull'entità. In italiano lo stato è «Chiusa». Un tecnico può chiudere a mano solo se il «Ciclo di vita delle chiamate» del suo profilo consente il passaggio. La matrice è in *Amministrazione > Profili*, scheda documentata in inglese come life cycle. Può nascondere lo stato Chiuso: in quel caso il ticket resta Risolto anche se il lavoro è finito. Vedi la [matrice del ciclo di vita](https://help.glpi-project.org/documentation/modules/administration/profiles/lifecyclematrix.md).

La chiusura lascia il ticket consultabile. Non è una cancellazione.

## Chiusura, filtri e ricerca

Un ticket che non compare più nell'elenco quotidiano spesso è solo fuori dal filtro. Ricerche salvate, viste predefinite e cruscotti possono mostrare i ticket ancora aperti ed escludere i chiusi. Sparire dall'elenco non significa che sia stato cancellato.

Per rivederlo, cerca con il criterio **Stato** uguale a **Chiuso**, nell'entità giusta. La ricerca non allarga i permessi: restano i diritti del profilo (per esempio solo i propri ticket, quelli del gruppo o tutti) e i confini dell'entità, inclusa o meno la ricorsività. Un tecnico che non vede i ticket di un'altra entità non li ottiene cambiando il criterio di stato.

Lo stato Chiuso e l'eliminazione sono due operazioni diverse. Eliminare usa un altro diritto e toglie il ticket dagli elenchi ordinari. L'eliminazione automatica dei chiusi è un'altra impostazione ancora, descritta sotto.

## Chiusura automatica ed eliminazione

Sono due campi distinti dell'entità, nella scheda Assistenza, e due operazioni distinte. In GLPI 11.0.8 la sezione italiana è «Configurazione per la chiusura automatica». I campi sono:

- «Chiusura automatica delle chiamate risolte dopo», eseguita da `closeticket`: passa i ticket **risolti** a **chiusi** dopo il ritardo dell'entità;
- «Pulizia automatica delle chiamate chiuse dopo», eseguita da `purgeticket`: **cancella** i ticket già chiusi. In inglese il campo è *Automatic purge of closed tickets after*. La pagina [Solution](https://help.glpi-project.org/documentation/modules/assistance/tabs/solution.md) avvisa che la purge elimina i ticket in quello stato. «Pulizia» qui non significa archivio consultabile.

La stessa scheda, se l'operazione è spenta, mostra «L'azione di chiusura chiamata è disabilitata» oppure «L'azione di pulizia delle chiamate è disabilitata». Il percorso inglese della documentazione è *Administration > Entity > (entità) > Assistance*. Il valore può essere ereditato dall'entità padre: conta il valore effettivo sull'entità del ticket, non la sola scritta «eredità» letta senza aprire il padre. Un'entità figlia può anche avere un valore proprio.

Se la chiusura automatica effettiva è **Mai** (la stringa inglese `Never`), i ticket risolti **non** vengono chiusi da soli. Nel codice pubblico di GLPI, `Ticket::cronCloseTicket` chiude i risolti di un'entità solo quando il ritardo effettivo è maggiore o uguale a zero; il valore «mai» non entra in quel ramo. Le notifiche, con lo stesso valore, scrivono «Never» e non annunciano una chiusura fra qualche giorno. Vedi `cronCloseTicket` in [Ticket.php](https://github.com/glpi-project/glpi/blob/main/src/Ticket.php) e il tag `ticket.autoclose` in [NotificationTargetTicket.php](https://github.com/glpi-project/glpi/blob/main/src/NotificationTargetTicket.php). Il catalogo 11.0.8 traduce `Never` con «Mai».

«Immediatamente» non è «Mai». La documentazione delle entità lo descrive come chiusura appena il ticket è risolto, e in quel caso il richiedente può non avere il tempo di approvare. Non è un valore da copiare.

L'operazione deve anche essere attiva. In inglese si controlla in *Setup > Automatic actions*. Nel catalogo italiano di GLPI 11.0.8 il tipo si chiama «Operazione pianificata» (al plurale «Operazioni pianificate») e sta sotto *Configurazione*; i nomi tecnici restano `closeticket` e `purgeticket`. Un ritardo compilato sull'entità non ha effetto se l'operazione è spenta o se il pianificatore di GLPI non la esegue. Modalità GLPI e modalità CLI cambiano solo il modo in cui parte: il criterio resta lo stato Risolto più il ritardo dell'entità.

La purge non chiude i risolti e la chiusura non li cancella. Anche la purge ha un proprio «mai»: con quel valore i chiusi restano nel database. Non ricavare un tempo unico da questa guida e non cambiare i due campi per «allinearli» a un esempio.
