#!/usr/bin/env node
"use strict";
/* The feed test. Does thinking beat a fixed routine in close fights, and is any board order solved?
   node sim/decision.js [--seeds 24] [--m 8] [--part all|bots|layout|builds|batch] */
const D=require('../js/data.js'); Object.assign(globalThis,D);
const G=require('../js/game.js');
const {mkR,playFight}=require('./bots.js');
const {ENEMIES,TUNE,BASTIONS,CARDS,fmt}=D;
const A=process.argv.slice(2); const opt=k=>{ const i=A.indexOf('--'+k); return i>=0?A[i+1]:null; };
const SEEDS=+(opt('seeds')||24), PART=opt('part')||'all';
const EK=Object.keys(ENEMIES);
const BUILD_DEF=['ballista','bombard','buttress','gatehouse'];

function testProfile(L,board,cards){
  const P=G.newProfile(5);
  P.own.deed=2; P.deepest=Math.round(L*2.3); P.lv={gun:L,mason:L,walls:L};
  P.bases={}; for(const k of board) P.bases[k]=1; P.layout=board.slice();
  if(cards) for(const k in cards) P.own[k]=cards[k]; else { P.own.keg=1; P.own.hexcoin=1; P.own.mortar=1; }
  return P;
}
function fightOnce(P,pw,R,ek,seed,bot,opts){
  const T=G.startTrip(P,{seed,noFight:true}); T.ev=null; if(opts&&opts.batch) T.batch=1; if(opts&&opts.noSwap) T.noSwap=1;
  const hp=pw/R; T.f=1+Math.log(hp/TUNE.hp0)/Math.log(TUNE.gHp); T.deepest=1e9; T.startF=T.f;
  G.startFight(T,ENEMIES[ek]);
  const r=mkR(seed*31+7); playFight(T,bot,r,+(opt('m')||8),30);
  return {win:T.phase==='won',taken:T.st.taken,baseLost:T.st.baseLost,lost:T.st.baseLost+T.st.taken,turns:T.turn};
}
function table(P,bots,Rs,opts){
  const rows=[]; const pw=G.estPower(P).dmg;
  for(const R of Rs) for(const bot of bots){ let w=0,t=0,n=0,wt=0;
    for(const e of EK) for(let s=0;s<SEEDS;s++){ const f=fightOnce(P,pw,R,e,1000+s*13,bot,opts); n++; if(f.win){ w++; wt+=f.turns; } t+=f.lost; }
    rows.push({R,bot,win:w/n,lost:t/n,ttk:w?wt/w:NaN}); }
  return rows;
}
function show(rows){ console.log('| R | bot | win % | health pools lost | turns to kill (wins) |\n|---|---|---|---|---|');
  for(const r of rows) console.log(`| ${r.R} | ${r.bot} | ${(r.win*100).toFixed(0)} | ${r.lost.toFixed(2)} | ${isNaN(r.ttk)?'-':r.ttk.toFixed(1)} |`); }
