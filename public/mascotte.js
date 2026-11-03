// Assistente animato in basso a destra: un impiegato un po' stanco che apre un fumetto con le domande frequenti,
// ricerca su guide e contatti e chat locale dopo l'accesso. Costruisce solo il proprio markup:
// non legge e non modifica mai i campi del modulo ticket e non invia richieste a GLPI.
// La logica di ricerca non tocca il DOM: la usano il browser (window.Mascotte) e i test (require).
(function (radice, fabbrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabbrica(require('./faq.js'), require('./numeri-interni.js'));
  else radice.Mascotte = fabbrica(radice.FaqLogica, radice.NumeriInterni);
})(typeof self !== 'undefined' ? self : this, function (Faq, Numeri) {
  'use strict';

  const MIN_CARATTERI = 2, MAX_GUIDE = 4, MAX_NUMERI = 6, N_FREQUENTI = 5;

  // Una sola ricerca per guide e numeri interni. Meno di due caratteri: nessun risultato (si mostrano le domande frequenti).
  function cerca(guide, sezioni, testo) {
    const q = String(testo ?? '').trim();
    if (q.length < MIN_CARATTERI) return { attiva: false, guide: [], numeri: [], nGuide: 0, nNumeri: 0 };
    const g = Faq && guide ? Faq.filtra(guide, q, 'tutte') : [];
    const voci = Numeri && sezioni ? Numeri.filtra(sezioni, q, 'tutte').flatMap((s) => s.voci.map((v) => ({ ...v, sezione: s.titolo }))) : [];
    return { attiva: true, guide: g.slice(0, MAX_GUIDE), numeri: voci.slice(0, MAX_NUMERI), nGuide: g.length, nNumeri: voci.length };
  }

  // Le prime guide dell'elenco (l'ordine di content/faq.json decide quali sono «le più frequenti»)
  const frequenti = (guide, n = N_FREQUENTI) => (Array.isArray(guide) ? guide.slice(0, n) : []);

  const SALUTI = [
    'Eh… dimmi pure. Ho giusto cinque minuti prima della pausa.',
    'Ufficio informazioni. Cerchi una guida o un numero interno?',
    'Dimmi, dimmi. Il caffè può aspettare… forse.',
    'Sì, sono qui. Non mi alzo, ma ti aiuto lo stesso.',
    'Eccomi. Prima di aprire una richiesta dai un’occhiata qui: magari ti risparmio la fila.'
  ];
  const saluto = (n) => SALUTI[((Number(n) || 0) % SALUTI.length + SALUTI.length) % SALUTI.length];

  const telefono = (numero) => 'tel:' + String(numero).replace(/[^\d+]/g, '');

  function scegliBattuta(frasi,ultima,casuale=Math.random) {
    const candidati=frasi.length>1?frasi.filter(f=>f!==ultima):frasi;
    return candidati[Math.floor(casuale()*candidati.length)]||'';
  }
  const api = { cerca, frequenti, saluto, telefono, scegliBattuta, SALUTI, MIN_CARATTERI, MAX_GUIDE, MAX_NUMERI };
  if (typeof document === 'undefined') return api;

  // ---------------------------------------------------------------- disegno
  const COSTUMI = {
    halloween: '<g class="msc-c msc-c-halloween"><ellipse class="msc-tesastrega" cx="60" cy="27" rx="38" ry="7"/><path class="msc-cappellostrega" d="M43 27Q52 14 61 3Q63 1 69 5Q66 14 77 27Q60 33 43 27z"/><path class="msc-nastrostrega" d="M45 23q15 6 30 0l1.500 4.500q-16.500 6-33 0z"/><rect class="msc-fibbia" x="55" y="22" width="10" height="8" rx="1.500"/></g>',
    giardino: '<g class="msc-c msc-c-giardino"><ellipse class="msc-paglia2" cx="60" cy="26" rx="36" ry="7"/><path class="msc-paglia" d="M42 26q0 -14 18 -14t18 14q-18 5 -36 0z"/><path class="msc-nastro" d="M42.5 22q17.500 6 35 0l.8 4q-18 6 -36.600 0z"/><g class="msc-germoglio"><path class="msc-stelo" d="M60 12V6"/><path class="msc-foglia1" d="M60 8q-10 0 -12 -8q10 0 12 8z"/><path class="msc-foglia2" d="M60 7q10 -1 12 -8q-10 1 -12 8z"/></g></g>',
    autunno: '<g class="msc-c msc-c-autunno"><path class="msc-sciarpa" d="M40 80q20 9 40 0l2 8q-22 10 -44 0z"/><path class="msc-sciarpa" d="M46 88l-3 17 9 -2 1 -14z"/></g>',
    dark: '<g class="msc-c msc-c-dark"><path class="msc-berretto" d="M33 30q0 -24 27 -24q22 0 28 22q-22 -6 -30 4z"/><rect class="msc-orlo" x="29" y="24" width="62" height="9" rx="4.5"/><g class="msc-pompon"><path class="msc-codaberretto" d="M80 12q16 2 18 22"/><circle class="msc-acc" cx="98" cy="36" r="5"/></g></g>',
    mountain: '<g class="msc-c msc-c-mountain"><ellipse class="msc-tesa" cx="60" cy="26" rx="37" ry="7"/><path class="msc-cappello" d="M38 26q2 -20 22 -20t22 20q-22 7 -44 0z"/><path class="msc-fascia" d="M39 22q21 7 42 0l1 5q-22 7 -44 0z"/><g class="msc-piuma"><path d="M78 18q14 -4 20 -18q-14 4 -20 18z"/></g></g>'
  };
  const FUORI = {
    halloween: '<g class="msc-c msc-c-halloween msc-stelle"><g transform="translate(96 22)"><path class="msc-pipi s1" d="M0 0q2.500-4 6-2q2-3 4 0q2-3 4 0q3.500-2 6 2q-3.500 0-5 3.500q-2-2.500-4-1.500l-1.500 3-1.500-3q-2-1-4 1.500q-1.500-3.500-5-3.500z"/></g><g transform="translate(8 32) scale(.8)"><path class="msc-pipi s2" d="M0 0q2.500-4 6-2q2-3 4 0q2-3 4 0q3.500-2 6 2q-3.500 0-5 3.500q-2-2.500-4-1.500l-1.500 3-1.500-3q-2-1-4 1.500q-1.500-3.500-5-3.500z"/></g></g>',
    autunno: '<g class="msc-c msc-c-autunno"><g class="msc-cade"><path class="msc-fogliaa" d="M0 -7q8 -3 11 3q-4 9 -11 4q-8 -1 0 -7z"/></g></g>',
    dark: '<g class="msc-c msc-c-dark"><path class="msc-luna" d="M16 14A11 11 0 1 0 16 36A16 16 0 0 1 16 14z"/></g>'
  };
  const OCCHIO = [49, 71].map((x) =>
    `<ellipse class="msc-bianco" cx="${x}" cy="47" rx="7" ry="5.500"/><circle class="msc-pupilla" cx="${x}" cy="49.500" r="2.600"/>` +
    `<g class="msc-palpebra"><path class="msc-palp" d="M${x - 7} 47.500a7 5.800 0 0 1 14 0z"/><path class="msc-palp-linea" d="M${x - 7.500} 47.500h15"/></g>` +
    `<ellipse class="msc-chiude msc-pal" cx="${x}" cy="47" rx="7.600" ry="6.200"/><ellipse class="msc-chiude msc-pal2" cx="${x}" cy="47" rx="7.600" ry="6.200"/>` +
    `<path class="msc-borsa" d="M${x - 6} 55q6 3 12 0"/>`).join('');

  const SVG = '<svg class="msc-svg" viewBox="4 0 112 118" aria-hidden="true" focusable="false">' +
    '<defs><clipPath id="msc-clip"><circle cx="60" cy="64" r="55"/></clipPath></defs>' +
    '<circle class="msc-disco" cx="60" cy="64" r="55"/>' +
    '<g clip-path="url(#msc-clip)">' +
    '<g class="msc-busto"><path class="msc-camicia" d="M18 114q0 -28 26 -32l16 9l16 -9q26 4 26 32z"/><path class="msc-colletto" d="M44 82l16 9l-9 6z"/><path class="msc-colletto" d="M76 82l-16 9l9 6z"/>' +
    '<g transform="rotate(7 60 92)"><path class="msc-cravatta" d="M56 91l4 -3l4 3l-1.500 5l3.500 17h-12l3.500 -17z"/></g>' + COSTUMI.autunno + '</g>' +
    '<g class="msc-tazza"><path class="msc-vapore v1" d="M82 80q-4 -5 0 -9q4 -4 0 -9"/><path class="msc-vapore v2" d="M89 82q-4 -5 0 -9q4 -4 0 -9"/>' +
    '<rect class="msc-mug" x="76" y="84" width="18" height="18" rx="4"/><path class="msc-manico" d="M94 88h3a4.500 4.500 0 0 1 0 9h-3"/><circle class="msc-pelle" cx="74" cy="102" r="6"/></g>' +
    '</g>' +
    '<g class="msc-testa"><rect class="msc-pelle msc-collo" x="52" y="66" width="16" height="18"/>' +
    '<circle class="msc-pelle" cx="33" cy="50" r="5"/><circle class="msc-pelle" cx="87" cy="50" r="5"/><circle class="msc-pelle msc-faccia" cx="60" cy="46" r="27"/>' +
    '<path class="msc-capelli" d="M35 42q-3 -24 25 -24q28 0 25 24q-5 -12 -25 -13q-20 1 -25 13z"/><path class="msc-ciuffo" d="M44 29q16 -7 34 -1M48 25q12 -4 24 0"/>' +
    OCCHIO +
    '<g class="msc-occhiali"><rect x="39.500" y="38" width="19" height="17" rx="5.500"/><rect x="61.500" y="38" width="19" height="17" rx="5.500"/><path d="M58.500 45h3"/></g>' +
    '<path class="msc-sopracciglia" d="M42 38l14 1.500M64 39.500l14 -1.500"/><path class="msc-naso" d="M60 49q-3 8 1.500 9.500"/>' +
    '<path class="msc-baffi" d="M49 62q11 -5 22 0q-4 5 -11 2q-7 3 -11 -2z"/><path class="msc-bocca" d="M53 70q7 -3 14 0"/>' +
    COSTUMI.halloween + COSTUMI.giardino + COSTUMI.dark + COSTUMI.mountain + '</g>' +
    FUORI.halloween + FUORI.autunno + FUORI.dark +
    '<g class="msc-zzz"><path d="M88 34h9l-9 11h9"/><path d="M101 17h7l-7 8h7"/></g>' +
    '</svg>';

  // ---------------------------------------------------------------- pagina
  const CHIAVE = 'portale.assistente';
  const BASE = (document.querySelector('meta[name=base]') || {}).content || '';
  const NS = 'http://www.w3.org/2000/svg';
  const h = (tag, props = {}, ...figli) => {
    const e = Object.assign(document.createElement(tag), props);
    for (const f of figli) if (f != null) e.append(f);
    return e;
  };
  const icona = (d) => {
    const s = document.createElementNS(NS, 'svg');
    for (const [k, v] of Object.entries({ width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' })) s.setAttribute(k, v);
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); s.append(p);
    return s;
  };
  const leggi = () => { try { return localStorage.getItem(CHIAVE) === 'nascosta'; } catch { return false; } };
  const scrivi = (nascosta) => { try { if (nascosta) localStorage.setItem(CHIAVE, 'nascosta'); else localStorage.removeItem(CHIAVE); } catch { /* memoria del browser non disponibile */ } };

  function avvia() {
    const stato = { aperta: false, accesso: null, errore: false,
      csrf: '', utente: '', messaggi: [], ultima: null, testo: '', attesa: false, erroreChat: '', modo:'chat', testoRiassunto:'', risultatoRiassunto:'', attesaRiassunto:false, erroreRiassunto:'', controllerRiassunto:null };
    const BATTUTE = ['non si può fare', 'Chiedimi una barzelletta o una freddura', 'non subito', '...e non gratis', 'cinque minuti e arrivo', 'caffè?', 'hai aperto il ticket?'];
    let nota = null, timerNota = null, timerBattuta = null, ultimaBattuta = null;
    let notaMeteo = null, timerMeteo = null, timerChiudiMeteo = null, ultimoInput = 0, meteoInCorso = false;
    let meteoIniziale = true;
    const CHIAVE_METEO = 'portale.assistente.meteo';
    const leggiMeteo = (k) => { try { return localStorage.getItem(CHIAVE_METEO + k); } catch { return null; } };
    const salvaMeteo = (k, v) => { try { localStorage.setItem(CHIAVE_METEO + k, v); } catch { /* archivio non disponibile */ } };

    const radiceEl = h('div', { className: 'mascotte', id: 'mascotte' });
    radiceEl.dataset.aperta = 'false';
    const bottone = h('button', { type: 'button', className: 'msc-btn', id: 'mascotte-btn', title: 'Chiedi all’assistente' });
    bottone.setAttribute('aria-expanded', 'false');
    bottone.setAttribute('aria-controls', 'mascotte-fumetto');
    bottone.setAttribute('aria-label', 'Assistente del portale: domande frequenti, guide e numeri interni');
    bottone.innerHTML = SVG; // markup statico, nessun dato dell'utente

    const fumetto = h('section', { className: 'msc-fumetto', id: 'mascotte-fumetto', tabIndex: -1, hidden: true });
    fumetto.setAttribute('role', 'dialog');
    fumetto.setAttribute('aria-labelledby', 'msc-titolo');
    const chiudi = h('button', { type: 'button', className: 'msc-x', id: 'msc-chiudi' }, icona('M6 6l12 12M18 6L6 18'));
    chiudi.setAttribute('aria-label', 'Chiudi l’assistente');
    const titolo = h('h2', { id: 'msc-titolo', textContent: 'Assistente' });
    const nuovaChatHeader = h('button', { type: 'button', className: 'msc-nuova', title: 'Nuova chat' }, icona('M20 7v5h-5M4 17v-5h5M6.1 8a7 7 0 0 1 11.5-2L20 9M4 15l2.4 3A7 7 0 0 0 17.9 16'));
    nuovaChatHeader.setAttribute('aria-label', 'Nuova chat');
    nuovaChatHeader.addEventListener('click', () => inviaChat({ azione: 'nuova' }));
    const allarga = h('button', { type: 'button', className: 'msc-allarga' }, icona('M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5'));
    const maniglia = h('button', { type: 'button', className: 'msc-ridimensiona' }, icona('M4 16V4h12M4 4l12 12'));
    maniglia.setAttribute('aria-label', 'Ridimensiona l’assistente');
    maniglia.title = 'Trascina questo angolo. Con la tastiera usa le frecce; Home ripristina.';
    let ampliato = false, misura = null, trascinamento = null;
    function aggiornaMisura() {
      fumetto.removeAttribute('style');
      const mobile = window.innerWidth <= 600;
      if (ampliato || (misura && !mobile)) {
        const destra = ampliato ? (mobile ? 8 : 16) : Math.min(misura.destra, Math.max(8, window.innerWidth - 376));
        const basso = ampliato ? (mobile ? 8 : 16) : Math.min(misura.basso, Math.max(8, window.innerHeight - 368));
        const maxW = window.innerWidth - destra - 8, maxH = window.innerHeight - basso - 8;
        const w = ampliato ? Math.min(900, window.innerWidth - destra * 2) : Math.min(maxW, Math.max(Math.min(360, maxW), misura.larghezza));
        const ht = ampliato ? window.innerHeight - basso * 2 : Math.min(maxH, Math.max(Math.min(360, maxH), misura.altezza));
        Object.assign(fumetto.style, { position: 'fixed', left: 'auto', right: destra + 'px', bottom: basso + 'px', width: w + 'px', height: ht + 'px' });
      }
      allarga.setAttribute('aria-label', ampliato || (misura && !mobile) ? 'Ripristina dimensioni assistente' : 'Allarga l’assistente');
      allarga.title = allarga.getAttribute('aria-label');
      allarga.setAttribute('aria-pressed', String(ampliato || !!(misura && !mobile)));
    }
    function ripristinaMisura() { ampliato = false; misura = null; aggiornaMisura(); }
    allarga.addEventListener('click', () => {
      if (ampliato || (misura && window.innerWidth > 600)) ripristinaMisura();
      else { ampliato = true; aggiornaMisura(); }
    });
    maniglia.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const r = fumetto.getBoundingClientRect();
      trascinamento = { x: e.clientX, y: e.clientY, larghezza: r.width, altezza: r.height, destra: window.innerWidth - r.right, basso: window.innerHeight - r.bottom };
      maniglia.setPointerCapture(e.pointerId); e.preventDefault();
    });
    maniglia.addEventListener('pointermove', (e) => {
      if (!trascinamento) return;
      ampliato = false;
      misura = { ...trascinamento, larghezza: trascinamento.larghezza + trascinamento.x - e.clientX, altezza: trascinamento.altezza + trascinamento.y - e.clientY };
      aggiornaMisura();
    });
    maniglia.addEventListener('pointerup', () => { trascinamento = null; });
    maniglia.addEventListener('pointercancel', () => { trascinamento = null; });
    maniglia.addEventListener('lostpointercapture', () => { trascinamento = null; });
    maniglia.addEventListener('keydown', (e) => {
      if (e.key === 'Home') { e.preventDefault(); ripristinaMisura(); return; }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault(); const r = fumetto.getBoundingClientRect(), passo = e.shiftKey ? 64 : 24;
      ampliato = false;
      misura = { larghezza: r.width + (e.key === 'ArrowLeft' ? passo : e.key === 'ArrowRight' ? -passo : 0), altezza: r.height + (e.key === 'ArrowUp' ? passo : e.key === 'ArrowDown' ? -passo : 0), destra: window.innerWidth - r.right, basso: window.innerHeight - r.bottom };
      aggiornaMisura();
    });
    window.addEventListener('resize', () => { trascinamento = null; aggiornaMisura(); });
    aggiornaMisura();
    const testata = h('div', { className: 'msc-testata' },
      h('span', { className: 'msc-testata-icona' }, icona('M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z')),
      h('div', { className: 'msc-testata-testo' }, titolo, h('span', { textContent: 'Guide, contatti e suggerimenti' })),
      h('span', { className: 'msc-badge', textContent: 'AI' }), nuovaChatHeader, allarga, chiudi);
    const corpo = h('div', { className: 'msc-in' });
    fumetto.append(testata, corpo, maniglia);
    radiceEl.append(fumetto, bottone);
    document.body.append(radiceEl);
    document.documentElement.classList.add('msc-attiva');

    // «Mostra l'assistente» nel piè di pagina e in «Aspetto»: l'unico modo per riaverlo dopo averlo nascosto
    const mostra = h('button', { type: 'button', className: 'msc-mostra', id: 'msc-mostra', textContent: 'Mostra l’assistente', hidden: true });
    const foot = document.querySelector('.foot .in');
    if (foot) foot.append(mostra);
    let spunta = null;
    const controlli = document.querySelector('.appearance-controls');
    if (controlli) {
      spunta = h('input', { type: 'checkbox', id: 'aspetto-assistente', checked: !leggi() });
      controlli.append(h('label', { className: 'appearance-check', htmlFor: 'aspetto-assistente' }, spunta, ' Mostra l’assistente in basso a destra'));
      spunta.addEventListener('change', () => imposta(!spunta.checked));
      if (document.body.dataset.meteoAttivo === '1') {
        const spuntaMeteo = h('input', { type: 'checkbox', id: 'aspetto-meteo', checked: leggiMeteo('.silenzioso') !== '1' });
        controlli.append(h('label', { className: 'appearance-check', htmlFor: 'aspetto-meteo' }, spuntaMeteo, ' Mostra ogni tanto il meteo locale'));
        spuntaMeteo.addEventListener('change', () => { salvaMeteo('.silenzioso', spuntaMeteo.checked ? '0' : '1'); togliMeteo(); programmaMeteo(); });
      }
    }
    function imposta(nascosta) {
      scrivi(nascosta);
      radiceEl.hidden = nascosta;
      mostra.hidden = !nascosta;
      document.documentElement.classList.toggle('msc-attiva', !nascosta);
      if (spunta) spunta.checked = !nascosta;
      if (nascosta) { togliNota(); if (stato.aperta) chiudiFumetto(false); }
      programmaBattuta();
      if (nascosta) togliMeteo();
      programmaMeteo();
    }
    mostra.addEventListener('click', () => { imposta(false); bottone.focus(); });

    // ---- battute dell'ufficio, solo con assistente visibile e chat chiusa
    function togliNota() { clearTimeout(timerNota); if (nota) { nota.remove(); nota = null; } radiceEl.dispatchEvent(new Event('assistente:chiudi-note')); }
    function programmaBattuta(ritardo = 12000 + Math.random() * 4000) {
      clearTimeout(timerBattuta);
      if (document.hidden || radiceEl.hidden || stato.aperta || notaMeteo || meteoInCorso || radiceEl.dataset.spotVisibile || radiceEl.dataset.spotVideo) return;
      timerBattuta = setTimeout(mostraNota, ritardo);
    }
    radiceEl.addEventListener('assistente:prepara-spot', togliNota);
    radiceEl.addEventListener('assistente:riprendi-note', () => programmaBattuta());
    function mostraNota() {
      if (document.hidden || radiceEl.hidden || stato.aperta || notaMeteo || meteoInCorso || radiceEl.dataset.spotVisibile || radiceEl.dataset.spotVideo) return;
      if (!radiceEl.dispatchEvent(new CustomEvent('assistente:turno', {cancelable:true,detail:{occupato:occupatoMeteo(),attesaMeteo:meteoIniziale && document.body.dataset.meteoAttivo==='1' && leggiMeteo('.silenzioso')!=='1'}}))) return;
      togliNota();
      ultimaBattuta = scegliBattuta(BATTUTE,ultimaBattuta);
      nota = h('p', { className: 'msc-nota', textContent: ultimaBattuta });
      nota.setAttribute('aria-hidden', 'true');
      radiceEl.append(nota);
      timerNota = setTimeout(togliNota, 6000);
      programmaBattuta();
    }
    document.addEventListener('visibilitychange', () => { togliNota(); programmaBattuta(); });

    // ---- meteo spontaneo, separato dalla conversazione e dalla bozza del ticket
    function togliMeteo() {
      clearTimeout(timerChiudiMeteo);
      if (notaMeteo) { notaMeteo.remove(); notaMeteo = null; }
    }
    function occupatoMeteo() {
      const focus = document.activeElement;
      const scrive = focus && /^(INPUT|TEXTAREA|SELECT)$/.test(focus.tagName);
      const bozza = [...document.querySelectorAll('#v-nuova textarea, #v-nuova input:not(#telefono):not([type=file]):not([type=checkbox]):not([type=radio]):not([type=hidden])')].some(e => e.value.trim());
      return document.hidden || radiceEl.hidden || stato.aperta || !!radiceEl.dataset.spotVideo || scrive || bozza || Date.now() - ultimoInput < 30000;
    }
    function programmaMeteo(ritardoMinimo = 0) {
      clearTimeout(timerMeteo);
      if (document.body.dataset.meteoAttivo !== '1') return;
      if (document.hidden || radiceEl.hidden || leggiMeteo('.silenzioso') === '1') return;
      const prossimo = Number(leggiMeteo('.prossimo')) || 0;
      timerMeteo = setTimeout(() => mostraMeteo(false), meteoIniziale ? ritardoMinimo : Math.max(60000, prossimo - Date.now()));
    }
    function schedaMeteo(m) {
      const simbolo = h('span', { className: 'msc-meteo-icona', textContent: m.icona });
      simbolo.setAttribute('aria-hidden', 'true');
      const intestazione = h('div', { className: 'msc-meteo-riga' }, simbolo,
        h('div', {}, h('b', { textContent: m.giorno + ' a ' + m.localita }), h('span', { className: 'msc-meteo-condizione', textContent: m.descrizione })),
        h('strong', { className: 'msc-meteo-gradi', textContent: m.temperatura === null ? m.massima + '°' : m.temperatura + '°' }));
      const fonte = h('a', { className: 'msc-meteo-fonte', href: 'https://open-meteo.com/', target: '_blank', rel: 'noopener noreferrer', textContent: 'Open-Meteo · ' + m.aggiornato.slice(8, 10) + '/' + m.aggiornato.slice(5, 7) + ' ore ' + m.aggiornato.slice(11, 16) + (m.fuso ? ' · ' + m.fuso : '') });
      return h('div', { className: 'msc-meteo-scheda' }, intestazione,
        m.paese ? h('small', { className: 'msc-meteo-zona', textContent: [m.regione, m.paese].filter(Boolean).join(' · ') }) : null,
        m.battuta ? h('p', { className: 'msc-meteo-battuta', textContent: m.battuta + '!' }) : null,
        h('p', { className: 'msc-meteo-dati', textContent: `Min ${m.minima}° · Max ${m.massima}° · Pioggia ${m.pioggia}%` }), fonte,
        m.paese ? h('a', { className: 'msc-meteo-fonte msc-meteo-zona', href: 'https://www.geonames.org/', target: '_blank', rel: 'noopener noreferrer', textContent: 'Località: GeoNames' }) : null);
    }
    let allertaVista='';
    function schedaAllerta(a) {
      const data=iso=>new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));
      const box=h('section',{className:'msc-allerta'});box.dataset.colore=a.colore;box.setAttribute('role',a.colore==='rossa'?'alert':'status');
      if(a.simulazione)box.append(h('small',{className:'msc-allerta-simulazione',textContent:'SIMULAZIONE · NON È UN’ALLERTA ATTUALE'}));
      box.append(h('strong',{textContent:'⚠ Allerta '+a.colore+' '+(a.stato==='prevista'?'prevista':'a '+a.comune)}),h('p',{textContent:a.messaggio}),h('small',{textContent:'Dal '+data(a.validaDa)+' al '+data(a.validaFino)+' · ora italiana'}),h('small',{textContent:'Zona '+a.zona+' · avviso '+a.numeroDocumento}),h('a',{href:a.urlDocumento||a.urlFonte,target:'_blank',rel:'noopener noreferrer',textContent:'Leggi la fonte ufficiale regionale'}));
      return box;
    }
    setInterval(async()=>{
      if(document.hidden||radiceEl.hidden||leggiMeteo('.silenzioso')==='1')return;
      try {
        const r=await prendi('/allerte-meteo'),a=r.dati;
        const id=a?[a.numeroDocumento,a.colore,a.validaDa,a.validaFino].join(':'):'';
        if(a&&['attiva','prevista'].includes(a.stato)&&['gialla','arancione','rossa'].includes(a.colore)&&id!==allertaVista&&!occupatoMeteo())await mostraMeteo(true);
      }catch{}
    },300000);
    function schedaPrevisioni(previsioni) {
      const primo = previsioni[0];
      const box = h('div', { className: 'msc-previsioni' }, h('b', { className: 'msc-previsioni-titolo', textContent: 'Previsioni a ' + primo.localita }));
      if (primo.paese) box.append(h('small', { className: 'msc-meteo-zona', textContent: [primo.regione, primo.paese].filter(Boolean).join(' · ') }));
      for (const m of previsioni) {
        const simbolo = h('span', { className: 'msc-previsioni-icona', textContent: m.icona }); simbolo.setAttribute('aria-hidden', 'true');
        box.append(h('div', { className: 'msc-previsioni-giorno' }, simbolo,
          h('div', {}, h('b', { textContent: m.giorno + ' · ' + m.data.slice(8,10) + '/' + m.data.slice(5,7) }), h('span', { textContent: m.descrizione }), m.battuta ? h('small', { textContent: m.battuta + '!' }) : null),
          h('div', { className: 'msc-previsioni-valori' }, h('b', { textContent: m.minima + '° / ' + m.massima + '°' }), h('small', { textContent: 'min / max' }), h('small', { textContent: 'Pioggia ' + m.pioggia + '%' }))));
      }
      box.append(h('a', { className: 'msc-meteo-fonte', href: 'https://open-meteo.com/', target: '_blank', rel: 'noopener noreferrer', textContent: 'Open-Meteo · ' + primo.aggiornato.slice(8,10) + '/' + primo.aggiornato.slice(5,7) + ' ore ' + primo.aggiornato.slice(11,16) + ' · ' + primo.fuso }));
      if (primo.paese) box.append(h('a', { className: 'msc-meteo-fonte msc-meteo-zona', href: 'https://www.geonames.org/', target: '_blank', rel: 'noopener noreferrer', textContent: 'Località: GeoNames' }));
      return box;
    }
    async function mostraMeteo(manuale) {
      const iniziale = meteoIniziale;
      if (!manuale && !iniziale && Number(leggiMeteo('.prossimo')) > Date.now()) { programmaMeteo(); return; }
      if (meteoInCorso || occupatoMeteo() || (!manuale && leggiMeteo('.silenzioso') === '1')) { programmaMeteo(30000); return; }
      meteoIniziale = false;
      meteoInCorso = true;
      try {
        const [out, avviso] = await Promise.all([prendi('/meteo').catch(()=>({})),prendi('/allerte-meteo').catch(()=>({}))]);
        const allerta=avviso.dati;
        const segnala=allerta && ['attiva','prevista'].includes(allerta.stato) && ['gialla','arancione','rossa'].includes(allerta.colore);
        if ((!out.dati?.meteo && !segnala) || occupatoMeteo()) return;
        togliNota(); togliMeteo(); clearTimeout(timerBattuta);
        notaMeteo = h('section', { className: 'msc-nota msc-meteo', id: 'msc-meteo', tabIndex: 0 });
        notaMeteo.setAttribute('aria-label', segnala ? 'Allerta meteo per '+allerta.comune : 'Meteo di '+out.dati.meteo.localita);
        const chiudiMeteo = h('button', { type: 'button', className: 'msc-meteo-chiudi', textContent: '×', title: 'Chiudi il meteo' });
        chiudiMeteo.setAttribute('aria-label', 'Chiudi il meteo');
        chiudiMeteo.addEventListener('click', () => { togliMeteo(); programmaBattuta(); });
        const silenzia = h('button', { type: 'button', className: 'msc-meteo-silenzia', textContent: 'Silenzia meteo' });
        silenzia.addEventListener('click', () => {
          salvaMeteo('.silenzioso', '1');
          const spunta = document.getElementById('aspetto-meteo'); if (spunta) spunta.checked = false;
          togliMeteo(); clearTimeout(timerMeteo); programmaBattuta();
        });
        notaMeteo.append(chiudiMeteo);
        if(segnala) {
          notaMeteo.append(schedaAllerta(allerta));
          allertaVista=[allerta.numeroDocumento,allerta.colore,allerta.validaDa,allerta.validaFino].join(':');
        }
        if(out.dati?.meteo) notaMeteo.append(schedaMeteo(out.dati.meteo));
        if(allerta?.stato==='non_verificabile')notaMeteo.append(h('p',{className:'msc-allerta-stato',textContent:allerta.messaggio}));
        notaMeteo.append(silenzia);
        notaMeteo.addEventListener('keydown', e => { if(e.key === 'Escape') { togliMeteo(); bottone.focus(); } });
        radiceEl.append(notaMeteo);
        salvaMeteo('.prossimo', String(Date.now() + 50 * 60000));
        const chiudiAutomatico = () => {
          if (notaMeteo?.matches(':hover') || notaMeteo?.contains(document.activeElement)) { timerChiudiMeteo = setTimeout(chiudiAutomatico, 5000); return; }
          togliMeteo(); programmaBattuta();
        };
        timerChiudiMeteo = setTimeout(chiudiAutomatico, segnala ? 30000 : 13000);
      } catch { /* Il fumetto resta silenzioso se il meteo non è disponibile. */ }
      finally { meteoInCorso = false; programmaMeteo(); if (!notaMeteo) programmaBattuta(iniziale ? 8000 : undefined); }
    }
    document.addEventListener('input', () => { ultimoInput = Date.now(); togliMeteo(); });
    document.addEventListener('visibilitychange', () => { togliMeteo(); programmaMeteo(); });
    window.addEventListener('hashchange', () => { togliMeteo(); programmaMeteo(); });
    if (document.body.dataset.anteprimaMeteo === '1') {
      const prova = h('button', { type: 'button', className: 'msc-meteo-prova', id: 'anteprima-meteo', textContent: 'Anteprima · Mostra fumetto meteo' });
      prova.addEventListener('click', () => { ultimoInput = 0; mostraMeteo(true); });
      document.body.append(prova);
    }

    // ---- dati
    async function prendi(percorso) {
      const r = await fetch(BASE + '/api' + percorso, { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (r.status === 401) return { nonAutenticato: true };
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return { dati: await r.json() };
    }
    async function carica() {
      stato.errore = false;
      try {
        const me = await prendi('/me');
        stato.accesso = !me.nonAutenticato;
        if (!stato.accesso) { pulisciRiassunto(); stato.messaggi = []; stato.ultima = null; stato.testo = ''; stato.utente = ''; stato.csrf = ''; return; }
        if (stato.utente !== me.dati.email) { pulisciRiassunto(); stato.messaggi = []; stato.ultima = null; stato.testo = ''; }
        stato.utente = me.dati.email;
        stato.csrf = me.dati.csrf;
        if (!stato.attesa) {
          const chat = await prendi('/assistente').catch(() => null);
          if (chat?.dati) {
            stato.messaggi = chat.dati.messaggi || []; stato.ultima = chat.dati.ultima;
            const ultimo = stato.messaggi.findLast((m) => m.ruolo === 'assistente');
            if (ultimo) ultimo.dettagli = stato.ultima;
          }
        }
      } catch { stato.errore = true; }
    }

    // ---- fumetto
    const href = (ancora) => BASE + '/' + ancora;
    const collega = (ancora, testo, classe, ...extra) => {
      const a = h('a', { href: href(ancora), className: classe || '' }, ...extra);
      if (testo) a.append(testo);
      a.addEventListener('click', () => chiudiFumetto(false));
      return a;
    };
    const lista = (titoloLista, voci) => h('section', { className: 'msc-blocco' }, h('h3', { textContent: titoloLista }), h('ul', {}, ...voci));
    const vNumero = (v) => {
      const num = v.esterno ? h('a', { className: 'msc-n', href: telefono(v.numero), textContent: v.numero }) : h('b', { className: 'msc-n', textContent: v.numero });
      if (v.esterno) num.setAttribute('aria-label', 'Chiama ' + v.numero);
      const dettaglio = [v.nota, v.sezione].filter(Boolean).join(' · ');
      const numeri = h('div', { className: 'msc-numeri' }, num);
      if (v.cellulare) numeri.append(h('a', { className: 'msc-cellulare', href: telefono(v.cellulare), textContent: 'Cell. ' + v.cellulare }));
      return h('li', { className: 'msc-num' }, h('span', { className: 'msc-nome' }, v.nome, dettaglio ? h('small', { textContent: dettaglio }) : null), numeri);
    };

    function nascondi() {
      const b = h('button', { type: 'button', className: 'msc-nascondi', textContent: 'Nascondi l’assistente' });
      b.addEventListener('click', () => imposta(true));
      return b;
    }

    function pulisciRiassunto() {
      stato.controllerRiassunto?.abort();stato.controllerRiassunto=null;stato.testoRiassunto='';stato.risultatoRiassunto='';stato.erroreRiassunto='';stato.modo='chat';
    }
    function testoDaRichiesta(testo) {
      const m=String(testo||'').match(/^\s*(?:riassumi(?: questo testo)?|fammi un riassunto)(?:(?:[ \t]*:[ \t]*|[ \t]*\r?\n)[ \t\r\n]*([\s\S]*)|[ \t]*)$/i);
      return m ? (m[1]||'') : null;
    }
    function apriRiassunto() {stato.modo='riassunto';stato.erroreRiassunto='';disegna();corpo.querySelector('#msc-testo-riassunto')?.focus({preventScroll:true});}
    function disegnaRiassunto() {
      nuovaChatHeader.hidden=true;
      const indietro=h('button',{type:'button',className:'msc-riassunto-indietro',textContent:'← Torna alla chat'});
      indietro.addEventListener('click',()=>{stato.controllerRiassunto?.abort();stato.modo='chat';disegna();});
      const titolo=h('h3',{textContent:'Riassumi un testo'});
      const nota=h('p',{className:'msc-riassunto-nota',textContent:'Incolla il testo da sintetizzare. Non inserire password, token o chiavi segrete.'});
      const campo=h('textarea',{id:'msc-testo-riassunto',rows:6,value:stato.testoRiassunto,disabled:stato.attesaRiassunto,placeholder:'Incolla qui il testo…'});
      const label=h('label',{htmlFor:'msc-testo-riassunto',textContent:'Testo da riassumere'});
      const conta=h('small',{id:'msc-riassunto-conta',textContent:stato.testoRiassunto.length+' / 6000 caratteri'});
      campo.setAttribute('aria-describedby','msc-riassunto-conta');
      const troppoLungo=stato.testoRiassunto.length>6000||new TextEncoder().encode(stato.testoRiassunto).length>12000;
      const status=h('p',{className:'msc-riassunto-status',textContent:stato.attesaRiassunto?'Sto preparando il riassunto… Per testi lunghi può richiedere qualche decina di secondi.':troppoLungo?'Il testo è troppo lungo: usa un estratto più breve.':stato.erroreRiassunto});status.setAttribute('role','status');
      const invia=h('button',{type:'submit',className:'msc-invia',id:'msc-riassunto-invia',textContent:stato.attesaRiassunto?'Un momento…':'Riassumi',disabled:stato.attesaRiassunto||!stato.testoRiassunto.trim()||stato.testoRiassunto.length>6000||new TextEncoder().encode(stato.testoRiassunto).length>12000});
      const annulla=h('button',{type:'button',className:'msc-chat-b',textContent:stato.attesaRiassunto?'Annulla':'Cancella testo'});
      annulla.addEventListener('click',()=>{if(stato.attesaRiassunto)stato.controllerRiassunto?.abort();else{stato.testoRiassunto='';stato.risultatoRiassunto='';stato.erroreRiassunto='';disegnaRiassunto();}});
      const valido=t=>t.trim().length>0&&t.length<=6000&&new TextEncoder().encode(t).length<=12000;
      const aggiorna=()=>{stato.testoRiassunto=campo.value;conta.textContent=campo.value.length+' / 6000 caratteri';invia.disabled=stato.attesaRiassunto||!valido(campo.value);status.textContent=campo.value.length>6000||new TextEncoder().encode(campo.value).length>12000?'Il testo è troppo lungo: usa un estratto più breve.':'';};
      campo.addEventListener('input',aggiorna);
      campo.addEventListener('paste',e=>{
        const t=e.clipboardData?.getData('text/plain');if(t===undefined)return;
        const completo=campo.value.slice(0,campo.selectionStart)+t+campo.value.slice(campo.selectionEnd);
        if(completo.length>6000||new TextEncoder().encode(completo).length>12000){e.preventDefault();status.textContent='Testo troppo lungo: non è stato incollato. Dividilo in parti più brevi.';}
      });
      const form=h('form',{className:'msc-riassunto-form'},label,campo,conta,h('div',{className:'msc-riassunto-azioni'},invia,annulla));
      form.addEventListener('submit',e=>{e.preventDefault();if(valido(campo.value)&&!stato.attesaRiassunto)inviaRiassunto();});
      const box=h('section',{className:'msc-riassunto'},indietro,titolo);
      if(stato.risultatoRiassunto)box.append(h('details',{className:'msc-riassunto-originale'},h('summary',{textContent:'Testo originale · '+stato.testoRiassunto.length+' caratteri'}),nota,form));
      else box.append(nota,form);
      box.append(status);
      box.append(h('small',{className:'msc-riassunto-privacy',textContent:'Testo e riassunto restano fuori dalla cronologia della chat. Nessun ticket viene modificato.'}));
      if(stato.risultatoRiassunto){
        const risultato=h('div',{className:'msc-riassunto-risultato',id:'msc-riassunto-risultato',tabIndex:-1,textContent:stato.risultatoRiassunto});
        const copia=h('button',{type:'button',className:'msc-chat-b',textContent:'Copia riassunto',id:'msc-copia-riassunto'});
        copia.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(stato.risultatoRiassunto);copia.textContent='Copiato ✓';}catch{const sel=window.getSelection(),r=document.createRange();r.selectNodeContents(risultato);sel.removeAllRanges();sel.addRange(r);copia.textContent='Selezionato: premi Ctrl+C';}});
        box.append(h('h4',{textContent:'Riassunto'}),risultato,copia,h('small',{className:'msc-riassunto-privacy',textContent:'Sintesi generata da AI: verifica date, cifre e passaggi essenziali sul testo originale.'}));
      }
      corpo.replaceChildren(box);
    }
    async function inviaRiassunto() {
      const utente=stato.utente;stato.attesaRiassunto=true;stato.erroreRiassunto='';stato.risultatoRiassunto='';
      const controller=new AbortController();stato.controllerRiassunto=controller;disegnaRiassunto();
      try{
        const r=await fetch(BASE+'/api/assistente',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',Accept:'application/json','X-CSRF-Token':stato.csrf},body:JSON.stringify({azione:'riassunto',testo:stato.testoRiassunto}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(125000)])});
        const out=await r.json();if(stato.utente!==utente)return;
        if(r.status===401){pulisciRiassunto();stato.accesso=false;stato.utente='';stato.messaggi=[];disegna();return;}
        if(!r.ok)throw new Error(out.errore||'Non riesco a preparare il riassunto. Riprova tra poco.');
        stato.risultatoRiassunto=out.risposta;
      }catch(e){if(stato.utente===utente)stato.erroreRiassunto=controller.signal.aborted?'Riassunto annullato.':e.name==='TimeoutError'?'Il riassunto richiede troppo tempo. Prova un testo più breve.':e.message;}
      finally{stato.attesaRiassunto=false;stato.controllerRiassunto=null;if(stato.aperta&&stato.modo==='riassunto'){disegnaRiassunto();if(stato.risultatoRiassunto)corpo.querySelector('#msc-riassunto-risultato')?.focus({preventScroll:false});}}
    }
    async function inviaChat(dati) {
      if (stato.attesa) return;
      if((!dati.azione||dati.azione==='messaggio')&&window.SpotAssistente?.richiestaSpot(dati.testo)){
        const id=window.SpotAssistente.idSpotRichiesto(dati.testo);
        if(window.SpotAssistente.avviaSpot(id)){stato.testo='';stato.erroreChat='';}
        else stato.erroreChat=id?'Lo spot richiesto non è disponibile al momento.':'Non ci sono spot disponibili al momento. Riprova tra poco.';
        aggiornaChat();return;
      }
      const inline=(!dati.azione||dati.azione==='messaggio')?testoDaRichiesta(dati.testo||''):null;
      if(inline!==null){
        stato.testo='';stato.testoRiassunto=inline;stato.risultatoRiassunto='';apriRiassunto();
        if(inline.trim()&&inline.length<=6000&&new TextEncoder().encode(inline).length<=12000)await inviaRiassunto();
        return;
      }
      const utente = stato.utente;
      const messaggiPrima=stato.messaggi.slice(),ultimaPrima=stato.ultima;
      stato.attesa = true; stato.erroreChat = '';
      const inviato = dati.testo || (dati.azione === 'ticket' ? 'Aiutami a descrivere il problema' : 'Nuova conversazione');
      if (dati.azione !== 'nuova') stato.messaggi.push({ ruolo: 'utente', testo: inviato });
      stato.testo = '';
      aggiornaChat();
      try {
        const r = await fetch(BASE + '/api/assistente', { method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': stato.csrf }, body: JSON.stringify(dati), signal: AbortSignal.timeout(70000) });
        const out = await r.json();
        if (stato.utente !== utente) return;
        if (r.status === 401) { pulisciRiassunto(); stato.accesso = false; stato.utente = ''; stato.messaggi = []; stato.ultima = null; stato.testo = ''; disegna(); return; }
        if (!r.ok) throw new Error(out.errore || 'L’assistente non è disponibile. Puoi consultare Guide e Contatti.');
        if(out.tipo==='riassunto') {
          stato.messaggi=messaggiPrima;stato.ultima=ultimaPrima;stato.modo='riassunto';stato.testoRiassunto=out.richiediTesto?'':testoDaRichiesta(dati.testo||'');stato.risultatoRiassunto=out.richiediTesto?'':out.risposta;stato.erroreRiassunto='';return;
        }
        if (dati.azione === 'nuova') stato.messaggi = [];
        else stato.messaggi.push({ ruolo: 'assistente', testo: out.risposta, dettagli: out });
        stato.messaggi = stato.messaggi.slice(-12);
        stato.ultima = out;
      } catch (e) {
        if (stato.utente === utente) {
          stato.erroreChat = e.name === 'TimeoutError' ? 'La risposta sta impiegando troppo tempo. Riprova oppure consulta le guide.' : e.message;
          stato.testo = dati.testo || '';
        }
      } finally {
        stato.attesa = false;
        if (stato.aperta) aggiornaChat();
      }
    }

    function dettagliRisposta(out, corrente) {
      const extra = h('div', { className: 'msc-chat-extra' });
      if (!out) return extra;
      if (out.meteo) extra.append(schedaMeteo(out.meteo));
      if (out.previsioni?.length) extra.append(schedaPrevisioni(out.previsioni));
      if (out.contatti?.length) extra.append(lista('Contatti trovati', out.contatti.map(vNumero)));
      if (out.richieste?.length) extra.append(lista('Le tue richieste', out.richieste.map((r) => h('li', { className: 'msc-ticket-card' },
        collega(r.url.slice((BASE + '/').length), `#${r.id} · ${r.titolo}`, 'msc-fonte'),
        h('small', { textContent: r.stato }), r.descrizione ? h('p', { textContent: r.descrizione }) : null,
        ...(r.eventi || []).map((e) => h('p', { textContent: e.testo }))))));
      if (out.fonti?.length) {
        const fonti = h('div', { className: 'msc-fonti' });
        for (const f of out.fonti) if (f.url.startsWith(BASE + '/#')) {
          fonti.append(collega(f.url.slice((BASE + '/').length), '', 'msc-fonte',
            icona('M4 4h6a3 3 0 0 1 3 3v13a4 4 0 0 0-4-2H4zM13 7a3 3 0 0 1 3-3h5v14h-4a4 4 0 0 0-4 2'), h('span', { textContent: f.titolo })));
        }
        extra.append(fonti);
      }
      if (out.opzioni?.length) {
        const opzioni = h('div', { className: 'msc-opzioni' });
        for (const o of out.opzioni) {
          const b = h('button', { type: 'button', className: 'msc-chat-b', textContent: o.testo, disabled: stato.attesa || !corrente });
          b.addEventListener('click', () => inviaChat({ azione: o.azione, categoria: o.categoria, testo: o.testo })); opzioni.append(b);
        }
        extra.append(opzioni);
      }
      if (out.bozza) {
        extra.append(h('p', { className: 'msc-categoria', textContent: 'Categoria suggerita: ' + out.bozza.categoria }));
        const descrizione = h('pre', { className: 'msc-testo-copia', textContent: out.bozza.descrizione });
        descrizione.setAttribute('aria-label', 'Testo suggerito da copiare manualmente');
        const copia = h('button', { type: 'button', className: 'msc-chat-b msc-copia', textContent: 'Copia il testo' });
        copia.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(out.bozza.descrizione); copia.textContent = 'Testo copiato ✓'; }
          catch {
            const selezione = window.getSelection(), intervallo = document.createRange();
            intervallo.selectNodeContents(descrizione); selezione.removeAllRanges(); selezione.addRange(intervallo);
            copia.textContent = 'Testo selezionato: premi Ctrl+C';
          }
        });
        extra.append(descrizione, copia);
      }
      return extra;
    }

    function aggiornaChat() {
      if(stato.modo==='riassunto'){disegnaRiassunto();return;}
      const box = corpo.querySelector('#msc-chat');
      if (!box || stato.accesso !== true) return;
      nuovaChatHeader.disabled = stato.attesa;
      const messaggi = h('div', { className: 'msc-messaggi', id: 'msc-messaggi', tabIndex: 0 });
      messaggi.setAttribute('role', 'log'); messaggi.setAttribute('aria-label', 'Conversazione con l’assistente'); messaggi.setAttribute('aria-live', 'polite');
      let ultimaRisposta = null;
      for (let i = 0; i < stato.messaggi.length; i++) {
        const m = stato.messaggi[i], assistente = m.ruolo === 'assistente';
        const bolla = h('article', { className: 'msc-messaggio ' + (assistente ? 'msc-risposta' : 'msc-utente') },
          h('b', { className: 'msc-autore', textContent: assistente ? 'Assistente' : 'Tu' }), m.dettagli?.meteo || m.dettagli?.previsioni?.length ? null : h('p', { className: 'msc-messaggio-testo', textContent: m.testo }));
        if (assistente) { bolla.append(dettagliRisposta(m.dettagli, i === stato.messaggi.length - 1)); ultimaRisposta = bolla; }
        messaggi.append(bolla);
      }
      if (!stato.messaggi.length) {
        const esempio = (label, domanda) => {
          const b = h('button', { type: 'button', className: 'msc-esempio', textContent: label });
          b.addEventListener('click', () => { stato.testo = domanda; aggiornaChat(); corpo.querySelector('#msc-domanda').focus({ preventScroll: true }); });
          return b;
        };
        messaggi.append(h('div', { className: 'msc-benvenuto' },
          h('span', { className: 'msc-benvenuto-icona' }, icona('M8 10h.01M12 10h.01M16 10h.01M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0z')),
          h('h3', { textContent: 'Come posso aiutarti?' }),
          h('p', { textContent: 'Descrivi un problema informatico o chiedimi il numero di una persona o di un ufficio.' }),
          h('div', { className: 'msc-esempi' }, esempio('Ho un problema informatico', 'Ho un problema con '), esempio('Cerco un numero di telefono', 'Cerco il numero di '), esempio('Una barzelletta', 'Raccontami una barzelletta'), esempio('Una freddura', 'Dimmi una freddura'))));
      }
      if (stato.attesa) {
        const attesa = h('p', { className: 'msc-attesa', textContent: 'Sto cercando una risposta…' });
        attesa.setAttribute('role', 'status'); messaggi.append(attesa);
      }
      const campo = h('textarea', { id: 'msc-domanda', rows: 2, maxLength: 1500, value: stato.testo, placeholder: 'Scrivi qui la tua domanda…', disabled: stato.attesa });
      campo.addEventListener('input', () => { stato.testo = campo.value; });
      campo.addEventListener('paste',e=>{
        const t=e.clipboardData?.getData('text/plain');if(t===undefined)return;
        if(/^\s*(?:riassumi(?: questo testo)?|fammi un riassunto)(?:\s*:|[ \t]*\n)/i.test(t)){
          e.preventDefault();const documento=testoDaRichiesta(t)||'';
          if(documento.length>6000||new TextEncoder().encode(documento).length>12000){stato.erroreChat='Testo troppo lungo: non è stato incollato. Dividilo in parti più brevi.';aggiornaChat();return;}
          stato.testoRiassunto=documento;stato.risultatoRiassunto='';apriRiassunto();return;
        }
        if(campo.value.length-(campo.selectionEnd-campo.selectionStart)+t.length>1500){e.preventDefault();stato.erroreChat='Il testo è troppo lungo per la chat. Usa «Riassumi un testo» per incollarlo senza tagli.';aggiornaChat();}
      });
      const invia = h('button', { type: 'submit', className: 'msc-invia', disabled: stato.attesa, textContent: 'Chiedi' });
      const form = h('form', { className: 'msc-chat-form' }, h('label', { className: 'msc-vh', htmlFor: 'msc-domanda', textContent: 'Messaggio per l’assistente' }), campo, invia);
      form.addEventListener('submit', (e) => { e.preventDefault(); if (campo.value.trim().length >= 2) inviaChat({ testo: campo.value.trim() }); });
      campo.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
      const aiuto = h('button', { type: 'button', className: 'msc-aiuto', disabled: stato.attesa },
        icona('M12 20h9M16.5 3.5a2 2 0 0 1 3 3L7 19l-4 1 1-4z'), h('span', { textContent: 'Aiutami a descrivere il problema' }));
      aiuto.addEventListener('click', () => inviaChat({ azione: 'ticket' }));
      const status = h('p', { className: 'msc-chat-errore', textContent: stato.erroreChat });
      status.setAttribute('role', 'status');
      const riassumi=h('button',{type:'button',id:'msc-apri-riassunto',className:'msc-aiuto',disabled:stato.attesa,textContent:'Riassumi un testo'});
      riassumi.addEventListener('click',apriRiassunto);
      const strumenti=h('div',{className:'msc-strumenti'},riassumi,aiuto);
      const scrittura = h('div', { className: 'msc-scrittura' }, status, form, strumenti,
        h('small', { className: 'msc-ai-avviso', textContent: 'Suggerimenti da verificare. Nessun campo compilato e nessun ticket inviato.' }));
      const piedi = h('div', { className: 'msc-chat-piedi' }, collega('#faq', 'Guide'), collega('#contatti', 'Contatti'), collega('#nuova', 'Apri una richiesta'));
      box.replaceChildren(messaggi, scrittura, piedi);
      requestAnimationFrame(() => {
        if (!messaggi.isConnected) return;
        messaggi.scrollTop = stato.attesa || !ultimaRisposta ? messaggi.scrollHeight : Math.max(0, ultimaRisposta.offsetTop - 12);
      });
    }

    function disegna() {
      nuovaChatHeader.disabled = stato.accesso !== true || stato.attesa || stato.attesaRiassunto;
      nuovaChatHeader.hidden=stato.modo==='riassunto';
      if (stato.accesso === true) {
        if(stato.modo==='riassunto'){disegnaRiassunto();return;}
        corpo.replaceChildren(h('div', { id: 'msc-chat', className: 'msc-chat' }));
        aggiornaChat();
        return;
      }
      const login = h('div', { className: 'msc-login' }, h('h3', { textContent: stato.accesso === false ? 'Accedi al portale' : 'Un attimo…' }),
        h('p', { textContent: stato.accesso === false ? 'Usa il tuo account di lavoro per chiedere aiuto e consultare guide e contatti.' : stato.errore ? 'Non riesco a collegarmi. Chiudi e riapri l’assistente per riprovare.' : 'Sto verificando l’accesso.' }));
      if (stato.accesso === false) login.append(h('a', { className: 'msc-login-btn', href: BASE + '/auth/login', textContent: document.body.dataset.accesso || 'Accedi con Microsoft 365' }));
      login.append(nascondi());
      corpo.replaceChildren(login);
    }

    async function apriFumetto() {
      togliMeteo();
      clearTimeout(timerBattuta);
      togliNota();
      stato.aperta = true;
      radiceEl.dataset.aperta = 'true';
      bottone.setAttribute('aria-expanded', 'true');
      fumetto.hidden = false;
      disegna();
      fumetto.focus({ preventScroll: true });
      await carica();
      if (stato.aperta) disegna();
    }
    function chiudiFumetto(rendiFocus) {
      stato.aperta = false;
      radiceEl.dataset.aperta = 'false';
      bottone.setAttribute('aria-expanded', 'false');
      fumetto.hidden = true;
      if (rendiFocus) bottone.focus();
      programmaBattuta();
    }
    radiceEl.addEventListener('assistente:chiudi-chat-spot', () => chiudiFumetto(false));
    radiceEl.addEventListener('assistente:torna-chat', async () => {await apriFumetto();corpo.querySelector('#msc-domanda')?.focus({preventScroll:true});});
    bottone.addEventListener('click', () => (stato.aperta ? chiudiFumetto(true) : apriFumetto()));
    chiudi.addEventListener('click', () => chiudiFumetto(true));
    radiceEl.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stato.aperta) { e.stopPropagation(); chiudiFumetto(true); } });

    imposta(leggi());
    programmaBattuta(8000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
  else avvia();
  return api;
});
