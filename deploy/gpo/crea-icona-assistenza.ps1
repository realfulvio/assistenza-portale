# Crea (o aggiorna) sul desktop dell'utente l'icona "Assistenza Informatica"
# che apre il portale con il nome del PC: https://.../assistenza?pc=NOMEPC
#
# Uso: GPO > Configurazione utente > Criteri > Impostazioni di Windows > Script (accesso/disconnessione)
#      > Accesso > scheda "Script di PowerShell" > Aggiungi questo file (copialo in NETLOGON o nella cartella della GPO).
# Facoltativo: copia l'icona del portale (favicon.ico) in una condivisione leggibile da tutti e indica il percorso in $Icona.

$Portale = 'https://portale.esempio.it/assistenza'   # <-- indirizzo del tuo portale (PUBLIC_URL + BASE_PATH)
$Nome    = 'Assistenza Informatica'
$Icona   = ''   # es. '\\TUO-DOMINIO\NETLOGON\assistenza.ico' (vuoto = icona del browser)

# Nome del PC: solo lettere, numeri e trattini (come accetta il portale)
$Pc = ($env:COMPUTERNAME -replace '[^A-Za-z0-9-]', '')
$Param = 'pc'      # deve coincidere con PC_PARAM del portale
$Url = if ($Pc) { "$Portale" + '?' + $Param + '=' + $Pc } else { $Portale }

$Righe = @('[InternetShortcut]', "URL=$Url")
if ($Icona) { $Righe += "IconFile=$Icona"; $Righe += 'IconIndex=0' }

$Desktop = [Environment]::GetFolderPath('Desktop')
$File = Join-Path $Desktop "$Nome.url"

# Le righe di un file .url vanno separate da CR+LF: in PowerShell si scrive "`r`n"
$Testo = ($Righe -join "`r`n") + "`r`n"

# Riscrive il file solo se e' cambiato (niente modifiche inutili a ogni accesso)
$Attuale = if (Test-Path -LiteralPath $File) { [IO.File]::ReadAllText($File) } else { '' }
if ($Attuale -ne $Testo) {
    [IO.File]::WriteAllText($File, $Testo, [Text.Encoding]::ASCII)
}
