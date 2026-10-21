/* Sottovoci: tendina al mouse e al focus; sempre accessibili sui dispositivi touch. */
(() => {
 const area=document.getElementById('link-utili');
 if(!area)return;
 const fine=matchMedia('(min-width: 601px) and (hover: hover) and (pointer: fine)');
 const states=[];
 area.querySelectorAll('.has-resources').forEach(card=>{
  const drawer=card.querySelector('.resources-drawer'),header=card.querySelector('.useful-link');
  const button=header.tagName==='BUTTON'?header:null;
  let hovered=false,suppressed=false,timer=0;
  function update(){
   const open=!fine.matches||(!suppressed&&(hovered||card.contains(document.activeElement)));
   card.dataset.resourcesOpen=String(open);
   drawer.inert=!open;
   if(button)button.setAttribute('aria-expanded',String(open));
  }
  card.addEventListener('pointerenter',()=>{if(!fine.matches)return;clearTimeout(timer);hovered=true;suppressed=false;timer=setTimeout(update,55);});
  card.addEventListener('pointerleave',()=>{if(!fine.matches)return;clearTimeout(timer);hovered=false;timer=setTimeout(update,140);});
  card.addEventListener('focusin',()=>{clearTimeout(timer);suppressed=false;update();});
  card.addEventListener('focusout',()=>queueMicrotask(update));
  document.addEventListener('keydown',e=>{
   if(e.key!=='Escape'||!fine.matches||card.dataset.resourcesOpen!=='true')return;
   e.preventDefault();clearTimeout(timer);
   if(drawer.contains(document.activeElement))header.focus({preventScroll:true});
   suppressed=true;update();
  });
  if(button)button.addEventListener('click',()=>{suppressed=false;update();});
  states.push(update);update();
 });
 area.classList.add('resources-ready');
 fine.addEventListener('change',()=>states.forEach(update=>update()));
})();
