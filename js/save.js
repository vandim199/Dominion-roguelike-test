"use strict";
/* ==========================================================
   Coinkeep: Forays. Saving, in localStorage. The profile and
   any trip in progress are saved after every action. Losing
   never deletes anything. Numbers are checked on the way out
   and on the way in: JSON turns Infinity and NaN into null.
   ========================================================== */
const SAVE_KEY = slotKey('coinkeep.forays');
const SAVE_VERSION = 2;
const SAVE = {timer:0};

function cleanNums(o){
  if(Array.isArray(o)){ o.forEach((v,i)=>{ if(v&&typeof v==='object') cleanNums(v); else if(typeof v==='number'&&!Number.isFinite(v)) o[i]=v>0?1e300:0; }); return o; }
  for(const k in o){ const v=o[k]; if(v&&typeof v==='object') cleanNums(v); else if(typeof v==='number'&&!Number.isFinite(v)) o[k]=v>0?1e300:0; }
  return o;
}
function saveNow(P,T){
  clearTimeout(SAVE.timer); SAVE.timer=0;
  try{ const t=T?Object.assign({},T,{ev:[]}):null; localStorage.setItem(SAVE_KEY,JSON.stringify(cleanNums({v:SAVE_VERSION,P,T:t}))); }catch(e){}
}
function scheduleSave(P,T){ clearTimeout(SAVE.timer); SAVE.timer=setTimeout(()=>saveNow(P,T),250); }
function wipeSave(){ clearTimeout(SAVE.timer); SAVE.timer=0; try{ localStorage.removeItem(SAVE_KEY); }catch(e){} }

// A profile needs these to be whole. Anything else broken falls back to its starting value.
function saneProfile(p){
  const fresh=newProfile(p&&p.seed||Date.now()&0xffffff);
  if(!p||typeof p!=='object') return fresh;
  for(const k in fresh) if(p[k]==null||typeof p[k]!==typeof fresh[k]) p[k]=fresh[k];
  for(const k of ['coin','crests','deepest','beaten','trips','defeats']) if(!Number.isFinite(p[k])||p[k]<0) p[k]=0;
  for(const k in TRACKS) if(!Number.isFinite(p.lv[k])||p.lv[k]<0) p.lv[k]=0;
  p.layout=p.layout.filter(k=>k==null||(BASTIONS[k]&&p.bases[k])); fixLayout(p);
  return p;
}
function loadSave(){
  try{ const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
    if(!s||s.v!==SAVE_VERSION) return null;
    const P=saneProfile(s.P); let T=s.T;
    if(T&&!(T.enemy&&Array.isArray(T.board)&&Array.isArray(T.hand)&&Number.isFinite(T.hp)&&Number.isFinite(T.enemy.hp))) T=null;
    if(T) T.ev=[];
    return {P,T};
  }catch(e){ return null; }
}
