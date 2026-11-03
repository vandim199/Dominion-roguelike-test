"use strict";
/* ==========================================================
   Coinkeep: Forays. Content and tuning numbers. No DOM here.
   Small numbers (energy, hand, Powder, fill) never scale.
   Big numbers (damage, shields, health, coin) scale by track.
   Card modes: p powder, d damage, s shields, b blight, hex
   curse charges, draw, e energy, repair, refire, fuse, fileall,
   salvo, rally, burn.
   ========================================================== */
const TUNE = {
  gHp:1.30, gAtk:1.30, gCoin:1.30,       // growth per fight
  hp0:26, atk0:14, coin0:18,               // fight 1 values
  pLv:1.5, mile:3,                        // payoff Г—pLv per level, Г—mile more at every 5th level
  cLv:2.07,                               // price Г—cLv per level
  capBase:4, capPer:2.6,                  // level cap = capBase + deepest/capPer
  bossEvery:15, finalBoss:105, bossHp:2.2, bossAtk:1.25,
  enrageTurn:5, enrage:1.5,
  energy:3, hand:5, mag:3,
  healBetween:.15, repairBetween:.25,
  defeatKeep:.7, firstClear:2,
  dropR:3.5, standing:1.4, swapCost:1, wardCut:.3, wardBoss:.15,
  startHp:60, cacheEvery:3, surge:1.5,
};

const BASTIONS = {
  ballista: {n:'Bolt Tower',  i:'рџЏ№', fill:3, cost:1, hp:20, price:10, d:8, tip:'Cheap, steady damage.'},
  bombard:  {n:'Great Bombard',i:'рџ’Ј', fill:8, cost:2, hp:14, price:14, d:42, tip:'Slow to fill, frail, enormous when it goes.'},
  buttress: {n:'Buttress',    i:'рџ§±', fill:3, cost:1, hp:30, price:8,  s:8, tip:'Shields for the coming attack.'},
  gatehouse:{n:'Gatehouse',   i:'рџЏЇ', fill:4, cost:2, hits:3, price:9, s:6, tip:'Counts hits, not damage: any attack, however big, takes one hit and stops there. Firing mends one hit and gives shields.'},
  plaguepit:{n:'Plague Pit',  i:'вЈпёЏ', fill:4, cost:1, hp:16, price:10, b:12, tip:'Blight deals its stacks each enemy turn, then halves.'},
  hexstone: {n:'Hexstone',    i:'рџ”®', fill:3, cost:1, hp:18, price:6,  hex:2, tip:'The next 2 attacks are halved.'},
  mint:     {n:'Mint',        i:'🪙', fill:5, cost:1, hp:16, price:9,  coin:.25, tip:'Coin worth a quarter of this fight\'s purse.'},
  signal:   {n:'Signal Post', i:'рџ“Ї', fill:3, cost:1, hp:16, price:8,  draw:2, tip:'Draw 2 cards, mid-turn.'},
  bellows:  {n:'Bellows',     i:'рџЊ¬пёЏ', fill:2, cost:1, hp:14, price:8,  p:4, tip:'Turns 2 Powder into 4 for whatever sits to the right.'},
  anvil:    {n:'Anvil',       i:'вљ’пёЏ', fill:4, cost:1, hp:24, price:9,  temper:3, tip:'The next Bastion to pay out pays Г—3.'},
};

const CARDS = {
  cartridge:{n:'Cartridge',i:'🧨',c:1,m:[{p:4},{d:3}],price:6,start:5},
  pike:     {n:'Pike',     i:'🗡️',c:1,m:[{d:4}],price:6,start:2},
  parry:    {n:'Parry',    i:'🛡️',c:1,m:[{s:7}],price:6,start:2},
  flint:    {n:'Flint',    i:'🔥',c:0,m:[{p:2}],price:5,start:2},
  keg:      {n:'Powder Keg',i:'🛢️',c:2,m:[{p:9},{d:9}],price:7},
  blast:    {n:'Blast Keg',i:'💥',c:1,m:[{p:7,burn:1}],price:7},
  sledge:   {n:'Sledge',   i:'🔨',c:2,m:[{d:10}],price:7},
  scout:    {n:'Outrider', i:'🐎',c:1,m:[{draw:2}],price:7},
  ramrod:   {n:'Ramrod',   i:'🪘',c:1,m:[{refire:1,burn:1}],price:9},
  fuse:     {n:'Long Fuse',i:'🧵',c:1,m:[{fuse:1}],price:7},
  hexcoin:  {n:'Bad Penny',i:'🌑',c:1,m:[{hex:2}],price:7},
  mortar:   {n:'Mortar & Trowel',i:'🪣',c:1,m:[{repair:.4,p:1}],price:7},
  ledger:   {n:'Petty Cash',i:'🧾',c:0,m:[{e:1,burn:1}],price:8},
  flask:    {n:'Blight Flask',i:'🧪',c:1,m:[{b:6}],price:7},
  salvo:    {n:'Salvo',    i:'🎆',c:1,m:[{salvo:1},{s:5}],price:7},
  rally:    {n:'Rally',    i:'📣',c:1,m:[{rally:2}],price:7},
  clerk:    {n:'Clerk',    i:'🖋️',c:1,m:[{fileall:1,draw:1}],price:7},
  ward:     {n:'Ward',     i:'🧿',sticky:1,c:1,price:8,tip:'Stuck in hand. Pay 1⚡ to file it. While it lies in your discard pile, attacks are cut by 30% (15% on bosses).'},
  deed:     {n:'Deed',     i:'📜',sticky:1,c:1,noshop:1,tip:'Stuck in hand. Pay 1⚡ to file it and collect rent.'},
  charter:  {n:'Charter',  i:'👑',sticky:1,c:1,noshop:1,tip:'Two Deeds on one sheet. Stuck in hand. Pay 1⚡ to file it and collect three times the rent.'},
  rubble:   {n:'Rubble',   i:'🪨',sticky:1,c:1,noshop:1,tip:'Stuck in hand until you pay 1⚡ to clear it. Gone after this fight.'},
};

