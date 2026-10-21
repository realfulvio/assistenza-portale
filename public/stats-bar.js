// Barra «Live»: legge /api/stats (numeri aggregati, cache lato server) e la aggiorna ogni 5 minuti.
// Si mostra solo insieme al menu principale; se l'endpoint non risponde o dice ok:false resta nascosta.
(() => {
  const bar = document.getElementById('live');
  const nav = document.getElementById('nav');
  if (!bar || !nav || !window.fetch) return;

  const base = (document.querySelector('meta[name="base"]') || {}).content || '';
  const AGGIORNA_MS = 5 * 60 * 1000;
  const ROTAZIONE_MS = 3500;
  const DURATA_MS = 1800;
  const $ = (sel) => bar.querySelector(sel);
  const campo = (k) => bar.querySelector(`[data-k="${k}"]`);
  const fmt = (n) => Math.round(n).toLocaleString('it-IT');
  const plur = (n, uno, molti) => (n === 1 ? uno : molti);

  // Movimento ridotto: scelta in «Aspetto» (data-motion) oppure preferenza di sistema
  const ridotto = () => {
    const m = document.documentElement.dataset.motion;
    return m === 'reduce' || (m !== 'full' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };

  const valori = { ricevute: 0, risolte: 0, in_lavorazione: 0 }; // il count-up riparte da qui
  let timer = null, rotazione = null, messaggi = [], indice = 0, entrato = false, ultimo = 0;

  function contaFino(el, da, a) {
    if (ridotto() || da === a) { el.textContent = fmt(a); return; }
    const t0 = performance.now();
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / DURATA_MS);
      const e = 1 - Math.pow(1 - p, 3); // ease-out cubic
      el.textContent = fmt(da + (a - da) * e);
      if (p < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  function durata(sec) {
    if (sec < 3600) return Math.max(1, Math.round(sec / 60)) + ' min';
    if (sec < 86400) return (Math.round(sec / 360) / 10).toLocaleString('it-IT') + ' h';
    return (Math.round(sec / 8640) / 10).toLocaleString('it-IT') + ' gg';
  }
  function fa(min) {
    if (min < 60) return min + ' min fa';
    if (min < 1440) return Math.floor(min / 60) + ' h fa';
    return Math.floor(min / 1440) + ' gg fa';
  }

  function sparkline(v) {
    const max = Math.max(1, ...v);
    const punti = v.map((n, i) => `${(1 + i * (52 / (v.length - 1))).toFixed(1)},${(13 - (n / max) * 12).toFixed(1)}`);
    const pl = $('.live-spark polyline');
    pl.setAttribute('pathLength', '1');
    pl.setAttribute('points', punti.join(' '));
  }

  function mostraMessaggio(testo) {
    const el = $('.live-msg-t');
    if (ridotto()) { el.textContent = testo; return; }
    el.classList.add('esce');
    setTimeout(() => {
      el.textContent = testo;
      el.classList.remove('esce');
      el.classList.add('entra');
      void el.offsetWidth; // riparte la transizione dal basso
      el.classList.remove('entra');
    }, 500);
  }

  function ruota() {
    clearInterval(rotazione);
    indice = 0;
    $('.live-msg-t').textContent = messaggi[0] || '';
    $('.live-msg').hidden = !messaggi.length;
    if (ridotto() || messaggi.length < 2) return;
    rotazione = setInterval(() => { indice = (indice + 1) % messaggi.length; mostraMessaggio(messaggi[indice]); }, ROTAZIONE_MS);
  }

  function mostra(d) {
    bar.hidden = false;
    campo('periodo').textContent = d.periodo && d.periodo.etichetta ? d.periodo.etichetta : '';
    campo('ricevute').nextSibling.textContent = ' ' + plur(d.ricevute, 'richiesta', 'richieste') + ' ';
    campo('risolte').nextSibling.textContent = ' ' + plur(d.risolte, 'risolta', 'risolte');
    for (const k of Object.keys(valori)) { contaFino(campo(k), valori[k], d[k]); valori[k] = d[k]; }

    const presa = Number(d.presa_in_carico_media_sec);
    $('.live-presa').hidden = !(presa > 0);
    if (presa > 0) campo('presa').textContent = durata(presa);
    sparkline(Array.isArray(d.sparkline) && d.sparkline.length > 1 ? d.sparkline : [0, 0]);

    messaggi = [];
    if (d.ultima_risolta_min !== null && d.ultima_risolta_min !== undefined) messaggi.push('Ultima richiesta risolta ' + fa(d.ultima_risolta_min));
    messaggi.push(`Oggi ${fmt(d.oggi_ricevute)} ${plur(d.oggi_ricevute, 'richiesta', 'richieste')}, ${fmt(d.oggi_risolte)} già ${plur(d.oggi_risolte, 'risolta', 'risolte')}`);
    messaggi.push(`Il ${fmt(d.percentuale_risolte)}% delle richieste è risolto`);
    ruota();

    const larghezza = Math.max(0, Math.min(100, Number(d.percentuale_risolte) || 0)) + '%';
    if (!entrato) {
      entrato = true;
      requestAnimationFrame(() => requestAnimationFrame(() => { bar.classList.add('on'); $('.live-prog i').style.width = larghezza; }));
    } else $('.live-prog i').style.width = larghezza;
  }

  function nascondi() {
    bar.hidden = true;
    clearInterval(rotazione);
  }

  async function carica() {
    ultimo = Date.now();
    try {
      const r = await fetch(base + '/api/stats', { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' });
      const d = r.ok ? await r.json() : null;
      if (d && d.ok === true) mostra(d); else nascondi();
    } catch { nascondi(); }
  }

  function avvia() {
    if (timer) return;
    carica();
    timer = setInterval(() => { if (!document.hidden) carica(); }, AGGIORNA_MS);
  }
  function ferma() {
    clearInterval(timer); timer = null;
    nascondi();
  }

  // Tornando sulla scheda dopo più di 5 minuti si aggiorna subito
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && timer && Date.now() - ultimo > AGGIORNA_MS) carica();
  });

  // Segue la visibilità del menu principale (mostrato da app.js dopo l'accesso)
  const segui = () => (nav.hidden ? ferma() : avvia());
  new MutationObserver(segui).observe(nav, { attributes: true, attributeFilter: ['hidden'] });
  segui();
})();
