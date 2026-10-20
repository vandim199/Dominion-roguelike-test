"use strict";
/* ==========================================================
   Coinkeep — rules: state, waves, threats, turn flow.
   Rendering and modals live in ui.js.
   ========================================================== */

let G=null, busy=false, tid=0, uid=0;
function mk(key,lv=0){ return {uid:++uid,key,lv:DB[key].noLv?0:lv,t:DB[key].t,mods:[]}; }
function pull(a,c){const i=a.indexOf(c);if(i>=0)a.splice(i,1);return i>=0;}
const hasJ  = k => !!G && G.jokers.some(j=>j.key===k);
const cname = c => DB[c.key].n+plus(c.lv);
const ctext = c => { const d=DB[c.key];
  if(typeof d.tx==='function') return d.tx(c.lv,c);
  if(d.tx) return d.tx;
  return `+${d.v*tierMult(c.lv)} Coin`; };
// Prices climb on the same curve as power: base + base×(tier bonus) + a small step per tier.
const baseCost = c => { const d=DB[c.key]; return d.c + (d.c||2)*(tierMult(c.lv)-1) + d.step*c.lv; };
const costOf   = c => Math.max(0, baseCost(c)-(G?G.discount:0));
const allCards = () => [...G.deck,...G.hand,...G.discard,...G.inPlay];
const deckSize = () => allCards().length;
const handSize = () => TUNE.handSize+(hasJ('greedy')?1:0);
const waveCleared = () => !G.queue.length && G.slots.every(s=>!s);
const splice = () => !!G && G.mode==='splice';
const hasMod = (c,k) => c.mods.includes(k);
const modCount = (c,k) => c.mods.filter(m=>m===k).length;
const slotsUsed = c => c.mods.filter(m=>!SPLICES[m].scar).length;
// Actions a card costs to play: Nimble makes an Action free, Heavy adds one (even to a Treasure).
const actCost = c => (c.t==='action'&&!hasMod(c,'free')?1:0)+(hasMod(c,'heavy')?1:0);
// Frozen for the turn (Frostbite), or sealed in an Ice Coffin for as long as its threat stands.
const iced = c => !!c.ice && G.slots.some(t=>t&&t.id===c.ice);
const isFrozen = c => !!c.frozen || iced(c);
// How much a card is worth to you: what a threat would most like to take away.
const cardWorth = c => isJunk(c) ? -1 : (c.t==='treasure'?tval(c):baseCost(c)) + 4*slotsUsed(c);

function loadBest(){ try{ return +localStorage.getItem('dcrisis.best')||0; }catch(e){ return 0; } }
function saveBest(n){ try{ if(n>loadBest()) localStorage.setItem('dcrisis.best',String(n)); }catch(e){} }

function jokerStatus(j){
  switch(j.key){
    case 'minimal': return deckSize()<=15 ? 'active' : `${deckSize()}/15`;
    case 'vintage': return `+${j.age}`;
    case 'hoarder': return `+${Math.floor(deckSize()/4)}`;
    case 'trophy':  return `+${Math.floor(G.runCleared/2)}`;
  }
  return '';
}

function newRun(mode){
  G={ mode:mode||(G&&G.mode)||'splice', hearts:TUNE.hearts, pending:[], deck:[],hand:[],discard:[],inPlay:[],trash:[],
      coin:0,actions:0,buys:0,actionsPlayed:0,treasuresPlayed:0,discount:0,echoUsed:false,wallUsed:false,
      market:[], slots:new Array(TUNE.slots).fill(null), queue:[],
      wave:0, turn:0, turnInWave:0, waveTotal:0, runCleared:0,
      jokers:[], next:{actions:0,buys:0,coin:0}, later:{coin:0}, phase:'turn', over:false };
  for(let i=0;i<7;i++)G.deck.push(mk('copper'));
  for(let i=0;i<3;i++)G.deck.push(mk('shack'));
  resetUI();
  log('The bells of Coinkeep ring out: trouble is coming, wave after wave. Your deck is yours for the whole run — build it with care.','hl');
  if(splice()) log('Splice mode: clear threats before their fuse runs out to graft keywords onto your cards.','hl');
  startWave(1);
}

function newThreat(key,w,elite){
  const d=THREATS[key], cs=TUNE.coinScale(w), ks=TUNE.countScale(w), em=elite?1.8:1, steps=Math.floor((w-1)/3);
  const as=TUNE.actScale(w), bs=TUNE.buyScale(w);
  const t={key,...d,atk:{...d.atk},prog:0,id:++tid,elite:!!elite,age:0};
  switch(d.kind){
    case 'prog_coin': case 'once_coin': t.need=Math.round(d.need*cs*em); break;
    case 'prog_action': t.need=Math.round(d.need*as*em); break;
    case 'prog_buy':    t.need=Math.round(d.need*bs*em); break;
    case 'prog_discard': case 'leech': t.need=Math.round(d.need*ks*em); break;
    case 'sacrifice':   t.need=Math.round((d.need+steps)*em); break;
    case 'panic':       t.curses=Math.round((d.curses+steps)*em); break;
    case 'once_hybrid': t.needCoin=Math.round(d.needCoin*cs*em); t.needAct=Math.round(d.needAct*as*em); break;
    case 'upgrade':     t.needT=t.needA=Math.round((1+Math.floor((w-1)/4))*em); t.gotT=t.gotA=0; break;
    case 'scavenge':    t.need=Math.round((d.need+2*steps)*em); break;
    case 'banish':      t.need=Math.round((d.need+steps)*em); break;
  }
  if(t.atk.n) t.atk.n+=Math.floor((w-1)/5);
  if(elite){ t.n='Elite '+d.n; t.atk.every=Math.max(1,d.atk.every-1); t.fuse=(d.fuse||4)+1;
    if(w>=TUNE.coffinFrom) t.coffin=(t.coffin||0)+1; }
  t.cd=splice()?fuseOf(t):effEvery(t);
  return t;
}
function fuseOf(t){ return Math.max(1,(t.fuse||4)-(hasJ('glass')?1:0)+(hasJ('hourglass')?1:0)); }
function effEvery(t){
  if(t.age>=TUNE.enrageAfter) return 1;
  return Math.max(1, t.atk.every-(hasJ('glass')?1:0)+(hasJ('hourglass')?1:0));
}

