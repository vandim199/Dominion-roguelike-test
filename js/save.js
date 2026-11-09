"use strict";
/* ==========================================================
   Spellkeep — automatic saving, in localStorage.
   The run is saved whenever the game waits for you and at each
   stop between fights. Randomness is seeded and its state is
   saved with the run, so a reload can't reroll anything. The
   save is deleted when the run ends.
   ========================================================== */
const SAVE_KEY = slotKey('spellkeep.save');
const SAVE_VERSION = 1;
const SAVE = { armed:false, timer:0 };        // armed once a run is started or continued

function saveNow(){
  if(!SAVE.armed||!G||G.over) return;
  clearTimeout(SAVE.timer); SAVE.timer=0;
  try{ localStorage.setItem(SAVE_KEY,JSON.stringify({v:SAVE_VERSION,G,ledger:LEDGER,uid})); }catch(e){}
}
function deleteSave(){ clearTimeout(SAVE.timer); SAVE.timer=0; try{ localStorage.removeItem(SAVE_KEY); }catch(e){} }
function readSave(){
  try{ const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
    return s&&s.v===SAVE_VERSION&&s.G&&!s.G.over ? s : null; }catch(e){ return null; }
}
function saveSummary(){
  const s=readSave(); if(!s) return null;
  const g=s.G, f=g.fight;
  return `Circle ${Math.floor(f/TUNE.fightsPerCircle)+1}, fight ${f%TUNE.fightsPerCircle+1}/3 · ❤ ${g.hearts} · ${ARC} ${fmt(g.arcana)}`;
}
function loadGame(){
  const s=readSave(); if(!s) return false;
  try{
    const g=s.G;
    const cards=[...g.deck,...g.hand,...g.discard,...g.inPlay,...g.runes,...g.exhausted,...g.trash,...g.market.filter(Boolean)];
    if(cards.some(c=>!DB[c.key])) throw new Error('unknown card');
    G=g; uid=s.uid; busy=false;
    LEDGER.length=0; LEDGER.push(...s.ledger);
    const l=$('log'); l.innerHTML='';
    for(const [m,cls] of LEDGER.slice(-200)) addLogLine(m,cls);
    return true;
  }catch(e){ deleteSave(); return false; }
}
addEventListener('pagehide',()=>{ if(G&&!busy&&G.phase==='turn') saveNow(); });
document.addEventListener('visibilitychange',()=>{ if(document.hidden&&G&&!busy&&G.phase==='turn') saveNow(); });
