"use strict";
/* ==========================================================
   Coinkeep: Forays. The rules, with no DOM.
   P is the permanent profile. T is the trip, with T.F the current fight.
   Both are plain JSON. The UI and the sim call the same functions.
   ========================================================== */

/* ---------- profile ---------- */
function newProfile(seed){
  const P={v:1,seed:seed|0,coin:0,deepest:-1,wheel:1,hearth:0,mag:0,ledger:0,slots:2,energy:TUNE.energyBase,hand:TUNE.handBase,extraSock:0,
    nid:1,cards:[],layout:[],caravans:{},bosses:{},rewards:[],trips:0,defeats:0,retreats:0,secs:0,bestRate:0,nemesis:null,last:null,bursts:0};
  for(const k of ['fork','fork','fork','helm','helm','scoop','keg','errand']) addCard(P,k,0,true);
  P.layout=[addCard(P,'cannon',0,true).id,addCard(P,'stake',0,true).id];
  return P;
}
function addCard(P,key,lvl,packed){ const c={id:P.nid++,key,lvl:lvl||0,sock:[],packed:!!packed}; P.cards.push(c); return c; }
function grantSlot(P){ P.slots++; addCard(P,'deed',0,packedCount(P)<TUNE.deckMax); }
const cardOf=(P,id)=>{ for(const c of P.cards) if(c.id===id) return c; return RUBBLE; };
const RUBBLE={id:-1,key:'rubble',lvl:0,sock:[]};
const has=(c,k)=>c.sock.includes(k);
const isPiece=c=>!!CARDS[c.key].piece;
function deedsPacked(P){ let n=0; for(const c of P.cards) if(c.key==='deed'&&c.packed) n++; return n; }
function slotsOpen(P){ return TUNE.junk==='none'?P.slots:Math.min(P.slots,2+deedsPacked(P)); }
const onBoard=(P,id)=>P.layout.indexOf(id)>=0&&P.layout.indexOf(id)<slotsOpen(P);
function packList(P){ return P.cards.filter(c=>c.packed&&!onBoard(P,c.id)); }
function packedCount(P){ return packList(P).length; }

/* ---------- values ---------- */
const valMult=c=>Math.pow(TUNE.valG,c.lvl)*Math.pow(TUNE.mileX,Math.floor(c.lvl/TUNE.mileEvery))*(has(c,'keen')?3:1);
const defMult=c=>Math.pow(TUNE.defG,c.lvl)*(has(c,'keen')?2:1);
function fxAmount(c,kind,base){
  if(kind==='dmg'||kind==='poison') return base*valMult(c);
  if(kind==='block') return base*defMult(c);
  if(kind==='coin') return base*(1+.04*c.lvl)*(has(c,'keen')?2:1);
  return base;
}
const pieceHp=c=>CARDS[c.key].hp*defMult(c)*(has(c,'bulwark')?8:1);
const pieceNeed=c=>Math.max(1,CARDS[c.key].need-(has(c,'light')?1:0));
const cardCost=c=>Math.max(0,CARDS[c.key].cost-(!isPiece(c)&&has(c,'light')?1:0));
const stokeOf=c=>{ const d=CARDS[c.key]; return (d.stoke==null?(TUNE.burnFlat?1:d.cost+1):d.stoke)+(has(c,'fuel')?2:0); };
const maxHpOf=P=>TUNE.baseHp*Math.pow(TUNE.defG,P.hearth);
function socketsOpen(P,c){ let n=0; for(const a of TUNE.sockAt) if(c.lvl>=a) n++; if(P.extraSock&&c.lvl>=60) n++; return n; }
function describe(c){
  let s=CARDS[c.key].text;
  for(const [k,b] of CARDS[c.key].fx) s=s.replace('{'+k+'}',k==='coin'?Math.round(fxAmount(c,k,b)*100)+'%':fmt(fxAmount(c,k,b)));
  return s;
}

