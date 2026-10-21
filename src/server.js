// Portale Assistenza - apertura e consultazione di richieste di assistenza su GLPI
// Copyright (c) Servizio Sistemi Informativi - Licenza EUPL-1.2
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const glpi = require('./glpi-client');
const stats = require('./stats');
const numeriInterni = require('./numeri-interni');
const avatar = require('./avatar');
const multer = require('multer');
const auth = require('./auth');
const preferences = require('./preferences');
const pdf = require('./pdf');
const versione = require('./versione');
const { upload, verificaFile } = require('./uploads');
const { pcValido, ipPulito } = require('./contenuto');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // dietro reverse proxy locale

// Log senza dati sensibili: solo metodo, percorso (senza query), esito
const log = (...a) => console.log(new Date().toISOString(), ...a);

// Sostituisce i segnaposto {{sezione.chiave}} di index.html con i valori di config/ente.json (testo sempre escapato)
const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function valoreEnte(chiave) {
  return chiave.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), config.ente);
}
function personalizza(html) {
  const s = config.ente.servizio || {};
  // In modalita' DEMO il pulsante di accesso lo dice chiaramente
  if (config.demo) config.ente.testi = { ...(config.ente.testi || {}), pulsanteAccesso: 'Entra nella demo (nessun account necessario)' };
  const extra = {
    // blocchi facoltativi: compaiono solo se il dato e' configurato
    _emailHtml: s.email ? `<p>Posta elettronica: <a href="mailto:${escHtml(s.email)}">${escHtml(s.email)}</a></p>` : '',
    _telefonoHtml: s.telefonoUrgenze ? `<p>Telefono per le urgenze: <a href="tel:${escHtml(String(s.telefonoUrgenze).replace(/\s+/g, ''))}">${escHtml(s.telefonoUrgenze)}</a></p>` : ''
  };
  return html.replace(/\{\{([\w.]+)\}\}/g, (m, k) => (k in extra ? extra[k] : escHtml(valoreEnte(k) ?? '')));
}

let origineIssuer = [];
try { if (config.oidc.issuer) origineIssuer = [new URL(config.oidc.issuer).origin]; } catch { /* issuer non valido: segnalato al login */ }
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", 'data:', 'blob:'],
    connectSrc: ["'self'"], formAction: ["'self'", ...origineIssuer], frameAncestors: ["'none'"], objectSrc: ["'none'"], baseUri: ["'self'"]
  } },
  hsts: config.hsts ? { maxAge: 15552000 } : false, // attivare solo con certificato definitivo
  crossOriginEmbedderPolicy: false
}));

const router = express.Router();
router.use(session({
  name: 'portale.sid', secret: config.sessionSecret, resave: false, saveUninitialized: false, rolling: true,
  store: new MemoryStore({ checkPeriod: 10 * 60 * 1000 }),
  cookie: { httpOnly: true, sameSite: 'lax', secure: config.prod, maxAge: config.sessionHours * 3600 * 1000, path: config.base || '/' }
}));

router.use(express.json({ limit: '20kb' }));

// --- CSRF: token legato alla sessione, richiesto come header sulle richieste che modificano dati
function csrfToken(req) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  return req.session.csrf;
}
function csrf(req, res, next) {
  const t = req.get('x-csrf-token') || '';
  const dato = Buffer.from(t), atteso = Buffer.from(req.session.csrf || '');
  const ok = atteso.length > 0 && dato.length === atteso.length && crypto.timingSafeEqual(dato, atteso);
  if (!ok) return res.status(403).json({ errore: 'Sessione non valida. Ricarica la pagina e riprova.' });
  next();
}
function serveLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ errore: 'Non autenticato' });
  next();
}

