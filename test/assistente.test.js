const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { creaServizio, collega } = require('../src/assistente');
function ambiente(extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assistente-test-'));
  const faqPath = path.join(dir, 'faq.json');
  fs.writeFileSync(faqPath, JSON.stringify([{ id: 'stampante', d: 'Stampante bloccata', intro: 'Controlla se ci sono fogli incastrati senza smontare la stampante.' }]));
  let calls = [];
  const deps = { config: { base: '/assistenza', faqPath, categorie: { categorie: [{ id: 'pc', nome: 'Computer' }, { id: 'stampante', titolo: 'Stampanti' }] }, ente: {} },
    cacheFile: path.join(dir, 'indice.json'),
    numeriInterni: { carica: () => ({ sezioni: [{ titolo: 'Anagrafe', voci: [{ nome: 'Sportello', numero: '123' }] }] }) },
    utenteGlpi: async (req) => req.session.user.oid,
    glpi: { elencoTicket: async (id) => { calls.push(id); return [{ id: 1, titolo: 'Esempio', stato: 'In attesa', aperta: '2026-10-20' }]; },
      dettaglio: async (user, id) => { calls.push([user, id]); return user === 'alice' && id === 1 ? { titolo: 'Visibile', stato: 'Aperta', descrizione: 'Pubblico', _users: { segreto: 'non esporre' } } : null; } },
    chiamaAI: async (endpoint, body) => { calls.push(endpoint); return endpoint === '/api/embed' ? { embeddings: body.input.map(() => [1, 0]) } : { message: { content: 'Controlla la guida della stampante.' } }; }, ...extra };
  return { deps, calls, dir, servizio: creaServizio(deps), req: (id = 'alice') => ({ sessionID: id, session: { user: { oid: id } }, body: {} }),
    pulisci: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
async function invia(s, req, body) { req.body = body; return s.gestisci(req); }

test('sequenza reale breve: screenshot, chiamata audio e password non si contaminano', async () => {
  const richieste=[];
  const a=ambiente({chiamaAI:async(endpoint,body)=>{
    assert.equal(endpoint,'/api/chat');richieste.push(body);
    return {message:{content:body.messages[0].content.includes('recupero dell’accesso')
      ? 'La password della posta è la stessa usata per accedere al PC. Se non la ricordi, contatta l’assistenza senza comunicarla.'
      : body.messages[0].content.includes('Nuovo problema audio') ? 'Quale applicazione usi? Il problema è nell’ascolto con casse/cuffie oppure nel microfono?'
      : 'Risposta generata dal modello.'}};
  }});
  try {
    a.deps.config.assistentePasswordPcMicrosoft365=true;
    fs.writeFileSync(a.deps.config.faqPath,JSON.stringify([
      {id:'screenshot-allegati',d:'Screenshot',passi:[{t:'Premi Windows + Maiusc + S.'}]},
      {id:'password-dimenticata',d:'Password dimenticata',passi:[{t:'Se il recupero non è disponibile, contatta l’assistenza.'}]}
    ]));
    const req=a.req();
    for (const testo of ['come faccio uno screenshot?','come faccio uno screenshot?','non funziona l’audio nella call','no dimenticato la password della mia posta elettronica']) await invia(a.servizio,req,{testo});
    assert.equal(richieste.length,4);
    assert.match(richieste[0].messages[1].content,/Premi Windows/);
    assert.doesNotMatch(richieste[2].messages[1].content,/screenshot|Premi Windows/);
    assert.match(richieste[2].messages[0].content,/applicazione della chiamata/);
    assert.doesNotMatch(richieste[3].messages[1].content,/screenshot|nella call/);
    assert.match(richieste[3].messages[1].content,/password della posta di lavoro è la stessa/);
    const ultimo=req.session.assistente.ultima;
    assert.match(ultimo.risposta,/stessa.*PC/);
    assert.deepEqual(ultimo.fonti.map(f=>f.titolo),['Password dimenticata']);
  } finally {a.pulisci();}
});

test('password: relazione PC Microsoft 365 disattivata per default ed esclusa per account personali',()=>{
  const {piano}=require('../src/assistente-generazione');
  assert.deepEqual(piano(['Ho dimenticato la password della posta.']).fonti,[]);
  assert.equal(piano(['Ho dimenticato la password della posta.'],{passwordPcMicrosoft365:true}).fonti.length,1);
  assert.deepEqual(piano(['Ho dimenticato la password Gmail personale.'],{passwordPcMicrosoft365:true}).fonti,[]);
  assert.deepEqual(piano(['Ho dimenticato la password Gmail personale.'],{passwordPcMicrosoft365:true}).guide,[]);
});

test('domande generiche: risposta sempre generata, senza guide estranee o esempi storici', async () => {
  const chiamate = [];
  const a = ambiente({chiamaAI: async (endpoint, body) => {
    chiamate.push({endpoint,body});
    assert.equal(endpoint,'/api/chat');
    return {message:{content:'Risposta generata dal modello.'}};
  }});
  try {
    fs.writeFileSync(a.deps.config.faqPath,JSON.stringify([
      {id:'pc-lento-bloccato',d:'Computer lento',passi:[{t:'Salva il lavoro e chiudi i programmi inutili.'}]},
      {id:'outlook-non-si-apre',d:'Outlook non si avvia',passi:[{t:'Chiudi Outlook.'}]}
    ]));
    const lento = await invia(a.servizio,a.req(),{testo:'Il PC va lentamente con diversi programmi aperti.'});
    assert.equal(lento.risposta,'Risposta generata dal modello.');
    assert.deepEqual(lento.fonti.map(f=>f.titolo),['Computer lento']);
    assert.doesNotMatch(JSON.stringify(chiamate[0].body.messages),/Outlook non si avvia|ESEMPI STORICI/);
    const concetto = await invia(a.servizio,a.req(),{testo:'Quale differenza c’è fra memoria RAM e disco del computer?'});
    assert.equal(concetto.risposta,'Risposta generata dal modello.');
    assert.equal(concetto.fonti.length,1);
    assert.match(concetto.fonti[0].url,/support\.microsoft\.com/);
    assert.equal(chiamate.length,2);
    assert.match(chiamate[1].body.messages[0].content,/Domanda concettuale/);
    assert.doesNotMatch(chiamate[1].body.messages[1].content,/Computer lento|Outlook non si avvia/);
    assert.match(chiamate[1].body.messages[1].content,/RAM contiene temporaneamente/);
    assert.equal(chiamate[1].body.options.num_ctx,2048);
  } finally { a.pulisci(); }
});

test('prompt generativo conserva gli avvisi della guida e omette il riavvio già tentato', async () => {
  let prompt;
  const a=ambiente({chiamaAI:async (endpoint,body)=>{assert.equal(endpoint,'/api/chat');prompt=body.messages;return {message:{content:'Indica quale programma si blocca.'}};}});
  try {
    fs.writeFileSync(a.deps.config.faqPath,JSON.stringify([{id:'pc-lento-bloccato',d:'PC bloccato',passi:[
      {t:'Termina attività solo per il programma bloccato.',nota:'Il lavoro non salvato va perso.'},
      {t:'Riavvia il computer.'}
    ]}]));
    await invia(a.servizio,a.req(),{testo:'Il computer è bloccato. Ho già riavviato.'});
    const user=prompt[1].content;
    assert.match(user,/lavoro non salvato va perso/);
    assert.doesNotMatch(user,/Riavvia il computer/);
    assert.match(user,/riavvio/);
  } finally {a.pulisci();}
});

test('sintomi riconoscibili: prosegue tra turni senza modello, indice o accesso GLPI', async () => {
  const a = ambiente({chiamaAI: async () => { throw new Error('AI non disponibile'); },
    glpi: new Proxy({}, {get() { throw new Error('GLPI vietato'); }}),
    utenteGlpi: () => { throw new Error('Identità GLPI vietata'); }});
  try {
    const req = a.req();
    const primo = await invia(a.servizio, req, {testo: 'Non trovo la stampante tra quelle presenti dopo un aggiornamento.'});
    assert.match(primo.risposta, /manca dall’elenco/);
    const secondo = await invia(a.servizio, req, {testo: 'Ho già riavviato e la collega riesce a stampare, io non posso.'});
    assert.match(secondo.risposta, /riavvio.*non ha risolto/);
    assert.notEqual(primo.risposta, secondo.risposta);
    assert.doesNotMatch(secondo.risposta, /quando invii|in coda|quale stampante hai selezionato/i);
    assert.deepEqual(secondo.fonti, []);
    assert.ok(!fs.existsSync(a.deps.cacheFile));
    const posta = await invia(a.servizio, req, {testo: 'In Firefox la posta non apre gli allegati.'});
    assert.match(posta.risposta, /apertura degli allegati/);
    assert.doesNotMatch(posta.risposta, /stampante|invio|programma sul PC/);
    const confronto = await invia(a.servizio, req, {testo: 'In Edge lo stesso allegato si apre, in Firefox non succede niente.'});
    assert.match(confronto.risposta, /altro browser/);
    assert.doesNotMatch(confronto.risposta, /\?/);
    assert.deepEqual(a.calls, []);
  } finally { a.pulisci(); }
});

test('lingua, credenziali e caricamento documenti: niente procedure estranee o estensioni richieste due volte', async () => {
  const a = ambiente({chiamaAI: async () => { throw new Error('AI non disponibile'); }});
  try {
    const lingua = await invia(a.servizio, a.req(), {testo: 'Windows mostra i menu in inglese, ho già riavviato.'});
    assert.match(lingua.risposta, /CED/);
    assert.doesNotMatch(lingua.risposta, /Fusione|Impostazioni|riavvia il PC/);
    assert.deepEqual(lingua.fonti, []);
    const accesso = await invia(a.servizio, a.req(), {testo: 'Halley rifiuta la password e il recupero non funziona.'});
    assert.match(accesso.risposta, /già tentato il recupero/);
    assert.doesNotMatch(accesso.risposta, /chiudi tutte le finestre|pulsante Halley/);
    const file = await invia(a.servizio, a.req(), {testo: 'SLpct non trova i file p7m da caricare, vedo icone bianche.'});
    assert.match(file.risposta, /già indicato il formato p7m/);
    assert.doesNotMatch(file.risposta, /Qual.*estensione|Non riesco a formulare/);
    assert.match(file.risposta, /cartella/);
    const web = await invia(a.servizio, a.req(), {testo: 'Il servizio web mostra 503 Service Unavailable e ho una scadenza urgente.'});
    assert.match(web.risposta, /non dimostra che sia in manutenzione/);
    assert.match(web.risposta, /scadenza urgente/);
    assert.deepEqual(web.fonti, []);
  } finally { a.pulisci(); }
});

test('messaggi brevi con refuso e cambio argomento mantengono il percorso corretto', async () => {
  const a = ambiente({chiamaAI: async () => { throw new Error('Il percorso guidato non deve chiamare AI'); }});
  try {
    const req = a.req();
    const stampa = await invia(a.servizio, req, {testo: 'Stamparte scomparsa'});
    assert.match(stampa.risposta, /manca dall’elenco/);
    const lingua = await invia(a.servizio, req, {testo: 'Windows in inglese'});
    assert.match(lingua.risposta, /lingua dell’interfaccia/);
    assert.doesNotMatch(lingua.risposta, /stampante|servizio.*modificare/);
    assert.deepEqual(a.calls, []);
  } finally { a.pulisci(); }
});
test('contatti precisi disponibili anche con AI fuori servizio', async () => {
  const a = ambiente({ chiamaAI: async () => { throw new Error('offline'); } });
  try {
    const out = await invia(a.servizio, a.req(), { testo: 'Qual è il numero dell’anagrafe?' });
    assert.equal(out.contatti[0].numero, '123');
    assert.equal((await invia(a.servizio, a.req(), { testo: 'Numero del reparto inesistente' })).contatti.length, 0);
  } finally { a.pulisci(); }
});
test('suggerimenti di testo: fatti esatti, categorie validate, nessuna scrittura', async () => {
  const a = ambiente(), req = a.req();
  try {
    await invia(a.servizio, req, { azione: 'ticket' });
    await invia(a.servizio, req, { testo: 'La stampante non stampa' });
    await assert.rejects(invia(a.servizio, req, { azione: 'categoria', categoria: 'inesistente' }), { status: 400 });
    await invia(a.servizio, req, { azione: 'categoria', categoria: 'stampante' });
    await invia(a.servizio, req, { testo: 'Carta esaurita' });
    await invia(a.servizio, req, { testo: 'Ho aggiunto carta ma non cambia' });
    const out = await invia(a.servizio, req, { testo: 'Stampante corridoio' });
    assert.equal(out.bozza.categoria, 'Stampanti');
    assert.equal(out.bozza.descrizione, 'La stampante non stampa\n\nMessaggio di errore: Carta esaurita\n\nVerifiche già effettuate: Ho aggiunto carta ma non cambia\n\nPostazione o programma: Stampante corridoio');
    assert.deepEqual(a.calls, []);
  } finally { a.pulisci(); }
});
test('stato ticket rispetta utente e non espone utenti interni', async () => {
  const a = ambiente();
  try {
    const out = await invia(a.servizio, a.req(), { testo: 'Stato ticket #1' });
    assert.equal(out.richieste[0].titolo, 'Visibile');
    assert.ok(!JSON.stringify(out).includes('segreto'));
    assert.deepEqual((await invia(a.servizio, a.req('bob'), { testo: 'Stato ticket #1' })).richieste, []);
    assert.deepEqual(a.calls, [['alice', 1], ['bob', 1]]);
  } finally { a.pulisci(); }
});
test('sessione cambiata azzera la conversazione', async () => {
  const a = ambiente(), req = a.req();
  try {
    await invia(a.servizio, req, { testo: 'Numero anagrafe' });
    req.session.user.oid = 'bob';
    assert.deepEqual(a.servizio.stato(req).messaggi, []);
  } finally { a.pulisci(); }
});
test('problema non risolto non viene scambiato per stato dei ticket', async () => {
  const a = ambiente();
  try {
    assert.equal((await invia(a.servizio, a.req(), { testo: 'Non ho risolto il problema della stampante' })).tipo, 'chat');
    assert.ok(a.calls.includes('/api/chat'));
  } finally { a.pulisci(); }
});
test('FAQ rilette: modifica invalida indice e aggiorna fonti', async () => {
  const a = ambiente();
  try {
    const primo = await a.servizio.preparaIndice();
    fs.writeFileSync(a.deps.config.faqPath, JSON.stringify([{ id: 'rete', d: 'Rete', intro: 'Controlla il cavo di rete.' }]));
    const secondo = await a.servizio.preparaIndice();
    assert.notEqual(primo.impronta, secondo.impronta);
    assert.ok(secondo.documenti.some((d) => d.id === 'rete'));
    assert.ok(!secondo.documenti.some((d) => d.id === 'stampante'));
  } finally { a.pulisci(); }
});
test('API: autenticazione, CSRF e logout mentre il modello risponde', async () => {
  const express = require('express'), session = require('express-session');
  let sblocca, iniziata;
  const attesa = new Promise((r) => { iniziata = r; });
  const a = ambiente({ chiamaAI: async (endpoint, body) => endpoint === '/api/embed' ? { embeddings: body.input.map(() => [1, 0]) } : (iniziata(), await new Promise((r) => { sblocca = () => r({ message: { content: 'Risposta' } }); })) });
  const app = express(), api = express.Router();
  app.use(express.json()); app.use(session({ secret: 'solo-test-isolato', resave: false, saveUninitialized: false }));
  app.post('/test-login', (req, res) => { req.session.user = { oid: 'alice' }; res.json({ ok: true }); });
  app.post('/test-logout', (req, res) => req.session.destroy(() => res.end()));
  collega(api, { ...a.deps, serveLogin: (req, res, next) => req.session.user ? next() : res.sendStatus(401), csrf: (req, res, next) => req.get('X-CSRF-Token') === 'prova' ? next() : res.sendStatus(403) });
  app.use('/api', api);
  const server = app.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    assert.equal((await fetch(base + '/api/assistente')).status, 401);
    const login = await fetch(base + '/test-login', { method: 'POST' });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(base + '/api/assistente', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    const pendente = fetch(base + '/api/assistente', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': 'prova' }, body: JSON.stringify({ testo: 'La stampante è bloccata' }) });
    await attesa;
    await fetch(base + '/test-logout', { method: 'POST', headers: { Cookie: cookie } });
    sblocca();
    assert.equal((await pendente).status, 401);
    assert.equal((await fetch(base + '/api/assistente', { headers: { Cookie: cookie } })).status, 401);
  } finally { server.closeAllConnections(); await new Promise((r) => server.close(r)); a.pulisci(); }
});
