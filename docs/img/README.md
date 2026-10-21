# Immagini della presentazione

Gli asset con suffisso `-2026` sono generati dalla demo del repository, con Comune di Esempio, identità sintetiche e richieste simulate. Non sono schermate di un’installazione operativa.

`banner-2026.png` combina due screenshot della demo con una cornice grafica SVG. `architettura-2026.svg` illustra i componenti; non rappresenta una rete reale.

Per rigenerare le sei immagini raster, usa un clone pulito senza personalizzazioni locali:

```bash
npm ci
npx playwright install --with-deps chromium
node scripts/cattura-presentazione.js
```

Lo script avvia e arresta il backend dimostrativo su loopback, controlla gli errori JavaScript e l’overflow mobile e non richiede GLPI, OIDC o un modello AI. Puoi specificare un browser installato con `CHROME_PATH`.

Rivedi visivamente le immagini prima del commit. Mantieni soltanto dati inventati e non inserire schermate del server, avatar reali o metadati personali.
