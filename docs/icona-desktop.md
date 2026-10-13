# Icona sul desktop con il nome del PC

Se il portale viene aperto con `?pc=NOMEPC` (es. `https://portale.tuoente.it/assistenza?pc=PC-UFF-01`), il nome del PC viene aggiunto in fondo al ticket insieme a IP e browser:

```
PC: PC-UFF-01 · IP: 10.20.30.40 · Browser: Edge 141 su Windows 10/11
```

- Il nome è accettato solo se contiene lettere, numeri e trattini (massimo 30 caratteri); altrimenti viene ignorato.
- Il nome del parametro si cambia con `PC_PARAM` in `.env` (vuoto = funzione disattivata).
- L'IP è quello che il reverse proxy (Apache) aggiunge all'header `X-Forwarded-For`: eventuali valori inviati dal browser vengono ignorati. Senza reverse proxy l'IP è quello della connessione.

## Distribuire l'icona con una GPO (Active Directory)

### Metodo 1 – Preferenze dei Criteri di gruppo (non testato dall'autore)

*Configurazione utente > Preferenze > Impostazioni di Windows > Collegamenti > Nuovo > Collegamento*:
- Azione: **Sostituisci**; Tipo di destinazione: **Oggetto URL**; Posizione: **Desktop**; Nome: «Assistenza Informatica»;
- URL di destinazione: `https://portale.tuoente.it/assistenza?pc=%ComputerName%`;
- Icona: un file `.ico` su una condivisione leggibile da tutti (es. la `favicon.ico` del portale copiata in `\\dominio\NETLOGON`).

`%ComputerName%` è una variabile delle Preferenze dei Criteri di gruppo e dovrebbe essere sostituita sul PC al momento dell'applicazione. **Verifica** su un PC: dopo `gpupdate /force` apri con il Blocco note il file `.url` sul desktop e controlla che la riga sia `URL=...?pc=NOMEREALE` e non `%ComputerName%`. Documentazione Microsoft sulle variabili delle Preferenze: cerca «Group Policy Preferences variables».

### Metodo 2 – Script di accesso PowerShell (testato in locale)

Script pronto: [`deploy/gpo/crea-icona-assistenza.ps1`](../deploy/gpo/crea-icona-assistenza.ps1). Imposta in cima `$Portale` (e `$Param` se hai cambiato `PC_PARAM`), poi:

*Configurazione utente > Criteri > Impostazioni di Windows > Script (accesso/disconnessione) > Accesso > Script di PowerShell > Aggiungi*.

Lo script crea `Assistenza Informatica.url` sul desktop dell'utente con `?pc=$env:COMPUTERNAME` (righe separate da CR+LF, come richiesto dai file `.url`) e lo riscrive solo se è cambiato. Prova manuale:

```powershell
powershell -ExecutionPolicy Bypass -File .\crea-icona-assistenza.ps1
Get-Content "$([Environment]::GetFolderPath('Desktop'))\Assistenza Informatica.url"
```

Nomi di PC con caratteri diversi da lettere, numeri e trattini vengono ripuliti dallo script.
