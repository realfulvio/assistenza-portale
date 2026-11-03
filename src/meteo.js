// Meteo locale: richiesta condivisa, nessun messaggio o dato utente inviato al fornitore.
const FONTE = 'https://open-meteo.com/';
const normalizza = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, ' ').trim();
function richiesta(testo, stato = {}, localita = '') {
  const originale = String(testo || '').toLowerCase().trim().replace(/[?!.]+$/, '').trim();
  const q = normalizza(originale);
  const numeri = {un:1,uno:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7};
  const prossimi = q.match(/\bprossim[ioe]\s+(?:(\d+|due|tre|quattro|cinque|sei|sette)\s+)?giorni\b|\bgiorni\s+prossim[ioe]\b/);
  const quanti = prossimi ? (prossimi[1] ? Number(prossimi[1]) || numeri[prossimi[1]] : 3) : 0;
  const espliciti = ['oggi','domani','dopodomani'].map((nome,i) => new RegExp('\\b'+nome+'\\b').test(q) ? i : -1).filter(i => i >= 0);
  const distanza = q.match(/\b(?:tra|fra)\s+(\d+|un|uno|due|tre|quattro|cinque|sei|sette)\s+giorn[oi]\b/);
  const fraGiorni = distanza ? Number(distanza[1]) || numeri[distanza[1]] : null;
  const giorni = quanti > 0 && quanti <= 3 ? Array.from({length:quanti},(_,i)=>i) : espliciti.length > 1 ? espliciti : undefined;
  const giorno = fraGiorni !== null ? fraGiorni : /dopodomani/.test(q) ? 2 : /domani/.test(q) ? 1 : 0;
  const scelte = stato.ultimoTipo === 'meteo' ? stato.meteo?.scelte || [] : [];
  const scelta = scelte.find(p => normalizza(p.etichetta) === q) || (/^[1-5]$/.test(q) ? scelte[Number(q) - 1] : null);
  if (scelta) return { posizione: scelta, giorno: stato.meteo.giorno || 0, giorni:stato.meteo.giorni };
  if (/\b(?:barzellett[ae]|freddur[ae])\b/.test(q)) return null;
  if (/\b(mail|email|outlook|computer|stampante|ticket|sito|link|allegato|password|token|credenziali|segreto)\b|non funziona|non si apre/.test(q)) return null;
  const seguito = stato.ultimoTipo === 'meteo' && /^(?:(?:e\s+)?(?:oggi|domani|dopodomani)$|(?:e\s+)?(?:a|in)\s+\S|(?:e\s+)?(?:(?:nei|per i)\s+)?(?:prossim[ioe]\b|tra\b|fra\b))/.test(q);
  if (!seguito && !/\b(meteo|previsioni|piove|pioggia|piovera|piovere|nevica|nevichera|ombrello)\b|che tempo (?:fa|fara|c e)|com e (?:il )?tempo|come sara (?:il )?tempo|quanti gradi|(?:temperatura|vento|sole|nebbia).*(?:oggi|domani)|(?:oggi|domani).*(?:temperatura|vento|sole|nebbia)/.test(q)) return null;
  const nonLuogo = /^(?:(?:la|il|le|i)\s+)?(?:oggi|domani|dopodomani|pioggia|neve|sole|vento|nebbia|giorno|notte|favore|piacere|che|quanto|pranzo|cena|mia|mio|miei|mie|tua|tuo|nostro|nostra|visita|viaggio|appuntamento|medico|ospedale|casa|ufficio|azienda)\b/;
  const candidati = [...originale.matchAll(/(?=(?:^|\s)(?:a|ad|in|per|di)\s+(.+))/gu)].map(m => m[1]);
  const breve = originale.replace(/^(?:il\s+)?(?:meteo|previsioni(?:\s+meteo)?)\s+/, '');
  if (breve !== originale) candidati.push(breve);
  let luogo, chiediLuogo = false;
  for (let nome of candidati) {
    // Taglia frasi e motivazioni: al fornitore va il nome, non il resto del messaggio.
    const tempo = /\b(?:(?:nei|per i|i)\s+)?prossim[ioe]\s+(?:(?:\d+|due|tre|quattro|cinque|sei|sette)\s+)?giorni\b|\bgiorni\s+prossim[ioe]\b|\b(?:tra|fra)\s+(?:\d+|un|uno|due|tre|quattro|cinque|sei|sette)\s+giorn[oi]\b|\b(?:oggi|domani|dopodomani)\b/u;
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
    oltre:quanti > 3 || (prossimi && quanti < 1) || (fraGiorni !== null && (fraGiorni < 0 || fraGiorni > 2)) || /settimana|weekend|sabato|domenica|lunedi|martedi|mercoledi|giovedi|venerdi|\d{1,2}[/-]\d{1,2}/.test(q)};
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
      const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitudine}&longitude=${longitudine}&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=${encodeURIComponent(fusoOrario)}&forecast_days=3`;
      const r=await scarica(url,{signal:AbortSignal.timeout(6000)});
      if(!r.ok) throw new Error('Fornitore meteo non disponibile');
      const d=await r.json();
      if(!Number.isFinite(d.current?.temperature_2m)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d.current?.time)) throw new Error('Dati meteo incompleti');
      condizione(d.current.weather_code);
      for(let i=0;i<3;i++) {
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
    if(domanda.oltre) return {...base,risposta:'Posso mostrarti il meteo per oggi, domani e dopodomani. Quale giorno ti interessa?'};
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
      const scheda = (i, previsione=false) => {
        const temperaturaBattuta=i || previsione?g.temperature_2m_max[i]:c.temperature_2m;
        const battuta=temperaturaBattuta<=sogliaFreddo?battutaFreddo:temperaturaBattuta>=sogliaCaldo?battutaCaldo:'';
        const m={localita,battuta,paese,regione,fuso:fusoOrario,giorno:['Oggi','Domani','Dopodomani'][i],data:g.time[i],
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
      return {...base,meteo:m,risposta:`${m.icona} ${m.giorno} a ${localita}${paese?` (${paese})`:''}: ${m.descrizione.toLowerCase()}${i?'':`, ${m.temperatura} °C`}. Minima ${m.minima}°, massima ${m.massima}°. Probabilità di pioggia ${m.pioggia}%.${m.battuta?` ${m.battuta}!`:''} Dati Open-Meteo delle ${c.time.slice(11)} del ${c.time.slice(0,10)} (ora locale, ${fusoOrario}).`};
    } catch { return {...base,risposta:`Al momento non riesco a recuperare il meteo di ${localita}. Riprova tra poco.`}; }
  }
  return {leggi,rispondi,localita,abilitato};
}
module.exports={creaMeteo,richiesta,condizione};
