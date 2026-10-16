/* Preferenze dell'account: nessuna cache browser, nessun dato condiviso tra utenti. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const root = document.documentElement;
  const model = window.AppearanceModel;
  const system = matchMedia('(prefers-reduced-motion: reduce)');
  const base = document.querySelector('meta[name=base]').content;
  const iconIds = ['pc', 'pr', 'nt', 'ml', 'ky', 'ap', 'ot'];
  let state = model.defaults(), request, active = false, revision = 0, running = false, timer, opener;
  const dialog = $('aspetto-pannello');
  const effectiveMotion = () => state.motion === null ? system.matches : state.motion;
  function icons() {
    document.querySelectorAll('.ic use').forEach(use => {
      const id = use.dataset.original || use.getAttribute('href').split('#').pop();
      use.dataset.original = id;
      use.setAttribute('href', ['classic', 'dark', 'contrast'].includes(state.theme) || !iconIds.includes(id)
        ? '#' + id : base + '/theme-icons.svg#' + state.theme + '-' + id);
    });
  }
  function apply() {
    root.dataset.theme = state.theme; root.dataset.text = state.text; root.dataset.icon = state.icon;
    root.dataset.roomy = state.roomy; root.dataset.motion = state.motion === null ? 'system' : state.motion ? 'reduce' : 'full';
    $('aspetto-testo').value = state.text; $('testo-valore').value = state.text + '%';
    $('aspetto-icone').value = state.icon; $('icone-valore').value = state.icon + '%';
    $('aspetto-spazio').checked = state.roomy; $('aspetto-movimenti').checked = effectiveMotion();
    $('aspetto-sistema').textContent = state.motion === null ? 'Movimento: segue il sistema' : 'Usa la preferenza di movimento del sistema';
    document.querySelectorAll('#temi input').forEach(input => { input.checked = input.value === state.theme; });
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
  function open(event) {
    if (!active) return;
    opener = event.currentTarget; dialog.showModal();
  }
  for (const [id, name, description] of model.themes) {
    const label = document.createElement('label'); label.className = 'theme-choice'; label.dataset.preview = id;
    const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'tema-personale'; radio.value = id;
    radio.addEventListener('change', () => change({ theme: id }));
    const swatch = document.createElement('span'); swatch.className = 'theme-preview'; swatch.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS(svg.namespaceURI, 'use');
    use.setAttribute('href', ['classic', 'dark', 'contrast'].includes(id) ? '#pc' : base + '/theme-icons.svg#' + id + '-pc'); svg.append(use);
    swatch.append(svg, document.createElement('i'), document.createElement('i'));
    const title = document.createElement('b'); title.textContent = name;
    const small = document.createElement('small'); small.textContent = description;
    const selected = document.createElement('span'); selected.className = 'theme-selected'; selected.textContent = '✓ Selezionato';
    label.append(radio, swatch, title, small, selected); $('temi').append(label);
  }
  $('aspetto').addEventListener('click', open); $('profilo-aspetto').addEventListener('click', open); $('aspetto-rivedi').addEventListener('click', open);
  for (const id of ['aspetto-chiudi', 'aspetto-fatto']) $(id).addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { if (active) opener?.focus(); });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button,input,a[href],[tabindex]')].filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  $('aspetto-testo').addEventListener('input', e => change({ text: Number(e.target.value) }));
  $('aspetto-icone').addEventListener('input', e => change({ icon: Number(e.target.value) }));
  $('aspetto-spazio').addEventListener('change', e => change({ roomy: e.target.checked }));
  $('aspetto-movimenti').addEventListener('change', e => change({ motion: e.target.checked }));
  $('aspetto-sistema').addEventListener('click', () => change({ motion: null }));
  $('aspetto-reset').addEventListener('click', () => change(model.defaults()));
  $('aspetto-riprova').addEventListener('click', save);
  system.addEventListener('change', () => { if (state.motion === null) apply(); });
  window.Appearance = {
    init(api, initial) {
      request = api; active = true;
      // Il server ha gia' applicato le preferenze nell'HTML, prima dei fogli di stile.
      // /me le conferma senza introdurre una richiesta bloccante prima del modulo.
      state = model.validate(initial.preferences);
      apply();
      if (!initial.available) error('Impossibile leggere le preferenze salvate. Puoi scegliere un aspetto e riprovare il salvataggio.');
    },
    refresh: icons,
    clear() {
      active = false; revision++; clearTimeout(timer); dialog.close(); state = model.defaults(); apply(); error('');
      $('aspetto').hidden = true;
    }
  };
})();
