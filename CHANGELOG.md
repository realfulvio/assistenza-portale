# Registro delle modifiche

Il formato segue [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/) e il progetto usa il [versionamento semantico](https://semver.org/lang/it/).

## [1.0.0] - 2026-10-13

Prima versione pubblica.

### Aggiunto
- Apertura delle richieste in tre passi: scelta del problema (caselle colorate), descrizione guidata, invio.
- «Le mie richieste» con stati (In attesa, In lavorazione, In sospeso, Risolta, Chiusa), dettaglio e messaggi al tecnico.
- Allegati (numero, dimensione e tipo configurabili, controllo del tipo reale del file).
- Accesso con OpenID Connect generico (Microsoft Entra ID come esempio principale), con limitazione facoltativa a tenant, gruppo o dominio e-mail.
- Integrazione con GLPI tramite API REST e utente di servizio; creazione automatica dei richiedenti con profilo Self-Service.
- Personalizzazione dell'ente in `config/ente.json` (nomi, logo, colori, testi, crediti), categorie in `config/categorie.json`, FAQ in `content/faq.json`.
- Modalità demo (`npm run demo`) con GLPI finto e accesso simulato.
- Modello HTML delle notifiche GLPI, trigger anti-mail duplicate, profilo GLPI «Tecnico Ticket», esempi di configurazione Apache e systemd.
- Test automatici (`npm test`) e controllo minimo del codice (`npm run lint`).
