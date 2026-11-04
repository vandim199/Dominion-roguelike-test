"use strict";
/* ==========================================================
   Coinkeep: Forays (tap the deck). The rules, with no DOM.
   P is the permanent profile. T is the trip, with T.F the current fight.
   Both are plain JSON. The UI and the sim call the same functions.
   A fight runs in real time: tapDeck() plays the top card, tick(dt) moves the clock.
   ========================================================== */

/* ---------- profile ---------- */
function newProfile(seed){
  const P={v:2,seed:seed|0,coin:0,deepest:-1,wheel:1,hearth:0,auto:0,autoBuys:0,ledger:0,slots:TUNE.startBoard.length,extraSock:0,comboCap:TUNE.comboCap,crit:TUNE.critChance,shuffleX:1,
    nid:1,cards:[],layout:[],caravans:{},bosses:{},rewards:[],trips:0,defeats:0,retreats:0,secs:0,bestRate:0,nemesis:null,last:null,bursts:0};
  for(const k of TUNE.startDeck) addCard(P,k,0,true);
  P.layout=TUNE.startBoard.map(k=>addCard(P,k,0,true).id);
  return P;
}
function addCard(P,key,lvl,packed){ const c={id:P.nid++,key,lvl:lvl||0,sock:[],packed:!!packed}; P.cards.push(c); return c; }
function grantSlot(P){ P.slots++; addCard(P,'deed',0,packedCount(P)<TUNE.deckMax); }
const RUBBLE={id:-1,key:'rubble',lvl:0,sock:[]};
const cardOf=(P,id)=>{ for(const c of P.cards) if(c.id===id) return c; return RUBBLE; };
const has=(c,k)=>c.sock.includes(k);
const isPiece=c=>!!CARDS[c.key].piece;
const isAtkCard=key=>CARDS[key].fx.some(([k])=>ATK[k]);
function deedsPacked(P){ let n=0; for(const c of P.cards) if(c.key==='deed'&&c.packed) n++; return n; }
function slotsOpen(P){ return TUNE.junk==='none'?P.slots:Math.min(P.slots,TUNE.startBoard.length+deedsPacked(P)); }
const onBoard=(P,id)=>{ const i=P.layout.indexOf(id); return i>=0&&i<slotsOpen(P); };
// The pack is the cards you chose. The deck you tap is the pack plus the bastions in your open slots.
function packList(P){ return P.cards.filter(c=>c.packed&&!isPiece(c)); }
function packedCount(P){ return packList(P).length; }
function deckIds(P){ return packList(P).map(c=>c.id).concat(P.layout.slice(0,slotsOpen(P)).filter(Boolean)); }

/* ---------- values ---------- */
const valMult=c=>Math.pow(TUNE.valG,c.lvl)*Math.pow(TUNE.mileX,Math.floor(c.lvl/TUNE.mileEvery))*(has(c,'keen')?3:1);
const defMult=c=>Math.pow(TUNE.defG,c.lvl)*(has(c,'keen')?2:1);
function fxAmount(c,kind,base){
  const keen=has(c,'keen')?3:1;
  switch(kind){
    case 'dmg': case 'poison': case 'sally': case 'ram': case 'horn': case 'barrel': return base*valMult(c);
    case 'block': return base*defMult(c);
    case 'coin': return base*(1+.04*c.lvl)*(has(c,'keen')?2:1);
    case 'powder': return base+Math.floor(c.lvl/10);   // Powder stays scarce, or the board drowns the hand
    case 'draw': return base+Math.floor(c.lvl/10);
    case 'combo': return base+Math.floor(c.lvl/3);
    case 'bash': return base*Math.pow(TUNE.bashG,c.lvl)*keen;   // block grows slower than attacks, so Shield Bash compounds to keep up
    case 'plague': case 'arsenal': case 'forge': return base*(1+.1*c.lvl)*keen;
    case 'heal': return base*(1+.04*c.lvl);
    default: return base;
  }
}
const pieceHp=c=>CARDS[c.key].hp*defMult(c)*(has(c,'bulwark')?8:1);
const pieceNeed=c=>Math.max(1,CARDS[c.key].need-(has(c,'light')?1:0));
const maxHpOf=P=>TUNE.baseHp*Math.pow(TUNE.defG,P.hearth);
function socketsOpen(P,c){ let n=0; for(const a of TUNE.sockAt) if(c.lvl>=a) n++; if(P.extraSock&&c.lvl>=60) n++; return n; }
function describe(c){
  let s=CARDS[c.key].text;
  for(const [k,b] of CARDS[c.key].fx){ const a=fxAmount(c,k,b);
    s=s.replace('{'+k+'}',k==='coin'||k==='bash'||k==='arsenal'||k==='forge'||k==='heal'?fmt(a*100)+'%':k==='plague'?'×'+a.toFixed(1):fmt(a)); }
  return s;
}
const comboMult=(P,T)=>1+T.combo*TUNE.comboStep;

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

