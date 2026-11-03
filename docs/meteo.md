# Meteo nell’assistente

La funzione è facoltativa e disattivata per impostazione predefinita. In `config/ente.json`, personalizzare il blocco `meteo` presente nel file di esempio: attivazione, nome della località e coordinate geografiche. Non viene rilevata la posizione del dipendente.

I dati provengono da [Open-Meteo](https://open-meteo.com/), con attribuzione e orario nel fumetto. Il server interroga il fornitore senza trasmettere conversazioni o dati degli utenti e riutilizza i risultati per 15 minuti. Una richiesta in corso viene condivisa; dopo un errore attende un minuto prima di riprovare. Se i dati mancano, la chat lo segnala e il fumetto spontaneo resta silenzioso.

Il meteo è il primo fumetto a ogni apertura o ricaricamento della pagina, appena disponibili i dati, anche se era già comparso poco prima. Durante la permanenza sulla pagina si ripete al massimo ogni 50 minuti. Le battute successive hanno un intervallo casuale di 12–16 secondi e restano visibili 6 secondi. Non apre la chat, non prende il focus e non compare quando si scrive o c’è una richiesta in compilazione. Si chiude dopo 18 secondi; resta disponibile se il puntatore o il focus sono sul riquadro. «Silenzia meteo» conserva la preferenza nel browser; si può riattivare da Aspetto. Nascondendo l’assistente si nasconde anche il meteo.

La chat riconosce domande sul tempo di oggi, domani e dopodomani e i seguiti come «E domani?». Località diverse o giorni non coperti ricevono un chiarimento. Le richieste esplicite di barzellette conservano la loro funzione.

`battutaFreddo` e `battutaCaldo` sono testi facoltativi. Si mostrano rispettivamente a temperature minori o uguali a `sogliaFreddo` (8 °C nell’esempio) e maggiori o uguali a `sogliaCaldo` (30 °C). Per oggi si usa la temperatura attuale; per domani e dopodomani la massima prevista. Lasciare i testi vuoti per ometterli. Modificare la configurazione richiede il riavvio del solo portale.
