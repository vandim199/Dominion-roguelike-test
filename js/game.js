"use strict";
/* ==========================================================
   Coinkeep — rules: state, waves, threats, turn flow.
   Rendering and modals live in ui.js.
   Every chooseCards call carries a why (the card key, Inn
   service or threat kind) so the simulator's bots know what
   they are choosing for; the UI ignores it.
   ========================================================== */

let G=null, busy=false, tid=0, uid=0;
// Seeded randomness: its state lives in G.rng and is saved with the run, so a reload plays on exactly as
// it would have — reloading can't reroll a shuffle, a draw or an offer. Without a run, the browser's own.
const nativeRandom=Math.random;
Math.random=()=>{
  if(!G||G.rng==null) return nativeRandom();
  let t=G.rng=(G.rng+0x6D2B79F5)>>>0;
  t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61);
  return ((t^(t>>>14))>>>0)/4294967296;
};
function mk(key,lv=0){ return {uid:++uid,key,lv:DB[key].noLv?0:lv,t:DB[key].t,mods:[]}; }
function pull(a,c){const i=a.indexOf(c);if(i>=0)a.splice(i,1);return i>=0;}
const hasJ  = k => !!G && G.jokers.some(j=>j.key===k);
// Merge cards count levels in Roman numerals (Spark, Spark II…); Coins have names (Copper, Silver…).
const cname = c => { const d=DB[c.key];
  if(!d.merge) return d.n+plus(c.lv);
  if(d.fused) return d.size>3||d.fused.length>2 ? `Monolith ${c.lv?roman(c.lv+1)+' ':''}(${d.size})` : partsOf(c).map(p=>cname(p)).join('-');
  if(d.names) return c.lv<d.names.length ? d.names[c.lv] : `${d.names.at(-1)} ${roman(c.lv-d.names.length+2)}`;
  return c.lv ? `${d.n} ${roman(c.lv+1)}` : d.n; };
const cart = c => { const d=DB[c.key]; return d.arts ? d.arts[Math.min(c.lv,d.arts.length-1)] : d.art; };
const ctext = c => { const d=DB[c.key];
  if(d.merge){ const t=effText(d.eff(c.lv)); return d.react ? t+(t.endsWith('.')?' ':'. ')+d.react : t; }
  if(merge()&&d.mtx) return d.mtx;
  if(typeof d.tx==='function') return d.tx(c.lv,c);
  if(d.tx) return d.tx;
  return `+${d.v*tierMult(c.lv)} Coin`; };
// Prices climb on the same curve as power: base + base×(tier bonus) + a small step per tier.
// A merge card's price climbs with its level: base × level, plus 1 a level for the merging you skipped.
const baseCost = c => { const d=DB[c.key];
  if(d.merge) return d.c*(1+c.lv)+c.lv;
  return d.c + (d.c||2)*(tierMult(c.lv)-1) + d.step*c.lv; };
const costOf   = c => Math.max(0, baseCost(c)-(G?G.discount:0));
const allCards = () => [...G.deck,...G.hand,...G.discard,...G.inPlay];
const deckSize = () => allCards().length;
const handSize = () => hermitOn() ? 999 : TUNE.handSize+(hasJ('greedy')?1:0);
const waveCleared = () => !G.queue.length && G.slots.every(s=>!s);
const splice = () => !!G && G.mode==='splice';
const merge  = () => !!G && G.mode==='merge';
// Splice and merge mode share the fuse: a threat detonates once, costs hearts and leaves.
const fused  = () => splice()||merge();
// Merge mode's tiny-deck charms, and the chain: every threat cleared in a turn swells that turn's Coin.
const hermitOn    = () => merge()&&hasJ('hermit')&&deckSize()<=TUNE.hermitDeck;
const wolfExtra   = () => merge()&&hasJ('wolf') ? Math.floor(G.trash.length/TUNE.wolfPer) : 0;
const monkEnergy  = () => merge()&&hasJ('monk') ? Math.max(0,TUNE.monkDeck-deckSize()) : 0;
const minimalMult = () => merge()&&hasJ('minimal') ? 1+.1*Math.max(0,TUNE.minimalDeck-deckSize()) : 1;
const chainMult   = () => merge() ? Math.pow(TUNE.chain,G.chain||0) : 1;
const coinBoost   = () => chainMult()*minimalMult();
const multTxt = x => x>=100 ? fmt(x) : String(Math.round(x*100)/100);
const hasMod = (c,k) => c.mods.includes(k);
const modCount = (c,k) => c.mods.filter(m=>m===k).length;
const slotsUsed = c => c.mods.filter(m=>!SPLICES[m].scar).length;
// Actions (⚡) a card costs to play: Nimble makes an Action free, Heavy adds one (even to a Treasure).
// Merge cards say what they cost.
const actCost = c => (DB[c.key].merge ? DB[c.key].pc(c.lv) : c.t==='action'&&!hasMod(c,'free')?1:0)+(hasMod(c,'heavy')?1:0);
// Frozen for the turn (Frostbite), or sealed in an Ice Coffin for as long as its threat stands.
const iced = c => !!c.ice && G.slots.some(t=>t&&t.id===c.ice);
const isFrozen = c => !!c.frozen || iced(c);
// How much a card is worth to you: what a threat would most like to take away.
const cardWorth = c => isJunk(c) ? -1 : (c.t==='treasure'?tval(c):baseCost(c)) + 4*slotsUsed(c);

function loadBest(){ try{ return +localStorage.getItem('dcrisis.best')||0; }catch(e){ return 0; } }
function saveBest(n){ try{ if(n>loadBest()) localStorage.setItem('dcrisis.best',String(n)); }catch(e){} }

function jokerStatus(j){
  switch(j.key){
    case 'minimal': return merge() ? `×${multTxt(minimalMult())}` : deckSize()<=15 ? 'active' : `${deckSize()}/15`;
    case 'hermit':  return hermitOn() ? 'active' : `${deckSize()}/${TUNE.hermitDeck}`;
    case 'monk':    return `+${monkEnergy()} ⚡`;
    case 'wolf':    return `+${wolfExtra()}`;
    case 'keystone':{ const f=allCards().filter(c=>DB[c.key].fused).sort((a,b)=>partCount(b)-partCount(a))[0]; return f?`×${multTxt(synergyOf(partCount(f)))}`:''; }
    case 'vintage': return `+${j.age}`;
    case 'hoarder': return `+${Math.floor(deckSize()/4)}`;
    case 'trophy':  return `+${Math.floor(G.runCleared/2)}`;
  }
  return '';
}

