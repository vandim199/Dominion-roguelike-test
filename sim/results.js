"use strict";
/* Every measured number in docs/RESULTS.md comes from here.
   node sim/results.js [decision|loop|depth|all] > docs/results_raw.txt */
require('./load.js'); require('./bots.js');
const {runGame}=require('./loop.js');
const what=require.main===module?(process.argv[2]||'all'):'none', FN=+process.env.FN||12, LN=+process.env.LN||5;
const pc=x=>(100*x).toFixed(0)+'%', med=a=>{ const b=a.slice().sort((x,y)=>x-y); return b.length?b[Math.floor((b.length-1)/2)]:NaN; };
const q=(a,p)=>{ const b=a.slice().sort((x,y)=>x-y); return b.length?b[Math.floor(p*(b.length-1))]:NaN; };

/* ---- builds at three stages of the game, taken from what the careful bot actually ends up with ---- */
const BUILDS={
  fresh:{lvl:1,hearth:1,wheel:1,slots:3,deeds:0,board:['stake','cannon','apoth'],pack:['fork','fork','fork','helm','helm','scoop','keg','errand'],sock:{}}, // the first trips, before the first boss
  early:{lvl:6,wheel:1,slots:3,deeds:0,board:['stake','cannon','apoth'],pack:['fork','fork','fork','helm','helm','scoop','keg','errand'],sock:{}},
  mid:{lvl:22,hearth:22,wheel:3,slots:4,deeds:1,board:['stake','cannon','apoth','mortar'],pack:['fork','fork','sally','helm','pavise','scoop','keg','errand','vial','doll'],sock:{all:['keen','light']}},
  late:{lvl:38,hearth:46,wheel:7,slots:6,deeds:3,energy:5,board:['stake','apoth','cannon','mortar','cannon','mortar'],pack:['ram','ram','fork','helm','helm','keg','second','errand'],sock:{piece:['charge','keen'],last:['keen','light'],card:['keen','echo']}},
};
function build(name,seed,boardOverride){
  const b=BUILDS[name], P=newProfile(seed); P.wheel=b.wheel; P.hearth=b.hearth||b.lvl; P.slots=b.slots; P.energy=b.energy||3; P.cards=[]; P.layout=[]; P.nid=1;
  const open=(c,l)=>{ c.sock=(l||[]).slice(0,socketsOpen(P,c)); };
  for(const k of b.pack){ const c=addCard(P,k,b.lvl,true); open(c,b.sock.card||b.sock.all); }
  for(let i=0;i<b.deeds;i++) addCard(P,'deed',0,true);
  const board=boardOverride||b.board; board.forEach((k,i)=>{ const c=addCard(P,k,b.lvl,true); open(c,i===board.length-1?(b.sock.last||b.sock.all):(b.sock.piece||b.sock.all)); P.layout.push(c.id); });
  return P;
}
function runFight(P,key,R,bot,seed,opts,hpBase){
  P.seed=seed; P.trips=seed; const T=startTrip(P); T.coin=0; T.f=7;
  const hp=(hpBase||estPower(P))/R, f=Math.log(hp/TUNE.hp0)/Math.log(TUNE.hpG), rs={s:seed*101|0};
  beginFight(P,T,{key,hp,atk:TUNE.atk0*Math.pow(TUNE.atkG,f)});
  const F=T.F; let g=0; while(!F.over&&g++<20) playTurn(P,T,bot,rs,opts);
  return {win:F.over==='win'?1:0,turns:F.turn,taken:Math.max(0,1-T.hp/T.maxHp),lost:T.stat.lost,left:Math.max(0,F.enemy.hp/F.enemy.maxHp),plays:T.stat.plays||0,burns:T.stat.burns||0,hand:T.stat.dmgHand,board:T.stat.dmgBoard};
}
const SET=['rat','raider','archer','ogre','sapper','warden','shaman','toller','bishop'];
function cell(name,bot,R,keys,opts,n,bo){ let c=0,w=0,t=0,d=0,kt=0,pl=0,bu=0,hs=0; for(const key of keys) for(let s=1;s<=(n||FN);s++){ const r=runFight(build(name,s,bo),key,R,bot,s*13+7,opts); c++; w+=r.win; d+=r.taken; t+=r.turns; pl+=r.plays; bu+=r.burns; hs+=r.hand/Math.max(1,r.hand+r.board); if(r.win) kt+=r.turns; }
  return {win:w/c,taken:d/c,turns:t/c,ttk:w?kt/w:NaN,plays:pl/t,burns:bu/t,handShare:hs/c}; }
