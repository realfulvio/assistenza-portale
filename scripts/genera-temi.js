// Genera public/theme.css (variabili dei temi) e verifica i contrasti minimi (4,5:1 testo normale, 3:1 testo grande/icone).
// Rieseguire quando cambia una palette: node scripts/genera-temi.js   (con --verifica controlla soltanto)
const fs = require('fs');
const path = require('path');

// Variabili: --top barra alta, --head testata, --bar barra Live, --accent oro/accento, --primary pulsanti e numeri,
// --bg sfondo, --card superfici, --text testo, --muted testo secondario, --line bordi, --soft riquadri tenui,
// --hero fascia della testata della pagina, --herotext titolo nella fascia, --r raggio, --foot piè di pagina,
// --dk testo scuro su accento. Facoltative: --onprimary (testo sui pulsanti, predefinito bianco), --bartext.
const temi = {
  // Classico: i valori della 1.x prevalgono (blu #005e8e, barra #001a4d, sfondo #f2f2f2)
  classic: { top: '#001a4d', head: '#005e8e', bar: '#071c38', accent: '#e6b93c', primary: '#005e8e', bg: '#f2f2f2', card: '#ffffff', text: '#191919', muted: '#455a64', line: '#dde3ea', soft: '#f2f7fb', hero: '#ffffff', herotext: '#005e8e', r: '8px', foot: '#001a4d', dk: '#0b2a55' },
  hawaii: { top: '#0b6e78', head: '#0a7c84', bar: '#08525a', accent: '#ff7a59', primary: '#0b7a85', bg: '#fff6e5', card: '#ffffff', text: '#16424a', muted: '#4f6e73', line: '#f0dcb8', soft: '#fffaf0', hero: '#fff0cc', herotext: '#0a6a73', r: '20px', foot: '#08525a', dk: '#3d1a0a', liveaccent: '#ffd166' },
  spazio: { top: '#0d0b2e', head: '#262072', bar: '#07061f', accent: '#ffd24a', primary: '#6352e0', bg: '#14123d', card: '#1e1c52', text: '#eceaff', muted: '#b4b0e0', line: '#34308a', soft: '#17154a', hero: '#1a1850', herotext: '#ffffff', r: '14px', foot: '#07061f', dk: '#0b1030' },
  giardino: { top: '#1f5a38', head: '#2f7d4f', bar: '#163f28', accent: '#f2b134', primary: '#2a7347', bg: '#f2f8ec', card: '#ffffff', text: '#1d3a2a', muted: '#4c6656', line: '#d8e6cf', soft: '#f7fbf3', hero: '#e6f3da', herotext: '#225f3a', r: '16px', foot: '#163f28', dk: '#163f28' },
  retro: { top: '#0a0618', head: '#2a1458', bar: '#06030f', accent: '#00f5d4', primary: '#c2186f', bg: '#120a26', card: '#1d1040', text: '#f3eaff', muted: '#b9a7e3', line: '#4a2d91', soft: '#150c30', hero: '#190d38', herotext: '#00f5d4', r: '2px', foot: '#06030f', dk: '#06030f' },
  // Temi della 1.x: stessi id, palette ricavate da quelle esistenti
  dark: { top: '#091e2c', head: '#124c66', bar: '#06141d', accent: '#91dcff', primary: '#1f6f96', bg: '#101c25', card: '#1c2c38', text: '#edf5f9', muted: '#c3d4de', line: '#3d5566', soft: '#273e4c', hero: '#16252f', herotext: '#91dcff', r: '6px', foot: '#091e2c', dk: '#10212d' },
  contrast: { top: '#000000', head: '#000000', bar: '#000000', accent: '#ffd400', primary: '#000000', bg: '#ffffff', card: '#ffffff', text: '#000000', muted: '#181818', line: '#000000', soft: '#ffffff', hero: '#ffffff', herotext: '#000000', r: '0px', foot: '#000000', dk: '#000000' },
  cyber: { top: '#080817', head: '#181030', bar: '#05050f', accent: '#5df3ef', primary: '#b4237f', bg: '#090b19', card: '#15172b', text: '#eefcff', muted: '#c8cee8', line: '#3a3d66', soft: '#23213d', hero: '#11122a', herotext: '#5df3ef', r: '0px', foot: '#080817', dk: '#101326' },
  mountain: { top: '#173c34', head: '#244f43', bar: '#10291f', accent: '#c9a227', primary: '#244f43', bg: '#eef1eb', card: '#fffef8', text: '#293e35', muted: '#4e6154', line: '#c9d3c2', soft: '#e8eee3', hero: '#fffef8', herotext: '#285b48', r: '4px', foot: '#173c34', dk: '#173c34' },
  terminal: { top: '#07120c', head: '#10251b', bar: '#040b07', accent: '#91ec9f', primary: '#1d6b35', bg: '#09140d', card: '#102016', text: '#d8f8de', muted: '#b5dbbe', line: '#2f5a3c', soft: '#193122', hero: '#0c1a12', herotext: '#91ec9f', r: '0px', foot: '#07120c', dk: '#07130c' },
  fog: { top: '#35463c', head: '#53665b', bar: '#26332b', accent: '#c9b458', primary: '#465b4e', bg: '#eeeee9', card: '#fafbf7', text: '#303c35', muted: '#515f55', line: '#d3d8cf', soft: '#e7ebe3', hero: '#fafbf7', herotext: '#3d5944', r: '16px', foot: '#35463c', dk: '#35463c' }
};
const scuri = ['spazio', 'retro', 'dark', 'cyber', 'terminal'];

