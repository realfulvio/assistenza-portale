// Accesso con OpenID Connect (Authorization Code Flow + PKCE). Esempio principale: Microsoft Entra ID.
// In modalita' DEMO l'accesso e' simulato con un utente finto.
const express = require('express');
const config = require('./config');
const avatar = require('./avatar');

const router = express.Router();
let clientPromise = null;

// Il client OIDC viene creato alla prima richiesta (discovery dell'issuer)
function client() {
  if (!clientPromise) {
    const { Issuer } = require('openid-client');
    clientPromise = Issuer.discover(config.oidc.issuer).then((issuer) => new issuer.Client({
      client_id: config.oidc.clientId,
      client_secret: config.oidc.clientSecret,
      redirect_uris: [config.oidc.redirectUri],
      response_types: ['code']
    })).catch((err) => { clientPromise = null; throw err; });
  }
  return clientPromise;
}

const UTENTE_DEMO = { oid: 'demo', name: 'Maria Bianchi', email: 'maria.bianchi@esempio.it' };

router.get('/login', async (req, res, next) => {
  try {
    if (config.demo) {
      req.session.user = { ...UTENTE_DEMO };
      return req.session.save(() => res.redirect(config.base + '/'));
    }
    const { generators } = require('openid-client');
    const verifier = generators.codeVerifier();
    const state = generators.state();
    const nonce = generators.nonce();
    req.session.oauth = { verifier, state, nonce };
    const url = (await client()).authorizationUrl({
      scope: config.oidc.scope, state, nonce,
      code_challenge: generators.codeChallenge(verifier), code_challenge_method: 'S256'
    });
    req.session.save(() => res.redirect(url));
  } catch (e) { next(e); }
});

router.get('/callback', async (req, res, next) => {
  try {
    const o = req.session.oauth;
    delete req.session.oauth;
    if (!o || !req.query.state || req.query.state !== o.state || !req.query.code) return res.redirect(config.base + '/errore?c=accesso');
    const c = await client();
    const tokenSet = await c.callback(config.oidc.redirectUri, c.callbackParams(req), { code_verifier: o.verifier, state: o.state, nonce: o.nonce });
    const cl = tokenSet.claims();
    // Controlli di accesso facoltativi
    if (config.oidc.allowedTenant && cl.tid !== config.oidc.allowedTenant) return res.redirect(config.base + '/non-consentito');
    if (config.oidc.allowedGroup && !(cl.groups || []).includes(config.oidc.allowedGroup)) return res.redirect(config.base + '/non-consentito');
    const email = String(cl.email || cl.preferred_username || cl.upn || '').toLowerCase();
    if (!email.includes('@')) return res.redirect(config.base + '/non-consentito');
    if (config.oidc.allowedDomain && !email.endsWith('@' + config.oidc.allowedDomain)) return res.redirect(config.base + '/non-consentito');
    // Nuovo ID di sessione dopo il login (contro la session fixation)
    const pc = req.session.pc; // nome del PC (?pc=) da conservare dopo il login
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = { oid: cl.oid || cl.sub, tenant: cl.tid || '', name: cl.name || email, email };
      if (pc) req.session.pc = pc;
      req.session.idToken = tokenSet.id_token;
      // Foto profilo da Microsoft 365: solo con Entra ID e scope User.Read (OIDC_SCOPE). Il token resta nella sessione lato server
      if (tokenSet.access_token && /^https:\/\/login\.microsoftonline\.com\//.test(config.oidc.issuer)) {
        req.session.graph = { token: tokenSet.access_token, scade: tokenSet.expires_at ? tokenSet.expires_at * 1000 : Date.now() + 50 * 60_000 };
        avatar.sincronizzaAlLogin(req.session.user, tokenSet.access_token); // in background: non rallenta ne' blocca il login
      }
      req.session.save(() => res.redirect(config.base + '/'));
    });
  } catch (e) { next(e); }
});

router.post('/logout', async (req, res) => {
  const idToken = req.session.idToken;
  const dopo = (config.publicUrl || '') + config.base + '/';
  let fine = config.base + '/';
  if (!config.demo && config.oidc.issuer) {
    try {
      const c = await client();
      if (c.issuer.metadata.end_session_endpoint) fine = c.endSessionUrl({ id_token_hint: idToken, post_logout_redirect_uri: dopo });
    } catch { /* se l'issuer non risponde si esce solo dal portale */ }
  }
  req.session.destroy(() => {
    res.clearCookie('portale.sid', { path: config.base || '/' });
    res.json({ redirect: fine });
  });
});

module.exports = router;
