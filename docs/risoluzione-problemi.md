# Risoluzione dei problemi

Il primo posto dove guardare:
```bash
sudo journalctl -u portale-assistenza -n 50     # log del portale (senza dati personali)
sudo tail -n 50 /var/log/apache2/error.log      # Apache
sudo tail -n 50 /var/www/glpi/files/_log/php-errors.log   # GLPI
```

| Sintomo | Causa probabile | Cosa fare |
|---|---|---|
| Il servizio non parte, «Configurazione incompleta» | manca una variabile in `.env` | completa `.env` (vedi `.env.example`) |
| Pagina senza grafica (solo testo) | CSS vecchio in cache del browser | ricarica con Ctrl+Maiusc+R; il portale versiona già CSS e JS |
| «Qualcosa non ha funzionato» dopo l'accesso | client secret scaduto o sbagliato, redirect URI diverso | vedi [accesso-microsoft-entra.md](accesso-microsoft-entra.md) |
| «Accesso non consentito» | l'utente non rispetta tenant/gruppo/dominio configurati | controlla `OIDC_ALLOWED_*` |
| Errore all'invio della richiesta | GLPI non raggiungibile o token non validi | nel log cerca `GLPI ... -> 4xx/5xx` e il codice `ERROR_...`; vedi [glpi.md](glpi.md) |
| «Un allegato non è stato caricato» | limiti di GLPI o PHP (2 MB di base) | vedi [glpi.md](glpi.md), sezione Allegati grandi |
| Il richiedente in GLPI è un utente nuovo invece del tecnico esistente | in GLPI il tecnico non ha l'e-mail del suo account | aggiungi l'e-mail all'utente GLPI |
| Mail con codice HTML visibile | modello di notifica salvato con caratteri convertiti | reinserisci il modello, vedi [notifiche-mail.md](notifiche-mail.md) |
| Mail mai inviate | cron di GLPI non attivo o azione automatica in modalità interna | vedi [notifiche-mail.md](notifiche-mail.md) |
| Orari sbagliati di qualche ora | fuso orario PHP in UTC | vedi [glpi.md](glpi.md), sezione Fuso orario |
| Apache in crash (`Segmentation fault` nel log) dopo un `reload`, con mod_auth_openidc | librerie diverse tra il processo vecchio e il modulo nuovo | `sudo systemctl restart apache2`; se continua `sudo a2disconf glpi-sso` e restart |
| Certificato non accettato da Firefox | Firefox non usa l'archivio di Windows | criterio `ImportEnterpriseRoots`, vedi [apache-reverse-proxy.md](apache-reverse-proxy.md) |

Se non risolvi, apri una *Issue* con versioni e log ripuliti da dati personali (vedi [CONTRIBUTING.md](../CONTRIBUTING.md)).
