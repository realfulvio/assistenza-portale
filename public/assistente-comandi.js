(function(radice,crea){
  if(typeof module==='object'&&module.exports)module.exports=crea();
  else radice.ComandiAssistente=crea();
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  function normalizza(testo){
    return String(testo||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[’']/g,' ').replace(/\s+/g,' ').trim();
  }
  function estraiRiassunto(testo){
    if(typeof testo!=='string')return null;
    const richiesta=testo.trimStart();
    const separatore=richiesta.search(/[:\r\n]/);
    const comando=normalizza(separatore<0?richiesta:richiesta.slice(0,separatore))
      .replace(/[.!?]+$/,'').replace(/[, ]+(?:per favore|grazie)$/,'').trim();
    const breve=/^(?:(?:mi )?(?:puoi|potresti|riesci a) )?(?:riassum(?:i|imi|ere|ermi)|riasum(?:i|imi|ere|ermi)|sintetizza(?:mi|re)?)(?: (?:questo|il|un) testo| questo)?$/;
    const nome=/^(?:(?:mi fai|mi faresti|fammi|fai|puoi (?:farmi|fare)|potresti (?:farmi|fare)|vorrei|voglio|preparami) )?(?:un |il )?(?:riassunto|riasunto|riassnto|sintesi)(?: (?:di questo|del|di un|di) testo| di questo)?$/;
    if(!breve.test(comando)&&!nome.test(comando))return null;
    return separatore<0?'':richiesta.slice(separatore+1).trimStart();
  }
  function testoTicket(testo){
    return normalizza(testo).replace(/\btik(?:e|ec)t\b/g,'ticket')
      .replace(/\b(?:rispoto|rispsto|risopsto)\b/g,'risposto')
      .replace(/\brichest([ae])\b/g,'richiest$1').replace(/\bsegnalazzion([ei])\b/g,'segnalazion$1');
  }
  function richiestaBozza(q){
    return /^(?:(?:ciao|per favore)[,!]? )?(?:(?:mi (?:aiuti a|puoi aiutare a)|aiutami a|mi|puoi|potresti|vorrei|voglio|devo|mi serve|come posso|come faccio ad) )?(?:prepara(?:re|mi)?|compila(?:re)?|apr(?:i|ire|irmi)|crea(?:re)?|scrivi|scrivere|segnala(?:re)?) (?:.{0,35} )?(?:ticket|richiesta|segnalazione)\b/.test(q);
  }
  function seguitoRisposta(q){
    return /^(?:e )?(?:(?:mi )?hanno (?:gia )?(?:risposto|aggiornato)|c e (?:una )?risposta|ci sono (?:delle )?novita)[.!?]*$/.test(q);
  }
  function domandaSulMioTicket(q){
    return /^(?:(?:e|il|la) )?(?:mio ticket|mia richiesta|mia segnalazione)[.!?]*$/.test(q)
      || /\b(?:risposto|risposte?|novita|aggiornato|aggiornamenti)\b.{0,40}\b(?:ticket|richiesta|segnalazione)\b|\b(?:ticket|richiesta|segnalazione)\b.{0,40}\b(?:risposto|risposte?|novita|aggiornato|aggiornamenti)\b/.test(q);
  }
  function richiestaStato(q){
    return domandaSulMioTicket(q) || /(?:stato|numero|ultima|ultimo|ultime|ultimi|mie|miei|a che punto|che fine|come va|seguire).{0,35}(?:ticket|richiest|segnalaz)|(?:ticket|richiest|segnalaz).{0,35}(?:stato|numero|risolt|chius|tecnico)|(?:ticket|richiesta|segnalazione)\s*#?\d|#\d{1,9}\b/.test(q)
      || /^(?:mi fai vedere|puoi mostrarmi|mostrami|vorrei vedere) (?:il |la |i miei |le mie )?(?:ticket|richiest[ae]|segnalazion[ei])[.!?]*$/.test(q);
  }
  return {normalizza,estraiRiassunto,testoTicket,richiestaBozza,richiestaStato,domandaSulMioTicket,seguitoRisposta};
});