// Colori delle categorie: chiari sui temi scuri (come nel file di riferimento)
const categorie = { blu: ['#1f6fbf', '#6ab0ff'], viola: ['#7a3fa6', '#c394f0'], verde: ['#177a43', '#5fdc94'], arancio: ['#a9530f', '#ffa766'], rosso: ['#c0224a', '#ff7f9f'], acqua: ['#0b7474', '#58dede'], grigio: ['#5b6b7d', '#b9c4d2'] };

function lum(hex) {
  const c = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrasto = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const miscela = (a, b, quota) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * quota + parseInt(b.slice(i, i + 2), 16) * (1 - quota)).toString(16).padStart(2, '0')).join('');
const errori = [];
for (const [id, t] of Object.entries(temi)) {
  const onp = t.onprimary || '#ffffff';
  const coppie = [
    ['testo/sfondo', t.text, t.bg, 4.5], ['testo/card', t.text, t.card, 4.5], ['testo/soft', t.text, t.soft, 4.5],
    ['ora/conversazione', t.muted, miscela(t.primary, t.card, 0.14), 4.5], ['secondario/card', t.muted, t.card, 4.5], ['secondario/sfondo', t.muted, t.bg, 4.5], ['titolo/hero', t.herotext, t.hero, 4.5],
    ['testo/hero', t.text, t.hero, 4.5], ['pulsante', onp, t.primary, 4.5], ['testata', '#ffffff', t.head, 4.5], ['barra alta', '#ffffff', t.top, 4.5],
    ['barra Live', '#c9d6e6', t.bar, 4.5], ['piede', '#c9d6e6', t.foot, 4.5], ['numero sulla barra Live', t.liveaccent || t.accent, t.bar, 4.5], ['scuro su accento', t.dk, t.accent, 4.5],
    ['evidenza/card (numeri, link: usa --herotext)', t.herotext, t.card, 4.5]
  ];
  for (const [nome, a, b, min] of coppie) {
    const c = contrasto(a, b);
    if (c < min) errori.push(`${id}: ${nome} ${a} su ${b} = ${c.toFixed(2)} (min ${min})`);
  }
  for (const [nome, [chiaro, scuro]] of Object.entries(categorie)) {
    const col = scuri.includes(id) ? scuro : chiaro;
    const c = contrasto(col, t.card);
    if (c < 4.5) errori.push(`${id}: categoria ${nome} ${col} su ${t.card} = ${c.toFixed(2)}`);
  }
}

let css = '/* Generato da scripts/genera-temi.js: non modificare a mano. Variabili dei temi di «Aspetto». */\n';
for (const [id, t] of Object.entries(temi)) {
  const sel = id === 'classic' ? ':root,html[data-theme=classic]' : `html[data-theme=${id}]`;
  css += `${sel}{${scuri.includes(id) ? 'color-scheme:dark;' : 'color-scheme:light;'}${Object.entries(t).map(([k, v]) => `--${k}:${v}`).join(';')};--onprimary:${t.onprimary || '#ffffff'}`;
  for (const [nome, [chiaro, scuro]] of Object.entries(categorie)) css += `;--cat-${nome}:${scuri.includes(id) ? scuro : chiaro}`;
  css += '}\n';
}

if (errori.length) { console.error('Contrasti insufficienti:\n' + errori.join('\n')); process.exitCode = 1; }
else console.log(`Contrasti verificati su ${Object.keys(temi).length} temi: tutti almeno 4,5:1.`);
if (process.argv.includes('--verifica')) {
  if (fs.readFileSync(path.join(__dirname, '..', 'public', 'theme.css'), 'utf8') !== css) { console.error('theme.css non aggiornato: eseguire node scripts/genera-temi.js'); process.exitCode = 1; }
} else fs.writeFileSync(path.join(__dirname, '..', 'public', 'theme.css'), css);
module.exports = { temi, scuri, contrasto };
