"use strict";
/* The numbers in docs/RESULTS.md, on the real rules.
   node sim/results.js pacing [seeds=12]   careful bot, fresh start to a trillion and on to 1e15
   node sim/results.js skill  [seeds=8]    careful against naive, and game knock-outs
   node sim/results.js tap    [seeds=8]    how much thumb speed is worth
   node sim/results.js rules  [seeds=8]    each combo rule switched off in turn
   node sim/results.js decks              eight deck ideas on the same budget
   node sim/results.js share              how far each side of a finished deck carries it
   Pass TUNEX='{"crossX":1}' to change any tuning value. */
const {runGame,spendCareful,bestPerks,score,setOpt}=require('./loop.js');
const med=a=>{ const b=a.filter(x=>x!=null&&isFinite(x)).sort((x,y)=>x-y); return b.length?b[Math.floor(b.length/2)]:null; };
const Q=(a,p)=>{ const b=a.slice().sort((x,y)=>x-y); return b.length?b[Math.floor(p*(b.length-1))]:null; };
const seedsOf=n=>[...Array(n).keys()].map(i=>(i+1)*97+3);
const mins=(r,m)=>r.marks[m]==null?null:r.marks[m]/60;
function runMany(n,kind,o){ return seedsOf(n).map(s=>runGame(s,kind,{capMin:o&&o.capMin||240,target:o&&o.target||1e15,...o})); }
function summary(rs){ const never=m=>rs.filter(r=>mins(r,m)==null).length, row=m=>{ const v=rs.map(r=>mins(r,m)).filter(x=>x!=null); return v.length?`${med(v).toFixed(0)} (${Q(v,0).toFixed(0)}-${Q(v,1).toFixed(0)})${never(m)?` +${never(m)} never`:''}`:'never'; };
  const gaps=[]; for(const r of rs) for(let i=1;i<r.bursts.length;i++) gaps.push((r.bursts[i]-r.bursts[i-1])/60);
  const inWindow=gaps.filter(g=>g>=1&&g<=5).length/Math.max(1,gaps.length);
  return {'to 1e6':row(1e6),'to 1e9':row(1e9),'to 1e12':row(1e12),'to 1e15':row(1e15),'burst gap med':(Q(gaps,.5)||0).toFixed(1),'p10':(Q(gaps,.1)||0).toFixed(1),'p90':(Q(gaps,.9)||0).toFixed(1),'gaps in 1-5 min':Math.round(100*inWindow)+'%',n:gaps.length,
    trips:med(rs.map(r=>r.P.trips)),defeats:med(rs.map(r=>r.P.defeats)),'trip min':med(rs.flatMap(r=>r.tripMins)).toFixed(1),'fight s':med(rs.flatMap(r=>r.fightSecs)).toFixed(0),'hand share':rs.map(r=>Math.round(100*r.handShare)).sort((a,b)=>a-b).join(' '),nonFinite:rs.reduce((s,r)=>s+r.nonFinite,0)}; }
const show=(name,o)=>console.log(`\n${name}\n`+Object.entries(o).map(([k,v])=>`  ${k}: ${v}`).join('\n'));

const what=process.argv[2]||'pacing', N=+process.argv[3];
if(what==='pacing') show('Careful bot, 4 taps a second',summary(runMany(N||12,'careful')));
if(what==='skill'){ const n=N||8, base=runMany(n,'careful',{target:1e12}), ratio=(rs)=>{ const v=rs.map((r,i)=>{ const a=mins(base[i],1e12), b=mins(r,1e12); return b==null?Infinity:b/a; }); return `x${(med(v)===Infinity?Infinity:med(v)).toFixed?med(v).toFixed(2):med(v)} per seed: ${v.map(x=>x===Infinity?'never':x.toFixed(1)).join(' ')}`; };
  const run=(name,kind,o)=>{ const rs=runMany(n,kind,{target:1e12,...o}); show(name,{'to 1e12':summary(rs)['to 1e12'],ratio:ratio(rs),'burst gap med':summary(rs)['burst gap med']}); };
  show('Baseline',{'to 1e12':summary(base)['to 1e12']});
  run('Naive upgrades: cheapest first, random sockets, packs everything','naive',{});
  run('Never changes its pack or bastions after the start (still levels)','careful',{noDeck:true});
  run('No sockets','careful',{noSock:true}); run('No Charge','careful',{noCharge:true}); run('Never buys the Wheel','careful',{noWheel:true}); run('Never hires the Page','careful',{noAuto:true}); }
