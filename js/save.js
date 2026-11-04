"use strict";
/* ==========================================================
   Coinkeep: Forays (tap the deck). Automatic saving in localStorage, one slot per published version.
   This has its own key, so a save from the older card-playing rules is left alone.
   The profile and any trip in progress are saved every few seconds and after every fight. Losing a trip never touches
   the profile. JSON turns NaN and Infinity into null, so everything is checked on load:
   a bad trip is dropped, and a bad profile number becomes 0 rather than a stuck game.
   ========================================================== */
const SAVE_KEY = slotKey('coinkeep.tapdeck');

function saveGame(P,T){ try{ localStorage.setItem(SAVE_KEY,JSON.stringify({v:2,P,T:T||null})); }catch(e){} }
function clearSave(){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} }
function readSave(){
  try{
    const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
    if(!s||s.v!==2||!s.P||!Array.isArray(s.P.cards)||!s.P.cards.length) return null;
    const P=s.P, dflt={wheel:1,nid:9999,slots:TUNE.startBoard.length,comboCap:TUNE.comboCap,crit:TUNE.critChance,shuffleX:1};
    for(const k of ['coin','deepest','wheel','hearth','auto','ledger','slots','nid','trips','defeats','secs','comboCap','crit','shuffleX']) if(!Number.isFinite(P[k])) P[k]=dflt[k]||0;
    P.cards=P.cards.filter(c=>c&&CARDS[c.key]&&Number.isFinite(c.lvl)&&Number.isFinite(c.id));
    for(const c of P.cards) c.sock=(c.sock||[]).filter(k=>PERKS[k]&&perkFits(k,c));   // a perk the card can no longer take gives its socket back
    if(!Array.isArray(P.layout)) P.layout=[];
    let T=s.T||null;
    if(T){ const ok=Number.isFinite(T.hp)&&Number.isFinite(T.coin)&&Number.isFinite(T.f)&&Array.isArray(T.board)&&T.board.every(b=>Number.isFinite(b.hp))&&Array.isArray(T.draw)&&Array.isArray(T.disc)&&(!T.F||Number.isFinite(T.F.enemy.hp));
      if(!ok) T=null; else { T.ev=[]; T.pumping=false; if(T.F) T.F.live=false; } }   // a resumed fight waits for your first tap
    return {P,T};
  }catch(e){ return null; }
}