/* ---------- trip ---------- */
function makeTrip(P,seed){
  const maxHp=maxHpOf(P);
  const T={f:0,hp:maxHp,maxHp,coin:0,board:[],phase:'prefight',F:null,ev:[],offer:null,marchList:[],
    draw:deckIds(P),disc:[],q:0,pend:0,pumping:false,mag:0,cursor:0,combo:0,idle:0,shuffle:0,whet:1,chain:1,anvil:0,run:0,lastKey:null,atkRun:0,lastAtk:0,xfrom:null,
    stat:{fights:0,marched:0,dmgHand:0,dmgBoard:0,taken:0,waste:0,blocked:0,blockGain:0,lost:0,plays:0,fires:0,start:P.secs,powder:0},
    rng:(seed==null?(P.seed*31+P.trips*7919):seed)|0};
  shuffle(T,T.draw);
  return T;
}
function startTrip(P){ P.trips++; const T=makeTrip(P); tripAdvance(P,T); return T; }
function newPiece(P,id){ const c=cardOf(P,id), hp=pieceHp(c); return {id,hp,maxHp:hp,fill:0,sealed:false}; }
const shuffle=(T,a)=>{ for(let i=a.length-1;i>0;i--){ const j=Math.floor(rng32(T,'rng')*(i+1)); const t=a[i];a[i]=a[j];a[j]=t; } };
// March past what you already outclass, stopping at an unseen caravan, an unbeaten boss, or the first real fight.
// Outclass means it would die well before its first swing, from an empty board. Power alone will not do: a deck that snowballs has a huge 12 seconds and a slow first 4.
const marchPower=P=>testFire(P,{secs:TUNE.swing}).dmg;
function canMarch(P,f,p){ return p/enemyHp(P,f)>=TUNE.marchR; }
function marchReach(P){ if(!P.trips) return 0; const p=marchPower(P); let f=0; while(f<400&&canMarch(P,f,p)&&(!isBossF(f)||P.bosses[f])&&(!isCaravanF(f)||P.caravans[f])) f++; return f; }
function tripAdvance(P,T){
  const p=marchPower(P); T.marchList=[];
  for(;;){
    if(isCaravanF(T.f)&&!P.caravans[T.f]){ T.phase='caravan'; T.offer=caravanOffer(P,T.f); return; }
    const boss=isBossF(T.f);
    if(boss&&!P.bosses[T.f]) break;
    if(P.trips<=1||!canMarch(P,T.f,p)) break;   // your first trip you walk yourself
    const b=bounty(P,T.f), hp=enemyHp(P,T.f);
    const paid=b*TUNE.marchCoin; T.coin=num(T.coin+paid); T.marchList.push({f:T.f,key:enemyKey(P,T.f),hp,over:p/hp,coin:paid}); T.stat.marched++;
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
  const it=o.items[i], c=addCard(P,it.key,it.lvl,false); T.joined=false;
  if(isPiece(c)){ const on=P.layout.slice(0,slotsOpen(P)).length; if(on<slotsOpen(P)){ P.layout.splice(on,0,c.id); T.disc.push(c.id); T.joined=true; } }
  else if(packedCount(P)<TUNE.deckMax){ c.packed=true; T.disc.push(c.id); T.joined=true; }
  P.caravans[T.f]=1; T.offer=null; P.bursts++; tripAdvance(P,T); return true;
}
function caravanLeave(P,T){ P.caravans[T.f]=1; T.offer=null; tripAdvance(P,T); }

/* ---------- fight ---------- */
function beginFight(P,T,ov){
  const f=T.f, key=ov?ov.key:enemyKey(P,f), hp0=ov?ov.hp:enemyHp(P,f);
  const F={key,f,enemy:{hp:hp0,maxHp:hp0,poison:0,hex:0,wardUp:ENEMIES[key].ward||0,atk:ov?ov.atk:enemyAtk(f)},turn:1,t:0,live:false,block:0,boost:{},barrel:{},forge:0,coinGot:0,
    over:null,intent:[],swing:TUNE.swing,wheelAcc:0,autoAcc:0,blightAcc:0};
  T.F=F; T.phase='fight'; T.stat.fights++;
  if(T.shuffle>0) finishShuffle(T);
  for(const b of T.board) b.sealed=false;
  F.intent=ENEMIES[key].intent(F.turn);
  for(const a of F.intent) if(a.seal&&T.board.length) T.board[0].sealed=true;
}
function startShuffle(P,T){ if(!T.disc.length||T.shuffle>0) return; T.shuffle=TUNE.shuffle*P.shuffleX; if(T.ev) T.ev.push({t:'shuffle'}); if(T.shuffle<=0) finishShuffle(T); }
function finishShuffle(T){ T.shuffle=0; T.draw=T.draw.concat(T.disc); T.disc=[]; shuffle(T,T.draw); if(T.ev) T.ev.push({t:'shuffled'}); }
function addCombo(P,T,n){ const b=T.combo; T.combo=Math.min(P.comboCap,T.combo+n); T.idle=0; if(T.ev) for(const m of [25,50,75,100,150]) if(b<m&&T.combo>=m) T.ev.push({t:'heat',m}); }

/* Tap: the top card plays for free, and whatever it sets off runs to the end. */
function tapDeck(P,T){
  const F=T.F; if(!F||F.over||T.shuffle>0) return false;
  F.live=true;
  if(!T.draw.length){ startShuffle(P,T); return false; }
  T.pend++; pump(P,T); return true;
}
/* The one loop everything runs through. Powder first, then the cards a chain has asked for.
   Both run out: a firing always returns less Powder than it took, and free plays stop when the deck does. */
function pump(P,T){
  if(T.pumping) return; T.pumping=true; const F=T.F; let guard=0;
  while(!F.over&&guard++<20000&&(T.q>0||T.pend>0)){
    if(T.q>0){ T.q--; feedOne(P,T); continue; }
    T.pend--; if(T.draw.length) playOne(P,T,T.draw.pop()); else T.pend=0;
  }
  if(F.over){ T.q=0; T.pend=0; }
  T.pumping=false;
  if(!F.over&&!T.draw.length) startShuffle(P,T);
}
function feedOne(P,T){
  const B=T.board; let n=B.length; T.stat.powder++;
  while(n>0&&B[T.cursor%B.length].sealed){ T.cursor=(T.cursor+1)%B.length; n--; }
  if(!n){ if(T.mag<TUNE.hopper) T.mag++; else { T.stat.waste++; if(T.ev) T.ev.push({t:'waste'}); } return; }
  T.cursor%=B.length; const b=B[T.cursor];
  b.fill++; if(T.ev) T.ev.push({t:'feed',id:b.id});
  if(b.fill>=pieceNeed(cardOf(P,b.id))){ b.fill=0; const next=(T.cursor+1)%B.length; T.cursor=next; firePiece(P,T,b); if(next===0&&T.cursor===0) T.chain=1; }
}
function firePiece(P,T,b){
  const F=T.F, c=cardOf(P,b.id), d=CARDS[c.key]; if(F.over) return;
  addCombo(P,T,1); T.stat.fires++;
  const atk=d.fx.some(([k])=>ATK[k]), chain0=T.chain; let m=1; if(atk){ m=T.chain*T.whet; T.chain=1; T.whet=1; }
  let cross=false; if(atk){ cross=T.xfrom==='hand'; T.xfrom='gun'; }   // Crossfire: a gun right after an attack card pays double, and the other way round
  const crit=rng32(T,'rng')<P.crit, mul=m*(cross?TUNE.crossX:1)*(crit?TUNE.critX:1)*comboMult(P,T);
  if(T.ev) T.ev.push({t:'fire',id:b.id,crit,m,cross});
  for(let r=has(c,'echo')?2:1;r>0;r--) for(const [k,a] of d.fx) applyFx(P,T,k,a,c,mul,1,'board',b);
  if(has(c,'charge')&&atk) T.chain=chain0*TUNE.chargeX;
  if(has(c,'relay')&&pieceNeed(c)>1) T.q+=1;
}
function playOne(P,T,id){
  const F=T.F, c=cardOf(P,id), d=CARDS[c.key]; T.stat.plays++; T.idle=0;
  if(d.piece) return landPiece(P,T,id);
  if(d.junk){ T.run=0; T.lastKey=null; T.atkRun=0; if(!d.temp) T.disc.push(id); if(T.ev) T.ev.push({t:'play',key:c.key,dud:true}); return; }
  addCombo(P,T,1);
  T.run=TUNE.runPay&&T.lastKey===c.key?Math.min(TUNE.runCap,T.run+1):1; T.lastKey=c.key;
  const atk=d.fx.some(([k])=>ATK[k]); T.atkRun=atk?T.atkRun+1:0;
  if(T.anvil>0&&d.fx.length){ F.boost[id]=(F.boost[id]||1)*Math.pow(2,T.anvil); T.anvil=0; }
  let mul=(F.boost[id]||1);
  let cross=false; if(atk){ mul*=T.whet*T.chain; T.whet=1; T.chain=1; mul*=1+F.forge; cross=T.xfrom==='gun'; T.xfrom='hand'; if(cross) mul*=TUNE.crossX; }
  if(has(c,'flurry')) mul*=1+T.combo/50;
  const crit=rng32(T,'rng')<P.crit; if(crit) mul*=TUNE.critX;
  const cm=comboMult(P,T), total=mul*cm*T.run;
  if(T.ev) T.ev.push({t:'play',key:c.key,id,run:T.run,crit,cross,mul:total/cm/(crit?TUNE.critX:1)});
  for(let r=has(c,'echo')?2:1;r>0;r--) for(const [k,a] of d.fx) applyFx(P,T,k,a,c,total,T.run*(crit?TUNE.critX:1),'hand');
  if(has(c,'swift')) T.pend++;
  if(has(c,'fuel')) T.q+=2;
  T.disc.push(id);
}
function landPiece(P,T,id){
  const c=cardOf(P,id), B=T.board, at0=P.layout.indexOf(id); let at=B.findIndex(x=>P.layout.indexOf(x.id)>at0); if(at<0) at=B.length;
  const b=newPiece(P,id); B.splice(at,0,b); if(B.length>1&&at<=T.cursor) T.cursor++;
  addCombo(P,T,1); if(T.ev) T.ev.push({t:'land',id});
  if(T.mag>0){ T.q+=T.mag; T.mag=0; }
  if(has(c,'primed')) firePiece(P,T,b);
}
function applyFx(P,T,kind,base,c,mul,flat,src,b){
  const F=T.F; if(F.over) return;
  const amt=fxAmount(c,kind,base), e=F.enemy;
  switch(kind){
    case 'dmg': hitEnemy(P,T,amt*mul,src); break;
    case 'sally': hitEnemy(P,T,amt*Math.min(T.atkRun,TUNE.sallyCap)*mul,src); break;
    case 'ram': hitEnemy(P,T,amt*T.board.length*mul,src); break;
    case 'horn': hitEnemy(P,T,amt*T.combo*mul,src); break;
    case 'barrel': { const n=F.barrel[c.id]||0; F.barrel[c.id]=Math.min(n+1,TUNE.barrelMax); hitEnemy(P,T,amt*Math.pow(TUNE.barrelG,n)*mul,src); break; }
    case 'bash': if(F.block>0) hitEnemy(P,T,F.block*amt*mul/comboMult(P,T),src); break;
    case 'plague': if(e.poison>0){ const n=e.poison*amt*mul/comboMult(P,T); e.poison/=2; hitEnemy(P,T,n,src); } break;
    case 'arsenal': if(T.lastAtk>0) hitEnemy(P,T,T.lastAtk*amt*mul/comboMult(P,T),'board'); break;
    case 'block': { const n=amt*mul; F.block=num(F.block+n); T.stat.blockGain=num(T.stat.blockGain+n); if(T.ev) T.ev.push({t:'block',n}); break; }
    case 'poison': { const n=amt*mul; e.poison=num(e.poison+n); if(T.ev) T.ev.push({t:'poison',n}); break; }
    case 'hex': e.hex+=amt; break;
    case 'coin': { const room=Math.max(0,bounty(P,F.f)*TUNE.coinCap-F.coinGot), g=Math.min(room,bounty(P,F.f)*amt*flat); F.coinGot+=g; T.coin=num(T.coin+g); if(T.ev&&g>0) T.ev.push({t:'coin',n:g}); break; }
    case 'powder': T.q+=amt*(src==='hand'?T.run:1); break;
    case 'draw': T.pend+=amt; break;
    case 'repair': for(const x of T.board) x.hp=Math.min(x.maxHp,x.hp+x.maxHp*base); break;
    case 'selfrepair': b.hp=Math.min(b.maxHp,b.hp+b.maxHp*base); break;
    case 'heal': T.hp=Math.min(T.maxHp,T.hp+T.maxHp*amt); break;
    case 'whet': T.whet=Math.min(TUNE.whetCap,T.whet*3); break;
    case 'anvil': T.anvil++; break;
    case 'rope': if(T.board.length){ T.cursor%=T.board.length; let n=T.board.length; while(n-->0&&T.board[T.cursor].sealed) T.cursor=(T.cursor+1)%T.board.length; const x=T.board[T.cursor]; if(!x.sealed){ T.cursor=(T.cursor+1)%T.board.length; firePiece(P,T,x); } } break;
    case 'trail': for(const x of T.board.slice()){ if(x.sealed) continue; x.fill++; if(x.fill>=pieceNeed(cardOf(P,x.id))){ x.fill=0; firePiece(P,T,x); } } break;
    case 'combo': addCombo(P,T,amt); break;
    case 'forge': F.forge+=amt; break;
    case 'double': T.chain=Math.min(TUNE.whetCap,T.chain*2); break;
  }
}
function hitEnemy(P,T,amt,src){
  const F=T.F, e=F.enemy;
  if(e.wardUp>0){ e.wardUp--; if(T.ev) T.ev.push({t:'warded'}); return; }
  e.hp=num(e.hp-amt);
  if(src==='board') T.stat.dmgBoard=num(T.stat.dmgBoard+amt); else { T.stat.dmgHand=num(T.stat.dmgHand+amt); T.lastAtk=amt; }
  if(T.ev) T.ev.push({t:'dmg',n:amt,src,ratio:amt/Math.max(1,e.maxHp)});
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
  if(T.ev) T.ev.push({t:'kill',key:F.key,coin:b,over:-F.enemy.hp/Math.max(1,F.enemy.maxHp)});
}
function rewardOffer(P,f){
  const ok=Object.keys(REWARDS).filter(k=>!P.rewards.includes(k)&&(!REWARDS[k].after||P.rewards.includes(REWARDS[k].after)));
  const out=[],pool=ok.slice();
  if(pool.includes('slot1')&&!P.rewards.length){ out.push('slot1'); pool.splice(pool.indexOf('slot1'),1); }
  for(let i=0;out.length<3&&pool.length;i++){ const j=Math.floor(hash01(P.seed+i*53,f)*pool.length); out.push(pool.splice(j,1)[0]); }
  return out;
}
function takeReward(P,T,key){ P.rewards.push(key); REWARDS[key].on(P); T.offer=null; T.phase='postfight'; }

/* The clock. Nothing moves until the first tap of a fight. */
function tick(P,T,dt){
  const F=T.F; if(!F||F.over||!F.live) return;
  F.t+=dt; const e=F.enemy, def=ENEMIES[F.key];
  if(T.shuffle>0){ T.shuffle-=dt; if(T.shuffle<=0) finishShuffle(T); }
  F.wheelAcc+=P.wheel*dt; if(F.wheelAcc>=1){ const n=Math.floor(F.wheelAcc); F.wheelAcc-=n; T.q+=n; }
  pump(P,T); if(F.over) return;
  if(P.auto>0&&T.shuffle<=0){ F.autoAcc+=P.auto*dt; while(F.autoAcc>=1&&!F.over&&T.shuffle<=0){ F.autoAcc-=1; if(T.draw.length){ T.pend++; pump(P,T); } } if(F.over) return; }
  F.blightAcc+=dt; if(F.blightAcc>=1){ F.blightAcc-=1; if(e.poison>0){ const n=e.poison*TUNE.blightPay; e.hp=num(e.hp-n); T.stat.dmgBoard=num(T.stat.dmgBoard+n); if(T.ev) T.ev.push({t:'dmg',n,src:'poison',ratio:n/Math.max(1,e.maxHp)}); e.poison=e.poison<1?0:e.poison*TUNE.blightKeep; checkWin(P,T); if(F.over) return; } }
  T.idle+=dt; if(T.idle>TUNE.comboGrace&&T.combo>0){ T.combo=Math.max(0,T.combo-(T.combo*TUNE.comboFade+2)*dt); }
  F.swing-=dt;
  if(F.swing<=0){
    enemyActs(P,T); if(F.over) return;
    if(def.flee&&F.turn>=def.flee){ T.coin*=.9; F.over='fled'; T.f++; T.phase='postfight'; if(T.ev) T.ev.push({t:'fled'}); return; }
    F.block=0; e.wardUp=def.ward||0; for(const b of T.board) b.sealed=false;
    F.turn++; F.swing=TUNE.swing; F.intent=def.intent(F.turn);
    for(const a of F.intent) if(a.seal&&T.board.length) T.board[0].sealed=true;
  }
}
function enrage(F,def){ let m=1; if(F.turn>TUNE.enrageAfter) m*=Math.pow(TUNE.enrageX,F.turn-TUNE.enrageAfter); if(def.grow) m*=Math.pow(def.grow,F.turn-1); return m; }
function intentHit(F,a){ return F.enemy.atk*a.hit*enrage(F,ENEMIES[F.key]); }
function enemyActs(P,T){
  const F=T.F; if(T.ev) T.ev.push({t:'swing'});
  for(const a of F.intent){
    if(a.drain){ if(T.board.length) T.board[0].fill=0; T.mag=0; if(T.ev) T.ev.push({t:'drain'}); }
    if(a.rubble) for(let i=0;i<a.rubble;i++) T.draw.push(-1);
    if(a.hit){
      if(a.at==='all'){ for(const b of T.board.slice()) strike(P,T,intentHit(F,a),'one',b); const rest=absorb(T,F,intentHit(F,a)*.5); if(rest>0) strikeYou(P,T,rest); }
      else strike(P,T,intentHit(F,a),a.at);
    }
    if(T.hp<=0){ T.hp=0; F.over='loss'; T.phase='defeat'; if(T.ev) T.ev.push({t:'dead'}); return; }
  }
}
function absorb(T,F,amt){ if(F.enemy.hex>0){ F.enemy.hex--; amt/=2; } const b=Math.min(F.block,amt); F.block-=b; T.stat.blocked=num(T.stat.blocked+b); if(T.ev&&b>0) T.ev.push({t:'blocked',n:b}); return amt-b; }
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
    if(tgt.hp<=0){ const i=T.board.indexOf(tgt); T.board.splice(i,1); if(i<T.cursor) T.cursor--; if(T.cursor>=T.board.length) T.cursor=0; T.disc.push(tgt.id); T.stat.lost++; if(T.ev) T.ev.push({t:'lost',id:tgt.id}); }
    if(only) return;
  }
}
function strikeYou(P,T,amt){ const F=T.F; T.hp=num(T.hp-amt); T.stat.taken=num(T.stat.taken+amt); if(T.ev) T.ev.push({t:'you',n:amt}); if(T.hp<=0){ T.hp=0; if(!F.over){ F.over='loss'; T.phase='defeat'; } } }

