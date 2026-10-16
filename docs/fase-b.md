# Fase B: v2.0.0 in produzione senza ripetere l'errore

Da eseguire **solo con il server Debian raggiungibile** (rete dell'ente o VPN). La fase A (correzioni, verifiche e
script) è nel ramo `v2.0`: prima di iniziare controllala con `git log --oneline -15 v2.0` e, sul minipc,
`npm ci && npm run lint && npm test`. Strada scelta e differenze note: [produzione-vs-repo.md](produzione-vs-repo.md).

Segnaposto usati qui sotto (nessun valore reale nel repository):

| Segnaposto | Significato |
|---|---|
| `<server>` | alias SSH del server Debian (da aggiungere a `~/.ssh/config` se manca) |
| `<app>` | cartella del portale in produzione (es. `/opt/portale-assistenza`) |
| `<servizio>` | unità systemd del portale (es. `portale-assistenza`) |
| `<porta>` | porta locale del portale in produzione (es. `3000`) |

Regole: niente modifiche a Entra, alla configurazione, alle regole o ai dati di GLPI; nessun pacchetto di sistema;
mai stampare password o token (i comandi leggono i segreti dal `.env` senza mostrarli); l'accesso di prova esiste
**solo** nella copia di staging.

## 0. Raggiungibilità

```bash
ssh -o ConnectTimeout=8 -o BatchMode=yes <server> true && echo raggiungibile
```

## 1. Confronto reale, in sola lettura

```bash
ssh <server> 'bash -s' <<'EOF'
systemctl cat <servizio> | grep -E '^(User|WorkingDirectory|ExecStart|EnvironmentFile|ReadWritePaths|StateDirectory|ProtectSystem|Environment)='
node --version
cd <app> && ls -la && git -C <app> log --oneline -3 2>/dev/null
node -p "Object.keys(require('./package.json').dependencies).join(' ')"
node -p "require('express/package.json').version"
sed 's/=.*//' .env | sort          # solo i NOMI delle variabili, mai i valori
grep -rlE "msal|@azure" --include=*.js . | grep -v node_modules | head
find . -name index.html -not -path './node_modules/*'
EOF
```

Confronta la pagina servita con quella del repository (collegamenti, segnaposto, testi):

```bash
ssh <server> "curl -s http://127.0.0.1:<porta>/assistenza/" > /tmp/prod-index.html
grep -oE '<(link|script)[^>]+' /tmp/prod-index.html
```

Aggiorna la tabella in `docs/produzione-vs-repo.md` (senza valori riservati) e compila la corrispondenza delle
variabili d'ambiente. Se emergono funzioni presenti solo in produzione, valuta la strada B (vedi la stessa pagina).

**Diritto GLPI sulle attività pubbliche** (sola lettura, nessuna modifica a GLPI): scegli un ticket con almeno
un'attività pubblica e prova la lettura con il profilo di servizio del portale.

```bash
ssh <server> 'bash -s' <<'EOF'
cd <app>; set -a; . ./.env; set +a
T=$(curl -s -H "App-Token: $GLPI_APP_TOKEN" -H "Authorization: user_token $GLPI_USER_TOKEN" "$GLPI_URL/apirest.php/initSession" | node -pe 'JSON.parse(require("fs").readFileSync(0)).session_token')
curl -s -o /dev/null -w 'TicketTask: HTTP %{http_code}\n' -H "App-Token: $GLPI_APP_TOKEN" -H "Session-Token: $T" "$GLPI_URL/apirest.php/Ticket/<id ticket>/TicketTask"
curl -s -H "App-Token: $GLPI_APP_TOKEN" -H "Session-Token: $T" "$GLPI_URL/apirest.php/killSession" > /dev/null
EOF
```

`200` = diritto presente; `401`/`403` con `ERROR_RIGHT_MISSING` = manca «Attività > Vedere le attività pubbliche»
nel profilo API: **non modificarlo**, riportalo come azione per l'amministratore (vedi [glpi.md](glpi.md)).

**Cartelle scrivibili dal servizio** (preferenze e foto):

```bash
ssh <server> 'systemctl show <servizio> -p User -p StateDirectory -p ReadWritePaths -p ProtectSystem; ls -ld /var/lib/<servizio> 2>&1'
```

Con l'unità standard (`deploy/portale-assistenza.service`) systemd crea `/var/lib/portale-assistenza` (0700,
proprietario l'utente del servizio). Se l'unità di produzione è personalizzata, aggiungi il drop-in
`deploy/aspetto-systemd.conf.example` (richiede `sudo`: chiedilo all'amministratore).

## 2. Copia di staging sul server

Codice del repository (strada A) più la configurazione dell'istanza, sulla porta `3200` solo su `127.0.0.1`,
con lo stesso Node della produzione. L'accesso di prova (`DEMO=1`, GLPI finto) vale **solo** qui.

```bash
# dal portatile o dal minipc: pacchetto della v2 senza file riservati
git -C assistenza-portale archive --format=tar.gz -o /tmp/portale-v2.tar.gz v2.0
scp /tmp/portale-v2.tar.gz <server>:/tmp/
ssh <server> 'bash -s' <<'EOF'
set -e
S=$HOME/portale-staging; rm -rf "$S"; mkdir -p "$S/app" "$S/dati"
tar -xzf /tmp/portale-v2.tar.gz -C "$S/app"
cd "$S/app" && npm ci --omit=dev --no-audit --no-fund
cp <app>/config/ente.json config/ 2>/dev/null || echo "ente.json da creare dai testi dell'HTML di produzione"
cp <app>/config/categorie.json config/ 2>/dev/null || true
cp -n <app>/public/img/* public/img/ 2>/dev/null || true      # stemma e immagini dell'ente
DEMO=1 HOST=127.0.0.1 PORT=3200 PREFERENCES_DIR="$S/dati/pref" AVATAR_DIR="$S/dati/av" \
  setsid nohup node src/server.js > "$S/staging.log" 2>&1 < /dev/null &
sleep 2; curl -s -o /dev/null -w 'staging HTTP %{http_code}\n' http://127.0.0.1:3200/assistenza/
EOF
```

Se `config/ente.json` non esiste in produzione, crealo da `config/ente.example.json` riportando i testi che oggi
sono scritti nell'HTML di produzione (nome dell'ente, sito, piede, servizio, ufficio, email, logo, colori).

