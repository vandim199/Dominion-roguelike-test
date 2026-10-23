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
// Merge mode: a Cracked card plays two levels up (TUNE.crackLv) and is named for the level it plays at.
const effLv = c => c.lv+(c.crack?TUNE.crackLv:0);
// What a merge card does right now: its level's effect plus the Coin it has grown (c.grow).
function cardEff(c){ const e={...DB[c.key].eff(effLv(c))}; if(c.grow) e.coin=fin((e.coin||0)+c.grow); return e; }
// Merge cards count levels in Roman numerals (Spark, Spark II…); Coins have names (Copper, Silver…).
const cname = c => { const d=DB[c.key], lv=effLv(c), k=c.crack?'Cracked ':'';
  if(!d.merge) return d.n+plus(c.lv);
  if(d.fused) return partsOf(c).map(p=>cname(p)).join('-');
  if(d.names) return k+(lv<d.names.length ? d.names[lv] : `${d.names.at(-1)} ${roman(lv-d.names.length+2)}`);
  return k+(lv ? `${d.n} ${roman(lv+1)}` : d.n); };
const cart = c => { const d=DB[c.key]; return d.arts ? d.arts[Math.min(effLv(c),d.arts.length-1)] : d.art; };
const sentence = (t,u) => t+(t.endsWith('.')?' ':'. ')+u;
const ctext = c => { const d=DB[c.key];
  if(d.merge){ let t=effText(cardEff(c)); if(d.react) t=sentence(t,d.react);
    return c.crack ? sentence(t,`💔 Cracked: 1 in ${Math.round(1/TUNE.crackOdds)} to shatter each time it's played.`) : t; }
  if(merge()&&d.mtx) return d.mtx;
  if(typeof d.tx==='function') return d.tx(c.lv,c);
  if(d.tx) return d.tx;
  return `+${d.v*tierMult(c.lv)} Coin`; };
// Prices climb on the same curve as power: base + base×(tier bonus) + a small step per tier.
// A merge card's price climbs with its level: base × level, plus 1 a level for the merging you skipped.
const baseCost = c => { const d=DB[c.key];
  if(d.merge){ const l=c.lv+(c.crack?1:0); return d.c*(1+l)+l; }     // a Cracked card costs one level more, not two
  return d.c + (d.c||2)*(tierMult(c.lv)-1) + d.step*c.lv; };
const costOf   = c => Math.max(0, baseCost(c)-(G?G.discount:0));
const allCards = () => [...G.deck,...G.hand,...G.discard,...G.inPlay];
const deckSize = () => allCards().length;
const handSize = () => TUNE.handSize+(hasJ('greedy')?1:0);
const waveCleared = () => !G.queue.length && G.slots.every(s=>!s);
const splice = () => !!G && G.mode==='splice';
const merge  = () => !!G && G.mode==='merge';
// Splice and merge mode share the fuse: a threat detonates once, costs hearts and leaves.
const fused  = () => splice()||merge();
const maxHearts = () => merge()?TUNE.merge.hearts:TUNE.hearts;
const healBy    = () => merge()?TUNE.merge.heal:TUNE.heal;
const spawnEvery = () => (merge()?TUNE.merge:TUNE).spawnEvery(G.wave);
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

