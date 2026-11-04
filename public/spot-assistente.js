(function(radice,fabbrica){
  if(typeof module==='object'&&module.exports)module.exports=fabbrica();
  else radice.SpotAssistente=fabbrica();
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const PRIMO_RITARDO=60000,INTERVALLO=5*60000;
  function normalizza(dati){
    const ids=new Set();
    return (Array.isArray(dati?.spot)?dati.spot:[]).slice(0,32).flatMap(v=>{
      if(!v||v.attivo===false||typeof v.id!=='string'||!/^[a-z0-9-]{1,50}$/.test(v.id)||ids.has(v.id))return [];
      const testo=k=>typeof v[k]==='string'?v[k].trim():'';
      const titolo=testo('titolo'),descrizione=testo('testo');let url=null;
      if(v.url){try{url=new URL(v.url);if(url.protocol!=='https:'||url.username||url.password)return [];}catch{return [];}}
      if(!titolo||titolo.length>100||!descrizione||descrizione.length>350)return [];
      const asset=(val,est)=>typeof val==='string'&&new RegExp('^/media/spot/[a-zA-Z0-9_-]+\\.('+est+')$').test(val);
      if(v.video&&!asset(v.video,'mp4|webm'))return [];
      if(v.poster&&!asset(v.poster,'png|webp|jpg'))return [];
      const data=k=>!v[k]?null:typeof v[k]==='string'&&/^\d{4}-\d\d-\d\dT.+(?:Z|[+-]\d\d:\d\d)$/.test(v[k])?Date.parse(v[k]):NaN;
      const dal=data('dal'),al=data('al');if(Number.isNaN(dal)||Number.isNaN(al)||(dal!=null&&al!=null&&al<=dal))return [];
      ids.add(v.id);return [{id:v.id,titolo,battuta:testo('battuta').slice(0,140),parodia:v.parodia===true,testo:descrizione,url:url?.href||null,video:v.video||null,poster:v.poster||null,descrizioneVideo:testo('descrizioneVideo').slice(0,600),dal,al}];
    });
  }
  function scegli(lista,s,casuale=Math.random){
    if(s.occupato||s.nascosto||s.silenzioso||s.attesaMeteo||s.ora-s.caricataIl<PRIMO_RITARDO||s.ora<(s.prossimo||0))return null;
    const attivi=lista.filter(v=>(v.dal==null||s.ora>=v.dal)&&(v.al==null||s.ora<v.al));
    if(!attivi.length||casuale()>=.25)return null;
    const candidati=attivi.length>1?attivi.filter(v=>v.id!==s.ultimoId):attivi;
    return candidati[Math.floor(casuale()*candidati.length)];
  }
  function normalizzaRichiestaSpot(testo){
    return String(testo||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/’/g,"'").trim().replace(/\s+/g,' ')
      .replace(/^(?:ciao|per favore)[,!:]? +/,'')
      .replace(/[.!?]+$/,'').replace(/[, ]+(?:per favore|grazie)$/,'')
      .replace(/^(?:mi (?:fai|faresti|puoi|potresti)|puoi|potresti|vorrei|posso|potrei|fammi|fai|voglio) /,'')
      .trim();
  }
  const azioneSpot=/^(?:far(?:mi)? )?(?:veder(?:e)?|guardare|partire|mostra(?:mi|re)?|riproduc(?:i|imi|ere)|avvia(?:mi|re)?|dammi) /;
  function idSpotRichiesto(testo){
    const q=normalizzaRichiestaSpot(testo).replace(azioneSpot,'');
    const m=/^(?:(?:lo spot|la pubblicita|spot|pubblicita)(?: di)? )?(cedro|dipendentin(?: pubblico)?|rimbalzoff|ticketol|rebootol(?: 1000 mg)?)$/.exec(q);
    return m?m[1].replace(/ (?:pubblico|1000 mg)$/,''):null;
  }
  function richiestaSpot(testo){
    const q=normalizzaRichiestaSpot(testo).replace(azioneSpot,'');
    return idSpotRichiesto(testo)!==null||/^(?:(?:uno|una|un|lo|la) )?(?:spot|pubblicita)(?: (?:a caso|casuale|qualsiasi))?$/.test(q);
  }
  function richiestaElencoSpot(testo){
    const q=normalizzaRichiestaSpot(testo).replace(azioneSpot,'');
    const oggetto='(?:spot(?: pubblicitari)?|pubblicita)(?: (?:disponibili|attivi|attive))?';
    const plurale='(?:tutti gli |tutte le |gli |le )';
    const indice="(?:(?:la |il |un |l')?(?:lista|elenco|catalogo)(?: di)? |elenca(?:mi|re)? )";
    return new RegExp('^(?:'+[
      indice+'(?:'+plurale+'|degli |delle )?'+oggetto,
      plurale+oggetto+'(?: che avete| che ci sono)?',
      '(?:(?:sapere|dirmi|dire) )?(?:quali|che) (?:sono )?(?:gli |le )?'+oggetto+'(?: ci sono| avete| hai| sono disponibili)?',
      '(?:spot|pubblicita) disponibili'
    ].join('|')+')$').test(q);
  }
  const spotRiproducibili=(lista,ora)=>lista.filter(v=>v.video&&(v.dal==null||ora>=v.dal)&&(v.al==null||ora<v.al));
  const api={normalizza,scegli,richiestaSpot,idSpotRichiesto,richiestaElencoSpot,PRIMO_RITARDO,INTERVALLO};if(typeof document==='undefined')return api;
  function avvia(){
    const mascotte=document.getElementById('mascotte');if(!mascotte)return;
    const BASE=document.querySelector('meta[name=base]')?.content||'',CHIAVE='portale.assistente.spot';
    const h=(tag,props={},...figli)=>{const e=Object.assign(document.createElement(tag),props);e.append(...figli.filter(v=>v!=null));return e;};
    const leggi=k=>{try{return localStorage.getItem(CHIAVE+k);}catch{return null;}};
    const salva=(k,v)=>{try{localStorage.setItem(CHIAVE+k,v);}catch{}}
    const caricataIl=Date.now();let lista=[],nota=null,timer=null,video=null,ritornaChat=false;
    if(Number(leggi('.prossimo'))>Date.now()+INTERVALLO+30000)salva('.prossimo',String(Date.now()+INTERVALLO+Math.floor(Math.random()*30000)));
    function occupato(){
      const a=document.activeElement;
      const modulo=[...document.querySelectorAll('#v-nuova textarea,#v-nuova input:not(#telefono):not([type=file]):not([type=checkbox]):not([type=radio]):not([type=hidden])')].some(e=>e.value.trim());
      return mascotte.dataset.aperta==='true'||!!document.querySelector('#msc-meteo')||!!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))||modulo;
    }
    function chiudiNota(riprendi=true){
      clearTimeout(timer);
      if(video){video.pause();video.removeAttribute('src');video.load();video=null;}
      if(nota){nota.remove();nota=null;}
      ritornaChat=false;delete mascotte.dataset.spotVisibile;delete mascotte.dataset.spotVideo;
      if(riprendi)mascotte.dispatchEvent(new Event('assistente:riprendi-note'));
    }
    function chiudiUtente(){
      const torna=ritornaChat;chiudiNota();
      if(torna)mascotte.dispatchEvent(new Event('assistente:torna-chat'));
      else document.getElementById('mascotte-btn')?.focus();
    }
    function silenzia(){salva('.silenzioso','1');if(spunta)spunta.checked=false;chiudiUtente();}
    function mostra(voce,manuale=false,{richiesto=false,tornaAllaChat=false}={}){
      if(!voce||(!richiesto&&occupato())||document.hidden||mascotte.hidden)return false;
      mascotte.dispatchEvent(new Event('assistente:prepara-spot'));chiudiNota(false);ritornaChat=tornaAllaChat;
      nota=h('section',{className:'msc-nota msc-spot',id:'msc-spot',tabIndex:0});nota.setAttribute('aria-label','Spot: '+voce.titolo);
      const chiudi=h('button',{type:'button',className:'msc-spot-x',textContent:'×'});chiudi.setAttribute('aria-label','Chiudi lo spot');chiudi.addEventListener('click',chiudiUtente);
      nota.append(h('small',{className:'msc-spot-etichetta',textContent:(voce.parodia?'PARODIA':'SPOT')+' · '+voce.titolo}),chiudi,h('h3',{textContent:voce.battuta||'Oh, già che sei qui… conosci '+voce.titolo+'?'}));
      if(voce.video){
        video=h('video',{className:'msc-spot-video',controls:true,playsInline:true,preload:'none',muted:!manuale,src:BASE+voce.video,poster:voce.poster?BASE+voce.poster:''});
        video.setAttribute('aria-label','Spot di '+voce.titolo);video.setAttribute('aria-describedby','msc-spot-descrizione');
        video.addEventListener('ended',()=>{delete mascotte.dataset.spotVideo;});
        nota.append(video);
      }
      nota.append(h('p',{id:'msc-spot-descrizione',textContent:voce.testo}));
      if(voce.url)nota.append(h('a',{className:'msc-spot-link',href:voce.url,target:'_blank',rel:'noopener noreferrer',textContent:'Scopri '+voce.titolo+' su GitHub'}));
      if(tornaAllaChat){const torna=h('button',{type:'button',className:'msc-spot-torna',textContent:'Torna alla chat'});torna.addEventListener('click',chiudiUtente);nota.append(torna);}
      const silenzioso=h('button',{type:'button',className:'msc-spot-silenzia',textContent:'Non mostrare spot'});silenzioso.addEventListener('click',silenzia);nota.append(silenzioso);
      nota.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();chiudiUtente();}});
      mascotte.dataset.spotVisibile='true';mascotte.append(nota);
      if(video){mascotte.dataset.spotVideo='true';video.play().catch(()=>{delete mascotte.dataset.spotVideo;});}
      if(manuale)nota.focus({preventScroll:true});
      if(!manuale){salva('.prossimo',String(Date.now()+INTERVALLO+Math.floor(Math.random()*30000)));salva('.ultimo',voce.id);}
      function scadenza(){if((video&&!video.paused&&!video.ended)||nota?.matches(':hover')||nota?.contains(document.activeElement)){timer=setTimeout(scadenza,5000);return;}chiudiNota();}
      timer=setTimeout(scadenza,10000);return true;
    }
    mascotte.addEventListener('assistente:turno',e=>{
      const voce=scegli(lista,{ora:Date.now(),caricataIl,prossimo:Number(leggi('.prossimo'))||0,ultimoId:leggi('.ultimo'),occupato:occupato()||e.detail?.occupato,attesaMeteo:e.detail?.attesaMeteo,nascosto:document.hidden||mascotte.hidden,silenzioso:leggi('.silenzioso')==='1'});
      if(voce&&mostra(voce))e.preventDefault();
    });
    mascotte.addEventListener('assistente:chiudi-note',()=>chiudiNota(false));
    new MutationObserver(()=>{if(mascotte.hidden||mascotte.dataset.aperta==='true')chiudiNota(false);}).observe(mascotte,{attributes:true,attributeFilter:['hidden','data-aperta']});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)chiudiNota();});
    const controlli=document.querySelector('.appearance-controls');let spunta=null;
    if(controlli){spunta=h('input',{type:'checkbox',checked:leggi('.silenzioso')!=='1',id:'aspetto-spot'});controlli.append(h('label',{className:'appearance-check',htmlFor:'aspetto-spot'},spunta,' Mostra ogni tanto gli spot dell’assistente'));spunta.addEventListener('change',()=>{salva('.silenzioso',spunta.checked?'0':'1');chiudiNota();});}
    api.disponibili=()=>lista.length;
    api.prova=id=>mostra(lista.find(v=>v.id===id)||lista[0],true,{richiesto:true});
    api.avviaSpot=(id=null)=>{
      if(document.hidden||mascotte.hidden)return false;
      const ora=Date.now(),attivi=spotRiproducibili(lista,ora);
      if(!attivi.length)return false;
      const candidati=id?attivi.filter(v=>v.id===id):attivi.length>1?attivi.filter(v=>v.id!==leggi('.ultimo')):attivi;
      if(!candidati.length)return false;
      const voce=candidati[Math.floor(Math.random()*candidati.length)];
      salva('.ultimo',voce.id);salva('.prossimo',String(ora+INTERVALLO+Math.floor(Math.random()*30000)));
      const tornaAllaChat=mascotte.dataset.aperta==='true';
      if(tornaAllaChat)mascotte.dispatchEvent(new Event('assistente:chiudi-chat-spot'));
      return mostra(voce,true,{richiesto:true,tornaAllaChat});
    };
    api.avviaCasuale=()=>api.avviaSpot();
    const caricamento=fetch(BASE+'/api/spot-assistente',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)})
      .then(async r=>{if(!r.ok)return false;lista=normalizza(await r.json());document.dispatchEvent(new Event('assistente:spot-pronti'));return true;})
      .catch(()=>false);
    api.elencoSpot=async()=>await caricamento ? spotRiproducibili(lista,Date.now()).map(({id,titolo})=>({id,titolo})) : null;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',avvia);else avvia();return api;
});