/* ---------- market ---------- */
function rollTier(){ const m=TUNE.maxTier(G.wave); return Math.max(0,wpick([[m,44],[m-1,30],[m-2,13],[m+1,9],[m+2,4]])); }
function randomTreasure(){
  const w=G.wave;
  return mk(wpick([['copper',Math.max(6,40-w*6)],['silver',40],['gold',12+w*4]]),rollTier());
}
function marketCard(){ return mk(pick(splice()?CORE:KINGDOM),rollTier()); }
function ensureCoin(){ if(!G.market.some(c=>c&&c.t==='treasure')) G.market[G.market.length-1]=randomTreasure(); }
function newMarket(){
  G.market=[]; for(let i=0;i<TUNE.marketSize-1;i++) G.market.push(marketCard());
  G.market.splice(rnd(TUNE.marketSize),0,randomTreasure());
}
function cycleMarket(){
  const gone=G.market.splice(0,2);
  G.market.push(marketCard(),marketCard()); ensureCoin();
  log(`Market rotates: ${gone.map(cname).join(' and ')} leave the stalls.`);
}
function refillSlot(i,wasT){ G.market[i]= wasT?randomTreasure():marketCard(); ensureCoin(); }

/* ---------- deck ---------- */
function popDeck(){
  if(!G.deck.length){ if(!G.discard.length)return null;
    G.deck=shuffle(G.discard.slice()); G.discard=[]; log('You shuffle your discard pile back into your deck.'); }
  return G.deck.shift()||null;
}
function draw(n){
  let g=0, eaten=0, worm=null;
  for(let i=0;i<n;i++){
    worm=G.acting>0&&G.slots.find(t=>t&&t.kind==='leech');
    if(worm){ worm.prog++; eaten++; fx('hit',worm); if(isDone(worm)){ log(`${worm.n} eats ${plural(eaten,'draw')} and is full.`,'hl'); eaten=0; completeThreat(worm); } continue; }
    const c=popDeck(); if(!c)break; G.hand.push(c); g++;
  }
  if(eaten&&worm) log(`${worm.n} eats ${plural(eaten,'draw')} (${worm.prog}/${worm.need}).`,'bad');
  return g;
}
// Card effects (Actions, splices) draw through here, so the Bookworm can tell them from your hand.
async function acting(fn){ G.acting=(G.acting||0)+1; try{ return await fn(); } finally{ G.acting--; } }
function gatherDeck(){
  G.deck=shuffle([...G.deck,...G.hand,...G.discard,...G.inPlay]);
  G.hand=[]; G.discard=[]; G.inPlay=[];
  G.deck.forEach(c=>{ c.frozen=false; c.ice=0; });
}
function trashCard(c,quiet){
  G.trash.push(c);
  const scrap=hasJ('scrapper'); if(scrap) C(2);
  if(!quiet||scrap) log(`${cname(c)} is trashed${scrap?' (+2 Scrapper)':''}.`);
}
// Jinxes and Rubble arriving from threats — a Night Watch in hand turns them away.
const junkName = (key,n) => key==='jinx' ? plural(n,'Jinx','Jinxes') : plural(n,DB[key].n);
function gainJunk(key,n,where='discard'){
  if(n<=0) return;
  if(G.hand.some(c=>c.key==='nightwatch')){
    for(let i=0;i<n;i++) trashCard(mk(key),true);
    log(`Night Watch turns away ${junkName(key,n)}.`,'good'); return;
  }
  for(let i=0;i<n;i++){ const c=mk(key);
    if(where==='deck') G.deck.splice(rnd(G.deck.length+1),0,c); else G.discard.push(c); }
  log(`${junkName(key,n)} land${n===1?'s':''} in your ${where==='deck'?'draw pile':'discard pile'}.`,'bad');
}

function tval(c){
  let v = c.key==='treasury'
    ? tierMult(c.lv)*(G.inPlay.filter(x=>x.t==='treasure'&&x!==c).length+1)
    : DB[c.key].v*tierMult(c.lv)+(c.grow||0);
  v=Math.max(0,v+(modCount(c,'coin')-modCount(c,'rust'))*tierMult(c.lv));
  if(hasJ('midas')) v+=1;
  if(hasJ('gilded')&&c.key==='copper') v+=2;
  const vin=G.jokers.find(j=>j.key==='vintage'); if(vin) v+=vin.age;
  if(hasJ('golden')) v*=2;
  if(hasJ('glass')) v*=3;
  if(hasJ('minimal')&&deckSize()<=15) v*=2;
  return v;
}

