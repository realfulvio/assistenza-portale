#!/usr/bin/env node
// Scarica le pagine utili del sito del Comune (sitemap WordPress) e le salva come testo
// a pezzi per l'indice dell'assistente. Leggero: una richiesta al secondo, riscarica solo
// le pagine con lastmod cambiato. Uso: node scripts/scarica-sito-comune.js [--uscita file] [--max N]
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Ente: nome e sito da config/ente.json (o dall'esempio); SITO_COMUNE_URL ha la precedenza.
const ENTE = (() => { for (const f of ['ente.json', 'ente.example.json']) { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', f), 'utf8')).ente || {}; } catch { /* prossimo */ } } return {}; })();
const SITO = String(process.env.SITO_COMUNE_URL || ENTE.sito || '').replace(/\/$/, '');
const NOME_ENTE = String(ENTE.nome || '').trim();
const UA = 'PortaleAssistenza/1.0 (Sistemi Informativi; indice interno)';
const PAUSA_MS = Number(process.env.SITO_COMUNE_PAUSA_MS || 1000);
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const USCITA = arg('--uscita', process.env.SITO_COMUNE_FILE || '/var/lib/portale-assistenza/assistente/sito-comune.json');
const MAX = Number(arg('--max', 0)) || Infinity;
const AI_URL = (process.env.ASSISTENTE_AI_URL || 'http://127.0.0.1:11435').replace(/\/$/, '');
const MODELLO_EMB = process.env.ASSISTENTE_EMBEDDING || 'embeddinggemma-2:270m';

// Tipi della sitemap da indicizzare e quante voci tenere (le più recenti per lastmod).
const TIPI = {
  page: { etichetta: 'Pagina', max: 200 },
  servizio: { etichetta: 'Servizio', max: 200 },
  unita_organizzativa: { etichetta: 'Ufficio', max: 200 },
  luogo: { etichetta: 'Luogo', max: 100 },
  persona_pubblica: { etichetta: 'Persona', max: 200 },
  documento_pubblico: { etichetta: 'Modulistica e documenti', max: 400 },
  notizia: { etichetta: 'Notizia', max: 120, giorni: 365 },
  evento: { etichetta: 'Evento', max: 60, giorni: 120 },
  sito_tematico: { etichetta: 'Sito tematico', max: 30 },
};
// Pagine senza contenuto utile per i dipendenti.
const ESCLUDI = /\/(privacy|cookie|note-legali|dichiarazione-di-accessibilita|mappa-del-sito|leggi-le-faq|statistiche)/i;

const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

async function scarica(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xml' }, signal: AbortSignal.timeout(30_000), redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.text();
}

const entita = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', egrave: 'è', eacute: 'é', agrave: 'à', igrave: 'ì', ograve: 'ò', ugrave: 'ù', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…', euro: '€', deg: '°' };
function decodifica(s) {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => entita[n.toLowerCase()] ?? m);
}

// Testo leggibile della parte <main>, con a capo su titoli, paragrafi e voci di elenco.
function estrai(html) {
  let t = html.match(/<main[\s\S]*?<\/main>/i)?.[0] || '';
  const og = html.match(/<meta property="og:title" content="([^"]*)"/i)?.[1];
  const titolo = decodifica((t.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || og || html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').replace(NOME_ENTE ? new RegExp(`\\s*[-–|]\\s*${NOME_ENTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') : /$^/, '').trim();
  t = t.replace(/<(script|style|svg|nav|form|button|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(h[1-6])[^>]*>/gi, '\n## ').replace(/<\/(h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ').replace(/<(br|\/p|\/div|\/li|\/tr|\/section|\/article)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  t = decodifica(t).replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
  // Via i pezzi ripetuti del tema (condivisione, valutazione pagina, indice).
  t = t.split('\n').filter((r) => !/^(Condividi|Facebook|Twitter|Linkedin|Whatsapp|Vedi azioni|Stampa|Ascolta|Invia|Indice della pagina|Quanto sono chiare le informazioni.*|Valuta da 1 a 5 stelle.*|Avanti|Indietro|Leggi di più|Vai alla pagina|Mostra tutto|-)$/i.test(r.trim()))
    .join('\n').replace(/^## \s*$/gm, '').replace(/\n{2,}/g, '\n').trim();
  const fine = t.search(/\n## (Contatta il comune|Quanto sono chiare|Valuta da 1 a 5|Hai trovato utile)/i);
  return { titolo, testo: fine > 0 ? t.slice(0, fine) : t };
}

// Pezzi da ~1100 caratteri tagliati sui titoli o sulle righe, ognuno con il titolo della pagina davanti.
function aPezzi(titolo, etichetta, testo, dim = 1100) {
  const righe = testo.split('\n'), pezzi = [];
  let cur = '', sezione = '';
  const chiudi = () => { if (cur.trim().length > 60) pezzi.push(cur.trim()); cur = ''; };
  for (const r of righe) {
    if (r.startsWith('## ')) { if (cur.length > dim * .6) chiudi(); sezione = r.slice(3); }
    if (cur.length + r.length > dim) { chiudi(); if (sezione && !r.startsWith('## ')) cur = `## ${sezione} (segue)\n`; }
    cur += r.slice(0, dim) + '\n';
  }
  chiudi();
  return pezzi.slice(0, 12).map((p) => `${etichetta}: ${titolo}\n${p}`);
}

async function leggiSitemap() {
  const indice = await scarica(`${SITO}/wp-sitemap.xml`);
  const mappe = [...indice.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => /wp-sitemap-posts-/.test(u));
  const voci = [];
  for (const m of mappe) {
    const tipo = m.match(/wp-sitemap-posts-(.+?)-\d+\.xml/)?.[1];
    if (!TIPI[tipo]) continue;
    await dorme(PAUSA_MS);
    const xml = await scarica(m);
    const ora = Date.now();
    const lista = [...xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)]
      .map(([, url, lastmod]) => ({ url, lastmod: lastmod || '', tipo }))
      .filter((v) => !ESCLUDI.test(v.url))
      .filter((v) => !TIPI[tipo].giorni || (v.lastmod && ora - Date.parse(v.lastmod) < TIPI[tipo].giorni * 864e5))
      .sort((a, b) => b.lastmod.localeCompare(a.lastmod))
      .slice(0, TIPI[tipo].max);
    voci.push(...lista);
  }
  return voci;
}

async function main() {
  if (!/^https?:\/\//.test(SITO)) throw new Error("Sito dell'ente mancante: imposta ente.sito in config/ente.json o SITO_COMUNE_URL.");
  let vecchio = { pagine: [] };
  try { vecchio = JSON.parse(fs.readFileSync(USCITA, 'utf8')); } catch { /* primo giro */ }
  const cache = new Map(vecchio.pagine.map((p) => [p.url, p]));
  const voci = (await leggiSitemap()).slice(0, MAX);
  const pagine = [];
  let scaricate = 0, errori = 0;
  for (const v of voci) {
    const prima = cache.get(v.url);
    if (prima && prima.lastmod === v.lastmod) { pagine.push(prima); continue; }
    await dorme(PAUSA_MS);
    try {
      const { titolo, testo } = estrai(await scarica(v.url));
      scaricate++;
      if (testo.length < 80) continue;
      const etichetta = TIPI[v.tipo].etichetta;
      pagine.push({ url: v.url, tipo: v.tipo, lastmod: v.lastmod, titolo, pezzi: aPezzi(titolo, etichetta, testo).map((t, i) => ({ id: `sito-${hash(v.url)}-${i}`, testo: t })) });
    } catch (e) {
      errori++;
      if (prima) pagine.push(prima); // tengo la versione precedente
      console.error('Errore', v.url, e.message);
    }
  }
  // Vettori con embeddinggemma: riuso quelli dei pezzi con lo stesso testo, calcolo solo i nuovi.
  const riuso = new Map(vecchio.modello === MODELLO_EMB ? vecchio.pagine.flatMap((p) => p.pezzi).filter((z) => z.vettore).map((z) => [hash(z.testo), z.vettore]) : []);
  const mancanti = [];
  for (const p of pagine) for (const z of p.pezzi) { z.vettore = riuso.get(hash(z.testo)); if (!z.vettore) mancanti.push(z); }
  let calcolati = 0;
  try {
    for (let i = 0; i < mancanti.length; i += 8) {
      const gruppo = mancanti.slice(i, i + 8);
      const r = await fetch(AI_URL + '/api/embed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(300_000),
        body: JSON.stringify({ model: MODELLO_EMB, input: gruppo.map((z) => z.testo), truncate: true, keep_alive: '1m', options: { num_thread: 2, num_ctx: 2048 } }) });
      if (!r.ok) throw new Error(`embed HTTP ${r.status}`);
      const { embeddings } = await r.json();
      gruppo.forEach((z, n) => { z.vettore = embeddings[n]; });
      calcolati += gruppo.length;
    }
  } catch (e) { errori++; console.error('Vettori non completati:', e.message); }
  const dati = { sito: SITO, generato: new Date().toISOString(), modello: MODELLO_EMB, pagine };
  fs.mkdirSync(path.dirname(USCITA), { recursive: true, mode: 0o700 });
  const tmp = USCITA + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(dati), { mode: 0o600 });
  fs.renameSync(tmp, USCITA);
  console.log(`${new Date().toISOString()} Sito del Comune: ${pagine.length} pagine (${pagine.reduce((n, p) => n + p.pezzi.length, 0)} pezzi), scaricate ${scaricate}, vettori nuovi ${calcolati}, errori ${errori}.`);
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { estrai, aPezzi };
