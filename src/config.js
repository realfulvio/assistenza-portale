// Lettura della configurazione: variabili d'ambiente (.env) + config/ente.json + config/categorie.json
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
try { process.loadEnvFile(path.join(root, '.env')); } catch { /* nessun .env: si usano le variabili di sistema */ }

const e = process.env;
const num = (v, d) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const intOpz = (v) => (v !== undefined && v !== '' && Number.isInteger(Number(v)) ? Number(v) : null);

// Legge un file JSON di configurazione: prima la versione locale, altrimenti l'esempio
function leggiJson(nome) {
  const locale = path.join(root, 'config', nome + '.json');
  const esempio = path.join(root, 'config', nome + '.example.json');
  const file = fs.existsSync(locale) ? locale : esempio;
  return { dati: JSON.parse(fs.readFileSync(file, 'utf8')), file };
}

const demo = e.DEMO === '1';
const base = '/' + (e.BASE_PATH ?? '/assistenza').replace(/^\/+|\/+$/g, '');
const ente = leggiJson('ente');
const categorie = leggiJson('categorie');

const config = {
  root,
  demo,
  prod: e.NODE_ENV === 'production' && !demo,
  port: num(e.PORT, 3000),
  host: e.HOST || '127.0.0.1',
  base: base === '/' ? '' : base,
  publicUrl: (e.PUBLIC_URL || '').replace(/\/+$/, ''),
  sessionSecret: e.SESSION_SECRET || '',
  sessionHours: num(e.SESSION_HOURS, 8),
  hsts: e.HSTS === '1',
  // nome del parametro dell'indirizzo con il nome del PC (es. ...?pc=NOMEPC); vuoto = funzione disattivata
  pcParam: e.PC_PARAM ?? 'pc',

  // Accesso: OpenID Connect generico (es. Microsoft Entra ID)
  oidc: {
    issuer: (e.OIDC_ISSUER || '').replace(/\/+$/, ''),
    clientId: e.OIDC_CLIENT_ID || '',
    clientSecret: e.OIDC_CLIENT_SECRET || '',
    redirectUri: e.OIDC_REDIRECT_URI || '',
    scope: e.OIDC_SCOPE || 'openid profile email',
    // Facoltativi: solo utenti di questo tenant Entra (claim "tid") e/o di questo gruppo (claim "groups")
    allowedTenant: e.OIDC_ALLOWED_TENANT || '',
    allowedGroup: e.OIDC_ALLOWED_GROUP || '',
    // Facoltativo: dominio email ammesso (es. "esempio.it")
    allowedDomain: (e.OIDC_ALLOWED_EMAIL_DOMAIN || '').toLowerCase()
  },

  // Voce «Admin panel»: visibile solo agli amministratori elencati (email, separate da virgola) e solo se c'e' l'indirizzo
  admin: {
    emails: (e.ADMIN_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
    url: /^https:\/\//i.test(e.ADMIN_PANEL_URL || '') ? e.ADMIN_PANEL_URL.trim() : ''
  },

  glpi: {
    url: (e.GLPI_URL || '').replace(/\/+$/, ''),
    appToken: e.GLPI_APP_TOKEN || '',
    userToken: e.GLPI_USER_TOKEN || '',
    // Facoltativi: id numerici in GLPI. Vuoti = comportamento predefinito
    entityId: intOpz(e.GLPI_ENTITY_ID),            // entita' dei ticket e dei nuovi utenti
    groupId: intOpz(e.GLPI_GROUP_ID),              // gruppo tecnico assegnato ai nuovi ticket (in alternativa a una regola GLPI)
    selfServiceProfileId: intOpz(e.GLPI_SELF_SERVICE_PROFILE_ID), // profilo dei nuovi utenti (default: cercato per nome "Self-Service")
    formatoEmail: e.GLPI_FORMATO_EMAIL || '',     // come ricavare nome/cognome dei nuovi utenti dall'email
    timeoutMs: num(e.GLPI_TIMEOUT_MS, 15000)
  },

  limits: {
    maxFiles: num(e.MAX_FILES, 5),
    maxFileBytes: num(e.MAX_FILE_MB, 10) * 1024 * 1024,
    maxTicketsPerHour: num(e.MAX_TICKETS_PER_HOUR, 10)
  },

  ente: ente.dati,
  enteFile: ente.file,
  categorie: categorie.dati,
  // Assistente locale: dati dell'istanza separati dagli esempi pubblici.
  assistenteEsempi: e.ASSISTENTE_ESEMPI === '1',
  assistenteRisposteGuidate: e.ASSISTENTE_RISPOSTE_GUIDATE !== '0',
  assistenteKeepAlive: e.ASSISTENTE_KEEP_ALIVE === '0' ? 0 : (e.ASSISTENTE_KEEP_ALIVE || '15m'),
  assistenteAiUrl: e.ASSISTENTE_AI_URL || 'http://127.0.0.1:11435',
  assistenteModello: e.ASSISTENTE_MODELLO || 'qwen3.5:4b-q4_K_M',
  assistenteEmbedding: e.ASSISTENTE_EMBEDDING || 'embeddinggemma-2:270m',
  faqPath: path.join(root, 'content', 'faq.json'),
  // Numeri interni dell'ente: file locale non versionato (se manca la sezione non compare; in DEMO si usa l'esempio)
  numeriInterniPath: e.NUMERI_INTERNI_FILE || path.join(root, 'content', 'numeri-interni.json'),
  numeriInterniEsempio: path.join(root, 'content', 'numeri-interni.example.json')
};

// Controlli di avvio: in produzione i segreti devono esserci
if (config.prod) {
  const mancanti = [];
  if (config.sessionSecret.length < 24) mancanti.push('SESSION_SECRET (almeno 24 caratteri)');
  for (const [k, v] of Object.entries({ OIDC_ISSUER: config.oidc.issuer, OIDC_CLIENT_ID: config.oidc.clientId, OIDC_CLIENT_SECRET: config.oidc.clientSecret, OIDC_REDIRECT_URI: config.oidc.redirectUri })) if (!v) mancanti.push(k);
  for (const [k, v] of Object.entries({ GLPI_URL: config.glpi.url, GLPI_APP_TOKEN: config.glpi.appToken, GLPI_USER_TOKEN: config.glpi.userToken })) if (!v) mancanti.push(k);
  if (mancanti.length) { console.error('Configurazione incompleta:', mancanti.join(', ')); process.exit(1); }
}
if (!config.sessionSecret) config.sessionSecret = crypto.randomBytes(32).toString('hex'); // solo sviluppo/demo
module.exports = config;