function newRun(mode){
  // G.actions is the play resource: Actions in classic and splice mode, ⚡ Energy in merge mode.
  G={ rng:(nativeRandom()*4294967296)>>>0, mode:mode||(G&&G.mode)||'merge', hearts:TUNE.hearts, pending:[], deck:[],hand:[],discard:[],inPlay:[],trash:[],
      coin:0,actions:0,buys:0,actionsPlayed:0,treasuresPlayed:0,discount:0,echoUsed:false,wallUsed:false,
      market:[], slots:new Array(TUNE.slots).fill(null), queue:[],
      wave:0, turn:0, turnInWave:0, waveTotal:0, runCleared:0, unlock:{}, merges:0, chain:0, lone:false, ante:null,
      jokers:[], next:{actions:0,buys:0,coin:0}, later:{coin:0,cards:0}, phase:'turn', over:false };
  if(merge()){
    for(let i=0;i<7;i++)G.deck.push(mk('coin'));
    for(let i=0;i<2;i++)G.deck.push(mk('shack'));
    G.deck.push(mk('anvil'));
  } else {
    for(let i=0;i<7;i++)G.deck.push(mk('copper'));
    for(let i=0;i<3;i++)G.deck.push(mk('shack'));
  }
  resetUI();
  log('The bells of Coinkeep ring out: trouble is coming, wave after wave. Your deck is yours for the whole run — build it with care.','hl');
  if(splice()) log('Splice mode: clear threats before their fuse runs out to graft keywords onto your cards.','hl');
  if(merge()) log('Merge two identical cards with an Anvil to make one a level higher. Clear threats before their fuse runs out.','hl');
  startWave(1);
}

function newThreat(key,w,elite){
  const T=merge()?{...TUNE,...TUNE.merge}:TUNE;
  const d=THREATS[key], cs=T.coinScale(w), ks=T.countScale(w), steps=Math.floor((w-1)/3);
  const em=(elite?1.8:1)*(ante('double',w)?TUNE.ante.double:1);                     // an Ante Up contract doubles it all
  const as=T.actScale(w), bs=T.buyScale(w), r=x=>Math.max(1,Math.round(x));
  const t={key,...d,atk:{...d.atk},prog:0,id:++tid,elite:!!elite,age:0};
  if(merge()) t.label=t.label.replace(/Actions$/,'Energy');
  switch(d.kind){
    case 'prog_coin': case 'once_coin': t.need=r(d.need*cs*em); break;
    case 'prog_action': t.need=r(d.need*as*em); break;
    case 'prog_buy':    t.need=r(d.need*bs*em); break;
    case 'prog_discard': case 'leech': t.need=r(d.need*ks*em); break;
    case 'sacrifice':   t.need=Math.round((d.need+steps)*em); break;
    case 'panic':       t.curses=Math.round((d.curses+steps)*em); break;
    case 'once_hybrid': t.needCoin=r(d.needCoin*cs*em); t.needAct=r(d.needAct*as*em); break;
    case 'upgrade':     t.needT=t.needA=Math.round((1+Math.floor((w-1)/4))*em); t.gotT=t.gotA=0; break;
    case 'scavenge':    t.need=Math.round((d.need+2*steps)*em); break;
    case 'banish':      t.need=Math.round((d.need+steps)*em); break;
  }
  t.full={need:t.need,needCoin:t.needCoin,curses:t.curses,needT:t.needT,needA:t.needA};   // what it first wanted, for Wards
  // Merge mode: Coin poured into a non-coin threat buys its units at this rate, so the whole of it
  // costs what a TUNE.exchange-coin threat would. A coin monolith can pay anything.
  if(merge()){ const units={upgrade:t.needT+t.needA,panic:t.curses,once_hybrid:t.needAct}[d.kind]??t.need;
    t.rate=Math.max(1,num(cs*em*TUNE.exchange/Math.max(1,units))); }
  if(t.atk.n) t.atk.n+=Math.floor((w-1)/5);
  if(elite){ t.n='Elite '+d.n; t.atk.every=Math.max(1,d.atk.every-1); t.fuse=(d.fuse||4)+1;
    if(w>=T.coffinFrom) t.coffin=(t.coffin||0)+1; }
  t.cd=fused()?fuseOf(t):effEvery(t);
  return t;
}
function fuseOf(t){ return Math.max(1,(t.fuse||4)-(hasJ('glass')?1:0)+(hasJ('hourglass')?1:0)-(ante('fuse',G.wave)?TUNE.ante.fuse:0)); }
const ante = (k,w) => !!G.ante&&G.ante.key===k&&G.ante.wave===w;
function effEvery(t){
  if(t.age>=TUNE.enrageAfter) return 1;
  return Math.max(1, t.atk.every-(hasJ('glass')?1:0)+(hasJ('hourglass')?1:0));
}

/* ---------- market ---------- */
function rollTier(){ const m=TUNE.maxTier(G.wave); return Math.max(0,wpick([[m,44],[m-1,30],[m-2,13],[m+1,9],[m+2,4]])); }
// Merge mode: the cards on sale this wave — the costlier to play, the later they arrive.
const stocked = () => MERGE_POOL.filter(k=>!DB[k].noMarket&&G.wave>=TUNE.energyFrom[Math.min(3,DB[k].cost)]);
// Each is stocked up to TUNE.marketLag levels below the best you have merged it to.
function rollLevel(k){ const m=Math.max(0,(G.unlock[k]||0)-TUNE.marketLag); return Math.max(0,wpick([[m,50],[m-1,30],[m-2,20]])); }
function randomTreasure(){
  if(merge()) return mk('coin',rollLevel('coin'));
  const w=G.wave;
  return mk(wpick([['copper',Math.max(6,40-w*6)],['silver',40],['gold',12+w*4]]),rollTier());
}
// Rare cards (the Anvil) turn up a quarter as often as the rest.
const stockPick = ks => wpick(ks.map(k=>[k,DB[k].rare?TUNE.rareWeight:1]));
function marketCard(){
  if(merge()){ const k=stockPick(stocked().filter(k=>k!=='coin')); return mk(k,rollLevel(k)); }
  return mk(pick(splice()?CORE:KINGDOM),rollTier());
}
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
    : DB[c.key].merge ? DB[c.key].eff(c.lv).coin
    : DB[c.key].v*tierMult(c.lv)+(c.grow||0);
  v=Math.max(0,v+(modCount(c,'coin')-modCount(c,'rust'))*tierMult(c.lv));
  if(hasJ('midas')) v+=1;
  if(hasJ('gilded')&&cname(c)==='Copper') v+=2;
  const vin=G.jokers.find(j=>j.key==='vintage'); if(vin) v+=vin.age;
  if(hasJ('golden')) v*=2;
  if(hasJ('glass')) v*=3;
  if(hasJ('minimal')&&!merge()&&deckSize()<=15) v*=2;              // merge mode's Minimalist boosts all Coin, in C()
  return num(v);
}

/* ==========================================================
   WAVES
   ========================================================== */
function startWave(w){
  G.wave=w; G.turnInWave=0; G.wallUsed=false;
  gatherDeck();
  const n=TUNE.threatsInWave(w)+(ante('crowd',w)?TUNE.ante.crowd:0), elite=w%TUNE.eliteEvery===0;
  const pool=THREAT_KEYS.filter(k=>w>=3||!THREATS[k].late);
  G.queue=[]; for(let i=0;i<n;i++) G.queue.push(newThreat(pick(pool),w,elite&&i===n-1));
  G.waveTotal=n;
  const prevTier=w>1?TUNE.maxTier(w-1):0;
  newMarket();
  log(`Wave ${w}`,'wave'); fx('wave',w);
  log(`${plural(n,'threat')} approach${elite?', led by an Elite':''}.`,'hl');
  if(G.ante&&G.ante.wave===w) log(`📜 Your contract holds: ${ANTES[G.ante.key].n}. Clear the wave without losing a heart to collect ${ANTES[G.ante.key].pay}.`,'hl');
  if(!merge()&&TUNE.maxTier(w)>prevTier) log(`The market now stocks ${tierName(TUNE.maxTier(w))} tier cards.`,'good');
  spawnThreat();
  G.next={actions:0,buys:0,coin:0};
  draw(handSize());
  startTurn();
}