function perms(a){ if(a.length<2) return [a]; const o=[]; a.forEach((x,i)=>{ for(const p of perms(a.filter((_,j)=>j!==i))) o.push([x,...p]); }); return o; }
const t0=Date.now();
if(PART==='all'||PART==='bots'){
  for(const L of [8,30]){ const P=testProfile(L,BUILD_DEF); const pw=G.estPower(P).dmg;
    console.log(`\n### Bots at level ${L} (power ${fmt(pw)}), board ${BUILD_DEF.join(', ')}. ${SEEDS} seeds x ${EK.length} enemies per row\n`);
    const rows=table(P,(opt('bots')||'random,fixed,thinker').split(','),[.7,1,1.5,3]); show(rows); console.log('');
    const thinker='thinker'; for(const R of [.7,1,1.5]){ const f=rows.find(r=>r.R===R&&r.bot==='fixed'), re=rows.find(r=>r.R===R&&r.bot===thinker); if(!f||!re) continue;
      console.log(`- R ${R}: ${thinker} wins ${((re.win-f.win)*100).toFixed(0)} points more than fixed, loses ${f.lost?((1-re.lost/f.lost)*100).toFixed(0):'-'}% less health, kills ${isNaN(f.ttk)||isNaN(re.ttk)?'-':((1-re.ttk/f.ttk)*100).toFixed(0)}% faster`); } }
}
if(PART==='all'||PART==='batch'){
  const P=testProfile(8,BUILD_DEF);
  console.log('\n### Feed timing at level 8, R 1\n\nPowder flows at once:\n'); show(table(P,['fixed','thinker'],[1]));
  console.log('\nPowder flows in a batch at end of turn:\n'); show(table(P,['fixed','thinker'],[1],{batch:1}));
}
if(PART==='all'||PART==='noswap'){
  const P=testProfile(8,BUILD_DEF);
  console.log('\n### What swapping is worth: thinking bot at level 8\n\nWith swaps:\n'); show(table(P,['thinker'],[.7,1]));
  console.log('\nNever swaps:\n'); show(table(P,['thinker'],[.7,1],{noSwap:1}));
}
if(PART==='all'||PART==='layout'){
  console.log(`\n### Layouts: all 24 orders of the same four Bastions, fixed bot, R 0.7, level 8, ${SEEDS} seeds per enemy, ties broken by health lost\n`);
  const pw=G.estPower(testProfile(8,BUILD_DEF)).dmg;
  const res=[]; for(const p of perms(BUILD_DEF)){ const P=testProfile(8,p); const per={}; let tot=0;
    for(const e of EK){ let w=0,l=0; for(let s=0;s<SEEDS;s++){ const f=fightOnce(P,pw,.7,e,2000+s*17,'fixed'); if(f.win) w++; l+=f.lost; } per[e]=w/SEEDS-l/SEEDS*.01; tot+=w/SEEDS; }
    res.push({p,per,mean:tot/EK.length}); }
  res.sort((a,b)=>b.mean-a.mean);
  console.log('Top 3 orders by mean win %:'); for(const r of res.slice(0,3)) console.log(`- ${r.p.join(' > ')}: ${(r.mean*100).toFixed(0)}%`);
  console.log(`- Worst, ${res[res.length-1].p.join(' > ')}: ${(res[res.length-1].mean*100).toFixed(0)}%\n\nBest order per enemy:`);
  const bestCount={}; for(const e of EK){ const m=Math.max(...res.map(r=>r.per[e])); const bs=res.filter(r=>r.per[e]===m); bestCount[bs[0].p.join('>')]=(bestCount[bs[0].p.join('>')]||0)+1; const shown=v=>Math.max(0,Math.ceil(v*SEEDS-1e-9))/SEEDS; console.log(`- ${e}: ${bs[0].p.join(' > ')} ${(shown(m)*100).toFixed(0)}%; top overall order gets ${(shown(res[0].per[e])*100).toFixed(0)}%`); }
  const mx=Math.max(...Object.values(bestCount)); console.log(`\nDistinct best orders across ${EK.length} enemies: ${Object.keys(bestCount).length}. Most often best: ${mx}/${EK.length} (${(mx/EK.length*100).toFixed(0)}%). Spread between best and worst overall: ${((res[0].mean-res[res.length-1].mean)*100).toFixed(0)} points.`);
}
if(PART==='all'||PART==='builds'){
  const BUILDS={'chain':['bellows','anvil','bombard','ballista'],'wall':['gatehouse','buttress','ballista','hexstone'],
    'plague':['plaguepit','buttress','hexstone','ballista'],'mixed':BUILD_DEF,'draw':['signal','ballista','bombard','buttress']};
  const n=Math.ceil(SEEDS/2), pw=G.estPower(testProfile(8,BUILD_DEF)).dmg;
  console.log(`\n### Builds: thinker bot, R 1 by the mixed build's power, level 8, ${n} seeds per enemy\n`);
  const names=Object.keys(BUILDS); const res={};
  for(const b of names){ const P=testProfile(8,BUILDS[b]); res[b]={}; for(const e of EK){ let w=0,l=0; for(let s=0;s<n;s++){ const f=fightOnce(P,pw,1,e,3000+s*19,'thinker'); if(f.win) w++; l+=f.lost; } res[b][e]={w:w/n,l:l/n}; } }
  console.log('| enemy | '+names.join(' | ')+' |\n|---|'+names.map(()=>'---').join('|')+'|');
  const bestN={}; for(const e of EK){ const best=names.slice().sort((a,b)=>res[b][e].w-res[a][e].w||res[a][e].l-res[b][e].l)[0]; bestN[best]=(bestN[best]||0)+1; console.log(`| ${e} | `+names.map(b=>(res[b][e].w*100).toFixed(0)+'%'+(b===best?'*':'')).join(' | ')+' |'); }
  console.log('| mean | '+names.map(b=>(EK.reduce((s,e)=>s+res[b][e].w,0)/EK.length*100).toFixed(0)+'%').join(' | ')+' |');
  const mx=Math.max(...Object.values(bestN)); console.log(`\nMost often best build: ${mx}/${EK.length} enemies (${(mx/EK.length*100).toFixed(0)}%). Counts: ${JSON.stringify(bestN)}`);
}
console.log(`\n(${((Date.now()-t0)/1000).toFixed(0)}s)`);
