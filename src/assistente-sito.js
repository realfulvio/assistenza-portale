// Pagine del sito del Comune per l'assistente: indice preparato di notte da scripts/scarica-sito-comune.js
// (testo + vettori embeddinggemma). Qui solo lettura: instradamento con qwen, ricerca, orari e novità.
const fs = require('node:fs');

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const GIORNI = /\b(luned|marted|mercoled|gioved|venerd|sabato|domenica)/i;
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const parole = (t) => norm(t).match(/[a-z0-9]{4,}/g) || [];
const pulisci = (r) => String(r?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').split('<think>')[0].trim();
const dataIt = (iso) => { const d = new Date(iso); return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`; };
const coseno = (a, b) => { let s = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { s += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return s / Math.max(1e-12, Math.sqrt(x * y)); };

// Azioni che qwen può scegliere; le esegue il codice del portale.
const AZIONI = {
  guida_it: 'problema o domanda su PC, stampanti, programmi, posta, rete, password, telefoni del Comune (guide del CED)',
  rubrica: 'numero di telefono interno o cellulare di un collega (non chi è responsabile di un ufficio)',
  sito_comune: 'informazioni sull\'ente: uffici, orari, chi è responsabile, servizi ai cittadini, moduli, tributi, persone, luoghi',
  novita: 'ultime notizie o novità pubblicate sul sito del Comune',
  meteo: 'tempo atmosferico, previsioni, allerte meteo',
  ticket: 'aprire una richiesta di assistenza o chiedere lo stato di una richiesta già aperta',
  svago: 'barzellette, freddure, chiacchiere',
  web: 'qualunque altra informazione generale che si trova solo su internet',
};

const SISTEMA = (ente) => `Sei l'assistente del portale interno dei dipendenti di ${ente}.
Rispondi in italiano, tono informale (dai del tu), al massimo 60 parole.
Usa SOLO le informazioni delle pagine del sito dell'ente qui sotto. Non inventare orari, numeri, nomi, date o importi.
Se le pagine non contengono la risposta, dillo in una frase e suggerisci di guardare la pagina indicata o chiedere all'ufficio.
Non aggiungere avvisi sull'aggiornamento delle pagine. Non scrivere link: li mostra il portale.`;

function sezioneOrari(testo) {
  const righe = testo.split('\n'), i = righe.findIndex((r) => /orari/i.test(r));
  if (i < 0) return null;
  const out = [righe[i].replace(/^## /, '')];
  for (const r of righe.slice(i + 1)) {
    if ((r.startsWith('## ') && !/\(segue\)$/.test(r)) || out.length > 14) break;
    if (GIORNI.test(r) || /^- /.test(r) || /in vigore|orari/i.test(r)) out.push(r);
  }
  return out.length > 1 ? out : null;
}

function periodoScaduto(riga, oggi = new Date()) {
  const m = riga.match(/(?:da|dal)\s+\w+\s+(?:a|al)\s+(\w+)\s+(\d{4})/i) || riga.match(/(?:fino al|sino al)\s+\d{1,2}\s+(\w+)\s+(\d{4})/i);
  if (!m) return false;
  const mese = MESI.indexOf(m[1].toLowerCase());
  return mese >= 0 && new Date(+m[2], mese + 1, 1) < oggi;
}

function creaSito({ config, ai, embed, file = config.assistenteSitoFile }) {
  const MODELLO = config.assistenteModello || 'qwen3.5:4b-q4_K_M';
  const ENTE = config.ente?.ente?.nome || 'un ente pubblico';
  const nomeEnte = config.ente?.ente?.nome ? new RegExp(config.ente.ente.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig') : null;
  const senzaEnte = (t) => nomeEnte ? t.replace(nomeEnte, ' ') : t;
  let cache = { mtime: 0, dati: null, pezzi: [] };

  // Rilegge il file solo se il job notturno l'ha cambiato.
  function dati() {
    if (!file) return null;
    let st; try { st = fs.statSync(file); } catch { return null; }
    if (st.mtimeMs !== cache.mtime) {
      try {
        const d = JSON.parse(fs.readFileSync(file, 'utf8'));
        const pezzi = d.pagine.flatMap((p) => p.pezzi.filter((z) => Array.isArray(z.vettore)).map((z) => ({ ...z, url: p.url, titolo: p.titolo, tipo: p.tipo, lastmod: p.lastmod })));
        cache = { mtime: st.mtimeMs, dati: d, pezzi };
      } catch { return cache.dati; }
    }
    return cache.dati;
  }
  const attivo = () => !!dati() && cache.pezzi.length > 0;

  async function instrada(domanda, signal) {
    const sistema = `Classifica la domanda di un dipendente di ${ENTE}. Scegli UNA azione:\n` +
      Object.entries(AZIONI).map(([k, v]) => `- ${k}: ${v}`).join('\n') +
      '\nIn "ricerca" scrivi solo le parole chiave essenziali della domanda, senza il nome dell\'ente.';
    const r = await ai('/api/chat', { model: MODELLO, stream: false, think: false, keep_alive: config.assistenteKeepAlive ?? '5m',
      format: { type: 'object', properties: { azione: { type: 'string', enum: Object.keys(AZIONI) }, ricerca: { type: 'string' } }, required: ['azione', 'ricerca'] },
      messages: [{ role: 'system', content: sistema }, { role: 'user', content: domanda.slice(0, 600) }],
      options: { temperature: 0, num_ctx: 1024, num_predict: 60, num_thread: 4 } }, signal);
    try {
      const j = JSON.parse(pulisci(r));
      return AZIONI[j.azione] ? { azione: j.azione, ricerca: String(j.ricerca || '').slice(0, 200) } : null;
    } catch { return null; }
  }

  async function cerca(testo, filtro = () => true) {
    const [q] = await embed([testo]);
    if (cache.pezzi[0] && cache.pezzi[0].vettore.length !== q.length) return [];
    const qp = new Set(parole(testo)), tre = Date.now() - 3 * 365 * 864e5;
    return cache.pezzi.filter(filtro).map((z) => {
      const p = new Set(parole(z.titolo + ' ' + z.testo));
      const vecchia = z.tipo === 'notizia' && z.lastmod && Date.parse(z.lastmod) < tre ? .06 : 0;
      return { z, s: coseno(q, z.vettore) + .15 * [...qp].filter((x) => p.has(x)).length / Math.max(1, qp.size) - vecchia };
    }).sort((a, b) => b.s - a.s);
  }

  const fonte = (z) => ({ titolo: z.titolo, url: z.url, dominio: 'Sito del Comune' });
  const AVVISO = 'Dalle pagine del sito del Comune: controlla sempre la pagina indicata, alcune informazioni potrebbero essere cambiate.';

  async function rispondi(domanda, ricerca = '', signal) {
    if (!attivo()) return null;
    const testoRicerca = `${domanda} ${senzaEnte(ricerca)}`.trim();
    // Orari: copiati dalla sola pagina più pertinente, mai riformulati dal modello.
    if (/\b(orari\w*|aperto|aperta|apertura|ricevimento|chiuso|chiusa)\b/i.test(domanda)) {
      const [primo] = await cerca(testoRicerca, (z) => ['unita_organizzativa', 'luogo'].includes(z.tipo));
      if (primo) {
        const testo = cache.pezzi.filter((x) => x.url === primo.z.url).map((x) => x.testo.split('\n').slice(1).join('\n')).join('\n');
        const o = sezioneOrari(testo);
        if (o) {
          const avviso = o.some((r) => periodoScaduto(r)) ? '\n\nAttenzione: sul sito questo orario è riferito a un periodo già concluso, meglio chiamare l’ufficio per conferma.' : '';
          return { tipo: 'chat', sito: true, risposta: `${primo.z.titolo}, dal sito del Comune:\n${o.join('\n')}${avviso}`, fonti: [fonte(primo.z)], avvisoWeb: AVVISO };
        }
      }
    }
    const g = await cerca(testoRicerca);
    if (!g.length || g[0].s < .6) return null;
    const scelti = [], perPagina = {};
    for (const x of g) { if ((perPagina[x.z.url] = (perPagina[x.z.url] || 0) + 1) <= 2) scelti.push(x); if (scelti.length === 4) break; }
    const pagine = scelti.map(({ z }, i) => `[${i + 1}] ${z.titolo}\n${z.testo}`).join('\n\n');
    const r = await ai('/api/chat', { model: MODELLO, stream: false, think: false, keep_alive: config.assistenteKeepAlive ?? '5m',
      messages: [{ role: 'system', content: SISTEMA(ENTE) }, { role: 'user', content: `Pagine del sito del Comune:\n${pagine}\n\nDomanda: ${domanda}` }],
      options: { temperature: .1, num_ctx: 4096, num_predict: 200, num_thread: 4 } }, signal);
    const testo = pulisci(r).replace(/https?:\/\/\S+/g, '').replace(/\[\d\]/g, '').trim();
    if (!testo) return null;
    return { tipo: 'chat', sito: true, risposta: testo.slice(0, 1200), fonti: [...new Map(scelti.map(({ z }) => [z.url, fonte(z)])).values()].slice(0, 3), avvisoWeb: AVVISO };
  }

  // Schede «persona_pubblica» del sito: incarico, ufficio e contatti copiati dalla pagina, mai riformulati dal modello.
  function schedaPersona(p) {
    const t = p.pezzi.map((z) => z.testo).join('\n').split('\n').map((r) => r.trim());
    const dopo = (titolo) => { const i = t.indexOf(titolo); return i < 0 ? '' : t.slice(i + 1).find((r) => r && !r.startsWith('##')) || ''; };
    const telefono = (t.find((r) => /^Telefono:/i.test(r)) || '').replace(/^Telefono:\s*/i, '');
    const iEmail = t.findIndex((r) => /^Email:/i.test(r));
    const email = iEmail < 0 ? '' : t[iEmail].replace(/^Email:\s*/i, '') || t[iEmail + 1] || '';
    return { nome: p.titolo, incarico: dopo('## Incarico'), ufficio: dopo('## Organizzazione'), telefono, email, url: p.url };
  }

  // Persone nominate nella domanda: prima nome e cognome completi; con «parziale» basta il solo nome o cognome.
  function persone(domanda, { parziale = false } = {}) {
    const d = dati();
    if (!d) return [];
    const q = new Set(norm(domanda).match(/[a-z]{3,}/g) || []);
    const lista = d.pagine.filter((p) => p.tipo === 'persona_pubblica').map((p) => ({ p, w: norm(p.titolo).match(/[a-z]{3,}/g) || [] })).filter(({ w }) => w.length);
    let trovate = lista.filter(({ w }) => w.length >= 2 && w.every((x) => q.has(x)));
    if (!trovate.length && parziale) trovate = lista.filter(({ w }) => w.some((x) => x.length >= 4 && q.has(x)));
    return trovate.slice(0, 5).map(({ p }) => schedaPersona(p));
  }

  function rispondiPersona(domanda, opzioni) {
    const lista = persone(domanda, opzioni);
    if (!lista.length) return null;
    const lettere = (s) => norm(s).replace(/[^a-z]/g, '');
    const righe = lista.map((x) => [x.nome, x.incarico && `Incarico: ${x.incarico}`, x.ufficio && !lettere(x.incarico).includes(lettere(x.ufficio)) && `Ufficio: ${x.ufficio}`,
      x.telefono && `Telefono: ${x.telefono}`, x.email && `Email: ${x.email}`].filter(Boolean).join('\n'));
    return { tipo: 'chat', sito: true, persone: lista.map((x) => x.nome),
      risposta: `${lista.length === 1 ? 'Dal sito del Comune' : 'Sul sito del Comune ho trovato queste persone'}:\n${righe.join('\n\n')}`,
      fonti: lista.slice(0, 3).map((x) => ({ titolo: x.nome, url: x.url, dominio: 'Sito del Comune' })), avvisoWeb: AVVISO };
  }

  function novita(n = 5) {
    const d = dati();
    if (!d) return null;
    const lista = d.pagine.filter((p) => p.tipo === 'notizia').sort((a, b) => b.lastmod.localeCompare(a.lastmod)).slice(0, n);
    if (!lista.length) return null;
    return { tipo: 'chat', sito: true, risposta: 'Ultime notizie pubblicate sul sito del Comune:\n' + lista.map((p) => `- ${dataIt(p.lastmod)}: ${p.titolo}`).join('\n'),
      fonti: lista.slice(0, 3).map((p) => ({ titolo: p.titolo, url: p.url, dominio: 'Sito del Comune' })), avvisoWeb: AVVISO };
  }

  return { attivo, instrada, rispondi, novita, persone, rispondiPersona };
}

module.exports = { creaSito, sezioneOrari, periodoScaduto, AZIONI };
