"use strict";
/* ==========================================================
   Spellbook — static data: tuning, cards, relics, foes.
   Every card costs 1 Mana to play. Damage is multiplied by
   the Mana you hold when it lands, so order matters.
   ========================================================== */

const rnd  = n => Math.floor(Math.random()*n);
const pick = a => a[rnd(a.length)];
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function wpick(pairs){ const tot=pairs.reduce((s,p)=>s+p[1],0); let r=Math.random()*tot;
  for(const [k,w] of pairs){ if(r<w) return k; r-=w; } return pairs[pairs.length-1][0]; }
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const plural = (n,w,p) => `${n} ${n===1?w:(p||w+'s')}`;
// Big numbers stay readable: 12,345 → 12.3K, then M, B, T, and 1.2e15 beyond.
function fmt(n){
  n=Math.round(n); const a=Math.abs(n);
  if(a<10000) return String(n);
  const u=['K','M','B','T']; let i=-1, v=a;
  while(v>=1000&&i<u.length-1){ v/=1000; i++; }
  if(v>=1000) return (n<0?'-':'')+a.toExponential(1).replace('+','');
  return (n<0?'-':'')+(v<100?v.toFixed(1):Math.round(v))+u[i];
}

const MANA='✦', ARC='◆';

const TUNE = {
  handSize:5, startMana:3, turns:5, hearts:3, relicSlots:5, marketSize:6,
  fightsPerCircle:3,                         // minion, elite, boss
  circles:8,                                 // beat the 8th boss to win; endless after
  hp0:45,                                    // the first minion's health
  hpGrowth: f => Math.pow(1.43, f),          // f = fights before this one
  eliteHp:1.6, bossHp:2.4,
  maxTier: c => c-1,                         // market tier climbs one a circle
  bounty: c => 2+c,                          // Arcana for each turn left when a foe falls
  startArcana:0,
  winArcana: c => 3+2*c,                     // Arcana for every victory
};

/* ==========================================================
   CARDS. Each card is a list of steps that resolve top to
   bottom (ops). lv is the card's tier: Firebolt, Firebolt+…
   ========================================================== */
const DB={};
function def(k,o){ DB[k]=Object.assign({key:k,step:3,t:'spell'},o); }
const plus = lv => lv<=0 ? '' : lv<=3 ? '+'.repeat(lv) : `+${lv}`;
// How hard a card hits at a tier: 1,2,3,4,5,8,11,17,26,38… Prices follow the same curve.
const tierMult = lv => Math.max(1+lv, Math.round(Math.pow(1.5,lv)));

/* Card types: arcana (economy), mana (gain Mana / draw), spell (damage), rune (lasts the fight), curse. */
// --- Arcana ---
def('mote',   {n:'Mote',        c:0, step:2, t:'arcana', art:'✧', ops:l=>[['arc',tierMult(l)]]});
def('crystal',{n:'Crystal',     c:3, step:4, t:'arcana', art:'💎', ops:l=>[['arc',2*tierMult(l)]]});
def('starshard',{n:'Star Shard',c:6, step:5, t:'arcana', art:'🌟', ops:l=>[['arc',3*tierMult(l)]]});
def('alembic',{n:'Alembic',     c:5, step:4, t:'arcana', art:'⚗', ops:l=>[['alch',tierMult(l)]]});
def('hoard',  {n:'Hoarded Tome',c:4, step:3, t:'arcana', art:'📕', ops:(l,c)=>[['arc',tierMult(l)+((c&&c.grow)||0)],['grow',1]]});

// --- Mana and draw ---
def('channel',{n:'Channel',     c:2, t:'mana', art:'🌀', ops:l=>[['mana',2+l]]});
def('leyline',{n:'Ley Line',    c:3, t:'mana', art:'〰', ops:l=>[['draw',1],['mana',2+l]]});
def('wellspring',{n:'Wellspring',c:5,t:'mana', art:'⛲', ops:l=>[['mana',4+2*l]]});
def('study',  {n:'Study',       c:4, t:'mana', art:'📖', ops:l=>[['draw',3+l]]});
def('familiar',{n:'Familiar',   c:5, t:'mana', art:'🦉', ops:l=>[['draw',2+Math.floor(l/2)],['mana',1+Math.ceil(l/2)]]});
def('reshuffle',{n:'Clear Mind',c:2, step:2, t:'mana', art:'🍃', ops:l=>[['mana',1],['cycle',l]]});
def('amplify',{n:'Amplify',     c:8, step:5, t:'mana', art:'🔆', rare:true, ops:l=>[['double',2+l]]});
def('echo',   {n:'Twincast',    c:5, step:4, t:'mana', art:'👥', ops:l=>[['echo',1+l]]});
def('banish', {n:'Banish',      c:2, step:2, t:'mana', art:'🕳', ops:l=>[['trash',3+l]]});