async function endWave(){
  const wipe=merge()&&(G.chain||0)>=TUNE.wipe;                 // 3+ threats in the turn that ended the wave
  G.phase='camp';
  log(`Wave ${G.wave} cleared!`,'good');
  if(wipe){ log(`🌊 WIPE! ${G.chain} threats cleared in a single turn.`,'big'); fx('wipe',G.chain); }
  saveBest(G.wave);
  G.jokers.forEach(j=>j.age++);
  gatherDeck(); G.coin=0; G.actions=0; G.buys=0; G.chain=0; render();
  const signed=G.ante&&G.ante.wave===G.wave?G.ante:null, paid=signed&&!signed.broken?signed.key:null;
  if(signed) log(paid?`📜 Contract kept: ${ANTES[paid].n} pays ${ANTES[paid].pay}.`:`📜 Your ${ANTES[signed.key].n} contract was broken: no pay.`,paid?'good':'bad');
  G.ante=null;
  // Rewards are rolled now and saved with the camp, so a reload offers the same ones.
  G.camp={step:'draft',offers:rollJokers(G.wave%TUNE.eliteEvery===0?4:3),wipe,
    rare:paid==='double'?rollJokers(2,'rare'):null, absorb:paid==='fuse'?spoilKeys(3):null, extra:paid==='crowd'?1:0};
  saveNow();
  await sleep(350);
  await campFlow();
}
// Between waves: the charm draft, the wave's rewards (a Wipe, a kept contract), the Inn, then Ante Up.
// Saved before each, so a reload resumes at the same step with the same offers.
async function campFlow(){
  const cp=G.camp;
  if(cp.step==='draft'){ await jokerDraft(cp.offers); cp.step='bonus'; saveNow(); }
  if(cp.step==='bonus'){ await campBonus(); cp.step='inn'; cp.left=innServices(); saveNow(); }
  if(cp.step==='inn'){ await campService(); cp.step='ante'; saveNow(); }
  if(cp.step==='ante') await anteUp();
  G.camp=null; G.phase='turn';
  startWave(G.wave+1);
}

function rollJokers(n,rarity){
  const cand=Object.keys(JOKERS).filter(k=>!hasJ(k)&&JOKERS[k].off!==G.mode&&(!JOKERS[k].only||JOKERS[k].only===G.mode)&&(!rarity||JOKERS[k].r===rarity)), out=[];
  while(out.length<n&&cand.length){
    const k=wpick(cand.map(k=>[k,RARITY[JOKERS[k].r]]));
    out.push(k); pull(cand,k);
  }
  return out;
}

