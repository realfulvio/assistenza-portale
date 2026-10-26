/* Preferenze dell'account: nessuna cache browser, nessun dato condiviso tra utenti. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const root = document.documentElement;
  const model = window.AppearanceModel;
  const system = matchMedia('(prefers-reduced-motion: reduce)');
  const base = document.querySelector('meta[name=base]').content;
  const iconIds = ['pc', 'pr', 'nt', 'ml', 'ky', 'ap', 'ot'];
  const varianti = ['mountain', 'halloween']; // temi con icone proprie (theme-icons.svg)
  const SPUNTA = '<svg class="spunta" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  let state = model.defaults(), request, active = false, revision = 0, running = false, timer, opener;
  const dialog = $('aspetto-pannello');
  const effectiveMotion = () => state.motion === null ? system.matches : state.motion;
  function icons() {
    document.querySelectorAll('.tico use, #ci use').forEach(use => {
      const id = use.dataset.original || use.getAttribute('href').split('#').pop();
      use.dataset.original = id;
      use.setAttribute('href', !varianti.includes(state.theme) || !iconIds.includes(id) ? '#' + id : base + '/theme-icons.svg#' + state.theme + '-' + id);
    });
  }
  function apply() {
    const a = model.attributes(state);
    for (const [k, v] of Object.entries(a)) root.dataset[k] = v;
    $('aspetto-testo').value = state.text; $('testo-valore').value = state.text + '%';
    $('aspetto-icone').value = state.icon; $('icone-valore').value = state.icon + '%';
    $('aspetto-movimenti').checked = effectiveMotion();
    $('aspetto-sistema').textContent = state.motion === null ? 'Movimento: segue il sistema' : 'Usa la preferenza di movimento del sistema';
    dialog.querySelectorAll('[data-tema]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tema === state.theme)));
    dialog.querySelectorAll('[data-size]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.size === state.size)));
    dialog.querySelectorAll('[data-density]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.density === state.density)));
    icons();
  }
  function error(message) {
    $('aspetto-errore').textContent = message || ''; $('aspetto-errore').hidden = !message;
    $('aspetto-riprova').hidden = !message;
    $('aspetto-avviso-testo').textContent = message ? '⚠ ' + message : '';
    $('aspetto-avviso').hidden = !message;
  }
  async function save() {
    if (!active || running) return;
    running = true;
    const current = revision, value = { ...state };
    $('aspetto-stato').textContent = 'Salvataggio in corso…'; error('');
    try {
      await request('/preferenze', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
      if (active && current === revision) $('aspetto-stato').textContent = '✓ Preferenze salvate sul tuo account.';
    } catch (e) {
      if (active && current === revision) { $('aspetto-stato').textContent = 'Modifiche applicate solo in questa pagina.'; error(e.message); }
    } finally {
      running = false;
      if (active && current !== revision) save();
    }
  }
  function change(patch) {
    state = model.validate({ ...state, ...patch }); revision++; apply();
    error(''); $('aspetto-stato').textContent = 'Anteprima applicata. Salvataggio…';
    clearTimeout(timer); timer = setTimeout(save, 350);
  }
  // Pannello sotto la barra: si apre e chiude dal pulsante, con Esc o cliccando fuori
  function chiudi(rifocus = true) {
    if (!dialog.open) return;
    dialog.close();
    $('aspetto').setAttribute('aria-expanded', 'false');
    if (rifocus && active) opener?.focus();
  }
  function open(event) {
    if (!active) return;
    if (dialog.open) return chiudi();
    opener = event.currentTarget;
    dialog.show();
    $('aspetto').setAttribute('aria-expanded', 'true');
    (dialog.querySelector('[aria-pressed=true]') || $('aspetto-chiudi')).focus();
  }
  const bottone = (cls, dati, ...figli) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = cls;
    for (const [k, v] of Object.entries(dati)) b.dataset[k] = v;
    b.setAttribute('aria-pressed', 'false'); b.append(...figli); return b;
  };
  const testo = (tag, t) => { const e = document.createElement(tag); e.textContent = t; return e; };
  for (const [id, name, note, colori] of model.themes) {
    const pal = document.createElement('span'); pal.className = 'pal'; pal.setAttribute('aria-hidden', 'true');
    for (const c of colori) { const i = document.createElement('i'); i.style.setProperty('--sw', c); pal.append(i); }
    const nm = document.createElement('span'); nm.className = 'nm'; nm.append(testo('b', name), testo('small', note));
    const b = bottone('thm', { tema: id }, pal, nm);
    b.insertAdjacentHTML('beforeend', SPUNTA);
    b.addEventListener('click', () => change({ theme: id }));
    $('temi').append(b);
  }
  for (const [id, name] of model.sizes) {
    const aa = testo('span', 'Aa'); aa.className = 'aa'; aa.style.fontSize = { s: 14, m: 18, l: 24 }[id] + 'px';
    const b = bottone('thm', { size: id }, aa, testo('small', name));
    b.addEventListener('click', () => change({ size: id }));
    $('dimensioni').append(b);
  }
  for (const [id, name, gap] of model.densities) {
    const barre = document.createElement('span'); barre.className = 'barre'; barre.setAttribute('aria-hidden', 'true');
    barre.style.setProperty('--gb', Math.round(gap / 4) + 'px');
    for (let i = 0; i < 3; i++) barre.append(document.createElement('i'));
    const b = bottone('thm', { density: id }, barre, testo('small', name));
    b.addEventListener('click', () => change({ density: id, roomy: id === 'a' }));
    $('spaziature').append(b);
  }
  $('aspetto').addEventListener('click', open);
  $('profilo-aspetto')?.addEventListener('click', open);
  $('aspetto-rivedi').addEventListener('click', open);
  $('aspetto-chiudi').addEventListener('click', () => chiudi());
  dialog.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); chiudi(); } });
  document.addEventListener('click', event => {
    if (dialog.open && !dialog.contains(event.target) && !event.target.closest('#aspetto,#profilo-aspetto,#aspetto-rivedi')) chiudi(false);
  });
  $('aspetto-testo').addEventListener('input', e => change({ text: Number(e.target.value) }));
  $('aspetto-icone').addEventListener('input', e => change({ icon: Number(e.target.value) }));
  $('aspetto-movimenti').addEventListener('change', e => change({ motion: e.target.checked }));
  $('aspetto-sistema').addEventListener('click', () => change({ motion: null }));
  $('aspetto-reset').addEventListener('click', () => change(model.defaults()));
  $('aspetto-riprova').addEventListener('click', save);
  system.addEventListener('change', () => { if (state.motion === null) apply(); });
  window.Appearance = {
    init(api, initial) {
      request = api; active = true;
      // Il server ha gia' applicato le preferenze nell'HTML, prima dei fogli di stile: niente flash.
      state = model.validate(initial.preferences);
      apply();
      if (!initial.available) error('Impossibile leggere le preferenze salvate. Puoi scegliere un aspetto e riprovare il salvataggio.');
    },
    refresh: icons,
    clear() {
      active = false; revision++; clearTimeout(timer); chiudi(false); state = model.defaults(); apply(); error('');
      $('aspetto').hidden = true;
    }
  };
})();
