# CA interna + certificato del sito

Se l'ente non ha una CA interna o un certificato pubblico, crea una **piccola CA interna** e firma con lei il certificato del portale (e di GLPI). È la soluzione da preferire a un certificato **autofirmato**: un autofirmato è anche una CA (`CA:TRUE`) e Firefox lo rifiuta con l'errore `MOZILLA_PKIX_ERROR_CA_CERT_USED_AS_END_ENTITY`.

Comandi provati su Debian 13 con OpenSSL 3.5 (da root). Sostituisci `portale.tuoente.it` e `glpi.tuoente.it` con i tuoi nomi.

## 1. CA interna (una volta sola, 10 anni)

```bash
sudo -i
mkdir -p /etc/ssl/portale-ca && chmod 700 /etc/ssl/portale-ca && cd /etc/ssl/portale-ca
openssl genrsa -out ca.key 4096 && chmod 600 ca.key
openssl req -x509 -new -key ca.key -sha256 -days 3650 -out ca.crt \
  -subj "/O=Il tuo ente/CN=CA interna del tuo ente" \
  -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
  -addext "keyUsage=critical,keyCertSign,cRLSign" \
  -addext "subjectKeyIdentifier=hash"
```

`ca.key` è la chiave della CA: **non deve mai uscire dal server** (né finire in backup non protetti, mail o repository).

## 2. Certificato del sito (massimo 397 giorni)

```bash
cd /etc/ssl/portale-ca
cat > sito.ext <<EOF
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:portale.tuoente.it,DNS:glpi.tuoente.it
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EOF
openssl genrsa -out sito.key 2048 && chmod 600 sito.key
openssl req -new -key sito.key -out sito.csr -subj "/O=Il tuo ente/CN=portale.tuoente.it"
openssl x509 -req -in sito.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out sito.crt -days 397 -sha256 -extfile sito.ext
openssl verify -CAfile ca.crt sito.crt          # deve dire: sito.crt: OK
```

397 giorni è la durata massima accettata dai browser per i certificati dei siti.

## 3. Installazione in Apache (catena completa)

```bash
cat sito.crt ca.crt > /etc/ssl/certs/portale.crt        # certificato + CA
install -m 600 sito.key /etc/ssl/private/portale.key
apachectl configtest && systemctl restart apache2        # restart, non reload
```

Nei vhost (`deploy/apache/*.conf.example`) `SSLCertificateFile` e `SSLCertificateKeyFile` devono puntare a questi due file.

## 4. Verifica

```bash
echo | openssl s_client -connect 127.0.0.1:443 -servername portale.tuoente.it -CAfile /etc/ssl/portale-ca/ca.crt 2>/dev/null | grep "Verify return code"
#  -> Verify return code: 0 (ok)
curl --cacert /etc/ssl/portale-ca/ca.crt --resolve portale.tuoente.it:443:127.0.0.1 -o /dev/null -w "%{http_code}\n" https://portale.tuoente.it/assistenza/
#  -> 200
```

Da Windows, `curl` (Schannel) può chiedere `--ssl-no-revoke`, perché questa CA non pubblica un elenco di revoca.

## 5. Distribuire la CA ai PC

Distribuisci **solo `ca.crt`** (mai la chiave):
- Windows / Edge / Chrome: GPO > *Configurazione computer > Criteri > Impostazioni di Windows > Impostazioni di sicurezza > Criteri chiave pubblica > Autorità di certificazione radice attendibili* > Importa `ca.crt`.
- Firefox: criterio `Certificates` > `ImportEnterpriseRoots` = true (vedi [apache-reverse-proxy.md](apache-reverse-proxy.md)), oppure importazione manuale in *Impostazioni > Privacy e sicurezza > Certificati*.

## 6. Rinnovo

Ogni anno (prima della scadenza: `openssl x509 -in /etc/ssl/certs/portale.crt -noout -enddate`) ripeti il punto 2 e il punto 3 con la stessa CA: i PC non devono fare nulla. La CA scade dopo 10 anni.