if(what==='tap'){ const n=N||8; for(const rate of [1.5,2.5,4,6,8]){ const rs=runMany(n,'careful',{rate,target:1e12}), s=summary(rs); show(`${rate} taps a second`,{'to 1e12':s['to 1e12'],'trip min':s['trip min'],'hand share':s['hand share']}); } }
if(what==='rules'){ const n=N||8, s=summary(runMany(n,'careful',{target:1e12})); show(`Rules as set by TUNEX=${process.env.TUNEX||'{}'}`,{'to 1e12':s['to 1e12'],'gaps in 1-5':s['gaps in 1-5 min'],'hand share':s['hand share']}); }

/* ---- eight deck ideas, same coin, same collection ---- */
const DECKS={
  'Fork swarm':     {pack:['fork','fork','fork','fork','sally','keg','errand','helm'],board:['cannon','stake']},
  'Guns and Powder':{pack:['scoop','scoop','scoop','keg','trail','rope','helm'],board:['bellows','mortar','cannon','stake']},
  'Combo horn':     {pack:['horn','horn','drum','errand','fork','fork','helm'],board:['tower','cannon','stake']},
  'Block and bash': {pack:['helm','helm','helm','bash','bash','mend','fork'],board:['stake','gate']},
  'Blight':         {pack:['vial','vial','vial','plague','plague','scoop','helm'],board:['apoth','stake']},
  'Snowball':       {pack:['barrel','barrel','anvil','whet','errand','helm'],board:['cannon','stake']},
  'Wide field':     {pack:['ram','ram','ram','scoop','keg','helm'],board:['stake','apoth','cannon','gate']},
  'Crossfire mix':  {pack:['fork','fork','keg','keg','scoop','whet','helm'],board:['forge','arsenal','cannon','stake']},
};
function deckBuild(name,coin){ const d=DECKS[name], P=newProfile(11); P.cards=[]; P.nid=1;
  for(const k of d.pack) addCard(P,k,0,true); P.layout=d.board.map(k=>addCard(P,k,0,true).id);
  P.slots=Math.max(2,d.board.length); for(let i=2;i<P.slots;i++) addCard(P,'deed',0,true); P.coin=coin; setOpt({noDeck:true}); spendCareful(P); return P; }
function reach(P){ let f=0; for(let g=0;g<300;g++){ if(winChance(P,f,null,3)<.5) break; f++; } return f; }
if(what==='decks') for(const coin of [1e5,1e9,1e13]){ console.log(`\nBudget ${fmt(coin)} coin. Deepest fight won from a fresh start more than half the time, and the Power behind it:`);
  const rows=Object.keys(DECKS).map(name=>{ const P=deckBuild(name,coin), st=testFire(P); return {name,f:reach(P),dmg:st.dmg,hand:st.hand/(st.hand+st.board||1)}; }).sort((a,b)=>b.f-a.f||b.dmg-a.dmg);
  for(const r of rows) console.log(`  ${r.name.padEnd(17)} fight ${String(r.f).padStart(3)}  power ${fmt(r.dmg).padStart(7)}  cards ${Math.round(100*r.hand)}%`); }

/* ---- does each half of a finished deck matter? ---- */
if(what==='share'){ const n=N||6, rows=[]; for(const target of [1e6,1e9,1e12]) for(const s of seedsOf(n)){ const r=runGame(s,'careful',{capMin:240,target}), P=r.P, st=testFire(P), base=st.dmg, snap=JSON.stringify(P);
    const q=JSON.parse(snap); for(const c of q.cards) if(!isPiece(c)&&isAtkCard(c.key)) c.packed=false; const noAtk=testFire(q).dmg;
    const w=JSON.parse(snap); w.layout=[]; const noBoard=testFire(w).dmg;
    const v=JSON.parse(snap); for(const c of v.cards) if(!isPiece(c)&&!isAtkCard(c.key)) c.packed=false; const noSupport=testFire(v).dmg;
    rows.push({target,share:st.hand/(st.hand+st.board||1),noAtk:base/Math.max(1,noAtk),noBoard:base/Math.max(1,noBoard),noSupport:base/Math.max(1,noSupport)}); }
  for(const target of [1e6,1e9,1e12]){ const a=rows.filter(r=>r.target===target), f=x=>x>=1e4?fmt(x):x.toFixed(1); console.log(`\nAt power ${fmt(target)}: cards' share of damage ${a.map(r=>Math.round(100*r.share)).sort((x,y)=>x-y).join(' ')}%`);
    console.log(`  take out the attack cards: damage falls x${f(med(a.map(r=>r.noAtk)))}  | take out the bastions: x${f(med(a.map(r=>r.noBoard)))}  | take out the other cards: x${f(med(a.map(r=>r.noSupport)))}`); } }
