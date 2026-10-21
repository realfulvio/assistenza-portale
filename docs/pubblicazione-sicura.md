# Preparare una distribuzione pubblica

Lavora in un clone separato dal server. Integra il codice utile file per file e usa organizzazioni, persone e richieste inventate nelle prove. Non copiare una directory operativa intera nel repository.

## Prima di ogni push

```bash
git status --short
git diff --cached --stat
npm run verifica:pubblico
git diff --check
```

Il controllo analizza i file versionati, vieta configurazioni locali, archivi, dump e chiavi private e cerca alcune forme di token e indirizzi privati. I due script SQL generici in `deploy/glpi/` sono esempi ammessi e non sono dump. Un elenco facoltativo in `config/termini-riservati.txt`, ignorato da Git, permette di controllare anche termini specifici dell’installazione: un termine per riga, nessuna password. Il log indica file e regola senza stampare il contenuto trovato.

Il controllo è un aiuto, non una garanzia di assenza di dati riservati. Rivedi anche commenti, link, FAQ, messaggi di commit, autori ed email, rami, tag, release e allegati. `.gitignore` non rimuove ciò che è già versionato né i vecchi commit.

## Immagini e documenti

Acquisisci schermate da una demo isolata. Controlla nomi, avatar, indirizzi, numeri, titoli, barre del browser e notifiche; verifica metadati e sorgenti dei documenti. Non usare schermate reali con semplici sovrapposizioni che lascino recuperabili i dati originali.

Gli asset della presentazione attuale provengono dalla demo locale e da grafica SVG del progetto. Nessuna schermata dell’istanza operativa è necessaria per ricrearli.

## Se un segreto è già pubblico

Revocalo o ruotalo prima di tutto. Togliere il file dall’ultimo commit non basta. La bonifica della cronologia e degli allegati richiede una procedura dedicata e coordinata con i collaboratori; copie, cache e fork possono conservarlo. Non riscrivere la cronologia alla cieca.

Per distribuire i sorgenti basta il repository o lo ZIP generato da GitHub. Non allegare `node_modules`, directory dati, configurazioni operative, pacchetti SSH o backup.