/* ---------- enemy curve ---------- */
const isBossF=f=>f%TUNE.bossEvery===TUNE.bossEvery-1;
const isCaravanF=f=>f>0&&f%TUNE.caravanEvery===0;
function enemyKey(P,f){
  if(isBossF(f)) return BOSS_ORDER[Math.floor(f/TUNE.bossEvery)%BOSS_ORDER.length];
  const pool=ENEMY_POOL.filter(k=>ENEMIES[k].min<=f);
  return pool[Math.floor(hash01(P.seed,f)*pool.length)];
}
const baseHpAt=f=>TUNE.hp0*Math.pow(TUNE.hpG,f);
const enemyHp=(P,f)=>baseHpAt(f)*ENEMIES[enemyKey(P,f)].hp*(isBossF(f)?TUNE.bossHp:1);
const enemyAtk=f=>TUNE.atk0*Math.pow(TUNE.atkG,f);
const coinMult=P=>Math.pow(TUNE.ledgerX,P.ledger);
const bounty=(P,f)=>TUNE.coin0*Math.pow(TUNE.coinG,f)*(isBossF(f)?TUNE.bossCoin:1)*coinMult(P);

/* Power estimate: damage over three turns if the Powder falls as expected. R = this / enemy health.
   It walks the real feed for a few turns, because a Charge chain pays only when it completes inside one turn. */
function feedWalk(P,X,top,hf){
  const ps=[]; for(const id of P.layout.slice(0,slotsOpen(P))){ if(!id) continue; const c=cardOf(P,id), d=CARDS[c.key]; if(!d) continue;
    let pay=0; for(const [k,b] of d.fx){ if(k==='dmg') pay+=fxAmount(c,k,b); else if(k==='poison') pay+=fxAmount(c,k,b)*1.5; }
    ps.push({need:pieceNeed(c),max:has(c,'twin')?2:1,pay,scaled:d.fx.some(([k])=>k==='dmg'||k==='block'||k==='poison'),charge:has(c,'charge'),relay:has(c,'relay'),fill:0}); }
  let total=0,carry=0,mag=0; const W=6,magCap=TUNE.magBase+P.mag;
  for(let t=0;t<W;t++){
    let rem=X+carry+mag; mag=0; carry=rem-Math.floor(rem); rem=Math.floor(rem); let whet=1;
    for(const p of ps){ let fires=0; while(rem>0&&fires<p.max){ const take=Math.min(rem,p.need-p.fill); p.fill+=take; rem-=take; if(p.fill<p.need) break; p.fill=0; fires++;
        total+=p.pay*(p.scaled?whet:1); if(p.scaled) whet=p.charge?whet*3:1; if(p.relay) rem+=1; } }
    mag=Math.min(rem,magCap);
    if(whet>1) total+=top*hf*(whet-1);
  }
  return total/W;
}
function estPower(P){
  const deck=packList(P); const hf=Math.min(1,P.hand/Math.max(1,deck.length));
  const opts=[]; let stokeSum=0,stokeN=0;
  for(const c of deck){ const d=CARDS[c.key]; stokeSum+=stokeOf(c); stokeN++; if(d.piece||d.junk) continue;
    let dmg=0; for(const [k,b] of d.fx) if(k==='dmg') dmg+=fxAmount(c,k,b); else if(k==='poison') dmg+=fxAmount(c,k,b)*1.5;
    if(has(c,'echo')) dmg*=2; if(has(c,'flurry')) dmg*=2; opts.push({dmg,cost:cardCost(c)}); }
  opts.sort((a,b)=>b.dmg/Math.max(.5,b.cost)-a.dmg/Math.max(.5,a.cost));
  let E=P.energy,hand=0,plays=0,top=0;
  for(const o of opts){ if(o.cost<=P.energy&&o.dmg>top) top=o.dmg; if(E<=0) continue; const fr=o.cost?Math.min(hf,E/o.cost):hf; hand+=o.dmg*fr; E-=o.cost*fr; plays+=fr; }
  const avg=stokeN?stokeSum/stokeN:1, feed=TUNE.feed;
  const extra=feed==='wheel'?3:0;
  // Two ways to run a turn: play what energy allows and burn the rest, or burn nearly everything for the board.
  const mixed=hand+feedWalk(P,P.wheel+extra+(feed==='stoke'?Math.max(0,P.hand-plays)*avg*.8:0),top,hf);
  const burn=feed==='stoke'?feedWalk(P,P.wheel+Math.max(0,P.hand-1)*avg*.8,top,hf):0;
  return num(3*Math.max(mixed,burn));
}
const ratioAt=(P,f)=>estPower(P)/enemyHp(P,f);
/* Odds shown to the player: offence alone overstates a late fight, because a bastion that dies each turn cuts the chain and a boss rule (a seal, a sweep) costs links.
   A heuristic: the lesser of offence (halved for bosses, reduced when the front bastion falls to one hit) and toughness against about four hits. */
