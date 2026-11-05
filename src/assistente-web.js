// Ricerca sul web come ripiego, solo dopo conferma esplicita dell'utente.
// Motori: SearXNG locale (ASSISTENTE_WEB=searxng) o Brave Search API (ASSISTENTE_WEB=brave). Spento se vuoto.
// Si usano solo titoli e anteprime restituiti dal motore: il server non scarica le pagine dei risultati.
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const errore = (messaggio, status = 400) => Object.assign(new Error(messaggio), { status });
const pulisci = (s, n) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// Dati personali o riservati: la domanda non deve uscire dalla rete del Comune.
const DATI_PERSONALI = [
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,                 // email
  /\b[a-z]{6}\d{2}[a-z]\d{2}[a-z]\d{3}[a-z]\b/i,              // codice fiscale
  /\bit\d{2}[a-z]\d{10}[0-9a-z]{12}\b/i,                     // IBAN
  /(?:\+39\s?)?\b\d{2,4}[\s./-]?\d{5,8}\b/,                  // numeri di telefono
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/,                             // indirizzi IP
  /\\\\[a-z0-9._-]+/i,                                         // percorsi di rete \\server
  /\b(?:password|passwd|pwd|pin|puk|otp|credenzial|codice fiscale|iban|stipend|busta paga|cedolin|malattia|certificato medico|diagnos|sanzion|multa|targa|residenz|anagrafe di|tribut[oi] di|pratica n|protocollo n)/i,
  /\b(?:collega|dipendente|signor|signora|sig\.|dott\.?|dottor|cittadin)/i // persone specifiche
];
// Sistemi e argomenti interni: la risposta va chiesta al CED, non al web.
const INTERNI = /\b(?:del comune|in comune|nostro comune|dell ente|ced|sistemi informativi|halley|x-?desk|sangfor|vdi|watchguard|n-?able|elco|glpi|portale|ticket|richiesta n|protocollo|gestionale|timbrat|presenze|cartell[ae] condivis|unita di rete|server|vpn|rete interna|wi-?fi del|stampante del|fotocopiatrice del|ufficio [a-z]+ del comune|intranet|sharepoint)\b/;
// Nomi interni propri dell'ente (portali, applicativi), separati da virgola: ASSISTENTE_WEB_INTERNI=nome portale,altro.
const INTERNI_ENTE = String(process.env.ASSISTENTE_WEB_INTERNI || '').split(',').map(t => norm(t).trim()).filter(Boolean);
const SALUTI = /^(?:ciao|salve|buongiorno|buonasera|grazie|ok|va bene|si|no|aiuto|help|ehi|hey)\b/;

function controlla(domanda) {
  const d = String(domanda || '').trim(), n = norm(d);
  if (DATI_PERSONALI.some(r => r.test(d))) return { ammessa: false, motivo: 'dati' };
  if (INTERNI.test(n) || INTERNI_ENTE.some(t => n.includes(t))) return { ammessa: false, motivo: 'interno' };
  const parole = n.match(/[a-z0-9]+/g) || [];
  if (SALUTI.test(n) && parole.length < 5) return { ammessa: false, motivo: 'vaga' };
  if (parole.length < 3 && !d.includes('?')) return { ammessa: false, motivo: 'vaga' };
  return { ammessa: true };
}

// Domanda informativa (come si fa, che cos'è, orari...) e non segnalazione di un guasto: solo queste vanno sul web.
const GUASTO = /\b(?:non (?:funziona|va|si apre|parte|stampa|riesco|carica|si collega|si avvia|si accende|vedo|sento)|errore|bloccat|lent[oia]|si spegne|si blocca|rotto|guast|rumore|crash|schermata blu)/;
const INFORMATIVA = /^(?:come|cos|che cos|cosa|qual|quali|quanto|quanti|quando|dove|perche|chi|che differenza|a cosa serve|che orari|mi spieghi|spiegami|esiste|si puo|posso)\b/;
function informativa(domanda) {
  const n = norm(domanda).replace(/[’']/g, ' ').trim();
  return !GUASTO.test(n) && (INFORMATIVA.test(n) || /\?\s*$/.test(n));
}

const dominio = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const sicuro = (url) => { try { const u = new URL(url); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; } };

function creaRicerca(config, fetchImpl = fetch) {
  const motore = String(config.assistenteWeb || '').toLowerCase();
  const attiva = ['searxng', 'brave'].includes(motore) && (motore !== 'brave' || !!config.assistenteWebChiave);
  async function cerca(domanda, { signal } = {}) {
    if (!attiva) throw errore('La ricerca sul web non è attiva.', 503);
    const segnale = signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000);
    let r, risultati;
    try {
      if (motore === 'searxng') {
        const url = new URL('/search', (config.assistenteWebUrl || 'http://127.0.0.1:8888').replace(/\/?$/, '/'));
        url.search = new URLSearchParams({ q: domanda, format: 'json', language: 'it-IT', safesearch: '1' });
        r = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: segnale });
        if (!r.ok) throw Error('HTTP ' + r.status);
        risultati = ((await r.json()).results || []).map(x => ({ titolo: x.title, url: x.url, testo: x.content }));
      } else {
        const url = new URL('https://api.search.brave.com/res/v1/web/search');
        url.search = new URLSearchParams({ q: domanda, country: 'IT', search_lang: 'it', safesearch: 'strict', count: '8' });
        r = await fetchImpl(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': config.assistenteWebChiave }, signal: segnale });
        if (!r.ok) throw Error('HTTP ' + r.status);
        risultati = ((await r.json()).web?.results || []).map(x => ({ titolo: x.title, url: x.url, testo: x.description }));
      }
    } catch (e) {
      if (signal?.aborted) throw e;
      throw errore('La ricerca sul web non risponde. Riprova tra poco oppure apri una richiesta.', 503);
    }
    const visti = new Set();
    return risultati.filter(x => sicuro(x.url) && x.titolo)
      .map(x => ({ titolo: pulisci(x.titolo, 140), url: String(x.url).slice(0, 600), dominio: dominio(x.url), testo: pulisci(x.testo, 500) }))
      .filter(x => x.dominio && !visti.has(x.dominio) && visti.add(x.dominio))
      .slice(0, 5);
  }
  return { attiva, motore, cerca };
}

function messaggi(domanda, risultati) {
  return [
    { role: 'system', content: 'Sei l’assistente del portale dei dipendenti di un Comune italiano. Rispondi in italiano, dando del tu, in massimo 80 parole e al massimo due brevi paragrafi. Usa SOLO le informazioni dei risultati di ricerca forniti: non aggiungere fatti, numeri, orari o prezzi che non compaiono nei risultati. Se i risultati non bastano a rispondere, dillo in una frase e suggerisci di consultare le fonti. Non citare i risultati per numero e non inserire link.' },
    { role: 'user', content: `DOMANDA:\n${domanda}\n\nRISULTATI DI RICERCA:\n${risultati.map((x, i) => `${i + 1}. ${x.titolo} (${x.dominio})\n${x.testo}`).join('\n\n')}` }
  ];
}

module.exports = { controlla, informativa, creaRicerca, messaggi, dominio };