/* End of trip. Going home between fights keeps everything; defeat, or leaving mid-fight, keeps 70%. Nothing else is ever lost. */
function endTrip(P,T,how){
  const rate=how==='retreat'?1:TUNE.defeatKeep, got=num(T.coin*rate);
  P.coin=num(P.coin+got); P.last={how,got,lost:T.coin-got,f:T.f,fights:T.stat.fights,marched:T.stat.marched,lostPieces:T.stat.lost,dmgHand:T.stat.dmgHand,dmgBoard:T.stat.dmgBoard};
  if(how==='defeat'){ P.defeats++; const F=T.F, key=F?F.key:enemyKey(P,T.f); P.nemesis={f:T.f,key,left:F?Math.max(0,F.enemy.hp)/F.enemy.maxHp:1}; }
  else P.retreats++;
  P.lastSeen=P.secs;
  return P.last;
}

/* ---------- what a deck can do, measured on the real rules ---------- */
function cloneT(T){ const F=T.F; return {...T,sim:true,ev:null,stat:{...T.stat},offer:null,marchList:[],pumping:false,board:T.board.map(b=>({...b})),draw:T.draw.slice(),disc:T.disc.slice(),
  F:F?{...F,enemy:{...F.enemy},boost:{...F.boost},barrel:{...F.barrel}}:null}; }
