# Assistente locale

Il personaggio animato apre una chat con quattro percorsi: guide, contatti, proprie richieste e preparazione della descrizione. La sessione è individuale; le API richiedono autenticazione e CSRF per le scritture della conversazione. I dati delle richieste sono recuperati con gli stessi controlli del portale. Il modello viene usato soltanto per le risposte sulle guide, con fonti collegate: non riceve un elenco generale di ticket o la rubrica completa.

Il testo preparato rimane nella chat e va copiato nel modulo dall’utente. Non ci sono invii o chiusure automatiche.

## Avvio senza modello

`npm run demo` include contatti inventati e ticket simulati. Chiedi «Mostra le mie richieste» oppure premi il pulsante per preparare una richiesta. Le risposte generative non sono disponibili finché non configuri Ollama; la pagina Guide rimane utilizzabile.

## Ollama facoltativo

Installa Ollama seguendo le [istruzioni ufficiali](https://docs.ollama.com/quickstart). Su una macchina dedicata al test, scarica i modelli indicati nella configurazione:

```bash
ollama pull qwen3.5:4b-q4_K_M
ollama pull embeddinggemma-2:270m
```

I tag sono quelli predefiniti nell’integrazione; disponibilità, licenze dei modelli e requisiti hardware vanno verificati nel catalogo Ollama prima dell’installazione. Il repository non distribuisce pesi né garantisce prestazioni su ogni CPU. La prima risposta può richiedere tempo per caricamento e indicizzazione.

Nel `.env` esistente sono disponibili `ASSISTENTE_URL` (predefinito `http://127.0.0.1:11434`), `ASSISTENTE_MODELLO`, `ASSISTENTE_EMBEDDING` e `ASSISTENTE_CACHE_FILE`. L’esempio completo è in [`.env.example`](../.env.example). L’unità systemd inclusa imposta la cache in `/var/lib/portale-assistenza/assistente/indice.json`, dentro la directory persistente scrivibile del servizio. Se usi un’unità personalizzata, configura un percorso equivalente e autorizzane la scrittura.

Conserva Ollama su loopback o su una rete privata controllata. Il contenuto delle guide e le domande vengono inviati all’endpoint configurato: scegli un’istanza sotto il tuo controllo. Per escludere le funzioni cloud consulta la [FAQ ufficiale Ollama](https://docs.ollama.com/faq). Le chiamate usano le API ufficiali [chat](https://docs.ollama.com/api/chat) ed [embedding](https://docs.ollama.com/api/embed).

La cache viene aggiornata quando cambiano le guide. Se cambi il modello di embedding, elimina soltanto il file di indice configurato, a servizio fermo: sarà ricostruito alla domanda successiva. Non eliminare l’intera directory dati.

## Verifica

`node --test test/assistente.test.js` verifica contatti senza modello, preparazione del testo, isolamento dei ticket, CSRF, logout durante una risposta e aggiornamento delle fonti con un backend AI simulato. Queste prove non misurano la qualità delle risposte di un modello reale.
