// Frontend del portale: nessuna dipendenza, tutto il testo utente inserito con textContent
(() => {
  'use strict';
  const BASE = document.querySelector('meta[name=base]').content;
  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, ...figli) => {
    const e = Object.assign(document.createElement(tag), props);
    for (const f of figli) e.append(f);
    return e;
  };
  const SVG = 'http://www.w3.org/2000/svg';
  const icona = (id) => {
    const s = document.createElementNS(SVG, 'svg'); s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS(SVG, 'use'); u.setAttribute('href', '#' + id); s.append(u);
    return s;
  };
  const I = {
    check: 'M5 12.5l4.5 4.5L19 7.5', arrow: 'M5 12h14M13 6l6 6-6 6', flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
    userCheck: 'M9 4.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6 M16 11l2 2 4-4',
    bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
    lock: 'M7 11h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z M8 11V8a4 4 0 0 1 8 0v3',
    thumb: 'M7 11v9H4v-9h3z M7 11l4-7c1.5 0 2.5 1 2.2 2.5L12.7 9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7',
    wrench: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6z',
    user: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M4 21c0-4 3.6-7 8-7s8 3 8 7', chat: 'M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z',
    x: 'M6 6l12 12M18 6L6 18', cal: 'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM4 10h16M8 4v4M16 4v4',
    ticket: 'M4 9V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6zM14 5v14',
    clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', hand: 'M12 12V6.5', sys: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M8 12.5l3 3 5-6',
    tile: 'M12 7v5l3 2', pause: 'M9 5v14M15 5v14'
  };
  // SVG da un tracciato: opzioni { size, sw, cls, path: classe del tracciato, label }
  function ico(d, o = {}) {
    const s = document.createElementNS(SVG, 'svg');
    const z = o.size || 18;
    for (const [k, v] of Object.entries({ width: z, height: z, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': o.sw || 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) s.setAttribute(k, v);
    if (o.label) { s.setAttribute('role', 'img'); s.setAttribute('aria-label', o.label); } else s.setAttribute('aria-hidden', 'true');
    if (o.cls) s.setAttribute('class', o.cls);
    for (const parte of [].concat(d)) {
      const p = document.createElementNS(SVG, 'path'); p.setAttribute('d', parte);
      if (o.path) { p.setAttribute('class', o.path); p.setAttribute('pathLength', '1'); }
      s.append(p);
    }
    return s;
  }
  let me = null;
  let filtro = 'aperte';
  let richieste = [];
  let timer = null;
  let files = [];

  async function api(path, opts = {}) {
    const headers = { Accept: 'application/json', ...(opts.headers || {}) };
    if (opts.method && opts.method !== 'GET') headers['X-CSRF-Token'] = me ? me.csrf : '';
    const r = await fetch(BASE + '/api' + path, { credentials: 'same-origin', ...opts, headers });
    let data = null;
    try { data = await r.json(); } catch { /* corpo vuoto */ }
    if (r.status === 401) { me = null; mostraLogin(); throw new Error('non autenticato'); }
    if (!r.ok) throw new Error((data && data.errore) || 'Errore imprevisto, riprova.');
    return data;
  }

  // ---------- schermate senza login ----------
  function schermata(titolo, testo, azioni) {
    $('app').hidden = true; $('schermata').hidden = false;
    for (const id of ['nav', 'slim-richieste', 'slim-utente', 'esci']) $(id).hidden = true;
    $('schermata-titolo').textContent = titolo;
    $('schermata-testo').replaceChildren(el('p', { textContent: testo }));
    $('schermata-azioni').replaceChildren(...azioni);
  }
  const btnMs = () => {
    const a = el('a', { className: 'ms', href: BASE + '/auth/login' });
    const sq = el('span', { className: 'sq', ariaHidden: 'true' });
    for (const c of ['#f25022', '#7fba00', '#00a4ef', '#ffb900']) { const i = el('i'); i.style.background = c; sq.append(i); }
    a.append(sq, document.body.dataset.accesso || 'Accedi');
    return a;
  };
  function mostraLogin() {
    window.Appearance.clear();
    if (location.hash.startsWith('#richiesta/')) {
      try { sessionStorage.setItem('dopoLogin', location.search + location.hash); } catch { /* ignorato */ }
    }
    const p = location.pathname.replace(BASE, '');
    if (p.startsWith('/non-consentito')) return schermata('Accesso non consentito', 'Il tuo account non è abilitato a usare questo portale. Se pensi sia un errore, contatta l\'assistenza informatica.', [el('a', { className: 'send sec', href: BASE + '/', textContent: 'Torna all\'inizio' })]);
    if (p.startsWith('/errore')) return schermata('Qualcosa non ha funzionato', 'Non siamo riusciti a completare l\'operazione. Riprova tra poco; se il problema continua chiamaci.', [btnMs()]);
    schermata('Benvenuto', 'Accedi con il tuo account di lavoro per aprire una richiesta di assistenza e seguirne lo stato.', [btnMs()]);
  }

  // ---------- viste ----------
  const VISTE = ['nuova', 'richieste', 'dettaglio', 'faq', 'remota', 'link-utili', 'contatti', 'profilo'];
  function vai(v, navId) {
    VISTE.forEach((x) => { $('v-' + x).hidden = x !== v; });
    document.querySelectorAll('#nav a[href^="#"]').forEach((a) => a.removeAttribute('aria-current'));
    const n = $('n-' + (navId || v)); if (n) n.setAttribute('aria-current', 'page');
    clearInterval(timer); timer = null;
    $('main').focus({ preventScroll: true }); window.scrollTo(0, 0);
    document.dispatchEvent(new CustomEvent('portale:vista', { detail: { vista: v } }));
  }

  async function route() {
    if (!me) return;
    const h = location.hash.replace('#', '') || 'nuova';
    if (h === 'nuova') { if (!$('done').hidden) nuovaRichiesta(); vai('nuova'); }
    else if (h === 'richieste') { vai('richieste'); await caricaRichieste(); timer = setInterval(() => caricaRichieste().catch(() => {}), 60000); }
    else if (h.startsWith('richiesta/')) { vai('dettaglio', 'richieste'); await caricaDettaglio(h.split('/')[1]); }
    else if (h === 'faq' || h.startsWith('faq/')) { vai('faq'); await caricaFaq(FaqLogica.idDaHash(h)); }
    else if (h === 'remota') { vai('remota'); }
    else if (h === 'link-utili') { vai('link-utili'); }
    else if (h === 'contatti') { vai('contatti'); await caricaNumeri(); }
    else if (h === 'profilo') { vai('profilo'); }
    else location.hash = '#nuova';
  }

  // ---------- nuova richiesta ----------
  // Frasi guida aggiunte dai bottoni: non contano come testo scritto dall'utente
  const GUIDE = ['Da quando succede:', 'Cosa stavi facendo:', "Messaggio d'errore:"];
  const testoUtile = () => GUIDE.reduce((t, g) => t.split(g).join(''), $('descrizione').value).trim();

  // «Scrivi almeno 15 caratteri.» diventa «Va bene così» con la spunta quando il testo basta
  function aggiornaConta() {
    const n = testoUtile().length, ok = n >= 15;
    $('conta').classList.toggle('ok', ok);
    $('conta-t').textContent = ok ? 'Va bene così' : 'Scrivi almeno 15 caratteri.';
    $('conta-n').textContent = ok ? `${$('descrizione').value.length} / 4000 caratteri` : n ? `(ne mancano ${15 - n})` : '';
    aggiornaProgresso();
  }

  // Consigli prima di inviare: dopo una pausa nella scrittura (min 8 caratteri), al massimo 2 riquadri.
  // Non bloccano mai l'invio.
  let suggerimenti = null;
  let timerConsigli = null;
  const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  async function aggiornaConsigli() {
    const box = $('consigli');
    const testo = norm(testoUtile());
    if (testo.length < 8) { box.hidden = true; box.replaceChildren(); return; }
    if (!suggerimenti) { try { suggerimenti = await api('/suggerimenti'); } catch { suggerimenti = []; } }
    const cat = catScelta();
    const guide = await datiFaq().catch(() => []);
    const trovati = suggerimenti.map((s) => {
      const parole = (s.parole || []).filter((p) => testo.includes(norm(p)));
      return { s, punti: parole.length ? parole.length + (s.categoria === cat ? 2 : 0) : 0 };
    }).filter((x) => x.punti > 0).sort((a, b) => b.punti - a.punti).slice(0, 2);
    // Una voce con "guida" prende titolo e primi passi dalla guida corrispondente (nessun testo duplicato)
    const voci = trovati.map(({ s }) => {
      const g = s.guida && guide.find((x) => x.id === s.guida);
      if (g) return { titolo: g.d, passi: (g.passi.length ? g.passi.map((p) => p.t) : g.controlli).slice(0, 3), link: '#faq/' + g.id };
      return s.titolo ? s : null;
    }).filter(Boolean);
    if (!voci.length) { box.hidden = true; box.replaceChildren(); return; }
    box.replaceChildren(...voci.map((s) => {
      const d = el('div', { className: 'consiglio' }, el('p', { className: 'pre', textContent: 'Prima di inviare, prova così' }), el('p', { className: 'tit', textContent: s.titolo }),
        el('ol', {}, ...(s.passi || []).map((t) => el('li', { textContent: t }))));
      if (s.link) d.append(el('p', {}, el('a', { href: s.link, textContent: 'Leggi la guida' })));
      return d;
    }), el('p', { className: 'ancora', textContent: 'Il problema c\'è ancora? Invia pure la richiesta.' }));
    box.hidden = false;
  }
  function programmaConsigli() { clearTimeout(timerConsigli); timerConsigli = setTimeout(() => aggiornaConsigli().catch(() => {}), 1500); }

  // ---------- stato del modulo: categoria, reperibilita', invio ----------
  let categoria = null, inviata = false;
  const coloreCat = (c) => (c.temaColore ? `var(--cat-${c.temaColore})` : c.colore || 'var(--cat-blu)');
  const catScelta = () => categoria && categoria.id;

  // Avanzamento: (tipo scelto) + (descrizione scritta) + (richiesta inviata); il 4° passo diventa attuale dopo l'invio
  function aggiornaProgresso() {
    const fatti = [!!categoria || inviata, (!!categoria && testoUtile().length >= 15) || inviata, inviata, false];
    const primo = fatti.indexOf(false);
    document.querySelectorAll('#strip .sp').forEach((li, k) => { li.classList.toggle('fatto', fatti[k]); li.classList.toggle('ora', k === primo); });
    window.Temi && window.Temi.progresso(fatti.filter(Boolean).length);
  }

  // Il riquadro si adatta alla categoria scelta: pillola con icona e nome, modulo su due colonne
  // (nessun pulsante o testo preimpostato per categoria: le descrizioni restano sulle caselle)
  function scegliCategoria(c) {
    categoria = c;
    document.querySelectorAll('#tiles .tile').forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.id === c.id)));
    const pill = $('scelta');
    pill.style.setProperty('--c', coloreCat(c));
    $('ci').replaceChildren(icona(c.icona));
    window.Appearance.refresh();
    $('cn').textContent = c.titolo || c.nome;
    pill.hidden = false; $('scegli-prima').hidden = true; $('nr-form').hidden = false;
    $('descrizione').placeholder = c.placeholder || 'Descrivi il problema con parole tue.';
    aggiornaProgresso(); programmaConsigli();
  }
  function annullaCategoria() {
    categoria = null;
    document.querySelectorAll('#tiles .tile').forEach((t) => t.setAttribute('aria-pressed', 'false'));
    $('scelta').hidden = true; $('scegli-prima').hidden = false; $('nr-form').hidden = true;
    aggiornaProgresso();
    const primo = document.querySelector('#tiles .tile'); if (primo) primo.focus();
  }

  function disegnaTile() {
    const box = $('tiles');
    me.categorie.forEach((c, k) => {
      const t = el('button', { type: 'button', className: 'tile' },
        el('span', { className: 'tok' }, ico(I.check, { size: 13, sw: 3.2, path: 'draw' })),
        el('span', { className: 'tico' }, icona(c.icona)),
        el('span', { className: 'tile-t' }, el('b', { textContent: c.titolo || c.nome }), el('small', { textContent: c.sotto || '' })),
        el('span', { className: 'tarrow' }, ico(I.arrow, { size: 20, sw: 2.6 })));
      t.dataset.id = c.id;
      t.setAttribute('aria-pressed', 'false');
      t.style.setProperty('--c', coloreCat(c));
      t.style.animationDelay = (k * 0.06) + 's';
      t.addEventListener('click', () => { scegliCategoria(c); $('descrizione').focus({ preventScroll: true }); $('blocco-form').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
      box.append(t);
    });
  }
  function disegnaAllegati() {
    const ul = $('lista-all'); ul.replaceChildren();
    files.forEach((f, i) => {
      const li = el('li');
      if (f.type.startsWith('image/')) li.append(el('img', { src: URL.createObjectURL(f), alt: '' }));
      li.append(el('span', { className: 'nome', textContent: `${f.name} (${Math.ceil(f.size / 1024)} KB)` }),
        el('button', { type: 'button', textContent: 'Rimuovi', ariaLabel: 'Rimuovi ' + f.name, onclick: () => { files.splice(i, 1); disegnaAllegati(); } }));
      ul.append(li);
    });
  }
  function errore(id, msg) { const e = $(id); e.textContent = msg || ''; e.hidden = !msg; }

  function aggiungiFile(lista) {
    errore('errore-form', '');
    for (const f of lista) {
      if (files.length >= me.limiti.maxFiles) { errore('errore-form', `Puoi allegare al massimo ${me.limiti.maxFiles} file.`); break; }
      if (f.size > me.limiti.maxFileBytes) { errore('errore-form', `«${f.name}» supera i ${Math.round(me.limiti.maxFileBytes / 1048576)} MB.`); continue; }
      if (!/\.(png|jpe?g|pdf|docx|xlsx|txt|zip|msg|eml)$/i.test(f.name)) { errore('errore-form', `«${f.name}»: tipo di file non consentito.`); continue; }
      files.push(f);
    }
    disegnaAllegati();
  }

  // Ctrl+V di un'immagine (es. dopo Win+Maiusc+S): diventa un allegato. Il testo incollato non viene toccato.
  const due = (n) => String(n).padStart(2, '0');
  function nomeScreenshot(ext) {
    const d = new Date();
    const base = `screenshot-${d.getFullYear()}${due(d.getMonth() + 1)}${due(d.getDate())}-${due(d.getHours())}${due(d.getMinutes())}`;
    let nome = `${base}.${ext}`;
    for (let i = 2; files.some((f) => f.name === nome); i++) nome = `${base}-${i}.${ext}`;
    return nome;
  }
  async function inPng(blob) { // formati diversi da PNG/JPEG (es. BMP) convertiti in PNG
    const img = await createImageBitmap(blob);
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return new Promise((ok) => c.toBlob(ok, 'image/png'));
  }
  async function incolla(e) {
    if ($('v-nuova').hidden || !e.clipboardData) return;
    const immagini = [...e.clipboardData.items].filter((i) => i.kind === 'file' && i.type.startsWith('image/')).map((i) => i.getAsFile()).filter(Boolean);
    if (!immagini.length) return; // solo testo: comportamento normale
    e.preventDefault();
    const nuovi = [];
    for (const img of immagini) {
      try {
        let blob = img; let ext = 'png';
        if (img.type === 'image/jpeg') ext = 'jpg';
        else if (img.type !== 'image/png') blob = await inPng(img);
        nuovi.push(new File([blob], nomeScreenshot(ext), { type: ext === 'jpg' ? 'image/jpeg' : 'image/png' }));
      } catch { errore('errore-form', 'Non sono riuscito a leggere l\'immagine incollata: salvala in un file e allegala con «scegli file».'); }
    }
    if (nuovi.length) aggiungiFile(nuovi);
  }

  // «Quando ti troviamo?»: testo libero; i selettori dalle/alle (facoltativi) compongono il testo e colorano la barra 7–19
  const minuti = (v) => { const [h, m] = String(v).split(':').map(Number); return h * 60 + m; };
  function componiFascia() {
    const f = $('rep-dalle').value, t = $('rep-alle').value;
    $('reperibilita').value = f && t ? `dalle ${f} alle ${t}` : f ? `dalle ${f}` : t ? `fino alle ${t}` : '';
    disegnaFascia();
  }
  function disegnaFascia() {
    const f = $('rep-dalle').value, t = $('rep-alle').value, barra = $('fascia-i');
    let da = 0, ampiezza = 0;
    if (f && t && minuti(t) > minuti(f)) {
      da = Math.max(0, Math.min(100, (minuti(f) - 420) / 720 * 100));
      ampiezza = Math.max(0, Math.min(100 - da, (minuti(t) - minuti(f)) / 720 * 100));
    }
    barra.style.setProperty('--da', da.toFixed(1) + '%'); barra.style.setProperty('--amp', ampiezza.toFixed(1) + '%');
  }

  function nuovaRichiesta() {
    inviata = false; files = []; disegnaAllegati();
    for (const id of ['reperibilita', 'rep-dalle', 'rep-alle']) $(id).value = '';
    disegnaFascia();
    $('descrizione').value = ''; aggiornaConta(); $('consigli').hidden = true; $('consigli').replaceChildren();
    $('done').hidden = true; $('parts').replaceChildren();
    annullaCategoria();
  }

  function inizializzaForm() {
    document.addEventListener('paste', incolla);
    $('descrizione').addEventListener('input', aggiornaConta);
    $('descrizione').addEventListener('input', programmaConsigli);
    $('cambia').addEventListener('click', annullaCategoria);
    $('nuova-ancora').addEventListener('click', () => { nuovaRichiesta(); window.scrollTo(0, 0); });
    $('rep-dalle').addEventListener('change', componiFascia);
    $('rep-alle').addEventListener('change', componiFascia);
    document.querySelectorAll('.ex button').forEach((b) => b.addEventListener('click', () => {
      const t = $('descrizione'); const g = b.dataset.g;
      if (!t.value.includes(g.trim())) t.value = (t.value && !t.value.endsWith('\n') ? t.value + '\n' : t.value) + g;
      t.focus(); t.setSelectionRange(t.value.length, t.value.length); aggiornaConta();
    }));
    $('allegati').addEventListener('change', (ev) => { aggiungiFile(ev.target.files); ev.target.value = ''; });
    const drop = $('drop');
    for (const ev of ['dragenter', 'dragover']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); });
    for (const ev of ['dragleave', 'drop']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); });
    drop.addEventListener('drop', (e) => aggiungiFile(e.dataTransfer.files));
    $('form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const btn = $('invia'); if (btn.disabled) return;
      const desc = $('descrizione').value.trim();
      const tel = $('telefono').value.trim();
      if (!categoria) return errore('errore-form', 'Scegli un argomento.');
      if (testoUtile().length < 15) return errore('errore-form', 'Descrivi il problema con almeno 15 caratteri.');
      if (tel && !/^[0-9+()\s./-]{3,25}$/.test(tel)) return errore('errore-form', 'Il numero di telefono non sembra valido.');
      errore('errore-form', '');
      const fd = new FormData();
      fd.append('categoria', categoria.id); fd.append('telefono', tel);
      fd.append('reperibilita', $('reperibilita').value.trim()); fd.append('descrizione', desc);
      files.forEach((f) => fd.append('allegati', f, f.name));
      btn.disabled = true; $('invia-t').textContent = 'Invio in corso…';
      try {
        const r = await api('/richieste', { method: 'POST', body: fd });
        try { localStorage.setItem('tel', tel); } catch { /* ignorato */ }
        $('conf-numero').textContent = '#' + r.id;
        $('conf-riep').textContent = `Argomento: ${categoria.titolo || r.categoria}. Ti terremo aggiornato qui, in «Le mie richieste».`;
        const av = $('conf-avviso'); av.hidden = !r.allegatiFalliti;
        av.textContent = r.allegatiFalliti ? `${r.allegatiFalliti} allegato/i non è stato caricato: rispondi alla richiesta e riprova, oppure chiamaci.` : '';
        inviata = true;
        $('nr-form').hidden = true; $('scegli-prima').hidden = true; $('scelta').hidden = true;
        $('done').hidden = false;
        aggiornaProgresso();
        window.Temi && window.Temi.esplodi();
        $('blocco-form').scrollIntoView({ block: 'nearest' });
        $('nuova-ancora').focus({ preventScroll: true });
      } catch (e) { errore('errore-form', e.message); }
      finally { btn.disabled = false; $('invia-t').textContent = 'Invia richiesta'; }
    });
  }
  // ---------- elenco ----------
  const CLS = { 'In attesa': 'st-attesa', 'In lavorazione': 'st-lav', 'In sospeso': 'st-sosp', Risolta: 'st-ris', Chiusa: 'st-chiu' };
  const SPIEGA = {
    'In attesa': 'Abbiamo ricevuto la tua richiesta, a breve la prenderemo in carico.',
    'In lavorazione': 'Un tecnico sta lavorando alla tua richiesta.',
    'In sospeso': 'La richiesta è ferma in attesa di qualcosa (per esempio una tua risposta o un ricambio).',
    Risolta: 'Il problema risulta risolto. Usa i pulsanti qui sotto per confermare oppure per riaprire la richiesta.',
    Chiusa: 'La richiesta è chiusa. Per un nuovo problema apri una nuova richiesta.'
  };
  // GLPI (PHP con fuso Europe/Rome) restituisce date in ora locale: nessuna conversione
  const parse = (s) => new Date(String(s).replace(' ', 'T'));
  const data = (s) => { const d = parse(s); return isNaN(d) ? '' : d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }); };
  const dataOra = (s) => { const d = parse(s); return isNaN(d) ? '' : d.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }); };

  // Stato nell'elenco: icona, colore della pillola e tappa del mini avanzamento (Aperta, In carico, Soluzione, Chiusa)
  const STATO_LISTA = {
    'In attesa': [I.flag, 'var(--primary)', 1], 'In lavorazione': [I.userCheck, 'var(--accent)', 2], 'In sospeso': [I.pause, 'var(--cat-arancio)', 2],
    Risolta: [I.bulb, 'var(--cat-verde)', 3], Chiusa: [I.lock, 'var(--muted)', 4]
  };
  // La categoria e' il prefisso «[Nome]» che il portale mette nel titolo; senza prefisso noto: icona «Altro»
  function catDaTitolo(t) {
    const m = /^\[([^\]]+)\]\s*/.exec(t || '');
    const c = m && me.categorie.find((x) => x.nome === m[1]);
    return c ? { c, titolo: t.slice(m[0].length) } : { c: null, titolo: t };
  }
  // «Risolta» resta tra le aperte finche' il richiedente non conferma (badge «Conferma»)
  const aperta = (r) => !r.chiusa || r.stato === 'Risolta';
  const dataOraLista = (s) => (data(s) ? `${data(s)}, ${hhmm(s)}` : '');
  async function caricaRichieste() {
    richieste = (await api('/richieste')).slice().sort((a, b) => parse(b.aggiornata) - parse(a.aggiornata));
    disegnaRichieste();
    const cd = $('cd'); cd.classList.remove('cd'); cd.getBoundingClientRect(); cd.classList.add('cd'); // anello dei 60 secondi da capo
  }
  function disegnaRichieste() {
    const n = { aperte: richieste.filter(aperta).length, tutte: richieste.length };
    n.chiuse = n.tutte - n.aperte;
    document.querySelectorAll('[data-cnt]').forEach((x) => { x.textContent = n[x.dataset.cnt]; });
    const l = richieste.filter((r) => filtro === 'tutte' || (filtro === 'aperte' ? aperta(r) : !aperta(r)));
    $('righe').replaceChildren(...l.map((r, k) => {
      const { c, titolo } = catDaTitolo(r.titolo);
      const [sIco, sCol, tappa] = STATO_LISTA[r.stato] || STATO_LISTA['In attesa'];
      const a = el('a', { className: 'lrow', href: '#richiesta/' + r.id });
      a.style.setProperty('--c', c ? coloreCat(c) : 'var(--cat-grigio)'); a.style.setProperty('--sc', sCol); a.style.animationDelay = (k * 0.07) + 's';
      const stato = el('span', { className: 'lr-stw' }, el('span', { className: 'lr-stato' }, ico(sIco, { size: 16, sw: 2.3 }), r.stato));
      if (r.stato === 'Risolta') stato.append(el('span', { className: 'lr-conf', textContent: 'Conferma' }));
      const mini = el('span', { className: 'lr-mini', ariaHidden: 'true' });
      for (let i = 1; i <= 4; i++) { if (i > 1) mini.append(el('i', { className: tappa >= i ? 'on' : '' })); mini.append(el('b', { className: tappa >= i ? 'on' : '' })); }
      const lbl = (t) => el('span', { className: 'lr-lbl', textContent: t + ' ' });
      a.append(
        el('span', { className: 'lr-n' }, lbl('N.'), '#' + r.id),
        el('span', { className: 'lr-ogg' }, el('span', { className: 'lr-ico' }, icona(c ? c.icona : 'ot')),
          el('span', { className: 'lr-ot' }, el('b', { textContent: titolo }), el('small', { textContent: c ? c.titolo || c.nome : '' }))),
        el('span', { className: 'lr-d' }, ico(I.cal, { size: 17 }), lbl('Aperta il'), data(r.aperta)),
        el('span', { className: 'lr-d' }, ico([I.clock, I.tile], { size: 17 }), lbl('Ultimo aggiornamento'), dataOraLista(r.aggiornata)),
        el('span', { className: 'lr-st' }, stato, mini));
      return el('li', {}, a);
    }));
    $('vuoto').hidden = l.length > 0;
  }

  // ---------- dettaglio: avanzamento e conversazione ----------
  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const hhmm = (s) => { const d = parse(s); return isNaN(d) ? '' : d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); };
  const giorno = (s) => { const d = parse(s); return isNaN(d) ? '' : `${d.getDate()} ${MESI[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`; };
  const AZ = {
    apertura: ['ha aperto la richiesta', I.flag], presa: ['ha preso in carico la richiesta', I.userCheck], soluzione: ['ha proposto una soluzione', I.bulb],
    approvazione: ['ha approvato la soluzione', I.thumb], rifiuto: ['non ha approvato la soluzione', I.x], messaggio: ['ha scritto', I.chat],
    attivita: ['ha registrato un\'attività', I.wrench], chiusura: ['La richiesta è stata chiusa', I.lock]
  };
  const RUOLI = { tecnico: ['Tecnico', I.wrench], tu: ['Tu', I.user], richiedente: ['Richiedente', I.user] };
  const TAPPE = { aperta: ['Aperta', I.flag], carico: ['In carico', I.userCheck], soluzione: ['Soluzione', I.bulb], chiusa: ['Chiusa', I.lock] };
  const elencoNomi = (n) => (n.length <= 1 ? n.join('') : n.length <= 3 ? n.slice(0, -1).join(', ') + ' e ' + n.at(-1) : `${n[0]}, ${n[1]} e altri ${n.length - 2}`);

  // Foto se c'e', altrimenti iniziali (cerchio blu, lettere bianche). taglia: '', 'm' (20px) o 'l' (36px)
  function avatarEl(p, taglia = '', badge = false) {
    const a = el('span', { className: 'pav' + (taglia ? ' ' + taglia : '') + (p.ruolo === 'tecnico' ? '' : ' tu') });
    const ini = el('span', { className: 'ini', textContent: p.iniziali });
    a.setAttribute('role', 'img'); a.setAttribute('aria-label', (p.foto ? 'Foto di ' : 'Iniziali di ') + p.nome);
    if (p.foto) {
      const img = el('img', { alt: '', decoding: 'async', loading: 'lazy' });
      img.addEventListener('error', () => img.replaceWith(ini));
      img.src = p.foto; a.append(img);
    } else a.append(ini);
    if (badge) { const r = RUOLI[p.ruolo]; a.append(el('span', { className: 'ruolo', title: r[0] }, ico(r[1], { size: 9, sw: 3 }))); }
    return a;
  }

  let corrente = null;
  async function caricaDettaglio(id) {
    try {
      const d = await api('/richieste/' + encodeURIComponent(id));
      corrente = d;
      const P = (pid) => d.persone[pid];
      $('d-titolo').textContent = d.titolo;
      $('d-pdf').href = `${BASE}/api/richieste/${d.id}/pdf`;
      $('d-pdf').setAttribute('download', `richiesta-${d.id}.pdf`);
      // riga meta
      const stato = el('span', { className: 'stato ' + (CLS[d.stato] || '') });
      if (d.stato === 'Chiusa') stato.append(ico(I.lock, { size: 15, sw: 2.2, cls: 'bob' }));
      stato.append(d.stato);
      const tecnici = d.gestitaDa.map(P).filter(Boolean);
      const gestita = el('span', { className: 'gestita', title: tecnici.length ? 'Gestita da ' + elencoNomi(tecnici.map((t) => t.nome)) : 'In attesa di presa in carico' });
      if (tecnici.length) {
        const avs = el('span', { className: 'avs' }, ...tecnici.slice(0, 3).map((t) => avatarEl(t)));
        const testo = el('span', {}, 'Gestita da ');
        const nomi = tecnici.map((t) => t.nome);
        const mostra = nomi.length <= 3 ? nomi : [nomi[0], nomi[1]];
        mostra.forEach((n, i) => { if (i) testo.append(i === mostra.length - 1 && nomi.length <= 3 ? ' e ' : ', '); testo.append(el('b', { textContent: n })); });
        if (nomi.length > 3) testo.append(` e altri ${nomi.length - 2}`);
        gestita.append(avs, testo);
      } else gestita.append(ico(I.userCheck, { size: 16 }), 'In attesa di presa in carico');
      const clock = ico([I.clock, I.hand], { size: 18 }); clock.lastChild.setAttribute('class', 'hand');
      $('d-meta').replaceChildren(
        el('span', { className: 'tk-num' }, ico(I.ticket, { size: 18 }), '#' + d.id), stato,
        el('span', {}, ico(I.cal, { size: 17 }), 'aperta il ' + data(d.aperta)),
        el('span', { title: 'Durata complessiva' }, clock, d.durata || 'In corso'), gestita);
      // avanzamento a 4 tappe: solo quelle avvenute sono colorate; l'ultima avvenuta e' oro con alone
      const ultima = d.tappe.map((t) => t.fatta).lastIndexOf(true);
      $('d-steps').replaceChildren(...d.tappe.map((t, k) => {
        const li = el('li', { className: 'st' + (t.fatta ? ' ok' : '') + (k === ultima && t.id === 'chiusa' ? ' ultimo' : '') });
        li.style.setProperty('--d', (k * 0.5) + 's'); li.style.setProperty('--ld', (k * 0.5 + 0.3) + 's');
        if (k < 3) { const line = el('span', { className: 'st-line' }); if (t.fatta && d.tappe[k + 1].fatta) line.append(el('i')); li.append(line); }
        const info = el('small', {});
        if (t.fatta && t.chi && P(t.chi)) info.append(avatarEl(P(t.chi), 'm'));
        info.append(t.fatta ? hhmm(t.data) : '—');
        li.append(el('span', { className: 'st-dot' }, ico(TAPPE[t.id][1], { size: 18, sw: 2.2, path: 'd' })), el('b', { textContent: TAPPE[t.id][0] }), info);
        return li;
      }));
      $('d-stato-testo').textContent = d.stato === 'Chiusa' ? '' : SPIEGA[d.stato] || '';
      // conversazione: tecnici a sinistra, tu a destra, sistema al centro; separatore a ogni nuovo giorno
      const righe = [];
      let ieri = '';
      if (d.stato === 'Chiusa') righe.push(el('div', { className: 'chiusa' }, ico(I.lock, { size: 22, sw: 2.2, cls: 'bob' }), 'La richiesta è chiusa. Per un nuovo problema apri una nuova richiesta.'));
      d.eventi.forEach((e, k) => {
        const g = giorno(e.data);
        if (g && g !== ieri) { ieri = g; righe.push(el('div', { className: 'sep' }, el('span', {}, ico(I.cal, { size: 15 }), g))); }
        const [frase, icona2] = AZ[e.tipo];
        if (e.tipo === 'chiusura' || !e.chi || !P(e.chi)) {
          righe.push(el('div', { className: 'sis', role: 'listitem' }, el('span', {}, ico(e.tipo === 'chiusura' ? I.lock : I.sys, { size: 16, sw: 2.2, cls: 'bob' }), `${e.tipo === 'chiusura' ? frase : 'Aggiornamento'} · ${hhmm(e.data)}`)));
          return;
        }
        const p = P(e.chi);
        const m = el('div', { className: 'msg ' + (p.ruolo === 'tecnico' ? 'tec' : 'tu'), role: 'listitem' });
        m.style.setProperty('--d', (k * 0.12) + 's');
        const bolla = el('div', { className: 'bubble' }, el('div', { className: 'b-h' },
          el('strong', { textContent: p.nome }), el('span', { className: 'badge', textContent: RUOLI[p.ruolo][0] }),
          el('span', { className: 'azione' }, ico(icona2, { size: 16, sw: 2.2, path: 'd' }), frase),
          el('time', { className: 'ora', textContent: hhmm(e.data), dateTime: String(e.data || '').replace(' ', 'T') })));
        const testo = e.tipo === 'apertura' ? d.descrizione : e.testo;
        if (testo) bolla.append(el('div', { className: 'b-t', textContent: testo }));
        m.append(el('div', { className: 'msg-r' }, avatarEl(p, 'l', true), bolla));
        righe.push(m);
      });
      $('d-thread').replaceChildren(...righe);
      $('form-msg').hidden = d.chiusa; $('form-msg').dataset.id = d.id;
      mostraEsito(d);
      errore('errore-msg', '');
      preparaStampa(d);
    } catch (e) { location.hash = '#richieste'; }
  }

  // ---------- stampa: riepilogo A4 in bianco e nero (stessi dati del PDF) ----------
  function preparaStampa(d) {
    const P = (pid) => d.persone[pid];
    const nome = (pid) => (pid && P(pid) ? P(pid).nome : 'Sistema');
    const tu = Object.values(d.persone).find((p) => p.ruolo === 'tu');
    const tess = [['Durata', d.durata || 'In corso'], ['In carico dopo', d.inCaricoDopo || '—'], ['Gestita da', elencoNomi(d.gestitaDa.map(nome)) || 'In attesa'],
      ['Data', data(d.aperta)], ['Aggiornamenti', String(d.aggiornamenti)], ['Chiusa alle', d.stato === 'Chiusa' ? hhmm(d.chiusaIl) : 'In corso']];
    const AZS = { apertura: 'Aperta', presa: 'In carico', messaggio: 'Messaggio', attivita: 'Attività', soluzione: 'Soluzione', approvazione: 'Approvata', rifiuto: 'Non approvata', chiusura: 'Chiusa' };
    const multi = new Set(d.eventi.map((e) => data(e.data))).size > 1;
    const adesso = new Date();
    $('stampa').replaceChildren(
      el('div', { className: 'pr-h' }, el('b', { textContent: document.querySelector('.center h1').textContent.trim() }), el('span', { className: 'pr-n', textContent: '#' + d.id })),
      el('h1', { className: 'pr-t', textContent: d.titolo }),
      el('p', { className: 'pr-s' }, el('span', { className: 'pr-pill', textContent: d.stato }), tu ? ' Richiedente: ' + tu.nome : ''),
      el('ol', { className: 'pr-tl' }, ...d.tappe.map((t) => el('li', { className: t.fatta ? 'ok' : '' }, el('b', { textContent: TAPPE[t.id][0] }), el('span', { textContent: t.fatta ? hhmm(t.data) : '—' })))),
      el('div', { className: 'pr-tess' }, ...tess.map(([e, v]) => el('div', {}, el('b', { textContent: v }), el('small', { textContent: e })))),
      el('h2', { textContent: 'Richiesta' }), el('p', { className: 'pr-desc', textContent: d.descrizione || '—' }),
      el('h2', { textContent: 'Cronologia' }),
      el('table', { className: 'pr-tab' }, el('thead', {}, el('tr', {}, el('th', { textContent: 'Ora' }), el('th', { textContent: 'Chi' }), el('th', { textContent: 'Azione' }))),
        el('tbody', {}, ...d.eventi.map((e) => el('tr', {}, el('td', { textContent: (multi ? data(e.data).slice(0, 5) + ' ' : '') + hhmm(e.data) }),
          el('td', { textContent: e.chi ? `${nome(e.chi)} (${RUOLI[P(e.chi).ruolo][0]})` : 'Sistema' }),
          el('td', {}, el('b', { textContent: AZS[e.tipo] }), e.testo && e.tipo !== 'chiusura' ? el('div', { textContent: e.testo }) : ''))))),
      el('div', { className: 'pr-piede', textContent: `${adesso.toLocaleDateString('it-IT')} ${adesso.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · generato da ${me.nome}` }));
  }
  function stampa() {
    if (!corrente) return;
    const titolo = document.title;
    // titolo = nome proposto da «Salva come PDF»
    const slug = String(corrente.titolo).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
    document.title = `richiesta-${corrente.id}-${slug}`;
    window.addEventListener('afterprint', () => { document.title = titolo; }, { once: true });
    window.print();
  }

  // ---------- conferma della soluzione (pulsanti «Risolto, grazie» / «Non è risolto, riapri», anche dalla mail)
  const azioneUrl = () => new URLSearchParams(location.search).get('azione');
  let esitoScelto = null;
  function chiediConferma(esito) {
    esitoScelto = esito;
    $('esito-domanda').textContent = esito === 'risolto'
      ? 'Confermi che il problema è risolto? La richiesta verrà chiusa.'
      : 'Confermi che il problema NON è risolto? La richiesta tornerà al tecnico.';
    $('esito-ok').textContent = esito === 'risolto' ? 'Sì, è risolto' : 'Sì, riapri la richiesta';
    $('esito-scelta').hidden = true; $('esito-conferma').hidden = false;
    $('esito-ok').focus();
  }
  function mostraEsito(d) {
    const box = $('esito'); errore('errore-esito', '');
    box.dataset.id = d.id;
    box.hidden = d.stato !== 'Risolta';
    $('esito-domanda').textContent = 'La richiesta risulta risolta. È tutto a posto?';
    $('esito-scelta').hidden = false; $('esito-conferma').hidden = true; esitoScelto = null;
    const a = azioneUrl();
    if (a === 'risolto' || a === 'riapri') {
      history.replaceState(null, '', location.pathname + location.hash); // l'azione dalla mail si usa una sola volta
      if (d.stato === 'Risolta') chiediConferma(a);
      else $('d-stato-testo').textContent = 'Questa richiesta non è più in attesa di conferma (stato: ' + d.stato + ').';
    }
  }
  function inizializzaEsito() {
    document.querySelectorAll('#esito-scelta button').forEach((b) => b.addEventListener('click', () => chiediConferma(b.dataset.esito)));
    $('esito-annulla').addEventListener('click', () => { $('esito-scelta').hidden = false; $('esito-conferma').hidden = true; $('esito-domanda').textContent = 'La richiesta risulta risolta. È tutto a posto?'; });
    $('esito-ok').addEventListener('click', async () => {
      const b = $('esito-ok'); if (b.disabled || !esitoScelto) return;
      b.disabled = true;
      try {
        await api(`/richieste/${$('esito').dataset.id}/esito`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ esito: esitoScelto }) });
        await caricaDettaglio($('esito').dataset.id);
      } catch (e) { errore('errore-esito', e.message); } finally { b.disabled = false; }
    });
  }

  // ---------- guide (FAQ) ----------
  // Dati letti una volta sola; il formato vecchio { d, r } e quello esteso sono normalizzati da FaqLogica
  let faqVoci = null;
  async function datiFaq() {
    if (!faqVoci) faqVoci = FaqLogica.normalizza(await api('/faq'));
    return faqVoci;
  }
  const faq = { q: '', cat: 'tutte', pronta: false };

  function figura(p, n) {
    const img = el('img', { src: BASE + '/' + p.img, alt: p.alt, loading: 'lazy', decoding: 'async' });
    if (p.w && p.h) { img.width = p.w; img.height = p.h; }
    const b = el('button', { type: 'button', className: 'faq-img', title: 'Ingrandisci l\'immagine' }, img, el('span', { className: 'vh', textContent: ' Ingrandisci l\'immagine del passo ' + n }));
    b.addEventListener('click', () => {
      $('faq-zoom-img').src = img.src; $('faq-zoom-img').alt = p.alt;
      $('faq-zoom-didascalia').textContent = p.alt;
      $('faq-zoom').showModal();
    });
    return el('figure', { className: 'faq-fig' }, b);
  }

  function blocco(classe, titolo, ...contenuto) {
    return el('div', { className: 'faq-blocco ' + classe }, el('h4', { textContent: titolo }), ...contenuto);
  }

  function disegnaGuida(v, nomeCat) {
    const corpo = el('div', { className: 'faq-corpo' });
    if (v.intro) corpo.append(el('p', { className: 'faq-intro', textContent: v.intro }));
    if (v.controlli.length) corpo.append(blocco('faq-controlli', 'Prima controlla', el('ul', {}, ...v.controlli.map((t) => el('li', { textContent: t })))));
    if (v.passi.length) {
      corpo.append(blocco('faq-passi', 'Cosa fare', el('ol', {}, ...v.passi.map((p, i) => {
        const li = el('li', {}, el('span', { textContent: p.t }));
        if (p.nota) li.append(el('small', { className: 'faq-nota', textContent: p.nota }));
        if (p.img) li.append(figura(p, i + 1));
        return li;
      }))));
    }
    if (v.r) corpo.append(el('p', { className: 'faq-testo', textContent: v.r }));
    if (v.ok) corpo.append(blocco('faq-ok', 'Cosa dovresti vedere', el('p', { textContent: v.ok })));
    if (v.stop) corpo.append(blocco('faq-stop', 'Quando fermarti', el('p', { textContent: v.stop })));
    if (v.richiesta) corpo.append(blocco('faq-richiesta', 'Quando aprire una richiesta', el('p', { textContent: v.richiesta }), el('p', {}, el('a', { className: 'send', href: '#nuova', textContent: 'Apri una richiesta' }))));
    const col = v.vedi.map((id) => faqVoci.find((x) => x.id === id)).filter(Boolean);
    if (col.length) corpo.append(el('p', { className: 'faq-vedi' }, 'Guide collegate: ', ...col.flatMap((g, i) => [i ? ' · ' : '', el('a', { href: '#faq/' + g.id, textContent: g.d })])));
    corpo.append(el('p', { className: 'faq-link' }, el('a', { href: '#faq/' + v.id, textContent: 'Link diretto a questa guida' })));
    const d = el('details', { id: 'g-' + v.id }, el('summary', {}, el('span', { textContent: v.d }), el('small', { className: 'faq-cat', textContent: nomeCat })), corpo);
    d.addEventListener('toggle', () => { // l'indirizzo segue la guida aperta, così si può copiare e inviare
      const mio = '#faq/' + v.id;
      if (d.open) history.replaceState(null, '', mio);
      else if (location.hash === mio) history.replaceState(null, '', '#faq');
    });
    return d;
  }

  function applicaFiltri() {
    // con una ricerca le guide più pertinenti vanno in alto; senza, resta l'ordine del file
    const trovate = FaqLogica.filtra(faqVoci, faq.q, faq.cat);
    const ids = new Set(trovate.map((v) => v.id));
    const resto = faqVoci.filter((v) => !ids.has(v.id));
    $('faq-lista').append(...[...trovate, ...resto].map((v) => $('g-' + v.id)));
    for (const v of faqVoci) $('g-' + v.id).hidden = !ids.has(v.id);
    $('faq-vuoto').hidden = ids.size > 0;
    $('faq-conta').textContent = ids.size === faqVoci.length ? `${faqVoci.length} guide` : `${ids.size} ${ids.size === 1 ? 'guida trovata' : 'guide trovate'}`;
  }

  function impostaCategoria(c) {
    faq.cat = c;
    document.querySelectorAll('.faq-chip').forEach((b) => { const on = b.dataset.cat === c; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  }

  function costruisciFaq() {
    const cats = FaqLogica.categorie(faqVoci);
    const nomi = Object.fromEntries(cats.map((c) => [c.id, c.nome]));
    $('faq-lista').replaceChildren(...faqVoci.map((v) => disegnaGuida(v, nomi[v.cat])));
    const chips = [{ id: 'tutte', nome: 'Tutte' }, ...cats].map((c) => {
      const b = el('button', { type: 'button', className: 'filtro faq-chip', textContent: c.nome });
      b.dataset.cat = c.id; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => { impostaCategoria(c.id); applicaFiltri(); });
      return b;
    });
    $('faq-chips').replaceChildren(...chips);
    $('faq-cerca').addEventListener('input', (e) => { faq.q = e.target.value; applicaFiltri(); });
    $('faq-zoom-chiudi').addEventListener('click', () => $('faq-zoom').close());
    $('faq-zoom').addEventListener('click', (e) => { if (e.target === $('faq-zoom')) $('faq-zoom').close(); }); // clic sullo sfondo
    faq.pronta = true;
  }

  async function caricaFaq(id) {
    $('faq-errore').hidden = true;
    try { await datiFaq(); } catch { $('faq-errore').hidden = false; return; }
    if (!faq.pronta) { costruisciFaq(); impostaCategoria('tutte'); }
    const g = id && faqVoci.find((x) => x.id === id);
    if (g) { faq.q = ''; $('faq-cerca').value = ''; impostaCategoria('tutte'); } // il link diretto vince su ricerca e filtro
    applicaFiltri();
    if (!id) return;
    if (!g) { $('faq-conta').textContent = 'Questa guida non esiste più: ecco l\'elenco aggiornato.'; return; }
    const d = $('g-' + id);
    d.open = true;
    d.scrollIntoView({ block: 'start' });
    d.querySelector('summary').focus({ preventScroll: true });
  }

  // ---------- numeri interni (sotto Contatti; senza dati la sezione resta nascosta) ----------
  const numeri = { sezioni: null, q: '', sez: 'tutte', pronti: false };

  function voceNumero(v) {
    const li = el('li', { className: 'nu-voce' + (v.esterno ? ' nu-ext' : '') });
    const chi = el('span', { className: 'nu-chi' }, el('span', { className: 'nu-nome', textContent: v.nome }));
    if (v.nota) chi.append(el('small', { className: 'nu-nota', textContent: v.nota }));
    if (v.cellulare) chi.append(el('small', { className: 'nu-cell' }, 'Cellulare ', el('a', { href: 'tel:' + v.cellulare, textContent: NumeriInterni.formattaCellulare(v.cellulare), ariaLabel: 'Chiama il cellulare di ' + v.nome })));
    if (v.esterno) chi.append(el('small', { className: 'nu-badge', textContent: 'Anche per gli utenti esterni' }));
    li.append(chi, el('strong', { className: 'nu-num', textContent: v.numero }));
    return li;
  }

  function disegnaNumeri() {
    const trovate = NumeriInterni.filtra(numeri.sezioni, numeri.q, numeri.sez);
    const n = NumeriInterni.conta(trovate), tot = NumeriInterni.conta(numeri.sezioni);
    $('nu-elenco').replaceChildren(...trovate.map((s) => el('section', { className: 'nu-sez' },
      el('h4', { textContent: s.titolo }),
      el('ul', { className: 'nu-lista', ariaLabel: s.titolo }, ...s.voci.map(voceNumero)))));
    $('nu-vuoto').hidden = n > 0;
    $('nu-conta').textContent = n === tot ? `${tot} numeri` : `${n} ${n === 1 ? 'numero trovato' : 'numeri trovati'}`;
  }

  function impostaSezioneNumeri(id) {
    numeri.sez = id;
    document.querySelectorAll('.nu-chip').forEach((b) => { const on = b.dataset.sez === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  }

  async function caricaNumeri() {
    let dati;
    try { dati = await api('/numeri-interni'); } catch { return; } // dato accessorio: se non arriva, la sezione non compare
    numeri.sezioni = Array.isArray(dati.sezioni) ? dati.sezioni : [];
    $('nu-box').hidden = !numeri.sezioni.length;
    if (!numeri.sezioni.length) return;
    $('nu-agg').textContent = dati.aggiornato ? 'Elenco aggiornato al ' + new Date(dati.aggiornato + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) + '.' : '';
    // Il file può cambiare mentre la pagina è aperta: i filtri si ricostruiscono a ogni caricamento
    if (numeri.sez !== 'tutte' && !numeri.sezioni.some((x) => x.id === numeri.sez)) numeri.sez = 'tutte';
    $('nu-chips').replaceChildren(...[{ id: 'tutte', titolo: 'Tutti' }, ...numeri.sezioni].map((c) => {
      const b = el('button', { type: 'button', className: 'filtro nu-chip', textContent: c.titolo });
      b.dataset.sez = c.id; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => { impostaSezioneNumeri(c.id); disegnaNumeri(); });
      return b;
    }));
    if (!numeri.pronti) {
      $('nu-cerca').addEventListener('input', (e) => { numeri.q = e.target.value; disegnaNumeri(); });
      numeri.pronti = true;
    }
    impostaSezioneNumeri(numeri.sez);
    disegnaNumeri();
  }

  // ---------- avvio ----------
  async function avvio() {
    document.querySelectorAll('.lr-filtri .filtro').forEach((b) => b.addEventListener('click', () => {
      filtro = b.dataset.f;
      document.querySelectorAll('.lr-filtri .filtro').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
      disegnaRichieste();
    }));
    $('esci').addEventListener('click', async () => {
      window.Appearance.clear();
      try { const r = await api('/../auth/logout', { method: 'POST' }); location.href = r.redirect; } catch { location.href = BASE + '/'; }
    });
    $('d-stampa').addEventListener('click', stampa);
    // Novità della versione: si apre sopra il piè di pagina, si chiude cliccando fuori o con Esc
    const ver = $('ver'), nov = $('novita');
    const novita = (si) => { nov.hidden = !si; ver.setAttribute('aria-expanded', String(si)); };
    const chiudiNovita = $('novita-chiudi');
    ver.addEventListener('click', (e) => { e.stopPropagation(); novita(nov.hidden); if (!nov.hidden) chiudiNovita.focus(); });
    chiudiNovita.addEventListener('click', () => { novita(false); ver.focus(); });
    document.addEventListener('click', (e) => { if (!nov.hidden && !nov.contains(e.target)) novita(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !nov.hidden) { novita(false); ver.focus(); } });
    $('form-msg').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const b = $('invia-msg'); if (b.disabled) return;
      const testo = $('msg').value.trim(); if (testo.length < 2) return errore('errore-msg', 'Scrivi il messaggio.');
      b.disabled = true;
      try { await api(`/richieste/${$('form-msg').dataset.id}/messaggi`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ testo }) }); $('msg').value = ''; await caricaDettaglio($('form-msg').dataset.id); }
      catch (e) { errore('errore-msg', e.message); } finally { b.disabled = false; }
    });
    try {
      me = await api('/me');
    } catch { return; }
    window.Appearance.init(api, me.appearance);
    if (!me) return;
    $('schermata').hidden = true; $('app').hidden = false;
    for (const id of ['nav', 'slim-richieste', 'slim-utente', 'esci']) $(id).hidden = false;
    $('slim-utente').textContent = me.nome; $('slim-utente').title = me.email;
    $('aspetto').hidden = false;
    $('profilo-nome').textContent = me.nome; $('profilo-email').textContent = me.email;
    disegnaTile(); inizializzaForm(); aggiornaProgresso();
    window.Appearance.refresh();
    $('aiuto-all').textContent = `Fino a ${me.limiti.maxFiles} file, ${Math.round(me.limiti.maxFileBytes / 1048576)} MB ciascuno (immagini, PDF, Word, Excel, testo, zip, e-mail).`;
    try { $('telefono').value = localStorage.getItem('tel') || ''; } catch { /* ignorato */ }
    if (/\/(errore|non-consentito)$/.test(location.pathname)) history.replaceState(null, '', BASE + '/');
    inizializzaEsito();
    try { // ritorno dal login: riapre la richiesta (e l'eventuale azione) arrivata dalla mail
      const dopo = sessionStorage.getItem('dopoLogin'); sessionStorage.removeItem('dopoLogin');
      if (dopo && !location.hash) history.replaceState(null, '', BASE + '/' + dopo);
    } catch { /* ignorato */ }
    window.addEventListener('hashchange', () => route().catch((e) => console.warn(e.message)));
    route().catch((e) => console.warn(e.message));
  }
  avvio();
})();