const limiteAccesso = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
router.use('/auth', limiteAccesso);
router.use('/auth', (req, res, next) => (req.method === 'POST' ? csrf(req, res, next) : next()), auth);
// Indirizzo di ritorno dell'accesso: se quello gia' registrato nell'app Entra (OIDC_REDIRECT_URI) non e' <base>/auth/callback,
// per esempio dopo la migrazione da un'altra installazione, la stessa gestione risponde anche su quel percorso:
// non serve cambiare la registrazione dell'app.
const ritorno = (() => { try { return new URL(config.oidc.redirectUri).pathname.replace(/\/+$/, ''); } catch { return ''; } })();
if (ritorno && ritorno !== config.base + '/auth/callback' && ritorno.startsWith(config.base + '/')) {
  router.get(ritorno.slice(config.base.length), limiteAccesso, (req, res, next) => { req.url = '/callback' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''); auth(req, res, next); });
}

// --- API
const api = express.Router();
api.get('/me', (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!req.session.user) return res.status(401).json({ errore: 'Non autenticato' });
  const { name, email } = req.session.user;
  avatar.registraEmail(req.session.user);
  res.json({ nome: name, email, csrf: csrfToken(req), demo: config.demo, versione: versione.numero, appearance: preferences.read(req.session.user), limiti: { maxFiles: config.limits.maxFiles, maxFileBytes: config.limits.maxFileBytes }, categorie: config.categorie.categorie.map(({ id, nome, icona, sotto, titolo, colore, temaColore, placeholder, rapidi }) => ({ id, nome, icona, sotto, titolo, colore, temaColore, placeholder, rapidi: Array.isArray(rapidi) ? rapidi.map(String).slice(0, 8) : [] })) });
});
api.get('/csrf', (req, res) => res.json({ csrf: csrfToken(req) }));
api.get('/preferenze', serveLogin, (req, res) => {
  res.set('Cache-Control', 'no-store').json(preferences.read(req.session.user));
});
api.put('/preferenze', serveLogin, csrf, (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { require('../public/appearance-model').validate(req.body); }
  catch { return res.status(400).json({ errore: 'Preferenze non valide: controlla tema, dimensioni e spaziatura.' }); }
  try { res.json({ preferences: preferences.write(req.session.user, req.body), available: true }); }
  catch { res.status(503).json({ errore: 'Aspetto applicato, ma non salvato sul tuo account. Riprova: puoi continuare a usare il portale.' }); }
});
api.get('/faq', serveLogin, (req, res) => res.json(JSON.parse(fs.readFileSync(config.faqPath, 'utf8'))));
// Numeri interni: file locale non versionato, riletto a ogni richiesta (vedi src/numeri-interni.js)
api.get('/numeri-interni', serveLogin, (req, res) => {
  res.set('Cache-Control', 'no-store').json(numeriInterni.carica({ file: config.numeriInterniPath, esempio: config.numeriInterniEsempio, demo: config.demo }));
});
// Barra «Live»: numeri aggregati dei ticket (cache lato server). Se GLPI non risponde: 200 con { ok: false }
api.get('/stats', serveLogin, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { dati, daCache } = await stats.statistiche();
    res.set('X-Cache', daCache ? 'HIT' : 'MISS').json(dati);
  } catch { res.json({ ok: false }); }
});
// Consigli prima di inviare (content/suggerimenti.json, riletto a ogni richiesta; se manca: nessun consiglio)
api.get('/suggerimenti', serveLogin, (req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(path.join(config.root, 'content', 'suggerimenti.json'), 'utf8'))); } catch { res.json([]); }
});

