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

  const api = { cerca, frequenti, saluto, telefono, SALUTI, MIN_CARATTERI, MAX_GUIDE, MAX_NUMERI };
  if (typeof document === 'undefined') return api;

  // ---------------------------------------------------------------- disegno
  const COSTUMI = {
    spazio: '<g class="msc-c msc-c-spazio"><circle class="msc-casco" cx="60" cy="46" r="37"/><path class="msc-lampo" d="M30 30a34 34 0 0 1 20 -14"/><rect class="msc-anello" x="32" y="76" width="56" height="7" rx="3.5"/></g>',
    giardino: '<g class="msc-c msc-c-giardino"><ellipse class="msc-paglia2" cx="60" cy="26" rx="36" ry="7"/><path class="msc-paglia" d="M42 26q0 -14 18 -14t18 14q-18 5 -36 0z"/><path class="msc-nastro" d="M42.5 22q17.500 6 35 0l.8 4q-18 6 -36.600 0z"/><g class="msc-germoglio"><path class="msc-stelo" d="M60 12V6"/><path class="msc-foglia1" d="M60 8q-10 0 -12 -8q10 0 12 8z"/><path class="msc-foglia2" d="M60 7q10 -1 12 -8q-10 1 -12 8z"/></g></g>',
    autunno: '<g class="msc-c msc-c-autunno"><path class="msc-sciarpa" d="M40 80q20 9 40 0l2 8q-22 10 -44 0z"/><path class="msc-sciarpa" d="M46 88l-3 17 9 -2 1 -14z"/></g>',
    dark: '<g class="msc-c msc-c-dark"><path class="msc-berretto" d="M33 30q0 -24 27 -24q22 0 28 22q-22 -6 -30 4z"/><rect class="msc-orlo" x="29" y="24" width="62" height="9" rx="4.5"/><g class="msc-pompon"><path class="msc-codaberretto" d="M80 12q16 2 18 22"/><circle class="msc-acc" cx="98" cy="36" r="5"/></g></g>',
    mountain: '<g class="msc-c msc-c-mountain"><ellipse class="msc-tesa" cx="60" cy="26" rx="37" ry="7"/><path class="msc-cappello" d="M38 26q2 -20 22 -20t22 20q-22 7 -44 0z"/><path class="msc-fascia" d="M39 22q21 7 42 0l1 5q-22 7 -44 0z"/><g class="msc-piuma"><path d="M78 18q14 -4 20 -18q-14 4 -20 18z"/></g></g>'
  };
  const FUORI = {
    spazio: '<g class="msc-c msc-c-spazio msc-stelle"><path class="msc-stella s1" d="M104 22l2.400 5.600 5.600 2.400-5.600 2.400-2.400 5.600-2.400-5.600-5.600-2.400 5.600-2.400z"/><path class="msc-stella s2" d="M14 28l1.600 3.600 3.600 1.600-3.600 1.600-1.600 3.600-1.600-3.600-3.600-1.600 3.600-1.600z"/></g>',
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
    COSTUMI.spazio + COSTUMI.giardino + COSTUMI.dark + COSTUMI.mountain + '</g>' +
    FUORI.spazio + FUORI.autunno + FUORI.dark +
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
      csrf: '', utente: '', messaggi: [], ultima: null, testo: '', attesa: false, erroreChat: '' };
    const BATTUTE = ['non si può fare', 'non subito', '...e non gratis', 'cinque minuti e arrivo', 'caffè?', 'hai aperto il ticket?'];
    let nota = null, timerNota = null, timerBattuta = null, prossimaBattuta = 0;

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
    const testata = h('div', { className: 'msc-testata' },
      h('span', { className: 'msc-testata-icona' }, icona('M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z')),
      h('div', { className: 'msc-testata-testo' }, titolo, h('span', { textContent: 'Guide, contatti e suggerimenti' })),
      h('span', { className: 'msc-badge', textContent: 'AI' }), nuovaChatHeader, chiudi);
    const corpo = h('div', { className: 'msc-in' });
    fumetto.append(testata, corpo);
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
    }
    function imposta(nascosta) {
      scrivi(nascosta);
      radiceEl.hidden = nascosta;
      mostra.hidden = !nascosta;
      document.documentElement.classList.toggle('msc-attiva', !nascosta);
      if (spunta) spunta.checked = !nascosta;
      if (nascosta) { togliNota(); if (stato.aperta) chiudiFumetto(false); }
      programmaBattuta();
    }
    mostra.addEventListener('click', () => { imposta(false); bottone.focus(); });

    // ---- battute dell'ufficio, solo con assistente visibile e chat chiusa
    function togliNota() { clearTimeout(timerNota); if (nota) { nota.remove(); nota = null; } }
    function programmaBattuta(ritardo = 20000 + Math.random() * 10000) {
      clearTimeout(timerBattuta);
      if (document.hidden || radiceEl.hidden || stato.aperta) return;
      timerBattuta = setTimeout(mostraNota, ritardo);
    }
    function mostraNota() {
      if (document.hidden || radiceEl.hidden || stato.aperta) return;
      togliNota();
      nota = h('p', { className: 'msc-nota', textContent: BATTUTE[prossimaBattuta] });
      prossimaBattuta = (prossimaBattuta + 1) % BATTUTE.length;
      nota.setAttribute('aria-hidden', 'true');
      radiceEl.append(nota);
      timerNota = setTimeout(togliNota, 6000);
      programmaBattuta();
    }
    document.addEventListener('visibilitychange', () => { togliNota(); programmaBattuta(); });

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
        if (!stato.accesso) { stato.messaggi = []; stato.ultima = null; stato.testo = ''; stato.utente = ''; stato.csrf = ''; return; }
        if (stato.utente !== me.dati.email) { stato.messaggi = []; stato.ultima = null; stato.testo = ''; }
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

    async function inviaChat(dati) {
      if (stato.attesa) return;
      const utente = stato.utente;
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
        if (r.status === 401) { stato.accesso = false; stato.utente = ''; stato.messaggi = []; stato.ultima = null; stato.testo = ''; disegna(); return; }
        if (!r.ok) throw new Error(out.errore || 'L’assistente non è disponibile. Puoi consultare Guide e Contatti.');
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
      const box = corpo.querySelector('#msc-chat');
      if (!box || stato.accesso !== true) return;
      nuovaChatHeader.disabled = stato.attesa;
      const messaggi = h('div', { className: 'msc-messaggi', id: 'msc-messaggi', tabIndex: 0 });
      messaggi.setAttribute('role', 'log'); messaggi.setAttribute('aria-label', 'Conversazione con l’assistente'); messaggi.setAttribute('aria-live', 'polite');
      let ultimaRisposta = null;
      for (let i = 0; i < stato.messaggi.length; i++) {
        const m = stato.messaggi[i], assistente = m.ruolo === 'assistente';
        const bolla = h('article', { className: 'msc-messaggio ' + (assistente ? 'msc-risposta' : 'msc-utente') },
          h('b', { className: 'msc-autore', textContent: assistente ? 'Assistente' : 'Tu' }), h('p', { className: 'msc-messaggio-testo', textContent: m.testo }));
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
          h('div', { className: 'msc-esempi' }, esempio('Ho un problema informatico', 'Ho un problema con '), esempio('Cerco un numero di telefono', 'Cerco il numero di '))));
      }
      if (stato.attesa) {
        const attesa = h('p', { className: 'msc-attesa', textContent: 'Sto cercando una risposta…' });
        attesa.setAttribute('role', 'status'); messaggi.append(attesa);
      }
      const campo = h('textarea', { id: 'msc-domanda', rows: 2, maxLength: 1500, value: stato.testo, placeholder: 'Scrivi qui la tua domanda…', disabled: stato.attesa });
      campo.addEventListener('input', () => { stato.testo = campo.value; });
      const invia = h('button', { type: 'submit', className: 'msc-invia', disabled: stato.attesa, textContent: 'Chiedi' });
      const form = h('form', { className: 'msc-chat-form' }, h('label', { className: 'msc-vh', htmlFor: 'msc-domanda', textContent: 'Messaggio per l’assistente' }), campo, invia);
      form.addEventListener('submit', (e) => { e.preventDefault(); if (campo.value.trim().length >= 2) inviaChat({ testo: campo.value.trim() }); });
      campo.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
      const aiuto = h('button', { type: 'button', className: 'msc-aiuto', disabled: stato.attesa },
        icona('M12 20h9M16.5 3.5a2 2 0 0 1 3 3L7 19l-4 1 1-4z'), h('span', { textContent: 'Aiutami a descrivere il problema' }));
      aiuto.addEventListener('click', () => inviaChat({ azione: 'ticket' }));
      const status = h('p', { className: 'msc-chat-errore', textContent: stato.erroreChat });
      status.setAttribute('role', 'status');
      const scrittura = h('div', { className: 'msc-scrittura' }, status, form, aiuto,
        h('small', { className: 'msc-ai-avviso', textContent: 'Suggerimenti da verificare. Nessun campo compilato e nessun ticket inviato.' }));
      const piedi = h('div', { className: 'msc-chat-piedi' }, collega('#faq', 'Guide'), collega('#contatti', 'Contatti'), collega('#nuova', 'Apri una richiesta'));
      box.replaceChildren(messaggi, scrittura, piedi);
      requestAnimationFrame(() => {
        if (!messaggi.isConnected) return;
        messaggi.scrollTop = stato.attesa || !ultimaRisposta ? messaggi.scrollHeight : Math.max(0, ultimaRisposta.offsetTop - 12);
      });
    }

    function disegna() {
      nuovaChatHeader.disabled = stato.accesso !== true || stato.attesa;
      if (stato.accesso === true) {
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
