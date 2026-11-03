'use strict';

// Fonte ufficiale: https://allertameteo.regione.emilia-romagna.it/sviluppatori
// Il servizio è inattivo senza zona e nome del comune configurati dall'installazione.
const ORIGINE = 'https://allertameteo.regione.emilia-romagna.it';
const URL_STATO_ALLERTA = `${ORIGINE}/o/get-stato-allerta`;
const URL_FONTE = `${ORIGINE}/allerte-e-bollettini`;
const CACHE_MS = 5 * 60 * 1000;
const ERRORE_MS = 60 * 1000;
const MAX_CORPO = 128 * 1024;
const RISCHI = {
  idraulica: 'piene dei fiumi',
  idrogeologica: 'frane e piene dei corsi minori',
  temporali: 'temporali',
  vento: 'vento',
  temperature_estreme: 'temperature estreme',
  neve: 'neve',
  ghiaccio_pioggia_gela: 'pioggia che gela',
  stato_mare: 'stato del mare',
  mareggiate: 'mareggiate',
};
const COLORI = { green: 'verde', yellow: 'gialla', orange: 'arancione', red: 'rossa' };
const LIVELLI = { green: 0, yellow: 1, orange: 2, red: 3 };
const MESI = { jan: 1, gen: 1, feb: 2, mar: 3, apr: 4, may: 5, mag: 5, jun: 6, giu: 6,
  jul: 7, lug: 7, aug: 8, ago: 8, sep: 9, set: 9, oct: 10, ott: 10, nov: 11, dec: 12, dic: 12 };
const FORMATO_ROMA = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

// Le date JSON ufficiali non includono il fuso. Non usare Date.parse:
// la macchina potrebbe avere un fuso diverso e i mesi possono essere inglesi o italiani.
function parseDataRoma(value) {
  if (typeof value !== 'string') return null;
  const match = /^([a-z]{3})\.?\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)$/i.exec(value.trim());
  if (!match) return null;
  const mese = MESI[match[1].toLowerCase()];
  const giorno = Number(match[2]); const anno = Number(match[3]);
  const ora12 = Number(match[4]); const minuti = Number(match[5]); const secondi = Number(match[6]);
  if (!mese || anno < 2000 || anno > 2099 || giorno < 1 || giorno > 31 || ora12 < 1 || ora12 > 12 || minuti > 59 || secondi > 59) return null;
  const ora = ora12 % 12 + (match[7].toUpperCase() === 'PM' ? 12 : 0);
  const localeComeUtc = Date.UTC(anno, mese - 1, giorno, ora, minuti, secondi);
  const attesi = { year: anno, month: mese, day: giorno, hour: ora, minute: minuti, second: secondi };
  const candidati = [];
  // Nel periodo supportato Roma usa UTC+1/+2. La riconversione con Intl verifica
  // calendario e transizioni DST; gli orari mancanti o ambigui vengono rifiutati.
  for (const offsetOre of [1, 2]) {
    const candidato = localeComeUtc - offsetOre * 3600000;
    const parti = Object.fromEntries(FORMATO_ROMA.formatToParts(candidato).map(p => [p.type, Number(p.value)]));
    if (Object.entries(attesi).every(([key, val]) => parti[key] === val)) candidati.push(candidato);
  }
  return candidati.length === 1 ? candidati[0] : null;
}

function normalizzaConfig(config = {}) {
  if (!config || config.enabled === false) return null;
  const zona = typeof config.zona === 'string' ? config.zona.trim().toUpperCase() : '';
  const comune = typeof config.comune === 'string' ? config.comune.trim() : '';
  if (!/^(?:A[12]|B[12]|C[12]|D[123]|E[12]|F[123]|G[12]|H[12])$/.test(zona) || !comune || comune.length > 120) return null;
  return { zona, comune, frase: typeof config.frase === 'string' ? config.frase.trim().slice(0, 200) : '' };
}

function sconosciuto(config) {
  return { stato: 'non_verificabile', colore: null, rischi: [], zona: config.zona, comune: config.comune,
    fonte: 'Allerta Meteo Emilia-Romagna', urlFonte: URL_FONTE,
    messaggio: 'Non riesco a verificare le allerte aggiornate. Consulta la fonte ufficiale.' };
}

