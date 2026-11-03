/* Elementi animati dei temi: icona della testata, indicatore di avanzamento, decorazione sopra il piè di pagina,
   particelle della conferma. Solo SVG/CSS (temi.css); nessuno stile in linea: i valori passano da variabili CSS.
   I temi della 1.x senza disegno proprio usano quelli del Classico. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (id) => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const v2 = ['classic', 'giardino', 'autunno'];
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
    giardino: '<svg width="54" height="54" viewBox="0 0 54 54"><g class="t-sway t-o50"><path d="M27 50V22" stroke="#2f7d4f" stroke-width="3" stroke-linecap="round"/><path d="M27 36Q10 36 8 22Q24 22 27 36z" fill="#4caf6e"/><path d="M27 28Q44 28 46 14Q30 14 27 28z" fill="#5cc27d"/></g></svg>',
    autunno: '<svg width="54" height="54" viewBox="0 0 54 54"><g class="t-sway t-o50"><path d="M27 4l4 10 9-4-3 11 11-1-8 9 6 7H35v14l-8-6-8 6V36H8l6-7-8-9 11 1-3-11 9 4z" fill="#d9631e"/><path d="M27 20v26" stroke="#8c3b12" stroke-width="2" stroke-linecap="round"/></g></svg>',
  };

  const PROGRESSO = {
    classic: '<svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22" fill="none" class="k-line" stroke-width="6"/><circle class="p-anello k-accent" cx="32" cy="32" r="22" fill="none" stroke-width="6" stroke-linecap="round" stroke-dasharray="138.2" transform="rotate(-90 32 32)"/><path class="p-spunta k-hero" d="M26 32l4.5 4.5L39 27" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    giardino: '<svg width="80" height="76" viewBox="0 0 80 76" aria-hidden="true"><path d="M26 60H54L51 74H29Z" fill="#c8794a"/><g class="t-sway t-o60"><g class="p-stelo"><path d="M40 60V18" stroke="#2f7d4f" stroke-width="3" stroke-linecap="round"/></g><g class="p-f1"><path d="M40 46Q22 44 18 32Q34 32 40 46Z" fill="#4caf6e"/></g><g class="p-f2"><path d="M40 34Q58 32 62 20Q46 20 40 34Z" fill="#5cc27d"/></g><g class="p-fiore"><g fill="#ff8fb1"><ellipse cx="40" cy="8" rx="4.5" ry="7"/><ellipse cx="40" cy="8" rx="4.5" ry="7" transform="rotate(60 40 16)"/><ellipse cx="40" cy="8" rx="4.5" ry="7" transform="rotate(120 40 16)"/><ellipse cx="40" cy="8" rx="4.5" ry="7" transform="rotate(180 40 16)"/><ellipse cx="40" cy="8" rx="4.5" ry="7" transform="rotate(240 40 16)"/><ellipse cx="40" cy="8" rx="4.5" ry="7" transform="rotate(300 40 16)"/></g><circle cx="40" cy="16" r="5" fill="#f2b134"/></g></g></svg>',
    autunno: '<svg width="100" height="76" viewBox="0 0 100 76" aria-hidden="true"><g transform="translate(20 0)"><path class="t-cade" d="M0 -6Q6 -2 0 7Q-6 -2 0 -6Z" fill="#d9631e"/></g><g transform="translate(46 0)"><path class="t-cade c2" d="M0 -6Q6 -2 0 7Q-6 -2 0 -6Z" fill="#f2a93b"/></g><g transform="translate(74 0)"><path class="t-cade c3" d="M0 -6Q6 -2 0 7Q-6 -2 0 -6Z" fill="#c0392b"/></g><ellipse cx="48" cy="68" rx="38" ry="7" fill="#8c3b12"/><g class="p-m1"><ellipse cx="48" cy="61" rx="31" ry="8" fill="#d9631e"/></g><g class="p-m2"><ellipse cx="48" cy="54" rx="23" ry="7.5" fill="#f2a93b"/></g><g class="p-m3"><ellipse cx="48" cy="48" rx="15" ry="6.5" fill="#c0392b"/></g><g class="p-zucca"><ellipse cx="74" cy="58" rx="11" ry="9" fill="#e8751a"/><path d="M74 49v18M68 50q-3 8 0 16M80 50q3 8 0 16" stroke="#b5541b" stroke-width="1.4" fill="none"/><path d="M74 49q0-5 4-6" stroke="#2f7d4f" stroke-width="2.4" fill="none" stroke-linecap="round"/></g></svg>',
  };

  function decorazione(t) {
    const d = $('deco'); if (!d) return;
    d.className = 'deco deco-' + t; d.replaceChildren();
    if (t === 'classic') html(d, '<div class="d-linea"><i></i></div>');
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