/* ==========================================================
   WAVES
   ========================================================== */
function startWave(w){
  G.wave=w; G.turnInWave=0;
  gatherDeck();
  const n=TUNE.threatsInWave(w), elite=w%TUNE.eliteEvery===0;
  const pool=THREAT_KEYS.filter(k=>w>=3||!THREATS[k].late);
  G.queue=[]; for(let i=0;i<n;i++) G.queue.push(newThreat(pick(pool),w,elite&&i===n-1));
  G.waveTotal=n;
  const prevTier=w>1?TUNE.maxTier(w-1):0;
  newMarket();
  log(`Wave ${w}`,'wave'); fx('wave',w);
  log(`${plural(n,'threat')} approach${elite?', led by an Elite':''}.`,'hl');
  if(TUNE.maxTier(w)>prevTier) log(`The market now stocks ${tierName(TUNE.maxTier(w))} tier cards.`,'good');
  spawnThreat();
  G.next={actions:0,buys:0,coin:0};
  draw(handSize());
  startTurn();
}

async function endWave(){
  G.phase='camp';
  log(`Wave ${G.wave} cleared!`,'good');
  saveBest(G.wave);
  G.jokers.forEach(j=>j.age++);
  gatherDeck(); G.coin=0; G.actions=0; G.buys=0; render();
  await sleep(350);
  await jokerDraft(G.wave%TUNE.eliteEvery===0?4:3);
  await campService();
  G.phase='turn';
  startWave(G.wave+1);
}

function rollJokers(n){
  const cand=Object.keys(JOKERS).filter(k=>!hasJ(k)), out=[];
  while(out.length<n&&cand.length){
    const k=wpick(cand.map(k=>[k,RARITY[JOKERS[k].r]]));
    out.push(k); pull(cand,k);
  }
  return out;
}

async function jokerDraft(n){
  const offers=rollJokers(n); if(!offers.length) return;
  const full=G.jokers.length>=TUNE.jokerSlots;
  const k=await chooseJoker(offers,`Wave ${G.wave} cleared — choose a charm`,
    full?`Your ${TUNE.jokerSlots} charm slots are full. Taking one means giving another away.`
        :`Charm slots ${G.jokers.length}/${TUNE.jokerSlots}.${G.wave%TUNE.eliteEvery===0?' The Elite fell: an extra charm is on offer.':''}`);
  if(!k) return;
  if(full){
    const out=await chooseJoker(G.jokers.map(j=>j.key),`Give up a charm for ${JOKERS[k].n}?`,'Pick the charm to let go.',{skip:'Keep my charms'});
    if(!out){ log(`You pass on ${JOKERS[k].n}.`); return; }
    G.jokers=G.jokers.filter(j=>j.key!==out);
    log(`${JOKERS[out].n} is given away.`);
  }
  G.jokers.push({key:k,age:0});
  log(`${JOKERS[k].art} ${JOKERS[k].n} joins your charms.`,'good');
  render();
}

function deckSummary(){
  const all=allCards(), by=t=>all.filter(c=>c.t===t).length;
  const junk=all.filter(c=>DB[c.key].noLv).length;
  return `${all.length} cards — ${by('treasure')} Treasures, ${by('action')} Actions, ${junk} junk`;
}

async function campService(){
  const o=await chooseOption('🍺 The Inn',`${deckSummary()}. Choose one service before wave ${G.wave+1}.`,[
    ['purge','🔥 Clear out — trash up to 2 cards'],
    ['temper','⚒ Blacksmith — upgrade a card one tier'],
    ['copy','📜 Copyist — copy a card'],
    ...(splice()?[['mend','🩹 Mender — remove the scars from a card'],['heal',`❤ Rest — recover 2 hearts (${G.hearts}/${TUNE.hearts})`]]:[]),
    ['rest','Move on']]);
  const sorted=()=>G.deck.slice().sort((a,b)=>cname(a).localeCompare(cname(b)));
  if(o==='purge'){
    const s=await chooseCards(sorted(),{min:0,max:2,title:'Clear out',sub:'Trash up to 2 cards from your deck for good.'});
    s.forEach(c=>{pull(G.deck,c);trashCard(c);});
  } else if(o==='temper'){
    const s=await chooseCards(sorted().filter(c=>!DB[c.key].noLv),{min:0,max:1,title:'Blacksmith',
      sub:'Upgrade one card a tier.',badge:c=>DB[c.key].n+plus(c.lv+1)});
    if(s[0]){ const was=cname(s[0]); s[0].lv++; log(`${was} is tempered into ${cname(s[0])}.`,'good'); }
  } else if(o==='copy'){
    const s=await chooseCards(sorted().filter(c=>!DB[c.key].noLv),{min:0,max:1,title:'Copyist',sub:'Add a copy of one card to your deck.'});
    if(s[0]){ G.deck.push(clone(s[0])); log(`You copy ${cname(s[0])}.`,'good'); }
  } else if(o==='mend'){
    const s=await chooseCards(sorted().filter(c=>c.mods.some(m=>SPLICES[m].scar)),{min:0,max:1,title:'Mender',sub:'Remove every scar from one card.'});
    if(s[0]){ s[0].mods=s[0].mods.filter(m=>!SPLICES[m].scar); log(`${cname(s[0])} is mended.`,'good'); }
  } else if(o==='heal'){
    G.hearts=Math.min(TUNE.hearts,G.hearts+2); log(`You rest. The town has ${plural(G.hearts,'heart')}.`,'good');
  }
}

