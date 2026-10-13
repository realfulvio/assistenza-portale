# Aggiornamento e backup

## Cosa salvare

Il portale **non contiene dati**: richieste, utenti e allegati stanno in GLPI. Del portale bastano:
- `/opt/portale-assistenza/.env` (segreti: conservalo cifrato o in un posto protetto);
- `/opt/portale-assistenza/config/` e `/opt/portale-assistenza/content/` (personalizzazioni);
- l'eventuale logo in `public/img/`.

```bash
sudo tar czf /root/portale-config-$(date +%F).tgz -C /opt/portale-assistenza .env config content public/img   # [testato in forma equivalente]
```

Per GLPI segui la [documentazione ufficiale](https://glpi-user-documentation.readthedocs.io/): database (`mariadb-dump`), cartella `files/` e **`config/glpicrypt.key`** (senza questa chiave i token e le password cifrate nel backup non sono recuperabili).

## Aggiornare il portale

```bash
sudo tar czf /root/portale-prima-aggiornamento.tgz -C /opt/portale-assistenza --exclude=node_modules .   # backup
cd /tmp && rm -rf assistenza-portale && git clone https://github.com/realfulvio/assistenza-portale.git    # [non testato finche' il repo non e' pubblico]
sudo rsync -a --exclude .env --exclude config/ente.json --exclude config/categorie.json \
  /tmp/assistenza-portale/ /opt/portale-assistenza/                                                       # [non testato]
cd /opt/portale-assistenza && sudo npm install --omit=dev
sudo chown -R portale:portale /opt/portale-assistenza
sudo systemctl restart portale-assistenza
```

Leggi prima il [CHANGELOG](../CHANGELOG.md): se compaiono nuove variabili, aggiungile al tuo `.env` partendo da `.env.example`.

**Tornare indietro**:
```bash
sudo tar xzf /root/portale-prima-aggiornamento.tgz -C /opt/portale-assistenza
sudo systemctl restart portale-assistenza
```

## Controlli periodici

- `cd /opt/portale-assistenza && npm audit` (vulnerabilità note nelle dipendenze).
- Aggiornamenti di sistema: `sudo apt update && sudo apt upgrade` (dopo aggiornamenti di Apache o OpenSSL, se usi mod_auth_openidc, preferisci `systemctl restart apache2`).
- Scadenza del client secret OIDC e del certificato HTTPS.
- Dopo un aggiornamento di GLPI: prova un'apertura di richiesta e controlla l'eventuale trigger delle notifiche.
