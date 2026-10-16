// Foto profilo: origine «manual» (caricata dall'utente) > «m365» (Microsoft Graph) > «none» (iniziali).
// Le foto sono file WebP 128x128 senza metadati in AVATAR_DIR, con nome generato dal server (hash dell'identita',
// lo stesso delle preferenze). Accanto, un piccolo JSON con origine e date: nessuna foto in database.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
// Stessa chiave delle preferenze personali, se il modulo c'e'; altrimenti hash di emittente, tenant e id utente
let preferences = null;
try { preferences = require('./preferences'); } catch { /* modulo preferenze assente */ }
const chiave = (user) => {
  if (!user || !user.oid) throw new Error('Identità mancante.');
  return crypto.createHash('sha256').update(JSON.stringify([(config.oidc && config.oidc.issuer) || 'development', user.tenant || '', user.oid])).digest('hex');
};

const e = process.env;
const num = (v, d) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const opzioni = {
  // Predefinito: accanto alle preferenze (es. /var/lib/portale-assistenza/avatars), altrimenti data/avatars
  dir: e.AVATAR_DIR || (e.PREFERENCES_DIR ? path.join(path.dirname(e.PREFERENCES_DIR), 'avatars') : path.join(config.root, 'data', 'avatars')),
  syncGiorni: num(e.AVATAR_SYNC_GIORNI, 7),
  maxByte: 3 * 1024 * 1024,
  maxPixel: 25_000_000,
  lato: 128,
  graphUrl: 'https://graph.microsoft.com/v1.0/me/photo/$value'
};
const ORIGINI = ['m365', 'manual', 'none'];
const FORMATI = ['jpeg', 'png', 'webp'];

class ErroreFoto extends Error {
  constructor(msg, status = 400) { super(msg); this.utente = true; this.status = status; }
}

let sharp = null;
function libreria() {
  if (!sharp) {
    sharp = require('sharp');
    sharp.cache(false); // server con poca memoria: nessuna cache tra un'elaborazione e l'altra
    sharp.concurrency(1);
  }
  return sharp;
}

const id = (user) => (preferences ? preferences.key(user) : chiave(user)); // solo esadecimale: mai input dell'utente nel nome del file
const file = (user, ext) => path.join(opzioni.dir, id(user) + ext);

function stato(user) {
  try {
    const s = JSON.parse(fs.readFileSync(file(user, '.json'), 'utf8'));
    return { origine: ORIGINI.includes(s.origine) ? s.origine : 'none', sincronizzato: s.sincronizzato || null, modificato: s.modificato || null };
  } catch { return { origine: 'none', sincronizzato: null, modificato: null }; }
}

// Scrittura atomica (file temporaneo + rename), permessi solo per l'utente del servizio
function scrivi(dest, dati) {
  fs.mkdirSync(opzioni.dir, { recursive: true, mode: 0o700 });
  const tmp = dest + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
  try {
    fs.writeFileSync(tmp, dati, { mode: 0o600, flag: 'wx' });
    fs.renameSync(tmp, dest);
  } finally { try { fs.unlinkSync(tmp); } catch { /* gia' rinominato */ } }
}
function salvaStato(user, s) { scrivi(file(user, '.json'), JSON.stringify(s) + '\n'); return s; }
function togliFile(user) { try { fs.unlinkSync(file(user, '.webp')); } catch (err) { if (err.code !== 'ENOENT') throw err; } }