// --- Damage ---
def('zap',    {n:'Zap',         c:1, step:2, t:'spell', art:'⚡', ops:l=>[['dmg',3*tierMult(l)]]});
def('firebolt',{n:'Firebolt',   c:3, t:'spell', art:'🔥', ops:l=>[['dmg',7*tierMult(l)]]});
def('missiles',{n:'Magic Missiles',c:4,t:'spell',art:'✴', ops:l=>[['dmg',3*tierMult(l),3]]});
def('surge',  {n:'Surge',       c:5, t:'spell', art:'🌩', ops:l=>[['mana',3],['dmg',6*tierMult(l)]]});
def('wild',   {n:'Wild Magic',  c:4, t:'spell', art:'🎇', ops:l=>[['dmg',12*tierMult(l)],['mana',3]]});
def('fireball',{n:'Fireball',   c:6, t:'spell', art:'☄', ops:l=>[['dmg',22*tierMult(l)],['lose',2]]});
def('chain',  {n:'Chain Lightning',c:5,t:'spell',art:'⛓', ops:l=>[['chain',5*tierMult(l)]]});
def('ignite', {n:'Ignite',      c:4, t:'spell', art:'🕯', ops:l=>[['burn',tierMult(l)]]});
def('hex',    {n:'Hex',         c:4, t:'spell', art:'🧿', ops:l=>[['vuln',50+25*l],['mana',1]]});
def('empower',{n:'Empower',     c:4, t:'spell', art:'💪', ops:l=>[['mana',1+l],['empower',2]]});
def('cataclysm',{n:'Cataclysm', c:8, step:5, t:'spell', art:'🌋', rare:true, ops:l=>[['nova',2*tierMult(l)]]});
def('meteor', {n:'Meteor',      c:7, step:5, t:'spell', art:'🌠', ops:l=>[['dmg',45*tierMult(l)],['exhaust']]});

// --- Runes: stay out for the rest of the fight ---
def('focus',  {n:'Focus Rune',  c:5, t:'rune', art:'🔷', ops:l=>[['focus',2*tierMult(l)]]});
def('wellrune',{n:'Mana Rune',  c:6, t:'rune', art:'🔶', ops:l=>[['manarune',1+l]]});

// --- Junk ---
def('curse',  {n:'Curse',       c:0, t:'curse', noLv:true, art:'🐈‍⬛', ops:()=>[], unplayable:true});

const MARKET_KEYS=Object.keys(DB).filter(k=>!DB[k].noLv&&k!=='mote');
const ARCANA_KEYS=['mote','crystal','starshard'];

/* Step text: each step is one line on the card, read top to bottom. */
function opText(o){
  const [k,a,b]=o;
  switch(k){
    case 'arc':    return `+${fmt(a)} ${ARC}`;
    case 'alch':   return `+${fmt(a)} ${ARC} per ${MANA} you hold`;
    case 'grow':   return `Worth ${a} more, for good`;
    case 'mana':   return `+${fmt(a)} ${MANA}`;
    case 'lose':   return `−${a} ${MANA}`;
    case 'draw':   return `+${plural(a,'Card')}`;
    case 'cycle':  return `Discard any cards, draw that many${a?` +${a}`:''}`;
    case 'double': return a===2?`Double your ${MANA}`:`${MANA} ×${a}`;
    case 'echo':   return a===1?'Your next card resolves twice':`Your next card resolves ${a+1} times`;
    case 'trash':  return `Banish up to ${a} cards from your hand`;
    case 'dmg':    return b?`Deal ${fmt(a)}, ${b} times`:`Deal ${fmt(a)}`;
    case 'chain':  return `Deal ${fmt(a)} per spell already cast this turn`;
    case 'burn':   return `Burn ${fmt(a)}`;
    case 'vuln':   return `Foe takes +${a}% damage this turn`;
    case 'empower':return `Your next spell hits ×${a}`;
    case 'nova':   return `Deal ${fmt(a)} per ${MANA}, then ${MANA} drops to 1`;
    case 'exhaust':return 'Once per fight';
    case 'focus':  return `Every hit deals +${fmt(a)} this fight`;
    case 'manarune':return `+${a} ${MANA} at the start of each turn this fight`;
  }
  return k;
}
// Plain-words help for the inspector.
const OP_HELP={
  dmg:`Damage is multiplied by the ${MANA} you hold when it lands.`,
  burn:`Burn is multiplied by your ${MANA} once, when applied. The foe takes all its Burn at the end of each of your turns, for the rest of the fight.`,
  nova:`Counts your ${MANA} twice: once in the card, once as the multiplier.`,
  chain:'A spell is any card that deals damage or Burn.',
  focus:`Added to each hit before the ${MANA} multiplier.`,
  echo:`The echoed card is paid for once.`,
};

/* ==========================================================
   RELICS — rule-benders drafted after Elites and Bosses.
   ========================================================== */
