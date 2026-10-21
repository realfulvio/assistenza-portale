// Validazione allegati: estensione + contenuto reale (magic bytes), limiti di numero e dimensione
const path = require('path');
const multer = require('multer');
const config = require('./config');

const ESTENSIONI = ['png', 'jpg', 'jpeg', 'pdf', 'docx', 'xlsx', 'txt', 'zip', 'msg', 'eml'];
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // .msg
const inizia = (b, sig) => b.length >= sig.length && sig.every((x, i) => b[i] === x);

const FIRME = {
  png: (b) => inizia(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpg: (b) => inizia(b, [0xff, 0xd8, 0xff]),
  pdf: (b) => b.subarray(0, 1024).includes('%PDF-'),
  zip: (b) => inizia(b, [0x50, 0x4b, 0x03, 0x04]),
  msg: (b) => b.length >= 8 && b.subarray(0, 8).equals(OLE),
  // testo: nessun byte NUL nei primi KB
  txt: (b) => !b.subarray(0, 4096).includes(0),
  eml: (b) => !b.subarray(0, 4096).includes(0)
};
FIRME.jpeg = FIRME.jpg;
FIRME.docx = FIRME.zip;
FIRME.xlsx = FIRME.zip;

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf', txt: 'text/plain', zip: 'application/zip', msg: 'application/vnd.ms-outlook', eml: 'message/rfc822',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: config.limits.maxFiles, fileSize: config.limits.maxFileBytes, fields: 12 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    if (!ESTENSIONI.includes(ext)) return cb(Object.assign(new Error(`Tipo di file non consentito: ${file.originalname}`), { utente: true }));
    cb(null, true);
  }
});

// Dopo l'upload: controlla il contenuto reale e normalizza nome/MIME
function verificaFile(files) {
  for (const f of files) {
    const ext = path.extname(f.originalname).slice(1).toLowerCase();
    if (!f.buffer.length || !FIRME[ext](f.buffer)) {
      throw Object.assign(new Error(`Il contenuto di «${f.originalname}» non corrisponde al tipo di file.`), { utente: true });
    }
    f.originalname = path.basename(f.originalname).replace(/[^\w.\- ()àèéìòù]/gi, '_').slice(0, 120);
    f.mimetype = MIME[ext];
  }
}

module.exports = { upload, verificaFile, ESTENSIONI };
