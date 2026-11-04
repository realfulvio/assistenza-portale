'use strict';
// Filtri della ricerca web di ripiego: cosa può uscire dalla rete e cosa no.
const test = require('node:test');
const assert = require('node:assert');
const web = require('../src/assistente-web');

test('domande generiche ammesse alla ricerca web', () => {
  assert.equal(web.controlla('cos\'è la PEC?').ammessa, true);
  assert.equal(web.controlla('come si converte un pdf in word?').ammessa, true);
});

test('dati personali e sistemi interni non escono', () => {
  assert.equal(web.controlla('qual è la mia password del pc?').motivo, 'dati');
  assert.equal(web.controlla('mario.rossi@example.it non riceve posta?').motivo, 'dati');
  assert.equal(web.controlla('come funziona halley del comune?').motivo, 'interno');
  assert.equal(web.controlla('la vpn non va?').motivo, 'interno');
});

test('guasti e saluti non sono domande informative', () => {
  assert.equal(web.informativa('la stampante non funziona'), false);
  assert.equal(web.informativa('come si cambia il toner?'), true);
  assert.equal(web.controlla('ciao').ammessa, false);
});

test('ricerca spenta senza motore configurato', () => {
  assert.equal(web.creaRicerca({ assistenteWeb: '' }).attiva, false);
});

test('nomi interni dell\'ente da configurazione', () => {
  const percorso = require.resolve('../src/assistente-web');
  delete require.cache[percorso];
  process.env.ASSISTENTE_WEB_INTERNI = 'Bacheca Zeta, App XY';
  try { assert.equal(require(percorso).controlla('come entro in bacheca zeta da casa?').motivo, 'interno'); }
  finally { delete process.env.ASSISTENTE_WEB_INTERNI; delete require.cache[percorso]; }
});
