"use strict";
/* The riskiest idea: does feeding the board from the hand create decisions, and do Deeds, Wards, swaps pay their way?
   Single fights at a chosen R = (estimated 3-turn damage) / enemy health. Enemy health is set by R, attack is the curve's value at that health.
   node sim/feedtest.js [n]   (n = seeds per cell) */
require('./load.js'); require('./bots.js');
const N=+process.argv[2]||60;

// A mid-game build. tier sets levels. deeds and layouts vary by test.
function build(o={}){
  const P=newProfile(o.seed||1), L=o.lvl==null?22:o.lvl;
  P.wheel=o.wheel==null?3:o.wheel; P.hearth=L; P.slots=o.slots||4;
  P.cards=[]; P.layout=[]; P.nid=1;
  const pack=o.pack||['fork','fork','sally','helm','pavise','scoop','keg','errand','vial','doll'];
  for(const k of pack) addCard(P,k,L,true);
  for(let i=0;i<(o.deeds==null?2:o.deeds);i++) addCard(P,'deed',0,true);
  for(let i=0;i<(o.wards||0);i++) addCard(P,'ward',0,true);
  for(const k of (o.board||['stake','cannon','apoth','mortar'])){ const c=addCard(P,k,L,true); P.layout.push(c.id); }
  for(const c of P.cards) { if(c.lvl>=5) c.sock=isPiece(c)?['keen']:['keen']; }
  return P;
}
// Stand T at an arbitrary health level. The sim overrides the enemy after beginFight with same rules.
function runFight(P,key,R,bot,seed,opts){
  P.seed=seed; P.trips=seed; const T=startTrip(P); T.coin=0;
  const hp=estPower(P)/R, f=Math.log(hp/TUNE.hp0)/Math.log(TUNE.hpG);
  T.f=7; // any non-boss fight; health and attack are set directly below
  const rs={s:seed*101|0};
  beginFight(P,T,{key,hp,atk:TUNE.atk0*Math.pow(TUNE.atkG,f)});
  const F=T.F; let g=0,startHp=T.hp,startPieces=T.board.reduce((s,b)=>s+b.hp,0);
  while(!F.over&&g++<20) playTurn(P,T,bot,rs,opts);
  return {win:F.over==='win',turns:F.turn,taken:Math.max(0,1-T.hp/T.maxHp),lost:T.stat.lost,left:F.enemy.hp/F.enemy.maxHp};
}
const ENEMYSET=['rat','raider','archer','ogre','sapper','warden','shaman','toller','bishop'];
function cell(mk,bot,R,keys,opts,n){ let w=0,t=0,d=0,c=0,tw=0;
  for(const key of keys) for(let s=1;s<=(n||N);s++){ const P=mk(s); const r=runFight(P,key,R,bot,s*13+7,opts); w+=r.win?1:0; d+=r.taken; t+=r.turns; c++; }
  return {win:w/c,taken:d/c,turns:t/c}; }