function toughness(P){ let d=maxHpOf(P); for(const c of P.cards){ const on=onBoard(P,c.id); if(!c.packed&&!on) continue; for(const [k,x] of CARDS[c.key].fx) if(k==='block') d+=fxAmount(c,k,x)*.8; if(on) d+=pieceHp(c)*.3; } return d; }
function oddsAt(P,f){ const boss=isBossF(f), hit=enemyAtk(f)*(boss?1.3:1); let off=ratioAt(P,f)/(boss?2:1);
  const ids=P.layout.slice(0,slotsOpen(P)).filter(Boolean); if(ids.length){ const cs=ids.map(id=>cardOf(P,id)), front=cs.find(c=>CARDS[c.key].taunt)||cs[0], fh=pieceHp(front); if(hit>fh) off/=Math.sqrt(hit/fh); }
  return Math.min(off,toughness(P)/(hit*4)); }
// The deepest fight a march reaches right now, for the home screen's preview.
// A march sweeps what your machine clears on Wheel Powder alone in about three turns, or anything you utterly outclass.
const machineDmg=P=>3*feedWalk(P,P.wheel,0,0);
function canMarch(P,f,p,m){ const hp=enemyHp(P,f); return p/hp>=TUNE.marchR||m/hp>=TUNE.marchMachine; }
function marchReach(P){ const p=estPower(P), m=machineDmg(P); let f=0; while(f<400&&canMarch(P,f,p,m)&&(!isBossF(f)||P.bosses[f])&&(!isCaravanF(f)||P.caravans[f])) f++; return f; }

/* ---------- trip ---------- */
function startTrip(P){
  P.trips++;
  const maxHp=maxHpOf(P);
  const T={f:0,hp:maxHp,maxHp,coin:0,board:[],phase:'prefight',F:null,ev:[],stat:{turns:0,fights:0,marched:0,dmgHand:0,dmgBoard:0,taken:0,waste:0,blocked:0,lost:0,start:P.secs},marchList:[],rngSeed:(P.seed*31+P.trips*7919)|0};
  for(const id of P.layout.slice(0,slotsOpen(P))){ if(!id) continue; T.board.push(newPiece(P,id)); }
  tripAdvance(P,T);
  return T;
}
function newPiece(P,id){ const c=cardOf(P,id); const hp=pieceHp(c); return {id,hp,maxHp:hp,fill:0,fires:0,sealed:false}; }
// March past what you already outclass, stopping at an unseen caravan, an unbeaten boss, or the first real fight.
function tripAdvance(P,T){
  const p=estPower(P), m=machineDmg(P); T.marchList=[];
  for(;;){
    if(isCaravanF(T.f)&&!P.caravans[T.f]){ T.phase='caravan'; T.offer=caravanOffer(P,T.f); return; }
    const boss=isBossF(T.f);
    if(boss&&!P.bosses[T.f]) break;
    if(!canMarch(P,T.f,p,m)) break;
    const b=bounty(P,T.f), hp=enemyHp(P,T.f);
    const paid=b*TUNE.marchCoin; T.coin=num(T.coin+paid); T.marchList.push({f:T.f,key:enemyKey(P,T.f),hp,over:p/3/hp,coin:paid}); T.stat.marched++;
    if(T.f>P.deepest) P.deepest=T.f;
    T.f++;
  }
  T.phase='prefight';
}
/* Caravan: three cards, level set by how far you have come, so the shop scales with you. One chance, one purchase. */
function caravanOffer(P,f){
  const lvl=caravanLevel(P), pool=SHOP_POOL.slice(), out=[];
  for(let i=0;i<3;i++){ const j=Math.floor(hash01(P.seed+i*97,f)*pool.length); out.push({key:pool.splice(j,1)[0],lvl}); }
  return {f,items:out,price:TUNE.caravanPrice*bounty(P,f-1)};
}
function caravanLevel(P){ const ls=P.cards.filter(c=>c.key!=='deed').map(c=>c.lvl).sort((a,b)=>b-a).slice(0,6); return Math.max(0,Math.floor(ls.reduce((a,b)=>a+b,0)/Math.max(1,ls.length))-2); }
function caravanBuy(P,T,i){
  const o=T.offer; if(!o||i<0||i>=o.items.length) return false;
  const have=T.coin+P.coin; if(have<o.price) return false;
  const fromTrip=Math.min(T.coin,o.price); T.coin-=fromTrip; P.coin-=o.price-fromTrip;
  const it=o.items[i]; addCard(P,it.key,it.lvl,false);
  P.caravans[T.f]=1; T.offer=null; P.bursts++; tripAdvance(P,T); return true;
}
function caravanLeave(P,T){ P.caravans[T.f]=1; T.offer=null; tripAdvance(P,T); }

