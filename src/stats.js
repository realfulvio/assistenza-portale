// Statistiche aggregate per la barra «Live»: solo numeri, nessun dato personale.
// Legge GLPI con l'utente di servizio (stessa API REST e stesso token del portale), in sola lettura,
// con una cache in memoria (STATS_CACHE_SEC, predefinito 300 s) per non interrogare GLPI a ogni visita.
// Opzioni: blocco "barraLive" di config/ente.json (se presente); le variabili STATS_* del .env hanno la precedenza.
const config = require('./config');
const glpi = require('./glpi-client');

const b = (config.ente && config.ente.barraLive) || {};
const e = {
  STATS_BAR: process.env.STATS_BAR ?? (b.attiva === false ? '0' : '1'),
  STATS_PERIODO: process.env.STATS_PERIODO || b.periodo,
  STATS_DA_DATA: process.env.STATS_DA_DATA || b.daData,
  STATS_CACHE_SEC: process.env.STATS_CACHE_SEC || b.cacheSecondi,
  STATS_GIORNI: process.env.STATS_GIORNI || b.giorni
};
const PERIODI = ['giorni', 'anno', 'mese', 'da_data'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const GIORNO = 24 * 3600 * 1000;
const PAGINA = 1000; // righe per pagina nelle ricerche GLPI
const MAX_RIGHE = 50000; // limite di sicurezza

const opzioni = () => {
  const periodo = PERIODI.includes(e.STATS_PERIODO) ? e.STATS_PERIODO : 'giorni';
  const giorni = Number.isInteger(Number(e.STATS_GIORNI)) && Number(e.STATS_GIORNI) >= 1 ? Number(e.STATS_GIORNI) : 30;
  const daData = /^\d{4}-\d{2}-\d{2}$/.test(e.STATS_DA_DATA || '') ? e.STATS_DA_DATA : '';
  const sec = Number(e.STATS_CACHE_SEC);
  return {
    attiva: e.STATS_BAR !== '0',
    periodo: periodo === 'da_data' && !daData ? 'giorni' : periodo, // data mancante o non valida: ultimi N giorni
    daData,
    giorni,
    cacheMs: (Number.isFinite(sec) && sec >= 10 ? sec : 300) * 1000
  };
};

const due = (n) => String(n).padStart(2, '0');
const giorno = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
// Data/ora locale nel formato di GLPI (stesso fuso del server)
const glpiData = (d) => `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())} ${due(d.getHours())}:${due(d.getMinutes())}:${due(d.getSeconds())}`;
const leggiData = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(s || ''));
  return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : null;
};

function inizioPeriodo(o, ora) {
  if (o.periodo === 'giorni' || !o.periodo) {
    const n = o.giorni || 30;
    return { da: new Date(giorno(ora).getTime() - (n - 1) * GIORNO), etichetta: `negli ultimi ${n} giorni` };
  }
  if (o.periodo === 'mese') return { da: new Date(ora.getFullYear(), ora.getMonth(), 1), etichetta: 'a ' + MESI[ora.getMonth()] };
  if (o.periodo === 'da_data') {
    const [a, m, g] = o.daData.split('-').map(Number);
    return { da: new Date(a, m - 1, g), etichetta: `dal ${due(g)}/${due(m)}/${a}` };
  }
  return { da: new Date(ora.getFullYear(), 0, 1), etichetta: 'nel ' + ora.getFullYear() };
}

// --- Lettura da GLPI (API REST /search/Ticket). Campi: 12 stato, 15 data apertura, 17 data soluzione,
// 150 tempo di presa in carico (takeintoaccount_delay_stat). I ticket nel cestino sono esclusi da GLPI.
const q = (o) => new URLSearchParams(o).toString();
const cerca = (p) => glpi.call('GET', '/search/Ticket?' + q(p));

