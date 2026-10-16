// Foto profilo: avatar nella barra in alto e gestione in «Il mio profilo».
// Parla solo con /api/profilo/foto* (sempre la foto dell'utente in sessione) e usa il CSRF del portale.
(() => {
  const $ = (id) => document.getElementById(id);
  const slimUtente = $('slim-utente');
  if (!slimUtente || !window.fetch) return;

  const base = (document.querySelector('meta[name="base"]') || {}).content || '';
  const MAX = 3 * 1024 * 1024;
  const TIPI = ['image/jpeg', 'image/png', 'image/webp'];
  const CHIP = {
    m365: (g) => 'Foto da Microsoft 365 · sincronizzata ' + g,
    manual: () => 'Foto personale · ha la precedenza su Microsoft 365',
    none: () => 'Nessuna foto · vengono mostrate le iniziali'
  };
  let me = null, info = null, scelta = null, anteprima = null;

  const iniziali = (nome) => String(nome || '').trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?';
  const giorni = (iso) => {
    const g = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
    return !iso || Number.isNaN(g) ? 'di recente' : g <= 0 ? 'oggi' : g === 1 ? 'ieri' : g + ' giorni fa';
  };

  async function api(path, opts = {}) {
    const headers = { Accept: 'application/json', ...(opts.headers || {}) };
    if (opts.method === 'POST') headers['X-CSRF-Token'] = me ? me.csrf : '';
    const r = await fetch(base + path, { credentials: 'same-origin', cache: 'no-store', ...opts, headers });
    let d = null; try { d = await r.json(); } catch { /* risposta senza JSON */ }
    return { ok: r.ok, status: r.status, d: d || {} };
  }

  // Disegna un avatar: foto (se c'e') oppure iniziali. Se la foto non si carica restano le iniziali.
  function disegna(el, animata) {
    if (!el) return;
    el.textContent = iniziali(me && me.nome);
    if (info && info.v) {
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.onload = () => { el.textContent = ''; el.append(img); };
      img.src = `${base}/api/profilo/foto?v=${info.v}`;
    }
    if (animata) { el.classList.remove('nuova'); void el.offsetWidth; el.classList.add('nuova'); }
  }

  function mostraBottone(el, visibile) {
    if (!el) return;
    if (visibile && el.hidden) { el.hidden = false; el.classList.remove('entra'); void el.offsetWidth; el.classList.add('entra'); }
    else if (!visibile) el.hidden = true;
  }

  function aggiorna(animata) {
    const o = info ? info.origine : 'none';
    const mini = $('slim-avatar');
    if (mini) { mini.hidden = slimUtente.hidden; disegna(mini, false); }
    if (!$('pf-av')) return;
    disegna($('pf-av'), animata);
    $('pf-av').setAttribute('aria-label', o === 'none' ? 'Nessuna foto profilo: iniziali ' + iniziali(me && me.nome) : 'Foto profilo di ' + ((me && me.nome) || ''));
    $('pf-chip').dataset.o = o;
    $('pf-chip-t').textContent = CHIP[o](giorni(info && info.sincronizzato));
    $('pf-carica').textContent = o === 'manual' ? 'Cambia foto' : 'Carica una foto personale';
    mostraBottone($('pf-m365'), o !== 'm365');
    mostraBottone($('pf-rimuovi'), o === 'manual');
  }

  function esito(testo, errore) {
    const el = $('pf-esito');
    if (!el) return;
    el.textContent = testo;
    el.classList.toggle('no', !!errore);
  }

  // --- Pannello di caricamento
  function errore(testo) {
    const el = $('pf-err');
    el.textContent = testo || '';
    el.hidden = !testo;
  }
  function pulisciAnteprima() {
    if (anteprima) URL.revokeObjectURL(anteprima);
    anteprima = null; scelta = null;
    $('pf-prev').textContent = iniziali(me && me.nome);
    $('pf-salva').disabled = true;
    $('pf-file').value = '';
  }
  function apri(si) {
    const p = $('pf-pannello');
    p.hidden = !si;
    for (const id of ['pf-cam', 'pf-carica']) $(id).setAttribute('aria-expanded', String(si));
    errore('');
    if (si) { pulisciAnteprima(); esito(''); $('pf-drop').focus(); } else pulisciAnteprima();
  }
  function scegli(file) {
    errore('');
    if (!file) return;
    if (!TIPI.includes(file.type)) { pulisciAnteprima(); return errore('Formato non supportato: scegli una foto JPG, PNG o WebP.'); }
    if (file.size > MAX) { pulisciAnteprima(); return errore('File troppo grande (massimo 3 MB)'); }
    pulisciAnteprima();
    scelta = file;
    anteprima = URL.createObjectURL(file);
    const img = new Image();
    img.alt = '';
    img.onload = () => { $('pf-prev').textContent = ''; $('pf-prev').append(img); };
    img.onerror = () => { pulisciAnteprima(); errore('Impossibile elaborare l\'immagine'); };
    img.src = anteprima;
    $('pf-salva').disabled = false;
  }

  async function salva() {
    if (!scelta) return;
    const b = $('pf-salva');
    b.disabled = true; b.setAttribute('aria-busy', 'true'); b.textContent = 'Salvataggio…';
    try {
      const fd = new FormData();
      fd.append('foto', scelta, 'foto');
      const r = await api('/api/profilo/foto', { method: 'POST', body: fd });
      if (!r.ok) { errore(r.d.errore || 'Impossibile elaborare l\'immagine'); b.disabled = false; return; }
      info = r.d;
      apri(false);
      aggiorna(true);
      esito('Foto salvata.');
      $('pf-carica').focus();
    } catch { errore('Non è stato possibile inviare la foto. Controlla la connessione e riprova.'); b.disabled = false; }
    finally { b.removeAttribute('aria-busy'); b.textContent = 'Salva foto'; }
  }

  async function azione(path, bottone, ok) {
    bottone.disabled = true; bottone.setAttribute('aria-busy', 'true');
    try {
      const r = await api(path, { method: 'POST' });
      if (r.ok) { info = r.d; aggiorna(true); esito(ok); apri(false); }
      else esito(r.d.errore || 'Qualcosa non ha funzionato. Riprova tra poco.', true);
    } catch { esito('Qualcosa non ha funzionato. Riprova tra poco.', true); }
    finally { bottone.disabled = false; bottone.removeAttribute('aria-busy'); }
  }

  function collega() {
    if (!$('pf-av')) return;
    $('pf-cam').addEventListener('click', () => apri($('pf-pannello').hidden));
    $('pf-carica').addEventListener('click', () => apri(true));
    $('pf-annulla').addEventListener('click', () => { apri(false); $('pf-carica').focus(); });
    $('pf-pannello').addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { apri(false); $('pf-carica').focus(); } });
    $('pf-drop').addEventListener('click', () => $('pf-file').click());
    $('pf-file').addEventListener('change', () => scegli($('pf-file').files[0]));
    const drop = $('pf-drop');
    for (const t of ['dragenter', 'dragover']) drop.addEventListener(t, (ev) => { ev.preventDefault(); drop.classList.add('sopra'); });
    for (const t of ['dragleave', 'drop']) drop.addEventListener(t, () => drop.classList.remove('sopra'));
    drop.addEventListener('drop', (ev) => { ev.preventDefault(); scegli(ev.dataTransfer.files[0]); });
    $('pf-salva').addEventListener('click', salva);
    $('pf-rimuovi').addEventListener('click', () => azione('/api/profilo/foto/rimuovi', $('pf-rimuovi'), 'Foto rimossa: ora vengono mostrate le iniziali.'));
    $('pf-m365').addEventListener('click', () => azione('/api/profilo/foto/microsoft', $('pf-m365'), 'Ora usi la foto di Microsoft 365.'));
  }

  async function carica() {
    try {
      const [m, i] = await Promise.all([api('/api/me'), api('/api/profilo/foto/info')]);
      if (!m.ok) return;
      me = m.d;
      info = i.ok ? i.d : { origine: 'none' };
      aggiorna(false);
    } catch { /* senza foto restano le iniziali */ }
  }

  collega();
  // Segue la comparsa del nome nella barra in alto (mostrato da app.js dopo l'accesso)
  let caricato = false;
  const segui = () => {
    const mini = $('slim-avatar');
    if (mini) mini.hidden = slimUtente.hidden;
    if (!slimUtente.hidden && !caricato) { caricato = true; carica(); }
    if (slimUtente.hidden) caricato = false;
  };
  new MutationObserver(segui).observe(slimUtente, { attributes: true, attributeFilter: ['hidden'] });
  segui();
})();
