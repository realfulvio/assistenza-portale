#!/usr/bin/env bash
# Rilascio del portale con backup e rollback automatico (una sola volta). Pensato per il server Debian, collaudato in sviluppo.
#
#   scripts/rilascio.sh --nuova DIR --app DIR --url URL --riavvio "COMANDO" [opzioni]
#     --nuova DIR       albero della nuova versione già pronto (npm ci --omit=dev fatto, nessun .env)
#     --app DIR         cartella in servizio (es. /opt/portale-assistenza): viene sostituita per intero
#     --url URL         indirizzo locale del portale (es. http://127.0.0.1:3000/assistenza/)
#     --riavvio CMD     comando che riavvia il servizio (es. "systemctl restart portale-assistenza")
#     --dati "DIR ..."  cartelle dati da includere nel backup (es. /var/lib/portale-assistenza)
#     --backup DIR      dove scrivere backup e script di rollback (predefinito: <app>-backup)
#     --conserva "F ..." file dell'istanza da riportare nella nuova versione (predefinito: .env config/ente.json config/categorie.json config/link-utili.json content/numeri-interni.json)
#     --controllo CMD   controllo aggiuntivo dopo il riavvio (es. assenza di errori nel log); uscita diversa da 0 = rollback
#     --attesa S        secondi di attesa che il servizio risponda (predefinito 40)
#     --prova-errore    collaudo: fa fallire il controllo dopo il passaggio per provare il rollback
# Esito: 0 = nuova versione in servizio e verificata; 1 = errore prima del passaggio (nulla cambiato);
#        3 = controlli falliti, rollback eseguito e versione precedente di nuovo in servizio; 4 = rollback fallito (intervenire a mano).
set -Eeuo pipefail
nuova= app= url= riavvio= dati= backup= controllo= attesa=40 prova=0
conserva=".env config/ente.json config/categorie.json config/link-utili.json content/numeri-interni.json"
while [ $# -gt 0 ]; do
  case "$1" in
    --nuova) nuova="$2"; shift ;; --app) app="$2"; shift ;; --url) url="$2"; shift ;; --riavvio) riavvio="$2"; shift ;;
    --dati) dati="$2"; shift ;; --backup) backup="$2"; shift ;; --conserva) conserva="$2"; shift ;; --controllo) controllo="$2"; shift ;;
    --attesa) attesa="$2"; shift ;; --prova-errore) prova=1 ;;
    *) echo "Opzione sconosciuta: $1" >&2; exit 1 ;;
  esac
  shift
done
for v in nuova app url riavvio; do [ -n "${!v}" ] || { echo "Manca --$v" >&2; exit 1; }; done
app="${app%/}"; nuova="${nuova%/}"; backup="${backup:-$app-backup}"
ora="$(date +%Y%m%d-%H%M%S)"
precedente="$app.prec-$ora"
log() { echo "$(date +%H:%M:%S) $*"; }
stato=preparazione   # preparazione -> passaggio -> verifica -> fatto | ripristinato
rollback_fatto=0

risponde() { # attende che la pagina risponda 200
  local fine=$((SECONDS + attesa))
  while [ $SECONDS -lt $fine ]; do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url")" = 200 ]; then return 0; fi
    sleep 1
  done
  return 1
}

ripristina() {
  # Una sola volta: niente trap ricorsive né secondo rollback se qualcosa qui dentro fallisce
  [ "$rollback_fatto" = 0 ] || return 0
  rollback_fatto=1
  trap - ERR EXIT INT TERM
  set +e
  log "ROLLBACK: ripristino della versione precedente"
  if [ -d "$precedente" ]; then
    [ -e "$app" ] && mv "$app" "$app.fallita-$ora"
    mv "$precedente" "$app"
  fi
  bash -c "$riavvio"
  if risponde; then log "ROLLBACK riuscito: versione precedente di nuovo in servizio ($url). Nuova versione lasciata in $app.fallita-$ora"; exit 3
  else log "ROLLBACK FALLITO: il portale non risponde. Ripristino completo dal backup: bash $backup/rollback-$ora.sh"; exit 4; fi
}
al_termine() {
  local esito=$?
  if [ "$stato" = passaggio ] || [ "$stato" = verifica ]; then ripristina; fi
  exit "$esito"
}
trap al_termine EXIT
trap 'exit 130' INT TERM