function beginFight(P,T,ov){
  const f=T.f, key=ov?ov.key:enemyKey(P,f), def=ENEMIES[key], hp0=ov?ov.hp:enemyHp(P,f);
  const deck=packList(P).filter(c=>!T.board.some(b=>b.id===c.id)).map(c=>c.id);
  const F={key,f,enemy:{hp:hp0,maxHp:hp0,poison:0,hex:0,wardUp:0,atk:ov?ov.atk:enemyAtk(f)},turn:0,energy:0,block:0,mag:0,aim:0,whet:0,queue:0,pumping:false,
    draw:deck,hand:[],disc:[],boost:{},over:null,intent:[],rng:(T.rngSeed+f*131+T.stat.fights*17)|0,fightStart:T.stat.turns};
  T.F=F; T.phase='fight'; T.stat.fights++;
  shuffle(F,F.draw);
  for(const b of T.board){ b.fires=0; b.sealed=false; b.fill=has(cardOf(P,b.id),'primed')?pieceNeed(cardOf(P,b.id))-1:b.fill; }
  startTurn(P,T);
}
function shuffle(F,a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(rng32(F,'rng')*(i+1)); const t=a[i];a[i]=a[j];a[j]=t; } }
function drawCards(F,n,reshuffle){
  while(n>0){
    if(!F.draw.length){ if(!reshuffle||!F.disc.length) return; F.draw=F.disc.filter(id=>id!==-1); F.disc=[]; shuffle(F,F.draw); if(!F.draw.length) return; }
    F.hand.push(F.draw.pop()); n--;
  }
}
function startTurn(P,T){
  const F=T.F, def=ENEMIES[F.key];
  F.turn++; F.energy=P.energy; F.block=0; F.whet=0; F.aim=0; F.plays=0; T.stat.turns++;
  F.enemy.wardUp=def.ward||0;
  for(const b of T.board){ b.fires=0; b.sealed=false; }
  const kept=F.hand.length; drawCards(F,Math.max(0,P.hand-kept),true);
  F.intent=def.intent(F.turn);
  for(const a of F.intent) if(a.seal&&T.board.length) T.board[0].sealed=true;
  const m=F.mag; F.mag=0; addPowder(P,T,m+P.wheel+(TUNE.feed==='wheel'?3:0),'wheel');
}
function feedTarget(P,T){
  const F=T.F, ok=b=>!b.sealed&&b.fires<(has(cardOf(P,b.id),'twin')?2:1);
  if(F.aim>0){ for(let i=T.board.length-1;i>=0;i--) if(ok(T.board[i])){ F.aim--; return T.board[i]; } }
  for(const b of T.board) if(ok(b)) return b;
  return null;
}
function addPowder(P,T,n,src){
  const F=T.F; F.queue+=n; if(F.pumping) return; F.pumping=true;
  while(F.queue>0){
    F.queue--; if(F.over) continue;
    const b=feedTarget(P,T);
    if(!b){ if(F.mag<TUNE.magBase+P.mag) F.mag++; else { T.stat.waste++; if(T.ev) T.ev.push({t:'waste'}); } continue; }
    b.fill++; if(T.ev) T.ev.push({t:'feed',id:b.id});
    if(b.fill>=pieceNeed(cardOf(P,b.id))){ b.fill=0; b.fires++; firePiece(P,T,b); }
  }
  F.pumping=false;
}
function firePiece(P,T,b){
  const F=T.F, c=cardOf(P,b.id), d=CARDS[c.key], scaled=d.fx.some(([k])=>k==='dmg'||k==='block'||k==='poison'); let mul=scaled?(F.whet||1):1; if(scaled) F.whet=0;
  if(TUNE.junk==='hold') for(const id of F.hand) if(cardOf(P,id).key==='deed') mul*=1.5;
  if(T.ev) T.ev.push({t:'fire',id:b.id});
  for(const [k,a] of d.fx) applyFx(P,T,k,a,c,mul,'board',b);
  if(has(c,'charge')&&scaled) F.whet=mul*3;
  if(has(c,'relay')) addPowder(P,T,1,'relay');
}
function applyFx(P,T,kind,base,c,mul,src,b){
  const F=T.F; if(F.over) return;
  const amt=fxAmount(c,kind,base)*(mul||1);
  switch(kind){
    case 'dmg': hitEnemy(P,T,amt,src,c); break;
    case 'block': F.block=num(F.block+amt); if(T.ev) T.ev.push({t:'block',n:amt}); break;
    case 'poison': F.enemy.poison=num(F.enemy.poison+amt); if(T.ev) T.ev.push({t:'poison',n:amt}); break;
    case 'hex': F.enemy.hex+=amt/(mul||1); break;
    case 'coin': { const g=bounty(P,F.f)*amt; T.coin=num(T.coin+g); if(T.ev) T.ev.push({t:'coin',n:g}); break; }
    case 'powder': addPowder(P,T,amt/(mul||1),src); break;
    case 'draw': drawCards(F,amt/(mul||1),false); break;
    case 'energy': F.energy+=amt/(mul||1); break;
    case 'repair': for(const x of T.board) x.hp=Math.min(x.maxHp,x.hp+x.maxHp*base); break;
    case 'selfrepair': b.hp=Math.min(b.maxHp,b.hp+b.maxHp*base); break;
    case 'whet': F.whet=(F.whet||1)*3; break;
    case 'aim': F.aim+=base; break;
    case 'trigger': { const x=T.board.find(y=>!y.sealed&&y.fires<(has(cardOf(P,y.id),'twin')?2:1)); if(x){ x.fires++; firePiece(P,T,x); } break; }
    case 'rotate': if(T.board.length>1) T.board.push(T.board.shift()); break;
    case 'anvil': { let top=null,tv=0; for(const id of F.hand){ const o=cardOf(P,id); if(o.id===c.id||CARDS[o.key].junk||CARDS[o.key].piece) continue; const v=CARDS[o.key].fx.reduce((s,[k,x])=>s+((k==='dmg'||k==='block'||k==='poison')?fxAmount(o,k,x):0),0); if(v>tv){tv=v;top=o;} } if(top) F.boost[top.id]=(F.boost[top.id]||1)*3; break; }
  }
}
function hitEnemy(P,T,amt,src,c){
  const F=T.F, e=F.enemy;
  if(e.wardUp>0){ e.wardUp--; if(T.ev) T.ev.push({t:'warded'}); return; }
  e.hp=num(e.hp-amt);
  if(src==='board') T.stat.dmgBoard=num(T.stat.dmgBoard+amt); else T.stat.dmgHand=num(T.stat.dmgHand+amt);
  if(T.ev) T.ev.push({t:'dmg',n:amt,src,over:e.hp<=0?amt/Math.max(1,e.maxHp):0});
  checkWin(P,T);
}
function checkWin(P,T){
  const F=T.F; if(F.over||F.enemy.hp>0) return;
  F.over='win'; const b=bounty(P,F.f); T.coin=num(T.coin+b); F.reward=b;
  const boss=isBossF(F.f), first=boss&&!P.bosses[F.f];
  if(!T.sim){ if(F.f>P.deepest) P.deepest=F.f; if(boss) P.bosses[F.f]=1; if(first) P.bursts++; }
  T.hp=Math.min(T.maxHp,T.hp+T.maxHp*TUNE.healAfter);
  for(const b2 of T.board){ b2.hp=Math.min(b2.maxHp,b2.hp+b2.maxHp*TUNE.repairAfter); }
  T.f++; const offer=first&&!T.sim?rewardOffer(P,F.f):null; T.phase=first&&(T.sim||offer.length)?'bossreward':'postfight';
  if(offer) T.offer={rewards:offer}; if(first&&!T.sim&&F.f>=TUNE.finalFight) P.won=true;
  if(P.nemesis&&P.nemesis.f===F.f) T.nemesisFell=true;
}
function rewardOffer(P,f){
  const ok=Object.keys(REWARDS).filter(k=>!P.rewards.includes(k)&&(!REWARDS[k].after||P.rewards.includes(REWARDS[k].after)));
  const out=[],pool=ok.slice();
  if(pool.includes('slot1')&&!P.rewards.length){ out.push('slot1'); pool.splice(pool.indexOf('slot1'),1); }
  for(let i=0;out.length<3&&pool.length;i++){ const j=Math.floor(hash01(P.seed+i*53,f)*pool.length); out.push(pool.splice(j,1)[0]); }
  return out;
}
function takeReward(P,T,key){ P.rewards.push(key); REWARDS[key].on(P); T.offer=null; T.phase='postfight'; }

