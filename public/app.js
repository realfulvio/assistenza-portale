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
    const p = location.pathname.replace(BASE, '');
    if (p.startsWith('/non-consentito')) return schermata('Accesso non consentito', 'Il tuo account non è abilitato a usare questo portale. Se pensi sia un errore, contatta l\'assistenza informatica.', [el('a', { className: 'send sec', href: BASE + '/', textContent: 'Torna all\'inizio' })]);
    if (p.startsWith('/errore')) return schermata('Qualcosa non ha funzionato', 'Non siamo riusciti a completare l\'operazione. Riprova tra poco; se il problema continua chiamaci.', [btnMs()]);
    schermata('Benvenuto', 'Accedi con il tuo account di lavoro per aprire una richiesta di assistenza e seguirne lo stato.', [btnMs()]);
  }

  // ---------- viste ----------
  const VISTE = ['nuova', 'conferma', 'richieste', 'dettaglio', 'faq', 'contatti'];
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
    else if (h === 'faq') { vai('faq'); await caricaFaq(); }
    else if (h === 'contatti') { vai('contatti'); }
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

  // Il modulo si colora come la categoria scelta e mostra icona, nome e suggerimento
  function scegliCategoria(c) {
    const f = $('blocco-form');
    f.style.setProperty('--c', c.colore || '#005e8e');
    $('ci').replaceChildren(icona(c.icona));
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
      t.querySelector('input').addEventListener('change', () => scegliCategoria(c));
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

  function inizializzaForm() {
    $('descrizione').addEventListener('input', aggiornaConta);
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
        $('form').reset(); files = []; disegnaAllegati(); aggiornaConta();
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
    'In attesa': 'Abbiamo ricevuto la richiesta: un tecnico la prenderà in carico a breve.',
    'In lavorazione': 'Un tecnico sta lavorando alla tua richiesta.',
    'In sospeso': 'La richiesta è ferma in attesa di qualcosa (per esempio una tua risposta o un ricambio).',
    Risolta: 'Il problema risulta risolto. Se non è così, scrivi un messaggio qui sotto.',
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
      errore('errore-msg', '');
    } catch (e) { location.hash = '#richieste'; }
  }

  async function caricaFaq() {
    const f = await api('/faq');
    $('faq-lista').replaceChildren(...f.map((x) => el('details', {}, el('summary', { textContent: x.d }), el('p', { textContent: x.r }))));
  }

  // ---------- avvio ----------
  async function avvio() {
    document.querySelectorAll('.filtro').forEach((b) => b.addEventListener('click', () => {
      filtro = b.dataset.f;
      document.querySelectorAll('.filtro').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
      disegnaRichieste();
    }));
    $('esci').addEventListener('click', async () => {
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
    $('schermata').hidden = true; $('app').hidden = false;
    for (const id of ['nav', 'slim-richieste', 'slim-utente', 'esci']) $(id).hidden = false;
    $('slim-utente').textContent = me.nome; $('slim-utente').title = me.email;
    disegnaTile(); inizializzaForm();
    $('aiuto-all').textContent = `Fino a ${me.limiti.maxFiles} file, ${Math.round(me.limiti.maxFileBytes / 1048576)} MB ciascuno (immagini, PDF, Word, Excel, testo, zip, e-mail).`;
    try { $('telefono').value = localStorage.getItem('tel') || ''; } catch { /* ignorato */ }
    if (/\/(errore|non-consentito)$/.test(location.pathname)) history.replaceState(null, '', BASE + '/');
    window.addEventListener('hashchange', () => route().catch((e) => console.warn(e.message)));
    route().catch((e) => console.warn(e.message));
  }
  avvio();
})();
