// Riepilogo A4 di una richiesta in PDF (pdfkit, nessun browser): stesso contenuto della pagina, solo dati pubblici.
// Impaginazione del riferimento grafico: intestazione, titolo e stato, linea del tempo, 6 tessere, richiesta,
// cronologia (continua sulle pagine successive con intestazione ripetuta) e piè di pagina «n / N».
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const config = require('./config');
const { elencoNomi } = require('./ticket-dettaglio');

const ENTE = config.ente || {}; // in alcune installazioni i testi dell'ente non sono in config
const F = path.join(__dirname, 'fonti'); // WOFF di Titillium Web (SIL OFL, vedi public/fonts): i lettori PDF incorporano meglio il WOFF del WOFF2
const C = { blu: '#0a5c8f', scuro: '#0b2a55', oro: '#e6b93c', testo: '#1a2b3c', grigio: '#6a7b8d', grigio2: '#44566a', riga: '#e3e8ee', box: '#f0f7fc', boxBordo: '#cfe3f3', tondo: '#e3eff8', pill: '#e8edf3' };
const I = {
  ticket: 'M4 9V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6z',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5', userCheck: 'M9 4.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6 M16 11l2 2 4-4',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  lock: 'M7 11h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z M8 11V8a4 4 0 0 1 8 0v3',
  thumb: 'M7 11v9H4v-9h3z M7 11l4-7c1.5 0 2.5 1 2.2 2.5L12.7 9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7',
  wrench: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6z',
  user: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M4 21c0-4 3.6-7 8-7s8 3 8 7', clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 7v5l3 2',
  cal: 'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM4 10h16M8 4v4M16 4v4',
  chat: 'M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z', list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  sys: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M8 12.5l3 3 5-6', x: 'M6 6l12 12M18 6L6 18', tool: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6z'
};
const AZIONI = {
  apertura: ['Aperta', I.flag], presa: ['In carico', I.userCheck], messaggio: ['Messaggio', I.chat], attivita: ['Attività', I.tool],
  soluzione: ['Soluzione', I.bulb], approvazione: ['Approvata', I.thumb], rifiuto: ['Non approvata', I.x], chiusura: ['Chiusa', I.lock]
};
const TAPPE = { aperta: ['Aperta', I.flag], carico: ['In carico', I.userCheck], soluzione: ['Soluzione', I.bulb], chiusa: ['Chiusa', I.lock] };

const px = (v) => v * 0.75; // misure del riferimento (px a 96 dpi) -> punti PDF
const parse = (s) => (s ? new Date(String(s).replace(' ', 'T')) : null);
const due = (n) => String(n).padStart(2, '0');
const hhmm = (s) => { const d = parse(s); return d ? `${due(d.getHours())}:${due(d.getMinutes())}` : ''; };
const gg = (s) => { const d = parse(s); return d ? `${due(d.getDate())}/${due(d.getMonth() + 1)}/${d.getFullYear()}` : ''; };

function slug(s) {
  return String(s || 'richiesta').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'richiesta';
}
const nomeFile = (d) => `richiesta-${d.id}-${slug(d.titolo)}.pdf`;

function icona(doc, d, x, y, size, colore, spessore = 2) {
  doc.save().translate(x, y).scale(size / 24).path(d).lineWidth(spessore).lineCap('round').lineJoin('round').stroke(colore).restore();
}

/**
 * @returns Promise<Buffer>
 * @param d dettaglio composto (ticket-dettaglio.componi) ; @param chi nome di chi genera il documento
 */
