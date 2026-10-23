"use strict";
/* ==========================================================
   Coinkeep — automatic saving, in localStorage.
   The run is saved whenever the game is waiting for you (and
   at the two stops between waves), so closing the page loses
   nothing. Randomness is seeded and its state saved with the
   run, so reloading replays exactly what would have happened:
   there is nothing to reroll. When the town falls the save is
   deleted.
   ========================================================== */
const SAVE_KEY = slotKey('coinkeep.save');         // each published version has its own (game.js, SLOT)
const SAVE_VERSION = 2;                        // 2: Mult, charm editions and counters, bribes
const SAVE = { armed:false, timer:0 };        // armed once a run is started or continued from the title screen

function saveNow(){
  if(!SAVE.armed||!G||G.over) return;
  clearTimeout(SAVE.timer); SAVE.timer=0;
  try{ localStorage.setItem(SAVE_KEY,JSON.stringify({v:SAVE_VERSION,G,ledger:LEDGER,uid,tid})); }catch(e){}
}
// Called after every render: saves a moment later, once the game is idle.
function scheduleSave(){
  if(!SAVE.armed||!G||G.over||busy||G.phase!=='turn') return;
  clearTimeout(SAVE.timer); SAVE.timer=setTimeout(()=>{ if(!busy&&G.phase==='turn') saveNow(); },400);
}
function deleteSave(){ clearTimeout(SAVE.timer); SAVE.timer=0; try{ localStorage.removeItem(SAVE_KEY); }catch(e){} }

function readSave(){
  try{ const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
    return s&&s.v===SAVE_VERSION&&s.G&&!s.G.over ? s : null; }catch(e){ return null; }
}
// What the title screen says about a saved run, or null.
function saveSummary(){
  const s=readSave(); if(!s) return null;
  const mode={merge:'',splice:'Splice · ',classic:'Classic · '}[s.G.mode]||'';
  return `${mode}Wave ${s.G.wave}, turn ${s.G.turnInWave}${s.G.hearts!=null&&s.G.mode!=='classic'?` · ❤ ${s.G.hearts}`:''}`;
}

// Put a saved run back. Functions don't survive JSON: threats get their descriptions back from THREATS,
// and merge mode's fused cards get their card definitions rebuilt from their keys.
function loadGame(){
  const s=readSave(); if(!s) return false;
  try{
    const g=s.G;
    for(const t of [...g.slots,...g.queue]) if(t) t.desc=THREATS[t.key].desc;
    const cards=[...g.deck,...g.hand,...g.discard,...g.inPlay,...g.trash,...g.market.filter(Boolean)];
    for(const c of cards) if(!DB[c.key]&&typeof ensureFusion==='function') ensureFusion(c.key);
    if(cards.some(c=>!DB[c.key])) throw new Error('unknown card');
    g.acting=0;
    G=g; uid=s.uid; tid=s.tid; busy=false;
    LEDGER.length=0; LEDGER.push(...s.ledger);
    const l=$('log'); l.innerHTML='';
    for(const [m,cls] of LEDGER.slice(-200)){ const d=document.createElement('div'); if(cls) d.className=cls; d.textContent=m; l.appendChild(d); }
    l.scrollTop=l.scrollHeight;
    return true;
  }catch(e){ deleteSave(); return false; }
}

addEventListener('pagehide',()=>{ if(G&&!busy&&G.phase==='turn') saveNow(); });
document.addEventListener('visibilitychange',()=>{ if(document.hidden&&G&&!busy&&G.phase==='turn') saveNow(); });