// Intents: hit (front line), snipe (rightmost first), face (you), volley (everything), ram (big front hit),
// drain (Powder), jam (a slot next turn), rubble, hunker (takes a quarter damage next turn), dodge (the next hit misses), rest.
const ENEMIES = {
  rat:  {n:'Tollgate Rat', i:'рџђЂ',h:.8,a:.9,p:[['hit',1],['hit',1],['hit',1.4]]},
  hound:{n:'Rust Hound',   i:'рџђ•',h:1, a:1, p:[['hit',1],['snipe',1.2],['dodge',0]]},
  imp:  {n:'Tax Imp',      i:'рџ‘є',h:.9,a:.9,p:[['drain',3],['hit',1.1],['rubble',2]]},
  toad: {n:'Mire Toad',    i:'рџђё',h:1.2,a:.8,p:[['face',1],['hunker',.25],['hit',1.2]]},
  goat: {n:'Siege Goat',   i:'рџђђ',h:1.1,a:1, p:[['dodge',0],['ram',3],['hit',.7]]},
  moth: {n:'Ledger Moth',  i:'рџ¦‹',h:.8,a:.8,p:[['volley',.6],['jam',0],['dodge',0],['volley',.6]]},
  mason:{n:'Dun Mason',    i:'рџ§Њ',h:1.2,a:1,p:[['hunker',.25],['hit',1.6],['jam',1]]},
  crow: {n:'Writ Crow',    i:'рџђ¦',h:.9,a:1, p:[['snipe',1],['face',.9],['rubble',1]]},
};
const BOSSES = [
  {n:'The Bailiff',   i:'вљ–пёЏ',h:1,a:1,coin:3,rule:'Seizes one more slot each turn, left to right.',seize:1,p:[['jam',-1],['hit',1.2],['jam',-1],['volley',.7]]},
  {n:'The Siege Tower',i:'рџ—ј',h:1.1,a:1,coin:3,rule:'Its attacks start from the right end of your board.',rev:1,p:[['hit',1],['hunker',.25],['hit',1.5],['face',.8]]},
  {n:'The Toll King', i:'рџ¤ґ',h:1,a:.9,coin:3,rule:'Takes the first 2 Powder you make each turn.',toll:2,p:[['hit',1.2],['rubble',2],['face',1],['drain',2]]},
];
const FINAL = {n:'The Foreclosure',i:'рџЏ¦',h:1.4,a:1.1,coin:6,rule:'Takes 2 Powder each turn and strikes from the right.',toll:2,rev:1,p:[['volley',.7],['dodge',0],['ram',2.5],['hunker',.25],['face',1.2]]};

// Bought with Crests from bosses. Rule changes, not multipliers.
const WORKS = {
  energy: {n:'Quartermaster',i:'вљЎ',d:'+1 energy every turn.'},
  hand:   {n:'Wide Table',   i:'рџѓЏ',d:'+1 hand size.'},
  stores: {n:'Forward Stores',i:'рџ“¦',d:'Every fight opens with 4 Powder in the Magazine.'},
  magazine:{n:'Big Magazine', i:'рџ—ѓпёЏ',d:'Magazine holds 8 instead of 3.'},
  foundry:{n:'Foundry',      i:'рџЏ­',d:'Bastions have Г—4 health.'},
  twin:   {n:'Twin Feed',    i:'в›“пёЏ',d:'The leftmost Bastion may fire twice a turn.'},
};
// The three upgrade tracks. Every card and Bastion reads its big numbers from these.
const TRACKS = {
  gun:  {n:'Gunnery', i:'🎯',price:10,d:'All damage and Blight, cards and Bastions alike.'},
  mason:{n:'Masonry', i:'🧱',price:8, d:'All shields and Bastion health.'},
  walls:{n:'Walls',   i:'🏰',price:6, d:'Your own health.'},
};
const DEED_SLOTS = [[1,3],[2,4],[4,5],[6,6]];     // Deeds owned -> board slots
const deedPrice = n => 40*Math.pow(25,n);

// A finite whole-ish number: NaN to 0, Infinity to 1e300. Sims also count how often this had to step in.
const NUMCHK = {bad:0};
const num = x => { if(Number.isFinite(x)) return x; NUMCHK.bad++; return x>0?1e300:0; };
function fmt(n){ n=+n||0; const a=Math.abs(n), s=n<0?'в€’':'';
  if(a<1e4) return s+Math.round(a);
  if(a>=1e15) return s+a.toExponential(1).replace('e+','e');
  for(const [d,u] of [[1e3,'K'],[1e6,'M'],[1e9,'B'],[1e12,'T']]){ const x=a/d; if(x<999.95) return s+(x<100?x.toFixed(1):Math.round(x))+u; }
  return s+a.toExponential(1).replace('e+','e'); }

if(typeof module!=='undefined') module.exports={TRACKS,TUNE,BASTIONS,CARDS,ENEMIES,BOSSES,FINAL,WORKS,DEED_SLOTS,deedPrice,NUMCHK,num,fmt};
