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

const MANA='✦';

const TUNE = {
  handSize:5, startMana:3, turns:5,
  hearts:3, relicSlots:5,
  carry:0.5,                                 // share of unspent Mana kept into the next turn (rounded down)
  fightsPerCircle:3,                         // minion, elite, boss
  circles:8,                                 // beat the 8th boss to win; endless after
  hp0:40,                                    // the first minion's health
  growth:1.7,                                // health ×growth each fight
  hpGrowth: f => Math.pow(TUNE.growth, f),   // f = fights before this one
  eliteHp:1.5, bossHp:2.2,
  maxTier: c => c-1,                         // reward cards climb one tier a circle
  rewardCards:3,
  raiseOn:['elite','boss'],         // which wins offer "raise a card a tier" instead of a new card
  rarity: { minion:{common:62,uncommon:31,rare:7}, elite:{common:35,uncommon:50,rare:15}, boss:{common:0,uncommon:60,rare:40} },
};

/* ==========================================================
   CARDS. Each card is a list of steps that resolve top to
   bottom (ops). lv is the card's tier: Firebolt, Firebolt+…
   r is its rarity, which sets how often rewards offer it.
   ========================================================== */
const DB={};
function def(k,o){ DB[k]=Object.assign({key:k,step:3,t:'spell',r:'common'},o); }
const plus = lv => lv<=0 ? '' : lv<=3 ? '+'.repeat(lv) : `+${lv}`;
// How hard a card hits at a tier: 1,2,3,4,5,8,11,17,26,38… Its worth (for bots) follows the same curve.
const tierMult = lv => Math.max(1+lv, Math.round(Math.pow(1.5,lv)));

/* Card types: mana (gain Mana / draw), spell (damage), rune (lasts the fight), curse. */
// --- Mana and draw ---
// The starting cards (Zap, Channel, Ponder) grow much faster when raised than other cards, so raising them is a real choice.
def('channel',{n:'Channel',     c:2, t:'mana', art:'🌀', step:8, ops:l=>[['mana',2+3*l]]});
def('leyline',{n:'Ley Line',    c:3, t:'mana', art:'〰', ops:l=>[['draw',1],['mana',2+l]]});
def('ponder', {n:'Ponder',      c:2, t:'mana', art:'💭', step:8, ops:l=>[['mana',1+l],['draw',1+l]]});
def('study',  {n:'Study',       c:4, t:'mana', art:'📖', ops:l=>[['draw',3+l]]});
def('reshuffle',{n:'Clear Mind',c:2, t:'mana', art:'🍃', ops:l=>[['mana',1],['cycle',l]]});
def('banish', {n:'Banish',      c:2, t:'mana', art:'🕳', ops:l=>[['trash',2+l]]});
def('wellspring',{n:'Wellspring',c:5,t:'mana', art:'⛲', r:'uncommon', ops:l=>[['mana',4+2*l]]});
def('familiar',{n:'Familiar',   c:5, t:'mana', art:'🦉', r:'uncommon', ops:l=>[['draw',2+Math.floor(l/2)],['mana',1+Math.ceil(l/2)]]});
def('echo',   {n:'Twincast',    c:5, t:'mana', art:'👥', r:'uncommon', ops:l=>[['mana',1],['echo',1+l]]});
def('amplify',{n:'Amplify',     c:8, t:'mana', art:'🔆', r:'rare', ops:l=>l?[['mana',2*l],['double',2]]:[['double',2]]});

// --- Damage ---
def('zap',    {n:'Zap',         c:1, t:'spell', art:'⚡', r:'basic', step:12, ops:l=>l?[['mana',2],['dmg',5*tierMult(l)]]:[['dmg',3]]});
def('firebolt',{n:'Firebolt',   c:3, t:'spell', art:'🔥', ops:l=>[['dmg',7*tierMult(l)]]});
def('missiles',{n:'Magic Missiles',c:4,t:'spell',art:'✴', ops:l=>[['dmg',3*tierMult(l),3]]});
def('frostbolt',{n:'Frostbolt', c:3, t:'spell', art:'❄', ops:l=>[['dmg',5*tierMult(l)],['draw',1]]});
def('siphon', {n:'Siphon',      c:3, t:'spell', art:'🩸', ops:l=>[['dmg',4*tierMult(l)],['mana',1]]});
def('ignite', {n:'Ignite',      c:4, t:'spell', art:'🕯', ops:l=>[['burn',tierMult(l)]]});
def('surge',  {n:'Surge',       c:5, t:'spell', art:'🌩', r:'uncommon', ops:l=>[['mana',3],['dmg',6*tierMult(l)]]});
def('wild',   {n:'Wild Magic',  c:4, t:'spell', art:'🎇', r:'uncommon', ops:l=>[['dmg',12*tierMult(l)],['mana',3]]});
def('fireball',{n:'Fireball',   c:6, t:'spell', art:'☄', r:'uncommon', ops:l=>[['dmg',22*tierMult(l)],['lose',2]]});
def('chain',  {n:'Chain Lightning',c:5,t:'spell',art:'⛓', r:'uncommon', ops:l=>[['chain',5*tierMult(l)]]});
def('storm',  {n:'Spellstorm',  c:5, t:'spell', art:'🌪', r:'uncommon', ops:l=>[['handdmg',3*tierMult(l)]]});
def('conflag',{n:'Conflagrate', c:5, t:'spell', art:'🌋', r:'uncommon', ops:l=>[['burndmg',1+l]]});
def('hex',    {n:'Hex',         c:4, t:'spell', art:'🧿', r:'uncommon', ops:l=>[['vuln',50+25*l],['mana',1]]});
def('empower',{n:'Empower',     c:4, t:'spell', art:'💪', r:'uncommon', ops:l=>[['mana',1+l],['empower',2]]});
def('cataclysm',{n:'Cataclysm', c:8, t:'spell', art:'💥', r:'rare', ops:l=>[['nova',2*tierMult(l)]]});
def('wither', {n:'Wither',      c:5, t:'spell', art:'🥀', r:'uncommon', ops:l=>[['pct',0.5+0.25*l]]});
def('meteor', {n:'Meteor',      c:7, t:'spell', art:'🌠', r:'rare', ops:l=>[['dmg',45*tierMult(l)],['exhaust']]});

