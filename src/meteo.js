// Meteo locale: richiesta condivisa, nessun messaggio o dato utente inviato al fornitore.
const FONTE = 'https://open-meteo.com/';
function richiesta(testo, stato = {}, localita = '') {
  const q = String(testo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, ' ');
  if (/\b(?:barzellett[ae]|freddur[ae])\b/.test(q)) return null;
  if (/\b(mail|email|outlook|computer|stampante|ticket|sito|link|allegato)\b|non funziona|non si apre/.test(q)) return null;
  const seguito = stato.ultimoTipo === 'meteo' && /^(?:e\s+)?(?:oggi|domani|dopodomani)\s*[?!.]*$/.test(q.trim());
  if (!seguito && !/\b(meteo|previsioni|piove|pioggia|piovera|piovere|nevica|nevichera|ombrello)\b|che tempo (?:fa|fara|c e)|com e (?:il )?tempo|come sara (?:il )?tempo|quanti gradi|(?:temperatura|vento|sole|nebbia).*(?:oggi|domani)|(?:oggi|domani).*(?:temperatura|vento|sole|nebbia)/.test(q)) return null;
  const nonLuoghi = new Set(['oggi','domani','dopodomani','pioggia','neve','sole','vento','nebbia','giorno','notte','favore','piacere','il','la','le','i','che','quanto','pranzo','cena']);
  const luoghi = [...q.matchAll(/\b(?:a|in|per|di)\s+([a-z]+)/g)].map(m=>m[1]).filter(p=>!nonLuoghi.has(p));
  return {giorno:/dopodomani/.test(q)?2:/domani/.test(q)?1:0,
    fuoriZona:luoghi.some(luogo=>!String(localita).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).includes(luogo)),
    oltre:/settimana|weekend|sabato|domenica|lunedi|martedi|mercoledi|giovedi|venerdi|\d{1,2}[/-]\d{1,2}/.test(q)};
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
function creaMeteo({attivo=false,localita='',latitudine,longitudine,sogliaFreddo=8,sogliaCaldo=30,battutaFreddo='',battutaCaldo='',scarica=fetch,orologio=Date.now}={}) {
  const abilitato=attivo===true && typeof localita==='string' && localita.trim().length>0 && Number.isFinite(latitudine) && Math.abs(latitudine)<=90 && Number.isFinite(longitudine) && Math.abs(longitudine)<=180;
  let cache, scade=0, attesa, prossimoTentativo=0;
  async function leggi() {
    if(!abilitato) throw new Error('Meteo non configurato');
    if(cache && orologio()<scade) return cache;
    if(attesa) return attesa;
    if(orologio()<prossimoTentativo) throw new Error('Meteo temporaneamente non disponibile');
    attesa=(async()=>{
      const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitudine}&longitude=${longitudine}&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FRome&forecast_days=3`;
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
  async function rispondi(domanda={giorno:0}) {
    const base={tipo:'meteo',fonti:[]};
    if(!abilitato) return {...base,risposta:'Il meteo non è configurato su questo portale.'};
    if(domanda.fuoriZona) return {...base,risposta:`Per ora posso mostrarti solo il meteo di ${localita}.`};
    if(domanda.oltre) return {...base,risposta:`Posso mostrarti il meteo di ${localita} per oggi, domani e dopodomani. Quale giorno ti interessa?`};
    try {
      const d=await leggi(), i=domanda.giorno || 0, c=d.current, g=d.daily;
      const temperaturaBattuta=i?g.temperature_2m_max[i]:c.temperature_2m;
      const battuta=temperaturaBattuta<=sogliaFreddo?battutaFreddo:temperaturaBattuta>=sogliaCaldo?battutaCaldo:'';
      const m={localita,battuta,giorno:['Oggi','Domani','Dopodomani'][i],data:g.time[i],
        ...condizione(i?g.weather_code[i]:c.weather_code,i?true:c.is_day===1),
        temperatura:i?null:Math.round(c.temperature_2m),minima:Math.round(g.temperature_2m_min[i]),massima:Math.round(g.temperature_2m_max[i]),
        pioggia:g.precipitation_probability_max[i],aggiornato:c.time,fonte:FONTE};
      return {...base,meteo:m,risposta:`${m.icona} ${m.giorno} a ${localita}: ${m.descrizione.toLowerCase()}${i?'':`, ${m.temperatura} °C`}. Minima ${m.minima}°, massima ${m.massima}°. Probabilità di pioggia ${m.pioggia}%.${battuta?` ${battuta}!`:''} Dati Open-Meteo delle ${c.time.slice(11)} del ${c.time.slice(0,10)}.`};
    } catch { return {...base,risposta:`Al momento non riesco a recuperare il meteo di ${localita}. Riprova tra poco.`}; }
  }
  return {leggi,rispondi,localita,abilitato};
}
module.exports={creaMeteo,richiesta,condizione};