/* ==========================================================
   THREAT FLOW
   ========================================================== */
function spawnThreat(){
  if(!G.queue.length) return true;
  const idx=G.slots.findIndex(s=>s===null);
  if(idx<0){
    const t=G.queue[0];
    lose(`${t.n} arrives with nowhere to stand`,
         `All ${TUNE.slots} slots were still occupied when the next threat came due.`);
    return false;
  }
  const t=G.queue.shift();
  t.fresh=true; t.age=0; t.cd=splice()?fuseOf(t):effEvery(t);
  G.slots[idx]=t;
  log(`${t.art} ${t.n} takes slot ${idx+1}.`,'bad');
  if(t.coffin) entomb(t,t.coffin);
  return true;
}

// Ice Coffin: seal your most valuable cards, wherever they are, until this threat leaves.
function entomb(t,n){
  for(let i=0;i<n;i++){
    const c=allCards().filter(c=>!isJunk(c)&&!iced(c)).sort((a,b)=>cardWorth(b)-cardWorth(a))[0];
    if(!c) return;
    c.ice=t.id;
    log(`🧊 ${t.n} seals your ${cname(c)} in an Ice Coffin until it leaves.`,'bad');
  }
}
function thaw(t){
  const sealed=allCards().filter(c=>c.ice===t.id);
  sealed.forEach(c=>{ c.ice=0; });
  if(sealed.length) log(`The ice cracks: ${sealed.map(cname).join(', ')} ${sealed.length===1?'is':'are'} free.`,'good');
}

function completeThreat(t){
  const i=G.slots.indexOf(t); if(i<0) return;
  G.slots[i]=null; thaw(t);
  G.runCleared++;
  log(`${t.n} cleared.`,'good'); fx('clear',t);
  gainJunk('rubble',1);
  if(hasJ('bounty')){ draw(1); A(1); C(2); log('Bounty Hunter pays out: +1 Card, +1 Action, +2 Coin.','good'); }
  if(splice()) G.pending.push({from:t.n, swift:t.age<=1, elite:t.elite});
}

/* ==========================================================
   SPLICING
   ========================================================== */
function canSplice(c,k){
  const S=SPLICES[k];
  if(isJunk(c)) return false;
  if(S.only&&c.t!==S.only) return false;
  if(S.once&&hasMod(c,k)) return false;
  return S.scar || slotsUsed(c)<TUNE.spliceSlots(c);
}
function rollSplices(n,elite){
  const cand=Object.keys(SPLICES).filter(k=>!SPLICES[k].scar), out=[];
  while(out.length<n&&cand.length){ const k=wpick(cand.map(k=>[k,RARITY[SPLICES[k].r]])); out.push(k); pull(cand,k); }
  if(elite&&!out.some(k=>SPLICES[k].r==='rare')) out[out.length-1]=pick(cand.filter(k=>SPLICES[k].r==='rare'));
  return out;
}
async function claimSplice(p){
  const k=await chooseSplice(rollSplices(p.swift?4:3,p.elite),`${p.from} cleared — choose a splice`,
    (p.swift?'Swift clear: an extra option. ':'')+(p.elite?'Elite: a rare one is guaranteed. ':'')+'Pick a keyword, then a card to graft it onto.');
  if(!k) return;
  const S=SPLICES[k];
  const elig=allCards().filter(c=>canSplice(c,k)).sort((a,b)=>cname(a).localeCompare(cname(b)));
  if(!elig.length){ log(`No card can take ${S.n}.`); return; }
  const s=await chooseCards(elig,{min:0,max:1,title:`Splice ${S.art} ${S.n}`,sub:`${spliceText(k)}. Cards hold ${TUNE.spliceSlots({lv:0})} splices (more when upgraded).`,
    badge:c=>`${slotsUsed(c)}/${TUNE.spliceSlots(c)}`});
  if(s[0]){ s[0].mods.push(k); log(`${S.art} ${cname(s[0])} is now ${S.n}.`,'good'); }
}
function scarCard(t){
  const k=t.scar||wpick([['rust',50],['heavy',30],['brittle',20]]);
  const cand=allCards().filter(c=>canSplice(c,k));
  if(!cand.length) return;
  const c=t.scarBest ? cand.sort((a,b)=>cardWorth(b)-cardWorth(a))[0] : pick(cand); c.mods.push(k);
  log(`${t.n} scars your ${cname(c)}: ${SPLICES[k].art} ${SPLICES[k].n} (${spliceText(k)}).`,'bad');
}
// Resolve rewards earned mid-action, then end the wave if the board is clear. True if the wave ended.
async function settle(){
  while(G.pending.length&&!G.over){ await claimSplice(G.pending.shift()); render(); }
  if(!G.over&&G.phase==='turn'&&waveCleared()){ await endWave(); return true; }
  return false;
}
// A splice mode fuse runs out: the threat attacks once, scars a card, costs hearts, and leaves.
async function detonate(t){
  log(`💥 ${t.art} ${t.n} detonates!`,'bad');
  t.detonating=true;
  const safe=await resolveAttack(t);
  const i=G.slots.indexOf(t); if(i>=0){ G.slots[i]=null; thaw(t); }
  if(safe) return;
  scarCard(t);
  const dmg=t.elite?2:1; G.hearts-=dmg; fx('hurt');
  log(`The town loses ${plural(dmg,'heart')} (${Math.max(0,G.hearts)} left).`,'bad');
  if(G.hearts<=0) lose('The town has lost heart',`${t.n} was the last straw.`);
}
const urgent = () => G.slots.filter(Boolean).sort((a,b)=>a.cd-b.cd)[0];
// Splice effects that fire each time a card resolves. Coin and Rusty on Treasures live in tval().
function spliceFx(c){
  for(const k of c.mods) switch(k){
    case 'quick':  A(1); break;
    case 'draw':   draw(1); break;
    case 'trade':  B(1); break;
    case 'coin':   if(c.t!=='treasure') C(1); break;
    case 'rust':   if(c.t!=='treasure'){ if(G.phase==='attack') G.next.coin--; else G.coin=Math.max(0,G.coin-1); } break;
    case 'grow':   if(c.t!=='treasure') C(c.grow||0); c.grow=(c.grow||0)+1; break;
    case 'strike': { const t=urgent(); if(t){ log(`${cname(c)}'s barbs strike ${t.n}.`); strike(t,.15); } break; }
  }
}
function afterPlay(c){
  if(hasMod(c,'brittle')&&pull(G.inPlay,c)){ trashCard(c,true); log(`${cname(c)} crumbles to dust.`,'bad'); }
}

