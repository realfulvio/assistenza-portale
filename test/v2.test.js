// Portale v2: dettaglio a conversazione, solo contenuti pubblici, PDF, versione e temi: npm test
process.env.DEMO = '1';
process.env.BASE_PATH = '/assistenza';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const app = require('../src/server');
const model = require('../public/appearance-model');
const { componi, elencoNomi, durata } = require('../src/ticket-dettaglio');

let server, url;
test.before(() => new Promise((ok) => { server = app.listen(0, '127.0.0.1', () => { url = `http://127.0.0.1:${server.address().port}/assistenza`; ok(); }); }));
test.after(() => server.close());

async function sessione() {
  let cookie = '';
  const rq = async (p, o = {}) => {
    const r = await fetch(url + p, { redirect: 'manual', ...o, headers: { cookie, ...(o.headers || {}) } });
    const sc = r.headers.getSetCookie?.() || [];
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
    return r;
  };
  await rq('/auth/login');
  return rq;
}

test('VERSION, CHANGELOG e footer sono coerenti', async () => {
  const v = fs.readFileSync(path.join(__dirname, '..', 'VERSION'), 'utf8').trim();
  assert.match(v, /^\d+\.\d+\.\d+$/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8'), new RegExp('## \\[' + v.replace(/\./g, '\\.') + '\\] - \\d{4}-\\d{2}-\\d{2}'));
  const html = await (await (await sessione())('/')).text();
  assert.ok(html.includes('v' + v));
  assert.match(html, /<span class="nv-d" id="nv-d">v[\d.]+ · \d+ \w+ \d{4}<\/span>/);
  assert.ok(!/__VERSIONE__|__DATA_VERSIONE__/.test(html));
});

test('temi: 11 temi, id 1.x invariati, preferenze 1.x ancora valide, nessuna richiesta esterna', () => {
  const ids = model.themes.map((t) => t[0]);
  for (const id of ['classic', 'dark', 'contrast', 'cyber', 'hawaii', 'mountain', 'terminal', 'fog', 'spazio', 'giardino', 'retro']) assert.ok(ids.includes(id), id);
  const vecchie = { theme: 'cyber', text: 120, icon: 100, roomy: true, motion: null };
  assert.deepEqual(model.validate(vecchie), { ...vecchie, size: 'm', density: 'a' });
  assert.throws(() => model.validate({ ...vecchie, size: 'xl' }));
  for (const f of ['style.css', 'temi.css', 'appearance.css', 'theme.css', 'avatar.css', 'stats-bar.css']) {
    const css = fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
    assert.ok(!/https?:\/\//.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'URL esterno in ' + f);
  }
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', 'fonts', 'press-start-2p-latin-400-normal.woff2')));
});

test('componi: avanzamento, ruoli, durate e «Gestita da» da dati grezzi', () => {
  const t = (s) => `2026-10-16 ${s}`;
  const raw = {
    ticket: { id: 49, name: 'Avvio srv', content: '<p>Accendere il server</p>', status: 6, date: t('11:38:00'), takeintoaccountdate: t('11:42:00'), solvedate: t('12:50:00'), closedate: t('13:05:00'), users_id_recipient: 9 },
    ticketUsers: [{ type: 1, users_id: 9 }, { type: 2, users_id: 5 }, { type: 2, users_id: 6 }],
    followups: [{ id: 1, users_id: 9, is_private: 0, date_creation: t('13:05:00'), content: '<p>Soluzione approvata</p>' }, { id: 2, users_id: 5, is_private: 1, date_creation: t('12:00:00'), content: '<p>SEGRETO</p>' }],
    solutions: [{ id: 1, users_id: 6, status: 3, date_creation: t('12:50:00'), date_approval: t('13:05:00'), users_id_approval: 9, content: '<p>Fatto</p>' }],
    tasks: [{ id: 1, users_id_tech: 5, is_private: 1, date_creation: t('12:10:00'), content: '<p>ATTIVITA PRIVATA</p>' }],
    logs: [{ id_search_option: 150, user_name: 'Erica B (5)', old_value: '0' }],
    users: { 9: { nome: 'Accorsi Luca' }, 5: { nome: 'Erica Bonamici' }, 6: { nome: 'Donato Veratti' } }
  };
  const d = componi(raw, 9);
  assert.equal(JSON.stringify(d).includes('SEGRETO'), false);
  assert.equal(JSON.stringify(d).includes('ATTIVITA PRIVATA'), false);
  assert.deepEqual(d.tappe.map((x) => x.fatta), [true, true, true, true]);
  assert.equal(d.durata, '1 h 27 min');
  assert.equal(d.inCaricoDopo, '4 min');
  assert.deepEqual(d.gestitaDa.map((id) => d.persone[id].nome), ['Erica Bonamici', 'Donato Veratti']);
  assert.equal(d.persone[9].ruolo, 'tu');
  assert.equal(d.persone[6].ruolo, 'tecnico');
  assert.deepEqual(d.eventi.map((e) => e.tipo), ['apertura', 'presa', 'soluzione', 'approvazione', 'chiusura']);
  assert.equal(d.eventi[3].testo, 'Soluzione approvata'); // il followup dell'approvazione non e' un messaggio a parte
  assert.equal(d.persone[d.eventi[1].chi].nome, 'Erica Bonamici');
  // senza tecnici, senza aggiornamenti: aperta
  const aperta = componi({ ticket: { id: 1, name: 'x', content: 'c', status: 1, date: t('10:00:00') }, ticketUsers: [{ type: 1, users_id: 9 }], users: { 9: { nome: 'A B' } } }, 9);
  assert.deepEqual(aperta.gestitaDa, []);
  assert.deepEqual(aperta.tappe.map((x) => x.fatta), [true, false, false, false]);
  assert.equal(aperta.durata, null);
  assert.equal(elencoNomi(['A', 'B', 'C']), 'A, B e C');
  assert.equal(elencoNomi(['A', 'B', 'C', 'D', 'E']), 'A, B e altri 3');
  assert.equal(durata(0, 90 * 60000), '1 h 30 min');
});

test('dettaglio API: conversazione, nessun dato privato, nessuna email, foto solo con token', async () => {
  const rq = await sessione();
  const lista = await (await rq('/api/richieste')).json();
  assert.ok(lista.length >= 3);
  for (const r of lista) {
    const txt = await (await rq('/api/richieste/' + r.id)).text();
    assert.ok(!/NOTA PRIVATA|ATTIVITA PRIVATA/.test(txt), 'contenuto privato nel ticket ' + r.id);
    assert.ok(!/@esempio\.it/.test(txt), 'email esposta nel ticket ' + r.id);
  }
  const completa = lista.find((r) => /server di consultazione/.test(r.titolo));
  const d = await (await rq('/api/richieste/' + completa.id)).json();
  assert.equal(d.stato, 'Chiusa');
  assert.ok(d.gestitaDa.length === 2);
  assert.ok(d.eventi.some((e) => e.tipo === 'approvazione'));
  assert.equal((await fetch(url + '/api/foto/' + 'a'.repeat(64) + '.' + 'b'.repeat(32))).status, 401);
  assert.equal((await rq('/api/foto/' + 'a'.repeat(64) + '.' + 'b'.repeat(32))).status, 404);
  const nuova = lista.find((r) => /Outlook/.test(r.titolo));
  const n = await (await rq('/api/richieste/' + nuova.id)).json();
  assert.deepEqual(n.gestitaDa, []);
  assert.equal(n.aggiornamenti, 0);
});

test('PDF: A4 valido, nome file, solo il proprietario, piu pagine, richiesta aperta', async () => {
  const rq = await sessione();
  const lista = await (await rq('/api/richieste')).json();
  const completa = lista.find((r) => /server di consultazione/.test(r.titolo));
  const r = await rq(`/api/richieste/${completa.id}/pdf`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  assert.match(r.headers.get('content-disposition'), /filename="richiesta-\d+-computer-avvio-del-server-di-consultazione\.pdf"/);
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
  assert.match(buf.toString('latin1'), /\/MediaBox \[0 0 595\.28 841\.89\]/);
  assert.equal((await fetch(`${url}/api/richieste/${completa.id}/pdf`)).status, 401);
  // un altro utente non vede il PDF di questa richiesta
  const glpi = require('../src/glpi-client');
  const altro = await glpi.risolviRichiedente({ email: 'altro-v2@esempio.it', name: 'Altro Utente' });
  assert.equal(await glpi.dettaglio(altro, completa.id), null);
  // richiesta lunga: la cronologia continua sulla pagina successiva
  const pdf = require('../src/pdf');
  const d = await glpi.dettaglio(1, completa.id);
  delete d._users;
  for (let i = 0; i < 40; i++) d.eventi.push({ tipo: 'messaggio', chi: d.eventi[0].chi, data: d.aperta, testo: 'Riga di prova numero ' + i + ' con un testo abbastanza lungo da occupare spazio nella tabella.' });
  const lungo = await pdf.genera(d, 'Prova Utente');
  assert.ok((lungo.toString('latin1').match(/\/Type \/Page\b/g) || []).length >= 2);
  // richiesta aperta: «In corso»
  const aperta = await glpi.dettaglio(1, lista.find((r) => /Outlook/.test(r.titolo)).id);
  delete aperta._users;
  assert.equal(aperta.durata, null);
  assert.equal((await pdf.genera(aperta, 'Prova Utente')).subarray(0, 5).toString(), '%PDF-');
});

test('nuova richiesta: il pulsante rapido diventa la prima riga, solo se della categoria', async () => {
  const rq = await sessione();
  const me = await (await rq('/api/me')).json();
  const cat = me.categorie.find((c) => c.rapidi.length);
  assert.ok(cat, 'categorie con pulsanti rapidi');
  const fd = (extra) => { const f = new FormData(); for (const [k, v] of Object.entries({ categoria: cat.id, descrizione: 'Il computer non si accende da stamattina', ...extra })) f.append(k, v); return f; };
  const h = { 'x-csrf-token': me.csrf };
  assert.equal((await rq('/api/richieste', { method: 'POST', headers: h, body: fd({ sottotipo: 'inventato' }) })).status, 400);
  const r = await rq('/api/richieste', { method: 'POST', headers: h, body: fd({ sottotipo: cat.rapidi[0], reperibilita: 'Mattina' }) });
  assert.equal(r.status, 201);
  const glpi = require('../src/glpi-client');
  const ticket = glpi._tickets.get((await r.json()).id).ticket;
  assert.ok(ticket.content.startsWith(`<p><b>Problema: ${cat.rapidi[0]}</b></p>`));
  assert.match(ticket.content, /Reperibilità: Mattina/);
});