// --- Foto profilo: sempre e solo quella dell'utente in sessione (mai un id dal client)
const limiteFoto = rateLimit({
  windowMs: 60 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => 'foto:' + preferences.key(req.session.user),
  handler: (req, res) => res.status(429).json({ errore: 'Hai cambiato foto molte volte: riprova tra un po\'.' })
});
const caricaFoto = multer({ storage: multer.memoryStorage(), limits: { files: 1, fileSize: avatar.opzioni.maxByte, fields: 0, parts: 2 } }).single('foto');
const infoFoto = (req) => avatar.info(req.session.user);
api.get('/profilo/foto/info', serveLogin, (req, res) => res.set('Cache-Control', 'no-store').json(infoFoto(req)));
api.get('/profilo/foto', serveLogin, (req, res) => {
  const buf = avatar.leggi(req.session.user);
  if (!buf) return res.status(404).set('Cache-Control', 'no-store').end();
  const etag = '"' + crypto.createHash('sha256').update(buf).digest('base64url').slice(0, 27) + '"';
  res.set({ 'Cache-Control': 'private, max-age=86400', ETag: etag, 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff' });
  if (req.get('if-none-match') === etag) return res.status(304).end();
  res.send(buf);
});
// Limite del corpo valutato sugli header, prima di login e parsing (equivale al limite del web server su questa sola rotta)
const corpoFoto = (req, res, next) => {
  const n = Number(req.get('content-length') || 0);
  if (n <= avatar.opzioni.maxByte + 64 * 1024) return next();
  if (n > 20 * 1024 * 1024) res.set('Connection', 'close'); // corpi enormi: niente lettura, connessione chiusa
  res.status(413).json({ errore: 'File troppo grande (massimo 3 MB)' });
};
api.post('/profilo/foto', corpoFoto, serveLogin, csrf, limiteFoto, (req, res, next) => caricaFoto(req, res, async (err) => {
  try {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ errore: 'File troppo grande (massimo 3 MB)' });
      return res.status(400).json({ errore: 'Formato non supportato' });
    }
    if (!req.file) return res.status(400).json({ errore: 'Scegli una foto da caricare.' });
    await avatar.salvaManuale(req.session.user, req.file.buffer);
    log('foto profilo caricata');
    res.json(infoFoto(req));
  } catch (e) {
    if (e.utente) return res.status(e.status || 400).json({ errore: e.message });
    next(e);
  }
}));
api.post('/profilo/foto/rimuovi', serveLogin, csrf, (req, res, next) => {
  try { avatar.rimuovi(req.session.user); res.json(infoFoto(req)); } catch (e) { next(e); }
});
api.post('/profilo/foto/microsoft', serveLogin, csrf, limiteFoto, async (req, res, next) => {
  try {
    const g = req.session.graph;
    if (!g || !g.token || g.scade < Date.now() + 60_000) return res.status(409).json({ errore: 'Per usare la foto di Microsoft 365 esci e accedi di nuovo, poi riprova.' });
    const esito = await avatar.sincronizza(req.session.user, g.token, { forza: true });
    if (esito === 'nessuna') return res.status(404).json({ errore: 'Non hai una foto su Microsoft 365.', ...infoFoto(req) });
    if (esito !== 'ok') return res.status(502).json({ errore: 'Microsoft 365 non risponde: riprova tra qualche minuto.' });
    res.json(infoFoto(req));
  } catch (e) { next(e); }
});

// Cache dell'id utente GLPI nella sessione
async function utenteGlpi(req) {
  if (!req.session.glpiId) {
    req.session.glpiId = await glpi.risolviRichiedente({ email: req.session.user.email, name: req.session.user.name });
  }
  return req.session.glpiId;
}

const limiteInvio = rateLimit({
  windowMs: 60 * 60_000, limit: config.limits.maxTicketsPerHour, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => 'u:' + req.session.user.email,
  handler: (req, res) => res.status(429).json({ errore: 'Hai inviato molte richieste in poco tempo. Riprova tra un po\' oppure chiamaci.' })
});
const inCorso = new Set(); // blocco doppio invio lato server