async function sorgenteGlpi(da) {
  const criteri = { 'criteria[0][field]': '15', 'criteria[0][searchtype]': 'morethan', 'criteria[0][value]': glpiData(new Date(da.getTime() - 1000)) };
  const campi = { 'forcedisplay[0]': '2', 'forcedisplay[1]': '12', 'forcedisplay[2]': '15', 'forcedisplay[3]': '150' };
  const righe = [];
  for (let i = 0; i < MAX_RIGHE; i += PAGINA) {
    const r = await cerca({ ...criteri, ...campi, sort: '2', order: 'ASC', range: `${i}-${i + PAGINA - 1}` });
    const dati = Array.isArray(r && r.data) ? r.data : [];
    for (const x of dati) righe.push({ data: x['15'], stato: x['12'], presa: x['150'] });
    if (dati.length < PAGINA || righe.length >= Number(r.totalcount || 0)) break;
  }
  // Carico attuale: stati 1-4 («notold» in GLPI), senza filtro periodo
  const aperti = await cerca({ 'criteria[0][field]': '12', 'criteria[0][searchtype]': 'equals', 'criteria[0][value]': 'notold', 'forcedisplay[0]': '2', range: '0-0' });
  // Ultima soluzione: ticket risolti o chiusi, ordinati per data di soluzione
  const ultima = await cerca({ 'criteria[0][field]': '12', 'criteria[0][searchtype]': 'equals', 'criteria[0][value]': 'old', 'forcedisplay[0]': '17', sort: '17', order: 'DESC', range: '0-0' });
  return {
    righe,
    inLavorazione: Number((aperti && aperti.totalcount) || 0),
    ultimaSoluzione: (ultima && Array.isArray(ultima.data) && ultima.data[0] && ultima.data[0]['17']) || null
  };
}

function calcola(o, s, ora) {
  const { da, etichetta } = inizioPeriodo(o, ora);
  const oggi = giorno(ora);
  const spark = new Array(7).fill(0);
  let ricevute = 0, risolte = 0, oggiRicevute = 0, oggiRisolte = 0, sommaPresa = 0, nPresa = 0;
  for (const r of s.righe) {
    const d = leggiData(r.data);
    if (!d) continue;
    const chiuso = [5, 6].includes(Number(r.stato));
    if (d >= da && d <= ora) {
      ricevute++;
      if (chiuso) risolte++;
      const p = Number(r.presa);
      if (Number.isFinite(p) && p > 0) { sommaPresa += p; nPresa++; }
    }
    const g = Math.round((oggi - giorno(d)) / GIORNO); // 0 = oggi, 6 = sei giorni fa
    if (g >= 0 && g < 7) spark[6 - g]++;
    if (g === 0) { oggiRicevute++; if (chiuso) oggiRisolte++; }
  }
  const ultima = leggiData(s.ultimaSoluzione);
  return {
    ok: true,
    periodo: { tipo: o.periodo, etichetta },
    ricevute,
    risolte,
    in_lavorazione: s.inLavorazione,
    presa_in_carico_media_sec: nPresa ? Math.round(sommaPresa / nPresa) : null,
    percentuale_risolte: ricevute ? Math.round((risolte / ricevute) * 100) : 0,
    sparkline: spark,
    oggi_ricevute: oggiRicevute,
    oggi_risolte: oggiRisolte,
    ultima_risolta_min: ultima ? Math.max(0, Math.floor((ora - ultima) / 60000)) : null,
    aggiornato_il: ora.toISOString()
  };
}

// --- Cache: un solo aggiornamento alla volta; in caso di errore si riprova dopo 60 s
let cache = null; // { dati, scade }
let inCorso = null;

async function aggiorna(o) {
  const ora = new Date();
  const { da } = inizioPeriodo(o, ora);
  const settimana = new Date(giorno(ora).getTime() - 6 * GIORNO);
  const daLeggere = da < settimana ? da : settimana;
  try {
    const s = await (glpi.statsSorgente || sorgenteGlpi)(daLeggere);
    cache = { dati: calcola(o, s, ora), scade: Date.now() + o.cacheMs };
  } catch (err) {
    console.log(new Date().toISOString(), 'statistiche non disponibili', err.message);
    cache = { dati: { ok: false }, scade: Date.now() + 60_000 };
  } finally {
    await glpi.killSession(); // sessione chiusa a ogni aggiornamento della cache
  }
  return cache;
}

// Ritorna { dati, daCache }
async function statistiche() {
  const o = opzioni();
  if (!o.attiva) return { dati: { ok: false }, daCache: false };
  if (cache && cache.scade > Date.now()) return { dati: cache.dati, daCache: true };
  if (!inCorso) inCorso = aggiorna(o).finally(() => { inCorso = null; });
  return { dati: (await inCorso).dati, daCache: false };
}

const svuotaCache = () => { cache = null; };

module.exports = { statistiche, svuotaCache, calcola, opzioni, inizioPeriodo };
