// Archivio locale al server, indipendente dalle sessioni e da GLPI.
// File separati per identita', scrittura atomica, nessun identificativo nel nome.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const model = require('../public/appearance-model');
const config = require('./config');
const directory = process.env.PREFERENCES_DIR || path.join(config.root, 'data', config.demo ? 'preferences-demo' : 'preferences');
function key(user) {
  if (!user?.oid) throw new Error('Identità mancante.');
  return crypto.createHash('sha256').update(JSON.stringify([config.demo ? 'demo' : config.oidc.issuer, user.tenant || '', user.oid])).digest('hex');
}
function read(user) {
  try { return { preferences: model.validate(JSON.parse(fs.readFileSync(path.join(directory, key(user) + '.json'), 'utf8'))), available: true }; }
  catch (e) {
    if (e.code === 'ENOENT') {
      try { if (fs.existsSync(directory) && !fs.statSync(directory).isDirectory()) return { preferences: model.defaults(), available: false }; }
      catch { return { preferences: model.defaults(), available: false }; }
      return { preferences: model.defaults(), available: true };
    }
    return { preferences: model.defaults(), available: false };
  }
}
function write(user, value) {
  const preferences = model.validate(value);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, key(user) + '.json');
  const temporary = file + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
  try {
    fs.writeFileSync(temporary, JSON.stringify(preferences) + '\n', { mode: 0o600, flag: 'wx', flush: true });
    fs.renameSync(temporary, file);
  } finally { try { fs.unlinkSync(temporary); } catch { /* gia' rinominato */ } }
  return preferences;
}
module.exports = { key, read, write };
