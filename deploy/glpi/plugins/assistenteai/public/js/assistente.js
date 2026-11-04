/* Assistente AI nella scheda chiamata di GLPI 11. Nessuna dipendenza oltre a quelle di GLPI. */
(function () {
  'use strict';

  const ATTESE = {
    riassunto: 'Leggo la chiamata e preparo il riassunto…',
    bozza: 'Scrivo la bozza di risposta…',
    simili: 'Cerco chiamate simili già risolte…',
    categoria: 'Scelgo categoria e urgenza…'
  };
  const TITOLI = {riassunto: 'Riassunto', bozza: 'Bozza di risposta', simili: 'Chiamate simili risolte', categoria: 'Categoria e urgenza'};

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const csrf = () => document.querySelector('meta[property="glpi:csrf_token"]')?.getAttribute('content') || '';
  const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

  async function chiedi(sezione, azione, extra = {}) {
    const corpo = new URLSearchParams({azione, tickets_id: sezione.dataset.ticket, ...extra});
    const r = await fetch(sezione.dataset.endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'X-Glpi-Csrf-Token': csrf(), 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded'},
      body: corpo
    });
    let json = null;
    try { json = await r.json(); } catch (e) { /* risposta non JSON */ }
    if (!r.ok || !json || !json.ok) {
      if (r.status === 403) throw new Error('Non hai i permessi per questa chiamata.');
      throw new Error(json?.errore || 'L\'assistente non è disponibile in questo momento.');
    }
    return json;
  }

  function stato(sezione, azione, html) {
    const uscita = sezione.querySelector('.assistenteai-uscita');
    uscita.innerHTML = '<div class="assistenteai-titolo">' + esc(TITOLI[azione] || '') + '</div>' + html;
  }

  function occupato(sezione, azione, si) {
    sezione.querySelectorAll('.assistenteai-azioni .assistenteai-btn').forEach((b) => {
      b.disabled = si;
      b.classList.toggle('attivo', b.dataset.azione === azione);
    });
    if (si) {
      stato(sezione, azione, '<div class="assistenteai-attesa"><span class="spinner-border spinner-border-sm" role="status"></span>'
        + '<span>' + esc(ATTESE[azione]) + ' Può richiedere fino a mezzo minuto.</span></div>');
    }
  }

  // ---------------------------------------------------------------- risultati

  function mostraRiassunto(sezione, dati) {
    stato(sezione, 'riassunto', '<ul>' + dati.righe.map((r) => '<li><b>' + esc(r.etichetta) + ':</b> ' + esc(r.testo) + '</li>').join('') + '</ul>');
  }

  function mostraSimili(sezione, dati) {
    let html = '';
    if (!dati.simili.length) {
      html = '<div>Nessuna chiamata risolta abbastanza simile.</div>';
    } else {
      html = dati.simili.map((s) => '<div class="assistenteai-simile"><div><a href="' + esc(s.url) + '">#' + esc(s.id) + '</a> '
        + esc(s.titolo) + (s.soluzione ? '<small>Soluzione: ' + esc(s.soluzione) + '</small>' : '') + '</div>'
        + '<span class="punteggio">' + esc(String(s.punteggio).replace('.', ',')) + '</span></div>').join('');
    }
    if (dati.da_indicizzare > 0) {
      html += '<div class="assistenteai-nota mt-1">Sto ancora indicizzando ' + esc(dati.da_indicizzare) + ' chiamate vecchie: riprova tra poco per un risultato completo.</div>';
    }
    stato(sezione, 'simili', html);
  }

  function campo(nome) {
    return document.querySelector('.itil-right-side select[name="' + nome + '"], #itil-form select[name="' + nome + '"]');
  }

  function impostaSelect(select, valore, testo) {
    if (!select) return false;
    const $ = window.jQuery;
    if (!select.querySelector('option[value="' + CSS.escape(String(valore)) + '"]')) {
      select.appendChild(new Option(testo, valore, true, true));
    }
    if ($) {
      $(select).val(String(valore)).trigger('change');
    } else {
      select.value = String(valore);
      select.dispatchEvent(new Event('change', {bubbles: true}));
    }
    return true;
  }

  function mostraCategoria(sezione, dati) {
    const stessa = dati.categoria.id === dati.attuale.id;
    let html = '<div><b>' + esc(dati.categoria.nome) + '</b>' + (stessa ? ' <span class="badge bg-green-lt">già impostata</span>' : '') + '</div>'
      + '<div>Urgenza: <b>' + esc(dati.urgenza.nome) + '</b></div>'
      + (dati.motivo ? '<div class="text-secondary mt-1">' + esc(dati.motivo) + '</div>' : '');
    const puoCategoria = !stessa && campo('itilcategories_id');
    const puoUrgenza = dati.urgenza.valore !== dati.urgenza_attuale && campo('urgency');
    if (puoCategoria || puoUrgenza) {
      html += '<div class="assistenteai-proposta"><button type="button" class="btn btn-sm assistenteai-btn attivo" data-applica>Applica al modulo</button>'
        + '<span class="assistenteai-nota">poi premi Salva</span></div>';
    }
    stato(sezione, 'categoria', html);
    sezione.querySelector('[data-applica]')?.addEventListener('click', (ev) => {
      if (puoCategoria) impostaSelect(campo('itilcategories_id'), dati.categoria.id, dati.categoria.nome);
      if (puoUrgenza) impostaSelect(campo('urgency'), dati.urgenza.valore, dati.urgenza.nome);
      ev.currentTarget.replaceWith(Object.assign(document.createElement('span'), {className: 'badge bg-green-lt', textContent: 'Applicata: ricordati di salvare'}));
    });
  }

  // ---------------------------------------------------------------- bozza nella Risposta

  async function editorRisposta() {
    const blocco = document.getElementById('new-ITILFollowup-block');
    if (!blocco) throw new Error('Non trovo il modulo Risposta in questa pagina.');
    if (!blocco.classList.contains('show')) {
      document.querySelector('.answer-action[data-bs-target="#new-ITILFollowup-block"]')?.click();
    }
    for (let i = 0; i < 50; i++) {
      const ed = (window.tinymce?.get() || []).find((e) => blocco.contains(e.getContainer()));
      if (ed && ed.initialized !== false) return {blocco, ed};
      await attendi(100);
    }
    throw new Error('L\'editor della Risposta non si è aperto.');
  }

  function barra(sezione, ed) {
    const contenitore = ed.getContainer();
    let b = contenitore.parentNode.querySelector(':scope > .assistenteai-barra');
    if (!b) {
      b = document.createElement('div');
      b.className = 'assistenteai-barra';
      b.innerHTML = '<i class="ti ti-sparkles"></i><span>Bozza dell\'assistente: rileggila prima di aggiungerla.</span>'
        + '<span class="ms-auto"><button type="button" data-variante="normale"><i class="ti ti-refresh me-1"></i>Rigenera</button>'
        + '<button type="button" data-variante="breve">Più breve</button>'
        + '<button type="button" data-variante="formale">Più formale</button></span>';
      contenitore.parentNode.insertBefore(b, contenitore);
      b.addEventListener('click', (ev) => {
        const btn = ev.target.closest('button[data-variante]');
        if (btn) esegui(sezione, 'bozza', btn.dataset.variante);
      });
    }
    return b;
  }

  async function mostraBozza(sezione, dati) {
    const {blocco, ed} = await editorRisposta();
    ed.setContent(dati.html);
    ed.undoManager?.add();
    barra(sezione, ed);
    blocco.scrollIntoView({behavior: 'smooth', block: 'center'});
    ed.focus();
    stato(sezione, 'bozza', '<div>Ho messo la bozza nella Risposta. Correggila e premi <b>Aggiungi</b> come al solito.</div>');
  }

  // ---------------------------------------------------------------- azioni

  async function esegui(sezione, azione, variante) {
    if (sezione.dataset.occupato === '1') return;
    sezione.dataset.occupato = '1';
    occupato(sezione, azione, true);
    const barraAttiva = document.querySelector('.assistenteai-barra');
    barraAttiva?.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      const dati = await chiedi(sezione, azione, variante ? {variante} : {});
      if (azione === 'riassunto') mostraRiassunto(sezione, dati);
      else if (azione === 'simili') mostraSimili(sezione, dati);
      else if (azione === 'categoria') mostraCategoria(sezione, dati);
      else if (azione === 'bozza') await mostraBozza(sezione, dati);
    } catch (e) {
      stato(sezione, azione, '<div class="assistenteai-errore"><i class="ti ti-alert-triangle me-1"></i>' + esc(e.message) + '</div>');
    } finally {
      sezione.dataset.occupato = '0';
      occupato(sezione, azione, false);
      document.querySelectorAll('.assistenteai-barra button').forEach((b) => { b.disabled = false; });
    }
  }

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.plugin-assistenteai .assistenteai-btn[data-azione]');
    if (!btn) return;
    ev.preventDefault();
    esegui(btn.closest('.plugin-assistenteai'), btn.dataset.azione);
  });
})();
