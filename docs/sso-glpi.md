# (Facoltativo) Login Microsoft anche in GLPI e profilo «Tecnico Ticket»

Questa parte riguarda **i tecnici**, non il portale. È facoltativa e più delicata: fai prima un backup di `/etc/apache2` e delle tabelle `glpi_configs`, `glpi_users`, `glpi_profiles_users`.

## Login Microsoft in GLPI con mod_auth_openidc

GLPI 11 non ha un login OpenID Connect integrato nella versione gratuita (esiste il plugin ufficiale *OAuth SSO*, che richiede un abbonamento GLPI Network). Questa soluzione usa invece:
- il modulo Apache [mod_auth_openidc](https://github.com/OpenIDC/mod_auth_openidc), che fa il login e imposta `REMOTE_USER`;
- l'**SSO nativo di GLPI** basato su una variabile del server.

Si può riusare la stessa registrazione Entra del portale, aggiungendo il redirect URI `https://<glpi.tuoente.it>/oidc-redirect`.

### Passi (provati su Debian 13 / GLPI 11.0.8)

1. Pacchetto: `sudo apt install libapache2-mod-auth-openidc` **[testato]**.
   Attenzione: l'installazione abilita il modulo e prova a ricaricare Apache.
2. Segreti: copia `deploy/apache/glpi-oidc-secret.conf.example` in `/etc/apache2/glpi-oidc-secret.conf`, compila, poi `sudo chmod 600` e proprietario `root`.
3. Vhost: copia `deploy/apache/glpi-sso.conf.example` in `/etc/apache2/conf-available/glpi-sso.conf` e sostituisci i segnaposto, compresa la lista degli account ammessi nella riga `Require claim`.
4. Pagina d'ingresso: `sudo mkdir -p /opt/glpi-sso && sudo cp deploy/apache/sso.html /opt/glpi-sso/`.
5. Certificato con anche il nome di GLPI (SAN), DNS per `<glpi.tuoente.it>`.
6. In GLPI (*Configurazione > Autenticazione > Altri metodi di autenticazione*, o simile) **[testato via database, verifica la voce nell'interfaccia]**:
   - campo per l'SSO: `REMOTE_USER`;
   - rimuovere il dominio dal login: **Sì** (così `nome.cognome@tuoente.it` diventa `nome.cognome`);
   - **disattiva l'aggiunta automatica degli utenti** da sorgenti esterne, così un dipendente che si autentica non ottiene accesso a GLPI.
7. I login GLPI dei tecnici devono coincidere con la parte prima della `@` del loro account (es. `nome.cognome`).
8. `sudo a2enconf glpi-sso && sudo apachectl configtest && sudo systemctl restart apache2`.

L'ingresso è `https://<glpi.tuoente.it>/sso`; il login locale di GLPI resta disponibile alla pagina normale (aggiungi `?noAUTO=1` all'indirizzo se parte l'accesso automatico).

> **Importante**: dopo aver installato il modulo usa `systemctl restart apache2`, **non** `reload`. Nell'installazione dell'autore un `reload` ha mandato in crash i processi di Apache (probabile conflitto tra librerie già in memoria e nuove); il `restart` ha risolto. Vedi [risoluzione-problemi.md](risoluzione-problemi.md).

## Profilo «Tecnico Ticket»

Un profilo con il menu ridotto ai ticket (Assistenza: ticket, pianificazione, statistiche), da usare come predefinito per i tecnici lasciando anche Super-Admin selezionabile dal cambio profilo.

- Script: `deploy/glpi/profilo-tecnico-ticket.sql` (leggi i commenti, fai un backup, provalo prima su un GLPI di test).
- In alternativa dall'interfaccia: *Amministrazione > Profili*, clona «Technician» e togli i diritti non necessari.

I menu a tendina di utenti, gruppi e categorie nei ticket funzionano anche senza i diritti di lettura su quelle voci (GLPI verifica un token interno); verifica comunque con un tecnico di prova.
