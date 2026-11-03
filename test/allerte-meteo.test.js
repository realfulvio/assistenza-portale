'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseDataRoma, interpretaAllerta, createAllerteMeteo, URL_STATO_ALLERTA } = require('../src/allerte-meteo');

const config = { zona: 'A1', comune: 'Città Esempio' };
const ORA = Date.parse('2026-11-03T12:00:00+01:00');
const verde = () => ({
  titolo: 'Bollettino di vigilanza 001/2026 valido dalle 00:00: nessuna allerta.',
  dataEmissione: 'Nov 2, 2026 11:44:42 AM',
  dataInizio: 'Nov 3, 2026 12:00:00 AM',
  dataFine: 'Nov 4, 2026 12:00:00 AM',
  link: '/documents/1/2/bollettino001_2026.pdf',
  A1: { idraulica: 'green', idrogeologica: 'green', temporali: 'green', vento: 'green',
    temperature_estreme: 'green', neve: null, ghiaccio_pioggia_gela: null, mareggiate: null, stato_mare: null },
  B1: { temporali: 'red' },
});
const risposta = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('date ufficiali inglesi e italiane: inverno, estate e mezzogiorno', () => {
  assert.equal(parseDataRoma('Nov 3, 2026 12:00:00 AM'), Date.parse('2026-11-03T00:00:00+01:00'));
  assert.equal(parseDataRoma('gen 9, 2026 12:00:00 PM'), Date.parse('2026-01-09T12:00:00+01:00'));
  assert.equal(parseDataRoma('lug 9, 2026 1:30:00 PM'), Date.parse('2026-07-09T13:30:00+02:00'));
  assert.equal(parseDataRoma('Sep 9, 2026 12:00:00 PM'), Date.parse('2026-09-09T12:00:00+02:00'));
});

test('date impossibili, cambio ora mancante o ambiguo non inventano un istante', () => {
  for (const date of ['Feb 30, 2026 12:00:00 AM', 'Mar 29, 2026 2:30:00 AM', 'Oct 25, 2026 2:30:00 AM', 'Nov 3, 2026 13:00:00 PM', 'ieri', null]) {
    assert.equal(parseDataRoma(date), null, String(date));
  }
  assert.equal(parseDataRoma('Mar 29, 2026 1:30:00 AM'), Date.parse('2026-03-29T01:30:00+01:00'));
  assert.equal(parseDataRoma('Mar 29, 2026 3:30:00 AM'), Date.parse('2026-03-29T03:30:00+02:00'));
});

test('verde locale anche quando un’altra zona è rossa e il titolo dice Allerta', () => {
  const body = verde();
  body.titolo = 'Allerta 002/2026: temporali';
  const stato = interpretaAllerta(body, config, ORA);
  assert.equal(stato.stato, 'verde');
  assert.equal(stato.colore, 'verde');
  assert.deepEqual(stato.rischi, []);
});

