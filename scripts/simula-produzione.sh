#!/usr/bin/env bash
# Crea una «build adattata» che imita l'installazione di produzione, che non è questo repository ma un'altra linea di codice
# (vedi docs/produzione-vs-repo.md): testi dell'ente scritti direttamente nell'HTML, percorso base fisso, Express 5,
# accesso di prova al posto di MSAL (modalità DEMO, GLPI finto). Serve a riprodurre i difetti del porting e a collaudare
# scripts/verifica-deploy.js e scripts/rilascio.sh senza toccare il server vero.
#
#   scripts/simula-produzione.sh DESTINAZIONE [--difetto-css] [--express4]
#     --difetto-css  come il porting del rilascio annullato: index.html senza i collegamenti a theme.css e temi.css
#     --express4     lascia Express 4 (predefinito: Express 5, come in produzione)
# Avvio della copia: cd DESTINAZIONE && DEMO=1 PORT=3101 node src/server.js
set -euo pipefail
dest="${1:?Uso: scripts/simula-produzione.sh DESTINAZIONE [--difetto-css] [--express4]}"; shift
difetto=0; express=5
for a in "$@"; do
  case "$a" in
    --difetto-css) difetto=1 ;;
    --express4) express=4 ;;
    *) echo "Opzione sconosciuta: $a" >&2; exit 2 ;;
  esac
done
repo="$(cd "$(dirname "$0")/.." && pwd)"
case "$(cd "$(dirname "$dest")" 2>/dev/null && pwd)/$(basename "$dest")" in
  "$repo"|"$repo"/*) echo "La destinazione deve stare fuori dal repository" >&2; exit 2 ;;
esac
rm -rf "$dest"; mkdir -p "$dest"
# Solo i file del progetto: niente .git, dipendenze, dati, prove o materiale riservato
tar -C "$repo" -cf - --exclude=./.git --exclude=./node_modules --exclude=./data --exclude=./.cache --exclude=./artifacts \
  --exclude=./verifica-v2 --exclude='./PROMPT*' --exclude=./docs/design-v2 --exclude=./.claude . | tar -C "$dest" -xf -

# Testi dell'ente scritti nell'HTML e percorso base fisso, come nel file di produzione (i segnaposto di versione e aspetto
# restano: li sostituisce il server)
node - "$dest" <<'NODE'
const fs = require('fs'), path = require('path');
const dest = process.argv[2];
const ente = JSON.parse(fs.readFileSync(path.join(dest, 'config', 'ente.example.json'), 'utf8'));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const val = (k) => k.split('.').reduce((o, x) => (o && typeof o === 'object' ? o[x] : undefined), ente);
const s = ente.servizio || {};
const extra = {
  _emailHtml: s.email ? `<p>Posta elettronica: <a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>` : '',
  _telefonoHtml: s.telefonoUrgenze ? `<p>Telefono per le urgenze: ${esc(s.telefonoUrgenze)}</p>` : ''
};
const file = path.join(dest, 'public', 'index.html');
const html = fs.readFileSync(file, 'utf8').replace(/\{\{([\w.]+)\}\}/g, (m, k) => (k in extra ? extra[k] : esc(val(k)))).replaceAll('__BASE__', '/assistenza');
fs.writeFileSync(file, html);
NODE

if [ "$difetto" = 1 ]; then
  sed -i -E '/<link[^>]+\/(theme|temi)\.css/d' "$dest/public/index.html"
  echo "Difetto del porting applicato: index.html senza theme.css e temi.css"
fi

cd "$dest"
npm ci --no-audit --no-fund --silent
if [ "$express" = 5 ]; then npm install --no-audit --no-fund --silent express@5; fi
echo "Build adattata pronta in $dest (Express $(node -p "require('express/package.json').version"))"
echo "Avvio: cd $dest && DEMO=1 PORT=3101 node src/server.js"
