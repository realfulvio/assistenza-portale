# v2.0.0: rilascio SOSPESO (note per riprendere il lavoro)

**Stato: NON pubblicata.** Il ramo `v2.0` contiene tutto il lavoro, ma la v2 è stata installata su un server di produzione e **annullata subito con rollback** perché l'interfaccia si vedeva male. Nessun merge su `main`, nessun tag `v2.0.0`, nessuna release.

## Cosa è stato fatto (nel ramo `v2.0`)

Temi animati e pannello Aspetto, nuova pagina «Nuova richiesta», richieste a conversazione, riepilogo PDF e stampa, foto profilo, barra «Live», guide, `VERSION` e CHANGELOG 2.0.0. `npm test` 57/57, `npm run lint` pulito, PDF verificato visivamente sul riferimento grafico.

## Cosa non andava

L'installazione di produzione non usa questo repository così com'è: è una linea di codice diversa (Express 5, accesso con `msal`, testi dell'ente scritti nell'HTML). Per il rilascio le modifiche sono state **portate a mano** su quei file con uno script. Nel porting i collegamenti a `theme.css` (variabili dei temi) e `temi.css` **non sono finiti nell'`index.html`** di produzione: senza variabili CSS colori, sfondi e bordi risultavano indefiniti e la pagina «si vedeva tutta rotta».

- Nel repository l'`index.html` è corretto (collega `theme.css`, `style.css`, `temi.css`, ecc.): il difetto era solo nel porting.
- I test automatici non lo vedevano perché controllano console e struttura, non l'aspetto. Lo stesso errore, riprodotto in locale sulla build adattata, è stato corretto e verificato con uno screenshot, ma **non è stato ripubblicato** dopo il rollback.
- È un'ipotesi molto probabile, non confermata dal sintomo sul server reale: alla ripresa riprodurre il problema prima di dichiararlo risolto.

## Per riprendere

1. Provare il ramo in locale: `npm ci && DEMO=1 node src/server.js`, aprire `http://127.0.0.1:3000/assistenza/`, provare tutti i temi dal pannello «Aspetto», la nuova richiesta fino alla conferma, il dettaglio di una richiesta e il PDF.
2. Controllare a vista (non solo con i test) ogni tema su desktop e su telefono.
3. Per un'installazione che non è questo repository: portare le modifiche e **confrontare l'HTML finale** (fogli di stile collegati, `<script>`, `__VERSIONE__` sostituito) prima del rilascio; fare uno screenshot della pagina servita dal server di destinazione.
4. Solo dopo: unire su `main`, tag annotato `v2.0.0`, release dal CHANGELOG.

## Altri punti da migliorare

- Il rollback automatico dello script di rilascio si attivava due volte; corretto, ma da provare.
- Nella barra «Live» e in altri punti restano colori fissi: verificare il contrasto sui temi scuri.
- Riepilogo PDF: i font sono i WOFF di Titillium Web in `src/fonti/` (licenza SIL OFL, come quelli in `public/fonts/`).


## Ripresa sul minipc (16 ottobre 2026)

Il lavoro di stabilizzazione continua nel ramo `fix/v2-stabilizzazione` nella copia
`/srv/dev/projects/assistenza-portale` sul minipc. I problemi riproducibili e le
verifiche sono descritti nel [report di stabilizzazione](v2-stabilizzazione.md).
La v2 resta non pubblicata e la PR originale resta sospesa: i risultati sul
repository non dimostrano che il porting della linea Express 5/MSAL in produzione
sia corretto. Il repository non contiene lo script di quel porting/rollback.
Prima del rilascio serve ancora il collaudo della copia effettiva di destinazione,
con accesso Entra e GLPI reali. Il nuovo comando `verifica:rilascio` può controllare
in sola lettura l'HTML e le risorse servite da quella copia.
