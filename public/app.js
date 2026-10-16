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
  const VISTE = ['nuova', 'conferma', 'richieste', 'dettaglio', 'faq', 'contatti', 'profilo'];
  function vai(v, navId) {
    VISTE.forEach((x) => { $('v-' + x).hidden = x !== v; });
    document.querySelectorAll('#nav a[href^="#"]').forEach((a) => a.removeAttribute('aria-current'));
    const n = $('n-' + (navId || v)); if (n) n.setAttribute('aria-current', 'page');
    clearInterval(timer); timer = null;
    $('main').focus({ preventScroll: true }); window.scrollTo(0, 0);
  }

  async function route() {
    if (!me) return;
    const h = location.hash.replace('#', '') || 'nuova';
    if (h === 'nuova') { vai('nuova'); }
    else if (h === 'richieste') { vai('richieste'); await caricaRichieste(); timer = setInterval(() => caricaRichieste().catch(() => {}), 60000); }
    else if (h.startsWith('richiesta/')) { vai('dettaglio', 'richieste'); await caricaDettaglio(h.split('/')[1]); }
    else if (h === 'faq' || h.startsWith('faq/')) { vai('faq'); await caricaFaq(FaqLogica.idDaHash(h)); }
    else if (h === 'contatti') { vai('contatti'); }
    else if (h === 'profilo') { vai('profilo'); }
    else location.hash = '#nuova';
  }

  // ---------- nuova richiesta ----------
  // Frasi guida aggiunte dai bottoni: non contano come testo scritto dall'utente
  const GUIDE = ['Da quando succede:', 'Cosa stavi facendo:', "Messaggio d'errore:"];
  const testoUtile = () => GUIDE.reduce((t, g) => t.split(g).join(''), $('descrizione').value).trim();

  function aggiornaConta() {
    const n = testoUtile().length;
    $('conta').textContent = n < 15 ? `Scrivi almeno 15 caratteri (ne mancano ${15 - n}).` : `${$('descrizione').value.length} / 4000 caratteri`;
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
    const cat = (document.querySelector('input[name=categoria]:checked') || {}).value;
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

  // Il modulo si colora come la categoria scelta e mostra icona, nome e suggerimento
  function scegliCategoria(c) {
    const f = $('blocco-form');
    f.style.setProperty('--c', c.colore || '#005e8e');
    $('ci').replaceChildren(icona(c.icona));
    window.Appearance.refresh();
    $('cn').textContent = c.titolo || c.nome;
    $('scelta').hidden = false; $('scegli-prima').hidden = true;
    $('descrizione').placeholder = c.placeholder || 'Descrivi il problema con parole tue.';
  }

  function disegnaTile() {
    const box = $('tiles');
    for (const c of me.categorie) {
      const id = 'cat-' + c.id;
      const card = el('div', { className: 'card' },
        el('span', { className: 'ic' }, icona(c.icona)),
        el('b', { textContent: c.titolo || c.nome }),
        el('small', { textContent: c.sotto }),
        el('span', { className: 'go', textContent: 'Scegli' }));
      const t = el('label', { className: 'tile', htmlFor: id }, el('input', { type: 'radio', name: 'categoria', value: c.id, id, required: true }), card);
      t.style.setProperty('--c', c.colore || '#005e8e');
      t.addEventListener('pointermove', (e) => { const r = t.getBoundingClientRect(); t.style.setProperty('--x', e.clientX - r.left + 'px'); t.style.setProperty('--y', e.clientY - r.top + 'px'); });
      t.querySelector('input').addEventListener('change', () => { scegliCategoria(c); programmaConsigli(); });
      box.append(t);
    }
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

  function inizializzaForm() {
    document.addEventListener('paste', incolla);
    $('descrizione').addEventListener('input', aggiornaConta);
    $('descrizione').addEventListener('input', programmaConsigli);
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
      const cat = document.querySelector('input[name=categoria]:checked');
      const desc = $('descrizione').value.trim();
      const tel = $('telefono').value.trim();
      if (!cat) return errore('errore-form', 'Scegli un argomento.');
      if (testoUtile().length < 15) return errore('errore-form', 'Descrivi il problema con almeno 15 caratteri.');
      if (tel && !/^[0-9+()\s./-]{3,25}$/.test(tel)) return errore('errore-form', 'Il numero di telefono non sembra valido.');
      errore('errore-form', '');
      const fd = new FormData();
      fd.append('categoria', cat.value); fd.append('telefono', tel); fd.append('reperibilita', $('reperibilita').value.trim()); fd.append('descrizione', desc);
      files.forEach((f) => fd.append('allegati', f, f.name));
      btn.disabled = true; btn.textContent = 'Invio in corso…';
      try {
        const r = await api('/richieste', { method: 'POST', body: fd });
        try { localStorage.setItem('tel', tel); } catch { /* ignorato */ }
        $('conf-numero').textContent = '#' + r.id;
        $('conf-riep').textContent = `Argomento: ${r.categoria}. Ti terremo aggiornato qui, in «Le mie richieste».`;
        const av = $('conf-avviso'); av.hidden = !r.allegatiFalliti;
        av.textContent = r.allegatiFalliti ? `${r.allegatiFalliti} allegato/i non è stato caricato: rispondi alla richiesta e riprova, oppure chiamaci.` : '';
        $('form').reset(); files = []; disegnaAllegati(); aggiornaConta(); $('consigli').hidden = true; $('consigli').replaceChildren();
        $('scelta').hidden = true; $('scegli-prima').hidden = false; $('blocco-form').style.removeProperty('--c');
        $('descrizione').placeholder = 'Descrivi il problema con parole tue.';
        if (tel) $('telefono').value = tel;
        vai('conferma', 'nuova');
      } catch (e) { errore('errore-form', e.message); }
      finally { btn.disabled = false; btn.textContent = 'Invia richiesta'; }
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
  const badge = (s) => el('span', { className: 'st-b ' + (CLS[s] || 'st-attesa'), textContent: s });

  async function caricaRichieste() { richieste = await api('/richieste'); disegnaRichieste(); }
  function disegnaRichieste() {
    const l = richieste.filter((r) => filtro === 'tutte' || (filtro === 'aperte' ? !r.chiusa : r.chiusa));
    $('righe').replaceChildren(...l.map((r) => {
      const a = el('a', { href: '#richiesta/' + r.id, textContent: '#' + r.id });
      const tr = el('tr', {}, el('td', {}, a), el('td', { textContent: r.titolo }), el('td', { textContent: data(r.aperta) }), el('td', { textContent: data(r.aggiornata) }), el('td', {}, badge(r.stato)));
      tr.addEventListener('click', (e) => { if (e.target !== a) location.hash = '#richiesta/' + r.id; });
      return tr;
    }));
    $('vuoto').hidden = l.length > 0;
  }

  async function caricaDettaglio(id) {
    try {
      const d = await api('/richieste/' + encodeURIComponent(id));
      $('d-titolo').textContent = d.titolo; $('d-numero').textContent = '#' + d.id; $('d-data').textContent = data(d.aperta);
      $('d-stato').className = 'stato ' + (CLS[d.stato] || ''); $('d-stato').textContent = d.stato; $('d-stato-testo').textContent = SPIEGA[d.stato] || '';
      $('d-desc').textContent = d.descrizione;
      $('d-timeline').replaceChildren(...d.timeline.map((t) => el('li', {}, el('time', { textContent: dataOra(t.data) }), t.testo)));
      $('d-nessuno').hidden = d.timeline.length > 0;
      $('form-msg').hidden = d.chiusa; $('form-msg').dataset.id = d.id;
      mostraEsito(d);
      errore('errore-msg', '');
    } catch (e) { location.hash = '#richieste'; }
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

  // ---------- avvio ----------
  async function avvio() {
    document.querySelectorAll('.filtro').forEach((b) => b.addEventListener('click', () => {
      filtro = b.dataset.f;
      document.querySelectorAll('.filtro').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
      disegnaRichieste();
    }));
    $('esci').addEventListener('click', async () => {
      window.Appearance.clear();
      try { const r = await api('/../auth/logout', { method: 'POST' }); location.href = r.redirect; } catch { location.href = BASE + '/'; }
    });
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
    disegnaTile(); inizializzaForm();
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
