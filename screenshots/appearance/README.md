# Verifica locale dei temi — 16 ottobre 2026

> Rapporto storico. Cyberpunk, Hawaii, Terminale e Nebbia padana sono stati poi rimossi dal portale: le loro schermate sono state tolte, mentre `qa-report.json` resta com'era.

Tutti i dati nelle schermate sono quelli della demo, con ente e identità fittizi. Backend GLPI simulato, server su loopback, archivio delle preferenze temporaneo. Nessun ticket o messaggio inviato a sistemi reali.

## Risultati

- `npm run lint`: 23 file controllati, zero errori di sintassi/JSON.
- `npm test`: 17 test superati, compresi i 14 test di regressione dei ticket.
- `npm run test:aspetto`: 48 combinazioni = otto temi × tre viewport (1440×1000, 390×844, 320×740) × due configurazioni (100% normale, testo e icone 150% con spaziatura ampia).
- Verificati pannello e pagina senza overflow orizzontale, testi e icone ingranditi, ordine/etichette delle categorie, conservazione di descrizione, telefono, reperibilità, categoria e allegato durante i cambi di aspetto.
- Verificati Tab nel pannello, Esc, ritorno del focus, impostazione iniziale da sistema, profilo, ripristino, errore di salvataggio visibile anche a pannello chiuso e riprova.
- Persistenza dopo reload e accesso da un secondo contesto browser; logout e cambio account nello stesso browser; isolamento degli account A e B con API reali del processo di test.
- Invio tramite interfaccia con allegato, consultazione e risposta nel backend simulato. Elenco, dettaglio, guide, contatti e profilo verificati in tutti i temi anche al 150% su viewport da 320 px.
- 72 analisi axe delle pagine e del pannello con regole WCAG A/AA/2.1 AA. Nessuna nuova violazione; rimane il limite preesistente del Classico descritto sotto. Il rapporto conserva anche le verifiche che axe non risolve automaticamente sui fondi decorati.
- Confronto del Classico con il CSS originale: font, dimensioni e colori di titoli, categorie, icone, textarea e pulsante di invio invariati al 100%.

Il rapporto completo è `qa-report.json`, con versione del browser, matrice, risultati axe e misure numeriche dei contrasti. I test sono eseguiti con Chrome su Windows; le dimensioni mobile sono emulate, non prove su dispositivi fisici.

## Contrasti e limiti

Le coppie misurate comprendono testo/superficie, testo/campo, testo secondario/superficie, testo secondario/superficie attenuata, accento/superficie, accento/superficie attenuata e testo/pulsante. Tutte superano 4,5:1. Minimi nelle nuove skin:

| Tema | Minimo tra le coppie misurate |
| --- | ---: |
| Scuro | 7,34:1 |
| Contrasto elevato | 17,76:1 |
| Montagna | 5,62:1 |

**Contrasto elevato:** testo principale/campo/superficie 21:1; il minimo 17,76:1 riguarda il testo secondario. Il nome del tema non è usato come prova.

**Limite preesistente conservato nel Classico:** il piccolo comando «SCEGLI» della categoria Posta usa l'arancione originale `#c75b00` sul bianco: 4,26:1, inferiore ad AA per quel testo piccolo. Il titolo grande della categoria soddisfa la soglia di 3:1. Il colore approvato è rimasto invariato; la segnalazione è mantenuta nel rapporto, senza nasconderla dietro l'esito dei nuovi temi.

Gradienti, paesaggi e alcuni pseudo-elementi richiedono un controllo visivo aggiuntivo: axe li elenca in `contrastNeedsReview`. Sono state ispezionate schermate rappresentative e misurate le coppie dei token; questi controlli non equivalgono a una certificazione completa di accessibilità. Non sono stati provati screen reader, Safari/iOS o dispositivi mobili fisici.

## Schermate

- [Pannello desktop](pannello-desktop.png)
- [Pannello mobile al 150%](pannello-mobile-150.png)
- [Classico](1440-classic-100.png)
- [Scuro](1440-dark-100.png)
- [Contrasto elevato](1440-contrast-100.png)
- [Montagna](1440-mountain-100.png)

Per ogni tema è presente anche `390-<tema>-150.png`, con testo e icone al massimo e spaziatura ampia.

## Rilascio

Implementazione nel ramo locale `feat/preferenze-aspetto-locali`. Nessuna pubblicazione, push, modifica della copia operativa o intervento sul servizio Debian. Nessuna migrazione SQL. Directory persistente e permesso systemd da preparare soltanto per un futuro rilascio autorizzato; vedere `docs/aspetto-e-leggibilita.md`.
