"use strict";
/* One idea at a time, against the same baseline. Each run is its own process, so nothing leaks between variants.
   node sim/variants.js <name> [loopSeeds]      node sim/variants.js list
   Clock: 15 s a played turn, 3 s a fight, 25 s a home visit, 5 s a march, 10 s a caravan. A burst is a home visit that at least doubles power. */
require('./load.js'); require('./bots.js');
const {BUILDS,cell,SET,layoutTest}=require('./results.js');
const {runGame}=require('./loop.js');

const boards=(n,deedsMid,deedsLate)=>{ for(const b of ['fresh','early']){ BUILDS[b].slots=n; BUILDS[b].board=n===3?['stake','cannon','apoth']:['stake','cannon']; } BUILDS.mid.deeds=deedsMid; BUILDS.late.deeds=deedsLate; };
const start3=()=>{ TUNE.startBoard=['cannon','stake','apoth']; TUNE.freeSlots=3; boards(3,1,3); };
// `base` is the rules as shipped. `yours` puts back the rules of wild/forays-yours; add ideas after it, like yours+swap.
const VARIANTS={
  base:()=>{},
  yours:()=>{ TUNE.freeSwap=0; TUNE.startBoard=['cannon','stake']; TUNE.freeSlots=2; boards(2,2,4); TUNE.atk0=17; TUNE.atkG=1.19; CARDS.cannon.need=3; CARDS.stake.need=2; },
  // Take one kept change back out of the shipped rules.
  noswap:()=>{ TUNE.freeSwap=0; },
  start2:()=>{ TUNE.startBoard=['cannon','stake']; TUNE.freeSlots=2; boards(2,2,4); },
  oldneed:()=>{ CARDS.cannon.need=3; CARDS.stake.need=2; },
  oldatk:()=>{ TUNE.atk0=17; TUNE.atkG=1.19; },
  notaunt:()=>{ TUNE.taunt=false; },
  swap:()=>{ TUNE.freeSwap=1; },
  stance:()=>{ TUNE.stance=true; },
  start3,
  need:()=>{ CARDS.cannon.need=4; CARDS.stake.need=3; },
  atk:()=>{ TUNE.atk0=24; },
  atkE:()=>{ TUNE.atk0=24; TUNE.atkG=1.175; },
  needA:()=>{ CARDS.cannon.need=4; },
  needB:()=>{ CARDS.stake.need=3; },
  dodge:()=>{ TUNE.stance='dodge'; },
  gate3:()=>{ TUNE.capR=3; },
  gate5:()=>{ TUNE.capR=5; },
  gate8:()=>{ TUNE.capR=8; },
  close:()=>{ TUNE.closeR=1.5; },
};
const name=process.argv[2]||'base';
if(name==='list'){ console.log(Object.keys(VARIANTS).join(' ')); process.exit(0); }
for(const part of name.split('+')){ if(!VARIANTS[part]) throw new Error('no variant '+part); VARIANTS[part](); }

const LOOPS=+process.argv[3]||12;
const q=(a,p)=>{ const b=a.slice().sort((x,y)=>x-y); return b.length?b[Math.min(b.length-1,Math.floor(p*b.length))]:NaN; };
const m=x=>Number.isFinite(x)?x.toFixed(1):'never', pc=x=>Math.round(100*x)+'%';

function decisions(){ const out={};
  for(const b of ['fresh','early','mid','late']) for(const R of [.5,.7,1,1.5]){ const fx=cell(b,'fixed',R,SET), th=cell(b,'think',R,SET);
    out[`${b} ${R}`]=`${pc(fx.win)}/${pc(th.win)} hp ${pc(fx.taken)}/${pc(th.taken)} ttk ${m(fx.ttk)}/${m(th.ttk)}`; }
  return out; }
function loop(o){ const rs=[]; for(let s=1;s<=LOOPS;s++) rs.push(runGame(s*97+3,'careful',{capMin:400,target:1e15,samples:16,...o})); return rs; }
const to=(rs,mark)=>rs.map(r=>r.marks[mark]==null?Infinity:r.marks[mark]/60);
function powerAt(r,min){ let best=0; for(let i=0;i<r.log.length;i++){ const l=r.log[i]; if(parseFloat(l.min)-r.tripMins[i]<=min) best=i; } return r.log.length?r.log[best].power:'-'; }
function pacing(rs){ const gaps=[], trips=[]; let turns=0,fights=0,defeats=0,n=0;
  for(const r of rs){ const end=r.marks[1e12]==null?Infinity:r.marks[1e12]; let last=null;
    r.log.forEach((l,i)=>{ const t=(parseFloat(l.min)-r.tripMins[i])*60; if(+l.jump>=2){ if(last!=null) gaps.push((t-last)/60); last=t; }
      if(t<=end){ trips.push(r.tripMins[i]); turns+=l.turns; fights+=l.fights; n++; if(l.how==='defeat') defeats++; } }); }
  const t12=to(rs,1e12);
  return {to1e6:m(q(to(rs,1e6),.5)),to1e9:m(q(to(rs,1e9),.5)),to1e12:`${m(q(t12,.5))} (${m(q(t12,.1))}-${m(q(t12,.9))})`,to1e15:m(q(to(rs,1e15),.5)),
    burst:`${m(q(gaps,.5))} (${m(q(gaps,.1))}-${m(q(gaps,.9))})`,in1to5:pc(gaps.filter(g=>g>=1&&g<=5).length/Math.max(1,gaps.length)),
    trip:m(q(trips,.5)),turnsPerFight:m(turns/Math.max(1,fights)),defeats:pc(defeats/Math.max(1,n)),nonFinite:rs.reduce((s,r)=>s+r.nonFinite,0),won:rs.filter(r=>r.P.won).length}; }

const decide=decisions();
const layouts=layoutTest(false);
const top=o=>{ const e=Object.entries(o).sort((a,b)=>b[1]-a[1]); return `${e[0][0]} ${pc(e[0][1])}, ${e[1][0]} ${pc(e[1][1])}`; };
const think=loop({}), fixed=loop({fightBot:'fixed'}), dodge=loop({retreatR:1.2}), noSock=loop({noSock:true}), noWheel=loop({noWheel:true}), die=loop({neverRetreat:true});
const naive=[]; for(let s=1;s<=LOOPS;s++) naive.push(runGame(s*97+3,'naive',{capMin:400,target:1e15,samples:16}));
const med12=rs=>q(to(rs,1e12),.5);
console.log(JSON.stringify({variant:name,pacing:pacing(think),
  fightSkill:`fixed x${(med12(fixed)/med12(think)).toFixed(2)}`,
  powerAt10:`think ${q(think.map(r=>{ const p=powerAt(r,10); return parseFmt(p); }),.5)}, fixed ${q(fixed.map(r=>parseFmt(powerAt(r,10))),.5)}`,
  avoidClose:`leave below 1.2 is x${(med12(dodge)/med12(think)).toFixed(2)}`,
  depth:{naive:`x${(med12(naive)/med12(think)).toFixed(2)}`,noSockets:`x${(med12(noSock)/med12(think)).toFixed(2)}`,noWheel:`x${(med12(noWheel)/med12(think)).toFixed(2)}`,neverRetreat:`x${(med12(die)/med12(think)).toFixed(2)}`},
  layouts:{mid:top(layouts.mid),late:top(layouts.late)},decide},null,1));
function parseFmt(s){ if(typeof s!=='string') return 0; const u={K:1e3,M:1e6,B:1e9,T:1e12}[s.slice(-1)]; return u?parseFloat(s)*u:parseFloat(s); }