/* ---------- player actions: {a:'play',i,at} {a:'burn',i} {a:'swap',i} {a:'end'} ---------- */
function canPlay(P,T,i){
  const F=T.F, c=cardOf(P,F.hand[i]), d=CARDS[c.key];
  if(d.junk||F.energy<cardCost(c)) return false;
  if(d.piece&&T.board.length>=slotsOpen(P)) return false;
  return true;
}
function canBurn(P,T,i){ return TUNE.feed==='stoke'||CARDS[cardOf(P,T.F.hand[i]).key].junk; }
function doAction(P,T,m){
  const F=T.F; if(!F||F.over) return false;
  if(m.a==='play'){
    if(!canPlay(P,T,m.i)) return false;
    const id=F.hand[m.i], c=cardOf(P,id), d=CARDS[c.key]; F.energy-=cardCost(c); F.hand.splice(m.i,1);
    if(d.piece){ const at=m.at==null?T.board.length:clamp(m.at,0,T.board.length); T.board.splice(at,0,newPiece(P,id)); if(T.ev) T.ev.push({t:'deploy',id}); return true; }
    F.plays++; T.stat.plays=(T.stat.plays||0)+1; let mul=(F.boost[id]||1)*(has(c,'flurry')?F.plays:1); const reps=has(c,'echo')?2:1;
    if(F.whet>1&&d.fx.some(([k])=>k==='dmg'||k==='poison')){ mul*=F.whet; F.whet=0; } // a charge carries into your next attack card as well
    for(let r=0;r<reps;r++) for(const [k,a] of d.fx) applyFx(P,T,k,a,c,mul,'hand');
    if(has(c,'swift')) drawCards(F,1,false);
    if(!d.temp) F.disc.push(id);
  } else if(m.a==='burn'){
    if(!canBurn(P,T,m.i)) return false;
    const id=F.hand[m.i], c=cardOf(P,id), d=CARDS[c.key]; F.hand.splice(m.i,1);
    if(!d.temp) F.disc.push(id);
    T.stat.burns=(T.stat.burns||0)+1; const n=stokeOf(c); if(n) addPowder(P,T,n,'burn');
    if(T.ev) T.ev.push({t:'burn',n});
  } else if(m.a==='swap'){
    if(F.energy<TUNE.swapCost||m.i<0||m.i+1>=T.board.length) return false;
    F.energy-=TUNE.swapCost; const b=T.board; const t=b[m.i]; b[m.i]=b[m.i+1]; b[m.i+1]=t;
  } else if(m.a==='end'){ endTurn(P,T); }
  return true;
}
function endTurn(P,T){
  const F=T.F, def=ENEMIES[F.key], e=F.enemy;
  // Hand goes to the discard, except what stays (Wards) and what vanishes (Rubble stays too: it clogs until burned).
  const keep=[]; for(const id of F.hand){ const c=cardOf(P,id), d=CARDS[c.key]; if(d.stays||d.temp) keep.push(id); else F.disc.push(id); }
  F.hand=keep;
  // Blight, then wards in the discard.
  if(e.poison>0){ const n=e.poison; e.hp=num(e.hp-n); T.stat.dmgBoard=num(T.stat.dmgBoard+n); if(T.ev) T.ev.push({t:'dmg',n,src:'poison'}); e.poison=e.poison<1?0:e.poison/2; checkWin(P,T); if(F.over) return; }
  let wards=0; for(const id of F.disc) if(cardOf(P,id).key==='ward') wards++;
  if(wards){ e.hp=num(e.hp-e.maxHp*wards*(def.boss?.01:.03)); checkWin(P,T); if(F.over) return; }
  // Enemy acts.
  enemyActs(P,T);
  if(F.over) return;
  if(def.flee&&F.turn>=def.flee){ T.coin=T.coin*.9; F.over='fled'; T.f++; T.phase='postfight'; if(T.ev) T.ev.push({t:'fled'}); return; }
  startTurn(P,T);
}
function enrage(F,def){ let m=1; if(F.turn>TUNE.enrageAfter) m*=Math.pow(TUNE.enrageX,F.turn-TUNE.enrageAfter); if(def.grow) m*=Math.pow(def.grow,F.turn-1); return m; }
function intentHit(F,a){ return F.enemy.atk*a.hit*enrage(F,ENEMIES[F.key]); }
function enemyActs(P,T){
  const F=T.F, def=ENEMIES[F.key];
  for(const a of F.intent){
    if(a.drain){ if(T.board.length) T.board[0].fill=0; F.mag=0; if(T.ev) T.ev.push({t:'drain'}); }
    if(a.rubble) for(let i=0;i<a.rubble;i++) F.hand.push(-1);
    if(a.hit){
      if(a.at==='all'){ for(const b of T.board.slice()) strike(P,T,intentHit(F,a),'one',b); strikeYou(P,T,intentHit(F,a)*.5); }
      else strike(P,T,intentHit(F,a),a.at);
    }
    if(T.hp<=0){ T.hp=0; F.over='loss'; T.phase='defeat'; if(T.ev) T.ev.push({t:'dead'}); return; }
  }
}
function absorb(T,F,amt){ if(F.enemy.hex>0){ F.enemy.hex--; amt/=2; } const b=Math.min(F.block,amt); F.block-=b; T.stat.blocked=num(T.stat.blocked+b); return amt-b; }
function strike(P,T,amt,at,only){
  const F=T.F; let left=absorb(T,F,amt);
  while(left>0){
    let tgt=only||null;
    if(!only){
      if(at==='you'||!T.board.length) return strikeYou(P,T,left);
      if(at==='left'){ tgt=T.board.find(b=>CARDS[cardOf(P,b.id).key].taunt)||T.board[0]; }
      if(at==='right') tgt=T.board[T.board.length-1];
    } else if(!T.board.includes(only)) return;
    const hit=Math.min(left,tgt.hp); tgt.hp-=hit; left-=hit; if(T.ev) T.ev.push({t:'hurt',id:tgt.id,n:hit});
    if(tgt.hp<=0){ T.board.splice(T.board.indexOf(tgt),1); F.disc.push(tgt.id); T.stat.lost++; if(T.ev) T.ev.push({t:'lost',id:tgt.id}); }
    if(only) return;
  }
}
function strikeYou(P,T,amt){ const F=T.F; T.hp=num(T.hp-amt); T.stat.taken=num(T.stat.taken+amt); if(T.ev) T.ev.push({t:'you',n:amt}); if(T.hp<=0){ T.hp=0; if(!F.over){ F.over='loss'; T.phase='defeat'; } } }

