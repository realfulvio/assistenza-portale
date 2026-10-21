/* Pagina Link utili: usa la navigazione e l'assistente esistenti. */
(() => {
 'use strict';
 const area=document.getElementById('link-utili');if(!area)return;
 area.querySelectorAll('.useful-item').forEach(e=>{e.style.setProperty('--i',e.dataset.order);e.style.setProperty('--brand',e.dataset.brand);e.querySelector('.useful-link').style.setProperty('--brand',e.dataset.brand);});
 area.querySelectorAll('.useful-link').forEach(a=>a.addEventListener('pointermove',e=>{const r=a.getBoundingClientRect();a.style.setProperty('--mx',e.clientX-r.left+'px');a.style.setProperty('--my',e.clientY-r.top+'px');}));
 function init(){
  const root=document.getElementById('mascotte'),actor=document.getElementById('mascotte-btn');
  if(!root||!actor)return;
  const svg=actor.querySelector('.msc-svg'),face=svg.querySelector('.msc-testa'),mug=svg.querySelector('.msc-tazza');
  if(!svg||!face||!mug)return;
  const ns='http://www.w3.org/2000/svg',arms=document.createElementNS(ns,'g');arms.setAttribute('class','dab-arm');
  for(const side of ['right','left']){
   for(const cls of ['dab-sleeve-border','dab-sleeve']){const p=document.createElementNS(ns,'path');p.setAttribute('class','dab-'+side+' '+cls);arms.append(p);}
   const hand=document.createElementNS(ns,'circle');hand.setAttribute('class','dab-hand dab-hand-'+side);hand.setAttribute('r','5');arms.append(hand);
  }
  svg.append(arms);
  const speech=document.createElement('div');speech.className='dab-speech';speech.hidden=true;
  speech.innerHTML='<strong>Il tuo assistente</strong><button type="button" class="dab-close" aria-label="Chiudi il saluto dell’assistente">×</button><p role="status" aria-live="polite"></p>';
  root.append(speech);
  const left=arms.querySelectorAll('.dab-left'),right=arms.querySelectorAll('.dab-right'),leftHand=arms.querySelector('.dab-hand-left'),rightHand=arms.querySelector('.dab-hand-right');
  let frame=0,timer=0,delay=0;
  const reduced=()=>document.documentElement.dataset.motion==='reduce'||(document.documentElement.dataset.motion!=='full'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  const lerp=(a,b,t)=>a+(b-a)*t;
  function reset(){cancelAnimationFrame(frame);root.dataset.dancing='false';face.style.removeProperty('transform');mug.style.removeProperty('opacity');}
  function close(){clearTimeout(timer);clearTimeout(delay);reset();speech.hidden=true;delete root.dataset.linkSaluto;}
  function pose(t){
   const l=[36,88,lerp(29,16,t),lerp(103,55,t),lerp(35,61,t),lerp(109,45,t)],r=[84,88,lerp(91,106,t),lerp(99,59,t),lerp(94,128,t),lerp(108,29,t)];
   for(const [paths,p] of [[left,l],[right,r]])for(const path of paths)path.setAttribute('d',`M${p[0]} ${p[1]} L${p[2]} ${p[3]} L${p[4]} ${p[5]}`);
   for(const [hand,p]of [[leftHand,l],[rightHand,r]]){hand.setAttribute('cx',p[4]);hand.setAttribute('cy',p[5]);}
   face.style.transform=`rotate(${-24*t}deg) translate(${-2*t}px,${4*t}px)`;mug.style.opacity=String(1-t);
  }
  function dance(){
   reset();if(reduced())return;
   root.dataset.dancing='true';const start=performance.now(),keys=[[0,0],[.18,0],[.34,1],[.44,1],[.51,.72],[.59,1],[.76,1],[1,0]];
   function draw(now){const p=Math.min(1,(now-start)/2700),n=Math.max(0,keys.findIndex((k,j)=>j<keys.length-1&&p>=k[0]&&p<=keys[j+1][0])),a=keys[n],b=keys[n+1],x=(p-a[0])/(b[0]-a[0]);pose(lerp(a[1],b[1],x*x*(3-2*x)));if(p<1)frame=requestAnimationFrame(draw);else reset();}
   frame=requestAnimationFrame(draw);
  }
  function show(){
   close();if(root.hidden||root.dataset.aperta==='true'||document.getElementById('v-link-utili').hidden)return;
   root.dataset.linkSaluto='true';speech.hidden=false;speech.querySelector('[role=status]').textContent='Ecco i link utili: tutti i servizi a portata di clic!';dance();timer=setTimeout(close,10000);
  }
  speech.querySelector('button').addEventListener('click',close);
  actor.addEventListener('click',close,{capture:true});
  new MutationObserver(()=>{if(root.hidden||root.dataset.aperta==='true')close();}).observe(root,{attributes:true,attributeFilter:['hidden','data-aperta']});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)close();});
  document.addEventListener('portale:vista',e=>{close();area.classList.remove('visible');if(e.detail.vista==='link-utili'){requestAnimationFrame(()=>requestAnimationFrame(()=>area.classList.add('visible')));delay=setTimeout(show,180);}});
  document.getElementById('n-link-utili').addEventListener('click',()=>{if(location.hash==='#link-utili'&&!document.getElementById('v-link-utili').hidden)show();});
  if(!document.getElementById('v-link-utili').hidden){area.classList.add('visible');delay=setTimeout(show,180);}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