// --- Runes: stay out for the rest of the fight ---
def('focus',  {n:'Focus Rune',  c:5, t:'rune', art:'🔷', r:'uncommon', ops:l=>[['focus',2*tierMult(l)]]});
def('wellrune',{n:'Mana Rune',  c:6, t:'rune', art:'🔶', r:'rare', ops:l=>[['manarune',1+l]]});

// --- Junk ---
// Curses (from the Bog Witch) can be dispelled for 1 Mana, and all vanish when the fight ends.
def('curse',  {n:'Curse',       c:0, t:'curse', r:'junk', noLv:true, art:'🐈‍⬛', ops:()=>[['dispel'],['draw',1]]});

const POOL={common:[],uncommon:[],rare:[]};
for(const k in DB){ const r=DB[k].r; if(POOL[r]) POOL[r].push(k); }

/* Step text: each step is one line on the card, read top to bottom. */
function opText(o){
  const [k,a,b]=o;
  switch(k){
    case 'mana':   return `+${fmt(a)} ${MANA}`;
    case 'lose':   return `−${a} ${MANA}`;
    case 'draw':   return `+${plural(a,'Card')}`;
    case 'cycle':  return `Discard any cards, draw that many${a?` +${a}`:''}`;
    case 'double': return a===2?`Double your ${MANA}`:`${MANA} ×${a}`;
    case 'echo':   return a===1?'Your next card resolves twice':`Your next card resolves ${a+1} times`;
    case 'trash':  return `Banish up to ${a} cards from your hand`;
    case 'dmg':    return b?`Deal ${fmt(a)}, ${b} times`:`Deal ${fmt(a)}`;
    case 'chain':  return `Deal ${fmt(a)} once for each card already played this turn`;
    case 'handdmg':return `Deal ${fmt(a)} per other card in your hand`;
    case 'burndmg':return a===1?"Deal damage equal to the foe's Burn":`Deal ${a}× the foe's Burn`;
    case 'burn':   return `Burn ${fmt(a)}`;
    case 'pct':    return `Deal ${a}% of the foe's current health per ${MANA}`;
    case 'dispel': return 'Dispel this Curse';
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
  chain:'Every card counts, Mana cards too. Each hit is separate: the Wraith stops only the first, and the Mirror Knight counts them together.',
  focus:`Added to each hit before the ${MANA} multiplier.`,
  pct:`Your ${MANA} sets the percentage instead of multiplying the damage: at 4 ${MANA}, 0.5% per ${MANA} is 2% of the foe's current health. Other multipliers (Empower, Hex, relics) still apply; Focus and +damage don't.`,
  dispel:`Curses vanish when the fight ends.`,
  echo:`The echoed card is paid for once. Echoes don't stack: a second Twincast only keeps the larger one.`,
  burndmg:`Multiplied by your ${MANA} like any hit.`,
};

/* ==========================================================
   RELICS — rule-benders drafted after Elites and Bosses.
   ========================================================== */
const RELICS={
  robes:   {n:'Wide Sleeves',  art:'🧥', r:'common',  tx:'+1 card in every hand you draw.'},
  crystalball:{n:'Mana Crystal',art:'🔮',r:'common',  tx:`+1 ${MANA} at the start of every turn.`},
  clasp:   {n:'Silver Clasp',  art:'📎', r:'common',  tx:'Card rewards offer 4 cards, not 3.'},
  lens:    {n:'Focusing Lens', art:'🔍', r:'common',  tx:'Every hit deals +2.'},
  haste:   {n:'Quicksilver',   art:'☿', r:'common',  tx:`+2 ${MANA} on the first turn of every fight.`},
  quill:   {n:"Scholar's Quill",art:'🪶',r:'uncommon',tx:'Reward cards come one tier higher.'},
  ember:   {n:'Ember Heart',   art:'❤️‍🔥',r:'uncommon',tx:'Burn you apply is doubled.'},
  battery: {n:'Leyden Jar',    art:'🫙', r:'uncommon',tx:`Half your unspent ${MANA} carries over to your next turn.`},
  overflow:{n:'Overflow Sigil',art:'🌊', r:'uncommon',tx:`At the end of your turn, deal 3 for each unspent ${MANA} (multiplied by ${MANA} as usual).`},
  twin:    {n:'Twin Wand',     art:'🪄', r:'uncommon',tx:'The first card you play each turn resolves twice.'},
  familiar:{n:"Owl's Eye",     art:'🦉', r:'uncommon',tx:'The first spell you cast each turn hits ×2.'},
  ascetic: {n:"Ascetic's Bead",art:'📿', r:'uncommon',tx:'While your deck is 12 cards or fewer, damage ×2.'},
  hourglass:{n:'Hourglass',    art:'⏳', r:'uncommon',tx:'Fights last 6 turns, not 5.'},
  crescendo:{n:'Crescendo',    art:'🎼', r:'uncommon',tx:'Every hit deals +1 for each card already played this turn.'},
  stone:   {n:"Philosopher's Stone",art:'🗿',r:'rare', tx:'Your Sanctum rite happens twice.'},
  glass:   {n:'Glass Wand',    art:'🥂', r:'rare',    tx:'Damage ×3 — but fights last one turn less.'},
  staff:   {n:'Archmage Staff',art:'🦯', r:'rare',    tx:`Mana cards give +1 ${MANA} more.`},
  vintage: {n:'Old Grimoire',  art:'📜', r:'rare',    tx:'Damage ×(1 + 0.5 per Boss beaten while you hold it).'},
};
const RARITY={common:60,uncommon:30,rare:10};

/* ==========================================================
   FOES. Minions and Elites are plain health bars; Bosses bend
   a rule for their fight. hp scales a Boss's health, to even
   out how hard their rules are.
   ========================================================== */
const MINIONS=[
  {n:'Goblin Hexer',art:'👺'},{n:'Will-o-Wisp',art:'🔥'},{n:'Skeleton',art:'💀'},{n:'Bog Slime',art:'🟢'},
  {n:'Imp',art:'😈'},{n:'Giant Rat',art:'🐀'},{n:'Cultist',art:'🧟'},{n:'Gargoyle',art:'🗿'},
];
const ELITES=[
  {n:'Ogre Mage',art:'👹'},{n:'Wyvern',art:'🐲'},{n:'Golem',art:'🪨'},{n:'Banshee',art:'👻'},
];
const BOSSES={
  witch:  {n:'Bog Witch',    art:'🧙', tx:`At the start of each of your turns, 2 Curses are shuffled into your draw pile. Play one for 1 ${MANA} to dispel it and draw a card; they all vanish when the fight ends.`},
  ogre:   {n:'Ogre King',    art:'👑', tx:'You draw 1 fewer card each turn.'},
  queen:  {n:'Snow Queen',   art:'🧊', tx:'Your finest card is frozen in ice for this fight.'},
  worm:   {n:'Bookworm',     art:'🐛', tx:'Cards your spells would draw are eaten (the first 4 each turn).', hp:1.15},
  rift:   {n:'Null Rift',    art:'🌌', tx:`Your ${MANA} can never rise above 10 per circle.`, txc:c=>`Your ${MANA} can never rise above ${10*c}.`},
  djinn:  {n:'Time Djinn',   art:'🧞', tx:'You have 3 turns, not 5.', hp:0.8},
  wraith: {n:'Wraith',       art:'👻', tx:'The first hit each turn passes through it (of a multi-hit spell, only the first hit).'},
  dragon: {n:'Ancient Dragon',art:'🐉',tx:'Heals 20% of its health at the end of each of your turns.'},
  goblin: {n:'Goblin Thief', art:'🦹', tx:'At the start of each turn, steals a random card from your draw pile until the fight ends.'},
  toll:   {n:'Toll Golem',   art:'🗿', tx:'At the start of each turn, discard 2 cards of your choice.'},
  heavy:  {n:'Iron Bureaucrat',art:'📜',tx:`Every card costs 2 ${MANA} to play.`},
  mirror: {n:'Mirror Knight',art:'🪞', tx:'Spells dealing less than a fifth of its health do nothing (a multi-hit spell counts all its hits together).', hp:1.15},
};
const BOSS_KEYS=Object.keys(BOSSES);
const bossTx = (k,c) => BOSSES[k].txc ? BOSSES[k].txc(c) : BOSSES[k].tx;