// Decodifica reale dell'immagine (non estensione ne' Content-Type), primo fotogramma, ritaglio centrato,
// 128x128, WebP ~80. sharp non copia EXIF/ICC/XMP se non richiesto: l'output e' senza metadati.
async function elabora(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new ErroreFoto('Formato non supportato');
  if (buffer.length > opzioni.maxByte) throw new ErroreFoto('File troppo grande (massimo 3 MB)', 413);
  const s = libreria();
  let meta;
  // Solo intestazione (nessuna decodifica dei pixel): il limite dei megapixel si controlla subito dopo
  try { meta = await s(buffer, { limitInputPixels: false, pages: 1 }).metadata(); } catch { throw new ErroreFoto('Formato non supportato'); }
  if (!FORMATI.includes(meta.format)) throw new ErroreFoto('Formato non supportato');
  if (!meta.width || !meta.height || meta.width * meta.height > opzioni.maxPixel) throw new ErroreFoto('Impossibile elaborare l\'immagine');
  try {
    return await s(buffer, { limitInputPixels: opzioni.maxPixel, pages: 1, failOn: 'error' })
      .rotate() // orientamento EXIF applicato ai pixel, poi l'EXIF sparisce
      .resize(opzioni.lato, opzioni.lato, { fit: 'cover', position: 'centre' })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();
  } catch { throw new ErroreFoto('Impossibile elaborare l\'immagine'); }
}

async function salvaManuale(user, buffer) {
  const webp = await elabora(buffer);
  scrivi(file(user, '.webp'), webp);
  const ora = new Date().toISOString();
  return salvaStato(user, { ...stato(user), origine: 'manual', modificato: ora });
}

function rimuovi(user) {
  togliFile(user);
  return salvaStato(user, { ...stato(user), origine: 'none', modificato: new Date().toISOString() });
}

// Foto da Microsoft Graph con il token del login (User.Read). Ritorna 'ok' | 'nessuna' (404) | 'errore'
async function scaricaGraph(token) {
  if (!token) return { esito: 'errore' };
  try {
    const r = await fetch(opzioni.graphUrl, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(8000) });
    if (r.status === 404) return { esito: 'nessuna' };
    if (!r.ok) return { esito: 'errore' };
    const buf = Buffer.from(await r.arrayBuffer());
    return { esito: 'ok', webp: await elabora(buf) };
  } catch { return { esito: 'errore' }; }
}

// Sincronizzazione: la foto manuale non viene mai toccata. forza=true per «Usa la foto Microsoft 365».
// Ritorna 'ok' | 'nessuna' | 'errore' | 'saltata'
async function sincronizza(user, token, { forza = false } = {}) {
  const s = stato(user);
  if (!forza) {
    if (s.origine === 'manual') return 'saltata';
    if (s.sincronizzato && Date.now() - Date.parse(s.sincronizzato) < opzioni.syncGiorni * 86400000) return 'saltata';
  }
  const g = await module.exports.scaricaGraph(token);
  if (g.esito === 'errore') return 'errore'; // 403, rete, timeout: nulla cambia
  const ora = new Date().toISOString();
  const attuale = stato(user); // riletto: nel frattempo l'utente potrebbe aver caricato una foto
  if (!forza && attuale.origine === 'manual') return 'saltata';
  if (g.esito === 'nessuna') {
    if (forza) { salvaStato(user, { ...attuale, sincronizzato: ora }); return 'nessuna'; } // resta com'era
    togliFile(user);
    salvaStato(user, { ...attuale, origine: 'none', sincronizzato: ora, modificato: attuale.origine === 'none' ? attuale.modificato : ora });
    return 'nessuna';
  }
  scrivi(file(user, '.webp'), g.webp);
  salvaStato(user, { origine: 'm365', sincronizzato: ora, modificato: ora });
  return 'ok';
}

// Al login: mai bloccante, mai errori visibili
function sincronizzaAlLogin(user, token) {
  if (!token) return;
  module.exports.sincronizza(user, token).catch(() => { /* ignorato: si riprova al prossimo accesso */ });
}

function leggi(user) {
  try { return fs.readFileSync(file(user, '.webp')); } catch { return null; }
}

function info(user) {
  const s = stato(user);
  const c = leggi(user) !== null;
  return { origine: c ? s.origine : 'none', sincronizzato: s.sincronizzato, v: c && s.modificato ? Date.parse(s.modificato) : null };
}

module.exports = { opzioni, stato, info, leggi, elabora, salvaManuale, rimuovi, sincronizza, sincronizzaAlLogin, scaricaGraph, ErroreFoto };