function interpretaAllerta(payload, configurazione, adesso = Date.now()) {
  const config = normalizzaConfig(configurazione);
  if (!config) return { stato: 'disabilitato', colore: null, rischi: [] };
  const ignoto = () => sconosciuto(config);
  if (!payload || typeof payload !== 'object' || !Number.isFinite(adesso)) return ignoto();
  const zona = payload[config.zona];
  if (!zona || typeof zona !== 'object') return ignoto();
  const valori = Object.keys(RISCHI).map(codice => zona[codice]);
  if (valori.some(v => v !== null && !Object.hasOwn(COLORI, v)) || !valori.some(v => Object.hasOwn(COLORI, v))) return ignoto();
  const inizio = parseDataRoma(payload.dataInizio);
  const fine = parseDataRoma(payload.dataFine);
  const emissione = parseDataRoma(payload.dataEmissione);
  if (inizio === null || fine === null || emissione === null || fine <= inizio || emissione > adesso || adesso >= fine) return ignoto();
  const documento = typeof payload.titolo === 'string' && /\b(?:Allerta|Bollettino di vigilanza)\s+(\d{1,6}\/\d{4})\b/i.exec(payload.titolo);
  if (!documento || typeof payload.link !== 'string') return ignoto();
  let urlDocumento;
  try {
    const url = new URL(payload.link, ORIGINE);
    if (url.origin !== ORIGINE || url.username || url.password || !url.pathname.startsWith('/documents/') || !/\.pdf$/i.test(url.pathname)) return ignoto();
    urlDocumento = url.href;
  } catch { return ignoto(); }
  const rischi = Object.entries(RISCHI).filter(([codice]) => LIVELLI[zona[codice]] > 0)
    .map(([codice, nome]) => ({ codice, nome, colore: COLORI[zona[codice]] }));
  const massimo = valori.filter(v => Object.hasOwn(COLORI, v)).reduce((a, b) => LIVELLI[b] > LIVELLI[a] ? b : a, 'green');
  const futura = adesso < inizio;
  const stato = futura ? 'prevista' : massimo === 'green' ? 'verde' : 'attiva';
  const colore = COLORI[massimo];
  let messaggio;
  if (massimo === 'green') {
    messaggio = `${futura ? 'Il bollettino previsto indica' : 'Il bollettino in vigore indica'} assenza di fenomeni significativi prevedibili per ${config.comune}.`;
  } else {
    const prefisso = LIVELLI[massimo] === 1 ? `${config.frase || 'Oggi anche il meteo chiede attenzione.'} ` : '';
    messaggio = `${prefisso}Allerta ${colore} ${futura ? 'prevista' : 'in corso'} per ${rischi.map(r => r.nome).join(', ')} a ${config.comune}. Consulta le indicazioni ufficiali.`;
  }
  return { stato, colore, rischi, zona: config.zona, comune: config.comune, messaggio,
    numeroDocumento: documento[1], emessaIl: new Date(emissione).toISOString(),
    validaDa: new Date(inizio).toISOString(), validaFino: new Date(fine).toISOString(),
    fonte: 'Allerta Meteo Emilia-Romagna', urlFonte: URL_FONTE, urlDocumento };
}

function createAllerteMeteo(configurazione, { fetchImpl = globalThis.fetch, now = Date.now, timeoutMs = 6000 } = {}) {
  const config = normalizzaConfig(configurazione);
  const limiteTempo = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 15000) : 6000;
  let cache = null;
  let scade = 0;
  let inCorso = null;
  let verificatoIl = null;

  async function aggiorna() {
    const controller = new AbortController();
    let timer;
    try {
      const lavoro = (async () => {
        const risposta = await fetchImpl(URL_STATO_ALLERTA, {
          signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' },
        });
        if (!risposta.ok) throw new Error('HTTP');
        const lunghezza = Number(risposta.headers?.get('content-length'));
        if (lunghezza > MAX_CORPO) throw new Error('dimensione');
        const testo = await risposta.text();
        if (Buffer.byteLength(testo, 'utf8') > MAX_CORPO) throw new Error('dimensione');
        return JSON.parse(testo);
      })();
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, limiteTempo);
      });
      cache = await Promise.race([lavoro, timeout]);
      scade = now() + (interpretaAllerta(cache, config, now()).stato === 'non_verificabile' ? ERRORE_MS : CACHE_MS);
    } catch {
      cache = null;
      scade = now() + ERRORE_MS;
    } finally {
      clearTimeout(timer);
      verificatoIl = new Date(now()).toISOString();
    }
  }

  return {
    async getStato() {
      if (!config) return { stato: 'disabilitato', colore: null, rischi: [] };
      if (now() >= scade) {
        if (!inCorso) inCorso = aggiorna().finally(() => { inCorso = null; });
        await inCorso;
      }
      // Rivaluta sempre la validità, anche durante la cache e al cambio di giorno.
      return { ...interpretaAllerta(cache, config, now()), verificatoIl };
    },
  };
}

module.exports = { createAllerteMeteo, interpretaAllerta, parseDataRoma, URL_STATO_ALLERTA };