/* End of trip. Retreat keeps everything; defeat keeps 70%. Nothing else is ever lost. */
function endTrip(P,T,how){
  const rate=how==='defeat'?TUNE.defeatKeep:1, got=num(T.coin*rate);
  P.coin=num(P.coin+got); P.last={how,got,lost:T.coin-got,f:T.f,fights:T.stat.fights,marched:T.stat.marched,turns:T.stat.turns,lostPieces:T.stat.lost};
  if(how==='defeat'){ P.defeats++; const F=T.F, key=F?F.key:enemyKey(P,T.f); P.nemesis={f:T.f,key,left:F?F.enemy.hp/F.enemy.maxHp:1}; P.last.needed=F?Math.max(1,enemyHp(P,T.f)/Math.max(1,estPower(P)/3)):1; }
  else P.retreats++;
  P.lastSeen=P.secs;
  return P.last;
}

/* ---------- home purchases ---------- */
function levelCost(c){ return TUNE.cost0*(CARDS[c.key].piece?TUNE.pieceCostX:1)*Math.pow(TUNE.costG,c.lvl); }
const hearthCost=P=>TUNE.hearthCost*Math.pow(TUNE.hearthG,P.hearth);
const wheelCost=P=>TUNE.wheelCost*Math.pow(TUNE.wheelG,P.wheelBuys||0);
const magCost=P=>TUNE.magCost*Math.pow(TUNE.magG,P.magBuys||0);
const ledgerCost=P=>TUNE.ledgerCost*Math.pow(TUNE.ledgerG,P.ledger);
function buyLevel(P,id){ const c=cardOf(P,id), k=levelCost(c); if(P.coin<k||c.key==='deed'||c.key==='ward') return false; P.coin-=k; c.lvl++; return true; }
function buyKeep(P,what){
  const k={hearth:hearthCost,wheel:wheelCost,mag:magCost,ledger:ledgerCost}[what](P);
  if(P.coin<k) return false; P.coin-=k;
  if(what==='hearth') P.hearth++; else if(what==='wheel'){ P.wheel++; P.wheelBuys=(P.wheelBuys||0)+1; }
  else if(what==='mag'){ P.mag++; P.magBuys=(P.magBuys||0)+1; } else P.ledger++;
  return true;
}
function setSocket(P,id,idx,perk){ const c=cardOf(P,id); if(idx>=socketsOpen(P,c)) return false; if(perk&&c.sock.includes(perk)) return false;
  if(perk&&!perkFits(perk,c)) return false; if(perk) c.sock[idx]=perk; else c.sock.splice(idx,1); c.sock=c.sock.filter(Boolean); return true; }