function decision(){
  console.log('## 1. Decision test ('+FN+' seeds x '+SET.length+' enemies per cell; think = 60 sampled turns)');
  for(const name of Object.keys(BUILDS)){
    console.log(`\n### Build: ${name} (L${BUILDS[name].lvl})\n| R | bot | win | HP lost | turns to kill (wins) | plays/turn | burns/turn | hand share of damage |\n|---|---|---|---|---|---|---|---|`);
    for(const R of [.7,1,1.5,3]) for(const bot of ['random','fixed','think']){ const x=cell(name,bot,R,SET); console.log(`| ${R} | ${bot} | ${pc(x.win)} | ${pc(x.taken)} | ${x.ttk.toFixed(2)} | ${x.plays.toFixed(1)} | ${x.burns.toFixed(1)} | ${pc(x.handShare)} |`); }
  }
  // Knock-outs on the mid build
  console.log('\n### Knock-outs, mid and late builds, R=1 (think vs fixed)\n| variant | fixed win | think win | fixed HP lost | think HP lost |\n|---|---|---|---|---|');
  const ko=(label,name,fn,undo,opts)=>{ fn(); const a=cell(name,'fixed',1,SET),b=cell(name,'think',1,SET,opts); undo(); console.log(`| ${label} (${name}) | ${pc(a.win)} | ${pc(b.win)} | ${pc(a.taken)} | ${pc(b.taken)} |`); };
  const nil=()=>{};
  for(const n of ['mid','late']) ko('as shipped',n,nil,nil);
  for(const n of ['mid','late']) ko('think bot may not swap',n,nil,nil,{swap:false});
  ko('burn flat 1 Powder, not cost+1','mid',()=>{TUNE.burnFlat=true;},()=>{TUNE.burnFlat=false;});
  ko('only Powder cards feed','mid',()=>{TUNE.feed='powdercards';},()=>{TUNE.feed='stoke';});
  ko('wheel only feeds (+3), hand never burns','mid',()=>{TUNE.feed='wheel';},()=>{TUNE.feed='stoke';});
  ko('no Magazine','mid',()=>{TUNE.magBase=0;},()=>{TUNE.magBase=2;});
  layoutTest(true);
}
// Layouts across enemy sets
function layoutTest(print){
  const layouts={mid:{stake_first:['stake','cannon','apoth','mortar'],guns_first:['cannon','mortar','apoth','stake'],gatehouse:['gate','cannon','mortar','apoth'],hex:['hut','stake','cannon','mortar'],bellows:['bellows','cannon','apoth','mortar'],post:['post','stake','cannon','mortar']},
    late:{chain:['stake','apoth','cannon','mortar','cannon','mortar'],gate_chain:['gate','apoth','cannon','mortar','cannon','mortar'],bellows_chain:['bellows','stake','cannon','apoth','mortar','mortar'],hex_chain:['hut','stake','cannon','apoth','mortar','mortar'],big_first:['mortar','mortar','cannon','cannon','apoth','stake'],economy:['post','granary','stake','cannon','mortar','mortar']}};
  const shares={};
  for(const name of ['mid','late']){ const names=Object.keys(layouts[name]), wins={}, per={}; names.forEach(n=>wins[n]=0); let tot=0;
    for(const key of SET){ const loc={}; for(let s=1;s<=Math.ceil(FN/2);s++){ let best=null,bv=-1e9; for(const n of names){ const r=runFight(build(name,s,layouts[name][n]),key,1,'think',s*13+7,undefined,estPower(build(name,s))); const v=(r.win?100:0)-r.taken*50-r.turns-r.left*50; if(v>bv){bv=v;best=n;} } wins[best]++; loc[best]=(loc[best]||0)+1; tot++; }
      per[key]=Object.entries(loc).sort((a,b)=>b[1]-a[1])[0][0]; }
    shares[name]=Object.fromEntries(names.map(n=>[n,wins[n]/tot]));
    if(print) console.log(`\n### Layouts, ${name} build, R=1: same absolute enemy for all layouts, share of enemy-and-seed pairings where each layout did best\n`+names.map(n=>`${n} ${pc(wins[n]/tot)}`).join(', ')+'\nbest per enemy: '+JSON.stringify(per));
  }
  return shares;
}
function summarize(label,rs){
  const min=m=>rs.map(r=>r.marks[m]==null?Infinity:r.marks[m]/60), gaps=[]; for(const r of rs) for(let i=1;i<r.bursts.length;i++) gaps.push((r.bursts[i]-r.bursts[i-1])/60);
  const band=k=>med(rs.map(r=>r.bands[k]/(r.bands.hi+r.bands.mid+r.bands.lo||1)));
  console.log(`\n### ${label} (${rs.length} seeds)`);
  console.log(`minutes to 1e6 ${med(min(1e6)).toFixed(0)} (${Math.min(...min(1e6)).toFixed(0)}-${Math.max(...min(1e6)).toFixed(0)}), 1e9 ${med(min(1e9)).toFixed(0)} (${Math.min(...min(1e9)).toFixed(0)}-${Math.max(...min(1e9)).toFixed(0)}), 1e12 ${med(min(1e12)).toFixed(0)} (${Math.min(...min(1e12)).toFixed(0)}-${Math.max(...min(1e12)).toFixed(0)}), 1e15 ${med(min(1e15)).toFixed(0)} (${Math.min(...min(1e15)).toFixed(0)}-${Math.max(...min(1e15)).toFixed(0)})`);
  console.log(`minutes between bursts: median ${q(gaps,.5).toFixed(1)}, p10 ${q(gaps,.1).toFixed(1)}, p90 ${q(gaps,.9).toFixed(1)} (n=${gaps.length})`);
  console.log(`time at R>=2 ${pc(band('hi'))}, R 1-2 ${pc(band('mid'))}, R<1 ${pc(band('lo'))}`);
  console.log(`trips ${med(rs.map(r=>r.P.trips))} (${Math.min(...rs.map(r=>r.P.trips))}-${Math.max(...rs.map(r=>r.P.trips))}), defeats ${med(rs.map(r=>r.P.defeats))}, retreats ${med(rs.map(r=>r.P.retreats))}, non-finite checks failed ${rs.reduce((s,r)=>s+r.nonFinite,0)}`);
  console.log(`median across trips of hand share of damage ${pc(med(rs.map(r=>med(r.handBy.map(x=>x.share)))))}, plays/turn ${med(rs.map(r=>r.plays/Math.max(1,r.turns))).toFixed(1)}, burns/turn ${med(rs.map(r=>r.burns/Math.max(1,r.turns))).toFixed(1)}, trip length min median ${med(rs.flatMap(r=>r.tripMins)).toFixed(1)}, power jump per trip median x${med(rs.flatMap(r=>r.log.map(l=>+l.jump))).toFixed(1)}`);
  return rs;
}
const games=(kind,o={})=>{ const out=[]; for(let s=1;s<=LN;s++) out.push(runGame(s*97+3,kind,{capMin:400,target:1e15,samples:+process.env.SAMPLES||16,...o})); return out; };
if(what==='decision'||what==='all') decision();
if(what!=='none'){ // Stress: far past the game's end, every number must stay finite, in the rules and through a save round trip.
  const P=build('late',5); for(const c of P.cards) if(c.key!=='deed') c.lvl=300; P.hearth=320; P.coin=1e200; const T=startTrip(P); T.f=1000; beginFight(P,T,{key:'bishop',hp:estPower(P)*2,atk:enemyAtk(1000)}); for(let i=0;i<6&&!T.F.over;i++) fixedTurn(P,T);
  console.log('Stress at level 300: power '+fmt(estPower(P))+', finite after six turns: '+(allFinite(P)&&allFinite(T))+', JSON round trip equal: '+(JSON.stringify(JSON.parse(JSON.stringify(T)))===JSON.stringify(T))); }
