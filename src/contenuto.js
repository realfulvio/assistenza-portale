// Composizione del contenuto (HTML) del ticket GLPI e dati tecnici del client.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Nome del PC passato dall'icona sul desktop (?pc=NOME): solo lettere, numeri e trattini, max 30 caratteri
function pcValido(v) {
  const s = String(v ?? '').trim();
  return /^[A-Za-z0-9-]{1,30}$/.test(s) ? s : null;
}

// IP del client: req.ip con "trust proxy" = 1 prende l'indirizzo aggiunto da Apache in X-Forwarded-For
// (eventuali valori inviati dal browser restano a sinistra e vengono ignorati)
function ipPulito(ip) {
  const s = String(ip || '').replace(/^::ffff:/, '');
  return /^[0-9a-fA-F:.]{2,45}$/.test(s) ? s : '';
}

// Browser e sistema operativo in forma breve dallo user-agent, es. "Edge 141 su Windows 10/11"
function browserBreve(ua) {
  const u = String(ua || '');
  const ver = (re) => (u.match(re) || [])[1] || '';
  let b = '';
  if (/Edg\//.test(u)) b = 'Edge ' + ver(/Edg\/(\d+)/);
  else if (/OPR\//.test(u)) b = 'Opera ' + ver(/OPR\/(\d+)/);
  else if (/Firefox\//.test(u)) b = 'Firefox ' + ver(/Firefox\/(\d+)/);
  else if (/Chrome\//.test(u)) b = 'Chrome ' + ver(/Chrome\/(\d+)/);
  else if (/Safari\//.test(u) && /Version\//.test(u)) b = 'Safari ' + ver(/Version\/(\d+)/);
  let os = '';
  if (/Windows NT 10\.0/.test(u)) os = 'Windows 10/11';
  else if (/Windows NT 6\.1/.test(u)) os = 'Windows 7';
  else if (/Windows/.test(u)) os = 'Windows';
  else if (/iPhone|iPad/.test(u)) os = 'iOS';
  else if (/Android/.test(u)) os = 'Android';
  else if (/Mac OS X/.test(u)) os = 'macOS';
  else if (/Linux/.test(u)) os = 'Linux';
  const r = [b, os].filter(Boolean).join(' su ');
  return r || 'sconosciuto';
}

// Contenuto del ticket: (se scelto) il problema rapido come prima riga, la descrizione, poi telefono e reperibilita', poi PC, IP e browser
function contenutoTicket({ sottotipo, descrizione, telefono, reperibilita, pc, ip, ua }) {
  const contatti = [telefono && `Telefono: ${esc(telefono)}`, reperibilita && `Reperibilità: ${esc(reperibilita)}`].filter(Boolean).join(' · ');
  const tecnici = [pc && `PC: ${esc(pc)}`, ip && `IP: ${esc(ip)}`, `Browser: ${esc(browserBreve(ua))}`].filter(Boolean).join(' · ');
  return (sottotipo ? `<p><b>Problema: ${esc(sottotipo)}</b></p>` : '') + `<p>${esc(descrizione).replace(/\n/g, '<br>')}</p>` + (contatti ? `<p>${contatti}</p>` : '') + `<p>${tecnici}</p>`;
}

module.exports = { esc, pcValido, ipPulito, browserBreve, contenutoTicket };