// Runs the fight T is standing at, tapping at rate per second. Returns the seconds it took.
function runFight(P,T,rate,dt,cap){ const F=T.F; let acc=1; F.live=true;
  while(!F.over&&F.t<cap){ acc+=rate*dt; while(acc>=1&&!F.over){ acc-=1; tapDeck(P,T); } if(!F.over) tick(P,T,dt); }
  if(!F.over){ F.over='loss'; T.hp=0; T.phase='defeat'; }
  return F.t; }
// A test firing against a dummy that never hits back, from an empty board.
function testFire(P,opt){ const o=opt||{}, secs=o.secs||TUNE.powSecs, rate=o.rate==null?TUNE.powTap:o.rate, dt=o.dt||.1, seeds=o.seeds||2; let dmg=0,hand=0,board=0,block=0,plays=0,fires=0,coin=0,powder=0;
  for(let s=0;s<seeds;s++){ const T=makeTrip(P,(o.base||1009)+s*77); T.sim=true; T.ev=null; beginFight(P,T,{key:'dummy',hp:1e200,atk:0}); runFight(P,T,rate,dt,secs); const st=T.stat, e=T.F.enemy;
    const leftover=e.poison*TUNE.blightPay/(1-TUNE.blightKeep);
    hand+=st.dmgHand; board+=st.dmgBoard+leftover; dmg+=st.dmgHand+st.dmgBoard+leftover; block+=st.blockGain; plays+=st.plays; fires+=st.fires; coin+=T.coin; powder+=st.powder; }
  return {dmg:num(dmg/seeds),hand:num(hand/seeds),board:num(board/seeds),block:num(block/seeds),plays:plays/seeds,fires:fires/seeds,coin:coin/seeds,powder:powder/seeds,secs}; }
