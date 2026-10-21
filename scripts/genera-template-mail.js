// Genera il modello delle mail di GLPI (HTML e testo) con i dati del tuo ente.
// Legge config/ente.json (o l'esempio) e l'URL pubblico del portale da PUBLIC_URL + BASE_PATH (.env).
// Uso: npm run template-mail   ->  crea deploy/glpi/mail-ticket.html e deploy/glpi/mail-ticket.txt
// Poi copia il contenuto nel modello di notifica "Tickets" di GLPI (vedi docs/notifiche-mail.md).
const fs = require('fs');
const path = require('path');
const config = require('../src/config');

const dir = path.join(config.root, 'deploy', 'glpi');
const e = config.ente;
const urlPortale = (config.publicUrl || 'https://portale.esempio.it') + (config.base || '') ;
const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colore = (v, d) => (/^#[0-9a-fA-F]{3,8}$/.test(String(v || '')) ? v : d);

const valori = {
  ENTE: e.ente?.nome,
  SERVIZIO: e.servizio?.nome,
  SERVIZIO_MAIUSCOLO: String(e.servizio?.nome || '').toUpperCase(),
  SOTTOTITOLO: e.servizio?.sottotitolo,
  UFFICIO: e.servizio?.ufficio,
  URL_PORTALE: urlPortale,
  URL_PORTALE_TESTO: urlPortale.replace(/^https?:\/\//, ''),
  COLORE: colore(e.grafica?.colorePrimario, '#005e8e'),
  COLORE_BARRA: colore(e.grafica?.coloreBarra, '#001a4d')
};

for (const [modello, uscita, html] of [['mail-ticket.modello.html', 'mail-ticket.html', true], ['mail-ticket.modello.txt', 'mail-ticket.txt', false]]) {
  const testo = fs.readFileSync(path.join(dir, modello), 'utf8')
    .replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (html ? escHtml(valori[k] ?? '') : String(valori[k] ?? '')));
  fs.writeFileSync(path.join(dir, uscita), testo);
  console.log('creato', path.relative(config.root, path.join(dir, uscita)));
}
if (!config.publicUrl) console.log('Nota: PUBLIC_URL non impostato, uso https://portale.esempio.it come esempio.');
