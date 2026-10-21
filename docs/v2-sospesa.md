# v2.0.0: rilasciata il 2026-10-19 (storia del primo tentativo sospeso)

**Stato: rilasciata.** La v2.0.0 è in produzione dal 2026-10-19 e la verifica pubblica è superata. La PR 5 è unita su `main`, il tag `v2.0.0` e la [release](https://github.com/realfulvio/assistenza-portale/releases/tag/v2.0.0) sono pubblicati.

Questa pagina conserva la storia del primo tentativo del 2026-10-16, annullato subito con rollback, e come è stato chiuso. Il nome del file resta quello originale per non rompere i collegamenti.

## Il primo tentativo (2026-10-16)

La v2 era stata installata su un server di produzione e **annullata subito con rollback** perché l'interfaccia «si vedeva tutta rotta».

L'installazione di produzione non usa questo repository così com'è: è una linea di codice diversa (Express 5, accesso con `msal`, testi dell'ente scritti nell'HTML). Per il rilascio le modifiche erano state **portate a mano** su quei file con uno script. Nel porting i collegamenti a `theme.css` (variabili dei temi) e `temi.css` **non erano finiti nell'`index.html`** di produzione: senza variabili CSS colori, sfondi e bordi risultavano indefiniti.

- Nel repository l'`index.html` era corretto: il difetto stava solo nel porting.
- I test automatici non lo vedevano perché controllavano console e struttura, non l'aspetto.
- La causa è stata riprodotta su una build che imita la produzione (vedi [Stabilizzazione della v2](v2-stabilizzazione.md) e [Produzione e repository](produzione-vs-repo.md)); sul server reale non era più disponibile l'HTML servito durante il guasto.

## Come è stato chiuso

1. Correzioni e prove nel ramo `v2.0`: `npm run lint`, `npm test`, QA dell'Aspetto con scansioni axe e `scripts/verifica-deploy.js` su più temi, desktop e telefono, PDF ed esito.
2. Nuovi controlli contro il ripetersi dell'errore: `scripts/verifica-deploy.js` e `npm run verifica:rilascio -- URL` controllano l'HTML effettivamente servito e i CSS e script collegati; `scripts/rilascio.sh` esegue backup e un solo rollback automatico se qualcosa va storto.
3. Rilascio in produzione il 2026-10-19 con la **strada A**: produzione allineata al codice del repository, senza porting a mano ([motivi e confronto](produzione-vs-repo.md)). Procedura in [Fase B](fase-b.md), con verifica pubblica dell'istanza reale.
4. Merge della PR 5 su `main`, tag annotato `v2.0.0` e release dal [CHANGELOG](../CHANGELOG.md).

Prerequisito da ricordare in ogni installazione: il profilo API di GLPI deve avere il diritto «Attività > Vedere le attività pubbliche», altrimenti le attività pubbliche non compaiono nelle conversazioni (il portale lo segnala nel log).

## Note

- Riepilogo PDF: i font sono i WOFF di Titillium Web in `src/fonti/` (licenza SIL OFL, come quelli in `public/fonts/`).
