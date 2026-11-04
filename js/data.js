"use strict";
/* ==========================================================
   Coinkeep: Forays (tap the deck). Static data, tuning and small helpers.
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
// Seeded randomness: the state is a plain number, so it saves and clones with the trip.
function rng32(o,k){ o[k]=(o[k]+0x6D2B79F5)|0; let t=o[k]; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }
function hash01(a,b){ const o={s:(Math.imul(a|0,2654435761)^Math.imul(b|0,40503))|0}; rng32(o,'s'); return rng32(o,'s'); }

const TUNE = {
  hp0:60, hpG:1.34,  atk0:17, atkG:1.19,  coin0:70, coinG:1.255,   // enemy per fight
  bossEvery:12, bossHp:2.6, bossCoin:4, caravanEvery:7, caravanPrice:2,
  valG:1.40, mileX:3, mileEvery:10, defG:1.42,                   // value of a card or bastion per level
  cost0:30, pieceCostX:2.5, costG:2.0, hearthCost:100, hearthG:1.60, baseHp:60,
  wheelCost:300, wheelG:5, autoCost:1200, autoG:6, autoStep:.5, ledgerCost:3000, ledgerG:60, ledgerX:1.25,
  marchR:2, marchCoin:.1, defeatKeep:.7, enrageAfter:6, enrageX:1.4, healAfter:.2, repairAfter:.25,
  deckMin:5, deckMax:15, finalFight:107, sockAt:[5,20,40],
  startDeck:['fork','fork','fork','helm','helm','scoop','keg','errand'], startBoard:['cannon','stake'],
  // Real time. A "turn" is one enemy swing.
  swing:4,            // seconds between enemy swings
  shuffle:.5,         // seconds the deck is out of reach when it reshuffles
  hopper:12,          // Powder held while no bastion can take it
  blightPay:.25, blightKeep:.8,   // every second: blight burns for this share, then fades to this share
  comboCap:100, comboStep:.02, comboGrace:1.5, comboFade:.4,   // +1 per card or firing; at the cap everything pays x3; fades after a pause
  critChance:.05, critX:5, crossX:2, runPay:true, runCap:5, bashG:1.1,
  whetCap:729, chargeX:2, sallyCap:8, barrelG:1.35, barrelMax:30, coinCap:1,
  powSecs:12, powTap:4,   // Power is the damage this deck does in 12 seconds at 4 taps a second, from an empty board
  junk:'deed',        // 'deed' a Title Deed in the pack opens each slot past two; 'none' slots are free
};

/* Kinds of effect that count as an attack: Whetstones and chains are spent on these, and only these. */
const ATK = {dmg:1,sally:1,ram:1,horn:1,barrel:1,bash:1,plague:1,arsenal:1,poison:1};

