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

## 2. Quali notifiche attivare

Consigliate (le altre si possono disattivare per non riempire le caselle): **Nuova chiamata**, **Aggiornamento** (comprende l'assegnazione), **Chiamata risolta**, con destinatari *Richiedente* e *Gruppo assegnato*.

## 3. Modello HTML

1. Personalizza `config/ente.json` e imposta `PUBLIC_URL` in `.env`.
2. Genera il modello **[testato]**:
   ```bash
   npm run template-mail
   ```
   Crea `deploy/glpi/mail-ticket.html` e `deploy/glpi/mail-ticket.txt` (riquadro «Non rispondere», pulsante «Rispondi dal portale», colori dell'ente).
3. In GLPI: *Configurazione > Notifiche > Modelli di notifica > Tickets* > traduzione predefinita: incolla il testo nel campo testo e l'HTML nel campo HTML (passa alla vista codice dell'editor). Oggetto consigliato: `##ticket.action## ##ticket.title##`.

> Nota GLPI 11: se le mail mostrano codice HTML come testo («`<div>...`»), il modello nel database è salvato con i caratteri già convertiti (`&lt;div&gt;`, formato di versioni precedenti). Va reinserito HTML «vero».

## 4. Evitare la mail «Aggiornamento» subito dopo «Nuova chiamata»

- Il portale collega gli allegati senza generare notifiche.
- Resta una mail «Aggiornamento» causata dall'assegnazione automatica al gruppo tecnico. Se vuoi eliminarla, usa il trigger `deploy/glpi/trigger-anti-duplicati.sql` (soglia e testo nei commenti). È una modifica al solo database: ricontrollala dopo ogni aggiornamento di GLPI.