function isDone(t){
  switch(t.kind){
    case 'once_coin':   return t.need<=0;
    case 'once_hybrid': return t.needCoin<=0&&t.needAct<=0;
    case 'panic':       return t.curses<=0;
    case 'upgrade':     return t.gotT>=t.needT&&t.gotA>=t.needA;
  }
  return t.prog>=t.need;
}

// Cards, reactions and charms "strike" a threat: knock a fraction off what it demands.
function strike(t,frac){
  if(!G.slots.includes(t)) return;
  if(hasJ('eagle')) frac+=.15;
  fx('hit',t);
  const hit=x=>Math.max(1,Math.ceil(x*frac));
  switch(t.kind){
    case 'once_coin':   { const d=hit(t.need); t.need=Math.max(0,t.need-d); log(`${t.n}'s fee drops by ${d}.`,'good'); break; }
    case 'once_hybrid': { const d=hit(t.needCoin); t.needCoin=Math.max(0,t.needCoin-d);
                          if(t.needCoin<=0) t.needAct=0; log(`${t.n}'s price drops by ${d} coin.`,'good'); break; }
    case 'panic':       { const d=hit(t.curses); t.curses=Math.max(0,t.curses-d); log(`${t.n} drops ${junkName('jinx',d)} from its terms.`,'good'); break; }
    case 'upgrade':     { if(t.gotT<t.needT) t.gotT++; else t.gotA++; log(`${t.n} collapses a little.`,'good'); break; }
    default:            { const d=hit(t.need-t.prog); t.prog=Math.min(t.need,t.prog+d); log(`${t.n} takes ${d} progress.`,'good'); }
  }
  if(isDone(t)) completeThreat(t);
}

// Ask the player to aim at a threat; with only one on the board, it is chosen for them.
async function chooseThreat(title,sub){
  const live=G.slots.filter(Boolean);
  if(live.length<=1) return live[0]||null;
  const k=await chooseOption(title,sub,live.map(t=>[t.id,`${t.art} ${t.n} — ${threatProgress(t).left}`]));
  return live.find(t=>t.id===k)||null;
}

const coinMult = () => hasJ('interest')?2:1;
const unitMult = () => hasJ('clerk')?2:1;
const coinFor  = need => Math.ceil(need/coinMult());
const unitsFor = need => Math.ceil(need/unitMult());

function threatReady(t){
  switch(t.kind){
    case 'prog_coin':     return G.coin>0;
    case 'once_coin':     return G.coin>=coinFor(t.need);
    case 'prog_action':   return G.actions>0;
    case 'prog_buy':      return G.buys>0;
    case 'prog_discard':  return G.hand.length>0;
    case 'sacrifice':     return G.hand.some(c=>c.key!=='rubble');
    case 'scavenge':      return G.hand.length>0;
    case 'banish':        return G.actionsPlayed>=t.need-t.prog;
    case 'leech':         return false;
    case 'panic':         return true;
    case 'once_hybrid':   return G.coin>=coinFor(t.needCoin) && G.actions>=unitsFor(t.needAct);
    case 'upgrade':       return G.hand.some(c=>(t.gotT<t.needT&&c.t==='treasure')||(t.gotA<t.needA&&c.t==='action'));
  }
  return false;
}

