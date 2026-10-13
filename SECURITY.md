# Sicurezza

## Segnalare una vulnerabilità

Non aprire una *Issue* pubblica. Usa la funzione **«Report a vulnerability»** (Security advisories) del repository GitHub, oppure contatta l'autore dal suo profilo https://github.com/realfulvio.

Indica versione, descrizione, passi per riprodurre e impatto. Riceverai una risposta appena possibile: è un progetto personale, senza tempi di risposta garantiti.

## Versioni supportate

Solo l'ultima versione pubblicata sul ramo `main`.

## Buone pratiche per chi installa

- Il file `.env` deve avere permessi `600` e appartenere all'utente del servizio.
- Non attivare mai `DEMO=1` su un server raggiungibile da altri.
- Usa HTTPS; attiva `HSTS=1` solo con un certificato definitivo e fidato.
- Rinnova il *client secret* OIDC prima della scadenza e revoca quello vecchio.
- Dai all'utente di servizio GLPI solo i diritti necessari (vedi `docs/glpi.md`).
- Tieni aggiornati sistema operativo, GLPI, Node.js e le dipendenze (`npm audit`).