const pc=x=>(100*x).toFixed(0).padStart(3)+'%';
function table(title,mk,opts){
  console.log('\n## '+title); console.log('R     | random           | fixed            | think            | think-fixed win');
  for(const R of [.7,1,1.5,3]){ const a=cell(mk,'random',R,ENEMYSET,opts),b=cell(mk,'fixed',R,ENEMYSET,opts),c=cell(mk,'think',R,ENEMYSET,opts);
    const f=x=>`${pc(x.win)} ${pc(x.taken)} ${x.turns.toFixed(1).padStart(4)}t`;
    console.log(String(R).padEnd(5)+' | '+f(a)+' | '+f(b)+' | '+f(c)+' | '+((c.win-b.win)*100).toFixed(0)+' pts'); }
}
const what=process.argv[3]||'all';
if(what==='all'||what==='feed'){
  console.log('Columns: win rate, share of player HP lost, turns.');
  TUNE.feed='stoke'; table('Feed A: burn any card, wheel 3',s=>build({seed:s}));
  TUNE.feed='powdercards'; table('Feed B: only Powder cards feed, wheel 3',s=>build({seed:s,pack:['fork','fork','sally','helm','pavise','scoop','scoop','keg','errand','vial']}));
  TUNE.feed='wheel'; table('Feed C: wheel only (6 a turn), the hand never feeds',s=>build({seed:s}));
  TUNE.feed='stoke';
}
if(what==='all'||what==='junk'){
  table('Junk: 2 Deeds (baseline repeated)',s=>build({seed:s}));
  TUNE.junk='none'; table('Junk: no Deeds, slots free',s=>build({seed:s,deeds:0})); table('Junk: 3 Wards instead',s=>build({seed:s,deeds:0,wards:3}));
  TUNE.junk='hold'; table('Junk: Deeds that boost board x1.5 while held',s=>build({seed:s}));
  TUNE.junk='deed';
  table('No swap allowed (think bot)',s=>build({seed:s}),{swap:false});
}
if(what==='all'||what==='layout'){
  const LAY={stake_first:['stake','cannon','apoth','mortar'],guns_first:['cannon','mortar','apoth','stake'],gate_wall:['gate','cannon','mortar','apoth'],blight:['apoth','stake','cannon','mortar'],hex_tank:['hut','stake','cannon','mortar'],bellows:['bellows','cannon','mortar','apoth']};
  console.log('\n## Layouts: each enemy and seed, which layout does best (think bot, R=1)');
  const names=Object.keys(LAY), wins={}; for(const n of names) wins[n]=0; let tot=0; const perEnemy={};
  for(const key of ENEMYSET){ const local={}; for(const n of names) local[n]=0;
    for(let s=1;s<=Math.ceil(N/3);s++){ let best=null,bv=-1e9;
      for(const n of names){ const P=build({seed:s,board:LAY[n]}); const r=runFight(P,key,1,'think',s*13+7); const v=(r.win?100:0)-r.taken*50-r.turns-r.left*50; if(v>bv){bv=v;best=n;} }
      wins[best]++; local[best]++; tot++; }
    perEnemy[key]=Object.entries(local).sort((a,b)=>b[1]-a[1])[0].join(':');
  }
  for(const n of names) console.log(n.padEnd(12),pc(wins[n]/tot));
  console.log('best per enemy:',JSON.stringify(perEnemy));
}
if(what==='all'||what==='deeds'){
  // Same enemies in absolute terms: how many Deeds (and so slots) is best, by enemy pressure, and is the answer always the same?
  const B=['stake','cannon','apoth','mortar','cannon','hut'];
  const base=build({seed:1,deeds:2,board:B.slice(0,4),slots:6}), P0=estPower(base);
  console.log('\n## Deeds: same absolute enemy (R=1 for 2 Deeds, 4 slots). think bot. Deed count opens that many slots past two.');
  for(const mult of [1,.6]){ for(const d of [0,1,2,3,4]){ let w=0,t=0,c=0;
      for(const key of ENEMYSET) for(let s=1;s<=N;s++){ const P=build({seed:s,deeds:d,board:B.slice(0,2+d),slots:6});
        const T0=runAbs(P,key,P0*mult,s*13+7); w+=T0.win?1:0; t+=T0.taken; c++; }
      console.log(`hp x${mult} Deeds ${d}: win ${pc(w/c)} taken ${pc(t/c)}`); } }
  console.log('Fixed slots at 4 with free Deeds off, by Deed count held but useless:');
  TUNE.junk='none'; for(const d of [0,2]){ let w=0,t=0,c=0; for(const key of ENEMYSET) for(let s=1;s<=N;s++){ const P=build({seed:s,deeds:d,board:B.slice(0,4),slots:4}); const r=runAbs(P,key,P0,s*13+7); w+=r.win?1:0;t+=r.taken;c++; } console.log(`free slots, ${d} dead cards: win ${pc(w/c)} taken ${pc(t/c)}`);} TUNE.junk='deed';
}
function runAbs(P,key,hp,seed){ P.seed=seed; P.trips=seed; const T=startTrip(P); T.coin=0; T.f=7; const f=Math.log(hp/TUNE.hp0)/Math.log(TUNE.hpG), rs={s:seed*101|0};
  beginFight(P,T,{key,hp,atk:TUNE.atk0*Math.pow(TUNE.atkG,f)}); const F=T.F; let g=0; while(!F.over&&g++<20) playTurn(P,T,'think',rs); return {win:F.over==='win',taken:1-T.hp/T.maxHp}; }