function genera(d, chi) {
  return new Promise((ok, ko) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: px(44), bottom: px(36), left: px(52), right: px(52) }, bufferPages: true,
      info: { Title: `Richiesta #${d.id} – ${d.titolo}`, Author: (ENTE.servizio && ENTE.servizio.nome) || 'Assistenza Informatica', Creator: 'Portale Assistenza' } });
    const parti = [];
    doc.on('data', (b) => parti.push(b)); doc.on('end', () => ok(Buffer.concat(parti))); doc.on('error', ko);
    doc.registerFont('R', path.join(F, 'titillium-web-latin-400-normal.woff'));
    doc.registerFont('S', path.join(F, 'titillium-web-latin-600-normal.woff'));
    doc.registerFont('B', path.join(F, 'titillium-web-latin-700-normal.woff'));
    const L = doc.page.margins.left, W = doc.page.width - L - doc.page.margins.right;
    const fondo = () => doc.page.height - doc.page.margins.bottom - px(28); // spazio per il piè di pagina
    const nome = (id) => (id && d.persone[id] ? d.persone[id].nome : 'Sistema');

    // --- intestazione
    let y = doc.page.margins.top;
    const logo = ENTE.grafica && ENTE.grafica.logo ? path.join(config.root, 'public', ENTE.grafica.logo) : '';
    if (/\.(png|jpe?g)$/i.test(logo) && fs.existsSync(logo)) {
      doc.save().circle(L + px(26), y + px(26), px(26)).clip().image(logo, L, y, { width: px(52), height: px(52) }).restore();
    } else {
      doc.circle(L + px(26), y + px(26), px(26)).fill(C.blu);
      icona(doc, I.chat, L + px(14), y + px(14), px(24), '#ffffff', 2);
    }
    const servizio = (ENTE.servizio && ENTE.servizio.nome) || 'Assistenza Informatica';
    doc.font('B').fontSize(px(20)).fillColor(C.scuro).text(servizio, L + px(66), y + px(12), { width: W - px(200), lineBreak: false });
    const num = String(d.id);
    doc.font('B').fontSize(px(28));
    const wn = doc.widthOfString(num);
    icona(doc, I.ticket, L + W - wn - px(34), y + px(13), px(26), C.blu, 2);
    doc.fillColor(C.blu).text(num, L + W - wn, y + px(8), { lineBreak: false });
    y += px(52 + 16);
    doc.rect(L, y, W, px(3)).fill(C.oro);
    y += px(3 + 26);

    // --- titolo, stato, richiedente
    doc.font('B').fontSize(px(28)).fillColor(C.scuro).text(d.titolo, L, y, { width: W });
    y = doc.y + px(10);
    doc.font('B').fontSize(px(13));
    const st = d.stato, ws = doc.widthOfString(st) + px(12 + 9 + 19);
    doc.roundedRect(L, y, ws, px(24), px(12)).fill(C.pill);
    icona(doc, d.statoN === 6 ? I.lock : I.clock, L + px(9), y + px(4.5), px(15), C.testo, 2.2);
    doc.fillColor(C.testo).text(st, L + px(9 + 19), y + px(4), { lineBreak: false });
    const rich = Object.values(d.persone).find((p) => p.ruolo === 'tu');
    if (rich) {
      icona(doc, I.user, L + ws + px(16), y + px(4), px(16), C.grigio, 2);
      doc.font('R').fontSize(px(14)).fillColor(C.grigio2).text(rich.nome, L + ws + px(16 + 22), y + px(3), { lineBreak: false });
    }
    y += px(24 + 26 + 6);

    // --- linea del tempo a 4 tappe
    const cw = W / 4;
    d.tappe.forEach((t, k) => {
      const x = L + k * cw, ultima = k === d.tappe.length - 1 || (t.fatta && !(d.tappe[k + 1] || {}).fatta);
      if (k < 3) doc.roundedRect(x + px(44), y + px(15), cw - px(52), px(3), px(1.5)).fill(t.fatta && d.tappe[k + 1].fatta ? C.blu : C.riga);
      const fondoC = !t.fatta ? C.riga : ultima && t.id === 'chiusa' ? C.oro : C.blu;
      doc.circle(x + px(16.5), y + px(16.5), px(16.5)).fill(fondoC);
      icona(doc, TAPPE[t.id][1], x + px(8), y + px(8), px(17), !t.fatta ? C.grigio : fondoC === C.oro ? C.scuro : '#ffffff', 2.2);
      doc.font('B').fontSize(px(13.5)).fillColor(t.fatta ? C.scuro : C.grigio).text(TAPPE[t.id][0], x, y + px(33 + 6), { width: cw - px(8), lineBreak: false });
      doc.font('R').fontSize(px(12)).fillColor(C.grigio).text(t.fatta ? hhmm(t.data) : '—', x, doc.y + px(2), { width: cw - px(8), lineBreak: false });
    });
    y += px(33 + 6 + 20 + 20 + 26);

    // --- 6 tessere
    const tess = [
      [I.clock, d.durata || 'In corso', 'Durata'], [I.userCheck, d.inCaricoDopo || '—', 'In carico dopo'],
      [I.wrench, elencoNomi(d.gestitaDa.map(nome)) || 'In attesa', 'Gestita da'], [I.cal, gg(d.aperta), 'Data'],
      [I.chat, String(d.aggiornamenti), 'Aggiornamenti'], [I.lock, d.statoN === 6 ? hhmm(d.chiusaIl) : 'In corso', 'Chiusa alle']
    ];
    const bh = px(20 + 38 + 20 + 38 + 20);
    doc.roundedRect(L, y, W, bh, px(10)).fillAndStroke(C.box, C.boxBordo);
    const tw = (W - px(44) - px(36)) / 3;
    tess.forEach(([ic, val, et], k) => {
      const cx = L + px(22) + (k % 3) * (tw + px(18)), cy = y + px(20) + Math.floor(k / 3) * px(58);
      doc.circle(cx + px(19), cy + px(19), px(19)).fill(C.tondo);
      icona(doc, ic, cx + px(9.5), cy + px(9.5), px(19), C.blu, 2);
      let fs = px(15);
      doc.font('B').fontSize(fs);
      while (doc.widthOfString(val) > tw - px(52) && fs > px(9)) { fs -= 0.5; doc.fontSize(fs); }
      doc.fillColor(C.scuro).text(val, cx + px(50), cy + px(3), { width: tw - px(50), lineBreak: false, ellipsis: true });
      doc.font('S').fontSize(px(10.5)).fillColor(C.grigio).text(et.toUpperCase(), cx + px(50), cy + px(22), { width: tw - px(50), characterSpacing: 0.6, lineBreak: false });
    });
    y += bh + px(26);

    // --- richiesta
    const sezione = (ic, titolo) => {
      icona(doc, ic, L, y, px(16), C.blu, 2);
      doc.font('B').fontSize(px(12)).fillColor(C.grigio2).text(titolo.toUpperCase(), L + px(24), y + px(1), { characterSpacing: 1, lineBreak: false });
      y += px(16 + 8);
    };
    sezione(I.chat, 'Richiesta');
    doc.font('R').fontSize(px(15)).fillColor(C.testo).text(d.descrizione || '—', L, y, { width: W, lineGap: 2 });
    y = doc.y + px(22);

    // --- cronologia (tabella che continua sulle pagine successive)
    const col = [px(70), px(190)], xA = L + col[0], xB = L + col[0] + col[1], wC = W - col[0] - col[1];
    const intestazione = () => {
      sezione(I.list, 'Cronologia');
      doc.font('S').fontSize(px(11)).fillColor(C.grigio);
      doc.text('ORA', L, y, { lineBreak: false }); doc.text('CHI', xA + px(8), y, { lineBreak: false }); doc.text('AZIONE', xB + px(8), y, { lineBreak: false });
      y += px(18); doc.rect(L, y, W, 0.6).fill(C.riga); y += px(4);
    };
    if (y > fondo() - px(80)) { doc.addPage(); y = doc.page.margins.top; }
    intestazione();
    const multiGiorno = new Set(d.eventi.map((e) => gg(e.data))).size > 1;
    for (const e of d.eventi) {
      const [azione, ic] = AZIONI[e.tipo];
      const testo = e.testo && e.tipo !== 'presa' && e.tipo !== 'chiusura' ? e.testo : '';
      doc.font('R').fontSize(px(13.5));
      const hTesto = testo ? doc.heightOfString(testo, { width: wC - px(8), lineGap: 1 }) : 0;
      const h = px(11 + 20 + 11) + hTesto;
      if (y + h > fondo()) { doc.addPage(); y = doc.page.margins.top; intestazione(); }
      const ruolo = e.chi ? d.persone[e.chi].ruolo : 'sistema';
      doc.font('S').fontSize(px(13.5)).fillColor(C.grigio2).text(multiGiorno ? `${gg(e.data).slice(0, 5)} ${hhmm(e.data)}` : hhmm(e.data), L, y + px(11), { width: col[0] - px(4), lineBreak: false });
      doc.circle(xA + px(8 + 11), y + px(11 + 10), px(11)).fill(ruolo === 'tecnico' ? '#f3dc93' : ruolo === 'sistema' ? C.pill : '#cfe3f3');
      icona(doc, ruolo === 'tecnico' ? I.wrench : ruolo === 'sistema' ? I.sys : I.user, xA + px(8 + 5), y + px(11 + 4), px(12), C.scuro, 2.6);
      doc.font('B').fontSize(px(13.5)).fillColor(C.scuro).text(e.chi ? nome(e.chi) : 'Sistema', xA + px(8 + 30), y + px(11), { width: col[1] - px(44), lineBreak: false, ellipsis: true });
      icona(doc, ic, xB + px(8), y + px(13), px(15), C.blu, 2);
      doc.font('B').fontSize(px(13.5)).fillColor(C.blu).text(azione, xB + px(8 + 21), y + px(11), { lineBreak: false });
      if (testo) doc.font('R').fontSize(px(13.5)).fillColor('#33475b').text(testo, xB + px(8), y + px(11 + 20), { width: wC - px(8), lineGap: 1 });
      y += h;
      doc.rect(L, y, W, 0.6).fill(C.riga);
    }

    // --- piè di pagina su ogni pagina: «data e ora · generato da …» e «n / N»
    const adesso = new Date();
    const quando = `${due(adesso.getDate())}/${due(adesso.getMonth() + 1)}/${adesso.getFullYear()} ${due(adesso.getHours())}:${due(adesso.getMinutes())}`;
    const tot = doc.bufferedPageRange().count;
    for (let i = 0; i < tot; i++) {
      doc.switchToPage(i);
      const yf = doc.page.height - doc.page.margins.bottom - px(18);
      const mb = doc.page.margins.bottom; doc.page.margins.bottom = 0; // scrivere nel margine senza creare pagine
      doc.rect(L, yf - px(12), W, 0.6).fill('#dde3ea');
      icona(doc, I.cal, L, yf, px(13), C.grigio, 2);
      doc.font('R').fontSize(px(11.5)).fillColor(C.grigio).text(quando, L + px(18), yf, { lineBreak: false });
      const wq = doc.widthOfString(quando);
      icona(doc, I.user, L + px(18) + wq + px(14), yf, px(13), C.grigio, 2);
      doc.text(`generato da ${chi}`, L + px(18) + wq + px(32), yf, { lineBreak: false });
      const np = `${i + 1} / ${tot}`;
      doc.text(np, L + W - doc.widthOfString(np), yf, { lineBreak: false });
      doc.page.margins.bottom = mb;
    }
    doc.end();
  });
}

module.exports = { genera, nomeFile, slug };
