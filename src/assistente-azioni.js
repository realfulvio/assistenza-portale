// Azioni proposte soltanto per una risposta di assistenza con una guida pertinente.
function aggiungiAzioni(out,base){
 if(out.tipo!=='chat'||!(out.fonti||[]).some(f=>f.url?.startsWith(base+'/#faq/')))return out;
 out.opzioni=[...(out.opzioni||[]),{testo:'Non ho risolto',azione:'non_risolto'},{testo:'Prepara la richiesta',azione:'ticket_contesto'}];return out;
}
module.exports={aggiungiAzioni};
