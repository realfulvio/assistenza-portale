# Come contribuire

Grazie per l'interesse! Il progetto vuole restare **semplice**: poche dipendenze, codice leggibile, testi in italiano chiaro.

## Segnalare un problema

Apri una *Issue* con il modello «Problema» e indica:
- versione del portale (tag o commit), di GLPI, di Node.js e del sistema operativo;
- cosa hai fatto, cosa ti aspettavi, cosa è successo;
- le righe di log rilevanti (`journalctl -u portale-assistenza`), **dopo aver tolto** indirizzi, nomi, token e qualsiasi dato personale.

**Non** pubblicare mai file `.env`, token, password, certificati o dump. Per le vulnerabilità segui [SECURITY.md](SECURITY.md).

## Proporre una modifica

1. Fai un fork e crea un ramo (`git checkout -b mia-modifica`).
2. Prova in modalità demo: `npm run demo`.
3. Prima di proporre: `npm run lint` e `npm test` devono passare.
4. Messaggi di commit brevi in italiano (`feat:`, `fix:`, `docs:`).
5. Apri una *Pull Request* spiegando il perché della modifica.

## Regole del codice

- Interfaccia accessibile (tastiera, focus visibile, contrasto, `prefers-reduced-motion`) e utilizzabile da telefono.
- Nessuna risorsa da CDN esterne: tutto in locale.
- Nessuno stile o script inline (la Content Security Policy li blocca).
- Tutto ciò che è specifico di un ente va in `config/` o `content/`, mai nel codice.
- Il portale non modifica il codice di GLPI: solo API REST.

Contribuendo accetti che il tuo contributo sia distribuito con licenza EUPL-1.2.