async function jokerDraft(offers,title){
  offers=(offers||[]).filter(k=>!hasJ(k));                       // a charm taken since these were rolled
  if(!offers.length) return;
  const full=G.jokers.length>=TUNE.jokerSlots;
  const k=await chooseJoker(offers,title||`Wave ${G.wave} cleared — choose a charm`,
    full?`Your ${TUNE.jokerSlots} charm slots are full. Taking one means giving another away.`
        :`Charm slots ${G.jokers.length}/${TUNE.jokerSlots}.${!title&&G.wave%TUNE.eliteEvery===0?' The Elite fell: an extra charm is on offer.':''}`);
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

// Merge mode: what the wave earned beyond the draft. A Wipe: an extra charm or Inn service.
// A kept contract: a rare charm, an extra service (counted in G.camp.extra) or a free absorption.
async function campBonus(){
  const cp=G.camp;
  if(cp.wipe){
    const k=await chooseOption('🌊 Wipe!',`You cleared ${TUNE.wipe} or more threats in the turn that ended the wave. Take a reward.`,
      [['charm','🃏 An extra charm'],['service','🍺 An extra Inn service']],'wipe');
    cp.wipe=false;
    if(k==='service'){ cp.extra=(cp.extra||0)+1; log('🌊 The Inn will serve you once more.','good'); }
    else{ cp.wipeOffers=rollJokers(3); saveNow(); }
  }
  if(cp.wipeOffers){ await jokerDraft(cp.wipeOffers,'🌊 Wipe — choose an extra charm'); cp.wipeOffers=null; saveNow(); }
  if(cp.rare){ await jokerDraft(cp.rare,'📜 Double Stakes paid — choose a rare charm'); cp.rare=null; saveNow(); }
  if(cp.absorb){ await freeAbsorb(cp.absorb); cp.absorb=null; saveNow(); }
}

// Ante Up: an optional contract for the next wave. Harder threats now, paid if the wave ends without
// losing a heart. Greed is how bad runs die early, and how good ones snowball.
const ANTES={
  double:{n:'Double Stakes',art:'💰',tx:`every threat wants ×${TUNE.ante.double}`,pay:'a rare charm'},
  crowd: {n:'Crowded Gates',art:'🚪',tx:`${TUNE.ante.crowd} more threats come`,pay:'an extra Inn service'},
  fuse:  {n:'Short Fuses',art:'🧨',tx:`every fuse is ${plural(TUNE.ante.fuse,'turn')} shorter`,pay:'a free card fused into one of yours'},
};
async function anteUp(){
  if(!merge()) return;
  const k=await chooseOption('📜 Ante Up',`An optional contract for wave ${G.wave+1}: clear it without losing a heart and it pays.`,
    [...Object.entries(ANTES).map(([k,a])=>[k,`${a.art} ${a.n}: ${a.tx}. Pays ${a.pay}.`]),['none','No deal']],'ante');
  if(!ANTES[k]) return;
  G.ante={key:k,wave:G.wave+1,broken:false};
  log(`📜 You sign ${ANTES[k].n}: next wave ${ANTES[k].tx}.`,'hl');
}

function deckSummary(){
  const all=allCards(), by=t=>all.filter(c=>c.t===t).length;
  const junk=all.filter(c=>DB[c.key].noLv).length;
  return `${all.length} cards — ${by('treasure')} Treasures, ${by('action')} Actions, ${junk} junk`;
}

// Every service has a Back button: backing out of one returns to the Inn to pick another.
// Merge mode: a deck of TUNE.innSmall cards or fewer gets a second service; Wipes and contracts add more. Rest once a visit.
const innServices = () => 1+(G.camp&&G.camp.extra||0)+(merge()&&deckSize()<=TUNE.innSmall?1:0);
async function campService(){
  const cp=G.camp||{};
  if(cp.left==null) cp.left=1;
  while(cp.left>0){
    const heal=cp.rested?[]:[['heal',`❤ Rest — recover 2 hearts (${G.hearts}/${TUNE.hearts})`]];
    const o=await chooseOption('🍺 The Inn',`${deckSummary()}. ${cp.left>1?`${cp.left} services left`:'Choose one service'} before wave ${G.wave+1}.`,[
      ['purge','🔥 Clear out — trash up to 2 cards'],
      ...(merge()?[['fuse',`🧬 Merge — fuse 2 to ${TUNE.fuseMax} cards into one that does it all`],
                   ['copy',`📜 Copyist — copy a card up to level ${TUNE.copyMax+1}`],...heal]
                :[['temper','⚒ Blacksmith — upgrade a card one tier'],['copy','📜 Copyist — copy a card']]),
      ...(splice()?[['mend','🩹 Mender — remove the scars from a card'],...heal]:[]),
      ['rest','Move on']],'inn');
    if(o==='rest') return;
    if(await innService(o)===false) continue;
    if(o==='heal') cp.rested=true;
    cp.left--; saveNow();
  }
}
// False when the player backed out.
async function innService(o){
  const sorted=()=>G.deck.slice().sort((a,b)=>cname(a).localeCompare(cname(b)));
  const pick=async(pool,o)=>{ const s=await chooseCards(pool,{min:1,max:1,back:'Back',...o}); return s&&s[0]; };
  if(o==='fuse') return fuseService(sorted());
  if(o==='purge'){
    const s=await chooseCards(sorted(),{min:1,max:2,back:'Back',why:'purge',title:'Clear out',sub:'Trash up to 2 cards from your deck for good.'});
    if(!s) return false;
    s.forEach(c=>{pull(G.deck,c);trashCard(c);});
  } else if(o==='temper'){
    const c=await pick(sorted().filter(c=>!DB[c.key].noLv),{why:'temper',title:'Blacksmith',sub:'Upgrade one card a tier.',badge:c=>DB[c.key].n+plus(c.lv+1)});
    if(!c) return false;
    const was=cname(c); c.lv++; log(`${was} is tempered into ${cname(c)}.`,'good');
  } else if(o==='copy'){
    const c=await pick(sorted().filter(c=>!isJunk(c)&&(!merge()||c.lv<=TUNE.copyMax)),{why:'copy',title:'Copyist',sub:'Add a copy of one card to your deck.'});
    if(!c) return false;
    G.deck.push(clone(c)); log(`You copy ${cname(c)}.`,'good');
  } else if(o==='mend'){
    const c=await pick(sorted().filter(c=>c.mods.some(m=>SPLICES[m].scar)),{why:'mend',title:'Mender',sub:'Remove every scar from one card.'});
    if(!c) return false;
    c.mods=c.mods.filter(m=>!SPLICES[m].scar); log(`${cname(c)} is mended.`,'good');
  } else if(o==='heal'){
    G.hearts=Math.min(TUNE.hearts,G.hearts+2); log(`You rest. The town has ${plural(G.hearts,'heart')}.`,'good');
  }
}

/* ==========================================================
   FUSING — merge mode. At the Inn two or more different cards
   become one that does it all; a cleared threat's spoils can be
   absorbed straight into a card. Every part beyond the first
   multiplies the fusion's numbers (TUNE.synergy, compounding),
   and it costs the average ⚡ of its parts, rounded down — so a
   Monolith grows with every clear and never gets dearer to play.
   Each fusion is a card of its own (its key names its parts),
   so two copies of one can still be merged by an Anvil, which
   raises every part a level.
   ========================================================== */
const fusable = c => !isJunk(c) && DB[c.key].merge && !DB[c.key].noMerge && !DB[c.key].stays;
// One entry per card fused in.
const partsOf = c => { const f=DB[c.key].fused; if(!f) return [{key:c.key,lv:c.lv}];
  const o=[]; for(const p of f) for(let i=0;i<(p.n||1);i++) o.push({key:p.key,lv:p.lv+c.lv}); return o; };
const partCount = c => DB[c.key].size||1;
const synBase = () => hasJ('keystone')?TUNE.keystone:TUNE.synergy;
const synergyOf = n => Math.pow(synBase(),Math.max(0,n-1));
// The numbers synergy multiplies. Strikes, multipliers and replays stay as they are.
const SYN=['coin','energy','cards','buys','trash','bank','later','peek','rummage'];
// Effects add up; multipliers and replays take the larger (a better Alchemist, not more of them),
// strikes stack with diminishing returns (two 20% strikes make 36%).
function combineEff(es){
  const o={};
  for(const e of es) for(const [k,v] of Object.entries(e)){
    if(o[k]==null) o[k]=v;
    else if(k==='mult'||k==='replay') o[k]=Math.max(o[k],v);
    else if(k==='strike') o[k]=Math.min(100*TUNE.strikeCap,Math.round(100-(100-o[k])*(100-v)/100));
    else o[k]+=v;
  }
  return o;
}
// The fusion of a set of parts: grouped by card and level, with the average ⚡ cost rounded down.
function fusionKey(parts){
  const m=new Map(); for(const p of parts){ const k=p.key+'.'+p.lv; m.set(k,(m.get(k)||0)+1); }
  const groups=[...m].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,n])=>{ const i=k.lastIndexOf('.'); return {key:k.slice(0,i),lv:+k.slice(i+1),n}; });
  return defFusion(groups,Math.floor(parts.reduce((s,p)=>s+DB[p.key].cost,0)/parts.length));
}
// A saved run's fusions are rebuilt from their keys: fz:<key>.<level>[*count]+…:<⚡ cost>.
function ensureFusion(k){
  const m=/^fz:(.+):(\d+)$/.exec(k); if(!m) return;
  defFusion(m[1].split('+').map(s=>{ const [a,n]=s.split('*'), i=a.lastIndexOf('.'); return {key:a.slice(0,i),lv:+a.slice(i+1),n:+(n||1)}; }),+m[2]);
}
function defFusion(groups,pc){
  const k='fz:'+groups.map(p=>p.key+'.'+p.lv+((p.n||1)>1?'*'+p.n:'')).join('+')+':'+pc;
  if(!DB[k]){
    const ds=groups.map(p=>DB[p.key]), parts=groups.flatMap(p=>Array.from({length:p.n||1},()=>p)), n=parts.length, memo={};
    def(k,{n:'Fusion',merge:true,fused:groups,size:n,noMarket:true,c:parts.reduce((s,p)=>s+DB[p.key].c,0),step:0,cost:pc,pc:()=>pc,fx:mergeFx,
      t:ds.some(d=>d.t==='action')?'action':'treasure',            // no reactions: a monolith can't block every blast
      art:[...new Set(groups.slice().sort((a,b)=>(b.n||1)-(a.n||1)).map(p=>cart({key:p.key,lv:p.lv})))].slice(0,3).join(''),   // its three biggest parts
      eff:l=>{ const s=synergyOf(n), id=l+':'+s;
        if(!memo[id]){ const e=combineEff(parts.map(p=>DB[p.key].eff(p.lv+l)));
          for(const x of SYN) if(e[x]) e[x]=num(e[x]*s);
          if(e.replay) e.self=true;                               // a fusion's Encore replays the fusion itself
          memo[id]=e; }
        return {...memo[id]}; }});
  }
  return k;
}
async function fuseService(deck){
  const pool=deck.filter(fusable);
  const sub=`The new card does what they all did, and every part beyond the first multiplies its numbers by ×${synBase()}. It costs their average ⚡, rounded down.`;
  const s=await chooseCards(pool,{min:2,max:TUNE.fuseMax,back:'Back',why:'fuse',title:`Merge — pick 2 to ${TUNE.fuseMax} cards`,sub,badge:c=>partCount(c)>1?`${partCount(c)} parts`:''});
  if(!s||s.length<2) return false;
  const f=mk(fusionKey(s.flatMap(partsOf)));
  if(!await confirmCard(f,`Merge these ${s.length}?`,`${s.map(cname).join(' + ')} become this card. It costs ${actN(actCost(f))} to play.`,'Merge','Back')) return false;
  s.forEach(c=>pull(G.deck,c)); G.deck.push(f);
  log(`🧬 ${s.map(cname).join(', ')} ${s.length===2?'are both':'are all'} merged into ${cname(f)}.`,'good'); fx('absorb',f);
}
// Fuse a card straight into one of yours, wherever that one is: it becomes (or grows) a fusion.
function absorbInto(target,c){
  const was=cname(target);
  target.key=fusionKey([...partsOf(target),...partsOf(c)]); target.lv=0; target.t=DB[target.key].t;
  log(`🧬 ${cname(c)} is absorbed into ${was}: now ${cname(target)}, ×${multTxt(synergyOf(partCount(target)))} synergy.`,'good');
  fx('absorb',target);
}
// Offer to absorb a card into one of yours (the biggest fusions first). True if it was.
async function absorbPick(c,must){
  if(!fusable(c)) return false;
  const pool=allCards().filter(x=>fusable(x)&&!isFrozen(x)).sort((a,b)=>partCount(b)-partCount(a)||cname(a).localeCompare(cname(b)));
  if(!pool.length) return false;
  const t=(await chooseCards(pool,{min:must?1:0,max:1,why:'absorb',title:`Absorb ${cname(c)} into a card?`,
    sub:`It does what ${cname(c)} does too, and grows a part: ×${synBase()} to all its numbers.${must?'':' Skip to add it to your deck instead.'}`,
    badge:x=>`→ ${partCount(x)+partCount(c)} parts`}))[0];
  if(!t) return false;
  absorbInto(t,c); return true;
}
async function freeAbsorb(keys){
  const offers=keys.map(k=>mk(k));
  const s=await chooseCards(offers,{min:0,max:1,why:'spoils',title:'📜 Short Fuses paid — a free card',sub:'Pick one, then fuse it into one of your cards.'});
  if(s[0]&&!await absorbPick(s[0],true)){ G.discard.push(s[0]); log(`You take ${cname(s[0])}.`,'good'); }
}