# 1. Controlli prima di toccare qualcosa
[ -d "$app" ] || { echo "Cartella in servizio inesistente: $app" >&2; exit 1; }
[ -f "$nuova/src/server.js" ] && [ -f "$nuova/package.json" ] && [ -d "$nuova/node_modules" ] || { echo "Nuova versione incompleta (src/server.js, package.json, node_modules): $nuova" >&2; exit 1; }
[ -e "$precedente" ] && { echo "Esiste già $precedente" >&2; exit 1; }
for f in $conserva; do [ -e "$app/$f" ] || log "avviso: $f non presente nella versione in servizio"; done

# 2. Backup completo (codice, configurazione e dati) e script di rollback dal backup
mkdir -p "$backup"; chmod 700 "$backup"
archivio="$backup/portale-$ora.tar.gz"
log "backup di $app ${dati:+e $dati} in $archivio"
# shellcheck disable=SC2086
tar -czf "$archivio" -C / "${app#/}" $(for d in $dati; do [ -e "$d" ] && echo "${d#/}"; done)
cat > "$backup/rollback-$ora.sh" <<EOF
#!/usr/bin/env bash
# Ripristino completo del portale com'era il $(date '+%d/%m/%Y %H:%M') (codice, configurazione e dati del backup)
set -euo pipefail
[ -e "$app" ] && mv "$app" "$app.annullata-\$(date +%Y%m%d-%H%M%S)"
$(for d in $dati; do echo "[ -e \"$d\" ] && mv \"$d\" \"$d.annullata-\$(date +%Y%m%d-%H%M%S)\""; done)
tar -xzf "$archivio" -C /
$riavvio
echo "Ripristinato da $archivio"
EOF
chmod 700 "$backup/rollback-$ora.sh"
log "script di rollback: $backup/rollback-$ora.sh"

# 3. Nuova cartella accanto a quella in servizio, con la configurazione dell'istanza e le immagini proprie dell'ente
prossima="$app.nuova-$ora"
cp -a "$nuova" "$prossima"
for f in $conserva; do
  if [ -e "$app/$f" ]; then mkdir -p "$prossima/$(dirname "$f")"; cp -a "$app/$f" "$prossima/$f"; fi
done
if [ -d "$app/public/img" ]; then
  (cd "$app/public/img" && find . -type f) | while read -r f; do
    [ -e "$prossima/public/img/$f" ] || { mkdir -p "$prossima/public/img/$(dirname "$f")"; cp -a "$app/public/img/$f" "$prossima/public/img/$f"; log "immagine dell'istanza conservata: img/${f#./}"; }
  done
fi
[ -d "$app/data" ] && [ ! -e "$prossima/data" ] && cp -a "$app/data" "$prossima/data"
# La configurazione deve essere completa per la nuova versione (in produzione config.js si ferma se mancano i segreti)
(cd "$prossima" && NODE_ENV="${NODE_ENV_RILASCIO:-production}" node -e "require('./src/config')") || { rm -rf "$prossima"; echo "Configurazione incompleta per la nuova versione: nulla cambiato" >&2; exit 1; }

# 4. Passaggio: due rinomine nella stessa cartella, poi riavvio
stato=passaggio
log "passaggio alla nuova versione"
mv "$app" "$precedente"
mv "$prossima" "$app"
bash -c "$riavvio"

# 5. Controlli sull'istanza vera; qualsiasi errore da qui in poi fa scattare il rollback (una volta)
stato=verifica
risponde || { log "il portale non risponde entro ${attesa}s"; false; }
log "controllo HTML e risorse servite"
node "$app/scripts/verifica-rilascio.js" "$url"
if [ -n "$controllo" ]; then log "controllo aggiuntivo: $controllo"; bash -c "$controllo"; fi
if [ "$prova" = 1 ]; then log "PROVA: errore forzato dopo il passaggio"; false; fi
stato=fatto
log "RILASCIO RIUSCITO. Versione precedente in $precedente; rollback completo: bash $backup/rollback-$ora.sh"
