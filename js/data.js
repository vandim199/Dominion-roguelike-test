"use strict";
/* ==========================================================
   Coinkeep: Forays. Static data, tuning and small helpers.
   Runs in the browser and, through sim/load.js, in Node.
   ========================================================== */

// Published versions share one browser storage, so each keeps its own save (js/versions.js lists them).
const SLOT = (typeof location!=='undefined'&&(/\/v\/([\w-]+)\//.exec(location.pathname)||[])[1]) || '';
const slotKey = k => SLOT ? `${k}.${SLOT}` : k;

const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
// A finite number or a loud failure in the sim; in the game NaN becomes 0 and Infinity 1e300.
const num = x => Number.isFinite(x) ? x : x>0 ? 1e300 : 0;
function fmt(n){ n=+n||0; const a=Math.abs(n), s=n<0?'-':'';
  if(a<1e4) return s+(a<10&&a%1>.04?a.toFixed(1):Math.round(a));
  if(a>=1e15) return s+a.toExponential(1).replace('e+','e');
  for(const [d,u] of [[1e3,'K'],[1e6,'M'],[1e9,'B'],[1e12,'T']]){ const x=a/d; if(x<999.95) return s+(x<100?x.toFixed(1):Math.round(x))+u; }
  return s+a.toExponential(1).replace('e+','e'); }
// Seeded randomness: the state is a plain number, so it saves and clones with the fight.
function rng32(o,k){ o[k]=(o[k]+0x6D2B79F5)|0; let t=o[k]; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }
function hash01(a,b){ const o={s:(Math.imul(a|0,2654435761)^Math.imul(b|0,40503))|0}; rng32(o,'s'); return rng32(o,'s'); }

const TUNE = {
  hp0:20, hpG:1.30,  atk0:13, atkG:1.20,  coin0:30, coinG:1.27,   // enemy per fight
  bossEvery:12, bossHp:2.6, bossCoin:4, caravanEvery:7, caravanPrice:2,
  valG:1.40, mileX:3, mileEvery:10, defG:1.42,                   // value of a card or bastion per level
  cost0:4, pieceCostX:2.5, costG:1.62, hearthCost:10, hearthG:1.60, baseHp:40,
  wheelCost:30, wheelG:9, magCost:60, magG:5, ledgerCost:300, ledgerG:60, ledgerX:1.25,
  marchR:4, defeatKeep:.7, enrageAfter:6, enrageX:1.4, healAfter:.2, repairAfter:.25,
  magBase:2, swapCost:1, handBase:5, energyBase:3, deckMin:8, deckMax:12, finalFight:118,
  sockAt:[5,20,40],
  feed:'stoke',      // 'stoke' any card burns for Powder; 'powdercards' only Powder cards feed; 'wheel' only the wheel feeds
  junk:'deed',       // 'deed' a Title Deed in the pack opens each slot past two; 'none' slots are free; 'hold' deeds also boost while held
};

/* Cards. fx entries: [kind, base]. dmg, poison scale by value; block by defence; the rest are flat.
   stoke: Powder when burned (default 1). piece:true is a bastion: cost is energy to deploy, need is Powder to fire. */
const CARDS = {
  fork:   {name:'Pitchfork',     art:'🔱', cost:1, fx:[['dmg',6]],  text:'Deal {dmg}.'},
  helm:   {name:'Bucket Helm',   art:'🪣', cost:1, fx:[['block',5]], text:'Gain {block} block.'},
  scoop:  {name:'Powder Scoop',  art:'🥄', cost:1, fx:[['powder',3]], text:'+3 Powder.'},
  keg:    {name:'Keg Toss',      art:'🛢️', cost:1, fx:[['dmg',4],['powder',1]], text:'Deal {dmg}. +1 Powder.'},
  errand: {name:'Errand Boy',    art:'🏃', cost:1, fx:[['draw',2]], text:'Draw 2.'},
  sally:  {name:'Sally Forth',   art:'⚔️', cost:2, fx:[['dmg',16]], text:'Deal {dmg}.'},
  pavise: {name:'Pavise',        art:'🛡️', cost:2, fx:[['block',15]], text:'Gain {block} block.'},
  second: {name:'Second Wind',   art:'🌬️', cost:0, stoke:0, fx:[['energy',1]], text:'+1 energy. Burns for nothing.'},
  mend:   {name:'Masons',        art:'🧱', cost:1, fx:[['repair',.35],['block',2]], text:'Repair every bastion 35%. Gain {block} block.'},
  whet:   {name:'Whetstone',     art:'🪨', cost:1, fx:[['whet',3]], text:'The next bastion to fire or attack card you play pays triple.'},
  funnel: {name:'Funnel',        art:'🔻', cost:0, fx:[['aim',3]], text:'The next 3 Powder go to the rightmost bastion that can fire.'},
  vial:   {name:'Blight Vial',   art:'🧪', cost:1, fx:[['poison',11]], text:'Apply {poison} blight. Blight halves each turn.'},
  doll:   {name:'Hex Doll',      art:'🎎', cost:1, fx:[['hex',2]], text:'The next 2 enemy hits are halved.'},
  tithe:  {name:'Tithe Box',     art:'📦', cost:1, fx:[['coin',.3]], text:'Gain coin: {coin} of this bounty.'},
  rope:   {name:'Bell Rope',     art:'🔔', cost:2, fx:[['trigger',1]], text:'The leftmost bastion that can fire does, for free.'},
  ram:    {name:'Battering Ram', art:'🪵', cost:3, fx:[['dmg',48]], text:'Deal {dmg}.'},
  cart:   {name:'Handcart',      art:'🛒', cost:0, fx:[['rotate',1],['draw',1]], text:'Move your leftmost bastion to the far right. Draw 1.'},
  anvil:  {name:'Field Anvil',   art:'⚒️', cost:1, fx:[['anvil',3]], text:'Your strongest other card in hand pays triple for this fight.'},
  deed:   {name:'Title Deed',    art:'📜', cost:0, junk:true, stoke:0, fx:[], text:'Cannot be played and burns for nothing. While packed it opens one board slot past two.'},
  ward:   {name:'Boundary Ward', art:'🪬', cost:0, junk:true, stays:true, stoke:0, fx:[], text:'Cannot be played, stays in hand. Once burned, the enemy loses 3% of max health each turn while it lies in the discard.'},
  rubble: {name:'Rubble',        art:'🪨', cost:0, junk:true, stoke:0, temp:true, fx:[], text:'Cannot be played. Burn it to clear it, for no Powder.'},
  // Bastions
  cannon: {name:'Cannon',        art:'💣', piece:true, cost:2, need:3, hp:30, fx:[['dmg',14]], text:'Deal {dmg}.'},
  mortar: {name:'Mortar',        art:'🎯', piece:true, cost:3, need:7, hp:20, fx:[['dmg',46]], text:'Deal {dmg}.'},
  stake:  {name:'Palisade',      art:'🪓', piece:true, cost:1, need:2, hp:40, fx:[['block',9]], text:'Gain {block} block.'},
  gate:   {name:'Gatehouse',     art:'🏰', piece:true, cost:2, need:4, hp:90, taunt:true, fx:[['block',6],['selfrepair',.3]], text:'Takes aimed hits first. Gain {block} block and repair 30%.'},
  apoth:  {name:'Apothecary',    art:'⚗️', piece:true, cost:2, need:3, hp:24, fx:[['poison',18]], text:'Apply {poison} blight.'},
  hut:    {name:'Witch Hut',     art:'🛖', piece:true, cost:2, need:5, hp:24, fx:[['hex',2],['dmg',8]], text:'Next 2 enemy hits halved. Deal {dmg}.'},
  mint:   {name:'Mint',          art:'🪙', piece:true, cost:2, need:4, hp:24, fx:[['coin',.4]], text:'Gain coin: {coin} of this bounty.'},
  post:   {name:'Courier Post',  art:'📯', piece:true, cost:2, need:4, hp:24, fx:[['draw',2]], text:'Draw 2.'},
  granary:{name:'Granary',       art:'🌾', piece:true, cost:2, need:5, hp:30, fx:[['energy',2]], text:'+2 energy.'},
  bellows:{name:'Bellows',       art:'🪗', piece:true, cost:1, need:2, hp:20, fx:[['powder',3]], text:'+3 Powder, which runs on down the line.'},
};
const SHOP_POOL = ['sally','pavise','second','mend','whet','funnel','vial','doll','tithe','rope','ram','cart','anvil','keg','errand','mortar','gate','apoth','hut','mint','post','granary','bellows'];

// Sockets: three on every card, opened at levels 5, 20 and 40. Free to change at home. No perk twice on one card.
const PERKS = {
  keen:   {name:'Keen',   for:'both',  text:'Pays triple.'},
  light:  {name:'Light',  for:'both',  text:'Card: costs 1 less energy. Bastion: needs 1 less Powder.'},
  fuel:   {name:'Fuel',   for:'card',  text:'Burns for 2 more Powder.'},
  echo:   {name:'Echo',   for:'card',  text:'Its effect happens twice.'},
  swift:  {name:'Swift',  for:'card',  text:'Draw a card when played.'},
  flurry: {name:'Flurry', for:'card',  text:'Pays times the number of cards played this turn, itself included.'},
  bulwark:{name:'Bulwark',for:'piece', text:'Eight times the health.'},
  twin:   {name:'Twin',   for:'piece', text:'Can fire twice a turn.'},
  relay:  {name:'Relay',  for:'piece', text:'Passes 1 Powder on when it fires.'},
  primed: {name:'Primed', for:'piece', text:'Starts every fight one Powder short of firing.'},
  charge: {name:'Charge', for:'piece', text:'The next bastion to fire or attack card you play this turn pays triple. Chains multiply.'},
};

/* Enemies. intent(turn) gives a list of actions: {hit:mult,at:'left'|'right'|'you'|'all'}, {drain:1}, {seal:1}, {rubble:n}. */
const ENEMIES = {
  rat:   {name:'Packrat',       art:'🐀', hp:.9, min:0, intent:t=>[{hit:1,at:'left'}]},
  raider:{name:'Hedge Raider',  art:'🗡️', hp:1,  min:0, intent:t=>[{hit:.6,at:'left'},{hit:.6,at:'left'}]},
  archer:{name:'Tower Archer',  art:'🏹', hp:.9, min:3, intent:t=>[{hit:1.1,at:'right'}]},
  ogre:  {name:'Toll Ogre',     art:'👹', hp:1.2,min:4, intent:t=>t%2?[{hit:.3,at:'you'}]:[{hit:2.5,at:'you'}]},
  sapper:{name:'Sapper',        art:'⛏️', hp:1,  min:6, intent:t=>[{drain:1},{hit:.6,at:'left'}]},
  warden:{name:'Shield Warden', art:'🛡️', hp:.9, min:8, ward:1, intent:t=>[{hit:.9,at:'left'}]},
  cutpurse:{name:'Cutpurse',    art:'🥷', hp:.8, min:5, flee:4, intent:t=>[{hit:.6,at:'you'}]},
  shaman:{name:'Mire Shaman',   art:'🧙', hp:1,  min:10,intent:t=>[{rubble:1},{hit:.7,at:'left'}]},
  // Bosses
  toller:{name:'The Toll Collector', art:'🧛', boss:true, hp:1, intent:t=>[{seal:1},{hit:1.3,at:'left'}]},
  bishop:{name:'The Iron Bishop',    art:'🗿', boss:true, hp:1, intent:t=>t%3?[{hit:.7,at:'all'}]:[{hit:2.4,at:'you'}]},
  king:  {name:'The Hollow King',    art:'👑', boss:true, hp:1, grow:1.25, intent:t=>t%2?[{hit:1,at:'left'}]:[{drain:1},{hit:1,at:'you'}]},
};
const ENEMY_POOL = ['rat','raider','archer','ogre','sapper','warden','cutpurse','shaman'];
const BOSS_ORDER = ['toller','bishop','king'];

// Rule changes: a boss offers three of these. Each can be taken once.
const REWARDS = {
  slot1:  {name:'Land grant',     text:'One more board slot, and a Title Deed to hold it.', on:P=>grantSlot(P)},
  slot2:  {name:'Second grant',   text:'One more board slot, and a Title Deed to hold it.', on:P=>grantSlot(P), after:'slot1'},
  slot3:  {name:'Third grant',    text:'One more board slot, and a Title Deed to hold it.', on:P=>grantSlot(P), after:'slot2'},
  slot4:  {name:'Royal charter',  text:'One more board slot, and a Title Deed to hold it.', on:P=>grantSlot(P), after:'slot3'},
  energy1:{name:'Strong tea',     text:'+1 energy every turn.', on:P=>{P.energy++;}},
  energy2:{name:'Stronger tea',   text:'+1 energy every turn.', on:P=>{P.energy++;}, after:'energy1'},
  hand1:  {name:'Wide satchel',   text:'+1 card in hand every turn.', on:P=>{P.hand++;}},
  hand2:  {name:'Wider satchel',  text:'+1 card in hand every turn.', on:P=>{P.hand++;}, after:'hand1'},
  sluice: {name:'Sluice gate',    text:'The wheel turns 3 Powder faster, free.', on:P=>{P.wheel+=3;}},
  magz:   {name:'Powder cellar',  text:'The Magazine holds 6 more.', on:P=>{P.mag+=6;}},
  socket: {name:'Master jeweller',text:'Every card opens a fourth socket at level 60.', on:P=>{P.extraSock=1;}},
};
