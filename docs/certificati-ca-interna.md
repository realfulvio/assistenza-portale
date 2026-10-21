# CA interna: creazione e certificato del sito

Un **certificato del sito emesso da una CA pubblica** è normalmente riconosciuto dai browser supportati, se nome DNS, validità e catena sono corretti. Un certificato **firmato da una CA interna** richiede invece che i client considerino attendibile quella CA. Il certificato pubblico della CA contiene la chiave pubblica: non è la sua chiave privata.

Se esiste già una PKI gestita, usa quella e le sue procedure di emissione, rinnovo e revoca. I comandi seguenti sono un esempio minimo di CA interna, non una PKI completa: non configurano la pubblicazione di CRL/OCSP. Prima dell'adozione definisci protezione della chiave, revoca e rinnovo con l'amministratore della PKI.

Un certificato autofirmato non è necessariamente una CA: dipende dalle estensioni. Non usare un certificato con `CA:TRUE` come certificato del sito; Firefox può rifiutarlo con `MOZILLA_PKIX_ERROR_CA_CERT_USED_AS_END_ENTITY`. Il certificato del sito nell'esempio ha `CA:FALSE`.

Comandi dell'esempio già provati su Debian 13 con OpenSSL 3.5 (da root), qui con nomi neutri: `portale.ente.example` e `glpi.ente.example`. I percorsi sono d'esempio. Questa guida riguarda HTTPS del portale e del backend GLPI; non modifica il codice del portale.

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

`ca.key` è la chiave privata della CA: proteggila secondo le procedure della PKI, con eventuali backup protetti. **Non distribuirla ai client**, né includerla in mail o repository. Anche la chiave privata del sito resta sul server: per la fiducia dei client si distribuisce soltanto il certificato pubblico della CA radice.

## 2. Certificato del sito (397 giorni nell'esempio)

```bash
cd /etc/ssl/portale-ca
cat > sito.ext <<EOF
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:portale.ente.example,DNS:glpi.ente.example
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EOF
openssl genrsa -out sito.key 2048 && chmod 600 sito.key
openssl req -new -key sito.key -out sito.csr -subj "/O=Il tuo ente/CN=portale.ente.example"
openssl x509 -req -in sito.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out sito.crt -days 397 -sha256 -extfile sito.ext
openssl verify -CAfile ca.crt sito.crt          # deve dire: sito.crt: OK
```

397 giorni è una scelta per questo esempio di CA interna, non un limite universale dei browser. Per certificati pubblici segui i requisiti correnti della CA e dei browser; per una PKI interna definisci una durata coerente con le sue procedure.

## 3. Installazione in Apache (catena completa)

```bash
cat sito.crt ca.crt > /etc/ssl/certs/portale.crt        # certificato + CA
install -m 600 sito.key /etc/ssl/private/portale.key
apachectl configtest && systemctl restart apache2        # restart, non reload
```

Nei vhost (`deploy/apache/*.conf.example`) `SSLCertificateFile` e `SSLCertificateKeyFile` devono puntare a questi due file.

## 4. Verifica

```bash
echo | openssl s_client -connect 127.0.0.1:443 -servername portale.ente.example -CAfile /etc/ssl/portale-ca/ca.crt 2>/dev/null | grep "Verify return code"
#  -> Verify return code: 0 (ok)
curl --cacert /etc/ssl/portale-ca/ca.crt --resolve portale.ente.example:443:127.0.0.1 -o /dev/null -w "%{http_code}\n" https://portale.ente.example/assistenza/
#  -> 200
```

La verifica OpenSSL con `-CAfile` controlla la catena rispetto alla CA indicata, ma non dimostra la distribuzione della fiducia su Windows o il funzionamento della revoca. Per distinguere errori di autorità e di revoca vedi la [diagnosi sui client Windows](https-ca-dominio.md#due-errori-che-non-sono-la-stessa-cosa). Non disabilitare verifiche TLS o revoca per aggirare un errore.

## 5. Distribuire la CA ai PC

Distribuisci **solo il certificato pubblico della CA radice**, mai chiavi private. La configurazione della GPO, la sua applicazione sul client e la verifica nel browser sono controlli distinti.

La procedura completa è in [HTTPS e CA sui PC Windows in dominio](https-ca-dominio.md): impronta esatta, archivio macchina, Chrome/Edge/Firefox, ambito e contenitore Computers, nuovi PC, comandi diagnostici, aggiornamento normale e limiti delle verifiche. La distribuzione del collegamento desktop va valutata separatamente.

## 6. Rinnovo

Ogni anno (prima della scadenza: `openssl x509 -in /etc/ssl/certs/portale.crt -noout -enddate`) ripeti il punto 2 e il punto 3 con la stessa CA: i PC non devono fare nulla. La CA scade dopo 10 anni.