// The published site serves every wild/* branch under v/<branch>/ (see .github/workflows/pages.yml). They share one
// browser storage, so each keeps its own save and best run under its own slot. Main (and the simulator) has none.
const SLOT = (typeof location!=='undefined'&&(/\/v\/([\w-]+)\//.exec(location.pathname)||[])[1]) || '';
const slotKey = k => SLOT ? `${k}.${SLOT}` : k;
function loadBest(){ try{ return +localStorage.getItem(slotKey('dcrisis.best'))||0; }catch(e){ return 0; } }
function saveBest(n){ try{ if(n>loadBest()) localStorage.setItem(slotKey('dcrisis.best'),String(n)); }catch(e){} }

function jokerStatus(j){
  switch(j.key){
    case 'minimal': return deckSize()<=15 ? 'active' : `${deckSize()}/15`;
    case 'vintage': return `+${j.age}`;
    case 'hoarder': return `+${Math.floor(deckSize()/4)}`;
    case 'trophy':  return `+${Math.floor(G.runCleared/2)}`;
    case 'ossuary': return `+${Math.floor(G.trash.length/2)}`;
    case 'jar': case 'hoard': return `cap ${fmt(vaultCap())}`;
  }
  return '';
}

function newRun(mode){
  // G.actions is the play resource: Actions in classic and splice mode, ⚡ Energy in merge mode.
  mode=mode||(G&&G.mode)||'merge';
  G={ rng:(nativeRandom()*4294967296)>>>0, mode, hearts:mode==='merge'?TUNE.merge.hearts:TUNE.hearts, pending:[], deck:[],hand:[],discard:[],inPlay:[],trash:[],
      coin:0,actions:0,buys:0,actionsPlayed:0,treasuresPlayed:0,discount:0,echoUsed:false,wallUsed:false,vault:0,fromVault:0,
      market:[], slots:new Array(TUNE.slots).fill(null), queue:[],
      wave:0, turn:0, turnInWave:0, waveTotal:0, runCleared:0, unlock:{}, merges:0,
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
  const d=THREATS[key], cs=T.coinScale(w), ks=T.countScale(w), em=elite?1.8:1, steps=Math.floor((w-1)/3);
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
  if(merge()&&!COIN_KINDS.includes(d.kind)) t.bribe=r(T.bribe*cs*em);
  if(t.atk.n) t.atk.n+=Math.floor((w-1)/5);
  if(elite){ t.n='Elite '+d.n; t.atk.every=Math.max(1,d.atk.every-1); t.fuse=(d.fuse||4)+1;
    if(w>=TUNE.coffinFrom) t.coffin=(t.coffin||0)+1; }
  t.cd=fused()?fuseOf(t):effEvery(t);
  return t;
}
function fuseOf(t){ return Math.max(1,(t.fuse||4)-(hasJ('glass')?1:0)+(hasJ('hourglass')?1:0)); }
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
// Merge mode: some cards on offer are Cracked — two levels stronger, but they may shatter when played.
const crackable = c => DB[c.key].merge&&!DB[c.key].noMerge&&!DB[c.key].stays&&!DB[c.key].fused;
function mayCrack(c,odds){ if(crackable(c)&&Math.random()<odds) c.crack=true; return c; }
function randomTreasure(){
  if(merge()) return mayCrack(mk('coin',rollLevel('coin')),TUNE.crackMarket);
  const w=G.wave;
  return mk(wpick([['copper',Math.max(6,40-w*6)],['silver',40],['gold',12+w*4]]),rollTier());
}
// Rare cards (the Anvil) turn up a quarter as often as the rest.
const stockPick = ks => wpick(ks.map(k=>[k,DB[k].rare?TUNE.rareWeight:1]));
function marketCard(){
  if(merge()){ const k=stockPick(stocked().filter(k=>k!=='coin')); return mayCrack(mk(k,rollLevel(k)),TUNE.crackMarket); }
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
    : DB[c.key].merge ? cardEff(c).coin||0
    : DB[c.key].v*tierMult(c.lv)+(c.grow||0);
  v=Math.max(0,v+(modCount(c,'coin')-modCount(c,'rust'))*tierMult(c.lv));
  if(hasJ('midas')) v+=1;
  if(hasJ('gilded')&&cname(c)==='Copper') v+=2;
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
  G.wave=w; G.turnInWave=0; G.wallUsed=false;
  gatherDeck();
  const n=(merge()?TUNE.merge:TUNE).threatsInWave(w), elite=w%TUNE.eliteEvery===0;
  const pool=THREAT_KEYS.filter(k=>w>=3||!THREATS[k].late);
  G.queue=[]; for(let i=0;i<n;i++) G.queue.push(newThreat(pick(pool),w,elite&&i===n-1));
  G.waveTotal=n;
  const prevTier=w>1?TUNE.maxTier(w-1):0;
  if(merge()) sprout();
  newMarket();
  log(`Wave ${w}`,'wave'); fx('wave',w);
  log(`${plural(n,'threat')} approach${elite?', led by an Elite':''}.`,'hl');
  if(!merge()&&TUNE.maxTier(w)>prevTier) log(`The market now stocks ${tierName(TUNE.maxTier(w))} tier cards.`,'good');
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
  if(merge()) G.vault=fin(G.vault+G.coin);                   // what's left over is saved
  gatherDeck(); G.coin=0; G.actions=0; G.buys=0; render();
  G.camp={step:'draft',offers:rollJokers(G.wave%TUNE.eliteEvery===0?4:3)};
  saveNow();
  await sleep(350);
  await campFlow();
}
// Between waves: the charm draft, then the Inn. Saved before each, so a reload resumes at the same step
// with the same offers.
async function campFlow(){
  if(G.camp.step==='draft'){ await jokerDraft(G.camp.offers); G.camp.step='inn'; saveNow(); }
  await campService();
  G.camp=null; G.phase='turn';
  startWave(G.wave+1);
}

function rollJokers(n){
  const cand=Object.keys(JOKERS).filter(k=>!hasJ(k)&&JOKERS[k].off!==G.mode&&(!JOKERS[k].only||JOKERS[k].only===G.mode)), out=[];
  while(out.length<n&&cand.length){
    const k=wpick(cand.map(k=>[k,RARITY[JOKERS[k].r]]));
    out.push(k); pull(cand,k);
  }
  return out;
}

async function jokerDraft(offers){
  if(!offers.length) return;
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

// Every service has a Back button: backing out of one returns to the Inn to pick another.
async function campService(){
  for(;;){
    const heal=['heal',`❤ Rest — recover ${plural(healBy(),'heart')} (${G.hearts}/${maxHearts()})`];
    const o=await chooseOption('🍺 The Inn',`${deckSummary()}. Choose one service before wave ${G.wave+1}.`,[
      ['purge','🔥 Clear out — trash up to 2 cards'],
      ...(merge()?[['fuse','🧬 Merge — combine two different cards into one that does both'],
                   ['copy',`📜 Copyist — copy a card up to level ${TUNE.copyMax+1}`],heal]
                :[['temper','⚒ Blacksmith — upgrade a card one tier'],['copy','📜 Copyist — copy a card']]),
      ...(splice()?[['mend','🩹 Mender — remove the scars from a card'],heal]:[]),
      ['rest','Move on']]);
    if(await innService(o)!==false) return;
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
    const c=await pick(sorted().filter(c=>!isJunk(c)&&(!merge()||c.lv<=TUNE.copyMax&&!c.crack)),{why:'copy',title:'Copyist',sub:`Add a copy of one card to your deck.${merge()?' The copy has grown nothing yet.':''}`});
    if(!c) return false;
    G.deck.push(merge()?mk(c.key,c.lv):clone(c)); log(`You copy ${cname(c)}.`,'good');
  } else if(o==='mend'){
    const c=await pick(sorted().filter(c=>c.mods.some(m=>SPLICES[m].scar)),{why:'mend',title:'Mender',sub:'Remove every scar from one card.'});
    if(!c) return false;
    c.mods=c.mods.filter(m=>!SPLICES[m].scar); log(`${cname(c)} is mended.`,'good');
  } else if(o==='heal'){
    G.hearts=Math.min(maxHearts(),G.hearts+healBy()); log(`You rest. The town has ${plural(G.hearts,'heart')}.`,'good');
  }
}

/* ==========================================================
   FUSING — merge mode, at the Inn: two different cards become
   one that does both and costs their average ⚡, rounded up.
   Each fusion is a card of its own (its key names its parts),
   so two copies of one can still be merged by an Anvil, which
   raises every part a level.
   ========================================================== */
const fusable = c => !isJunk(c) && DB[c.key].merge && !DB[c.key].noMerge && !DB[c.key].stays && !c.crack;
const partsOf = c => DB[c.key].fused ? DB[c.key].fused.map(p=>({key:p.key,lv:p.lv+c.lv})) : [{key:c.key,lv:c.lv}];
// Effects add up; multipliers multiply, replays take the larger, strikes cap at 100%.
function combineEff(es){
  const o={};
  for(const e of es) for(const [k,v] of Object.entries(e)){
    if(o[k]==null) o[k]=v;
    else if(k==='mult')   o[k]=Math.round(o[k]*v*100)/100;
    else if(k==='replay') o[k]=Math.max(o[k],v);
    else if(k==='strike') o[k]=Math.min(100,o[k]+v);
    else o[k]+=v;
  }
  return o;
}
function fusionOf(a,b){
  const parts=[...partsOf(a),...partsOf(b)].sort((x,y)=>(x.key+x.lv).localeCompare(y.key+y.lv));
  const f=mk(defFusion(parts,Math.ceil((actCost(a)+actCost(b))/2))), g=(a.grow||0)+(b.grow||0);
  if(g) f.grow=g;                                             // it keeps what both had grown
  return f;
}
// A saved run's fusions are rebuilt from their keys: fz:<key>.<level>+…:<⚡ cost>.
function ensureFusion(k){
  const m=/^fz:(.+):(\d+)$/.exec(k); if(!m) return;
  defFusion(m[1].split('+').map(s=>{ const i=s.lastIndexOf('.'); return {key:s.slice(0,i),lv:+s.slice(i+1)}; }),+m[2]);
}
function defFusion(parts,pc){
  const k='fz:'+parts.map(p=>p.key+'.'+p.lv).join('+')+':'+pc;
  if(!DB[k]){
    const ds=parts.map(p=>DB[p.key]);
    def(k,{n:'Fusion',merge:true,fused:parts,noMarket:true,c:ds.reduce((s,d)=>s+d.c,0),step:0,cost:pc,pc:()=>pc,fx:mergeFx,
      t:ds.some(d=>d.t==='action')?'action':'treasure', r:ds.some(d=>d.r), react:(ds.find(d=>d.react)||{}).react,
      art:parts.map(p=>cart({key:p.key,lv:p.lv})).join(''),
      eff:l=>combineEff(parts.map(p=>DB[p.key].eff(p.lv+l)))});
  }
  return k;
}
async function fuseService(deck){
  const pool=deck.filter(fusable);
  const sub='The new card does what both did and costs their average ⚡, rounded up.';
  const a=(await chooseCards(pool,{min:1,max:1,back:'Back',why:'fuse',title:'Merge — pick the first card',sub}) || [])[0];
  if(!a) return false;
  const b=(await chooseCards(pool.filter(c=>c!==a),{min:1,max:1,back:'Back',why:'fuse2',title:`Merge ${cname(a)} with…`,sub,
    badge:c=>`⚡ ${Math.ceil((actCost(a)+actCost(c))/2)}`}) || [])[0];
  if(!b) return false;
  const f=fusionOf(a,b);
  if(!await confirmCard(f,'Merge these two?',`${cname(a)} + ${cname(b)} become this card. It costs ${actN(actCost(f))} to play.`,'Merge','Back')) return false;
  pull(G.deck,a); pull(G.deck,b); G.deck.push(f);
  log(`🧬 ${cname(a)} and ${cname(b)} are merged into ${cname(f)}.`,'good');
}

/* ==========================================================
   MERGING — two identical cards become one a level higher.
   ========================================================== */
// Growth doesn't stop two cards merging (the new one keeps the sum); Cracked cards only merge with Cracked twins.
const twins = (a,b) => a.key===b.key && a.lv===b.lv && !a.crack===!b.crack;
const nextName = c => cname({key:c.key,lv:c.lv+1+(c.crack?TUNE.crackLv:0)});
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
// The new card keeps no splices but all the growth of both; the market starts stocking its level.
// Two Cracked twins make a stable card at the level they played at, plus one. Mitosis may leave one behind.
function mergePair(a,b,to){
  if(!a||!b) return null;
  const keep=hasJ('mitosis')&&Math.random()<TUNE.mitosis?b:null;
  for(const c of [a,b]) if(c!==keep){ [G.discard,G.inPlay,G.deck,G.hand].some(p=>pull(p,c)); c.gone=true; }
  const m=mk(a.key,a.lv+1+(a.crack&&b.crack?TUNE.crackLv:0)), g=(a.grow||0)+(b.grow||0);
  if(g) m.grow=fin(g);
  to.push(m);
  G.merges++;
  const was=G.unlock[a.key]||0;
  if(m.lv>was&&!DB[m.key].noMarket){ G.unlock[a.key]=m.lv;
    if(m.lv-TUNE.marketLag>Math.max(0,was-TUNE.marketLag)) log(`The market now stocks ${cname({key:m.key,lv:m.lv-TUNE.marketLag})}.`,'good'); }
  log(`🔨 ${cname(a)} + ${cname(b)} → ${cname(m)}${a.crack&&b.crack?', no longer cracked':''}.`,'good');
  if(keep) log(`🧫 Mitosis: ${cname(keep)} is left behind.`,'good');
  if(m.lv>=3||keep||g>=1000) fx('merge',m);
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

// Merge mode: a cleared threat leaves spoils — pick one of a few free cards.
async function claimSpoils(p){
  const left=stocked(), keys=[];
  while(left.length&&keys.length<TUNE.spoils+(p.elite?1:0)){ const k=stockPick(left); keys.push(k); pull(left,k); }
  const offers=keys.map(k=>mayCrack(mk(k),TUNE.crackSpoils));
  const s=await chooseCards(offers,{min:0,max:1,why:'spoils',title:`${p.from} cleared — take a card`,sub:'It goes to your discard pile.'});
  if(s[0]){ G.discard.push(s[0]); log(`You take ${cname(s[0])}.`,'good'); }
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
  if(hasJ('bounty')){ draw(1); A(1); C(2); log(`Bounty Hunter pays out: +1 Card, +${actN(1)}, +2 Coin.`,'good'); }
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
// A fuse runs out: the threat attacks once, costs hearts and leaves (and in splice mode scars a card).
async function detonate(t){
  log(`💥 ${t.art} ${t.n} detonates!`,'bad');
  t.detonating=true;
  const safe=await resolveAttack(t);
  const i=G.slots.indexOf(t); if(i>=0){ G.slots[i]=null; thaw(t); }
  if(safe) return;
  if(splice()) scarCard(t);
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

/* ==========================================================
   GROWTH — merge mode. A card keeps what it grows (c.grow,
   extra Coin) for good, through merges and fusions.
   ========================================================== */
// Each time a card resolves: Nest Eggs grow, Snowballs compound, Hiker adds 1 to anything; then a Cracked card may shatter.
function resolved(c){
  if(!merge()) return;
  const e=cardEff(c); let g=0;
  if(e.grow) g+=e.grow*(hasJ('goose')?2:1);
  if(e.snow){ const v=(e.coin||0)*(e.snow+(hasJ('avalanche')?10:0))/100; g+=Math.floor(v)+(Math.random()<v%1?1:0); }
  if(hasJ('hiker')) g++;
  if(g) c.grow=fin((c.grow||0)+g);
  shatter(c);
}
function resolveTreasure(c){ const v=tval(c); C(v); log(`${cname(c)} adds ${fmt(v)} to your purse.`); resolved(c); }
// A Cracked card shatters 1 time in 4: it is trashed. With Phoenix it may rise again, a level higher and still cracked.
function shatter(c){
  if(!c.crack||Math.random()>=TUNE.crackOdds) return false;
  c.gone=true; [G.inPlay,G.hand,G.discard,G.deck].some(p=>pull(p,c)); trashCard(c,true);
  log(`💥 ${cname(c)} shatters!`,'bad'); fx('shatter',c);
  if(hasJ('phoenix')&&Math.random()<TUNE.phoenix){
    const r=mk(c.key,c.lv+1); r.crack=true; if(c.grow) r.grow=c.grow; G.discard.push(r);
    log(`🐦‍🔥 ${cname(r)} rises from the ashes into your discard pile.`,'good'); fx('reborn',r); }
  return true;
}
// Saplings grow at the start of every wave, wherever they are.
function sprout(){
  const sp=allCards().filter(c=>DB[c.key].merge&&cardEff(c).sprout);
  for(const c of sp) c.grow=fin((c.grow||0)+cardEff(c).sprout*(hasJ('goose')?2:1));
  if(sp.length) log(`🌱 ${sp.length>1?`${sp.length} growing cards sprout`:`${cname(sp[0])} sprouts`}.`,'good');
}

/* ---------- the Vault: unspent Coin is saved at the end of a turn and earns interest ---------- */
const vaultRate = () => hasJ('jar')?.15:TUNE.vaultRate;
const vaultCap  = () => TUNE.vaultCap(G.wave)*(hasJ('jar')?2:1)*(hasJ('hoard')?10:1);
function interest(){
  const i=Math.min(vaultCap(),Math.floor(G.vault*vaultRate()));
  if(i>0){ G.vault=fin(G.vault+i); log(`🏦 The Vault pays ${fmt(i)} interest (${fmt(G.vault)} saved).`,'good'); fx('interest',i); }
}
// Take everything out of the Vault to spend this turn. What's left at the end of the turn goes back in.
function withdraw(){
  if(busy||G.over||G.phase!=='turn'||!(G.vault>0)) return;
  const v=G.vault; G.vault=0; G.coin=fin(G.coin+v); G.fromVault+=v;
  log(`🏦 You take ${fmt(v)} coin out of the Vault.`,'hl'); render();
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

// Merge mode: every Ward in the discard pile wears each threat down by a share of all it wants.
// Fractions build up on the threat, so a small demand still goes down eventually.
function wardTick(){
  const wards=G.discard.filter(c=>DB[c.key].stays&&DB[c.key].eff(c.lv).ward), live=G.slots.filter(Boolean);
  if(!wards.length||!live.length) return;
  const frac=wards.reduce((s,c)=>s+DB[c.key].eff(c.lv).ward,0);
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
  const k=await chooseOption(title,sub,live.map(t=>[t.id,`${t.art} ${t.n} — ${threatProgress(t).left}`]));
  return live.find(t=>t.id===k)||null;
}

const coinMult = () => hasJ('interest')?2:1;
// Merge mode: any threat that doesn't want Coin can be bought off with it. The price shrinks with what's left of it.
const COIN_KINDS=['prog_coin','once_coin'];
function leftShare(t){ const f=t.full;
  switch(t.kind){
    case 'once_hybrid': return t.needCoin/Math.max(1,f.needCoin);
    case 'panic':       return t.curses/Math.max(1,f.curses);
    case 'upgrade':     return ((t.needT-t.gotT)+(t.needA-t.gotA))/Math.max(1,f.needT+f.needA);
  }
  return Math.max(0,t.need-t.prog)/Math.max(1,t.need);
}
const bribeOf = t => t.bribe ? Math.max(1,Math.ceil(t.bribe*leftShare(t)/coinMult())) : 0;
const bribeReady = t => !!t.bribe && G.coin>=bribeOf(t);
async function payBribe(t){
  if(busy||G.over||G.phase!=='turn'||!G.slots.includes(t)||!bribeReady(t)) return;
  busy=true;
  try{ const p=bribeOf(t); G.coin-=p; log(`💰 You buy off ${t.n} for ${fmt(p)} coin.`,'hl'); completeThreat(t); await settle(); }
  finally { busy=false; render(); }
}
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
        log(`You pour ${fmt(amt)} coin into ${t.n} (${fmt(t.prog)}/${fmt(t.need)}).`,'hl'); break; }
      case 'once_coin':{
        const amt=coinFor(t.need); G.coin-=amt; t.need=0;
        log(`You pay ${fmt(amt)} coin to ${t.n} in one stroke.`,'hl'); break; }
      case 'prog_action':{
        const amt=Math.min(G.actions,unitsFor(rem));
        G.actions-=amt; t.prog=Math.min(t.need,t.prog+amt*unitMult());
        log(`You burn ${actN(amt)} on ${t.n} (${t.prog}/${t.need}).`,'hl'); break; }
      case 'prog_buy':{
        const amt=Math.min(G.buys,unitsFor(rem));
        G.buys-=amt; t.prog=Math.min(t.need,t.prog+amt*unitMult());
        log(`You trade away ${plural(amt,'Buy')} to ${t.n} (${t.prog}/${t.need}).`,'hl'); break; }
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
          [['y','Shake on it'],['n','Step back']]);
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
      `${a.name}: ${txt}.${t.detonating?` It will also ${splice()?'scar a card and ':''}cost the town a heart.`:''}`,opts);
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
  C(v); log(`${cname(c)} adds ${fmt(v)} to your purse.`);
  G.acting=(G.acting||0)+1;
  try{ for(let i=hasMod(c,'twin')?2:1;i>0;i--) spliceFx(c); } finally{ G.acting--; }
  resolved(c);
  afterPlay(c);
}

async function runAction(c){
  G.actionsPlayed++;
  if(hasJ('momentum')&&G.actionsPlayed>1){ C(G.actionsPlayed-1); log(`Momentum: +${G.actionsPlayed-1} Coin.`,'hl'); }
  await acting(async()=>{ spliceFx(c); await DB[c.key].fx(c,c.lv); });
  resolved(c);
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
      for(let i=0;i<times&&!c.gone;i++){ if(i) log('It resolves again.','hl'); await runAction(c); render(); }
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
  G.actions=Math.max(0,TUNE.energy+n.actions+(hasJ('wind')?1:0));
  G.buys=Math.max(0,1+n.buys+(hasJ('seal')?1:0));
  G.coin=Math.max(0,n.coin+G.later.coin);
  if(G.later.coin) log(`${merge()?'Your savings pay':'The orchard pays'} out ${fmt(G.later.coin)} coin.`,'good');
  G.later={coin:0,cards:0};
  if(merge()){ G.fromVault=0; interest(); if(hasJ('ossuary')) G.coin+=Math.floor(G.trash.length/2); }
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
    const kept=G.hand.filter(c=>hasMod(c,'retain')||DB[c.key].stays), wards=kept.filter(c=>DB[c.key].stays).length;
    for(const c of G.hand.splice(0)){ c.frozen=false; if(!kept.includes(c)) G.discard.push(c); }
    G.hand.push(...kept);
    if(merge()&&G.coin>0){ G.vault=fin(G.vault+G.coin); log(`🏦 ${fmt(G.coin)} coin goes into the Vault (${fmt(G.vault)} saved).`); }
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

    const due=G.turnInWave%spawnEvery()===0 || G.slots.every(s=>!s);
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
  const deck={}; allCards().forEach(c=>{ const n=cname(c)+(c.mods.length?` [${c.mods.map(m=>SPLICES[m].n).join(', ')}]`:'')+(c.grow?` (+${fmt(c.grow)})`:''); deck[n]=(deck[n]||0)+1; });
  const head=[
    `Coinkeep — ${{splice:'Splice',merge:'Merge',classic:'Classic'}[G.mode]} mode${when?' — '+when:''}`,
    `${G.over?'Run over':'In progress'}: wave ${G.wave}, turn ${G.turnInWave} (${G.turn} in all), ${plural(G.runCleared,'threat')} cleared`+(fused()?`, ${plural(Math.max(0,G.hearts),'heart')} left`:'')+(merge()?`, ${fmt(G.vault||0)} coin in the Vault`:''),
    `Charms: ${G.jokers.map(j=>JOKERS[j.key].n).join(', ')||'none'}`,
    `Deck (${deckSize()}): ${Object.entries(deck).sort().map(([n,k])=>k>1?`${k}× ${n}`:n).join(', ')}`,
  ];
  const body=entries.map(([m,cls])=> cls==='wave'?`\n=== ${m} ===`: cls==='turn'?`\n${m}`: `  ${m}`);
  return head.join('\n')+'\n'+body.join('\n')+'\n';
}