const estPower=P=>testFire(P).dmg;
/* What a perk does to damage. Not yet on the card: what tapping it would do, including the oldest perk it pushes out of a full card. Already on: what it adds now.
   Decks that compound swing wildly between runs, and a plain average is ruled by the odd lucky one. So this takes the typical ratio (geometric mean)
   over paired firings, and keeps firing until the reading settles. The seeds are fixed, so the same deck always reads the same. */
function perkGain(P,c,k){
  const keep=c.sock, on=keep.includes(k), out=!on&&keep.length>=socketsOpen(P,c)?keep[0]:null;
  const without=on?keep.filter(x=>x!==k):keep, withIt=on?keep:keep.filter(x=>x!==out).concat(k);
  const fire=(sock,base)=>{ c.sock=sock; return Math.max(1,testFire(P,{seeds:1,base}).dmg); };
  let n=0,sum=0,sq=0,se=0;
  do{ const base=1009+n*77, d=Math.log(fire(withIt,base)/fire(without,base)); sum+=d; sq+=d*d; n++; se=Math.sqrt(Math.max(0,sq/n-(sum/n)*(sum/n))/n); }
  while(n<400&&(n<24||se>.05));
  c.sock=keep;
  return {ratio:Math.exp(sum/n),se,n,out};
}
// Chance of winning this fight at a steady 4 taps a second: from T if given (the trip as it stands), else from a fresh start.
function winChance(P,f,T0,K){ K=K||5; let wins=0;
  for(let k=0;k<K;k++){ const T=T0?cloneT(T0):makeTrip(P,1); T.sim=true; T.ev=null; T.rng=(5003+k*911+f*17)|0; T.f=f; T.q=0; T.pend=0;
    if(T0&&T.phase!=='fight') T.phase='prefight'; beginFight(P,T); runFight(P,T,TUNE.powTap,.2,90); if(T.F.over==='win'||T.F.over==='fled') wins++; }
  return wins/K; }

