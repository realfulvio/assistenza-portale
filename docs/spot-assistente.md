# Spot nella nuvoletta dell'assistente

Gli spot sono facoltativi. Copiare `content/spot-assistente.example.json` in `content/spot-assistente.json` e impostare `attivo: true` soltanto sulle voci da mostrare. Il catalogo attivo è ignorato da Git; `SPOT_ASSISTENTE_FILE` può indicare un percorso alternativo. In assenza del catalogo non viene mostrato alcuno spot.

Ogni voce contiene `id`, `titolo`, `testo`, eventuale `battuta`, `video`, `poster`, `url`, `descrizioneVideo` e `parodia`. I media devono stare in `/media/spot/` sullo stesso sito; i link esterni devono usare HTTPS. Il video è facoltativo e un link non viene inventato quando manca. Per una finestra temporale si possono usare `dal` e `al` con data ISO8601 e fuso esplicito: la fine è esclusiva. I tre filmati forniti sono un esempio promozionale e due parodie; l'esempio li lascia disattivati.

Il meteo rimane il primo fumetto. Dopo il primo minuto, a ogni turno eleggibile c'è una probabilità del 25% di mostrare uno spot. Fra due spot si attende almeno cinque minuti, più 0–30 secondi casuali e l'attesa del successivo turno estratto. Non è quindi un appuntamento esatto ogni cinque minuti. Si evita di scegliere subito l'ultimo spot e anche le battute normali sono casuali.

Gli spot spontanei partono muti direttamente nella nuvoletta e non prendono il focus. Restano visibili mentre il video è in riproduzione. Non compaiono durante chat, scrittura, compilazione della richiesta o pagina nascosta. «Non mostrare spot» conserva la preferenza nel browser; si riattivano da Aspetto.

Scrivendo «spot» o «pubblicità» si avvia immediatamente un video casuale, con audio se consentito dal browser, anche con avvisi automatici silenziati o durante il loro intervallo di attesa. La chat si richiude conservando messaggi e bozza; «Torna alla chat», la chiusura o Esc la riaprono. Il comando non chiama il modello AI e non modifica ticket o cronologia. La chiusura, la riapertura della chat o il cambio di scheda arrestano il video e rimuovono la sua sorgente.

Il catalogo non contiene dati del dipendente. Il filmato viene scaricato soltanto quando la sua nuvoletta viene mostrata e il collegamento esterno viene aperto solo su clic. Il comando manuale usa soltanto i video attivi; se non ce ne sono mostra un messaggio locale. Verificare separatamente contenuto, diritti e appropriatezza degli spot scelti dall'installazione.
