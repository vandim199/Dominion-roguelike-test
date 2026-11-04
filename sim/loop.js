#!/usr/bin/env node
"use strict";
/* The whole loop: a bot plays trips and spends at the Keep from a fresh profile to 1e15.
   node sim/loop.js [--seeds 5] [--fight thinker|fixed] [--spend careful|naive] [--m 5] [--to 1e15] [--trace] [--retreat 0.6] */
const D=require('../js/data.js'); Object.assign(globalThis,D);
const G=require('../js/game.js');
const B=require('./bots.js');
const {TUNE,BASTIONS,CARDS,WORKS,NUMCHK,fmt,deedPrice}=D;
const A=process.argv.slice(2); const opt=(k,d)=>{ const i=A.indexOf('--'+k); return i>=0?A[i+1]:d; }; const has=k=>A.includes('--'+k);
const SEC=15;

function score(P,deals){ const e=G.estPower(P,deals||2); return Math.log(Math.max(1,e.dmg))+.8*Math.log(Math.max(1,e.tough)); }
const clone=o=>JSON.parse(JSON.stringify(o));
function candidates(P){ const out=[]; const noDeed=candidates.noDeed;
  for(const k of Object.keys(P.lv)) if(G.canLevel(P,k)) out.push({t:'lv',k,price:G.levelPrice(P,k)});
  if(!noDeed&&P.coin>=deedPrice(G.deedCount(P))) out.push({t:'deed',price:deedPrice(G.deedCount(P))});
  if(P.own.deed>=2&&P.coin>=G.charterPrice(P)) out.push({t:'charter',price:G.charterPrice(P)});
  for(const k of P.offers) if(P.coin>=G.offerPrice(P,k)) out.push({t:'offer',k,price:G.offerPrice(P,k)});
  return out; }
function apply(P,c){ if(c.t==='lv') return G.buyLevel(P,c.k); if(c.t==='deed') return G.buyDeed(P); if(c.t==='charter') return G.buyCharter(P); if(c.t==='offer') return G.buyOffer(P,c.k); }
const WORK_ORDER=['energy','twin','hand','stores','foundry','magazine'];
function spendCrests(P){ for(const k of WORK_ORDER) if(P.crests>0&&!P.works[k]) G.buyWork(P,k); }
// Cheapest thing first. Takes what it can reach, never thinks about layout, buys levels and offers alike.
function spendNaive(P){ spendCrests(P); let n=0; for(;n<400;n++){ const c=candidates(P).sort((a,b)=>a.price-b.price)[0]; if(!c) break; apply(P,c); } G.fixLayout(P); }
// Best power per coin: tries each purchase on a copy and measures it. Tidies the board order by trial too.
function improveLayout(P){ G.fixLayout(P); let best=score(P,3);
  const spare=()=>Object.keys(P.bases).filter(k=>!P.layout.includes(k));
  for(let pass=0;pass<2;pass++) for(let i=0;i<P.layout.length;i++){
    for(let j=i+1;j<P.layout.length;j++){ const q=P.layout.slice(); [q[i],q[j]]=[q[j],q[i]]; const old=P.layout; P.layout=q; const s=score(P,3); if(s>best+1e-6){ best=s; } else P.layout=old; }
    for(const k of spare()){ const old=P.layout; const q=old.slice(); q[i]=k; P.layout=q; const s=score(P,3); if(s>best+1e-6){ best=s; } else P.layout=old; } }
}
function spendCareful(P){ spendCrests(P); let guard=0;
  while(guard++<60){ const cs=candidates(P); if(!cs.length) break; const s0=score(P); let bc=null, bv=0; const coin0=P.coin;
    const top=cs.sort((a,b)=>a.price-b.price).slice(0,22);
    for(const c of top){ const q=clone(P); apply(q,c); if(c.t==='offer'&&BASTIONS[c.k]) improveLayout(q); else if(c.t==='deed') improveQuick(q); const v=(score(q)-s0)/(c.price/Math.max(1,coin0)+.02); if(v>bv){ bv=v; bc=c; } }
    if(!bc) break; apply(P,bc); if(bc.t==='offer'||bc.t==='deed') improveLayout(P); }
  improveLayout(P);
}
// Careful, but a Bastion on offer always comes first while a slot stands empty.
function spendBoard(P){ spendCrests(P); G.fixLayout(P); for(const k of P.offers.slice()) if(BASTIONS[k]&&P.layout.includes(null)&&P.coin>=G.offerPrice(P,k)) G.buyOffer(P,k); spendCareful(P); }
function improveQuick(q){ G.fixLayout(q); const e=q.layout.indexOf(null); const spare=Object.keys(q.bases).filter(k=>!q.layout.includes(k)); if(e>=0&&spare.length) q.layout[e]=spare[0]; }