/* Cards. fx entries: [kind, base]. Every card plays for free when drawn. piece:true is a bastion: it lands on your field, and need is the Powder it takes to fire. */
const CARDS = {
  fork:   {name:'Pitchfork',     art:'🔱', fx:[['dmg',6]],  text:'Deal {dmg}.'},
  helm:   {name:'Bucket Helm',   art:'🪣', fx:[['block',5]], text:'Gain {block} block.'},
  scoop:  {name:'Powder Scoop',  art:'🥄', fx:[['powder',3]], text:'+{powder} Powder.'},
  keg:    {name:'Keg Toss',      art:'🛢️', fx:[['dmg',4],['powder',1]], text:'Deal {dmg}. +{powder} Powder.'},
  errand: {name:'Errand Boy',    art:'🏃', fx:[['draw',2]], text:'Plays the next {draw} cards as well.'},
  sally:  {name:'Sally Forth',   art:'⚔️', fx:[['sally',5]], text:'Deal {sally} for each attack in a row, this one included (up to 8).'},
  ram:    {name:'Battering Ram', art:'🪵', fx:[['ram',5]], text:'Deal {ram} for each bastion on your field.'},
  horn:   {name:'War Horn',      art:'📣', fx:[['horn',.3]], text:'Deal {horn} for each point of Combo.'},
  barrel: {name:'Rolling Barrel',art:'🛞', fx:[['barrel',4]], text:'Deal {barrel}. Pays a third more each time you play it this fight.'},
  bash:   {name:'Shield Bash',   art:'🥊', fx:[['bash',.5]], text:'Deal {bash} of your block, and keep the block.'},
  whet:   {name:'Whetstone',     art:'🪨', fx:[['whet',3]], text:'Your next attack or firing gun pays triple. Stacks.'},
  anvil:  {name:'Field Anvil',   art:'⚒️', fx:[['anvil',1]], text:'The next card you draw pays double for the rest of this fight.'},
  rope:   {name:'Bell Rope',     art:'🔔', fx:[['rope',1]], text:'The bastion Powder is heading for fires now, free.'},
  trail:  {name:'Powder Trail',  art:'🧨', fx:[['trail',1]], text:'+1 Powder into every bastion at once.'},
  vial:   {name:'Blight Vial',   art:'🧪', fx:[['poison',11]], text:'Apply {poison} blight. Blight burns every second and fades.'},
  plague: {name:'Plague Bell',   art:'☠️', fx:[['plague',2]], text:'Deal {plague} the enemy\'s blight, then halve the blight.'},
  doll:   {name:'Hex Doll',      art:'🎎', fx:[['hex',2]], text:'The next 2 enemy hits are halved.'},
  mend:   {name:'Masons',        art:'🧱', fx:[['repair',.35],['block',2]], text:'Repair every bastion 35%. Gain {block} block.'},
  tithe:  {name:'Tithe Box',     art:'📦', fx:[['coin',.03]], text:'Gain coin: {coin} of this bounty.'},
  drum:   {name:'War Drum',      art:'🥁', fx:[['combo',6]], text:'+{combo} Combo.'},
  wind:   {name:'Second Wind',   art:'🌬️', fx:[['heal',.03]], text:'Heal {heal} of your health.'},
  deed:   {name:'Title Deed',    art:'📜', junk:true, fx:[], text:'Does nothing when drawn. While packed it opens one board slot past two.'},
  rubble: {name:'Rubble',        art:'🪨', junk:true, temp:true, fx:[], text:'Does nothing. Clogs your deck once, then it is gone.'},
  // Bastions
  cannon: {name:'Cannon',        art:'💣', piece:true, need:3, hp:30, fx:[['dmg',42]], text:'Deal {dmg}.'},
  mortar: {name:'Mortar',        art:'🎯', piece:true, need:7, hp:20, fx:[['dmg',138]], text:'Deal {dmg}.'},
  stake:  {name:'Palisade',      art:'🪓', piece:true, need:2, hp:40, fx:[['block',7]], text:'Gain {block} block.'},
  gate:   {name:'Gatehouse',     art:'🏰', piece:true, need:3, hp:90, taunt:true, fx:[['block',6],['selfrepair',.3]], text:'Takes aimed hits first. Gain {block} block and repair 30%.'},
  apoth:  {name:'Apothecary',    art:'⚗️', piece:true, need:3, hp:24, fx:[['poison',54]], text:'Apply {poison} blight.'},
  hut:    {name:'Witch Hut',     art:'🛖', piece:true, need:4, hp:24, fx:[['hex',2],['dmg',24]], text:'Next 2 enemy hits halved. Deal {dmg}.'},
  mint:   {name:'Mint',          art:'🪙', piece:true, need:4, hp:24, fx:[['coin',.04]], text:'Gain coin: {coin} of this bounty.'},
  post:   {name:'Courier Post',  art:'📯', piece:true, need:4, hp:24, fx:[['draw',2]], text:'Plays the next {draw} cards from your deck.'},
  tower:  {name:'Drum Tower',    art:'🗼', piece:true, need:3, hp:30, fx:[['combo',8]], text:'+{combo} Combo.'},
  bellows:{name:'Bellows',       art:'🪗', piece:true, need:2, hp:20, fx:[['double',1]], text:'The next gun to fire or attack card you draw pays double.'},
  forge:  {name:'Forge',         art:'🏭', piece:true, need:5, hp:30, fx:[['forge',.25]], text:'Your attack cards pay {forge} more for this fight. Stacks.'},
  arsenal:{name:'Arsenal',       art:'🗡️', piece:true, need:3, hp:24, fx:[['arsenal',.75]], text:'Repeats your last attack card at {arsenal} of its hit.'},
};
const SHOP_POOL = ['fork','scoop','sally','ram','horn','barrel','bash','whet','anvil','rope','trail','vial','plague','doll','mend','tithe','drum','wind','keg','errand','mortar','gate','apoth','hut','mint','post','tower','bellows','forge','arsenal'];

