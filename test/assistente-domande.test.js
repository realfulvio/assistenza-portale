const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {creaServizio} = require('../src/assistente');

function ambiente() {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'domande-assistente-'));
  const scrivi=(nome,dati)=>{const p=path.join(dir,nome);fs.writeFileSync(p,JSON.stringify(dati));return p;};
  const chiamate=[];
  const servizio=creaServizio({config:{base:'/assistenza',categorie:{categorie:[]},ente:{},
    faqPath:scrivi('faq.json',[]),assistenteSchedePath:scrivi('schede.json',{schede:[]}),assistenteFontiPath:scrivi('fonti.json',{fonti:[]})},
    cacheFile:path.join(dir,'indice.json'),
    numeriInterni:{carica:()=>({sezioni:[{titolo:'Esempio',voci:[{nome:'Sportello',numero:'230'}]}]})},
    chiamaAI:async(endpoint,body)=>{
      chiamate.push({endpoint,body});
      // Documenti e domanda ortogonali: nessuna fonte supera la soglia di pertinenza.
      return endpoint==='/api/embed'?{embeddings:body.input.map(t=>t.startsWith('Nel portale')?[0,1]:[1,0])}:{message:{content:'Che cosa vorresti fare?'}};
    }});
  const req={sessionID:'isolata',session:{},body:{}};
  return {chiamate,req,servizio,invia:async testo=>{req.body={testo};return servizio.gestisci(req);},pulisci:()=>fs.rmSync(dir,{recursive:true,force:true})};
}

for(const domanda of ['Come faccio una foto a quello che vedo sullo schermo?','Ciao','Boh, non so come spiegarmi']) {
  test(`Qwen riceve anche la domanda senza parole chiave: ${domanda}`,async()=>{
    const a=ambiente();try{
      const out=await a.invia(domanda);
      assert.equal(out.tipo,'chat');
      const chat=a.chiamate.find(c=>c.endpoint==='/api/chat');
      assert.ok(chat,'La domanda deve arrivare al modello');
      assert.ok(chat.body.messages.some(m=>m.role==='user'&&m.content.includes(domanda)));
      assert.deepEqual(out.fonti,[]);
      assert.equal(chat.body.think,false);
      assert.equal(chat.body.options.num_predict,240);
    }finally{a.pulisci();}
  });
}

test('senza guide pertinenti il modello riceve un compito di chiarimento senza procedure inventate',async()=>{
  const a=ambiente();try{
    await a.invia('Non so spiegarmi');
    const chat=a.chiamate.find(c=>c.endpoint==='/api/chat');
    assert.ok(chat);
    assert.match(chat.body.messages[0].content,/nessuna (?:guida|fonte).*pertinente/i);
    assert.match(chat.body.messages[0].content,/chiedi.*(?:dettaglio|chiarimento)/i);
  }finally{a.pulisci();}
});

test('il seguito colloquiale arriva a Qwen con il messaggio precedente',async()=>{
  const a=ambiente();try{
    await a.invia('Come faccio una foto a quello che vedo sullo schermo?');
    await a.invia('Intendo senza usare il cellulare');
    const chats=a.chiamate.filter(c=>c.endpoint==='/api/chat');assert.equal(chats.length,2);
    const contenuto=chats[1].body.messages.map(m=>m.content).join('\n');
    assert.match(contenuto,/foto a quello che vedo/);assert.match(contenuto,/senza usare il cellulare/);
  }finally{a.pulisci();}
});

test('interni, svago e blocco sui segreti restano disponibili senza chiamare Qwen',async()=>{
  const a=ambiente();try{
    assert.equal((await a.invia('Di chi è il 230?')).tipo,'contatti');
    assert.equal((await a.invia('Dimmi una freddura')).tipo,'svago');
    assert.match((await a.invia('Ti scrivo qui la password così controlli tu?')).risposta,/non inviare password/i);
    assert.equal(a.chiamate.length,0);
  }finally{a.pulisci();}
});

test('foto dello schermo in forma colloquiale e seguito mantengono la guida screenshot',()=>{
  const {piano}=require('../src/assistente-generazione');
  assert.deepEqual(piano(['Come faccio una foto a quello che vedo sullo schermo?']).guide,['screenshot-allegati']);
  assert.deepEqual(piano(['Come faccio una foto a quello che vedo sullo schermo?','Intendo senza usare il cellulare.']).guide,['screenshot-allegati']);
  assert.notEqual(piano(['Come faccio una foto a quello che vedo sullo schermo?','In Teams non sento niente dalle cuffie.']).tipo,'procedura');
});

test('aperture prive di un problema non recuperano guide tecniche casuali',()=>{
  const {piano}=require('../src/assistente-generazione');
  for(const q of ['Ciao','Boh, non so come spiegarmi','Mi serve una mano']) {
    const p=piano([q]);assert.ok(p);assert.equal(p.tipo,'chiarimento');assert.deepEqual(p.guide,[]);
  }
  assert.notEqual(piano(['Ciao, il computer è lento']).tipo,'chiarimento');
  assert.equal(piano(['Il computer è lento','Non so']).tipo,'assistenza');
});