const RELICS={
  robes:   {n:'Wide Sleeves',  art:'🧥', r:'common',  tx:'+1 card in every hand you draw.'},
  crystalball:{n:'Mana Crystal',art:'🔮',r:'common',  tx:`+1 ${MANA} at the start of every turn.`},
  coin:    {n:"Alchemist's Coin",art:'🪙',r:'common', tx:`Arcana cards give +1 ${ARC}.`},
  lens:    {n:'Focusing Lens', art:'🔍', r:'common',  tx:'Every hit deals +2.'},
  trophy:  {n:'Trophy Skull',  art:'💀', r:'common',  tx:`Each turn left when a foe falls pays double ${ARC}.`},
  quill:   {n:"Scholar's Quill",art:'🪶',r:'common',  tx:`+1 ${ARC} at the start of each turn for every 5 cards in your deck.`},
  ember:   {n:'Ember Heart',   art:'❤️‍🔥',r:'uncommon',tx:'Burn you apply is doubled.'},
  battery: {n:'Leyden Jar',    art:'🫙', r:'uncommon',tx:`Half your unspent ${MANA} carries over to your next turn.`},
  overflow:{n:'Overflow Sigil',art:'🌊', r:'uncommon',tx:`At the end of your turn, deal 3 for each unspent ${MANA} (multiplied by ${MANA} as usual).`},
  twin:    {n:'Twin Wand',     art:'🪄', r:'uncommon',tx:'The first card you play each turn resolves twice.'},
  familiar:{n:"Owl's Eye",     art:'🦉', r:'uncommon',tx:'The first spell you cast each turn hits ×2.'},
  ascetic: {n:"Ascetic's Bead",art:'📿', r:'uncommon',tx:'While your deck is 12 cards or fewer, damage ×2.'},
  hourglass:{n:'Hourglass',    art:'⏳', r:'uncommon',tx:'Fights last 6 turns, not 5.'},
  crescendo:{n:'Crescendo',    art:'🎼', r:'uncommon',tx:'Every hit deals +1 for each card already played this turn.'},
  stone:   {n:"Philosopher's Stone",art:'🗿',r:'rare', tx:`Arcana cards give ×2 ${ARC}.`},
  glass:   {n:'Glass Wand',    art:'🥂', r:'rare',    tx:'Damage ×3 — but fights last one turn less.'},
  staff:   {n:'Archmage Staff',art:'🦯', r:'rare',    tx:`Mana cards give +1 ${MANA} more.`},
  vintage: {n:'Old Grimoire',  art:'📜', r:'rare',    tx:'Damage ×(1 + 0.5 per Boss beaten while you hold it).'},
};
const RARITY={common:60,uncommon:30,rare:10};

/* ==========================================================
   FOES. Minions and Elites are plain health bars; Bosses bend
   a rule for their fight.
   ========================================================== */
const MINIONS=[
  {n:'Goblin Hexer',art:'👺'},{n:'Will-o-Wisp',art:'🔥'},{n:'Skeleton',art:'💀'},{n:'Bog Slime',art:'🟢'},
  {n:'Imp',art:'😈'},{n:'Giant Rat',art:'🐀'},{n:'Cultist',art:'🧟'},{n:'Gargoyle',art:'🗿'},
];
const ELITES=[
  {n:'Ogre Mage',art:'👹'},{n:'Wyvern',art:'🐲'},{n:'Golem',art:'🪨'},{n:'Banshee',art:'👻'},
];
const BOSSES={
  witch:  {n:'Bog Witch',    art:'🧙', tx:'At the start of each of your turns, 2 Curses are shuffled into your draw pile.'},
  ogre:   {n:'Ogre King',    art:'👑', tx:'You draw 1 fewer card each turn.'},
  queen:  {n:'Snow Queen',   art:'🧊', tx:'Your 2 finest cards are frozen in ice for this fight.'},
  worm:   {n:'Bookworm',     art:'🐛', tx:'Cards your spells would draw are eaten (the first 4 each turn).'},
  rift:   {n:'Null Rift',    art:'🌌', tx:`Your ${MANA} can never rise above 8.`},
  pirate: {n:'Pirate Lich',  art:'🏴‍☠️', tx:`Plunders half your ${ARC} when the fight starts, and the market is closed.`},
  wraith: {n:'Wraith',       art:'👻', tx:'The first hit each turn passes through it.'},
  dragon: {n:'Ancient Dragon',art:'🐉',tx:'Heals 20% of its health at the end of each of your turns.'},
  goblin: {n:'Goblin Thief', art:'🦹', tx:`Steals a quarter of your ${ARC} at the start of each turn.`},
  toll:   {n:'Toll Golem',   art:'🗿', tx:'At the start of each turn, discard 2 cards of your choice.'},
  heavy:  {n:'Iron Bureaucrat',art:'📜',tx:`Every card costs 2 ${MANA} to play.`},
  mirror: {n:'Mirror Knight',art:'🪞', tx:'Hits for less than a fifth of its health do nothing.'},
};
const BOSS_KEYS=Object.keys(BOSSES);