/* ---------- home purchases ---------- */
function levelCost(c){ return TUNE.cost0*(CARDS[c.key].piece?TUNE.pieceCostX:1)*Math.pow(TUNE.costG,c.lvl); }
const hearthCost=P=>TUNE.hearthCost*Math.pow(TUNE.hearthG,P.hearth);
const wheelCost=P=>TUNE.wheelCost*Math.pow(TUNE.wheelG,P.wheelBuys||0);
const autoCost=P=>TUNE.autoCost*Math.pow(TUNE.autoG,P.autoBuys||0);
const ledgerCost=P=>TUNE.ledgerCost*Math.pow(TUNE.ledgerG,P.ledger);
function buyLevel(P,id){ const c=cardOf(P,id), k=levelCost(c); if(P.coin<k||c.key==='deed') return false; P.coin-=k; c.lvl++; return true; }
function buyKeep(P,what){
  const k={hearth:hearthCost,wheel:wheelCost,auto:autoCost,ledger:ledgerCost}[what](P);
  if(P.coin<k) return false; P.coin-=k;
  if(what==='hearth') P.hearth++; else if(what==='wheel'){ P.wheel++; P.wheelBuys=(P.wheelBuys||0)+1; }
  else if(what==='auto'){ P.auto+=TUNE.autoStep; P.autoBuys=(P.autoBuys||0)+1; } else P.ledger++;
  return true;
}
// Keen is only offered where it changes what the card pays. Powder, free plays and the like stay as they are.
const keenPays=c=>CARDS[c.key].fx.some(([k,b])=>fxAmount({...c,sock:['keen']},k,b)!==fxAmount({...c,sock:[]},k,b));
function perkFits(perk,c){ const f=PERKS[perk].for; if(perk==='charge'&&!CARDS[c.key].fx.some(([k])=>ATK[k])) return false; if(perk==='keen'&&!keenPays(c)) return false; return f==='both'||(f==='piece')===isPiece(c); }
function togglePack(P,id){ const c=cardOf(P,id); if(isPiece(c)) return false;
  const cnt=packedCount(P);
  if(c.packed){ if(cnt<=TUNE.deckMin) return false; c.packed=false; } else { if(cnt>=TUNE.deckMax) return false; c.packed=true; }
  return true; }
// Board layout: move to a slot, or take off the board.
function placePiece(P,id,slot){ const i=P.layout.indexOf(id); if(i>=0) P.layout.splice(i,1); if(slot!=null) P.layout.splice(clamp(slot,0,P.layout.length),0,id); return true; }

/* Scan any object for a non-finite number: the sim's guard, and the save's validator. */
function allFinite(o){ if(typeof o==='number') return Number.isFinite(o); if(o&&typeof o==='object'){ for(const k in o) if(!allFinite(o[k])) return false; } return true; }