/* ==========================================================
   MERGING — two identical cards become one a level higher.
   ========================================================== */
const twins = (a,b) => a.key===b.key && a.lv===b.lv;
const nextName = c => cname({key:c.key,lv:c.lv+1});
// One card per mergeable pair (four Coppers offer two), frozen cards, junk and Anvils left out.
function pairsIn(cards){
  const free=cards.filter(c=>DB[c.key].merge&&!DB[c.key].noMerge&&!isFrozen(c)), out=[], used=new Set();
  for(const c of free){
    if(used.has(c)) continue;
    const t=free.find(x=>x!==c&&!used.has(x)&&twins(x,c));
    if(t){ used.add(c); used.add(t); out.push(c); }
  }
  return out;
}
// The new card keeps no splices; the market starts stocking its level.
function mergePair(a,b,to){
  if(!a||!b) return null;
  for(const c of [a,b]) [G.discard,G.inPlay,G.deck,G.hand].some(p=>pull(p,c));
  const m=mk(a.key,a.lv+1); to.push(m);
  G.merges++;
  const was=G.unlock[a.key]||0;
  if(m.lv>was&&!DB[m.key].noMarket){ G.unlock[a.key]=m.lv;
    if(m.lv-TUNE.marketLag>Math.max(0,was-TUNE.marketLag)) log(`The market now stocks ${cname({key:m.key,lv:m.lv-TUNE.marketLag})}.`,'good'); }
  log(`🔨 ${cname(a)} + ${cname(b)} → ${cname(m)}.`,'good');
  return m;
}
// The Anvil merges from anywhere: copies in the discard pile and in play go first, then the draw pile, then the hand.
async function mergeAnywhere(n,title){
  const piles=[G.discard,G.inPlay,G.deck,G.hand], pool=pairsIn(piles.flat());
  if(!pool.length){ log('Nothing to merge: you have no two identical cards.'); return; }
  const ch=await chooseCards(pool,{min:0,max:n,why:'merge',title,badge:c=>'→ '+nextName(c),
    sub:`Pick ${n===1?'a pair':`up to ${n} pairs`} to merge. Copies in your discard pile and cards you've played are used first, then your draw pile, then your hand. The new card goes to your discard pile.`});
  for(const a of ch){
    const [x,y]=piles.flat().filter(c=>twins(c,a)&&!isFrozen(c));
    mergePair(x,y,G.discard);
  }
}

// Merge mode: a cleared threat leaves spoils — pick one of a few free cards, then add it to your deck
// or absorb it into one of your cards.
function spoilKeys(n){ const left=stocked(), keys=[]; while(left.length&&keys.length<n){ const k=stockPick(left); keys.push(k); pull(left,k); } return keys; }
async function claimSpoils(p){
  const offers=spoilKeys(TUNE.spoils+(p.elite?1:0)).map(k=>mk(k));
  const s=await chooseCards(offers,{min:0,max:1,why:'spoils',title:`${p.from} cleared — take a card`,sub:'Then fuse it into one of your cards, or add it to your discard pile.'});
  const c=s[0]; if(!c) return;
  if(!await absorbPick(c)){ G.discard.push(c); log(`You take ${cname(c)}.`,'good'); }
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
  t.fresh=true; t.age=0; t.cd=fused()?fuseOf(t):effEvery(t);
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
    c.ice=t.id; c.iceT=G.turn;
    log(`🧊 ${t.n} seals your ${cname(c)} in an Ice Coffin until it leaves.`,'bad');
  }
}
function thaw(t){
  const sealed=allCards().filter(c=>c.ice===t.id);
  sealed.forEach(c=>{ c.ice=0; });
  if(sealed.length) log(`The ice cracks: ${sealed.map(cname).join(', ')} ${sealed.length===1?'is':'are'} free.`,'good');
}

