/* Contratto condiviso tra browser e server. Nessuna dipendenza esterna. */
(function (root) {
  'use strict';
  // [id, nome, nota, tre colori del campione, gruppo]. Gli id esistenti non cambiano: le preferenze salvate restano valide.
  const themes = [
    ['classic', 'Classico', 'Blu e oro', ['#005e8e', '#e6b93c', '#001a4d'], 'v2'],
    ['hawaii', 'Hawaii', 'Cocktail e onde', ['#12a4a8', '#ff7a59', '#ffd166'], 'v2'],
    ['spazio', 'Spazio', 'Razzo e stelle', ['#262072', '#7c6cf0', '#ffd24a'], 'v2'],
    ['giardino', 'Giardino', 'Pianta che fiorisce', ['#2f7d4f', '#f2b134', '#ff8fb1'], 'v2'],
    ['autunno', 'Autunno', 'Foglie che cadono', ['#b5541b', '#f2a93b', '#5a2d0c'], 'v2'],
    ['retro', 'Retro', 'Pixel e arcade', ['#2a1458', '#ff2e93', '#00f5d4'], 'altri'],
    ['dark', 'Scuro', 'Superfici scure, luce gentile', ['#124c66', '#91dcff', '#101c25'], 'altri'],
    ['contrast', 'Contrasto elevato', 'Bordi netti e segni evidenti', ['#000000', '#ffd400', '#ffffff'], 'altri'],
    ['cyber', 'Cyberpunk', 'Circuiti e neon', ['#181030', '#f762cb', '#5df3ef'], 'altri'],
    ['mountain', 'Montagna', 'Cime, abete e roccia', ['#244f43', '#c9a227', '#e2e9d4'], 'altri'],
    ['terminal', 'Terminale', 'Una console personale', ['#10251b', '#91ec9f', '#07130c'], 'altri'],
    ['fog', 'Nebbia padana', 'Pianura e verde salvia', ['#53665b', '#c9b458', '#eeeee9'], 'altri']
  ];
  const sizes = [['s', 'Piccole', 0.92], ['m', 'Normali', 1], ['l', 'Grandi', 1.1]];
  const densities = [['c', 'Compatta', 12], ['n', 'Normale', 20], ['a', 'Ampia', 30]];
  const defaults = () => ({ theme: 'classic', text: 100, icon: 100, roomy: false, motion: null, size: 'm', density: 'n' });
  const keys = Object.keys(defaults());
  const legacy = ['theme', 'text', 'icon', 'roomy', 'motion'];

  // Accetta anche il formato 1.x (senza size/density) e lo completa: nessuna migrazione distruttiva.
  function validate(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Preferenze non valide.');
    const given = Object.keys(value);
    if (given.some(k => !keys.includes(k)) || legacy.some(k => !given.includes(k))) throw new Error('Preferenze non valide.');
    const v = { size: 'm', density: value.roomy === true ? 'a' : 'n', ...value };
    if (!themes.some(t => t[0] === v.theme) ||
        !Number.isInteger(v.text) || v.text < 100 || v.text > 150 || v.text % 10 !== 0 ||
        !Number.isInteger(v.icon) || v.icon < 80 || v.icon > 150 || v.icon % 10 !== 0 ||
        typeof v.roomy !== 'boolean' || ![null, true, false].includes(v.motion) ||
        !sizes.some(s => s[0] === v.size) || !densities.some(d => d[0] === v.density)) throw new Error('Preferenze non valide.');
    return Object.fromEntries(keys.map(k => [k, v[k]]));
  }
  // Attributi da mettere su <html>: usati dal server (nessun flash al caricamento) e dal browser
  function attributes(p) {
    return { theme: p.theme, text: p.text, icon: p.icon, roomy: p.roomy, size: p.size, density: p.density,
      motion: p.motion === null ? 'system' : p.motion ? 'reduce' : 'full' };
  }
  const model = { themes, sizes, densities, defaults, validate, attributes };
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.AppearanceModel = model;
})(typeof window === 'object' ? window : globalThis);