api.post('/richieste', serveLogin, csrf, limiteInvio, (req, res, next) => upload.array('allegati', config.limits.maxFiles)(req, res, (err) => {
  if (!err) return next();
  const mb = Math.round(config.limits.maxFileBytes / 1024 / 1024);
  const msg = err.code === 'LIMIT_FILE_SIZE' ? `Un allegato supera i ${mb} MB.` : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? `Puoi allegare al massimo ${config.limits.maxFiles} file.` : err.utente ? err.message : null;
  if (!msg) return next(err);
  res.status(400).json({ errore: msg });
}), async (req, res, next) => {
  const chiave = req.session.user.email;
  if (inCorso.has(chiave)) return res.status(409).json({ errore: 'Invio già in corso, attendi un momento.' });
  inCorso.add(chiave);
  try {
    const b = req.body || {};
    const categoria = config.categorie.categorie.find((c) => c.id === b.categoria);
    const descrizione = String(b.descrizione || '').trim();
    const telefono = String(b.telefono || '').trim();
    const reperibilita = String(b.reperibilita || '').trim();
    const sottotipo = String(b.sottotipo || '').trim();
    if (!categoria) return res.status(400).json({ errore: 'Scegli un argomento.' });
    if (descrizione.length < 15 || descrizione.length > 4000) return res.status(400).json({ errore: 'La descrizione deve avere da 15 a 4000 caratteri.' });
    if (telefono && !/^[0-9+()\s./-]{3,25}$/.test(telefono)) return res.status(400).json({ errore: 'Il numero di telefono non sembra valido.' });
    if (reperibilita.length > 200) return res.status(400).json({ errore: 'Reperibilità troppo lunga (max 200 caratteri).' });
    if (sottotipo && !(categoria.rapidi || []).includes(sottotipo)) return res.status(400).json({ errore: 'Scelta rapida non valida per questo argomento.' });
    const files = req.files || [];
    verificaFile(files);
    const userId = await utenteGlpi(req);
    const { name, email } = req.session.user;
    const id = await glpi.creaTicket({ userId, categoria, sottotipo, descrizione, telefono, reperibilita, nome: name, email, pc: req.session.pc || null, ip: ipPulito(req.ip), ua: req.get('user-agent') });
    let allegatiFalliti = 0;
    for (const f of files) { try { await glpi.allega(id, f); } catch { allegatiFalliti++; } }
    log('ticket creato', id, 'cat', categoria.id, 'allegati', files.length, 'falliti', allegatiFalliti);
    res.status(201).json({ id, categoria: categoria.nome, allegatiFalliti });
  } catch (e) { next(e); } finally { inCorso.delete(chiave); }
});

api.get('/richieste', serveLogin, async (req, res, next) => {
  try { res.set('Cache-Control', 'no-store'); res.json(await glpi.elencoTicket(await utenteGlpi(req))); } catch (e) { next(e); }
});

