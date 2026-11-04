"use strict";
// Shared summary for the two takes: one clock and one burst definition.
// Clock: 15 s a played turn, 3 s a fight, 25 s a home visit, 5 s a march, 10 s a caravan or cache.
// Burst: a home visit that at least doubles power.
const q=(a,p)=>{ if(!a.length) return null; const s=[...a].sort((x,y)=>x-y); return s[Math.min(s.length-1,Math.floor(p*s.length))]; };
const r1=x=>x==null||!isFinite(x)?'never':(+x).toFixed(1);
// trips: [{sec: clock when the home visit ended, pow: power after spending, jump: power x from that visit, turns, fights, tripSec, how}]
function summarise(name,runs){
  const at=(t,m)=>{ const hit=t.find(x=>x.pow>=m); return hit?hit.sec/60:Infinity; };
  const med=m=>r1(q(runs.map(t=>at(t,m)),.5));
  const span=m=>`${r1(q(runs.map(t=>at(t,m)),.1))}-${r1(q(runs.map(t=>at(t,m)),.9))}`;
  const gaps=[]; for(const t of runs){ const b=t.filter(x=>x.jump>=2); for(let i=1;i<b.length;i++) gaps.push((b[i].sec-b[i-1].sec)/60); }
  const inRange=gaps.filter(g=>g>=1&&g<=5).length/Math.max(1,gaps.length);
  const clipped=runs.map(t=>{ const end=t.findIndex(x=>x.pow>=1e12); return end<0?t:t.slice(0,end+1); });
  const trips=clipped.flat(), fights=trips.reduce((s,x)=>s+x.fights,0), turns=trips.reduce((s,x)=>s+x.turns,0);
  const powAt=(t,min)=>{ let p=t[0]?t[0].pow:0; for(const x of t) if(x.sec/60<=min) p=x.pow; return p; };
  const out={name,seeds:runs.length,
    minTo:{'1e6':med(1e6),'1e9':med(1e9),'1e12':`${med(1e12)} (${span(1e12)})`,'1e15':med(1e15)},
    burstGap:{median:r1(q(gaps,.5)),p10:r1(q(gaps,.1)),p90:r1(q(gaps,.9)),n:gaps.length,in1to5min:Math.round(inRange*100)+'%'},
    tripMinMedian:r1(q(trips.map(x=>x.tripSec/60),.5)),
    tripsTo1e12:q(clipped.map(t=>t.length),.5),
    turnsPerFight:r1(turns/Math.max(1,fights)),
    defeatShare:Math.round(100*trips.filter(x=>x.how==='defeat').length/Math.max(1,trips.length))+'%',
    powerAt10min:q(runs.map(t=>powAt(t,10)),.5),powerAt20min:q(runs.map(t=>powAt(t,20)),.5)};
  console.log(JSON.stringify(out));
  return out;
}
module.exports={summarise};
