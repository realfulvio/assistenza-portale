// Disegno della mascotte. I raccordi seguono le trasformazioni SVG di testa, busto e tazza.
(() => {
  'use strict';
  window.MovimentoMascotte = function (mascotte) {
    const svg=mascotte.querySelector('.msc-svg');
    const testa=svg.querySelector('.msc-testa');
    const busto=svg.querySelector('.msc-busto');
    const tazza=svg.querySelector('.msc-tazza');
    const camicia=busto.querySelector('.msc-camicia');
    const sedeTazza=tazza.parentNode;
    const ns='http://www.w3.org/2000/svg';
    function elemento(tag,classe){
      const nodo=document.createElementNS(ns,tag);
      if(classe)nodo.setAttribute('class',classe);
      return nodo;
    }
    const presa=elemento('g','msc-presa-tazza');
    function tratto(gruppo,classe,d){
      const nodo=elemento('path',classe);
      nodo.setAttribute('d',d);
      gruppo.append(nodo);
      return nodo;
    }
    const occhiRisata=elemento('g','msc-occhi-risata');
    tratto(occhiRisata,'msc-linea-occhi','M43 48q5.5-5.2 11 0m12 0q5.5-5.2 11 0');
    testa.querySelector('.msc-occhiali').before(occhiRisata);
    const sorriso=elemento('g','msc-sorriso');
    tratto(sorriso,'msc-linea-sorriso','M52.5 69q7.5 6 15 0');
    testa.append(sorriso);
    const boccaSorpresa=elemento('g','msc-bocca-sorpresa');
    tratto(boccaSorpresa,'msc-bocca-sorpresa-interno','M54 70c0-4.2 2.7-6.3 6-6.3s6 2.1 6 6.3-2.7 7.2-6 7.2-6-3-6-7.2z');
    tratto(boccaSorpresa,'msc-bocca-sorpresa-luce','M56.7 73.6q3.3-2.1 6.6 0-1.2 1.8-3.3 1.8t-3.3-1.8z');
    testa.append(boccaSorpresa);
    const vapore=elemento('g','msc-vapore-raccordato');
    for(const scia of tazza.querySelectorAll('.msc-vapore'))vapore.append(scia);
    tazza.prepend(vapore);
    const disegnoTazza=elemento('g','msc-tazza-rifinita');
    tratto(disegnoTazza,'msc-manico','M93 87.5h3a4.2 4.2 0 0 1 0 8.4h-3');
    tratto(disegnoTazza,'msc-mug msc-corpo-tazza','M75 83.5h19l-1.4 14q-.4 4-4.3 4H81q-3.9 0-4.4-4z');
    tratto(disegnoTazza,'msc-bordo-tazza','M75 83.5c0-1.65 4.3-3 9.5-3s9.5 1.35 9.5 3-4.3 3-9.5 3-9.5-1.35-9.5-3z');
    tratto(disegnoTazza,'msc-caffe','M78 84.2c1.4-1.3 4.1-1.65 6.5-1.65s5.1.35 6.5 1.65q-2.4 1.65-6.5 1.65T78 84.2z');
    tratto(disegnoTazza,'msc-riflesso-tazza','M79 88l.7 7.1q.2 1.2.8 1.8');
    tratto(presa,'msc-presa-pelle','M95.1 101.1c-1.5-1.7-2.7-3.4-3.1-5.2l-1.1-4.4c-.25-1 .35-1.8 1.2-1.85.75-.05 1.25.4 1.55 1.1l.8 2.2.6-2.75c.22-.95.8-1.5 1.54-1.37.76.12 1.08.76 1.02 1.48l-.09 1.02c.65-.68 1.8-.29 1.89.64l.1.8c.76-.45 1.72.14 1.72 1.12l-.05 3.2c-.05 2.4-1.25 4.15-2.84 5.31z');
    tratto(presa,'msc-presa-dettagli','M96.06 91.88l-.38 2.54m2.15-1.72-.33 2.32m2.02-1.44-.21 1.9m-6.22-1.74q.48 1.05 1.46 1.5');
    disegnoTazza.append(presa);
    tazza.append(disegnoTazza);
    const collo=elemento('path','msc-raccordo-collo');
    const ombraCollo=elemento('path','msc-ombra-collo');
    camicia.after(collo,ombraCollo);
    const primoPiano=elemento('g','msc-raccordi');
    primoPiano.setAttribute('clip-path',sedeTazza.getAttribute('clip-path'));
    testa.after(primoPiano);
    const bordo=elemento('path','msc-raccordo-manica');
    const manica=elemento('path','msc-raccordo-tessuto');
    const polsino=elemento('path','msc-raccordo-cuffia');
    primoPiano.append(bordo,manica,polsino);
    camicia.setAttribute('d','M18 124V114q0 -28 26 -32l16 9l16 -9q26 4 26 32v10z');
    primoPiano.append(tazza);
    mascotte.classList.add('msc-rifinita');
    let fotogramma=0, ultimoRaccordo=-Infinity;
    const preferenza=matchMedia('(prefers-reduced-motion: reduce)');
    function animato(){
      const modo=document.documentElement.dataset.motion;
      return modo!=='reduce'&&(modo==='full'||!preferenza.matches);
    }
    function raccorda(ora=performance.now()){
      fotogramma=0;
      if(!document.hidden&&!mascotte.hidden&&ora-ultimoRaccordo>=25){
        ultimoRaccordo=ora;
        const base=svg.getCTM();
        const a=testa.getCTM(),b=busto.getCTM(),c=tazza.getCTM();
        if(base&&a&&b&&c){
          const inversa=base.inverse();
          const punto=(m,x,y)=>new DOMPoint(x,y).matrixTransform(inversa.multiply(m));
          const pos=({x,y})=>x.toFixed(2)+' '+y.toFixed(2);
          // Collo sopra la camicia e sotto le punte del colletto, nel sistema del busto.
          const mandibola=b.inverse().multiply(a);
          const colloPunto=(x,y)=>pos(new DOMPoint(x,y).matrixTransform(mandibola));
          collo.setAttribute('d','M'+colloPunto(51,67)+' Q'+colloPunto(60,70)+' '+colloPunto(69,67)
            +' C'+colloPunto(68,74)+' 66.8 80 68.4 83.8 Q60 94 51.6 83.8 C53.2 80 '+colloPunto(52,74)+' '+colloPunto(51,67)+'Z');
          ombraCollo.setAttribute('d','M'+colloPunto(51.4,70)+' Q'+colloPunto(60,75)+' '+colloPunto(68.6,70)
            +' L'+colloPunto(68,73.6)+' Q'+colloPunto(60,79)+' '+colloPunto(52,73.6)+'Z');
          // La spalla segue il busto, il polsino segue la mano già solidale alla tazza.
          const spalla=punto(b,81,88),mano=punto(c,97.1,101);
          const gomito=punto(b,96,105);
          const polso={x:mano.x+(gomito.x-mano.x)*.10,y:mano.y+(gomito.y-mano.y)*.10};
          const curva='M'+pos(spalla)+' Q'+pos(gomito)+' '+pos(polso);
          bordo.setAttribute('d',curva);manica.setAttribute('d',curva);
          const prima={x:mano.x+(gomito.x-mano.x)*.29,y:mano.y+(gomito.y-mano.y)*.29};
          polsino.setAttribute('d','M'+pos(prima)+' L'+pos(polso));
        }
      }
      if(!document.hidden&&!mascotte.hidden&&animato())fotogramma=requestAnimationFrame(raccorda);
    }
    function aggiorna(){
      cancelAnimationFrame(fotogramma);
      ultimoRaccordo=-Infinity;
      raccorda();
    }
    const osserva=new MutationObserver(aggiorna);
    osserva.observe(mascotte,{attributes:true,attributeFilter:['hidden','data-aperta']});
    osserva.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});
    preferenza.addEventListener('change',aggiorna);
    document.addEventListener('visibilitychange',aggiorna);
    window.addEventListener('resize',aggiorna);
    aggiorna();
  };
})();
