# Accesso con Microsoft Entra ID (o altro OpenID Connect)

Il portale usa **OpenID Connect** (Authorization Code Flow con PKCE) tramite la libreria [openid-client](https://github.com/panva/openid-client). Qui le istruzioni per Microsoft Entra ID; per altri provider servono gli stessi quattro valori (issuer, client id, client secret, redirect URI).

Documentazione ufficiale Microsoft: [Registrare un'applicazione](https://learn.microsoft.com/entra/identity-platform/quickstart-register-app). I nomi dei menu possono cambiare: in caso di dubbio fa fede quella.

## 1. Registrazione dell'app

Serve un amministratore del tenant. In **Microsoft Entra admin center** (https://entra.microsoft.com):

1. *Identità > Applicazioni > Registrazioni app > Nuova registrazione*.
2. Nome: a tua scelta (es. «Portale Assistenza»).
3. Tipi di account supportati: **solo account in questa directory organizzativa** (tenant singolo).
4. URI di reindirizzamento: piattaforma **Web**, valore
   `https://<tuo-portale>/assistenza/auth/callback`
   (deve coincidere esattamente con `OIDC_REDIRECT_URI` in `.env`; Entra accetta solo indirizzi `https`, tranne `localhost`).
5. Dalla pagina *Panoramica* copia:
   - **ID applicazione (client)** → `OIDC_CLIENT_ID`
   - **ID directory (tenant)** → serve per `OIDC_ISSUER` = `https://login.microsoftonline.com/<ID-TENANT>/v2.0` e, se vuoi limitare l'accesso al tuo tenant, `OIDC_ALLOWED_TENANT=<ID-TENANT>`.
6. *Certificati e segreti > Nuovo segreto client*: scegli la scadenza, copia subito il **Valore** → `OIDC_CLIENT_SECRET`. **Annota la data di scadenza.**
7. *Autorizzazioni API*: bastano le autorizzazioni delegate Microsoft Graph `openid`, `profile`, `email`, `User.Read`. Concedi il consenso amministratore se richiesto dal tuo tenant.
8. *(Facoltativo)* *Autenticazione > URL di disconnessione front-channel*: `https://<tuo-portale>/assistenza/`.

## 2. Limitare chi può entrare (facoltativo)

- **Solo il tuo tenant**: `OIDC_ALLOWED_TENANT` (controlla il claim `tid`).
- **Solo un gruppo**: `OIDC_ALLOWED_GROUP=<object id del gruppo>`. Il claim `groups` va aggiunto nella registrazione (*Configurazione token > Aggiungi attestazione gruppi*). Non testato dall'autore.
- **Solo un dominio e-mail**: `OIDC_ALLOWED_EMAIL_DOMAIN=tuoente.it`.
- In alternativa, lato Entra: *Applicazioni aziendali > (la tua app) > Proprietà > Assegnazione richiesta = Sì*, poi assegna utenti o gruppi.

## 3. Verifica

**[testato]** Con il portale avviato, `https://<tuo-portale>/assistenza/auth/login` deve rimandare a `login.microsoftonline.com` con `code_challenge_method=S256`:
```bash
curl -sk -o /dev/null -w "%{http_code} %{redirect_url}\n" https://<tuo-portale>/assistenza/auth/login
```
Poi prova un accesso vero con un account del tenant.

Errori tipici:
- `AADSTS50011` (redirect URI non corrispondente): l'indirizzo in Entra e `OIDC_REDIRECT_URI` devono essere identici.
- Pagina «Accesso non consentito»: l'utente non rispetta `OIDC_ALLOWED_TENANT`, `OIDC_ALLOWED_GROUP` o `OIDC_ALLOWED_EMAIL_DOMAIN`.
- Pagina «Qualcosa non ha funzionato» dopo il login: guarda `journalctl -u portale-assistenza`; spesso è un `OIDC_CLIENT_SECRET` scaduto o copiato male (va copiato il **Valore**, non l'ID del segreto).

## 4. Rinnovare il client secret (prima della scadenza)

1. In Entra crea un **nuovo** segreto (il vecchio continua a funzionare fino alla sua scadenza).
2. Aggiorna `OIDC_CLIENT_SECRET` in `/opt/portale-assistenza/.env` (e nel file dei segreti di Apache se usi [sso-glpi.md](sso-glpi.md)).
3. `sudo systemctl restart portale-assistenza` (e `sudo systemctl restart apache2` se serve).
4. Prova un accesso, poi elimina il vecchio segreto in Entra.

## Altri provider OIDC

Il portale legge dal token il nome (`name`) e l'e-mail (`email`, oppure `preferred_username`/`upn`). Il provider deve quindi fornire un'e-mail. Il logout usa `end_session_endpoint` se il provider lo pubblica. Altri provider non sono stati provati.
