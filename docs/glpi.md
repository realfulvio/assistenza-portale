# Preparare GLPI

Provato con **GLPI 11.0.8**. I nomi dei menu sono quelli dell'interfaccia in italiano; se qualcosa non corrisponde verifica nella [documentazione ufficiale di GLPI](https://glpi-user-documentation.readthedocs.io/) e nella documentazione dell'API, che ogni installazione mostra all'indirizzo `https://<tuo-glpi>/apirest.php` (file `apirest.md`).

## 1. Abilitare l'API REST

*Configurazione > Generale > API*:
- «Abilita API REST»: **Sì**;
- «Abilita accesso con token esterno»: **Sì** (serve per il token dell'utente di servizio);
- «Abilita accesso con credenziali»: **No** (non serve al portale).

## 2. Client API (app token)

Nella stessa pagina, sezione **Client API** > *Aggiungi*:
- nome: `Portale Assistenza`, attivo;
- intervallo IPv4: l'indirizzo da cui il portale chiama GLPI (`127.0.0.1` se sono sullo stesso server);
- genera l'**App-Token** e copialo in `.env` come `GLPI_APP_TOKEN`.

> GLPI 11 salva i token **cifrati** nel database: per cambiarli usa l'interfaccia (o l'API), non scriverli direttamente in SQL.

## 3. Profilo e utente di servizio

Crea un profilo dedicato, ad esempio **«Portale (API)»**, interfaccia *Standard (centrale)*, con i soli diritti necessari:

| Diritto | Valore usato dall'autore | Perché |
|---|---|---|
| Ticket | leggere tutti, creare, aggiornare | creare i ticket e leggere quelli dei richiedenti |
| Followup (Seguiti) | vedere i pubblici, aggiungere a tutti i ticket | timeline e messaggi dal portale (mai le note private) |
| Attività dei ticket (Task) | vedere le pubbliche (`SEEPUBLIC`) | leggere le attività pubbliche nella conversazione; nessun diritto sulle attività private necessario |
| Utenti | leggere, creare, aggiornare | trovare il richiedente per e-mail e crearlo se manca |
| Documenti | leggere, creare, aggiornare | allegati |
| Categorie ITIL, Profili | leggere | categorie e profilo Self-Service |

Poi crea l'utente di servizio (es. `portale-api`) con questo profilo sull'entità radice (ricorsivo). Nelle **impostazioni dell'utente** genera il **token API** e copialo in `.env` come `GLPI_USER_TOKEN`.

**Prova** (dal server del portale, sostituisci i token) **[testato]**:
```bash
curl -s -H "App-Token: <APP_TOKEN>" -H "Authorization: user_token <USER_TOKEN>" http://127.0.0.1/apirest.php/initSession
```
Risposta attesa: `{"session_token":"..."}`. Errori tipici: `ERROR_WRONG_APP_TOKEN_PARAMETER` (app token o IP del client API), `ERROR_GLPI_LOGIN_USER_TOKEN` (token utente).

Con GLPI 11.0.8 il diritto di vedere i ticket non basta per leggere le attività:
il profilo API deve avere anche **vedere le attività pubbliche**. Dopo l'aggiornamento,
controlla nel portale un ticket con un'attività pubblica e una privata: deve comparire
solo la pubblica. Non concedere il diritto di vedere le private per questo scopo.

Il portale scrive messaggi ed esiti pubblici con `users_id` del richiedente verificato
lato server. Nell'audit delle soluzioni GLPI 11 continua a registrare l'account
della sessione API per approvazioni/rifiuti: la conversazione del portale riconcilia
l'esito con il followup pubblico corrispondente del richiedente. Non modifica né
impersona la sessione GLPI e non riscrive lo storico esistente.

## 4. Profilo Self-Service

Il portale crea i richiedenti che non esistono ancora con il profilo **Self-Service** (cercato per nome). Se il tuo si chiama diversamente indica il suo id in `.env` con `GLPI_SELF_SERVICE_PROFILE_ID`.

Gli utenti già presenti in GLPI (per esempio i tecnici) vengono riconosciuti per e-mail e **non vengono mai modificati**. Controlla quindi che i tecnici abbiano in GLPI la stessa e-mail del loro account di lavoro, altrimenti il portale creerebbe un duplicato.

## 5. Categorie

Crea (o scegli) le categorie ITIL in *Configurazione > Menu a discesa > Categorie ITIL* e scrivi i loro id nel campo `glpiId` di `config/categorie.json`. L'id si vede nell'indirizzo della pagina della categoria (`...itilcategory.form.php?id=12`).

## 6. Ticket «Nuova» o assegnati subito al gruppo tecnico

Scegli come devono nascere i ticket del portale:

- **«Nuova», senza assegnatario** (consigliato: i tecnici li vedono tra le chiamate in arrivo e li prendono in carico; il dipendente vede «In attesa», poi «In lavorazione»):
  - lascia vuoto `GLPI_GROUP_ID` in `.env`;
  - in GLPI controlla che nessuna **regola aziendale per i ticket** assegni un gruppo alla creazione (*Amministrazione > Regole > Regole aziendali per i ticket*) e che l'**assegnazione automatica** dell'entità sia su «No» (*Amministrazione > Entità > (entità) > Assistenza*: le categorie ITIL con un gruppo tecnico, insieme all'assegnazione automatica, assegnano il gruppo anche senza regole);
  - il profilo dei tecnici deve poter vedere i ticket nuovi e non assegnati (diritti dei ticket: «vedere tutti» e «vedere i nuovi ticket»).
- **Assegnati subito**: indica l'id del gruppo in `GLPI_GROUP_ID`, oppure usa una regola GLPI. Il ticket nasce «In lavorazione (assegnato)».

## 7. Notifiche, profilo «Tecnico Ticket», login Microsoft in GLPI

- Notifiche e modello di mail: [notifiche-mail.md](notifiche-mail.md) (destinatari consigliati: casella condivisa come «Amministratore», tecnico assegnato e richiedente; oggetto «Richiesta n. N · Stato · titolo»)
- Profilo semplificato per i tecnici e login Microsoft in GLPI: [sso-glpi.md](sso-glpi.md)

## Fuso orario

Imposta il fuso orario del PHP di GLPI, altrimenti mail e date possono uscire in UTC **[testato]**:
```bash
printf 'date.timezone = Europe/Rome\n' | sudo tee /etc/php/8.4/apache2/conf.d/97-timezone.ini /etc/php/8.4/cli/conf.d/97-timezone.ini
sudo systemctl restart apache2
```
(adatta `8.4` alla tua versione di PHP). I dati scritti prima della modifica possono restare spostati di qualche ora.

## Allegati grandi

Di base GLPI accetta documenti fino a 2 MB e PHP 2 MB per file. Per allegati fino a 10 MB **[testato]**:
- *Configurazione > Generale > Impostazioni generali* (o simile, a seconda della versione): «Dimensione massima dei documenti» = 10 MB;
- PHP: `printf 'upload_max_filesize = 12M\npost_max_size = 40M\n' | sudo tee /etc/php/8.4/apache2/conf.d/99-allegati.ini` e riavvio di Apache.
