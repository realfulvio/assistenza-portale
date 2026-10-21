# CSS opzionale: altezza minima della nuova Risposta

Esempio opzionale per il **backend GLPI 11.0.8**, tramite la personalizzazione CSS nativa dell'entità: non modifica il core, non richiede plugin e non modifica il codice o la versione del portale.

La regola completa è in [deploy/glpi/risposta-editor.css.example](../deploy/glpi/risposta-editor.css.example):

```css
/* GLPI 11.0.8: altezza minima della nuova Risposta nei ticket. */
#itil-object-container #new-ITILFollowup-block:has(.itilfollowup > form > input[name="itemtype"][value="Ticket"]) .tox-tinymce:not(.tox-fullscreen) {
    min-height: 460px;
}
```

Interessa l'editor della **nuova Risposta nei ticket**, escluso il fullscreen. Non modifica larghezza, colonne, pulsanti, icone, colori o comportamento. **460 px è l'altezza minima**, non soltanto quella iniziale: il ridimensionamento può aumentarla, ma non scendere sotto il minimo.

I selettori sono stati verificati su **GLPI 11.0.8**; non è dichiarata compatibilità con altre versioni. Dopo ogni aggiornamento GLPI, verifica nuovamente i selettori e ripeti i controlli sull'editor prima di mantenere la personalizzazione. Prima dell'adozione verifica il supporto di **`:has()` nei browser effettivamente usati**, anche nelle versioni ESR o gestite: [supporto e comportamento su MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:has#browser_compatibility). Un browser senza supporto non applica questa regola.

## Applicazione

1. Con un profilo autorizzato, apri **Amministrazione > Entità > entità interessata > Personalizzazione UI**.
2. Conserva una copia del **CSS già presente** e del valore di **Abilita personalizzazione CSS**, inclusa l'eventuale eredità. Controlla quale entità fornisce il CSS effettivo: il campo ereditato può essere in sola lettura. Prima di cambiare l'eredità, preserva anche le personalizzazioni effettive che vuoi mantenere.
3. Integra la sola regola dell'esempio con il CSS esistente, senza sostituire o svuotare le altre personalizzazioni. Se necessario abilita il CSS nell'entità scelta e salva.
4. Riapri il ticket, avvia una nuova Risposta e verifica che il CSS sia caricato. Controlla anche Soluzione, Attività, larghezze, ridimensionamento e fullscreen. **Normalmente non serve riavviare servizi**: verifica il caricamento dopo il salvataggio, ricaricando la pagina se necessario.

L'ambito è quello della **personalizzazione dell'entità**, con l'eventuale eredità verso entità figlie: non è limitato a tre account né ai soli account con cui è stata provata la regola.

Il pannello e i nomi italiani sono verificati nella [documentazione delle entità GLPI](https://help.glpi-project.org/documentation/modules/administration/entities#ui-customization), nel [codice del pannello 11.0.8](https://github.com/glpi-project/glpi/blob/11.0.8/templates/pages/admin/entity/custom_ui.html.twig), in [Entity.php](https://github.com/glpi-project/glpi/blob/11.0.8/src/Entity.php) e nelle [traduzioni italiane 11.0.8](https://github.com/glpi-project/glpi/blob/11.0.8/locales/it_IT.po).

## Prove già effettuate su GLPI 11.0.8

Risultati di una sessione già verificata, riportati senza dati identificativi. Non costituiscono una nuova verifica eseguita per questo aggiornamento del repository né una garanzia per altre installazioni.

| Controllo | Esito osservato |
|---|---|
| Nuova Risposta | Altezza da 150 a 460 px |
| Soluzione | Invariata a 150 px |
| Attività | Invariata a 300 px |
| Larghezze | Invariate |
| Ridimensionamento | Altezza aumentata a 480 px |
| Fullscreen | Funzionante, escluso dalla regola |
| Console del browser | Nessun errore osservato nella sessione verificata |

Non è stato eseguito alcun invio di messaggi né upload funzionale per il test; il flusso di invio e allegati non è quindi validato da queste prove.

## Rollback

Nello stesso pannello ripristina **il CSS e il valore di abilitazione precedenti**, compresa l'eventuale eredità, salva e verifica il caricamento dopo aver ricaricato la pagina. Non svuotare tutto il CSS se erano già presenti altre personalizzazioni.