## 3. Verifica della staging (Playwright sul minipc, tunnel SSH)

```bash
ssh dev 'bash -s' <<'EOF'
cd /srv/dev/projects/assistenza-portale-test/repo
ssh -f -N -L 3200:127.0.0.1:3200 <server>
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" node scripts/verifica-deploy.js http://127.0.0.1:3200/assistenza/ --accesso-demo --screenshot ../out/staging
EOF
scp -r dev:/srv/dev/projects/assistenza-portale-test/out/staging verifica-v2/staging
```

Guarda gli screenshot dei 5 temi su desktop e telefono (Nuova richiesta, Dettaglio, Le mie richieste, esito, PDF).
Si procede **solo** se la verifica termina con «Verifica superata» e gli screenshot sono corretti.

## 4. Passaggio in produzione con rollback automatico

Prepara la nuova versione sul server (stesso pacchetto della staging, senza `DEMO`), poi esegui il rilascio
(serve `sudo` per sostituire `<app>` e riavviare il servizio):

```bash
ssh <server> 'bash -s' <<'EOF'
set -e
N=$HOME/portale-v2-nuova; rm -rf "$N"; mkdir -p "$N"
tar -xzf /tmp/portale-v2.tar.gz -C "$N" && cd "$N" && npm ci --omit=dev --no-audit --no-fund
sudo bash "$N/scripts/rilascio.sh" --nuova "$N" --app <app> \
  --url http://127.0.0.1:<porta>/assistenza/ \
  --riavvio "systemctl restart <servizio>" \
  --dati "/var/lib/<servizio>" --backup /var/backups/portale-assistenza \
  --conserva ".env config/ente.json config/categorie.json" \
  --controllo "sleep 5; ! journalctl -u <servizio> --since '-1 min' --no-pager | grep -iE 'errore|error|Configurazione incompleta'"
EOF
```

Lo script: backup completo (`/var/backups/portale-assistenza/portale-<data>.tar.gz`) e script di ripristino,
nuova cartella con la configurazione dell'istanza, controllo della configurazione, passaggio con due rinomine,
riavvio, controllo dell'HTML e delle risorse servite, controllo del log; se un controllo fallisce ripristina la
versione precedente **una sola volta** (uscita 3). Collaudato sul minipc con un errore forzato (`--prova-errore`).

Subito dopo, dall'esterno del server, i controlli pubblici sull'istanza vera (nessun login automatico):

```bash
ssh dev 'cd /srv/dev/projects/assistenza-portale-test/repo && ssh -f -N -L 3300:127.0.0.1:<porta> <server> && PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" node scripts/verifica-deploy.js http://127.0.0.1:3300/assistenza/ --screenshot ../out/produzione'
```

Poi la prova a mano: accesso Microsoft vero, una richiesta di prova, dettaglio, PDF, foto profilo, Aspetto.

**Rollback:**

```bash
# versione precedente (cartella accanto, istantaneo)
ssh <server> 'sudo bash -c "mv <app> <app>.annullata-$(date +%s) && mv <app>.prec-<data> <app> && systemctl restart <servizio>"'
# ripristino completo dal backup (codice, configurazione e dati)
ssh <server> 'sudo bash /var/backups/portale-assistenza/rollback-<data>.sh'
```

## 5. Chiusura su GitHub (solo con la produzione verificata)

1. Scansione di sicurezza del working tree e dei commit da pubblicare (vedi `PROMPT-v2-ripresa.md`, sezione 5).
2. `CHANGELOG.md`, voce 2.0.0: temi animati **Classico, Hawaii, Spazio, Giardino e Autunno** (Retro resta tra
   «Altri temi»); modulo con gli aiuti originali e fascia oraria dalle/alle; «Le mie richieste» a righe-scheda
   con filtri e contatori; avviso nel log per le letture GLPI negate; `verifica-deploy`, `simula-produzione`,
   `rilascio.sh`; correzione dell'altezza delle righe della cronologia nel PDF.
3. Aggiorna o rimuovi `docs/v2-sospesa.md`.
4. `gh pr ready 5`, merge su `main`, tag annotato e release:

```bash
git switch main && git merge --no-ff v2.0 && git tag -a v2.0.0 -m "v2.0.0" && git push origin main v2.0.0
gh release create v2.0.0 --title "v2.0.0" --notes-file <(sed -n '/^## \[2.0.0\]/,/^## \[/p' CHANGELOG.md | sed '$d')
```

Se la produzione non supera i controlli: nessun merge, tag o release; PR in bozza con l'esito aggiornato.
