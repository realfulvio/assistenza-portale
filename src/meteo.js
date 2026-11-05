// Meteo locale: richiesta condivisa, nessun messaggio o dato utente inviato al fornitore.
const FONTE = 'https://open-meteo.com/';
const normalizza = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, ' ').trim();
// Finestra delle previsioni: oggi più i sette giorni successivi (basta per qualunque weekend o giorno della settimana).
const GIORNI_PREVISIONE = 8;
const SETTIMANA = ['domenica','lunedi','martedi','mercoledi','giovedi','venerdi','sabato'];
const NOMI_GIORNI = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
const nomeGiorno = data => NOMI_GIORNI[new Date(data + 'T12:00:00Z').getUTCDay()];
// Data odierna nel fuso dell'ente, come mezzanotte UTC: serve solo per contare i giorni.
function oggiLocale(adesso, fuso = 'Europe/Rome') {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(adesso)).map(x => [x.type, x.value]));
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day));
}
// Giorni chiesti come distanza da oggi (0 = oggi): oggi/domani/dopodomani, weekend, nomi dei giorni, date gg/mm.
function giorniCitati(q, adesso) {
  const base = oggiLocale(adesso), dow = new Date(base).getUTCDay(), trovati = [];
  let fuori = false;
  ['oggi','domani','dopodomani'].forEach((nome,i) => { if (new RegExp('\\b'+nome+'\\b').test(q)) trovati.push(i); });
  const weekend = q.match(/\b(?:(prossim[oa])\s+)?(?:week\s*-?\s*end|fine\s+settimana)(?:\s+(prossim[oa]))?\b/);
  if (weekend) {
    const successivo = Boolean(weekend[1] || weekend[2]);
    const sabato = dow === 0 ? (successivo ? 6 : -1) : dow === 6 ? (successivo ? 7 : 0) : 6 - dow;
    for (const d of [sabato, sabato + 1]) if (d >= 0) trovati.push(d);
  }
  const senzaWeekend = q.replace(/\bfine\s+settimana\b/g, ' ');
  for (const m of senzaWeekend.matchAll(/\b(?:(prossim[oa])\s+)?(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b(?:\s+(prossim[oa])\b)?/g)) {
    let d = (SETTIMANA.indexOf(m[2]) - dow + 7) % 7;
    if (d === 0 && (m[1] || m[3])) d = 7;
    trovati.push(d);
  }
  if (/\bquesta\s+settimana\b/.test(senzaWeekend)) for (let d = 0; d <= (7 - dow) % 7; d++) trovati.push(d);
  else if (/\bsettiman/.test(senzaWeekend)) fuori = true;
  for (const m of q.matchAll(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?\b/g)) {
    const anno = new Date(base).getUTCFullYear(), giorno = Number(m[1]), mese = Number(m[2]);
    let data = Date.UTC(m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : anno, mese - 1, giorno);
    if (!m[3] && data < base - 31 * 864e5) data = Date.UTC(anno + 1, mese - 1, giorno);
    const d = Math.round((data - base) / 864e5);
    if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31 || d < 0 || d >= GIORNI_PREVISIONE) fuori = true; else trovati.push(d);
  }
  return { giorni: [...new Set(trovati)].sort((a,b) => a - b), fuori };
}
function richiesta(testo, stato = {}, localita = '', adesso = Date.now()) {
  const originale = String(testo || '').toLowerCase().trim().replace(/[?!.]+$/, '').trim()
    .replace(/\b(?:meto|metteo|meteo[o]+)\b/g,'meteo')
    .replace(/\b(?:previsionne|previzioni|previsoni)\b/g,'previsioni')
    .replace(/\b(?:domnai|domanni)\b/g,'domani')
    .replace(/\b(?:dopodmani|dopodomanni)\b/g,'dopodomani')
    .replace(/\bche temppo\b/g,'che tempo');
  const q = normalizza(originale);
  const numeri = {un:1,uno:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7};
  const prossimi = q.match(/\bprossim[ioe]\s+(?:(\d+|due|tre|quattro|cinque|sei|sette)\s+)?giorni\b|\bgiorni\s+prossim[ioe]\b/);
  const quanti = prossimi ? (prossimi[1] ? Number(prossimi[1]) || numeri[prossimi[1]] : 3) : 0;
  const citati = giorniCitati(q, adesso), espliciti = citati.giorni;
  const distanza = q.match(/\b(?:tra|fra)\s+(\d+|un|uno|due|tre|quattro|cinque|sei|sette)\s+giorn[oi]\b/);
  const fraGiorni = distanza ? Number(distanza[1]) || numeri[distanza[1]] : null;
  const giorni = quanti > 0 && quanti < GIORNI_PREVISIONE ? Array.from({length:quanti},(_,i)=>i) : espliciti.length > 1 ? espliciti : undefined;
  const giorno = fraGiorni !== null ? fraGiorni : espliciti[0] || 0;
  const scelte = stato.ultimoTipo === 'meteo' ? stato.meteo?.scelte || [] : [];
  const scelta = scelte.find(p => normalizza(p.etichetta) === q) || (/^[1-5]$/.test(q) ? scelte[Number(q) - 1] : null);
  if (scelta) return { posizione: scelta, giorno: stato.meteo.giorno || 0, giorni:stato.meteo.giorni };
  if (/\b(?:barzellett[ae]|freddur[ae])\b/.test(q)) return null;
  if (/\b(mail|email|outlook|computer|stampante|ticket|sito|link|allegato|password|token|credenziali|segreto)\b|non funziona|non si apre/.test(q)) return null;
  const seguito = stato.ultimoTipo === 'meteo' && /^(?:(?:e\s+)?(?:oggi|domani|dopodomani)$|(?:e\s+)?(?:a|in)\s+\S|(?:e\s+)?(?:(?:nei|per i)\s+)?(?:prossim[ioe]\b|tra\b|fra\b)|(?:e\s+)?(?:(?:il|lo|per il|per lo|nel|del|questo|questa|prossimo|prossima)\s+)?(?:week\s*-?\s*end|fine settimana|questa settimana|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b)/.test(q);
  if (!seguito && !/\b(meteo|previsioni|piove|pioggia|piovera|piovere|nevica|nevichera|ombrello)\b|che tempo (?:fa|fara|c\s*e|ce)|come (?:va|si mette) (?:il )?meteo|che meteo|com e (?:il )?tempo|come sara (?:il )?tempo|quanti gradi|(?:temperatura|vento|sole|nebbia).*(?:oggi|domani|weekend|fine settimana|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)|(?:oggi|domani|weekend|fine settimana|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica).*(?:temperatura|vento|sole|nebbia)/.test(q)) return null;
  const nonLuogo = /^(?:(?:la|il|le|i)\s+)?(?:oggi|domani|dopodomani|week|weekend|fine settimana|settimana|questo|questa|prossimo|prossima|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|pioggia|neve|sole|vento|nebbia|giorno|notte|favore|piacere|che|quanto|pranzo|cena|mia|mio|miei|mie|tua|tuo|nostro|nostra|visita|viaggio|appuntamento|medico|ospedale|casa|ufficio|azienda)\b/;
  const candidati = [...originale.matchAll(/(?=(?:^|\s)(?:a|ad|in|per|di)\s+(.+))/gu)].map(m => m[1]);
  const breve = originale.replace(/^(?:(?:mi (?:dici|puoi dire)|puoi dirmi|vorrei sapere)\s+)?(?:(?:il\s+)?(?:meteo|previsioni(?:\s+meteo)?)|che tempo (?:fa|farà|fara|c[’']è|ce)|come sarà il tempo)\s+/, '');
  if (breve !== originale) candidati.push(breve);
  let luogo, chiediLuogo = false;
  for (let nome of candidati) {
    // Taglia frasi e motivazioni: al fornitore va il nome, non il resto del messaggio.
    const tempo = /\b(?:(?:nei|per i|i)\s+)?prossim[ioe]\s+(?:(?:\d+|due|tre|quattro|cinque|sei|sette)\s+)?giorni\b|\bgiorni\s+prossim[ioe]\b|\b(?:tra|fra)\s+(?:\d+|un|uno|due|tre|quattro|cinque|sei|sette)\s+giorn[oi]\b|\b(?:oggi|domani|dopodomani)\b|\b(?:(?:questo|questa|il|lo|nel|del|per il|per lo|prossim[oa])\s+)*(?:week\s*-?\s*end|fine\s+settimana|questa\s+settimana|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)(?:\s+prossim[oa])?(?![\p{L}\p{N}])|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/u;
    for (let passo=0; passo<4; passo++) {
      const trovato = tempo.exec(nome); if (!trovato) break;
      const prima = nome.slice(0,trovato.index).trim();
      // Dopo una città il periodo delimita anche le eventuali motivazioni personali.
      if (prima && !/^(?:(?:a|ad|in|per|di|i|il|nei|e)\s*)+$/u.test(prima)) { nome = prima; break; }
      nome = (prima + ' ' + nome.slice(trovato.index+trovato[0].length)).replace(/\s+/g,' ').trim();
    }
    nome = nome.split(/[?!;:\n]/u)[0].replace(/\s+(?:oggi|domani|dopodomani|stasera|adesso|ora|per|perch[eé]|siccome|dato che|e|poi|devo|dovrei|vorrei|vado|andr[oò]|ho|hai|mi|ti|ma|mentre|quando|se|grazie)(?=\s|$|[?!.,;:]).*$/u, '').trim();
    nome = nome.replace(/^(?:(?:a|ad|in|per|di)\s+)+/u,'').trim();
    if (!nome || /^(?:a|ad|in|per|di|i|il|nei|e)$/u.test(nome)) continue;
    if (nonLuogo.test(normalizza(nome))) continue;
    if (nome.length >= 2 && nome.length <= 120 && nome.split(/\s+/).length <= 6 && /^[\p{L}\p{M}\s,.'’()-]+$/u.test(nome)) { luogo = nome; break; }
    chiediLuogo = true;
  }
  return {giorno,giorni,
    luogo, chiediLuogo,
    oltre:quanti >= GIORNI_PREVISIONE || (prossimi && quanti < 1) || (fraGiorni !== null && (fraGiorni < 0 || fraGiorni >= GIORNI_PREVISIONE)) || citati.fuori};
}
function condizione(c, giorno = true) {
  if(c===0) return {icona:giorno?'☀️':'🌙',descrizione:giorno?'Sereno':'Cielo sereno'};
  if(c===1 || c===2) return {icona:giorno?'🌤️':'☁️',descrizione:'Parzialmente nuvoloso'};
  if(c===3) return {icona:'☁️',descrizione:'Nuvoloso'};
  if([45,48].includes(c)) return {icona:'🌫️',descrizione:'Nebbia'};
  if([51,53,55,56,57].includes(c)) return {icona:'🌦️',descrizione:'Pioviggine'};
  if([61,63,65,66,67,80,81,82].includes(c)) return {icona:'🌧️',descrizione:'Pioggia'};
  if([71,73,75,77,85,86].includes(c)) return {icona:'🌨️',descrizione:'Neve'};
  if([95,96,99].includes(c)) return {icona:'⛈️',descrizione:'Temporali'};
  throw new Error('Codice meteo non valido');
}
function creaMeteo({attivo=false,localita='',latitudine,longitudine,fusoOrario='Europe/Rome',paese='',regione='',sogliaFreddo=8,sogliaCaldo=30,battutaFreddo='',battutaCaldo='',scarica=fetch,orologio=Date.now}={}) {
  const abilitato=attivo===true && typeof localita==='string' && localita.trim().length>0 && Number.isFinite(latitudine) && Math.abs(latitudine)<=90 && Number.isFinite(longitudine) && Math.abs(longitudine)<=180;
  let cache, scade=0, attesa, prossimoTentativo=0;
  const geocodifiche = new Map(), citta = new Map();
  // Le mappe sono limitate: nomi arbitrari non possono far crescere la memoria senza limite.
  function conserva(mappa, chiave, valore) {
    if (mappa.size >= 64 && !mappa.has(chiave)) mappa.delete(mappa.keys().next().value);
    mappa.set(chiave, valore);
  }
  async function cerca(nome) {
    const chiave = normalizza(nome), prima = geocodifiche.get(chiave);
    if (prima?.attesa) return prima.attesa;
    if (prima && orologio() < prima.scade) { if (prima.errore) throw new Error('Ricerca temporaneamente non disponibile'); return prima.valore; }
    const voce = {};
    conserva(geocodifiche, chiave, voce);
    voce.attesa = (async () => {
      const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
      url.search = new URLSearchParams({ name: nome, count: '5', language: 'it', format: 'json' });
      const r = await scarica(url.href, { signal: AbortSignal.timeout(6000) });
      if (!r.ok) throw new Error('Ricerca non disponibile');
      const d = await r.json();
      if (d.error || (d.results !== undefined && !Array.isArray(d.results))) throw new Error('Ricerca non valida');
      const risultati = (d.results || []).filter(p => typeof p.name === 'string' && p.name.length <= 120 && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180 && (!p.feature_code || p.feature_code.startsWith('PPL')) && typeof p.timezone === 'string').filter(p => {
        try { new Intl.DateTimeFormat('it', { timeZone: p.timezone }); return true; } catch { return false; }
      }).map(p => ({ nome: p.name, latitudine: p.latitude, longitudine: p.longitude, fuso: p.timezone, paese: String(p.country || '').slice(0, 100), regione: String(p.admin1 || '').slice(0, 100), popolazione: Number(p.population) || 0,
        etichetta: `${p.name} (${[p.admin1, p.country].filter(Boolean).join(', ')})` }));
      voce.valore = risultati; voce.scade = orologio() + 24 * 3600_000; return risultati;
    })().catch(e => { voce.errore = true; voce.scade = orologio() + 60_000; throw e; }).finally(() => { voce.attesa = null; });
    return voce.attesa;
  }
  async function leggi() {
    if(!abilitato) throw new Error('Meteo non configurato');
    if(cache && orologio()<scade) return cache;
    if(attesa) return attesa;
    if(orologio()<prossimoTentativo) throw new Error('Meteo temporaneamente non disponibile');
    attesa=(async()=>{
      const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitudine}&longitude=${longitudine}&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=${encodeURIComponent(fusoOrario)}&forecast_days=${GIORNI_PREVISIONE}`;
      const r=await scarica(url,{signal:AbortSignal.timeout(6000)});
      if(!r.ok) throw new Error('Fornitore meteo non disponibile');
      const d=await r.json();
      if(!Number.isFinite(d.current?.temperature_2m)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d.current?.time)) throw new Error('Dati meteo incompleti');
      condizione(d.current.weather_code);
      if(!Array.isArray(d.daily?.time)||d.daily.time.length<3) throw new Error('Previsioni incomplete');
      for(let i=0;i<Math.min(d.daily.time.length,GIORNI_PREVISIONE);i++) {
        if(!/^\d{4}-\d{2}-\d{2}$/.test(d.daily?.time?.[i])||!['temperature_2m_min','temperature_2m_max','precipitation_probability_max'].every(k=>Number.isFinite(d.daily?.[k]?.[i]))) throw new Error('Previsioni incomplete');
        condizione(d.daily.weather_code[i]);
      }
      cache=d; scade=orologio()+15*60_000; prossimoTentativo=0;
      return d;
    })().catch(e=>{prossimoTentativo=orologio()+60_000;throw e;}).finally(()=>{attesa=null;});
    return attesa;
  }
  async function rispondi(domanda={giorno:0}, stato) {
    const base={tipo:'meteo',fonti:[]};
    if(!abilitato) return {...base,risposta:'Il meteo non è configurato su questo portale.'};
    if(domanda.chiediLuogo && !domanda.luogo) return {...base,risposta:'Scrivi solo il nome della città e, se serve, il Paese, per esempio «Milano, Italia».'};
    if(domanda.oltre) return {...base,risposta:'Posso mostrarti il meteo fino a una settimana da oggi: per esempio domani, sabato o il weekend. Quale giorno ti interessa?'};
    if (!domanda.posizione && !domanda.luogo && stato?.meteo?.scelte?.length) {
      stato.meteo.giorno = domanda.giorno || 0;
      stato.meteo.giorni = domanda.giorni;
      return {...base,risposta:'Quale di queste località intendi?',opzioni:stato.meteo.scelte.map(p => ({testo:p.etichetta,azione:'messaggio'}))};
    }
    let destinazione = domanda.posizione || (!domanda.luogo ? stato?.meteo?.posizione : null);
    if (domanda.luogo && normalizza(domanda.luogo) !== normalizza(localita)) {
      let risultati;
      try { risultati = await cerca(domanda.luogo); }
      catch { return {...base,risposta:'Al momento non riesco a cercare la località. Riprova tra poco.'}; }
      if (!risultati.length) return {...base,risposta:'Non ho trovato questa località. Prova con il nome della città e, se serve, il Paese.'};
      const dominante = risultati.length === 1 || (risultati[0].popolazione >= 100000 && risultati[0].popolazione >= 10 * Math.max(1, ...risultati.slice(1).map(p => p.popolazione)));
      if (!dominante) {
        if (stato) stato.meteo = { scelte: risultati, giorno: domanda.giorno || 0, giorni:domanda.giorni };
        return {...base,risposta:'Ho trovato più località con questo nome. Quale intendi?',opzioni:risultati.map(p => ({testo:p.etichetta,azione:'messaggio'}))};
      }
      destinazione = risultati[0];
    } else if (domanda.luogo) destinazione = null;
    if (destinazione) {
      const chiave = `${destinazione.latitudine},${destinazione.longitudine}`;
      let servizio = citta.get(chiave);
      if (!servizio) {
        servizio = creaMeteo({attivo:true,localita:destinazione.nome,latitudine:destinazione.latitudine,longitudine:destinazione.longitudine,fusoOrario:destinazione.fuso,paese:destinazione.paese,regione:destinazione.regione,sogliaFreddo,sogliaCaldo,battutaFreddo,battutaCaldo,scarica,orologio});
        conserva(citta, chiave, servizio);
      }
      const out = await servizio.rispondi({giorno:domanda.giorno || 0,giorni:domanda.giorni});
      if ((out.meteo || out.previsioni?.length) && stato) stato.meteo = {posizione:destinazione};
      return out;
    }
    try {
      const d=await leggi(), i=domanda.giorno || 0, c=d.current, g=d.daily;
      if([i,...(domanda.giorni||[])].some(n=>!(n>=0 && n<Math.min(g.time.length,GIORNI_PREVISIONE)))) return {...base,risposta:'Le previsioni per quel giorno non sono ancora disponibili. Posso mostrarti fino a una settimana da oggi.'};
      const scheda = (i, previsione=false) => {
        const temperaturaBattuta=i || previsione?g.temperature_2m_max[i]:c.temperature_2m;
        const battuta=temperaturaBattuta<=sogliaFreddo?battutaFreddo:temperaturaBattuta>=sogliaCaldo?battutaCaldo:'';
        const m={localita,battuta,paese,regione,fuso:fusoOrario,giorno:['Oggi','Domani'][i] || nomeGiorno(g.time[i]),data:g.time[i],
          ...condizione(i || previsione?g.weather_code[i]:c.weather_code,i || previsione?true:c.is_day===1),
          temperatura:i || previsione?null:Math.round(c.temperature_2m),minima:Math.round(g.temperature_2m_min[i]),massima:Math.round(g.temperature_2m_max[i]),
          pioggia:g.precipitation_probability_max[i],aggiornato:c.time,fonte:FONTE};
        return m;
      };
      if (stato) stato.meteo = {};
      if (domanda.giorni?.length) {
        const previsioni = domanda.giorni.map(giorno => scheda(giorno,true));
        return {...base,previsioni,risposta:`Previsioni a ${localita}${paese?` (${paese})`:''}:\n`+previsioni.map(m=>`${m.icona} ${m.giorno} ${m.data.slice(8,10)}/${m.data.slice(5,7)}: ${m.descrizione.toLowerCase()}, minima ${m.minima}°, massima ${m.massima}°, pioggia ${m.pioggia}%.${m.battuta?` ${m.battuta}!`:''}`).join('\n')+`\nOpen-Meteo · ${c.time.slice(0,10)} ore ${c.time.slice(11)} (${fusoOrario}, ora locale).`};
      }
      const m = scheda(i);
      return {...base,meteo:m,risposta:`${m.icona} ${m.giorno}${i>=2?` ${m.data.slice(8,10)}/${m.data.slice(5,7)}`:''} a ${localita}${paese?` (${paese})`:''}: ${m.descrizione.toLowerCase()}${i?'':`, ${m.temperatura} °C`}. Minima ${m.minima}°, massima ${m.massima}°. Probabilità di pioggia ${m.pioggia}%.${m.battuta?` ${m.battuta}!`:''} Dati Open-Meteo delle ${c.time.slice(11)} del ${c.time.slice(0,10)} (ora locale, ${fusoOrario}).`};
    } catch { return {...base,risposta:`Al momento non riesco a recuperare il meteo di ${localita}. Riprova tra poco.`}; }
  }
  return {leggi,rispondi,localita,abilitato};
}
module.exports={creaMeteo,richiesta,condizione};
