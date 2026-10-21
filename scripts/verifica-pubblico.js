// Controlla i file versionati; i risultati mostrano solo percorso e regola, mai il valore trovato.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const sqlEsempio = new Set(['deploy/glpi/profilo-tecnico-ticket.sql', 'deploy/glpi/trigger-anti-duplicati.sql']);
const regole = [
  ['chiave privata', /-----BEGIN (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----/],
  ['token GitHub', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['indirizzo privato', /\b(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/],
  ['percorso personale Windows', /[A-Z]:\\Users\\[^\s<>/\\]+/i],
  ['segreto assegnato', /(?:GLPI_(?:APP|USER)_TOKEN|OIDC_CLIENT_SECRET|SESSION_SECRET)\s*=\s*[A-Za-z0-9_+\/-]{24,}/]
];
// Elenco facoltativo locale: un termine per riga, mai versionato e mai scritto nel log.
const riservati = path.join(root, 'config/termini-riservati.txt');
if (fs.existsSync(riservati)) {
  for (const termine of fs.readFileSync(riservati, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'))) {
    regole.push(['termine riservato', new RegExp(termine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')]);
  }
}
let errori = 0;
for (const f of files) {
  if (!fs.existsSync(path.join(root, f))) continue;
  if (/(?:^|\/)(?:\.env(?:\.(?!example$).*)?|id_rsa.*|id_ed25519.*|known_hosts|authorized_keys|config_db\.php|glpicrypt\.key)$|\.(?:pem|key|pfx|p12|sql|dump|zip|tar|gz)$/i.test(f) && !sqlEsempio.has(f) || /^(?:private-downloads|data|uploads)\//.test(f) || /^(?:config\/(?:ente|categorie|link-utili)|content\/numeri-interni)\.json$/.test(f)) {
    console.error(`${f}: file riservato o archivio`); errori++;
  }
  const b = fs.readFileSync(path.join(root, f));
  if (b.includes(0)) continue; // immagini/font: revisione visiva e metadati separati
  const s = b.toString('utf8');
  for (const [nome, regex] of regole) if (regex.test(nome === 'segreto assegnato' ? s.replace('SESSION_SECRET=sostituisci-con-una-stringa-casuale-lunga', '') : s)) { console.error(`${f}: ${nome}`); errori++; }
}
console.log(`${files.length} file versionati controllati; ${errori} segnalazioni.`);
console.log('Il controllo non sostituisce la revisione di immagini, metadati, cronologia e contenuti editoriali.');
process.exitCode = errori ? 1 : 0;
