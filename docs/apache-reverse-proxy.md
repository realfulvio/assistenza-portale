# Apache come reverse proxy HTTPS

Il portale ascolta solo su `127.0.0.1:3000`; Apache lo pubblica in HTTPS. L'esempio crea un **vhost separato** e non tocca quello di GLPI.

## 1. Moduli

```bash
sudo a2enmod ssl proxy proxy_http headers      # [testato]
```

## 2. Certificato

- **Consigliato**: un certificato della CA interna dell'ente o di una CA pubblica, con il nome DNS del portale.
- **CA interna + certificato del sito** (se non hai alternative): guida completa in [certificati-ca-interna.md](certificati-ca-interna.md). Evita i certificati **autofirmati**: Firefox li rifiuta con `MOZILLA_PKIX_ERROR_CA_CERT_USED_AS_END_ENTITY`.

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
