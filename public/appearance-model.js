/* Contratto condiviso tra browser e server. Nessuna dipendenza esterna. */
(function (root) {
  'use strict';
  const themes = [
    ['classic', 'Classico Bondeno', 'La grafica originale'], ['dark', 'Scuro', 'Superfici scure, luce gentile'],
    ['contrast', 'Contrasto elevato', 'Bordi netti e segni evidenti'], ['cyber', 'Cyberpunk', 'Circuiti e neon'],
    ['hawaii', 'Hawaii', 'Sabbia, palme e corallo'], ['mountain', 'Montagna', 'Cime, abete e roccia'],
    ['terminal', 'Terminale', 'Una console personale'], ['fog', 'Nebbia padana', 'Pianura e verde salvia']
  ];
  const defaults = () => ({ theme: 'classic', text: 100, icon: 100, roomy: false, motion: null });
  function validate(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Preferenze non valide.');
    const keys = Object.keys(defaults());
    if (Object.keys(value).length !== keys.length || Object.keys(value).some(k => !keys.includes(k)) ||
        !themes.some(t => t[0] === value.theme) ||
        !Number.isInteger(value.text) || value.text < 100 || value.text > 150 || value.text % 10 !== 0 ||
        !Number.isInteger(value.icon) || value.icon < 80 || value.icon > 150 || value.icon % 10 !== 0 ||
        typeof value.roomy !== 'boolean' || ![null, true, false].includes(value.motion)) throw new Error('Preferenze non valide.');
    return Object.fromEntries(keys.map(k => [k, value[k]]));
  }
  const model = { themes, defaults, validate };
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.AppearanceModel = model;
})(typeof window === 'object' ? window : globalThis);