function idTicket(req, res, next) {
  if (!/^\d{1,9}$/.test(req.params.id)) return res.status(404).json({ errore: 'Richiesta non trovata.' });
  req.tid = Number(req.params.id);
  next();
}
// --- Dettaglio pubblico di una richiesta (pagina, stampa, PDF): il controllo di proprieta' e' nel client GLPI
const firmaFoto = (req, k) => crypto.createHmac('sha256', config.sessionSecret).update('foto:' + k + ':' + req.session.user.email).digest('base64url').slice(0, 32);
async function dettaglioPubblico(req) {
  const d = await glpi.dettaglio(await utenteGlpi(req), req.tid);
  if (!d) return null;
  const users = d._users || {};
  delete d._users;
  for (const p of Object.values(d.persone)) {
    const f = p.ruolo === 'tu' ? (avatar.info(req.session.user).v ? { k: null, v: avatar.info(req.session.user).v } : null) : avatar.fotoPerEmail((users[p.id] || {}).email);
    p.foto = !f ? null : f.k ? `${config.base}/api/foto/${f.k}.${firmaFoto(req, f.k)}?v=${f.v}` : `${config.base}/api/profilo/foto?v=${f.v}`;
  }
  return d;
}
// Foto di un'altra persona di un ticket: solo con il token emesso nel dettaglio per questa sessione
api.get('/foto/:token', serveLogin, (req, res) => {
  const m = /^([a-f0-9]{64})\.([A-Za-z0-9_-]{32})$/.exec(req.params.token);
  const atteso = m && firmaFoto(req, m[1]);
  if (!m || !crypto.timingSafeEqual(Buffer.from(m[2]), Buffer.from(atteso))) return res.status(404).end();
  const buf = avatar.leggiChiave(m[1]);
  if (!buf) return res.status(404).set('Cache-Control', 'no-store').end();
  const etag = '"' + crypto.createHash('sha256').update(buf).digest('base64url').slice(0, 27) + '"';
  res.set({ 'Cache-Control': 'private, max-age=86400', ETag: etag, 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff' });
  if (req.get('if-none-match') === etag) return res.status(304).end();
  res.send(buf);
});
// Riepilogo PDF (A4) generato sul server, in memoria: nessun file temporaneo
const limitePdf = rateLimit({ windowMs: 10 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => 'pdf:' + req.session.user.email,
  handler: (req, res) => res.status(429).json({ errore: 'Troppi PDF in poco tempo: riprova tra qualche minuto.' }) });

api.get('/richieste/:id', serveLogin, idTicket, async (req, res, next) => {
  try {
    const d = await dettaglioPubblico(req);
    if (!d) return res.status(404).json({ errore: 'Richiesta non trovata.' });
    res.set('Cache-Control', 'no-store'); res.json(d);
  } catch (e) { next(e); }
});
api.get('/richieste/:id/pdf', serveLogin, idTicket, limitePdf, async (req, res, next) => {
  try {
    const d = await dettaglioPubblico(req);
    if (!d) return res.status(404).json({ errore: 'Richiesta non trovata.' });
    const buf = await pdf.genera(d, req.session.user.name);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${pdf.nomeFile(d)}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    log('pdf richiesta', d.id);
    res.send(buf);
  } catch (e) { next(e); }
});
api.post('/richieste/:id/messaggi', serveLogin, csrf, idTicket, async (req, res, next) => {
  try {
    const testo = String((req.body || {}).testo || '').trim();
    if (testo.length < 2 || testo.length > 4000) return res.status(400).json({ errore: 'Scrivi un messaggio (max 4000 caratteri).' });
    const userId = await utenteGlpi(req);
    if (!(await glpi.ticketDi(userId, req.tid))) return res.status(404).json({ errore: 'Richiesta non trovata.' });
    await glpi.aggiungiMessaggio(userId, req.tid, req.session.user.name, testo);
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});
api.post('/richieste/:id/esito', serveLogin, csrf, idTicket, async (req, res, next) => {
  try {
    const esito = String((req.body || {}).esito || '');
    if (!['risolto', 'riapri'].includes(esito)) return res.status(400).json({ errore: 'Scelta non valida.' });
    const r = await glpi.esitoSoluzione(await utenteGlpi(req), req.tid, req.session.user.name, esito);
    if (r === null) return res.status(404).json({ errore: 'Richiesta non trovata.' });
    if (r === 'stato') return res.status(409).json({ errore: 'Questa richiesta non è più in attesa di conferma: ricarica la pagina per vedere lo stato aggiornato.' });
    log('esito soluzione', req.tid, esito);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
// Assistente separato dal modulo ticket: sola consultazione e suggerimenti in chat.
require('./assistente').collega(api, { config, numeriInterni, glpi, utenteGlpi, serveLogin, csrf });
router.use('/api', api);

// --- Pagine (single page app): index con percorso base iniettato
// __V__ = versione dei file (data di modifica): cambia a ogni rilascio e forza il browser a ricaricare CSS e JS
const versioneFile = versione.numero + ['style.css', 'app.js', 'appearance.css', 'readability.css', 'appearance.js', 'appearance-model.js', 'theme-icons.svg', 'theme-landscapes.svg', 'stats-bar.css', 'stats-bar.js', 'avatar.css', 'avatar.js', 'theme.css', 'temi.css', 'temi.js'].map((f) => Math.floor(fs.statSync(path.join(config.root, 'public', f)).mtimeMs / 1000).toString(36)).join('')
  + Math.floor(fs.statSync(config.enteFile).mtimeMs / 1000).toString(36);
const indice = personalizza(fs.readFileSync(path.join(config.root, 'public', 'index.html'), 'utf8'))
  .replaceAll('__BASE__', config.base).replaceAll('__V__', versioneFile).replace('__LINK_UTILI__', require('./link-utili').html(config.root));
const pagina = (req, res) => {
  // ?pc=NOMEPC dall'icona sul desktop (nome del parametro: PC_PARAM): se valido resta in sessione e finisce nel ticket
  const pc = config.pcParam ? pcValido(req.query[config.pcParam]) : null;
  if (pc) req.session.pc = pc;
  const p = req.session.user ? preferences.read(req.session.user).preferences : require('../public/appearance-model').defaults();
  const attrs = Object.entries(require('../public/appearance-model').attributes(p)).map(([k, v]) => `data-${k}="${escHtml(v)}"`).join(' ');
  const rilascio = versione.leggi();
  res.set('Cache-Control', 'no-store').type('html').send(indice.replace('__APPEARANCE__', attrs)
    .replaceAll('__VERSIONE__', rilascio.numero).replaceAll('__DATA_VERSIONE__', rilascio.dataBreve).replace('__NOVITA__', versione.htmlNovita(rilascio)));
};
router.get(['/', '/errore', '/non-consentito'], pagina);

// Colori dell'ente (config/ente.json) come variabili CSS: solo colori esadecimali validi
const colore = (v, d) => (/^#[0-9a-fA-F]{3,8}$/.test(String(v || '')) ? v : d);
const g = config.ente.grafica || {};
const enteCss = `:root,html[data-theme=classic]{--primary:${colore(g.colorePrimario, '#005e8e')};--head:${colore(g.colorePrimario, '#005e8e')};--herotext:${colore(g.colorePrimarioScuro, '#004a70')};--top:${colore(g.coloreBarra, '#001a4d')};--foot:${colore(g.coloreBarra, '#001a4d')};--bg:${colore(g.coloreSfondo, '#f2f2f2')}}\n`;
router.get('/ente.css', (req, res) => res.set('Cache-Control', 'no-cache').type('css').send(enteCss));
router.use(express.static(path.join(config.root, 'public'), {
  index: false, maxAge: config.prod ? '1h' : 0,
  // CSS e JS si rivalidano sempre (ETag): niente pagina nuova con stile vecchio dopo un rilascio
  setHeaders: (res, file) => { if (/\.(css|js)$/.test(file)) res.setHeader('Cache-Control', 'no-cache'); }
}));

app.use(config.base || '/', router);
if (config.base) app.get('/', (req, res) => res.redirect(config.base + '/'));

// Errori: messaggio amichevole, dettagli solo nei log
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  log('errore', req.method, req.path, err.status || '', err.message);
  if (res.headersSent) return;
  const msg = 'Qualcosa non ha funzionato. Riprova tra poco; se il problema continua chiamaci.';
  if (err.utente) return res.status(400).json({ errore: err.message });
  if (req.path.includes('/api/')) return res.status(err.status >= 400 && err.status < 500 ? err.status : 500).json({ errore: msg });
  res.redirect(config.base + '/errore');
});

function avvia() {
  return app.listen(config.port, config.host, () => {
    log(`Portale in ascolto su http://${config.host}:${config.port}${config.base}/`);
    if (config.demo) log('MODALITA DEMO: accesso simulato e GLPI finto. Non usare in produzione.');
  });
}
if (require.main === module) avvia();
module.exports = app;
module.exports.avvia = avvia;
