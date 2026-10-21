// Logica dell'elenco dei numeri interni (formato dati, ricerca, filtro per sezione). Nessun accesso al DOM:
// la usano sia il browser (window.NumeriInterni) sia il server, che ripulisce il file prima di inviarlo, sia i test.
(function (radice, fabbrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabbrica();
  else radice.NumeriInterni = fabbrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_SEZIONI = 30, MAX_VOCI = 300;
  const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const slug = (t) => norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'sezione';
  const testo = (v, max) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/\s+/g, ' ').trim().slice(0, max) : '');

  // Accetta { aggiornato, sezioni: [{ titolo, voci: [{ nome, numero, nota, esterno, cellulare }] }] }.
  // Scarta ciò che non ha senso (voci senza nome o numero, sezioni vuote): un file scritto male non rompe la pagina.
  function normalizza(dati) {
    const sezioni = [];
    const usati = new Set();
    for (const s of (Array.isArray(dati?.sezioni) ? dati.sezioni : []).slice(0, MAX_SEZIONI)) {
      const titolo = testo(s?.titolo, 80);
      const voci = [];
      for (const v of (Array.isArray(s?.voci) ? s.voci : []).slice(0, MAX_VOCI)) {
        const nome = testo(v?.nome, 120), numero = testo(v?.numero, 30);
        const cellulare = testo(v?.cellulare, 30).replace(/[^\d+]/g, '');
        if (nome && numero) voci.push({ nome, numero, nota: testo(v?.nota, 120), esterno: v?.esterno === true, cellulare });
      }
      if (!titolo || !voci.length) continue;
      let id = slug(titolo);
      for (let n = 2; usati.has(id); n++) id = slug(titolo).slice(0, 36) + '-' + n;
      usati.add(id);
      sezioni.push({ id, titolo, voci });
    }
    const aggiornato = /^\d{4}-\d{2}-\d{2}$/.test(dati?.aggiornato ?? '') ? dati.aggiornato : '';
    return { aggiornato, sezioni };
  }

  // Ogni parola cercata deve comparire nel nome, nella nota, nei numeri o nel titolo della sezione (senza accenti né maiuscole)
  function filtra(sezioni, q, sezioneId) {
    const parole = norm(q).split(/\s+/).filter(Boolean);
    const risultato = [];
    for (const s of sezioni) {
      if (sezioneId && sezioneId !== 'tutte' && s.id !== sezioneId) continue;
      const titolo = norm(s.titolo);
      const voci = s.voci.filter((v) => {
        const fieno = `${norm(v.nome)} ${norm(v.nota)} ${v.numero} ${v.cellulare || ''} ${titolo}`;
        return parole.every((p) => fieno.includes(p));
      });
      if (voci.length) risultato.push({ ...s, voci });
    }
    return risultato;
  }

  // 3331234567 -> «333 123 4567»; numeri di altra forma restano come scritti
  const formattaCellulare = (c) => (/^\d{10}$/.test(c) ? `${c.slice(0, 3)} ${c.slice(3, 6)} ${c.slice(6)}` : c);

  const conta = (sezioni) => sezioni.reduce((n, s) => n + s.voci.length, 0);

  return { norm, slug, normalizza, filtra, conta, formattaCellulare };
});