// A threat on the board, or (merge mode, paid off by Overkill) one still in the queue.
function completeThreat(t){
  const i=G.slots.indexOf(t), q=G.queue.indexOf(t);
  if(i<0&&q<0) return;
  if(i>=0){ G.slots[i]=null; thaw(t); } else G.queue.splice(q,1);
  G.runCleared++;
  log(`${t.n} ${i>=0?'cleared':'paid off before it even arrives'}.`,'good'); fx('clear',t);
  if(i>=0) gainJunk('rubble',1);                                // one that never arrived leaves no Rubble
  if(hasJ('bounty')){ draw(1); A(1); C(2); log(`Bounty Hunter pays out: +1 Card, +${actN(1)}, +2 Coin.`,'good'); }
  // The chain: every clear in your turn swells all the Coin you make for the rest of it.
  if(merge()&&G.phase==='turn'){ G.chain=(G.chain||0)+1;
    log(`⛓ Chain ×${multTxt(chainMult())}: the Coin you make this turn is worth that much more.`,'hl'); fx('chain',G.chain); }
  if(fused()) G.pending.push({from:t.n, swift:t.age<=1, elite:t.elite});
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
  const s=await chooseCards(elig,{min:0,max:1,why:'splice',title:`Splice ${S.art} ${S.n}`,sub:`${spliceText(k)}. Cards hold ${TUNE.spliceSlots({lv:0})} splices (more when upgraded).`,
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
  while(G.pending.length&&!G.over){ const p=G.pending.shift(); await (merge()?claimSpoils(p):claimSplice(p)); render(); }
  if(!G.over&&G.phase==='turn'&&waveCleared()){ await endWave(); return true; }
  return false;
}
// Hearts a detonation costs: 2 for an Elite; in merge mode, 1 more every TUNE.blastEvery waves, so a deck
// that has hit the wall can't limp on for long.
const blastOf = t => (t.elite?2:1)+(merge()?Math.floor((G.wave-1)/TUNE.blastEvery):0);
// A fuse runs out: the threat attacks once, costs hearts and leaves (and in splice mode scars a card).
async function detonate(t){
  log(`💥 ${t.art} ${t.n} detonates!`,'bad');
  t.detonating=true;
  const safe=await resolveAttack(t);
  const i=G.slots.indexOf(t); if(i>=0){ G.slots[i]=null; thaw(t); }
  if(safe) return;
  if(splice()) scarCard(t);
  if(G.ante&&G.ante.wave===G.wave&&!G.ante.broken){ G.ante.broken=true; log(`📜 ${t.n} breaks your ${ANTES[G.ante.key].n} contract.`,'bad'); }
  const dmg=blastOf(t); G.hearts-=dmg; fx('hurt');
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
  if(merge()) frac=Math.min(frac,TUNE.strikeCap);                   // a strike halves a threat at most: it can't beat scale on its own
  fx('hit',t);
  const hit=x=>Math.max(1,Math.ceil(x*frac));
  switch(t.kind){
    case 'once_coin':   { const d=hit(t.need); t.need=Math.max(0,t.need-d); log(`${t.n}'s fee drops by ${fmt(d)}.`,'good'); break; }
    case 'once_hybrid': { const d=hit(t.needCoin); t.needCoin=Math.max(0,t.needCoin-d);
                          if(t.needCoin<=0) t.needAct=0; log(`${t.n}'s price drops by ${fmt(d)} coin.`,'good'); break; }
    case 'panic':       { const d=hit(t.curses); t.curses=Math.max(0,t.curses-d); log(`${t.n} drops ${junkName('jinx',d)} from its terms.`,'good'); break; }
    case 'upgrade':     { if(t.gotT<t.needT) t.gotT++; else t.gotA++; log(`${t.n} collapses a little.`,'good'); break; }
    default:            { const d=hit(t.need-t.prog); t.prog=Math.min(t.need,t.prog+d); log(`${t.n} takes ${fmt(d)} progress.`,'good'); }
  }
  if(isDone(t)) completeThreat(t);
}

// Merge mode: every Ward in the discard pile wears each threat down by a share of all it wants.
// Fractions build up on the threat, so a small demand still goes down eventually.
function wardTick(){
  const wards=G.discard.filter(c=>DB[c.key].stays&&DB[c.key].eff(c.lv).ward), live=G.slots.filter(Boolean);
  if(!wards.length||!live.length) return;
  const frac=Math.min(merge()?TUNE.wardCap:1,wards.reduce((s,c)=>s+DB[c.key].eff(c.lv).ward,0));
  log(`🧿 ${wards.length>1?`${wards.length} Wards wear`:'Your Ward wears'} the threats down by ${pctTxt(frac)}.`,'good');
  for(const t of live){
    const f=t.full, total=t.kind==='once_coin'?f.need:t.kind==='once_hybrid'?f.needCoin:t.kind==='panic'?f.curses
      :t.kind==='upgrade'?f.needT+f.needA:t.need;
    t.worn=(t.worn||0)+frac*total; const d=Math.floor(t.worn); t.worn-=d;
    if(!d) continue;
    switch(t.kind){
      case 'once_coin':   t.need=Math.max(0,t.need-d); break;
      case 'once_hybrid': t.needCoin=Math.max(0,t.needCoin-d); if(!t.needCoin) t.needAct=0; break;
      case 'panic':       t.curses=Math.max(0,t.curses-d); break;
      case 'upgrade':     for(let i=0;i<d;i++){ if(t.gotT<t.needT) t.gotT++; else if(t.gotA<t.needA) t.gotA++; } break;
      default:            t.prog=Math.min(t.need,t.prog+d);
    }
    fx('hit',t);
    if(isDone(t)) completeThreat(t);
  }
}

// Ask the player to aim at a threat; with only one on the board, it is chosen for them.
async function chooseThreat(title,sub){
  const live=G.slots.filter(Boolean);
  if(live.length<=1) return live[0]||null;
  const k=await chooseOption(title,sub,live.map(t=>[t.id,`${t.art} ${t.n} — ${threatProgress(t).left}`]),'aim');
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

/* ==========================================================
   OVERKILL — merge mode's big play. Every coin you hold pours
   into the board, the most urgent threat first, then into the
   threats still queued: Coin beyond what one wants spills into
   the next, and each clear swells what is left by the chain.
   Non-coin threats take Coin at their exchange rate (t.rate a
   unit), so they don't wall a coin deck; one-shot fees are all
   or nothing, and the Coin flows past what it can't pay in full.
   ========================================================== */
const ONCE=['once_coin','once_hybrid','banish'];
// What it would take, in Coin, to finish this threat now.
function coinPrice(t){
  switch(t.kind){
    case 'prog_coin':   return coinFor(t.need-t.prog);
    case 'once_coin':   return coinFor(t.need);
    case 'once_hybrid': return coinFor(t.needCoin)+Math.max(0,unitsFor(t.needAct)-G.actions)*t.rate;   // spare ⚡ goes in first
    case 'panic':       return t.curses*t.rate;
    case 'upgrade':     return ((t.needT-t.gotT)+(t.needA-t.gotA))*t.rate;
  }
  return Math.max(0,t.need-t.prog)*t.rate;
}
// Pay n of the units it wants (Infinity: all of them).
function payUnits(t,n){
  switch(t.kind){
    case 'once_coin':   t.need=0; break;
    case 'once_hybrid': t.needCoin=0; t.needAct=0; break;
    case 'banish':      t.prog=t.need; break;
    case 'panic':       t.curses=Math.max(0,t.curses-n); break;
    case 'upgrade':     for(let i=0;i<n&&!isDone(t);i++){ if(t.gotT<t.needT) t.gotT++; else t.gotA++; } break;
    default:            t.prog=Math.min(t.need,t.prog+n);
  }
}
const canOverkill = () => merge()&&!G.over&&G.phase==='turn'&&G.coin>0&&(G.queue.length>0||G.slots.some(Boolean));
async function overkill(){
  if(busy||!canOverkill()) return;
  busy=true;
  try{
    log(`💥 Overkill! ${fmt(G.coin)} coin pours into the threats.`,'big'); fx('overkill',G.coin);
    for(const t of [...G.slots.filter(Boolean).sort((a,b)=>a.cd-b.cd),...G.queue]){
      if(G.coin<=0||G.over) break;
      if(!G.slots.includes(t)&&!G.queue.includes(t)) continue;
      const price=coinPrice(t), queued=!G.slots.includes(t);
      if(G.coin>=price){ G.coin=num(G.coin-price); if(t.kind==='once_hybrid') G.actions=Math.max(0,G.actions-unitsFor(t.needAct));
        payUnits(t,Infinity); fx('hit',t); fx('spill',t);
        log(`${t.art} ${t.n} takes ${fmt(price)} coin${queued?' before it even arrives':''}.`,'hl');
        completeThreat(t); continue; }
      if(ONCE.includes(t.kind)) continue;
      const per=t.kind==='prog_coin'?1/coinMult():t.rate, n=Math.floor(G.coin/per);
      if(n<=0) continue;
      G.coin=Math.max(0,num(G.coin-Math.ceil(n*per))); payUnits(t,n); fx('hit',t);
      log(`${t.art} ${t.n} soaks up the rest${queued?' before it arrives':''}: ${fmt(coinPrice(t))} coin still to go.`,'hl');
      break;
    }
    await settle();
  } finally { busy=false; render(); }
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
        log(`You pour ${fmt(amt)} coin into ${t.n} (${fmt(t.prog)}/${fmt(t.need)}).`,'hl'); break; }
      case 'once_coin':{
        const amt=coinFor(t.need); G.coin-=amt; t.need=0;
        log(`You pay ${fmt(amt)} coin to ${t.n} in one stroke.`,'hl'); break; }
      case 'prog_action':{
        const amt=Math.min(G.actions,unitsFor(rem));
        G.actions-=amt; t.prog=Math.min(t.need,t.prog+amt*unitMult());
        log(`You burn ${actN(amt)} on ${t.n} (${fmt(t.prog)}/${fmt(t.need)}).`,'hl'); break; }
      case 'prog_buy':{
        const amt=Math.min(G.buys,unitsFor(rem));
        G.buys-=amt; t.prog=Math.min(t.need,t.prog+amt*unitMult());
        log(`You trade away ${plural(amt,'Buy')} to ${t.n} (${fmt(t.prog)}/${fmt(t.need)}).`,'hl'); break; }
      case 'prog_discard':{
        const s=await chooseCards(G.hand,{min:0,max:rem,why:t.kind,title:t.n,sub:`Discard cards into it. ${rem} still wanted.`});
        s.forEach(c=>{pull(G.hand,c);G.discard.push(c);});
        t.prog+=s.length;
        if(s.length) log(`You feed ${plural(s.length,'card')} to ${t.n} (${t.prog}/${t.need}).`,'hl'); break; }
      case 'sacrifice':{
        const s=await chooseCards(G.hand.filter(c=>c.key!=='rubble'),{min:0,max:rem,why:t.kind,title:t.n,
          sub:`Trash cards into the idol. ${rem} still wanted. Rubble is refused.`});
        s.forEach(c=>{pull(G.hand,c);trashCard(c);});
        t.prog+=s.length;
        if(s.length) log(`You sacrifice ${plural(s.length,'card')} to ${t.n} (${t.prog}/${t.need}).`,'hl'); break; }
      case 'scavenge':{
        const s=await chooseCards(G.hand,{min:0,max:99,why:t.kind,title:t.n,
          sub:`Trash cards into the nest. ${rem} still wanted — junk counts double.`,badge:c=>isJunk(c)?'×2':''});
        const got=s.reduce((n,c)=>n+(isJunk(c)?2:1),0);
        s.forEach(c=>{pull(G.hand,c);trashCard(c,true);});
        t.prog=Math.min(t.need,t.prog+got);
        if(s.length) log(`The rats drag ${plural(s.length,'card')} into the nest (${t.prog}/${t.need}).`,'hl'); break; }
      case 'banish':{
        t.prog=t.need; log(`With a flurry of activity, you banish the ${t.n}.`,'hl'); break; }
      case 'panic':{
        const ok=await chooseOption(t.n,`Shake on it? It clears at once and ${junkName('jinx',t.curses)} go into your discard pile.`,
          [['y','Shake on it'],['n','Step back']],'panic');
        if(ok!=='y') break;
        log(`You shake hands with the ${t.n}.`,'bad');
        gainJunk('jinx',t.curses); t.curses=0; break; }
      case 'once_hybrid':{
        const c=coinFor(t.needCoin), a=unitsFor(t.needAct);
        G.coin-=c; G.actions-=a; t.needCoin=0; t.needAct=0;
        log(`You hand ${t.n} ${fmt(c)} coin and ${actN(a)} at once.`,'hl'); break; }
      case 'upgrade':{
        const elig=G.hand.filter(c=>(t.gotT<t.needT&&c.t==='treasure')||(t.gotA<t.needA&&c.t==='action'));
        const s=await chooseCards(elig,{min:0,max:(t.needT-t.gotT)+(t.needA-t.gotA),why:t.kind,title:t.n,
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
      log(`${t.n} now wants ${fmt(t.kind==='once_hybrid'?t.needCoin:t.need)}.`,'bad'); break;
    case 'discard':
      for(let i=0;i<n;i++){ const pool=G.hand.filter(c=>!a.filter||c.t===a.filter); if(!pool.length)break;
        const c=pick(pool); pull(G.hand,c); G.discard.push(c);
        log(`${cname(c)} is knocked from your hand.`,'bad'); } break;
    case 'trash':                                                    // a Monolith is too heavy to carry off
      for(let i=0;i<n;i++){ const pool=G.hand.filter(c=>(!a.filter||c.t===a.filter)&&partCount(c)<4); if(!pool.length)break;
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
  const dog  =best(c=>!!DB[c.key].react);                       // Guard Dogs, and fusions with one in them
  const rip  =best(c=>c.key==='riposte');
  const snare=best(c=>c.key==='snare'&&(!t.elite||c.lv>=1));
  const grd  =best(c=>hasMod(c,'guard'));
  const opts=[];
  if(grd)   opts.push(['guard',`🛡 Discard ${cname(grd)} — block`]);
  if(moat)  opts.push(['moat', `🐕 Reveal ${cname(moat)} — block`]);
  if(dog)   opts.push(['dog',  `🐕 Discard ${cname(dog)} — block`]);
  if(rip)   opts.push(['rip',  `🤺 Discard ${cname(rip)} — block & strike ${ripPct(rip.lv)}%`]);
  if(snare) opts.push(['snare',`🪤 Trash ${cname(snare)} — destroy it`]);
  if(opts.length){
    opts.push(['take','Take the hit']);
    const ch=await chooseOption(`${t.art} ${t.n} ${t.detonating?'detonates':'attacks'}!`,
      `${a.name}: ${txt}.${t.detonating?` It will also ${splice()?'scar a card and ':''}cost the town a heart.`:''}`,opts,'react');
    if(ch==='guard'){ pull(G.hand,grd); G.discard.push(grd); log(`${cname(grd)} takes the blow.`,'good'); blocked(t); return true; }
    if(ch==='moat'){ log(`${cname(moat)} barks the attack away.`,'good'); blocked(t); return true; }
    if(ch==='dog'){ pull(G.hand,dog); G.discard.push(dog); log(`${cname(dog)} barks the attack away.`,'good'); blocked(t); return true; }
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
  if(G.lone) return false;                                           // Lone Wolf: one card a turn
  if(c.t==='treasure'||c.t==='action') return G.actions>=actCost(c);
  return false;                      // Shack, Jinx
}

// Merge mode: how many times a card you play resolves. Echo doubles your first Action, Hermit every card;
// Lone Wolf adds one for every TUNE.wolfPer cards trashed this run to your first card — and locks the rest.
function resolveTimes(c){
  if(!merge()) return 1;
  let k=1;
  if(c.t==='action'&&hasJ('echo')&&!G.echoUsed) k*=2;
  if(hermitOn()) k*=2;
  if(hasJ('wolf')){ k*=1+wolfExtra(); G.lone=true; }
  return k;
}
function playTreasure(c){
  pull(G.hand,c); G.inPlay.push(c); G.actions-=actCost(c);
  let v=tval(c);
  if(hasJ('mirror')&&G.treasuresPlayed===0){ v*=2; log('Mirror doubles it.','hl'); }
  if(hasMod(c,'twin')) v*=2;
  const k=resolveTimes(c); if(k>1){ v=num(v*k); log(`${cname(c)} resolves ${k} times.`,'hl'); }
  G.treasuresPlayed++;
  if(c.key==='nestegg') c.grow=(c.grow||0)+(hasJ('goose')?2:1);
  const was=G.coin; C(v); log(`${cname(c)} adds ${fmt(G.coin-was)} to your purse.`); fx('big',G.coin-was);
  G.acting=(G.acting||0)+1;
  try{ for(let i=hasMod(c,'twin')?2:1;i>0;i--) spliceFx(c); } finally{ G.acting--; }
  afterPlay(c);
}

// k: times it resolves (merge cards only; each one counts as an Action played).
async function runAction(c,k=1){
  const before=G.actionsPlayed; G.actionsPlayed+=k;
  const mom=k*before+k*(k-1)/2;                                      // +1 for every Action already played, per resolution
  if(hasJ('momentum')&&mom>0){ C(mom); log(`Momentum: +${fmt(mom)} Coin.`,'hl'); }
  await acting(async()=>{ spliceFx(c); await DB[c.key].fx(c,c.lv,k); });
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
      if(DB[c.key].merge){ const was=G.coin, k=resolveTimes(c); G.echoUsed=true; await runAction(c,k); fx('big',G.coin-was); }
      else{
        const times=((hasJ('echo')&&!G.echoUsed)?2:1)*(hasMod(c,'twin')?2:1); G.echoUsed=true;
        for(let i=0;i<times;i++){ if(i) log('It resolves again.','hl'); await runAction(c); render(); }
      }
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
  try{ for(const c of tr) if(canPlay(c)) playTreasure(c); await settle(); } finally { busy=false; render(); }
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
  log(`You buy ${cname(c)} for ${fmt(price)}. It waits at the bottom of your deck.`,'hl');
  refillSlot(i,wasT);
  render();
}

/* ==========================================================
   TURN FLOW
   ========================================================== */
function startTurn(){
  G.turn++; G.turnInWave++;
  const n=G.next;
  G.actions=Math.max(0,TUNE.energy+n.actions+(hasJ('wind')?1:0)+monkEnergy());
  G.buys=Math.max(0,1+n.buys+(hasJ('seal')?1:0));
  G.chain=0; G.lone=false;
  // merge mode's Warm Mittens: an Ice Coffin holds for the one turn after it closes
  if(merge()&&hasJ('mittens')){ const t=allCards().filter(c=>c.ice&&c.iceT<G.turn-1); t.forEach(c=>{ c.ice=0; });
    if(t.length) log(`🧤 Warm Mittens thaw ${t.map(cname).join(', ')} out of the ice.`,'good'); }
  G.coin=Math.max(0,num(n.coin+G.later.coin));
  if(G.later.coin) log(`${merge()?'Your savings pay':'The orchard pays'} out ${fmt(G.later.coin)} coin.`,'good');
  G.later={coin:0,cards:0};
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
    if(carry) log(`Piggy Bank keeps ${fmt(carry)} coin for next turn.`);
    for(const c of G.inPlay.splice(0)) G.discard.push(c);
    const kept=G.hand.filter(c=>hasMod(c,'retain')||DB[c.key].stays), wards=kept.filter(c=>DB[c.key].stays).length;
    for(const c of G.hand.splice(0)){ c.frozen=false; if(!kept.includes(c)) G.discard.push(c); }
    G.hand.push(...kept);
    G.coin=0; G.actions=0; G.buys=0;
    G.next={actions:0,buys:0,coin:carry};

    wardTick();
    draw(Math.max(0,handSize()+G.later.cards-wards));        // Almanac adds, a Ward kept in hand takes one
    render(); await sleep(180);

    // threats strike at the hand you just drew — reactions in it can answer
    G.phase='attack'; if(!fused()) G.wallUsed=false;            // with fuses, Iron Wall holds once a wave
    for(const t of G.slots.slice()){
      if(!t||!G.slots.includes(t)) continue;
      t.age++; t.cd--;
      if(t.cd<=0&&fused()){
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
  G.over=true; deleteSave();                                  // no going back to before the fall
  const cleared=G.wave-1; saveBest(cleared); fx('lose');
  showGameOver(`${title}. ${text} You survived ${plural(cleared,'wave')} and cleared ${plural(G.runCleared,'threat')} with a deck of ${deckSize()} cards. Best run: ${plural(loadBest(),'wave')} cleared.`);
}

/* ==========================================================
   THE WHOLE LOG as plain text — Save log in the game, and the
   simulator's --log. entries are [message, class] pairs.
   ========================================================== */
function logText(entries,when){
  const deck={}; allCards().forEach(c=>{ const n=cname(c)+(c.mods.length?` [${c.mods.map(m=>SPLICES[m].n).join(', ')}]`:''); deck[n]=(deck[n]||0)+1; });
  const head=[
    `Coinkeep — ${{splice:'Splice',merge:'Merge',classic:'Classic'}[G.mode]} mode${when?' — '+when:''}`,
    `${G.over?'Run over':'In progress'}: wave ${G.wave}, turn ${G.turnInWave} (${G.turn} in all), ${plural(G.runCleared,'threat')} cleared`+(fused()?`, ${plural(Math.max(0,G.hearts),'heart')} left`:''),
    `Charms: ${G.jokers.map(j=>JOKERS[j.key].n).join(', ')||'none'}`,
    `Deck (${deckSize()}): ${Object.entries(deck).sort().map(([n,k])=>k>1?`${k}× ${n}`:n).join(', ')}`,
  ];
  const body=entries.map(([m,cls])=> cls==='wave'?`\n=== ${m} ===`: cls==='turn'?`\n${m}`: `  ${m}`);
  return head.join('\n')+'\n'+body.join('\n')+'\n';
}
