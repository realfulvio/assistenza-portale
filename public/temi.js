/* Elementi animati dei temi: icona della testata, indicatore di avanzamento, decorazione sopra il piè di pagina,
   particelle della conferma. Solo SVG/CSS (temi.css); nessuno stile in linea: i valori passano da variabili CSS.
   I temi della 1.x senza disegno proprio usano quelli del Classico. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (id) => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const v2 = ['classic', 'halloween', 'giardino', 'autunno'];
  const tema = () => (v2.includes(root.dataset.theme) ? root.dataset.theme : 'classic');
  // markup statico, senza dati dell'utente
  const html = (el, s) => { el.innerHTML = s; return el; };
  const span = (cls, vars = {}) => {
    const e = document.createElement('span'); e.className = cls;
    for (const [k, v] of Object.entries(vars)) e.style.setProperty('--' + k, v);
    return e;
  };

  const ICONE = {
    classic: '<svg class="t-spin" width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M5.6 5.6l3.6 3.6 M14.8 14.8l3.6 3.6 M18.4 5.6l-3.6 3.6 M9.2 14.8l-3.6 3.6"/></svg><svg class="t-onda" width="56" height="10" viewBox="0 0 56 10"><path d="M0 5Q7 0 14 5T28 5T42 5T56 5" fill="none" class="k-accent" stroke-width="2.4" stroke-linecap="round"/></svg>',
    halloween: '<svg width="54" height="54" viewBox="0 0 54 54"><g class="t-sway t-o50"><path d="M27 15q0-7 6-9" fill="none" stroke="#5cc27d" stroke-width="3" stroke-linecap="round"/><ellipse cx="27" cy="33" rx="22" ry="17" fill="#ff8a1f"/><path d="M27 16q-9 17 0 34M16 19q-9 14-1 28M38 19q9 14 1 28" fill="none" stroke="#c25a00" stroke-width="1.6"/><g class="t-tw"><path d="M14 28l7 0-3.500-7zM33 28l7 0-3.500-7z" fill="#2a1138"/><path d="M13 38q3 6 7 2l3 4 4-4 4 4 3-4q4 4 7-2q-7 9-14 4q-7 5-14-4z" fill="#2a1138"/></g></g></svg>',
    giardino: '<svg width="54" height="54" viewBox="0 0 54 54"><g class="t-sway t-o50"><path d="M27 50V22" stroke="#2f7d4f" stroke-width="3" stroke-linecap="round"/><path d="M27 36Q10 36 8 22Q24 22 27 36z" fill="#4caf6e"/><path d="M27 28Q44 28 46 14Q30 14 27 28z" fill="#5cc27d"/></g></svg>',
    autunno: '<svg width="54" height="54" viewBox="0 0 54 54"><g class="t-sway t-o50"><path d="M27 4l4 10 9-4-3 11 11-1-8 9 6 7H35v14l-8-6-8 6V36H8l6-7-8-9 11 1-3-11 9 4z" fill="#d9631e"/><path d="M27 20v26" stroke="#8c3b12" stroke-width="2" stroke-linecap="round"/></g></svg>',
  };

  const PROGRESSO = {
    classic: '<svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22" fill="none" class="k-line" stroke-width="6"/><circle class="p-anello k-accent" cx="32" cy="32" r="22" fill="none" stroke-width="6" stroke-linecap="round" stroke-dasharray="138.2" transform="rotate(-90 32 32)"/><path class="p-spunta k-hero" d="M26 32l4.5 4.5L39 27" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    halloween: '<div class="p-razzo-w" aria-hidden="true"><span class="t-tw s1"></span><span class="t-tw s2"></span><span class="t-tw s3"></span><span class="t-tw s4"></span><svg class="p-pianeta" width="36" height="36" viewBox="0 0 34 34"><path d="M7 32V15a10 10 0 0 1 20 0v17z" fill="#8f8aa8"/><path d="M17 12v11M12.500 16.500h9" stroke="#4a4560" stroke-width="2.200" stroke-linecap="round"/></svg><svg class="p-luna" width="34" height="34" viewBox="0 0 34 34"><path d="M17 7q2-5 6-6" fill="none" stroke="#5cc27d" stroke-width="2.600" stroke-linecap="round"/><ellipse cx="17" cy="20" rx="14" ry="12" fill="#ff8a1f"/><path d="M17 8q-6 12 0 24" fill="none" stroke="#c25a00" stroke-width="1.300"/><path d="M9 18l5 0-2.500-5zM20 18l5 0-2.500-5z" fill="#2a1138"/><path d="M9 25q4 4 8 1q4 3 8-1" fill="none" stroke="#2a1138" stroke-width="2" stroke-linecap="round"/></svg><span class="p-rotta"></span><div class="p-razzo"><svg width="30" height="28" viewBox="-12 0 40 26"><path class="t-fiamma" d="M2 22Q-4 24-10 18Q-4 18 2 14Z" fill="#e8e0ff" opacity=".6"/><path d="M0 24V12A12 12 0 0 1 24 12V24l-4-3-4 3-4-3-4 3-4-3z" fill="#f4f0ff" stroke="#c9c5f0" stroke-width="1"/><circle cx="8.500" cy="11" r="2.200" fill="#2a1138"/><circle cx="16.500" cy="11" r="2.200" fill="#2a1138"/><ellipse cx="12.500" cy="16.500" rx="2.300" ry="2.800" fill="#2a1138"/></svg></div><svg class="p-stella" width="26" height="22" viewBox="0 0 26 22"><path d="M13 20L11 14Q7 16 1 13Q4 12 5 8Q7 9 9 11Q10 6 13 3Q16 6 17 11Q19 9 21 8Q22 12 25 13Q19 16 15 14Z" fill="#ff8a1f"/></svg></div>',
    giardino: '<svg width="80" height="76" viewBox="0 0 80 76" aria-hidden="true"><path d="M26 60H54L51 74H29Z" fill="#c8794a"/><g class="t-sway t-o60"><g class="p-stelo"><path d="M40 60V18" stroke="#2f7d4f" stroke-width="3" stroke-linecap="round"/></g><g class="p-f1"><path d="M40 46Q22 44 18 32Q34 32 40 46Z" fill="#4caf6e"/></g><g class="p-f2"><path d="M40 34Q58 32 62 20Q46 20 40 34Z" fill="#5cc27d"/></g><g class="p-fiore"><g fill="#ff8fb1"><ellipse cx="40" cy="8" rx="4.5" ry="7"/><ellipse cx="40" cy="8" rx="4.5" ry="7" transform="rotate(60 40 16)"/><ellipse cx="40" cy="8" rx="4.5" ry="7" transform="rotate(120 40 16)"/><ellipse cx="40" cy="8" rx="4.5" ry="7" transform="rotate(180 40 16)"/><ellipse cx="40" cy="8" rx="4.5" ry="7" transform="rotate(240 40 16)"/><ellipse cx="40" cy="8" rx="4.5" ry="7" transform="rotate(300 40 16)"/></g><circle cx="40" cy="16" r="5" fill="#f2b134"/></g></g></svg>',
    autunno: '<svg width="100" height="76" viewBox="0 0 100 76" aria-hidden="true"><g transform="translate(20 0)"><path class="t-cade" d="M0 -6Q6 -2 0 7Q-6 -2 0 -6Z" fill="#d9631e"/></g><g transform="translate(46 0)"><path class="t-cade c2" d="M0 -6Q6 -2 0 7Q-6 -2 0 -6Z" fill="#f2a93b"/></g><g transform="translate(74 0)"><path class="t-cade c3" d="M0 -6Q6 -2 0 7Q-6 -2 0 -6Z" fill="#c0392b"/></g><ellipse cx="48" cy="68" rx="38" ry="7" fill="#8c3b12"/><g class="p-m1"><ellipse cx="48" cy="61" rx="31" ry="8" fill="#d9631e"/></g><g class="p-m2"><ellipse cx="48" cy="54" rx="23" ry="7.5" fill="#f2a93b"/></g><g class="p-m3"><ellipse cx="48" cy="48" rx="15" ry="6.5" fill="#c0392b"/></g><g class="p-zucca"><ellipse cx="74" cy="58" rx="11" ry="9" fill="#e8751a"/><path d="M74 49v18M68 50q-3 8 0 16M80 50q3 8 0 16" stroke="#b5541b" stroke-width="1.4" fill="none"/><path d="M74 49q0-5 4-6" stroke="#2f7d4f" stroke-width="2.4" fill="none" stroke-linecap="round"/></g></svg>',
  };

  function decorazione(t) {
    const d = $('deco'); if (!d) return;
    d.className = 'deco deco-' + t; d.replaceChildren();
    if (t === 'classic') html(d, '<div class="d-linea"><i></i></div>');
    else if (t === 'halloween') for (let s = 0; s < 26; s++) d.append(span('t-tw d-stella', { x: (s * 37) % 100 + '%', y: (s * 11) % 26 + 'px', s: (s % 3) + 1.5 + 'px', c: s % 4 === 0 ? '#ff8a1f' : s % 5 === 0 ? '#b57bff' : '#ffffff', dl: ((s * 0.37) % 2.4).toFixed(2) + 's' }));
    else if (t === 'giardino') for (let b = 0; b < 48; b++) d.append(span('t-sway d-filo', { x: b * 2.1 + '%', h: 10 + ((b * 7) % 14) + 'px', c: ['#4caf6e', '#2f7d4f', '#5cc27d'][b % 3], dl: ((b * 0.23) % 2).toFixed(2) + 's' }));
    else if (t === 'autunno') {
      html(d, '<div class="d-terra"></div>');
      const col = ['#d9631e', '#f2a93b', '#8c3b12', '#c0392b'];
      for (let q = 0; q < 18; q++) d.append(span('d-foglia', { x: (q * 37) % 100 + '%', y: (q * 7) % 20 + 'px', s: 8 + (q % 4) * 2 + 'px', c: col[q % 4], dur: 14 + (q * 3) % 10 + 's', dl: -((q * 5) % 18) + 's' }));
    }
  }

  let fatti = 0;
  function progresso(n) {
    fatti = n;
    const p = $('hero-prog'); if (!p) return;
    p.dataset.f = n;
    p.style.setProperty('--lvl', (n / 3).toFixed(3));
    p.setAttribute('aria-label', `Avanzamento della richiesta: ${n} ${n === 1 ? 'passo' : 'passi'} su 3`);
  }

  function disegna() {
    const t = tema();
    const ico = $('hero-ico'); if (ico) html(ico, ICONE[t]);
    const p = $('hero-prog');
    if (p) { p.className = 'hero-prog prog-' + t; html(p, PROGRESSO[t]); }
    decorazione(t);
    progresso(fatti);
  }

  // Particelle della conferma: 14, a tema, che si espandono e svaniscono
  const PARTICELLE = {
    classic: { col: ['#e6b93c', '#0a5c8f', '#ffffff'], forma: 'cerchio' },
    halloween: { col: ['#ff8a1f', '#b57bff', '#ffffff'], forma: 'stella' },
    giardino: { col: ['#4caf6e', '#ff8fb1', '#f2b134'], forma: 'foglia' },
    autunno: { col: ['#d9631e', '#f2a93b', '#8c3b12'], forma: 'foglia' }
  };
  function esplodi() {
    const box = $('parts'); if (!box) return;
    const st = PARTICELLE[tema()];
    box.classList.remove('via'); box.replaceChildren();
    for (let k = 0; k < 14; k++) {
      const ang = (k / 14) * Math.PI * 2, rad = 90 + (k % 3) * 26;
      box.append(span('part f-' + st.forma, { pc: st.col[k % 3], tx: Math.round(Math.cos(ang) * rad) + 'px', ty: Math.round(Math.sin(ang) * rad) + 'px', rot: k * 47 + 'deg' }));
    }
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('via')));
  }

  // Animazioni continue ferme quando la scheda non si vede
  document.addEventListener('visibilitychange', () => root.classList.toggle('in-pausa', document.hidden));
  new MutationObserver(disegna).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', disegna); else disegna();
  window.Temi = { progresso, esplodi, disegna };
})();
