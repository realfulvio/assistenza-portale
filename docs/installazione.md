# Installazione

Guida per Debian 13 (provata) e Debian 12 (non provata, i comandi dovrebbero essere uguali). Comandi da eseguire sul server come utente con `sudo`.

Legenda: **[testato]** = provato dall'autore su Debian 13 / GLPI 11.0.8; **[non testato]** = scritto per completezza, verifica tu.

## 0. Prima di iniziare

- Fai un **backup** del database di GLPI e della configurazione di Apache:
  ```bash
  sudo mkdir -p /root/backup-prima-portale
  sudo mariadb-dump --single-transaction glpidb | sudo tee /root/backup-prima-portale/glpidb.sql > /dev/null   # [testato]
  sudo cp -a /etc/apache2 /root/backup-prima-portale/apache2                                                # [testato]
  ```
  (sostituisci `glpidb` con il nome del tuo database: lo trovi in `/var/www/glpi/config/config_db.php`, voce `dbdefault`).
- Prepara GLPI e l'utente di servizio: [glpi.md](glpi.md).
- Registra l'app nel provider di accesso: [accesso-microsoft-entra.md](accesso-microsoft-entra.md).

## 1. Node.js

```bash
sudo apt install nodejs npm      # [testato su Debian 13: Node 20.19] (npm serve solo per scaricare le dipendenze)
node -v                          # deve essere 20 o superiore
```

## 2. Utente di sistema e cartella

```bash
sudo useradd --system --home /opt/portale-assistenza --shell /usr/sbin/nologin portale   # [testato]
sudo mkdir -p /opt/portale-assistenza
```

## 3. Scaricare il progetto

```bash
cd /tmp
git clone https://github.com/realfulvio/assistenza-portale.git        # [non testato finche' il repository non e' pubblico]
sudo cp -r assistenza-portale/. /opt/portale-assistenza/
cd /opt/portale-assistenza
sudo npm install --omit=dev                                           # [testato in locale]
```

In alternativa scarica lo ZIP da GitHub (*Code > Download ZIP*) e copialo con `scp`.

## 4. Configurazione

```bash
cd /opt/portale-assistenza
sudo cp .env.example .env
sudo cp config/ente.example.json config/ente.json
sudo cp config/categorie.example.json config/categorie.json
sudo nano .env                      # compila OIDC_*, GLPI_*, PUBLIC_URL, SESSION_SECRET
openssl rand -hex 32                # da usare come SESSION_SECRET
sudo chown -R portale:portale /opt/portale-assistenza
sudo chmod 600 .env
```

Cosa compilare: vedi i commenti in `.env.example`, [personalizzazione.md](personalizzazione.md) per `config/ente.json` e [glpi.md](glpi.md) per gli id delle categorie GLPI in `config/categorie.json`.

## 5. Avvio con systemd

```bash
sudo cp deploy/portale-assistenza.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now portale-assistenza      # [testato]
systemctl status portale-assistenza                 # deve dire "active (running)"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/assistenza/   # deve rispondere 200
```

**Errore tipico**: il servizio si riavvia di continuo. Guarda il log:
```bash
sudo journalctl -u portale-assistenza -n 30
```
«Configurazione incompleta: …» indica la variabile mancante in `.env`.

## 6. Apache e HTTPS

Vedi [apache-reverse-proxy.md](apache-reverse-proxy.md).

## 7. Prova finale

1. Apri `https://<tuo-portale>/assistenza/` e accedi.
2. Apri una richiesta con uno screenshot, annota il numero.
3. In GLPI controlla: richiedente, categoria, gruppo assegnato, allegato, mail ricevuta.
4. Elimina il ticket di prova.

## Aggiornare il portale

Vedi [aggiornamento-e-backup.md](aggiornamento-e-backup.md).