function perkFits(perk,c){ const f=PERKS[perk].for; if(perk==='charge'&&!CARDS[c.key].fx.some(([k])=>k==='dmg'||k==='block'||k==='poison')) return false; return f==='both'||(f==='piece')===isPiece(c); }
function togglePack(P,id){ const c=cardOf(P,id); if(onBoard(P,id)) return false;
  const cnt=packedCount(P);
  if(c.packed){ if(cnt<=TUNE.deckMin) return false; c.packed=false; } else { if(cnt>=TUNE.deckMax) return false; c.packed=true; }
  return true; }
// Board layout: move to a slot, or take off the board.
function placePiece(P,id,slot){ const i=P.layout.indexOf(id); if(i>=0) P.layout.splice(i,1); if(slot!=null){ P.layout.splice(clamp(slot,0,P.layout.length),0,id); cardOf(P,id).packed=true; } return true; }

/* ---------- the simple policy: the Auto button and the sim's fixed bot ---------- */
function fixedMove(P,T){
  const F=T.F, hand=F.hand; if(F.over) return null;
  let best=-1,bv=-1;
  for(let i=0;i<hand.length;i++){ if(!canPlay(P,T,i)) continue; const c=cardOf(P,hand[i]),d=CARDS[c.key];
    let v=d.piece?1e308:0; for(const [k,x] of d.fx){ if(k==='dmg') v+=4; if(k==='poison') v+=3; if(k==='powder') v+=2; if(k==='draw'||k==='energy') v+=2.5; if(k==='block') v+=1; }
    v+=.1*(i===0); if(v>bv&&v>0){ bv=v; best=i; } }
  if(best>=0) return {a:'play',i:best};
  for(let i=0;i<hand.length;i++) if(canBurn(P,T,i)&&(stokeOf(cardOf(P,hand[i]))>0||CARDS[cardOf(P,hand[i]).key].temp)) return {a:'burn',i};
  return {a:'end'};
}
function fixedTurn(P,T){ const F=T.F, turn=F.turn; let n=0; while(T.F===F&&!F.over&&F.turn===turn&&n++<60){ const m=fixedMove(P,T); if(!m) break; doAction(P,T,m); if(m.a==='end') break; } }

/* Scan any object for a non-finite number: the sim's guard, and the save's validator. */
function allFinite(o){ if(typeof o==='number') return Number.isFinite(o); if(o&&typeof o==='object'){ for(const k in o) if(!allFinite(o[k])) return false; } return true; }