// Sockets: three on every card, opened at levels 5, 20 and 40. Free to change at home. No perk twice on one card.
const PERKS = {
  keen:   {name:'Keen',   for:'both',  text:'Pays triple.'},
  echo:   {name:'Echo',   for:'both',  text:'Its effect happens twice.'},
  light:  {name:'Light',  for:'piece', text:'Needs 1 less Powder.'},
  fuel:   {name:'Fuel',   for:'card',  text:'+2 Powder when drawn.'},
  swift:  {name:'Swift',  for:'card',  text:'Also plays the next card.'},
  flurry: {name:'Flurry', for:'card',  text:'Pays more the higher your Combo: up to ×3 at 100.'},
  bulwark:{name:'Bulwark',for:'piece', text:'Eight times the health.'},
  relay:  {name:'Relay',  for:'piece', text:'+1 Powder when it fires.'},
  primed: {name:'Primed', for:'piece', text:'Fires the moment it lands.'},
  charge: {name:'Charge', for:'piece', text:'The next gun to fire or attack card pays double. Chains multiply, until the Powder loops round.'},
};

/* Enemies. intent(n) gives what swing n does: {hit:mult,at:'left'|'right'|'you'|'all'}, {drain:1}, {seal:1}, {rubble:n}. */
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
  // The target Power is measured against. It never appears in the game.
  dummy: {name:'Dummy', art:'🎯', hp:1, min:1e9, intent:t=>[]},
};
const ENEMY_POOL = ['rat','raider','archer','ogre','sapper','warden','cutpurse','shaman'];
const BOSS_ORDER = ['toller','bishop','king'];

// Rule changes: a boss offers three of these. Each can be taken once.
const REWARDS = {
  slot1:  {name:'Land grant',     text:'One more board slot, and a Title Deed to hold it.', on:P=>grantSlot(P)},
  slot2:  {name:'Second grant',   text:'One more board slot, and a Title Deed to hold it.', on:P=>grantSlot(P), after:'slot1'},
  slot3:  {name:'Third grant',    text:'One more board slot, and a Title Deed to hold it.', on:P=>grantSlot(P), after:'slot2'},
  slot4:  {name:'Royal charter',  text:'One more board slot, and a Title Deed to hold it.', on:P=>grantSlot(P), after:'slot3'},
  hot1:   {name:'Hot blood',      text:'Combo goes 50 higher: up to ×4.', on:P=>{P.comboCap+=50;}},
  hot2:   {name:'Boiling blood',  text:'Combo goes 50 higher again: up to ×5.', on:P=>{P.comboCap+=50;}, after:'hot1'},
  crit1:  {name:'Lucky horseshoe',text:'Every card and firing is 5% more likely to crit.', on:P=>{P.crit+=.05;}},
  crit2:  {name:'Luckier horseshoe',text:'Every card and firing is 5% more likely to crit.', on:P=>{P.crit+=.05;}, after:'crit1'},
  riffle: {name:'Card sharp',     text:'Reshuffling takes half as long.', on:P=>{P.shuffleX*=.5;}},
  sluice: {name:'Sluice gate',    text:'The wheel turns 3 Powder a second faster, free.', on:P=>{P.wheel+=3;}},
  page:   {name:'Trained page',   text:'The Page draws 1 more card a second, free.', on:P=>{P.auto+=1;}},
  socket: {name:'Master jeweller',text:'Every card opens a fourth socket at level 60.', on:P=>{P.extraSock=1;}},
};