function tripOnce(P,cfg,rec){
  const pw0=G.estPower(P).dmg; const f=G.dropIn(P,pw0);
  const T=G.startTrip(P,{f,pw:pw0,seed:(P.seed*7+P.trips*13)|0}); T.ev=null;
  const R=B.mkR(P.seed+P.trips*101); let how=null, seen=0;
  while(!how){
    const eHp=T.enemy.max; const rNow=pw0*T.surge/eHp;
    if(T.phase==='turn') B.playFight(T,cfg.fight,R,cfg.m,40);
    const used=T.st.turns-seen; rec.done&&rec.done(T); seen=T.st.turns; rec.add(used,rNow,T.enemy.boss);
    if(T.phase==='lost'){ how='defeat'; break; }
    if(T.cache){ const o=T.cache; let i=o.findIndex(x=>x.t==='surge'); if(i<0&&T.hp<T.maxHp*.5) i=o.findIndex(x=>x.t==='mend'); if(i<0) i=o.findIndex(x=>x.t==='purse'); if(i<0) i=0; G.pickCache(T,i); }
    const rn=pw0*T.surge/G.fightHp(T.f+1); const boss=G.isBoss(T.f+1);
    if(boss&&(rn/TUNE.bossHp<cfg.retreat*1.3)&&T.f+1>P.beaten&&T.hp<T.maxHp*.8){ how='retreat'; break; }
    if(rn<cfg.retreat||(T.hp<T.maxHp*.35&&rn<1.2)){ how='retreat'; break; }
    G.nextFight(T);
  }
  const last=G.endTrip(P,T,how); if(P.keep.length){ G.keepSpoil(P,P.keep[0]); }
  return {how,T,last};
}
function runOne(seed,cfg){
  candidates.noDeed=!!cfg.nodeed;
  const P=G.newProfile(seed*1009+7); let sec=0, keepVisits=0; const bursts=[]; const marks={}; let turns=0; const bands={hi:0,mid:0,lo:0}; const trace=[]; let powPrev=G.estPower(P).dmg;
  const dmg={board:0,card:0,fires:0,wasted:0}; const rec={add(n,r){ sec+=n*SEC; turns+=n; if(r>=2) bands.hi+=n; else if(r>=1) bands.mid+=n; else bands.lo+=n; }};
  NUMCHK.bad=0; let safety=0; let topPow=powPrev; let lastBurst=0;
  const target=+cfg.to;
  while(topPow<target&&safety++<400&&sec<60*600){
    const r=tripOnce(P,cfg,rec); dmg.board+=r.T.st.baseDmg; dmg.card+=r.T.st.cardDmg; dmg.lastBoardShare=r.T.st.baseDmg/(r.T.st.baseDmg+r.T.st.cardDmg+1); dmg.fires+=r.T.st.fires; dmg.wasted+=r.T.st.wasted; dmg.turns=(dmg.turns||0)+r.T.st.turns;
    if(cfg.spend==='careful') spendCareful(P); else if(cfg.spend==='board') spendBoard(P); else spendNaive(P);
    const pow=G.estPower(P).dmg; const gain=pow/powPrev;
    if(gain>=2){ bursts.push((sec-lastBurst)/60); lastBurst=sec; }
    for(const m of [1e3,1e6,1e9,1e12,1e15]) if(pow>=m&&marks[m]==null) marks[m]=sec/60;
    if(cfg.trace) trace.push(`trip ${P.trips} ${r.how} f${r.T.startF}-${r.T.f} turns ${r.T.st.turns} min ${(sec/60).toFixed(1)} coin ${fmt(r.last.got)} power ${fmt(powPrev)}>${fmt(pow)} x${gain.toFixed(1)} deep ${P.deepest} slots ${G.slotCount(P)} deeds ${G.deedCount(P)} board ${P.layout.map(k=>k?k.slice(0,4):'-').join(',')} L[${P.lv.gun} ${P.lv.mason} ${P.lv.walls}] hp${(r.T.hp/r.T.maxHp*100).toFixed(0)}%`);
    powPrev=pow; topPow=Math.max(topPow,pow);
  }
  return {dmg,sec,bursts,marks,trips:P.trips,defeats:P.defeats,turns,bands,bad:NUMCHK.bad,trace,P,topPow,won:P.won};
}
function pct(a,p){ if(!a.length) return NaN; const s=a.slice().sort((x,y)=>x-y); return s[Math.min(s.length-1,Math.floor(p*s.length))]; }
function report(cfg,seeds){
  const runs=[]; for(let s=1;s<=seeds;s++){ const r=runOne(s,cfg); runs.push(r); if(cfg.trace&&s===1) console.log(r.trace.join('\n')); }
  const allB=runs.flatMap(r=>r.bursts); const med=m=>{ const a=runs.map(r=>r.marks[m]).filter(x=>x!=null); return a.length?pct(a,.5):null; };
  const tb=runs.reduce((o,r)=>{ o.hi+=r.bands.hi; o.mid+=r.bands.mid; o.lo+=r.bands.lo; return o; },{hi:0,mid:0,lo:0}); const tt=tb.hi+tb.mid+tb.lo;
  const o={fight:cfg.fight,spend:cfg.spend,seeds,
    burstMin:{median:+pct(allB,.5).toFixed(2),p10:+pct(allB,.1).toFixed(2),p90:+pct(allB,.9).toFixed(2),n:allB.length},
    minTo:{'1e3':med(1e3),'1e6':med(1e6),'1e9':med(1e9),'1e12':med(1e12),'1e15':med(1e15)},
    share:{'R>=2':+(tb.hi/tt*100).toFixed(0),'R1-2':+(tb.mid/tt*100).toFixed(0),'R<1':+(tb.lo/tt*100).toFixed(0)},
    trips:pct(runs.map(r=>r.trips),.5),defeats:pct(runs.map(r=>r.defeats),.5),turns:pct(runs.map(r=>r.turns),.5),nonFinite:runs.reduce((a,r)=>a+r.bad,0),reached1e15:runs.filter(r=>r.topPow>=1e15).length,won:runs.filter(r=>r.won).length,
    deepest:pct(runs.map(r=>r.P.deepest),.5),boardShareLastTrip:+pct(runs.map(r=>r.dmg.lastBoardShare),.5).toFixed(2),firesPerTurn:+pct(runs.map(r=>r.dmg.fires/r.dmg.turns),.5).toFixed(2),wastedPerTurn:+pct(runs.map(r=>r.dmg.wasted/r.dmg.turns),.5).toFixed(2),finalBoard:runs[0].P.layout.join(','),lastDeck:Object.entries(runs[0].P.own).filter(e=>e[1]).map(e=>e[0]+e[1]).join(' ')};
  return o;
}
if(require.main===module){
  const cfg={fight:opt('fight','thinker'),spend:opt('spend','careful'),m:+opt('m',4),to:opt('to','1e15'),trace:has('trace'),retreat:+opt('retreat',.45)};
  const t=Date.now(); const out=report(cfg,+opt('seeds',3)); console.log(JSON.stringify(out,null,1)); console.log(((Date.now()-t)/1000).toFixed(0)+'s');
}
module.exports={report,runOne};