test('allerta locale riporta colore, rischi, fonte, validità e documento', () => {
  const body = verde();
  body.A1.temporali = 'orange';
  body.A1.vento = 'yellow';
  body.titolo = 'Allerta 002/2026: temporali, vento';
  const stato = interpretaAllerta(body, { ...config, frase: 'Mettiamo gli stivali!' }, ORA);
  assert.equal(stato.stato, 'attiva');
  assert.equal(stato.colore, 'arancione');
  assert.deepEqual(stato.rischi.map(r => [r.codice, r.colore]), [['temporali', 'arancione'], ['vento', 'gialla']]);
  assert.equal(stato.numeroDocumento, '002/2026');
  assert.equal(stato.validaDa, '2026-11-02T23:00:00.000Z');
  assert.equal(stato.validaFino, '2026-11-03T23:00:00.000Z');
  assert.match(stato.urlDocumento, /^https:\/\/allertameteo\.regione\.emilia-romagna\.it\/documents\//);
  assert.match(stato.messaggio, /Città Esempio/);
  assert.doesNotMatch(stato.messaggio, /stivali/);
});

test('frase configurata consentita sul giallo, colore rosso sempre sobrio', () => {
  const body = verde();
  body.A1.vento = 'yellow';
  assert.match(interpretaAllerta(body, { ...config, frase: 'Occhio al cappello!' }, ORA).messaggio, /Occhio al cappello!/);
  body.A1.vento = 'red';
  const stato = interpretaAllerta(body, { ...config, frase: 'Occhio al cappello!' }, ORA);
  assert.equal(stato.colore, 'rossa');
  assert.doesNotMatch(stato.messaggio, /cappello/);
});

test('futuro noto è previsto; a fine validità non è più attivo né verde', () => {
  const body = verde();
  body.A1.temporali = 'yellow';
  assert.equal(interpretaAllerta(body, config, Date.parse('2026-11-02T13:00:00+01:00')).stato, 'prevista');
  assert.match(interpretaAllerta(body, config, Date.parse('2026-11-02T13:00:00+01:00')).messaggio, /prevista/);
  assert.equal(interpretaAllerta(body, config, Date.parse('2026-11-04T00:00:00+01:00')).stato, 'non_verificabile');
});

test('risposte mancanti, incomplete o non valide restano non verificabili', () => {
  const incomplete = verde(); delete incomplete.A1.vento;
  const malformata = verde(); malformata.A1.vento = 'purple';
  const senzaDati = verde(); for (const key of Object.keys(senzaDati.A1)) senzaDati.A1[key] = null;
  const linkEsterno = verde(); linkEsterno.link = 'https://example.com/allerta.pdf';
  const dataFutura = verde(); dataFutura.dataEmissione = 'Nov 4, 2026 12:00:00 AM';
  for (const body of [null, {}, incomplete, malformata, senzaDati, linkEsterno, dataFutura]) {
    assert.equal(interpretaAllerta(body, config, ORA).stato, 'non_verificabile');
  }
});

test('senza configurazione resta spento e non fa richieste', async () => {
  const service = createAllerteMeteo({}, { fetchImpl: () => assert.fail('richiesta inattesa') });
  assert.equal((await service.getStato()).stato, 'disabilitato');
});

test('cache cinque minuti, richieste concorrenti unite e scadenza rivalutata', async () => {
  let ora = Date.parse('2026-11-03T23:59:00+01:00');
  let chiamate = 0;
  const service = createAllerteMeteo(config, { now: () => ora, fetchImpl: async url => {
    assert.equal(url, URL_STATO_ALLERTA); chiamate++;
    await new Promise(resolve => setTimeout(resolve, 5));
    const body = verde(); body.A1.vento = 'yellow'; return risposta(body);
  } });
  const risultati = await Promise.all([service.getStato(), service.getStato(), service.getStato()]);
  assert.equal(chiamate, 1);
  assert.ok(risultati.every(r => r.stato === 'attiva'));
  const verificatoIl = risultati[0].verificatoIl;
  ora += 60000;
  const scaduto = await service.getStato();
  assert.equal(scaduto.stato, 'non_verificabile');
  assert.equal(scaduto.verificatoIl, verificatoIl);
  assert.equal(chiamate, 1);
  ora += 240000;
  await service.getStato();
  assert.equal(chiamate, 2);
});

test('un errore dopo un risultato verde non conserva un falso verde e poi recupera', async () => {
  let ora = ORA; let chiamate = 0;
  const service = createAllerteMeteo(config, { now: () => ora, fetchImpl: async () => {
    chiamate++;
    return chiamate === 2 ? risposta({}, 500) : risposta(verde());
  } });
  assert.equal((await service.getStato()).stato, 'verde');
  ora += 300000;
  assert.equal((await service.getStato()).stato, 'non_verificabile');
  ora += 60000;
  assert.equal((await service.getStato()).stato, 'verde');
});

test('HTTP errore e null non diventano verde; ritenta dopo un minuto', async () => {
  for (const risultato of [() => risposta(null), () => risposta({}, 503), () => { throw new Error('rete'); }]) {
    let ora = ORA; let chiamate = 0;
    const service = createAllerteMeteo(config, { now: () => ora, fetchImpl: async () => { chiamate++; return risultato(); } });
    assert.equal((await service.getStato()).stato, 'non_verificabile');
    ora += 59000; await service.getStato(); assert.equal(chiamate, 1);
    ora += 1000; await service.getStato(); assert.equal(chiamate, 2);
  }
});

test('timeout anche con trasporto che ignora abort e corpo troppo grande', async () => {
  const service = createAllerteMeteo(config, { timeoutMs: 10, now: () => ORA, fetchImpl: () => new Promise(() => {}) });
  assert.equal((await service.getStato()).stato, 'non_verificabile');
  const grande = createAllerteMeteo(config, { now: () => ORA, fetchImpl: async () => new Response('x'.repeat(140000)) });
  assert.equal((await grande.getStato()).stato, 'non_verificabile');
});
