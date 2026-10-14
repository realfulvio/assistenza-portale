# Fiducia della CA interna sui PC Windows

Questa guida spiega come far accettare ai browser dei PC in dominio un sito firmato da una **CA interna**. La creazione della CA e l'installazione in Apache sono in [certificati-ca-interna.md](certificati-ca-interna.md). Qui non si ripetono quei comandi.

Gli esempi usano nomi finti: `portale.ente.example`, `DC=ente,DC=example`, `PC-ESEMPIO`. Sostituisci impronte e percorsi con i tuoi. La sintassi di `gpupdate`, `gpresult` e `certutil -dump` è quella del loro aiuto su Windows; i comandi di controllo non sono stati lanciati su un dominio reale.

## Certificato pubblico e CA interna

Un certificato emesso da una **CA pubblica** già presente negli archivi dei browser (programma radici di Windows, [Chrome Root Store](https://chromium.googlesource.com/chromium/src/+/main/net/data/ssl/chrome_root_store/faq.md), archivio di Firefox) è accettato senza distribuire quella radice ai PC. Sul server restano il certificato del sito e la catena, come in [apache-reverse-proxy.md](apache-reverse-proxy.md).

Un certificato emesso da una **CA interna** non è in quegli archivi. Ogni PC deve ricevere il certificato **pubblico della CA radice** e considerarlo attendibile. Il nome della CA, da solo, non basta: due certificati possono avere lo stesso nome e chiavi diverse.

Chrome, a partire dalla transizione avviata con Chrome 105, e Edge, dalla versione 112 sui dispositivi gestiti, usano un verificatore e un elenco di radici pubbliche distribuiti col browser. Entrambi continuano a fidarsi delle radici installate in locale dall'amministratore. Fonti: la [FAQ del Chrome Root Store](https://chromium.googlesource.com/chromium/src/+/main/net/data/ssl/chrome_root_store/faq.md) e [la verifica dei certificati in Edge](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-security-cert-verification). Il criterio Edge `MicrosoftRootStoreEnabled` non ha più effetto su Windows dalla versione 115: non è un interruttore da spegnere.

## Solo il certificato pubblico della radice

Distribuisci soltanto il file pubblico della CA radice (`.cer` o `.crt`, PEM o DER). Non distribuire:

- la chiave privata della CA (`ca.key` nella guida di creazione);
- un file PFX o P12, che può contenere la chiave privata;
- il certificato del solo sito, installato come se fosse una radice.

La procedura Microsoft per distribuire certificati con i criteri di gruppo chiede in un passaggio la password della chiave privata, perché vale anche per altri tipi di certificato. Per questa CA quel passaggio non si usa: il file pubblico non ha una chiave da importare. Vedi [Distribute certificates by using Group Policy](https://learn.microsoft.com/en-us/windows-server/identity/ad-cs/distribute-certificates-group-policy).

Il punto di importazione già indicato in [certificati-ca-interna.md](certificati-ca-interna.md) è la parte computer: *Criteri > Impostazioni di Windows > Impostazioni di sicurezza > Criteri chiave pubblica > Autorità di certificazione radice attendibili*. In inglese il percorso documentato è **Computer Configuration > Policies > Windows Settings > Security Settings > Public Key Policies > Trusted Root Certification Authorities**.

L'archivio da controllare sul PC è quello del computer, `Cert:\LocalMachine\Root`, non il solo archivio dell'utente. La FAQ di Chrome, su Windows, legge le radici aggiunte sia nel computer sia nell'utente, compresi gli archivi scritti dai criteri di gruppo. Per un PC condiviso la distribuzione di macchina è quella da verificare.

## Impronta attesa

Prima di collegare la GPO, calcola l'impronta dal file pubblico. `certutil -dump` legge il file e non lo installa. Su Windows in italiano le righe utili sono queste; ignora «Hash nome» e «Hash ID chiave», che sono un'altra cosa:

```text
certutil -dump C:\percorso\ca-radice.cer
```

- **Hash certificato (sha1)**: è l'impronta che Windows chiama Thumbprint.
- **Hash certificato (sha256)**: è l'impronta da confrontare se ti è stata consegnata in SHA-256.

Confronta entrambe, se le hai, con i valori ricevuti da un canale già fidato (chi ha creato la CA, di persona o su un canale protetto). Un file scaricato dalla stessa pagina HTTPS che il browser sta rifiutando non è una fonte indipendente.

## Chrome ed Edge

Per le connessioni HTTPS su TCP, Chrome considera le CA locali sia per dare sia per togliere fiducia. Le legge dagli archivi «Autorità di certificazione radice attendibili» del computer e dell'utente, inclusi quelli compilati dai criteri di gruppo. Non serve un criterio Chrome aggiuntivo per «accettare le CA locali».

Limite documentato nella stessa FAQ: sulle connessioni **QUIC (HTTP/3)** Chrome usa le decisioni locali solo per **togliere** fiducia, non per aggiungere una CA interna. Un sito interno servito solo in HTTP/3 può quindi mostrare ancora l'errore di autorità. Il portale dietro Apache, nella configurazione di [apache-reverse-proxy.md](apache-reverse-proxy.md), parla HTTPS su TCP. Questo limite non è un motivo per disattivare TLS.

Edge documenta lo stesso principio per le radici installate in locale, dalla versione 112 in poi. La frase sul QUIC è nella FAQ di Chromium: non attribuirla a Edge se sulla tua versione non la verifichi.

## Firefox

Firefox tiene un proprio archivio e, senza un criterio, ignora le radici di Windows. Il criterio `Certificates` > `ImportEnterpriseRoots` gli fa usare i certificati aggiunti all'archivio del sistema. È disponibile da Firefox 60 e da Firefox ESR 60. Riferimento attuale: [Certificates](https://firefox-admin-docs.mozilla.org/reference/policies/certificates/). Il criterio agisce sulla preferenza `security.enterprise_roots.enabled`; si imposta il criterio, non la preferenza a mano in `about:config`.

Con i modelli di criterio per computer il valore atteso è:

```text
HKLM\SOFTWARE\Policies\Mozilla\Firefox\Certificates
    ImportEnterpriseRoots    REG_DWORD    1
```

Nella pagina Mozilla il valore abilitato è `0x1` e quello disabilitato è `0x0`, sotto `Software\Policies\Mozilla\Firefox\Certificates`. `1` e `0x1` sono lo stesso numero. Il tipo deve essere `REG_DWORD`: una stringa `"1"` non è il valore documentato.

Il percorso sopra è quello della parte computer (registro della macchina). Un criterio utente scriverebbe sotto `HKEY_CURRENT_USER` e varrebbe solo per quell'utente. Per tutte le persone che usano il PC controlla `HKLM`.

Dopo l'applicazione, chiudi Firefox per intero e riaprilo. In `about:policies` la voce `ImportEnterpriseRoots` deve comparire tra i criteri attivi. Le note di versione dell'amministratore descrivono `about:policies` come la pagina che elenca i criteri applicati, anche in caso di applicazione parziale: [Firefox Release Notes for Enterprise](https://firefox-admin-docs.mozilla.org/release-notes/).

## Ambito della GPO

Un oggetto Criteri di gruppo si collega a un **sito**, a un **dominio** o a una **unità organizzativa**. Il collegamento è l'ambito massimo: da lì i criteri scendono per ereditarietà. Possono ancora restringerlo un collegamento disabilitato, la parte computer disabilitata, i permessi, un filtro di protezione e un filtro WMI. Vedi [Group Policy scope](https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/group-policy/group-policy-scope) e la [panoramica su collegamenti, ereditarietà e filtri](https://learn.microsoft.com/en-us/training/modules/implement-group-policy-objects/3-implement-gpo-scope-inheritance).

Prima di dare per buona la GPO, controlla tutti questi punti:

- il collegamento è abilitato sul contenitore giusto;
- la **parte computer** dell'oggetto è abilitata (la CA e la chiave `HKLM` di Firefox stanno lì; la parte utente non le sostituisce);
- i computer di destinazione hanno i permessi **Lettura** e **Applica criteri di gruppo** sull'oggetto. «Utenti autenticati» li include e comprende anche gli account computer. Se togli quel gruppo e lasci solo gruppi di persone, i PC non applicano la parte computer;
- un filtro di protezione o un filtro WMI non esclude `PC-ESEMPIO`;
- un blocco di ereditarietà sul contenitore del PC non scarta l'oggetto, salvo che il collegamento sia imposto;
- l'oggetto imposto da un livello più alto può vincere su uno più vicino al PC. L'ordine di elaborazione è: criteri locali, sito, dominio, unità organizzativa, unità organizzativa figlia.

La modifica deve anche arrivare al controller di dominio che il PC interroga. Subito dopo un cambiamento, un altro controller può avere ancora la copia precedente.

## Il contenitore CN=Computers

`CN=Computers,DC=ente,DC=example` è un contenitore, non un'unità organizzativa. Un oggetto Criteri di gruppo **non si può collegare direttamente** a `CN=Computers`. È il comportamento previsto: i collegamenti stanno su sito, dominio e unità organizzativa. I computer che restano in quel contenitore ricevono comunque i criteri collegati al sito e al dominio, per ereditarietà.

I computer appena aggiunti al dominio finiscono in `CN=Computers` se nessuno ha cambiato la destinazione predefinita e se nessuno li sposta. Una GPO collegata solo a un'unità organizzativa di lavoro non li raggiunge finché restano lì.

Due strade, da scegliere guardando chi altro riceverebbe i criteri:

- **Unità organizzative dedicate**, per esempio una per le postazioni di lavoro, e spostamento dei PC (anche di quelli nuovi) dentro l'unità a cui la GPO è collegata.
- **Collegamento al dominio**, con filtri valutati uno per uno. L'oggetto vale allora per i computer del dominio, quindi anche per i server e, per ereditarietà, per i controller di dominio nell'unità `Domain Controllers`, salvo blocco di ereditarietà o filtro. Mettere una radice privata nell'archivio di un controller di dominio è una scelta da valutare prima, non un effetto collaterale da scoprire dopo. Un filtro deve essere provato, non solo disegnato.

Non esiste un collegamento «solo sui PC nuovi» dentro `CN=Computers`.

## L'icona sul desktop è un'altra scelta

Distribuire la CA non crea l'icona del portale, e l'icona non rende il certificato attendibile. L'icona è descritta in [icona-desktop.md](icona-desktop.md): di solito è configurazione **utente** (collegamento o script di accesso), con un altro collegamento e un altro momento di applicazione. Un `gpupdate` della sola parte computer non dimostra che l'icona ci sia.

## GPO configurata, criteri applicati, sito aperto

Sono tre fatti diversi.

| Controllo | Cosa dimostra |
|---|---|
| La GPO esiste ed è collegata nella console di gestione | La configurazione è stata scritta in Active Directory. Il PC può non averla ancora. |
| `gpresult` elenca quell'oggetto tra i criteri computer applicati, l'archivio `LocalMachine\Root` contiene la radice con l'impronta attesa e, se usi Firefox, il valore `ImportEnterpriseRoots` è il DWORD `1` | Quel PC ha applicato i criteri controllati. |
| Chrome, Edge o Firefox aprono `https://portale.ente.example` senza avviso, e Firefox mostra il criterio in `about:policies` | Quel browser, in quel momento, si fida del sito. |

Il messaggio di completamento di `gpupdate` dice che l'elaborazione sul PC è finita. Non dice che l'impronta in archivio sia quella giusta, né che il browser abbia ricaricato la fiducia. Un aggiornamento remoto **pianificato** è ancora un passo indietro: vedi `Invoke-GPUpdate` più sotto.

## Comandi sul PC di prova

Eseguili su `PC-ESEMPIO`, in una console **avviata come amministratore**. Senza privilegi elevati la sezione computer di `gpresult` spesso non viene mostrata: è l'indicazione ripetuta nel supporto Microsoft, anche se la pagina attuale del comando non lo riscrive. Non lanciare questi comandi su tutti i PC del dominio.

Aggiorna solo la parte computer e riapplica anche le impostazioni già presenti. `/force` non si limita ai criteri cambiati. L'attesa predefinita è 600 secondi.

```text
gpupdate /target:computer /force
```

Poi leggi il riepilogo dei criteri computer:

```text
gpresult /scope computer /r
```

Nell'elenco dei criteri applicati deve comparire la GPO della CA. Se è tra quelli non applicati, la motivazione (protezione, filtro WMI, collegamento o oggetto disabilitato) è il passo successivo. I testi sono nella lingua di Windows. Il riepilogo non stampa l'impronta del certificato: quella si controlla a parte.

```powershell
Get-ChildItem -Path 'Cert:\LocalMachine\Root' |
  Where-Object { $_.Thumbprint -eq 'INCOLLA_IMPRONTA_SHA1' } |
  Format-List Subject, Issuer, Thumbprint, NotBefore, NotAfter
```

Sostituisci `INCOLLA_IMPRONTA_SHA1` con l'hash SHA-1 letto da `certutil -dump`, senza spazi. Il confronto di PowerShell non distingue le maiuscole. Nessuna riga in uscita significa che quella radice non è nell'archivio del computer. Se ne esce una, controlla anche che `NotAfter` sia nel futuro e che il soggetto sia la CA che ti aspetti.

Firefox, stessa console:

```powershell
$path = 'HKLM:\SOFTWARE\Policies\Mozilla\Firefox\Certificates'
Get-ItemProperty -Path $path -Name 'ImportEnterpriseRoots' | Format-List ImportEnterpriseRoots
(Get-Item -Path $path).GetValueKind('ImportEnterpriseRoots')
```

Atteso: valore `1` e tipo `DWord`. Se il percorso non esiste, il criterio computer non è arrivato. Chiudi e riapri Firefox, poi controlla `about:policies`.

La guida Microsoft sulla distribuzione dei certificati chiede di riavviare i dispositivi dopo l'applicazione. Se l'archivio è ancora vuoto dopo `gpupdate`, riavvia **quel** PC di prova e ripeti i due controlli. Non pianificare riavvii di massa da questa guida.

## Invoke-GPUpdate su una sola postazione

`Invoke-GPUpdate` **pianifica** `gpupdate` su un computer. Non mostra l'esito dell'applicazione: la documentazione del cmdlet dice che non produce output. Il ritorno al prompt significa che la pianificazione è stata accettata, non che i criteri siano applicati. Il controllo resta `gpresult` e l'archivio certificati, sul PC.

Sintassi del modulo `GroupPolicy` documentata per Windows Server 2025: [Invoke-GPUpdate](https://learn.microsoft.com/en-us/powershell/module/grouppolicy/invoke-gpupdate?view=windowsserver2025-ps). Il parametro `-Force` di questo cmdlet evita la conferma del cmdlet. Non è documentato come equivalente di `gpupdate /force`. `-RandomDelayInMinutes 0` fa partire l'aggiornamento appena l'attività è pianificata; un valore più alto aggiunge quel ritardo più uno scarto casuale, fino a 31 giorni. Senza un ritardo esplicito la stessa pagina parla di uno scarto casuale per non caricare la rete.

Prerequisiti, tutti necessari e nessuno da allargare all'intera rete:

- il modulo `GroupPolicy`, installato con gli strumenti di amministrazione remota (RSAT) «Group Policy Management Tools», sul computer da cui lanci il comando;
- un nome che si risolve nel DNS. Formati accettati: `PC-ESEMPIO`, `PC-ESEMPIO.ente.example`, `ente.example\PC-ESEMPIO` o il nome NetBIOS del dominio seguito dal nome del PC;
- il permesso di creare un'attività pianificata su quella postazione (in pratica un amministratore del PC);
- il PC acceso e raggiungibile;
- sul PC, le regole firewall in ingresso già previste dalla nota del cmdlet: **Remote Scheduled Tasks Management (RPC)**, **Remote Scheduled Tasks Management (RPC-EPMAP)** e **Windows Management Instrumentation (WMI-In)**. I nomi visualizzati possono essere tradotti. Se il cmdlet fallisce, non aprire il firewall in modo generico: esegui `gpupdate` localmente sul PC di prova oppure consenti solo il percorso tra la postazione di amministrazione e `PC-ESEMPIO`.

Il cmdlet non è supportato per Windows XP e precedenti. Non usarlo per un aggiornamento di molti computer.

```powershell
Import-Module GroupPolicy
Invoke-GPUpdate -Computer 'PC-ESEMPIO.ente.example' -Target Computer -RandomDelayInMinutes 0 -Force
```

`-Target Computer` limita la pianificazione alla parte computer. Poi, sul PC, quando l'attività ha avuto il tempo di partire, ripeti `gpresult /scope computer /r` e il controllo dell'impronta.

## Due errori che non sono la stessa cosa

`NET::ERR_CERT_AUTHORITY_INVALID`, in Chrome o Edge, compare quando il certificato del sito non arriva a una radice del Chrome Root Store né a una CA locale considerata da quel browser. Cause abituali: radice interna assente dall'archivio, catena incompleta sul server (vedi il punto 3 di [certificati-ca-interna.md](certificati-ca-interna.md)), nome del sito diverso da `portale.ente.example`. La FAQ del Chrome Root Store collega questo errore ai siti che non risultano validi rispetto all'elenco pubblico o alle impostazioni locali.

`CRYPT_E_NO_REVOCATION_CHECK` (`0x80092012`) è un codice di Windows. `CertVerifyRevocation` lo usa quando una funzione di revoca non è riuscita a controllare il certificato. Il testo associato è «The revocation function was unable to check revocation for the certificate». Può comparire in `certutil` o in `curl` di Windows (Schannel) anche se la CA è già attendibile: per esempio se la CA interna non pubblica un elenco di revoca, come annotato nella guida di creazione. Non dimostra che la radice manchi. Non è nemmeno `CRYPT_E_REVOCATION_OFFLINE` (`0x80092013`), che indica un server di revoca non raggiungibile.

Non disattivare il controllo di revoca, non aggiungere opzioni che saltano la verifica TLS e non spegnere TLS per far passare la prova. I due errori si leggono e si sistemano in modo separato: l'autorità si sistema con la radice giusta e la catena; la revoca si sistema pubblicando i dati di revoca della CA, se ti servono per gli strumenti Windows, non nascondendo il controllo.

## Tempo, PC spenti, browser

Con l'intervallo predefinito, la parte computer si aggiorna all'avvio e poi circa ogni 90 minuti, con uno scarto casuale fino a 30 minuti. Lo descrive la procedura Microsoft [Refresh Group Policy](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2012-r2-and-2012/jj125376(v=ws.11)). Un PC spento o fuori dalla rete del dominio non riceve nulla finché non raggiunge un controller. Al ritorno applica i criteri all'avvio o al ciclo successivo: non serve un aggiornamento forzato di tutti gli altri.

Chrome, Edge e Firefox possono tenere aperta la sessione in cui hanno già valutato il certificato. Dopo che l'archivio e, per Firefox, il registro sono a posto, chiudi i browser e riaprili prima di giudicare il sito. Un criterio Firefox letto a browser già aperto non è una prova.
