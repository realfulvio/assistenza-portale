# Apache come reverse proxy HTTPS

Il portale ascolta solo su `127.0.0.1:3000`; Apache lo pubblica in HTTPS. L'esempio crea un **vhost separato** e non tocca quello di GLPI.

## 1. Moduli

```bash
sudo a2enmod ssl proxy proxy_http headers      # [testato]
```

## 2. Certificato

- **Consigliato**: un certificato della CA interna dell'ente o di una CA pubblica, con il nome DNS del portale.
- **Autofirmato** (solo se non hai alternative) **[testato]**:
  ```bash
  sudo openssl req -x509 -newkey rsa:2048 -nodes -days 1825 \
    -keyout /etc/ssl/private/portale.key -out /etc/ssl/certs/portale.crt \
    -subj "/CN=<portale.tuoente.it>" \
    -addext "subjectAltName=DNS:<portale.tuoente.it>"
  sudo chmod 600 /etc/ssl/private/portale.key
  ```
  Va poi distribuito ai PC come **autorità radice attendibile** (es. con una GPO in Active Directory), altrimenti il browser mostra un avviso.

### Firefox e i certificati interni

Firefox per impostazione predefinita usa un proprio archivio di certificati. Per fargli accettare quelli distribuiti in Windows (es. via GPO) si può usare il criterio aziendale **`Certificates` > `ImportEnterpriseRoots`** (file `policies.json` o modelli ADMX di Firefox). Documentazione: https://mozilla.github.io/policy-templates/#certificates--importenterpriseroots . Non testato dall'autore.

## 3. Vhost

```bash
sudo cp deploy/apache/assistenza.conf.example /etc/apache2/conf-available/assistenza.conf
sudo nano /etc/apache2/conf-available/assistenza.conf     # sostituisci i segnaposto <...>
sudo a2enconf assistenza
sudo apachectl configtest                                 # deve dire "Syntax OK"
sudo systemctl restart apache2                            # breve interruzione anche per GLPI: scegli un momento tranquillo
```

**Verifica [testato]**:
```bash
curl -sk -o /dev/null -w "%{http_code}\n" https://<portale.tuoente.it>/assistenza/   # 200
curl -s  -o /dev/null -w "%{http_code}\n" http://127.0.0.1/                           # GLPI deve continuare a rispondere 200 o 302
```

Se GLPI non risponde più: `sudo a2disconf assistenza && sudo systemctl restart apache2` e controlla `/var/log/apache2/error.log`.

## 4. Header di sicurezza

Il portale imposta da solo Content Security Policy, X-Frame-Options e gli altri header (libreria Helmet). L'header **HSTS** si attiva con `HSTS=1` in `.env`, **solo** con un certificato definitivo e fidato.
