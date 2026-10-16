# Guide: immagini da acquisire e punti da verificare

File generato da `node scripts/verifica-faq.js --report` a partire da `content/faq.json` (campi `mancante` dei passi e `verifica` delle guide). Non modificarlo a mano.

## Immagini mancanti

- **pc-lento-bloccato**, passo 4: Schermata del menu Start di Windows 11 con il pulsante di accensione e la voce «Riavvia il sistema» evidenziati (da acquisire su un PC di prova: il menu Start mostra file recenti e nome utente, va ritagliato).
- **monitor-nero**, passo 2: Fotografia del pulsante e della luce di un monitor tipo in uso al Comune (da scattare sul posto).
- **secondo-monitor**, passo 1: Pannello che si apre con Windows + P (Solo schermo PC, Duplica, Estendi, Solo secondo schermo), acquisito su un PC con due monitor collegati.
- **audio**, passo 3: Schermata di Impostazioni > Sistema > Audio senza nomi di dispositivi reali (da acquisire su un PC di prova).
- **stampante-non-stampa**, passo 1: Fotografia di un display di fotocopiatrice con un messaggio d'errore reale (carta o toner) e del pulsante di accensione.
- **stampante-offline**, passo 1: Pagina Impostazioni > Bluetooth e dispositivi > Stampanti e scanner con una stampante di prova in stato «Offline» (la pagina reale elenca le stampanti del Comune, quindi va acquisita su un PC di prova).
- **stampante-scelta**, passo 2: Schermata della finestra «Stampa» di Word o Excel con il menu «Stampante» aperto, con nomi di stampante di esempio (da acquisire su un PC di prova senza stampanti reali).
- **internet**, passo 1: Ritaglio della barra delle applicazioni con l'icona di rete nei tre stati (connesso, senza Internet, cavo scollegato) da acquisire su un PC di prova.
- **password-dimenticata**, passo 2: Schermata della pagina di accesso con «Password dimenticata?» evidenziato (solo se la reimpostazione è attiva).
- **screenshot-allegati**, passo 1: Barra dello Strumento di cattura (Windows + Maiusc + S) con il rettangolo di selezione, acquisita su un PC di prova con sfondo neutro.
- **screenshot-allegati**, passo 4: Schermata con l'allegato «screenshot-…» già incollato nell'elenco sotto il riquadro e il pulsante «Rimuovi» (da acquisire dal portale con un utente di prova).

## Verifiche da fare prima della pubblicazione

- **nome-pc**: Se i PC hanno l'icona «Assistenza» sul desktop (docs/icona-desktop.md) il nome arriva già nella richiesta: confermare se è attiva e, in caso, aggiungerlo al testo.
- **fronte-retro**: I nomi esatti delle voci cambiano con programma e modello di stampante: controllare su un PC dell'ente con le stampanti reali.
- **scansione**: Il modo di fare la scansione dipende dal modello di fotocopiatrice e dalle destinazioni configurate: sostituire i passi generici con quelli reali, con foto del display.
- **outlook-non-si-apre**: Confermare se il Comune usa Outlook classico o il «nuovo Outlook» e adattare la voce «Disconnesso» e gli screenshot.
- **allegato-troppo-grande**: Il limite reale della dimensione allegati dipende dalla configurazione della posta del Comune: verificare il valore e scriverlo.
- **cercare-email**: I nomi delle opzioni di ricerca dipendono dalla versione di Outlook in uso.
- **teams-audio-video**: Le voci di menu di Teams cambiano tra vecchio e nuovo Teams: controllare la versione in uso e aggiungere lo screenshot.
- **accesso-remoto**: Dipende dal sistema di accesso remoto in uso (VPN, desktop virtuale, altro): sostituire i passi generici con quelli reali.
- **password-dimenticata**: Confermare se la reimpostazione autonoma della password è attiva in Microsoft Entra e se vale anche per la password di Windows.
- **mfa-richiesta**: Confermare quali metodi di verifica a due passaggi sono attivi (app, SMS, chiamata) e i testi dei pulsanti dell'app usata.
- **mail-sospetta**: Verificare se in Outlook è attivo un pulsante «Segnala» (phishing) e, in caso, inserirlo qui con uno screenshot.
- **link-cliccato**: Confermare con il CED la procedura ufficiale (spegnere o solo scollegare dalla rete) e il numero di reperibilità.
