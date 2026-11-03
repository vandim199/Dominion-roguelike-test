"use strict";
/* ==========================================================
   Coinkeep: Forays. The rules. No DOM: the browser and the
   simulator (sim/) both drive these functions.
   P is the permanent profile (saved); T is the current trip,
   plain data, cheap to clone so bots can search it.
   ========================================================== */
if(typeof module!=='undefined'&&typeof TUNE==='undefined'){ Object.assign(globalThis,require('./data.js')); }

const SLOT = (typeof location!=='undefined'&&(/\/v\/([\w-]+)\//.exec(location.pathname)||[])[1]) || '';
const slotKey = k => SLOT ? `${k}.${SLOT}` : k;

/* ---------- small helpers ---------- */
function rng(T){ T.seed=(T.seed+0x6D2B79F5)|0; let t=T.seed; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }
function shuffle(T,a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(rng(T)*(i+1)); const x=a[i]; a[i]=a[j]; a[j]=x; } return a; }
const lvl = (x,L) => x*Math.pow(TUNE.pLv,L)*Math.pow(TUNE.mile,Math.floor(L/5));
const unit = (g,f) => Math.pow(g,f-1);
const fightHp = f => TUNE.hp0*unit(TUNE.gHp,f);
const fightAtk = f => TUNE.atk0*unit(TUNE.gAtk,f);
const fightCoin = f => TUNE.coin0*unit(TUNE.gCoin,f);
const isBoss = f => f%TUNE.bossEvery===0;
const defOf = k => BASTIONS[k]||CARDS[k];
const levelCap = P => Math.floor(TUNE.capBase+P.deepest/TUNE.capPer);
const deedCount = P => P.own.deed+2*P.own.charter;
function slotCount(P){ let n=2; const d=deedCount(P); for(const [need,s] of DEED_SLOTS) if(d>=need) n=s; return n; }

/* ---------- profile ---------- */
function newProfile(seed){
  const P={v:2,seed:seed||12345,coin:0,crests:0,deepest:0,beaten:0,won:false,lv:{gun:0,mason:0,walls:0},own:{deed:0,charter:0},bench:{},bases:{ballista:1,buttress:1},
    layout:['ballista','buttress'],works:{},trips:0,defeats:0,offers:[],keep:[],hist:[],kills:{},seen:{},playedTurns:0,last:null};
  for(const k in CARDS){ if(CARDS[k].start) P.own[k]=CARDS[k].start; }
  rollOffers(P); return P;
}
function fixLayout(P){ const n=slotCount(P); while(P.layout.length<n) P.layout.push(null); while(P.layout.length>n) P.layout.pop(); }

/* ---------- what can be bought ---------- */
function offerPrice(P,k){ return defOf(k).price*fightCoin(Math.max(1,P.deepest))*(BASTIONS[k]?.35:1); }
function rollOffers(P){
  const T={seed:P.seed}; const unb=Object.keys(BASTIONS).filter(k=>!P.bases[k]);
  const cs=shuffle(T,Object.keys(CARDS).filter(k=>!CARDS[k].noshop));
  const out=[]; if(unb.length) out.push(...shuffle(T,unb).slice(0,2));
  for(const k of cs){ if(out.length>=5) break; out.push(k); }
  P.offers=out; P.seed=T.seed;
}
function buyOffer(P,k){ const c=offerPrice(P,k); if(P.coin<c||!P.offers.includes(k)) return false; P.coin-=c;
  P.offers=P.offers.filter(o=>o!==k); gainType(P,k); return true; }
function gainType(P,k){
  if(BASTIONS[k]){ P.bases[k]=1; fixLayout(P); const e=P.layout.indexOf(null); if(e>=0) P.layout[e]=k; }
  else P.own[k]=(P.own[k]||0)+1;
}
function levelPrice(P,k){ return TRACKS[k].price*Math.pow(TUNE.cLv,P.lv[k]||0); }
function canLevel(P,k){ return (P.lv[k]||0)<levelCap(P)&&P.coin>=levelPrice(P,k); }
function buyLevel(P,k){ if(!canLevel(P,k)) return false; P.coin-=levelPrice(P,k); P.lv[k]=(P.lv[k]||0)+1; return true; }
function buyMax(P,k){ let n=0; while(canLevel(P,k)&&n<200){ buyLevel(P,k); n++; } return n; }
function buyDeed(P){ const n=deedCount(P), c=deedPrice(n); if(P.coin<c) return false; P.coin-=c; P.own.deed++; P.fresh=1; fixLayout(P); return true; }
const charterPrice = P => 2*deedPrice(deedCount(P));
function buyCharter(P){ const c=charterPrice(P); if(P.own.deed<2||P.coin<c) return false; P.coin-=c; P.own.deed-=2; P.own.charter++; return true; }
function buyWork(P,k){ if(P.crests<1||P.works[k]) return false; P.crests--; P.works[k]=1; return true; }
function setBench(P,k,d){ const own=P.own[k]||0, b=P.bench[k]||0; const nb=Math.max(0,Math.min(own,b+d)); P.bench[k]=nb; }
const standing = P => Math.pow(TUNE.standing,deedCount(P));

/* ---------- starting a trip ---------- */
function firstBossAhead(P){ return (Math.floor(P.beaten/TUNE.bossEvery)+1)*TUNE.bossEvery; }
function dropIn(P,power){
  const pw=power==null?estPower(P).dmg:power;
  const f=1+Math.floor(Math.log(Math.max(1,pw/(TUNE.dropR*TUNE.hp0)))/Math.log(TUNE.gHp));
  return Math.max(1,Math.min(f,P.deepest,firstBossAhead(P)-1));
}
function startTrip(P,opts){
  opts=opts||{};
  fixLayout(P);
  const T={seed:(opts.seed!=null?opts.seed:P.seed)|0,ev:[],gun:lvl(1,P.lv.gun),mas:lvl(1,P.lv.mason),phase:'turn',f:opts.f||1,startF:opts.f||1,
    energyMax:TUNE.energy+(P.works.energy?1:0),handMax:TUNE.hand+(P.works.hand?1:0),magCap:P.works.magazine?8:TUNE.mag,
    stores:P.works.stores?4:0,twin:!!P.works.twin,foundry:P.works.foundry?4:1,
    mult:standing(P),surge:1,maxHp:lvl(TUNE.startHp,P.lv.walls),coin:0,crests:0,beaten:P.beaten,deepest:P.deepest,topWon:0,
    carry:0,mag:0,shield:0,hex:0,temper:1,energy:0,turn:0,played:0,cards:[],spoils:[],cache:null,lastFired:-1,
    board:[],draw:[],hand:[],disc:[],burn:[],enemy:null,
    st:{dealt:0,taken:0,baseLost:0,wasted:0,turns:0,fires:0,cardDmg:0,baseDmg:0,topHit:0,fightsWon:0}};
  T.hp=T.maxHp; T.seedStart=T.seed;
  T.board=P.layout.map(k=>k?newBase(T,k):null);
  const deck=[]; for(const k in P.own){ const n=(P.own[k]||0)-(P.bench[k]||0); for(let i=0;i<n;i++) deck.push({k}); }
  for(const k in P.bases) if(!P.layout.includes(k)) deck.push({k,b:1});
  T.cards=deck;
  if(!opts.noFight) startFight(T);
  return T;
}
function newBase(T,k){ const d=BASTIONS[k], m=(d.hp||0)*T.mas*T.foundry*T.mult; const b={k,fill:0,fired:0,jam:0}; if(d.hits){ b.hits=d.hits; b.hitsMax=d.hits; b.hp=1;b.max=1; } else { b.hp=m; b.max=m; } return b; }
function enemyFor(f){ if(f===TUNE.finalBoss) return FINAL; if(isBoss(f)) return BOSSES[(f/TUNE.bossEvery-1)%BOSSES.length];
  const ks=Object.keys(ENEMIES); let h=f*2654435761>>>0; h=(h^h>>>13)>>>0; return ENEMIES[ks[h%ks.length]]; }
function startFight(T,dummy){
  const f=T.f, def=dummy||enemyFor(f), boss=!dummy&&(isBoss(f)||f===TUNE.finalBoss);
  const hp=fightHp(f)*def.h*(boss?TUNE.bossHp:1);
  T.enemy={n:def.n,i:def.i,boss,rule:def.rule||'',seize:def.seize||0,seized:0,rev:def.rev||0,toll:def.toll||0,p:def.p,pi:(def.seize?0:(Math.floor(f)%def.p.length)),
    hp,max:hp,atk:fightAtk(f)*def.a*(boss?TUNE.bossAtk:1),hunker:0,dodge:0,blight:0,coin:def.coin||1,key:Object.keys(ENEMIES).find(k=>ENEMIES[k]===def)||'boss'};
  T.draw=shuffle(T,T.cards.slice()); T.hand=[]; T.disc=[]; T.burn=[]; T.shield=0; T.turn=0; T.temper=1; T.hex=0; T.phase='turn'; T.tollLeft=0;
  for(const b of T.board) if(b){ b.jam=0; b.fired=0; }
  emit(T,'fight',{f});
  if(T.carry>0){ const c=T.carry; T.carry=0; emit(T,'carry',{n:c}); hurtEnemy(T,c,'carry'); if(T.phase!=='turn') return; }
  if(T.stores) T.mag=Math.max(T.mag,T.stores);
  beginTurn(T);
}
function emit(T,t,o){ if(T.ev){ const e=o||{}; e.t=t; T.ev.push(e); } }

/* ---------- turn ---------- */
function beginTurn(T){
  T.turn++; T.st.turns++; T.freeSwap=1; T.energy=T.energyMax; T.shield=0; T.played=0; T.lastFired=-1; T.tollLeft=T.enemy.toll;
  for(const b of T.board) if(b) b.fired=0;
  drawTo(T,T.handMax);
  if(T.mag>0){ const n=T.mag; T.mag=0; addPowder(T,n); }
  emit(T,'turn',{turn:T.turn});
}
function drawTo(T,n){ if(T.draw.length<n-T.hand.length&&T.disc.length){ T.draw.push(...shuffle(T,T.disc)); T.disc=[]; emit(T,'reshuffle'); }
  while(T.hand.length<n&&T.draw.length) T.hand.push(T.draw.pop()); }
function drawN(T,n){ for(let i=0;i<n&&T.draw.length;i++) T.hand.push(T.draw.pop()); }      // mid-turn: stops at the bottom of the pile

function addPowder(T,n){
  if(T.batch&&!T.flushing){ T.pending=(T.pending||0)+n; return; }   // sim only: the end-of-turn feed variant
  if(T.tollLeft>0){ const t=Math.min(T.tollLeft,n); T.tollLeft-=t; n-=t; if(t) emit(T,'toll',{n:t}); }
  for(let i=0;i<T.board.length&&n>0&&T.phase==='turn';i++){
    const b=T.board[i]; if(!b||b.jam) continue;
    const lim=(T.twin&&i===firstBaseIdx(T))?2:1; if(b.fired>=lim) continue;
    const need=BASTIONS[b.k].fill-b.fill, take=Math.min(need,n);
    b.fill+=take; n-=take; if(take) emit(T,'feed',{i,n:take});
    if(b.fill>=BASTIONS[b.k].fill){ b.fill=0; b.fired++; fire(T,i,T.board[i]); if(lim===2&&b.fired<2) i--; }   // twin feed: look at it again
  }
  if(n>0&&T.phase==='turn'){ const room=T.magCap-T.mag, k=Math.min(room,n); T.mag+=k; const w=n-k; if(w>0){ T.st.wasted+=w; emit(T,'waste',{n:w}); } if(k) emit(T,'mag',{n:k}); }
}
const firstBaseIdx = T => T.board.findIndex(b=>b);
function payout(T,k,x,tr){ const t=T.temper; T.temper=1; return num(x*tr*T.mult*T.surge*t); }
function fire(T,i,b){
  const d=BASTIONS[b.k]; T.st.fires++; T.lastFired=i;
  const ev={i,k:b.k};
  if(d.d){ const v=payout(T,b.k,d.d,T.gun); ev.dmg=v; emit(T,'fire',ev); T.st.baseDmg+=v; hurtEnemy(T,v,b.k); }
  else if(d.b){ const v=payout(T,b.k,d.b,T.gun); ev.blight=v; emit(T,'fire',ev); T.enemy.blight=num(T.enemy.blight+v); }
  else if(d.s){ const v=payout(T,b.k,d.s,T.mas); ev.shield=v; emit(T,'fire',ev); T.shield=num(T.shield+v); if(d.hits&&b.hits<b.hitsMax) b.hits++; }
  else if(d.hex){ T.hex+=d.hex; ev.hex=d.hex; emit(T,'fire',ev); }
  else if(d.coin){ const v=num(fightCoin(T.f)*d.coin*T.temper); T.temper=1; T.coin=num(T.coin+v); ev.coin=v; emit(T,'fire',ev); }
  else if(d.draw){ ev.draw=d.draw; emit(T,'fire',ev); drawN(T,d.draw); }
  else if(d.temper){ T.temper=d.temper; ev.temper=d.temper; emit(T,'fire',ev); }
  else if(d.p){ ev.powder=d.p; emit(T,'fire',ev); addPowder(T,d.p); }
}
function hurtEnemy(T,v,src){
  const E=T.enemy; if(T.phase!=='turn'&&src!=='carry') return;
  let x=v; if(E.dodge&&src!=='blight'&&src!=='carry'){ E.dodge=0; emit(T,'dodged',{n:v,src}); return; } if(E.hunker&&src!=='carry') x*=E.hunker;
  E.hp-=x; T.st.dealt=num(T.st.dealt+x); if(x>T.st.topHit) T.st.topHit=x;
  emit(T,'hurt',{n:x,src,hp:E.hp});
  if(E.hp<=0) winFight(T);
}
function winFight(T){
  const E=T.enemy, over=-E.hp, f=T.f;
  T.carry=E.dummy?0:num(over); T.phase='won'; T.st.fightsWon++;
  let c=fightCoin(f)*E.coin; const first=f>T.deepest; if(first) c*=TUNE.firstClear;
  T.coin=num(T.coin+c); if(f>T.topWon) T.topWon=f;
  if(f>T.deepest) T.deepest=f;
  if((isBoss(f)||f===TUNE.finalBoss)&&f>T.beaten){ T.beaten=f; T.crests++; }
  const ratio=over/E.max;
  emit(T,'win',{f,coin:c,first,over,ratio,enemy:E.n,turn:T.turn,boss:E.boss});
  T.hp=Math.min(T.maxHp,T.hp+T.maxHp*TUNE.healBetween);
  for(const b of T.board) if(b&&!b.hits) b.hp=Math.min(b.max,b.hp+b.max*TUNE.repairBetween);
  for(const c2 of T.hand.concat(T.disc,T.draw)) if(c2.b&&c2.cheapNow) {}
  if(f%TUNE.cacheEvery===0) T.cache=rollCache(T);
}
/* every third fight: a cache to pick from */
function rollCache(T){
  const ks=shuffle(T,Object.keys(CARDS).filter(k=>!CARDS[k].noshop)).slice(0,2);
  const opts=ks.map(k=>({t:'card',k}));
  const r=rng(T); opts.push(r<.4?{t:'surge'}:r<.75?{t:'mend'}:{t:'purse'});
  return opts;
}
function pickCache(T,i){ const o=T.cache&&T.cache[i]; T.cache=null; if(!o) return;
  if(o.t==='card'){ T.cards.push({k:o.k,temp:1}); T.spoils.push(o.k); }
  else if(o.t==='surge') T.surge*=TUNE.surge;
  else if(o.t==='mend'){ T.hp=Math.min(T.maxHp,T.hp+T.maxHp*.5); for(const b of T.board) if(b&&!b.hits) b.hp=b.max; else if(b) b.hits=b.hitsMax; }
  else if(o.t==='purse') T.coin=num(T.coin+fightCoin(T.f)*2);
}
function nextFight(T){ if(T.phase!=='won') return; T.cache=null; T.f++; startFight(T); }

/* ---------- playing ---------- */
const cardCost = (T,c) => { if(c.b){ return Math.max(0,BASTIONS[c.k].cost-(c.cheap?1:0)); } return CARDS[c.k].c; };
function playCard(T,hi,mi,slot){
  const c=T.hand[hi]; if(!c||T.phase!=='turn') return false;
  const cost=cardCost(T,c); if(cost>T.energy) return false;
  if(c.b){ if(slot==null||slot<0||slot>=T.board.length) return false;
    T.energy-=cost; T.hand.splice(hi,1); const old=T.board[slot]; if(old) T.disc.push({k:old.k,b:1});
    T.board[slot]=newBase(T,c.k); emit(T,'deploy',{i:slot,k:c.k}); return true; }
  const d=CARDS[c.k];
  if(d.sticky){ T.energy-=cost; T.hand.splice(hi,1); fileCard(T,c); return true; }
  const m=d.m[mi||0]; T.energy-=cost; T.hand.splice(hi,1); T.played++;
  if(m.burn) T.burn.push(c); else T.disc.push(c);
  emit(T,'play',{k:c.k,mi:mi||0});
  applyMode(T,c.k,m); return true;
}
function fileCard(T,c){
  if(c.k!=='rubble') T.disc.push(c);
  if(c.k==='deed'||c.k==='charter'){ const v=num(fightCoin(T.f)*(c.k==='deed'?.25:.75)); T.coin=num(T.coin+v); emit(T,'rent',{n:v,k:c.k}); }
  else emit(T,'file',{k:c.k});
}
function applyMode(T,k,m){
  if(m.e) T.energy+=m.e;
  if(m.s) { const v=payout(T,k,m.s,T.mas); T.shield=num(T.shield+v); emit(T,'shield',{n:v}); }
  if(m.hex) T.hex+=m.hex;
  if(m.b){ const v=payout(T,k,m.b,T.gun); T.enemy.blight=num(T.enemy.blight+v); emit(T,'blight',{n:v}); }
  if(m.repair){ const b=T.board.filter(b=>b&&!b.hits&&b.hp<b.max).sort((x,y)=>x.hp/x.max-y.hp/y.max)[0]||T.board.find(b=>b&&b.hits&&b.hits<b.hitsMax);
    if(b){ if(b.hits) b.hits++; else b.hp=Math.min(b.max,b.hp+b.max*m.repair); emit(T,'repair',{i:T.board.indexOf(b)}); } }
  if(m.draw) drawN(T,m.draw);
  if(m.fileall){ const keep=[]; const st=T.hand.filter(c=>CARDS[c.k]&&CARDS[c.k].sticky); T.hand=T.hand.filter(c=>!(CARDS[c.k]&&CARDS[c.k].sticky)); for(const c of st) fileCard(T,c); }
  if(m.d){ const v=payout(T,k,m.d,T.gun); T.st.cardDmg+=v; hurtEnemy(T,v,k); if(T.phase!=='turn') return; }
  if(m.rally){ const n=T.board.filter(b=>b&&b.fired).length; if(n){ const v=payout(T,k,m.rally*n,T.gun); T.st.cardDmg+=v; hurtEnemy(T,v,k); if(T.phase!=='turn') return; } }
  if(m.p) addPowder(T,m.p);
  if(m.salvo) addPowder(T,T.board.filter(b=>b).length+1);
  if(m.fuse){ const i=T.board.findIndex(b=>b&&!b.fired&&!b.jam); if(i>=0) addPowder1(T,i,Math.ceil(BASTIONS[T.board[i].k].fill/2)); }
  if(m.refire){ const i=T.lastFired; const b=i>=0&&T.board[i]; if(b){ emit(T,'refire',{i}); fire(T,i,b); } }
}
function addPowder1(T,i,n){ const b=T.board[i], F=BASTIONS[b.k].fill; const take=Math.min(F-b.fill,n); b.fill+=take; emit(T,'feed',{i,n:take}); if(b.fill>=F){ b.fill=0; b.fired++; fire(T,i,b); } }
function swapBases(T,i,j){ if(i===j||T.phase!=='turn') return false; if(T.freeSwap>0) T.freeSwap--; else if(T.energy<TUNE.swapCost) return false; else T.energy-=TUNE.swapCost; const x=T.board[i]; T.board[i]=T.board[j]; T.board[j]=x; emit(T,'swap',{i,j}); return true; }

/* ---------- the enemy's turn ---------- */
const wardCount = T => { let n=0; for(const c of T.disc) if(c.k==='ward') n++; return n; };
function wardFactor(T){ return Math.pow(1-(T.enemy.boss?TUNE.wardBoss:TUNE.wardCut),wardCount(T)); }
function enrageFactor(T){ return T.turn>=TUNE.enrageTurn?Math.pow(TUNE.enrage,T.turn-TUNE.enrageTurn+1):1; }
function intentOf(T,ahead){ const E=T.enemy, q=E.p[(E.pi+(ahead||0))%E.p.length]; return {type:q[0],x:q[1]}; }
function intentAmount(T,I){ I=I||intentOf(T); const atk=['hit','snipe','face','volley','ram']; if(!atk.includes(I.type)) return 0;
  return num(T.enemy.atk*I.x*enrageFactor(T)*wardFactor(T)*(T.hex>0?.5:1)); }
function hitTarget(T,I){ // for display: which slot would take it first (-1 = you)
  if(I.type==='face') return -1;
  const o=orderFor(T,I); return o.length?o[0]:-1; }
function orderFor(T,I){ const idx=[]; T.board.forEach((b,i)=>{ if(b) idx.push(i); }); if(I.type==='snipe'||T.enemy.rev) idx.reverse(); return idx; }
function endTurn(T){
  if(T.phase!=='turn') return;
  if(T.batch&&T.pending){ T.flushing=1; const n=T.pending; T.pending=0; addPowder(T,n); T.flushing=0; if(T.phase!=='turn') return; }
  const E=T.enemy;
  if(E.blight>0){ const v=E.blight; E.blight=E.blight/2<1?0:E.blight/2; emit(T,'tick',{n:v}); hurtEnemy(T,v,'blight'); if(T.phase!=='turn') return; }
  E.hunker=0; E.dodge=0;
  for(const b of T.board) if(b) b.jam=0;
  const I=intentOf(T);
  doIntent(T,I);
  if(T.hp<=0){ T.hp=0; T.phase='lost'; emit(T,'lost',{f:T.f}); return; }
  E.pi=(E.pi+1)%E.p.length;
  // hand: stuck cards stay, the rest go to the discard pile
  const keep=[]; for(const c of T.hand){ if(CARDS[c.k]&&CARDS[c.k].sticky) keep.push(c); else T.disc.push(c); } T.hand=keep;
  beginTurn(T);
}
function damageChain(T,x,order,src){
  // shields first, then down the order: excess carries on, and what is left lands on you
  if(T.shield>0){ const a=Math.min(T.shield,x); T.shield-=a; x-=a; emit(T,'absorb',{n:a}); }
  for(const i of order){ if(x<=0) return; const b=T.board[i]; if(!b) continue;
    if(b.hits){ b.hits--; emit(T,'hit',{i,n:x,gate:1}); if(b.hits<=0) killBase(T,i); return; }
    const a=Math.min(b.hp,x); b.hp-=a; x-=a; T.st.baseLost+=a/b.max; emit(T,'hit',{i,n:a});
    if(b.hp<=0) killBase(T,i);
  }
  if(x>0){ T.hp=num(T.hp-x); T.st.taken=num(T.st.taken+x/T.maxHp); emit(T,'hitYou',{n:x}); }
}
function killBase(T,i){ const b=T.board[i]; T.board[i]=null; T.disc.push({k:b.k,b:1,cheap:1}); emit(T,'baseDown',{i,k:b.k}); }
function doIntent(T,I){
  const E=T.enemy, amt=intentAmount(T,I);
  if(['hit','snipe','face','ram'].includes(I.type)&&T.hex>0) T.hex--;
  emit(T,'intent',{type:I.type,amt});
  switch(I.type){
    case 'hit': case 'ram': case 'snipe': damageChain(T,amt,orderFor(T,I)); break;
    case 'face': damageChain(T,amt,[]); break;
    case 'volley': { if(T.hex>0) T.hex--; let x=amt; for(let i=0;i<T.board.length;i++){ if(T.board[i]&&T.hp>0) damageChain(T,x,[i]); } damageChain(T,x*.5,[]); break; }
    case 'drain': { let n=I.x; const bs=T.board.filter(b=>b&&b.fill>0).sort((a,b)=>b.fill-a.fill); for(const b of bs){ const a=Math.min(b.fill,n); b.fill-=a; n-=a; if(n<=0) break; } T.mag=Math.max(0,T.mag-Math.max(0,n)); emit(T,'drain',{n:I.x}); break; }
    case 'jam': { const idx=[]; T.board.forEach((b,i)=>{ if(b) idx.push(i); }); if(!idx.length) break;
      let i; if(I.x<0){ E.seized=(E.seized||0); i=idx[E.seized%idx.length]; E.seized++; if(E.seize){ for(let q=0;q<Math.min(E.seized,idx.length);q++) T.board[idx[q]].jam=1; } }
      else i=I.x===0?idx[0]:idx[idx.length-1];
      T.board[i].jam=1; emit(T,'jam',{i}); break; }
    case 'rubble': for(let i=0;i<I.x;i++) T.disc.push({k:'rubble'}); emit(T,'rubbleIn',{n:I.x}); break;
    case 'hunker': E.hunker=I.x; emit(T,'hunker',{x:I.x}); break;
    case 'dodge': E.dodge=1; emit(T,'dodge'); break;
    default: break;
  }
}

/* ---------- ending a trip ---------- */
function endTrip(P,T,how){
  const keep=how==='retreat'?1:TUNE.defeatKeep, got=num(T.coin*keep);
  const prevDeep=P.deepest;
  P.coin=num(P.coin+got); P.deepest=Math.max(P.deepest,T.deepest); P.beaten=Math.max(P.beaten,T.beaten); P.crests+=T.crests;
  if(T.beaten>=TUNE.finalBoss) P.won=true;
  P.trips++; if(how!=='retreat') P.defeats++;
  P.keep=[...new Set(T.spoils)];
  P.playedTurns+=T.st.turns;
  const lostTo=how==='retreat'?null:{n:T.enemy.n,i:T.enemy.i,f:T.f};
  P.last={how,got,lost:T.coin-got,f:T.f,startF:T.startF,newDeep:P.deepest>prevDeep,deepest:P.deepest,turns:T.st.turns,top:T.st.topHit,crests:T.crests,lostTo,need:how==='retreat'?0:T.enemy.hp/Math.max(1,T.enemy.max)};
  P.seed=(T.seed+1)|0;
  rollOffers(P);
  return P.last;
}
function keepSpoil(P,k){ if(k&&P.keep.includes(k)) gainType(P,k); P.keep=[]; }

/* ---------- the fixed policy: also the Auto button, and how Power is measured ---------- */
const CARD_RANK = {p:3,d:2,s:1};
function autoTurn(T){
  let guard=0;
  while(T.phase==='turn'&&guard++<40){
    const a=autoChoice(T); if(!a) break;
    if(a.swap) swapBases(T,a.swap[0],a.swap[1]); else if(!playCard(T,a.i,a.m,a.slot)) break;
  }
}
function autoChoice(T){
  let best=null, bs=-1, attack=intentAmount(T)>0;
  const room=T.board.some(b=>b&&!b.fired&&!b.jam);
  T.hand.forEach((c,i)=>{
    const cost=cardCost(T,c); if(cost>T.energy) return;
    if(c.b){ const s=T.board.indexOf(null); if(s>=0&&10>bs){ best={i,m:0,slot:s}; bs=10; } return; }
    const d=CARDS[c.k];
    if(d.sticky){ if(.5>bs){ best={i,m:0}; bs=.5; } return; }
    d.m.forEach((m,mi)=>{
      let s=0;
      if(m.e) s=9;
      else if(m.draw&&!m.fileall) s=8;
      else if(m.p||m.salvo||m.fuse) s=room?7+(m.p||2)/(cost+1)*.1:0;
      else if(m.refire) s=T.lastFired>=0?6.5:0;
      else if(m.d) s=4+(m.d/(cost||1))*.01;
      else if(m.rally) s=T.board.some(b=>b&&b.fired)?4.5:1;
      else if(m.b) s=3.5;
      else if(m.s) s=attack?3:1;
      else if(m.hex) s=attack?2.5:.8;
      else if(m.repair) s=T.board.some(b=>b&&!b.hits&&b.hp<b.max)?2:.6;
      else if(m.fileall) s=T.hand.some(x=>CARDS[x.k]&&CARDS[x.k].sticky)?5:.6;
      if(s>bs&&s>0){ best={i,m:mi}; bs=s; }
    });
  });
  return best;
}
const DUMMY={n:'Practice Dummy',i:'🎯',h:1e280,a:0,p:[['rest',0]]};
function estPower(P,deals,turns){
  deals=deals||6; turns=turns||3; let dmg=0, sh=0;
  const seed0=NUMCHK.bad;
  for(let s=0;s<deals;s++){
    const T=startTrip(P,{seed:777+s*97,noFight:true}); T.ev=null; T.f=1; T.stores=T.stores; startFight(T,DUMMY); T.enemy.dummy=1;
    let shieldSum=0;
    for(let t=0;t<turns;t++){ autoTurn(T); shieldSum+=T.shield; if(T.phase!=='turn') break; if(t<turns-1||true) endTurn(T); }
    dmg+=T.st.dealt; sh+=shieldSum;
  }
  NUMCHK.bad=seed0;
  const T0=startTrip(P,{seed:1,noFight:true}); let baseHp=0; for(const b of T0.board) if(b&&!b.hits) baseHp+=b.max;
  dmg/=deals; sh/=deals;
  return {dmg,tough:T0.maxHp+baseHp+sh};
}
function cloneT(T){ const c=Object.assign({},T); c.ev=null; c.board=T.board.map(b=>b&&Object.assign({},b)); c.draw=T.draw.slice(); c.hand=T.hand.slice(); c.disc=T.disc.slice(); c.burn=T.burn.slice(); c.cards=T.cards; c.spoils=T.spoils; c.enemy=Object.assign({},T.enemy); c.st=Object.assign({},T.st); c.cache=null; return c; }

if(typeof module!=='undefined') module.exports={SLOT,slotKey,newProfile,fixLayout,offerPrice,rollOffers,buyOffer,gainType,levelPrice,canLevel,buyLevel,buyMax,buyDeed,charterPrice,buyCharter,buyWork,setBench,standing,firstBossAhead,dropIn,startTrip,startFight,beginTurn,playCard,swapBases,endTurn,nextFight,pickCache,endTrip,keepSpoil,autoTurn,autoChoice,estPower,cloneT,intentOf,intentAmount,hitTarget,cardCost,lvl,fightHp,fightAtk,fightCoin,isBoss,levelCap,deedCount,slotCount,enemyFor,defOf,shuffle,rng,DUMMY,wardCount,enrageFactor,newBase};