async function clickThreat(t){
  if(busy||G.over||G.phase!=='turn'||!threatReady(t)) return;
  busy=true;
  try{
    const rem=t.need-t.prog;
    switch(t.kind){
      case 'prog_coin':{
        const amt=Math.min(G.coin,coinFor(rem));
        G.coin-=amt; t.prog=Math.min(t.need,t.prog+amt*coinMult());
        log(`You pour ${amt} coin into ${t.n} (${t.prog}/${t.need}).`,'hl'); break; }
      case 'once_coin':{
        const amt=coinFor(t.need); G.coin-=amt; t.need=0;
        log(`You pay ${amt} coin to ${t.n} in one stroke.`,'hl'); break; }
      case 'prog_action':{
        const amt=Math.min(G.actions,unitsFor(rem));
        G.actions-=amt; t.prog=Math.min(t.need,t.prog+amt*unitMult());
        log(`You burn ${plural(amt,'Action')} on ${t.n} (${t.prog}/${t.need}).`,'hl'); break; }
      case 'prog_buy':{
        const amt=Math.min(G.buys,unitsFor(rem));
        G.buys-=amt; t.prog=Math.min(t.need,t.prog+amt*unitMult());
        log(`You trade away ${plural(amt,'Buy')} to ${t.n} (${t.prog}/${t.need}).`,'hl'); break; }
      case 'prog_discard':{
        const s=await chooseCards(G.hand,{min:0,max:rem,title:t.n,sub:`Discard cards into it. ${rem} still wanted.`});
        s.forEach(c=>{pull(G.hand,c);G.discard.push(c);});
        t.prog+=s.length;
        if(s.length) log(`You feed ${plural(s.length,'card')} to ${t.n} (${t.prog}/${t.need}).`,'hl'); break; }
      case 'sacrifice':{
        const s=await chooseCards(G.hand.filter(c=>c.key!=='rubble'),{min:0,max:rem,title:t.n,
          sub:`Trash cards into the idol. ${rem} still wanted. Rubble is refused.`});
        s.forEach(c=>{pull(G.hand,c);trashCard(c);});
        t.prog+=s.length;
        if(s.length) log(`You sacrifice ${plural(s.length,'card')} to ${t.n} (${t.prog}/${t.need}).`,'hl'); break; }
      case 'scavenge':{
        const s=await chooseCards(G.hand,{min:0,max:99,title:t.n,
          sub:`Trash cards into the nest. ${rem} still wanted — junk counts double.`,badge:c=>isJunk(c)?'×2':''});
        const got=s.reduce((n,c)=>n+(isJunk(c)?2:1),0);
        s.forEach(c=>{pull(G.hand,c);trashCard(c,true);});
        t.prog=Math.min(t.need,t.prog+got);
        if(s.length) log(`The rats drag ${plural(s.length,'card')} into the nest (${t.prog}/${t.need}).`,'hl'); break; }
      case 'banish':{
        t.prog=t.need; log(`With a flurry of activity, you banish the ${t.n}.`,'hl'); break; }
      case 'panic':{
        const ok=await chooseOption(t.n,`Shake on it? It clears at once and ${junkName('jinx',t.curses)} go into your discard pile.`,
          [['y','Shake on it'],['n','Step back']]);
        if(ok!=='y') break;
        log(`You shake hands with the ${t.n}.`,'bad');
        gainJunk('jinx',t.curses); t.curses=0; break; }
      case 'once_hybrid':{
        const c=coinFor(t.needCoin), a=unitsFor(t.needAct);
        G.coin-=c; G.actions-=a; t.needCoin=0; t.needAct=0;
        log(`You hand ${t.n} ${c} coin and ${plural(a,'Action')} at once.`,'hl'); break; }
      case 'upgrade':{
        const elig=G.hand.filter(c=>(t.gotT<t.needT&&c.t==='treasure')||(t.gotA<t.needA&&c.t==='action'));
        const s=await chooseCards(elig,{min:0,max:(t.needT-t.gotT)+(t.needA-t.gotA),title:t.n,
          sub:`Still needed: ${plural(t.needT-t.gotT,'Treasure')} and ${plural(t.needA-t.gotA,'Action')}.`});
        for(const c of s){
          if(c.t==='treasure'&&t.gotT<t.needT) t.gotT++;
          else if(c.t==='action'&&t.gotA<t.needA) t.gotA++;
          else continue;
          pull(G.hand,c); trashCard(c,true);
          log(`${cname(c)} is swallowed by ${t.n}.`,'hl');
        } break; }
    }
    if(isDone(t)) completeThreat(t);
    await settle();
  } finally { busy=false; render(); }
}

/* ---------- attacks ---------- */
function atkText(t){
  const a=t.atk, n=a.n, what=`random ${{treasure:'Treasure',action:'Action'}[a.filter]||'card'}`;
  switch(a.k){
    case 'grow':    return `its demand grows ${a.pct}%`;
    case 'discard': return `discard ${plural(n,what)} from your hand`;
    case 'trash':   return `trash ${plural(n,what)} from your hand`;
    case 'bulk':    return `${n} Rubble into your discard pile`;
    case 'curse':   return `${junkName('jinx',n)} into your discard pile`;
    case 'nobuy':   return `−${plural(n,'Buy')} next turn`;
    case 'price':   return `the bargain demands ${plural(n,'more Jinx','more Jinxes')}`;
    case 'warp':    return `${n} Rubble shuffled into your draw pile`;
    case 'pickpocket': return `−${n} Coin next turn`;
    case 'freeze':  return `freeze your ${n===1?'best card':n+' best cards'} in hand for a turn`;
    case 'entomb':  return `seal ${n===1?'your finest card':`your ${n} finest cards`} in ice while it stands`;
  }
  return '';
}

