// Assistente locale: fonti aggiornate del portale, sessione individuale, nessuna scrittura su GLPI.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const conoscenza = require('./assistente-conoscenza');
const triage = require('./assistente-triage');
const esempi = require('./assistente-esempi');
const contesto = require('./assistente-contesto');

const MODELLO_PREDEFINITO = 'qwen3.5:4b-q4_K_M';
const EMBEDDING_PREDEFINITO = 'embeddinggemma-2:270m';
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const STOP = new Set('a al alla alle anche che chi ci come con da dal dalla dei del della di e gli ho il in io la le lo ma mi nel non o per qual quale quali quanto se si sono su sul un una uno vorrei devo posso mio mia dimmi trovare sapere serve numero numeri telefono telefonico contatto contatti ufficio chiamare interno interni quello quella della dell dellufficio favore grazie potresti darmi dai dammi cerco cercando'.split(' '));
const parole = (s) => norm(s).match(/[a-z0-9]+/g)?.filter((p) => p.length > 1 && !STOP.has(p)) || [];
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
const proprietario = (req) => `${req.session.user?.tid || ''}:${req.session.user?.oid || req.session.user?.email || req.sessionID}`;
const testo = (s, n = 1500) => String(s ?? '').replace(/<[^>]*>/g, '').slice(0, n);
const errore = (messaggio, status = 400) => Object.assign(new Error(messaggio), { status });
const coseno = (a, b) => {
  if (a.length !== b.length) throw errore('Indice di ricerca da aggiornare.', 503);
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { ab += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
  return ab / Math.max(1e-12, Math.sqrt(aa * bb));
};

function creaServizio({ config, numeriInterni, glpi, utenteGlpi, chiamaAI, cacheFile, osservaRicerca }) {
  const base = config.base || '';
  const MODELLO = config.assistenteModello || MODELLO_PREDEFINITO;
  const EMBEDDING = config.assistenteEmbedding || EMBEDDING_PREDEFINITO;
  const contenuto = nome => {
    const locale = path.join(__dirname, '..', 'content', nome);
    return fs.existsSync(locale) ? locale : locale.replace(/\.(json|txt)$/, '.example.$1');
  };
  const cachePath = cacheFile || process.env.ASSISTENTE_CACHE_FILE || '/var/lib/portale-assistenza/assistente/indice.json';
  const schedePath = config.assistenteSchedePath || contenuto('assistente-conoscenza.json');
  const istruzioniPath = config.assistenteIstruzioniPath || contenuto('assistente-istruzioni.txt');
  const istruzioni = fs.readFileSync(istruzioniPath, 'utf8').trim();
  const usaEsempi = config.assistenteEsempi === true;
  const usaGuidate = config.assistenteRisposteGuidate !== false;
  const esempiPath = config.assistenteEsempiPath || contenuto('assistente-esempi.json');
  let indice = null, preparazione = null, occupato = false;
  const sessioniOccupate = new Set();
  const ai = chiamaAI || (async (endpoint, body) => {
    const r = await fetch((config.assistenteAiUrl || 'http://127.0.0.1:11435').replace(/\/$/, '') + endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000)
    });
    if (!r.ok) throw errore('L’assistente è momentaneamente occupato. Puoi usare la ricerca nelle guide.', 503);
    return r.json();
  });
  const categorie = () => config.categorie.categorie.map((c) => ({ id: c.id, nome: c.titolo || c.nome }));
  const contatti = () => numeriInterni.carica({ file: config.numeriInterniPath, esempio: config.numeriInterniEsempio, demo: config.demo }).sezioni;
  function documenti() {
    const docs = [];
    const faq = JSON.parse(fs.readFileSync(config.faqPath, 'utf8'));
    for (const g of faq) {
      if (!/^[a-z0-9-]{1,60}$/.test(g.id)) continue;
      const parti = [g.d, g.intro || '', ...(g.controlli || [])];
      for (const p of g.passi || []) parti.push(typeof p === 'string' ? p : `${p.t || ''} ${p.nota || ''}`);
      parti.push(...['ok', 'stop', 'richiesta', 'r'].map((k) => g[k] || ''), ...(g.parole || []));
      docs.push({ id: g.id, tipo: 'guida', titolo: g.d, url: `${base}/#faq/${g.id}`, passi: g.passi || [], controlli: g.controlli || [], stop: g.stop || '', richiesta: g.richiesta || '', testo: parti.join('\n').slice(0, 6500) });
    }
    docs.push(...conoscenza.leggiSchede(schedePath, base, faq));
    const fontiPath = config.assistenteFontiPath || contenuto('assistente-fonti.json');
    if (fs.existsSync(fontiPath)) docs.push(...JSON.parse(fs.readFileSync(fontiPath,'utf8')).fonti.map(f => ({...f,tipo:'riferimento'})));
    if (usaEsempi) docs.push(...esempi.carica(esempiPath));
    docs.push({ id: 'portale', tipo: 'servizio', titolo: 'Portale e servizio di assistenza', url: `${base}/#nuova`,
      testo: `Nel portale puoi leggere le guide, cercare i numeri nei Contatti, aprire una richiesta e consultare Le mie richieste. Le categorie disponibili sono: ${categorie().map((c) => c.nome).join(', ')}. L’assistente aiuta a preparare il testo; il modulo viene compilato e inviato dall’utente. ${JSON.stringify(config.ente?.servizio || {})}` });
    return docs;
  }
  async function embed(input) {
    const r = await ai('/api/embed', { model: EMBEDDING, input, truncate: false, keep_alive: config.assistenteKeepAlive ?? '15m', options: { num_thread: 4, num_ctx: 4096 } });
    if (!Array.isArray(r.embeddings) || r.embeddings.length !== input.length || r.embeddings.some((v) => !Array.isArray(v) || !v.length || v.some((x) => !Number.isFinite(x)))) throw errore('La ricerca dell’assistente non è disponibile.', 503);
    return r.embeddings;
  }
  async function preparaIndice() {
    const docs = documenti(), impronta = hash(JSON.stringify(docs));
    if (indice?.impronta === impronta) return indice;
    if (preparazione) { await preparazione; return preparaIndice(); }
    preparazione = (async () => {
      let vecchio = indice;
      if (!vecchio) { try { vecchio = JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch { /* primo avvio */ } }
      const riuso = new Map((vecchio?.documenti || []).map((d) => [d.id + ':' + d.hash, d.vettore]));
      const nuovi = docs.map((d) => ({ ...d, hash: hash(d.testo), vettore: riuso.get(d.id + ':' + hash(d.testo)) }));
      const mancanti = nuovi.filter((d) => !Array.isArray(d.vettore));
      for (let i = 0; i < mancanti.length; i += 8) {
        const gruppo = mancanti.slice(i, i + 8), vettori = await embed(gruppo.map((d) => d.testo));
        gruppo.forEach((d, n) => { d.vettore = vettori[n]; });
      }
      const nuovo = { impronta, documenti: nuovi };
      fs.mkdirSync(path.dirname(cachePath), { recursive: true, mode: 0o700 });
      const temporaneo = cachePath + '.' + crypto.randomBytes(5).toString('hex') + '.tmp';
      fs.writeFileSync(temporaneo, JSON.stringify(nuovo), { mode: 0o600 });
      fs.renameSync(temporaneo, cachePath);
      indice = nuovo;
      return indice;
    })();
    try { return await preparazione; } finally { preparazione = null; }
  }
  function stato(req) {
    if (!req.session.assistente || req.session.assistente.proprietario !== proprietario(req)) {
      req.session.assistente = { proprietario: proprietario(req), messaggi: [], bozza: null, ultimoTipo: '' };
    }
    return req.session.assistente;
  }
  function risposta(s, domanda, out) {
    s.messaggi.push({ ruolo: 'utente', testo: domanda }, { ruolo: 'assistente', testo: out.risposta });
    s.messaggi = s.messaggi.slice(-12);
    s.ultima = out;
    return out;
  }
  const opzioniCategorie = () => categorie().map((c) => ({ testo: c.nome, azione: 'categoria', categoria: c.id }));
  const domande = {
    problema: 'Descrivi il problema che vuoi segnalare. Userò le tue parole per preparare un testo da copiare.',
    categoria: 'Quale argomento scegli per la richiesta?',
    errore: 'Compare un messaggio di errore? Riportalo come lo vedi, oppure scrivi «nessuno».',
    verifiche: 'Che cosa hai già provato e con quale risultato? Se non hai fatto verifiche, scrivi «nessuna».',
    postazione: 'Quale computer, programma o stampante è interessato? Se non conosci il nome, scrivi «non lo so».'
  };
  function riepilogo(b) {
    return [b.problema, `Messaggio di errore: ${b.errore}`, `Verifiche già effettuate: ${b.verifiche}`, `Postazione o programma: ${b.postazione}`].join('\n\n');
  }
  function procediBozza(s, input, azione, categoria) {
    if (azione === 'ticket') {
      s.bozza = { passo: 'problema' };
      return { risposta: domande.problema, tipo: 'bozza' };
    }
    const b = s.bozza;
    if (azione === 'categoria') {
      if (b?.passo !== 'categoria' || !categorie().some((c) => c.id === categoria)) throw errore('Scegli una delle categorie proposte.');
      b.categoria = categoria; b.passo = 'errore';
    } else if (b.passo === 'categoria') {
      const c = categorie().find((c) => norm(c.nome) === norm(input) || c.id === input);
      if (!c) return { risposta: domande.categoria, tipo: 'bozza', opzioni: opzioniCategorie() };
      b.categoria = c.id; b.passo = 'errore';
    } else {
      const limiti = { problema: 1500, errore: 600, verifiche: 1200, postazione: 160 };
      if (input.length > limiti[b.passo]) throw errore(`Per questa risposta usa al massimo ${limiti[b.passo]} caratteri.`);
      b[b.passo] = input;
      b.passo = ({ problema: 'categoria', errore: 'verifiche', verifiche: 'postazione', postazione: 'pronta' })[b.passo];
    }
    if (b.passo === 'pronta') {
      const c = categorie().find((x) => x.id === b.categoria);
      return { risposta: 'Ecco un testo basato soltanto sulle tue risposte. Controllalo e copialo nella descrizione della richiesta. Il modulo e l’invio restano a te.', tipo: 'bozza',
        bozza: { categoria: c.nome, descrizione: riepilogo(b) }, fonti: [{ titolo: 'Apri una richiesta', url: `${base}/#nuova` }] };
    }
    return { risposta: domande[b.passo], tipo: 'bozza', ...(b.passo === 'categoria' ? { opzioni: opzioniCategorie() } : {}) };
  }
  function cercaContatti(domanda) {
    const q = parole(domanda).filter((p) => !['cerco', 'cerca', 'puoi', 'potrei', 'sapere', 'tutti', 'tutte', 'elenco', 'del', 'dell'].includes(p));
    if (!q.length) return { risposta: 'Di quale persona o ufficio cerchi il numero?', tipo: 'contatti', contatti: [] };
    const voci = contatti().flatMap((sezione) => sezione.voci.map((v) => ({ ...v, sezione: sezione.titolo })));
    const trovati = voci.filter((v) => {
      const t = norm([v.nome, v.sezione, v.nota, v.numero, v.cellulare].filter(Boolean).join(' '));
      return q.every((p) => t.includes(p));
    });
    return { risposta: trovati.length ? `Ho trovato ${trovati.length === 1 ? 'questo contatto' : 'questi contatti'} nell’elenco del portale.` : 'Non trovo una corrispondenza precisa. Prova con il nome della persona o dell’ufficio.',
      tipo: 'contatti', contatti: trovati.slice(0, 12), fonti: [{ titolo: 'Tutti i numeri interni', url: `${base}/#contatti` }] };
  }
  async function cercaRichieste(req, domanda) {
    const userId = await utenteGlpi(req);
    const id = /(?:ticket|richiesta|segnalazione|#)\s*#?\s*(\d{1,9})\b/i.exec(domanda)?.[1];
    if (id) {
      const d = await glpi.dettaglio(userId, Number(id));
      if (!d) return { risposta: 'Questa richiesta non è disponibile tra quelle che puoi consultare.', tipo: 'richieste', richieste: [] };
      const eventi = (d.eventi || []).filter((e) => e.testo).slice(-3).map((e) => ({ tipo: testo(e.tipo, 40), testo: testo(e.testo, 1200), data: e.data }));
      return { risposta: 'Questi sono i dati aggiornati della richiesta visibile nel tuo portale.', tipo: 'richieste',
        richieste: [{ id: Number(id), titolo: testo(d.titolo, 250), stato: testo(d.stato, 100), descrizione: testo(d.descrizione, 1600), eventi, url: `${base}/#richiesta/${id}` }] };
    }
    let righe = await glpi.elencoTicket(userId);
    righe = righe.slice().sort((a, b) => String(b.aperta || '').localeCompare(String(a.aperta || '')));
    if (/ultima|ultimo|recente/i.test(domanda)) righe = righe.slice(0, 1);
    return { risposta: righe.length ? 'Ecco le tue richieste più recenti. Gli stati arrivano dal portale, senza interpretazioni del modello.' : 'Non risultano richieste da mostrare per il tuo utente.',
      tipo: 'richieste', richieste: righe.slice(0, 6).map((r) => ({ id: r.id, titolo: testo(r.titolo, 250), stato: testo(r.stato, 100), url: `${base}/#richiesta/${r.id}` })) };
  }
  async function chat(s, domanda) {
    const storia = triage.storiaPertinente(domanda, s.messaggi);
    const recenti = storia.filter((m) => m.ruolo === 'utente').slice(-2).map((m) => m.testo);
    const specifico = /stamp|toner|ricambio|\bpc\b|computer|posta|mail|outlook|account|password|rete|internet|file|cartell|audio|monitor|programma|aggiorn|gestional|halley|protocol|firma|pdf|vpn|access|word|excel|teams|errore|portale|richiesta|ticket|servizio|firmware|bios|telefon|cornetta|x.?desk|unimoney|sito/i;
    if (!specifico.test(domanda) && !triage.dominio(domanda) && !recenti.some((m) => specifico.test(m))) {
      return { risposta: 'Che cosa non funziona: il computer, un programma, la posta o una stampante? Dimmi anche che cosa vedi a schermo.', tipo: 'chat', fonti: [] };
    }
    if (occupato) throw errore('Sto rispondendo a un’altra domanda. Riprova tra poco: la ricerca nelle guide resta disponibile.', 429);
    occupato = true;
    try {
      const idx = await preparaIndice();
      const guidata = usaGuidate && triage.proceduraGuidata(domanda, storia, idx.documenti);
      if (guidata) {
        const riferimenti = guidata.guide.map(id => idx.documenti.find(d => d.id === id && d.tipo === 'guida')).filter(Boolean);
        osservaRicerca?.({regola: guidata.regola, selezione: 'riferimenti espliciti della procedura, non ranking semantico', selezionati: riferimenti.map(d => ({id: d.id, tipo: d.tipo}))});
        return {risposta: guidata.risposta, tipo: 'chat', fonti: riferimenti.map(d => ({titolo: d.titolo, url: d.url}))};
      }
      const ricerca = [...recenti, domanda].join('\n');
      const [vector] = await embed([ricerca]), q = new Set(parole(ricerca));
      const graduatoria = idx.documenti.map((d) => {
        const p = new Set(parole(d.testo));
        return { d, score: coseno(vector, d.vettore) + .2 * [...q].filter((x) => p.has(x)).length / Math.max(1, q.size) };
      }).sort((a, b) => b.score - a.score);
      const analisi = contesto.analizza(domanda, storia);
      const scelti = contesto.seleziona(graduatoria, analisi);
      const scheda = scelti.find(x => x.d.tipo === 'scheda');
      osservaRicerca?.({selezionati: scelti.map(({d, score}) => ({id: d.id, tipo: d.tipo, score})), primi: graduatoria.slice(0, 5).map(({d, score}) => ({id: d.id, score}))});
      if (!scelti.length && !analisi.tema) return { risposta: 'Non trovo una guida abbastanza pertinente. Puoi descrivere meglio il problema oppure preparare una richiesta con il pulsante qui sotto.', tipo: 'chat', fonti: [] };
      const fonti = scelti.filter(({d}) => d.url).map(({ d }) => ({ titolo: d.titolo, url: d.url }));
      const dettagli = usaGuidate && scheda && conoscenza.raccogliDettagli(scheda.d.id, domanda, storia);
      if (dettagli) {
        osservaRicerca?.({regola: dettagli.regola, selezionati: []});
        return {risposta: dettagli.risposta, tipo: 'chat', fonti};
      }
      const system = istruzioni;
      const sceltiEsempi = usaEsempi ? esempi.seleziona(idx.documenti, ricerca, vector, coseno) : [];
      const formatoDialogo = config.assistenteEsempiFormato === 'dialogo';
      osservaRicerca?.({esempi: sceltiEsempi.map(({d, score}) => ({id: d.id, score})), formato: formatoDialogo ? 'dialogo' : 'testo', guidateAbilitate: usaGuidate});
      const fonte = d => {
        if (analisi.compito && d.tipo === 'scheda') return d.titolo + '\nScheda di raccolta dei sintomi; nessuna soluzione storica documentata.';
        if (d.tipo !== 'guida') return d.testo.split('\n').filter(riga => !riga.startsWith('Domande utili:'))
          .filter(riga => !(analisi.tema === 'allegati' && riga.startsWith('Criteri:'))).join('\n').slice(0,650);
        let passi = d.passi.map(p => typeof p === 'string' ? p : p.t), controlli = d.controlli;
        let richiesta = d.richiesta;
        if (analisi.tema === 'rete-permessi' || analisi.fatti.proceduraMultiente) {passi=[];controlli=[];}
        if (analisi.fatti.proceduraMultiente) richiesta='Dati da raccogliere in questo turno: '+analisi.domande.join('; ')+'.';
        if (analisi.tema === 'posta') {
          controlli=[]; richiesta='';
          passi=analisi.fatti.errore ? passi.filter(p => /prova la posta dal browser/i.test(p)) : [];
        }
        passi=passi.filter(p => !(analisi.tema === 'stampa-offline' && /spegni|riaccend|torna alla finestra/i.test(p)))
          .filter(p => !(analisi.fatti.riavvio && /riavvi|chiudi outlook|riaprilo da start/i.test(p)));
        return [d.titolo,'CONDIZIONI E ARRESTI: '+d.stop+' '+richiesta,
          'CONTROLLI ANCORA APPLICABILI: '+controlli.join(' '),'PASSI ANCORA APPLICABILI: '+passi.join(' ')].join('\n').slice(0,1600);
      };
      const messages = [{ role: 'system', content: system }, ...(formatoDialogo ? esempi.dialoghi(sceltiEsempi) : []),
        { role: 'user', content: `MESSAGGI REALI DELL'UTENTE:\n${analisi.messaggi.join('\n')}\n\nFATTI GIA NOTI (non richiederli):\n${JSON.stringify(analisi.fatti)}\n\nGUIDE CORRENTI E SCHEDE:\n${scelti.map(({ d }) => `[${d.id}] ${fonte(d)}`).join('\n\n') || 'Nessuna procedura documentata per questa domanda.'}\n\n${formatoDialogo ? '' : esempi.contesto(sceltiEsempi, analisi.fatti)}\n\nFATTI ATTUALI CONFERMATI (prevalgono sulle domande degli esempi): ${JSON.stringify(analisi.fatti)}\n\nVINCOLI DEL CASO ATTUALE:\n${analisi.regole.join('\n')}\nDETTAGLI ANCORA CHIEDIBILI: ${analisi.domande.join('; ') || 'Non aggiungere domande generiche; indica il prossimo passo documentato o la segnalazione al CED.'}\n\nDOMANDA ATTUALE:\n${domanda}\n\nScrivi direttamente all’utente la risposta, non istruzioni per un altro operatore.` }];
      if (analisi.compito) messages.push({role:'user',content:`FASE ATTUALE: ${analisi.fase}\nCOMPITO: ${analisi.compito}\nDETTAGLI MANCANTI: ${analisi.domande.join('; ') || 'nessuno'}\n${analisi.tema === 'posta' && analisi.fase === 'chiarimento' ? 'Scrivi soltanto le domande mancanti. Termina con il punto interrogativo, senza proporre controlli o passi successivi.' : 'Rispondi in al massimo due frasi dirette.'} Usa solo i messaggi reali per i fatti attuali.`});
      for (let tentativo = 0; tentativo < 2; tentativo++) {
        const r = await ai('/api/chat', { model: MODELLO, messages, stream: false, think: false, keep_alive: config.assistenteKeepAlive ?? '15m', options: { temperature: .1, num_ctx: 4096, num_predict: 240, num_thread: 4 } });
        const raw = String(r.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').split('<think>')[0].replace(/\[[a-z0-9-]+\]/g, '').trim();
        if (!raw) throw errore('Non riesco a formulare una risposta. Usa la guida indicata oppure riprova.', 503);
        const violazioni = contesto.verifica(raw, analisi);
        osservaRicerca?.({generazione: tentativo + 1, testoGenerato: raw, violazioni, fatti: analisi.fatti, tema: analisi.tema});
        if (!violazioni.length) return {risposta: raw.slice(0, 1800), tipo: 'chat', fonti};
        messages.push({role: 'assistant', content: raw}, {role: 'user', content: 'Correggi la risposta rispettando i fatti e le guide gia forniti. Errori: ' + violazioni.join(' ') + ' Non commentare la correzione: scrivi soltanto la nuova risposta.'});
      }
      osservaRicerca?.({regola: 'generazione-non-conforme', selezionati: []});
      return {risposta: 'Non riesco a formulare una risposta coerente con le informazioni fornite. Usa «Aiutami a descrivere il problema» per preparare una richiesta al CED.', tipo: 'chat', fonti};
    } finally { occupato = false; }
  }
  async function gestisci(req) {
    if (sessioniOccupate.has(req.sessionID)) throw errore('Attendi la risposta precedente.', 429);
    sessioniOccupate.add(req.sessionID);
    try {
      const body = req.body || {}, azione = body.azione || 'messaggio';
      if (!['messaggio', 'nuova', 'ticket', 'categoria'].includes(azione)) throw errore('Azione non valida.');
      if (typeof body.testo !== 'undefined' && typeof body.testo !== 'string') throw errore('Scrivi un messaggio di testo.');
      const domanda = (body.testo || '').trim();
      if (domanda.length > 1500 || (azione === 'messaggio' && domanda.length < 2)) throw errore('Scrivi un messaggio tra 2 e 1500 caratteri.');
      let s = stato(req);
      if (azione === 'nuova') { req.session.assistente = null; s = stato(req); return { risposta: 'Nuova conversazione. Come posso aiutarti?', tipo: 'chat' }; }
      let out;
      let controllata = azione === 'messaggio' ? conoscenza.rispostaControllata(domanda, triage.storiaPertinente(domanda, s.messaggi), base) : null;
      if (!usaGuidate && controllata && !['firmware-in-corso', 'richiesta-segreti', 'non-inviare-password', 'non-disattivare-protezioni', 'intervento-non-documentato'].includes(controllata.regola)) controllata = null;
      if (controllata) {
        osservaRicerca?.({regola: controllata.regola, selezionati: []});
        out = {tipo: 'chat', risposta: controllata.risposta, fonti: controllata.fonti};
      }
      else if (azione === 'ticket' || azione === 'categoria' || (s.bozza && s.bozza.passo !== 'pronta')) out = procediBozza(s, domanda, azione, body.categoria);
      else if (/(prepara|compila|apri|crea|scrivi|segnalare).{0,45}(ticket|richiesta|segnalazione)/i.test(domanda)) out = procediBozza(s, domanda, 'ticket');
      else if (/(?:stato|numero|ultima|ultimo|ultime|ultimi|mie|miei).{0,35}(?:ticket|richiest|segnalaz)|(?:ticket|richiest|segnalaz).{0,35}(?:stato|numero|risolt|chius|tecnico)|(?:ticket|richiesta|segnalazione)\s*#?\d|#\d{1,9}\b/i.test(domanda)) out = await cercaRichieste(req, domanda);
      else if (conoscenza.cercaNumero(domanda) || (s.ultimoTipo === 'contatti' && /^e\b|^anche\b/i.test(domanda))) out = cercaContatti(domanda);
      else out = await chat(s, domanda);
      s.ultimoTipo = out.tipo;
      return risposta(s, domanda || (azione === 'ticket' ? 'Aiutami a descrivere il problema' : body.categoria || azione), out);
    } finally { sessioniOccupate.delete(req.sessionID); }
  }
  return { gestisci, preparaIndice, stato };
}

function collega(api, deps) {
  const servizio = creaServizio(deps);
  const { rateLimit } = require('express-rate-limit');
  const limite = rateLimit({ windowMs: 60_000, limit: 25, standardHeaders: true, legacyHeaders: false,
    keyGenerator: (req) => req.sessionID,
    handler: (req, res) => res.status(429).json({ errore: 'Hai inviato molti messaggi. Attendi un minuto e riprova.' }) });
  api.get('/assistente', deps.serveLogin, (req, res) => {
    const s = servizio.stato(req);
    res.set('Cache-Control', 'no-store').json({ messaggi: s.messaggi, ultima: s.ultima || null, disponibile: true });
  });
  api.post('/assistente', deps.serveLogin, deps.csrf, limite, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const owner = proprietario(req), out = await servizio.gestisci(req);
      const ancora = await new Promise((resolve, reject) => req.sessionStore.get(req.sessionID, (e, s) => e ? reject(e) : resolve(s)));
      if (!ancora?.user || `${ancora.user.tid || ''}:${ancora.user.oid || ancora.user.email || req.sessionID}` !== owner) {
        req.session = null;
        return res.status(401).json({ errore: 'Sessione terminata. Accedi nuovamente.' });
      }
      res.json(out);
    } catch (e) { res.status(e.status || 503).json({ errore: e.status ? e.message : 'L’assistente non è disponibile. Puoi usare le guide o aprire una richiesta.' }); }
  });
  return servizio;
}
module.exports = { creaServizio, collega };
