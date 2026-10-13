# Notifiche e-mail (inviate da GLPI)

Le mail ai dipendenti e ai tecnici le invia **GLPI**. Il portale fornisce un modello HTML pronto e due accorgimenti per evitare mail inutili.

## 1. Invio delle mail

*Configurazione > Notifiche > Configurazione delle notifiche e-mail*:

- **Microsoft 365 – invio diretto** (provato dall'autore): server `<tuodominio>.mail.protection.outlook.com` (lo trovi nel record MX o nell'interfaccia di Exchange), porta 25, nessuna autenticazione, cifratura opportunistica (STARTTLS). L'IP pubblico di uscita del server va autorizzato in Exchange Online (connettore in ingresso o SPF): senza, i messaggi possono essere scartati o finire in quarantena. Documentazione: [Microsoft 365 – invio diretto](https://learn.microsoft.com/exchange/mail-flow-best-practices/how-to-set-up-a-multifunction-device-or-application-to-send-email-using-microsoft-365-or-office-365).
- **SMTP generico**: host, porta, cifratura, utente e password del tuo server di posta.

Verifica dal server che la porta sia raggiungibile **[testato]**:
```bash
python3 -c "import smtplib;s=smtplib.SMTP('<server-smtp>',25,timeout=15);print(s.ehlo()[0], s.has_extn('starttls'));s.quit()"
```

Imposta mittente (es. `assistenza@tuoente.it`) e **Reply-To** su un indirizzo che non riceve posta (es. `noreply@tuoente.it`): chi risponde per errore riceve un messaggio di mancato recapito invece di scrivere a un tecnico. Se preferisci nessun messaggio di errore, usa una casella che scarta i messaggi in silenzio.

Ricorda di attivare il **cron** di GLPI (su Debian 13 il pacchetto `cron` potrebbe mancare: `sudo apt install cron`) e di impostare le azioni automatiche `queuednotification` in modalità **CLI/esterna** (*Configurazione > Azioni automatiche*), altrimenti la coda delle mail si svuota solo quando qualcuno usa l'interfaccia di GLPI.

## 2. Quali notifiche attivare e a chi

Destinatari che GLPI 11 offre davvero (*Configurazione > Notifiche > Notifiche > (notifica) > Destinatari*): **Amministratore** (l'indirizzo `admin_email` di *Configurazione > Notifiche > Configurazione delle notifiche e-mail*), **Richiedente**, **Tecnico assegnato**, **Gruppo assegnato**, singoli **Gruppi** o **Profili**, osservatori e altri. Non esiste un campo «indirizzo e-mail libero»: per una casella condivisa (es. `assistenza@tuoente.it`) usala come indirizzo **Amministratore**, oppure crea un utente GLPI dedicato con quell'e-mail.

Configurazione consigliata (provata dall'autore):

| Notifica | Destinatari |
|---|---|
| Nuova chiamata | Amministratore (casella condivisa) + Richiedente |
| Aggiornamento di una chiamata (comprende la presa in carico) | Amministratore + Tecnico assegnato + Richiedente |
| Chiamata risolta | Amministratore + Tecnico assegnato + Richiedente |
| Chiusura della chiamata | Amministratore + Tecnico assegnato + Richiedente |

Le altre notifiche si possono disattivare. Con il trigger del punto 4 la casella condivisa riceve aggiornamenti, soluzione e chiusura **solo se il ticket non ha un tecnico assegnato** (es. assegnato solo a un gruppo): con un tecnico le mail vanno a lui e al richiedente, non agli altri tecnici. GLPI non invia due volte la stessa mail allo stesso indirizzo nello stesso evento.

## 3. Modello HTML

1. Personalizza `config/ente.json` e imposta `PUBLIC_URL` in `.env`.
2. Genera il modello **[testato]**:
   ```bash
   npm run template-mail
   ```
   Crea `deploy/glpi/mail-ticket.html` e `deploy/glpi/mail-ticket.txt` con: riquadro «Non rispondere», pulsante grande **«Apri la richiesta»** (porta al portale, nella pagina del ticket), colori dell'ente e, nella mail **«Chiamata risolta»**, i pulsanti **«Risolto, grazie»** e **«Non è risolto, riapri»**.
   I due pulsanti aprono il portale con `?azione=risolto` o `?azione=riapri`: dopo l'accesso il portale chiede una conferma con un clic e poi usa il meccanismo di GLPI per approvare o rifiutare la soluzione (un followup con `add_close` chiude il ticket; con `add_reopen` lo riapre «In lavorazione» con il messaggio «L'utente segnala che il problema non è risolto»). Funziona solo per il richiedente e solo se il ticket è «Risolto». Verifica sul tuo GLPI che l'utente di servizio del portale possa farlo (provato dall'autore solo in modalità demo).
3. In GLPI: *Configurazione > Notifiche > Modelli di notifica > Tickets* > traduzione predefinita: incolla il testo nel campo testo e l'HTML nel campo HTML (passa alla vista codice dell'editor). Oggetto consigliato: `##ticket.action## ##ticket.title##`.

> Nota GLPI 11: se le mail mostrano codice HTML come testo («`<div>...`»), il modello nel database è salvato con i caratteri già convertiti (`&lt;div&gt;`, formato di versioni precedenti). Va reinserito HTML «vero».

## 4. Oggetto delle mail e mail doppie (trigger facoltativo)

GLPI aggiunge sempre all'oggetto il prefisso `[GLPI #0000023]` (si può cambiare la parola «GLPI» nell'entità, non toglierlo) e il titolo contiene la `[categoria]` messa dal portale. Il trigger `deploy/glpi/trigger-anti-duplicati.sql`:

- riscrive l'oggetto in **`Richiesta n. 23 · Nuova · titolo`** (stati: Nuova, Aggiornamento, Risolta, Chiusa; la categoria resta nel corpo della mail e nel ticket);
- scarta la mail «Aggiornamento» generata subito dopo la «Nuova chiamata» quando il ticket viene assegnato alla creazione;
- toglie la casella condivisa dai destinatari quando c'è un tecnico assegnato (vedi tabella sopra).
- non invia la mail «Chiusura della chiamata» quando il ticket viene chiuso dalla **chiusura automatica** di GLPI (azione automatica `closeticket`, dopo il tempo impostato nell'entità): la riconosce perché nella cronologia del ticket la chiusura risulta fatta da `cron_closeticket`. Le chiusure manuali, compresa la conferma «Risolto, grazie» dal portale, inviano la mail normalmente. Se non usi il trigger e non vuoi questa mail, disattiva la notifica «Chiusura della chiamata».

Le risposte alle mail, se usi un collettore di posta, sono collegate al ticket tramite le intestazioni `Message-ID`/`In-Reply-To`, non tramite l'oggetto. È una modifica al solo database: leggi i commenti del file e ricontrollala dopo ogni aggiornamento di GLPI.