function applyAttack(t){
  const a=t.atk, n=a.n;
  if(t.detonating&&a.k==='grow'){ fx('hurt'); return; }
  if(t.detonating&&a.k==='price'){ gainJunk('jinx',t.curses); fx('hurt'); return; }
  if(t.detonating&&a.k==='entomb'){ fx('hurt'); return; }      // it's leaving: the coffin would thaw at once
  switch(a.k){
    case 'grow':
      if(t.kind==='once_hybrid') t.needCoin=Math.ceil(t.needCoin*(1+a.pct/100));
      else t.need=Math.ceil(t.need*(1+a.pct/100));
      log(`${t.n} now wants ${t.kind==='once_hybrid'?t.needCoin:t.need}.`,'bad'); break;
    case 'discard':
      for(let i=0;i<n;i++){ const pool=G.hand.filter(c=>!a.filter||c.t===a.filter); if(!pool.length)break;
        const c=pick(pool); pull(G.hand,c); G.discard.push(c);
        log(`${cname(c)} is knocked from your hand.`,'bad'); } break;
    case 'trash':
      for(let i=0;i<n;i++){ const pool=G.hand.filter(c=>!a.filter||c.t===a.filter); if(!pool.length)break;
        const c=pick(pool); pull(G.hand,c); trashCard(c,true); log(`${t.n} destroys your ${cname(c)}.`,'bad'); } break;
    case 'bulk':  gainJunk('rubble',n); break;
    case 'curse': gainJunk('jinx',n); break;
    case 'nobuy': G.next.buys-=n; log(`You will have ${plural(n,'Buy')} fewer next turn.`,'bad'); break;
    case 'price': t.curses+=n; log(`${t.n} now costs ${junkName('jinx',t.curses)}.`,'bad'); break;
    case 'warp':  gainJunk('rubble',n,'deck'); break;
    case 'pickpocket': G.next.coin-=n; log(`Light fingers: ${n} Coin fewer next turn.`,'bad'); break;
    case 'freeze':
      if(hasJ('mittens')){ log('Warm Mittens keep your cards thawed.','good'); break; }
      for(let i=0;i<n;i++){ const c=G.hand.filter(c=>!isFrozen(c)&&!isJunk(c)).sort((a,b)=>cardWorth(b)-cardWorth(a))[0]; if(!c)break;
        c.frozen=true; log(`${cname(c)} freezes solid.`,'bad'); } break;
    case 'entomb': entomb(t,n); break;
  }
  fx('hurt');
}

function blocked(t){
  if(t.detonating) log(`${t.n} fizzles out and leaves.`,'good');
  if(hasJ('thorns')&&G.slots.includes(t)){ log('Thorns bite back.','good'); strike(t,.2); }
}

// Returns true when the attack was blocked or the threat destroyed.
async function resolveAttack(t){
  const a=t.atk, txt=atkText(t);
  log(`${t.art} ${t.n} — ${a.name}: ${txt}.`,'bad');
  if(hasJ('wall')&&!G.wallUsed){ G.wallUsed=true; log('Iron Wall absorbs the blow.','good'); blocked(t); return true; }
  const best=f=>G.hand.filter(f).sort((x,y)=>y.lv-x.lv)[0];
  const moat =best(c=>c.key==='guarddog');
  const rip  =best(c=>c.key==='riposte');
  const snare=best(c=>c.key==='snare'&&(!t.elite||c.lv>=1));
  const grd  =best(c=>hasMod(c,'guard'));
  const opts=[];
  if(grd)   opts.push(['guard',`🛡 Discard ${cname(grd)} — block`]);
  if(moat)  opts.push(['moat', `🐕 Reveal ${cname(moat)} — block`]);
  if(rip)   opts.push(['rip',  `🤺 Discard ${cname(rip)} — block & strike ${ripPct(rip.lv)}%`]);
  if(snare) opts.push(['snare',`🪤 Trash ${cname(snare)} — destroy it`]);
  if(opts.length){
    opts.push(['take','Take the hit']);
    const ch=await chooseOption(`${t.art} ${t.n} ${t.detonating?'detonates':'attacks'}!`,
      `${a.name}: ${txt}.${t.detonating?' It will also scar a card and cost the town a heart.':''}`,opts);
    if(ch==='guard'){ pull(G.hand,grd); G.discard.push(grd); log(`${cname(grd)} takes the blow.`,'good'); blocked(t); return true; }
    if(ch==='moat'){ log(`${cname(moat)} barks the attack away.`,'good'); blocked(t); return true; }
    if(ch==='rip'){ pull(G.hand,rip); G.discard.push(rip);
      log(`${cname(rip)} parries and strikes back!`,'good'); blocked(t); strike(t,ripPct(rip.lv)/100); return true; }
    if(ch==='snare'){ pull(G.hand,snare); trashCard(snare,true);
      log(`${cname(snare)} springs shut on ${t.n}!`,'good'); completeThreat(t); return true; }
  }
  applyAttack(t);
  return false;
}

/* ==========================================================
   CARD PLAY / BUY
   ========================================================== */
function canPlay(c){
  if(G.over||G.phase!=='turn'||isFrozen(c)) return false;
  if(c.key==='rubble') return G.actions>0||hasJ('tidy');
  if(c.t==='treasure'||c.t==='action') return G.actions>=actCost(c);
  return false;                      // Shack, Jinx
}

function playTreasure(c){
  pull(G.hand,c); G.inPlay.push(c); G.actions-=actCost(c);
  let v=tval(c);
  if(hasJ('mirror')&&G.treasuresPlayed===0){ v*=2; log('Mirror doubles it.','hl'); }
  if(hasMod(c,'twin')) v*=2;
  G.treasuresPlayed++;
  if(c.key==='nestegg') c.grow=(c.grow||0)+(hasJ('goose')?2:1);
  C(v); log(`${cname(c)} adds ${v} to your purse.`);
  G.acting=(G.acting||0)+1;
  try{ for(let i=hasMod(c,'twin')?2:1;i>0;i--) spliceFx(c); } finally{ G.acting--; }
  afterPlay(c);
}