if(what==='ko'){ const t=r=>r.map(x=>x.marks[1e12]==null?Infinity:x.marks[1e12]/60); console.log('Knock-outs with every trip required to fight at least once, so a weak bot cannot sit in a march-and-go-home loop:'); const c=summarize('careful, must fight',games('careful',{mustFight:true})); for(const [n,o] of [['no sockets',{noSock:true}],['no Charge',{noCharge:true}],['never buys the Wheel',{noWheel:true}]]){ const r=summarize(n+', must fight',games('careful',{mustFight:true,...o})); console.log(n+' / careful, minutes to 1e12: x'+(med(t(r))/med(t(c))).toFixed(2)); } }
if(what==='quick'){ const t=r=>r.map(x=>x.marks[1e12]==null?Infinity:x.marks[1e12]/60); const c=summarize('careful',games('careful')); for(const [n,o] of [['noWheel',{noWheel:true}],['noCharge',{noCharge:true}]]){ const r=summarize(n,games('careful',o)); console.log(n+' x'+(med(t(r))/med(t(c))).toFixed(2)); } }
if(what==='loop'||what==='depth'||what==='all'){
  console.log('\n## 2. Whole-loop pacing, 15 s per played turn');
  const car=summarize('careful upgrades, think fight bot',games('careful'));
  console.log('\nOne run, trip by trip:'); for(const l of car[0].log) console.log(JSON.stringify(l).replace(/"/g,''));
  console.log('\n## 3. Optimisation depth');
  const nav=summarize('naive upgrades (cheapest first, random sockets, first caravan card, never retreats), same fight bot',games('naive'));
  const t=r=>r.map(x=>x.marks[1e12]==null?Infinity:x.marks[1e12]/60);
  console.log(`\nMedian minutes to 1e12: careful ${med(t(car)).toFixed(0)}, naive ${med(t(nav)).toFixed(0)}, ratio x${(med(t(nav))/med(t(car))).toFixed(2)}. Per seed: ${t(car).map((c,i)=>(t(nav)[i]/c).toFixed(2)).join(', ')}`);
  const fx=summarize('careful upgrades, fixed fight bot (how much does in-fight thinking matter over the whole loop?)',games('careful',{fightBot:'fixed'}));
  console.log(`\nfixed fight bot / think fight bot, minutes to 1e12: x${(med(t(fx))/med(t(car))).toFixed(2)}`);
  const ns=summarize('careful upgrades but no sockets at all',games('careful',{noSock:true}));
  console.log(`\nno sockets / careful, minutes to 1e12: x${(med(t(ns))/med(t(car))).toFixed(2)}`);
  const nc=summarize('careful upgrades but no Charge perk',games('careful',{noCharge:true}));
  console.log(`\nno Charge / careful, minutes to 1e12: x${(med(t(nc))/med(t(car))).toFixed(2)}`);
  const nd=summarize('careful upgrades but never buys the Wheel',games('careful',{noWheel:true}));
  console.log(`\nno Wheel buying / careful, minutes to 1e12: x${(med(t(nd))/med(t(car))).toFixed(2)}`);
  // Retreat policy: dying must never out-earn leaving.
  console.log('\n### Retreat policy, careful upgrades: minutes to 1e12 by when the bot chooses to leave');
  for(const R of [1.2,1,.75,.5,0]){ const rs=games('careful',{retreatR:R||.0001,neverRetreat:R===0}); console.log(`retreat when next R< ${R}: minutes to 1e12 ${med(t(rs)).toFixed(0)}, trips ${med(rs.map(r=>r.P.trips))}, defeats ${med(rs.map(r=>r.P.defeats))}`); }
  { const rs=games('careful',{farm:true,capMin:200}); console.log(`march-and-go-home farming (fights only when nothing can be marched; 200 min cap): minutes to 1e12 ${med(t(rs)).toFixed(0)}, 1e9 ${med(rs.map(r=>r.marks[1e9]==null?Infinity:r.marks[1e9]/60)).toFixed(0)}, trips ${med(rs.map(r=>r.P.trips))}`); }
}
module.exports={BUILDS,build,cell,SET,layoutTest};
