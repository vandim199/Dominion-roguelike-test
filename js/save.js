"use strict";
/* ==========================================================
   Coinkeep: Forays. Automatic saving in localStorage, one slot per published version.
   The profile and any trip in progress are saved after every action. Losing a trip never touches
   the profile. JSON turns NaN and Infinity into null, so everything is checked on load:
   a bad trip is dropped, and a bad profile number becomes 0 rather than a stuck game.
   ========================================================== */
const SAVE_KEY = slotKey('coinkeep.forays');

function saveGame(P,T){ try{ localStorage.setItem(SAVE_KEY,JSON.stringify({v:1,P,T:T||null})); }catch(e){} }
function clearSave(){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} }
function readSave(){
  try{
    const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
    if(!s||s.v!==1||!s.P||!Array.isArray(s.P.cards)||!s.P.cards.length) return null;
    const P=s.P;
    for(const k of ['coin','deepest','wheel','hearth','mag','ledger','slots','energy','hand','nid','trips','defeats','secs']) if(!Number.isFinite(P[k])) P[k]=(k==='wheel'||k==='nid'||k==='slots'||k==='energy'||k==='hand')?({wheel:1,nid:9999,slots:2,energy:3,hand:5})[k]:0;
    P.cards=P.cards.filter(c=>c&&CARDS[c.key]&&Number.isFinite(c.lvl)&&Number.isFinite(c.id));
    if(!Array.isArray(P.layout)) P.layout=[];
    let T=s.T||null;
    if(T){ const ok=Number.isFinite(T.hp)&&Number.isFinite(T.coin)&&Number.isFinite(T.f)&&Array.isArray(T.board)&&T.board.every(b=>Number.isFinite(b.hp))&&(!T.F||Number.isFinite(T.F.enemy.hp)); if(!ok) T=null; else T.ev=[]; }
    return {P,T};
  }catch(e){ return null; }
}
