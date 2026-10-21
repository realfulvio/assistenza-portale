// Logica della pagina Guide (formato dati, ricerca, filtri, link diretti). Nessun accesso al DOM:
// la usano sia il browser (window.FaqLogica) sia i test (require).
(function (radice, fabbrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabbrica();
  else radice.FaqLogica = fabbrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Etichette dei filtri; una categoria non elencata qui compare con il suo id (prima lettera maiuscola)
  const ETICHETTE = {
    computer: 'Computer', stampanti: 'Stampanti', posta: 'Posta', rete: 'Rete', accessi: 'Password e accessi',
    sicurezza: 'Sicurezza', portale: 'Portale assistenza', gestionali: 'Programmi del Comune', documenti: 'File e documenti', istanze: 'Istanze online', pubblicazioni: 'Sito e trasparenza', altro: 'Altro'
  };
  const IMG_OK = /^img\/faq\/[A-Za-z0-9._-]+\.(webp|png|jpe?g)$/;
  const ID_OK = /^[a-z0-9-]{1,60}$/;

  const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const slug = (t) => norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'guida';
  const testi = (a) => (Array.isArray(a) ? a : []).map((x) => String(x ?? '').trim()).filter(Boolean);

  function passo(p) {
    const o = typeof p === 'string' ? { t: p } : p && typeof p === 'object' ? p : {};
    const t = String(o.t ?? '').trim();
    if (!t) return null;
    const r = { t, nota: String(o.nota ?? '').trim(), img: '', alt: '', w: 0, h: 0 };
    if (typeof o.img === 'string' && IMG_OK.test(o.img)) {
      r.img = o.img; r.alt = String(o.alt ?? '').trim();
      r.w = Number.isInteger(o.w) && o.w > 0 ? o.w : 0; r.h = Number.isInteger(o.h) && o.h > 0 ? o.h : 0;
    }
    return r;
  }

  // Accetta sia il formato vecchio { d, r } sia quello esteso (id, cat, intro, controlli, passi, ok, stop, richiesta, vedi, parole)
  function normalizza(elenco) {
    const usati = new Set();
    const out = [];
    for (const v of Array.isArray(elenco) ? elenco : []) {
      if (!v || typeof v !== 'object') continue;
      const d = String(v.d ?? '').trim();
      if (!d) continue;
      let id = typeof v.id === 'string' && ID_OK.test(v.id) ? v.id : slug(d);
      for (let n = 2; usati.has(id); n++) id = slug(d).slice(0, 56) + '-' + n;
      usati.add(id);
      const g = {
        id, d, cat: ID_OK.test(String(v.cat ?? '')) ? v.cat : 'altro',
        intro: String(v.intro ?? '').trim(), controlli: testi(v.controlli),
        passi: (Array.isArray(v.passi) ? v.passi : []).map(passo).filter(Boolean),
        ok: String(v.ok ?? '').trim(), stop: String(v.stop ?? '').trim(), richiesta: String(v.richiesta ?? '').trim(),
        vedi: testi(v.vedi).filter((x) => ID_OK.test(x)), parole: testi(v.parole), r: String(v.r ?? '').trim()
      };
      g.ricerca = norm([g.d, g.intro, g.controlli.join(' '), g.passi.map((p) => p.t + ' ' + p.nota).join(' '), g.ok, g.stop, g.richiesta, g.r, g.parole.join(' ')].join(' '));
      g.titoloNorm = norm(g.d);
      out.push(g);
    }
    return out;
  }

  // Categorie presenti, nell'ordine di prima comparsa, con il numero di guide
  function categorie(voci) {
    const m = new Map();
    for (const v of voci) m.set(v.cat, (m.get(v.cat) || 0) + 1);
    return [...m].map(([id, n]) => ({ id, n, nome: ETICHETTE[id] || id.charAt(0).toUpperCase() + id.slice(1) }));
  }

  // Ricerca: ogni parola digitata deve comparire (anche in parte) nel titolo, nel testo o nelle parole chiave.
  // Senza testo restano tutte, nell'ordine originale; con il testo prima quelle che lo hanno nel titolo.
  function filtra(voci, q, cat) {
    const parole = norm(q).split(/\s+/).filter(Boolean);
    const quelle = voci.filter((v) => (!cat || cat === 'tutte' || v.cat === cat) && parole.every((p) => v.ricerca.includes(p)));
    if (!parole.length) return quelle;
    const punti = (v) => parole.filter((p) => v.titoloNorm.includes(p)).length;
    return quelle.map((v, i) => ({ v, i, p: punti(v) })).sort((a, b) => b.p - a.p || a.i - b.i).map((x) => x.v);
  }

  // "#faq/stampante-offline" -> "stampante-offline"; "#faq" o altro -> null
  function idDaHash(hash) {
    const m = /^#?faq\/([A-Za-z0-9-]{1,60})\/?$/.exec(String(hash || ''));
    return m ? m[1].toLowerCase() : null;
  }

  return { norm, slug, normalizza, categorie, filtra, idDaHash, ETICHETTE };
});