async function runAction(c){
  G.actionsPlayed++;
  if(hasJ('momentum')&&G.actionsPlayed>1){ C(G.actionsPlayed-1); log(`Momentum: +${G.actionsPlayed-1} Coin.`,'hl'); }
  await acting(async()=>{ spliceFx(c); await DB[c.key].fx(c,c.lv); });
}

async function playCard(c){
  if(busy||!canPlay(c)||!G.hand.includes(c)) return;
  busy=true;
  try{
    if(c.t==='treasure') playTreasure(c);
    else if(c.key==='rubble'){
      if(!hasJ('tidy')) G.actions--;
      pull(G.hand,c); trashCard(c,true);
      log('You haul the Rubble away. It is gone from your deck for good.','good');
      if(hasJ('tidy')) draw(1);
    } else {
      G.actions-=actCost(c); pull(G.hand,c); G.inPlay.push(c);
      log(`You play ${cname(c)}.`,'hl');
      const times=((hasJ('echo')&&!G.echoUsed)?2:1)*(hasMod(c,'twin')?2:1); G.echoUsed=true;
      for(let i=0;i<times;i++){ if(i) log('It resolves again.','hl'); await runAction(c); render(); }
      afterPlay(c);
    }
    await settle();
  } finally { busy=false; render(); }
}

async function playAllTreasures(){
  if(busy||G.over||G.phase!=='turn') return;
  const tr=G.hand.filter(c=>c.t==='treasure'&&!isFrozen(c)&&!actCost(c)).sort((a,b)=>(a.key==='treasury')-(b.key==='treasury'));
  if(!tr.length) return;
  busy=true;
  try{ tr.forEach(playTreasure); await settle(); } finally { busy=false; render(); }
}

function buyCard(i){
  if(busy||G.over||G.phase!=='turn') return;
  const c=G.market[i]; if(!c) return;
  const price=costOf(c);
  if(G.buys<1||G.coin<price) return;
  G.buys--; G.coin-=price;
  const wasT=(c.t==='treasure');
  G.market[i]=null;
  G.deck.push(c);
  log(`You buy ${cname(c)} for ${price}. It waits at the bottom of your deck.`,'hl');
  refillSlot(i,wasT);
  render();
}

/* ==========================================================
   TURN FLOW
   ========================================================== */
function startTurn(){
  G.turn++; G.turnInWave++;
  const n=G.next;
  G.actions=Math.max(0,1+n.actions+(hasJ('wind')?1:0));
  G.buys=Math.max(0,1+n.buys+(hasJ('seal')?1:0));
  G.coin=Math.max(0,n.coin+G.later.coin);
  if(G.later.coin) log(`The orchard pays out ${G.later.coin} coin.`,'good');
  G.later={coin:0};
  if(hasJ('hoarder')) G.coin+=Math.floor(deckSize()/4);
  if(hasJ('trophy'))  G.coin+=Math.floor(G.runCleared/2);
  G.discount=hasJ('seal')?1:0;
  G.actionsPlayed=0; G.treasuresPlayed=0; G.echoUsed=false;
  G.next={actions:0,buys:0,coin:0};
  G.slots.forEach(t=>{ if(t) t.fresh=false; });
  log(`— Wave ${G.wave} · Turn ${G.turnInWave} —`,'turn');
  render();
}

async function endTurn(){
  if(busy||G.over||G.phase!=='turn') return; busy=true;
  try{
    const carry=hasJ('piggy')?Math.floor(G.coin/2):0;
    if(carry) log(`Piggy Bank keeps ${carry} coin for next turn.`);
    for(const c of G.inPlay.splice(0)) G.discard.push(c);
    const kept=G.hand.filter(c=>hasMod(c,'retain'));
    for(const c of G.hand.splice(0)){ c.frozen=false; if(!kept.includes(c)) G.discard.push(c); }
    G.hand.push(...kept);
    G.coin=0; G.actions=0; G.buys=0;
    G.next={actions:0,buys:0,coin:carry};

    draw(handSize());
    render(); await sleep(180);

    // threats strike at the hand you just drew — reactions in it can answer
    G.phase='attack'; G.wallUsed=false;
    for(const t of G.slots.slice()){
      if(!t||!G.slots.includes(t)) continue;
      t.age++; t.cd--;
      if(t.cd<=0&&splice()){
        render(); await detonate(t); render();
        if(G.over) return;
        await sleep(160);
      } else if(t.cd<=0){
        t.cd=effEvery(t); render();
        await resolveAttack(t); render();
        if(G.over) return;
        await sleep(160);
      }
    }
    G.phase='turn';
    if(await settle()) return;

    cycleMarket(); render(); await sleep(200);

    const due=G.turnInWave%TUNE.spawnEvery(G.wave)===0 || G.slots.every(s=>!s);
    if(due&&G.queue.length){ if(!spawnThreat()) return; await sleep(220); }
    startTurn();
  } finally { if(G.phase==='attack') G.phase='turn'; busy=false; render(); }
}

function lose(title,text){
  G.over=true;
  const cleared=G.wave-1; saveBest(cleared); fx('lose');
  showGameOver(`${title}. ${text} You survived ${plural(cleared,'wave')} and cleared ${plural(G.runCleared,'threat')} with a deck of ${deckSize()} cards. Best run: ${plural(loadBest(),'wave')} cleared.`);
}
