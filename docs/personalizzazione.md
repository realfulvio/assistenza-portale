# Personalizzazione

Tutto si fa con file di testo, senza programmare. Dopo ogni modifica a `config/*.json`:
```bash
sudo systemctl restart portale-assistenza
```
(`content/faq.json` invece viene riletto a ogni richiesta). Puoi provare le modifiche in locale con `npm run demo`.

## Ente, nomi e testi – `config/ente.json`

Copia `config/ente.example.json` in `config/ente.json`.

| Campo | Esempio | Dove si vede |
|---|---|---|
| `ente.nome` | Comune di Esempio | barra in alto, titolo della pagina, piè di pagina |
| `ente.sito` | https://www.esempio.it | link «Torna al sito» |
| `ente.piede` | Servizio Sistemi Informativi | piè di pagina |
| `servizio.nome` | Assistenza Informatica | testata |
| `servizio.sottotitolo` | Comune di Esempio · Servizio … | sotto il nome del servizio |
| `servizio.ufficio` | Servizio Sistemi Informativi | pagina Contatti |
| `servizio.email` | assistenza@esempio.it | pagina Contatti (vuoto = non mostrato) |
| `servizio.telefonoUrgenze` | 0123 456 789 | pagina Contatti (vuoto = non mostrato) |
| `testi.pulsanteAccesso` | Accedi con Microsoft 365 | pagina di accesso |
| `testi.esempioTelefono` | es. 0123 456 789 | suggerimento nel campo telefono |
| `testi.urgenze` | … | pagina Contatti |
| `crediti.*` | Powered by Accorsi Luca | piè di pagina e in alto a destra |

## Logo e colori

- Metti il logo (meglio SVG o PNG quadrato, almeno 112×112, sfondo bianco o trasparente) in `public/img/` e indica il nome in `grafica.logo` (es. `img/stemma.png`), con il testo alternativo in `grafica.logoAlt`.
- Colori in `grafica`: `colorePrimario` (`#005e8e`), `colorePrimarioScuro` (`#004a70`), `coloreBarra` (`#001a4d`), `coloreSfondo` (`#f2f2f2`). Solo codici esadecimali. Controlla il contrasto con il testo bianco (almeno 4.5:1, es. con https://webaim.org/resources/contrastchecker/).
- Il logo del servizio (scudo con cuffia) è in `public/img/logo-servizio*.svg`; favicon in `public/favicon.ico` e `public/img/icon-192.png`, `icon-512.png`.

## Categorie – `config/categorie.json`

Copia `config/categorie.example.json` in `config/categorie.json`. Per ogni categoria:

| Campo | Significato |
|---|---|
| `id` | codice interno, minuscolo, senza spazi. Non cambiarlo dopo l'uso |
| `nome` | prefisso del titolo del ticket in GLPI, es. `[Stampante] ...` |
| `glpiId` | id della categoria ITIL in GLPI (`null` = nessuna) |
| `tipo` | `1` incidente, `2` richiesta |
| `titolo`, `sotto` | testo grande e descrizione della casella |
| `colore` | colore della casella (esadecimale) |
| `icona` | una tra `pc`, `pr`, `nt`, `ml`, `ky`, `ap`, `ot` (computer, stampante, rete, posta, chiave, applicazioni, punto di domanda) |
| `placeholder` | esempio mostrato nella descrizione |

Le icone sono simboli SVG in `public/index.html` (blocco `<svg class="sprite">`): per aggiungerne una nuova aggiungi un `<symbol id="...">`.

## Domande frequenti – `content/faq.json`

Elenco di coppie `{"d": "domanda", "r": "risposta"}`. Compaiono nella pagina «Guide».

## Testi delle mail

Vedi [notifiche-mail.md](notifiche-mail.md): il modello usa gli stessi dati di `config/ente.json`.
