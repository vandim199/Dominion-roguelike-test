"use strict";
/* ==========================================================
   Coinkeep — static data: tuning, cards, charms, threats.
   ========================================================== */

const rnd  = n => Math.floor(Math.random()*n);
const pick = a => a[rnd(a.length)];
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function wpick(pairs){ const tot=pairs.reduce((s,p)=>s+p[1],0); let r=Math.random()*tot;
  for(const [k,w] of pairs){ if(r<w) return k; r-=w; } return pairs[pairs.length-1][0]; }
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const plural = (n,w,p) => `${n} ${n===1?w:(p||w+'s')}`;

const TUNE = {
  slots:3, handSize:5, jokerSlots:5, marketSize:6,
  threatsInWave: w => Math.min(8, 2+Math.floor(w/2)),
  spawnEvery:    w => w<9 ? 3 : 2,          // a queued threat arrives every Nth turn of a wave
  eliteEvery:3,                             // every Nth wave ends with an Elite
  enrageAfter:8,                            // threats standing this many turns attack every turn
  coinScale:  w => Math.pow(1.4, w-1),      // coin demands grow exponentially
  actScale:   w => Math.pow(1.2, w-1),      // action demands too, a little slower
  buyScale:   w => Math.pow(1.15, w-1),     // and buy demands slower still
  countScale: w => 1 + 0.22*(w-1),          // card counts (discards, draws) grow linearly: hands don't
  maxTier:    w => Math.floor(0.8*(w-1)),   // market tier climbs ~4 tiers every 5 waves
  forgeCap:   w => Math.floor(0.8*(w-1))+1, // Forge can't push a Treasure past market tier +1
  coffinFrom: 5,                            // from this wave on, Elites seal your finest card in ice
  hearts:5,                                 // splice mode: detonations cost hearts; lose at 0
  spliceSlots: c => 2+Math.floor(c.lv/2),   // keywords a card can hold (scars ignore the limit)
};

/* ==========================================================
   CARDS — every card has tiers. Tea House, Tea House+, Tea House++…
   fx(self, lv) runs the card at its tier. tx(lv, card) is its text.
   ========================================================== */
const DB={};
function def(k,o){ DB[k]=Object.assign({key:k,step:3},o); }
const plus = lv => lv<=0 ? '' : lv<=3 ? '+'.repeat(lv) : `+${lv}`;
// How hard a card hits at a tier: linear at first, then x1.5 a tier: 1,2,3,4,5,8,11,17,26,38...
// Prices follow the same curve, so a Tea House that gives 20 Actions costs what it should.
const tierMult = lv => Math.max(1+lv, Math.round(Math.pow(1.5,lv)));
const tierName = lv => lv<=0 ? 'base' : plus(lv);

def('copper',{n:'Copper',c:0,step:2,t:'treasure',v:1,art:'🟤'});
def('silver',{n:'Silver',c:3,step:4,t:'treasure',v:2,art:'⚪'});
def('gold',  {n:'Gold',  c:6,step:5,t:'treasure',v:3,art:'🟡'});
def('treasury',{n:'Treasury',c:7,step:4,t:'treasure',kingdom:true,art:'🏦',
  tx:l=>`+${tierMult(l)} Coin for each Treasure you have in play, counting this.`});
def('nestegg',{n:'Nest Egg',c:4,step:3,t:'treasure',v:1,kingdom:true,art:'🥚',
  tx:(l,c)=>`+${tierMult(l)+((c&&c.grow)||0)} Coin. Worth 1 more, for good, every time you play it.`});

def('shack', {n:'Shack', c:2,t:'victory',noLv:true,art:'🛖',tx:'Dead weight. Trash it or feed it to a threat.'});
def('jinx',  {n:'Jinx',  c:0,t:'curse',  noLv:true,art:'🐈‍⬛',tx:'Bad luck. Cannot be played.'});
def('rubble',{n:'Rubble',c:0,t:'junk',   noLv:true,art:'🧱',tx:'Left behind by a threat. Spend 1 Action to haul it away for good.'});
const isJunk = c => !!DB[c.key].noLv;

const A = n => { if(G.phase==='attack') G.next.actions+=n; else G.actions+=n; };
const B = n => { if(G.phase==='attack') G.next.buys+=n;    else G.buys+=n; };
const C = n => { if(G.phase==='attack') G.next.coin+=n;    else G.coin+=n; };

/* --- draw & actions --- */
def('teahouse',{n:'Tea House',c:3,art:'🍵',t:'action',
  tx:l=>`+${plural(1+l,'Card')}, +${2*tierMult(l)} Actions.`,
  fx:async(s,l)=>{ draw(1+l); A(2*tierMult(l)); }});
def('maproom',{n:'Map Room',c:4,art:'🗺',t:'action',
  tx:l=>`+${3+2*l} Cards.`,
  fx:async(s,l)=>{ draw(3+2*l); }});
def('inventor',{n:'Inventor',c:5,art:'💡',t:'action',
  tx:l=>`+${2+l} Cards, +1 Action.`,
  fx:async(s,l)=>{ draw(2+l); A(1); }});
def('parade',{n:'Parade',c:5,art:'🎉',t:'action',
  tx:l=>`+${1+tierMult(l)} Actions, +${plural(1+Math.floor(l/2),'Buy')}, +${2*tierMult(l)} Coin.`,
  fx:async(s,l)=>{ A(1+tierMult(l)); B(1+Math.floor(l/2)); C(2*tierMult(l)); }});

/* --- deck control --- */
def('springclean',{n:'Spring Clean',c:2,step:2,art:'🧺',t:'action',
  tx:l=>`+1 Action. Discard any number of cards, then draw that many${l?` +${l}`:''}.`,
  fx:async(s,l)=>{ A(1);
    const ch=await chooseCards(G.hand,{min:0,max:99,why:s.key,title:cname(s),sub:`Discard any number, then draw that many${l?` plus ${l}`:''}.`});
    ch.forEach(c=>{pull(G.hand,c);G.discard.push(c);}); draw(ch.length+l); }});
def('bonfire',{n:'Bonfire',c:2,step:2,art:'🔥',t:'action',
  tx:l=>`Trash up to ${4+2*l} cards from your hand.`,
  fx:async(s,l)=>{ const ch=await chooseCards(G.hand,{min:0,max:4+2*l,why:s.key,title:cname(s),sub:`Burn up to ${4+2*l} cards.`});
    ch.forEach(c=>{pull(G.hand,c);trashCard(c);}); }});
def('strategist',{n:'Strategist',c:2,art:'♟',t:'action',
  tx:l=>`+${3+l} Cards. Put a card from your hand on top of your deck.`,
  fx:async(s,l)=>{ draw(3+l);
    const ch=await chooseCards(G.hand,{min:1,max:1,why:s.key,title:cname(s),sub:'Put one card back on top of your deck.'});
    if(ch[0]){pull(G.hand,ch[0]);G.deck.unshift(ch[0]);} }});
def('encore',{n:'Encore',c:4,step:4,art:'🎭',t:'action',
  tx:l=>`Play an Action from your hand ${['twice','three times','four times'][l]||(2+l)+' times'}.`,
  fx:async(s,l)=>{ const cand=G.hand.filter(c=>c.t==='action'&&!isFrozen(c));
    if(!cand.length){log('No Action to encore.');return;}
    const n=2+l+(hasJ('ovation')?1:0);
    const ch=await chooseCards(cand,{min:1,max:1,why:s.key,title:cname(s),sub:`Play this Action ${n} times.`});
    const c=ch[0]; if(!c)return; pull(G.hand,c); G.inPlay.push(c);
    for(let i=0;i<n;i++){ await runAction(c); render(); } }});
def('dowser',{n:'Dowser',c:4,art:'🪄',t:'action',
  tx:l=>`Reveal cards from your deck until you find ${plural(2+l,'Treasure')}. Put them in your hand, discard the rest.`,
  fx:async(s,l)=>{ const found=[], rest=[]; let g=0;
    while(found.length<2+l&&g++<80){ const c=popDeck(); if(!c)break; (c.t==='treasure'?found:rest).push(c); }
    G.hand.push(...found); G.discard.push(...rest);
    log(`${cname(s)} finds ${found.length?found.map(cname).join(', '):'nothing'}.`,'hl'); }});

/* --- economy --- */
def('crucible',{n:'Crucible',c:4,step:4,art:'⚗',t:'action',
  tx:l=>`Trash up to ${plural(1+l,'Treasure')} from your hand. +Coin equal to triple each one's value.`,
  fx:async(s,l)=>{ const tr=G.hand.filter(c=>c.t==='treasure'&&!isFrozen(c));
    if(!tr.length){log('Nothing to melt.');return;}
    const ex=hasJ('stone')?6:3;
    const ch=await chooseCards(tr,{min:0,max:1+l,why:s.key,title:cname(s),
      sub:`Melt up to ${1+l}. Each pays ${ex}× its value.`,badge:c=>'→ '+tval(c)*ex});
    for(const c of ch){ const v=tval(c), g=v*ex;
      pull(G.hand,c); trashCard(c,true); C(g);
      log(`${cname(s)} melts ${cname(c)} (${v}) into ${g} coin!`,'big'); } }});
def('forge',{n:'Forge',c:5,step:4,art:'⚒',t:'action',
  tx:l=>`Trash a Treasure from your hand. Gain one ${plural(1+l,'step')} better into your hand (Copper → Silver → Gold → Gold+), up to tier ${G?tierName(TUNE.forgeCap(G.wave)):'market +1'}.`,
  fx:async(s,l)=>{ const cap=TUNE.forgeCap(G.wave);
    const up=c=>{ let [k,v]=[c.key,c.lv]; for(let i=0;i<=l;i++){ const n=upTreasure(k,v); if(n[1]>Math.max(cap,c.lv)) break; [k,v]=n; } return [k,v]; };
    const tr=G.hand.filter(c=>c.t==='treasure'&&!isFrozen(c)&&up(c).join()!==[c.key,c.lv].join());
    if(!tr.length){log(`No Treasure to forge. The anvil can't go past tier ${tierName(cap)} this wave.`);return;}
    const ch=await chooseCards(tr,{min:1,max:1,why:s.key,title:cname(s),sub:`Upgrade it ${plural(1+l,'step')}.`,
      badge:c=>{ const [k,v]=up(c); return DB[k].n+plus(v); }});
    const c=ch[0]; if(!c)return;
    const [k,v]=up(c);
    pull(G.hand,c); trashCard(c,true);
    const g=mk(k,v); g.mods=c.mods.slice(); if(c.grow) g.grow=c.grow;
    G.hand.push(g); log(`${cname(s)} turns ${cname(c)} into ${cname(g)}.`,'hl'); }});
def('coinpress',{n:'Coin Press',c:5,step:4,art:'🏭',t:'action',
  tx:l=>`Choose a Treasure in your hand. Gain ${l?`${1+l} plain copies`:'a plain copy'} of it (no splices) into your discard pile.`,
  fx:async(s,l)=>{ const tr=G.hand.filter(c=>c.t==='treasure'&&!isFrozen(c));
    if(!tr.length){log('No Treasure to press.');return;}
    const ch=await chooseCards(tr,{min:1,max:1,why:s.key,title:cname(s),sub:`Gain ${l?`${1+l} copies`:'a copy'} of it.`});
    const c=ch[0]; if(!c)return;
    for(let i=0;i<1+l;i++) G.discard.push(mk(c.key,c.lv));
    log(`${cname(s)} strikes ${plural(1+l,'new '+cname(c),'new '+cname(c)+'s')}.`,'hl'); }});
def('bargain',{n:'Bargain Day',c:4,art:'🏷',t:'action',
  tx:l=>`+${plural(1+l,'Buy')}, +${tierMult(l)} Coin. Market cards cost ${2*tierMult(l)} less this turn.`,
  fx:async(s,l)=>{ B(1+l); C(tierMult(l)); G.discount+=2*tierMult(l); }});
def('ringleader',{n:'Ringleader',c:4,art:'🎩',t:'action',
  tx:l=>`+${2*tierMult(l)} Coin. If you've played 3+ Actions this turn: +1 Card, +1 Action.`,
  fx:async(s,l)=>{ C(2*tierMult(l)); if(G.actionsPlayed>=3){draw(1);A(1);} }});
def('orchard',{n:'Orchard',c:4,art:'🍎',t:'action',
  tx:l=>`+1 Coin. At the start of your next turn, +${3*tierMult(l)} Coin.`,
  fx:async(s,l)=>{ C(1); G.later.coin+=3*tierMult(l); }});
def('pawnshop',{n:'Pawnshop',c:3,art:'💍',t:'action',
  tx:l=>`Trash a card from your hand. +Coin equal to its cost${l?` +${1+l}`:' +1'}.`,
  fx:async(s,l)=>{ if(!G.hand.length) return;
    const ch=await chooseCards(G.hand,{min:0,max:1,why:s.key,title:cname(s),sub:'Pawn one card for good.',badge:c=>'→ '+(baseCost(c)+1+l)});
    const c=ch[0]; if(!c) return; const g=baseCost(c)+1+l;
    pull(G.hand,c); trashCard(c,true); C(g); log(`${cname(s)} pays ${g} for ${cname(c)}.`,'hl'); }});
def('ragpicker',{n:'Ragpicker',c:2,step:2,art:'🦝',t:'action',
  tx:l=>`+1 Action. Trash any number of junk cards (Shack, Jinx, Rubble) from your hand. +${2+l} Coin each.`,
  fx:async(s,l)=>{ A(1); const j=G.hand.filter(isJunk); if(!j.length){log('No junk to pick.');return;}
    const ch=await chooseCards(j,{min:0,max:99,why:s.key,title:cname(s),sub:`Each one trashed pays ${2+l} Coin.`});
    ch.forEach(c=>{pull(G.hand,c);trashCard(c,true);}); C(ch.length*(2+l));
    if(ch.length) log(`${cname(s)} hauls off ${plural(ch.length,'piece')} of junk for ${ch.length*(2+l)} coin.`,'hl'); }});

/* --- threat-fighters: act on the board directly --- */
const strikePct = (base,l) => base+(base>=50?15:10)*l;
def('archer',{n:'Archer',c:4,art:'🏹',t:'action',
  tx:l=>`+1 Action. Strike a threat for ${strikePct(30,l)}% of what it still wants.`,
  fx:async(s,l)=>{ A(1); const t=await chooseThreat(cname(s),`Strike for ${strikePct(30,l)}%.`);
    if(t){ log(`${cname(s)} looses an arrow at ${t.n}.`,'hl'); strike(t,strikePct(30,l)/100); } }});
def('powderkeg',{n:'Powder Keg',c:4,art:'💣',t:'action',
  tx:l=>`Trash this. Strike a threat for ${strikePct(60,l)}% of what it still wants.`,
  fx:async(s,l)=>{ if(pull(G.inPlay,s)) trashCard(s,true);
    const t=await chooseThreat(cname(s),`Blast for ${strikePct(60,l)}%.`);
    if(t){ log(`BOOM! ${cname(s)} rocks ${t.n}.`,'big'); fx('shake'); strike(t,strikePct(60,l)/100); } }});
def('lullaby',{n:'Lullaby',c:3,art:'🎶',t:'action',
  tx:l=>`+1 Card, +1 Action. Every threat attacks ${plural(1+l,'turn')} later.`,
  fx:async(s,l)=>{ draw(1); A(1); G.slots.forEach(t=>{ if(t) t.cd+=1+l; });
    if(G.slots.some(Boolean)) log('The threats yawn and nod off.','good'); }});
def('tollgate',{n:'Toll Gate',c:4,art:'🚧',t:'action',
  tx:l=>`+${2*tierMult(l)} Coin for each threat in play.`,
  fx:async(s,l)=>{ C(2*tierMult(l)*G.slots.filter(Boolean).length); }});

/* --- reactions: answer a threat's attack from your hand --- */
const ripPct = l => 25+10*l;
def('guarddog',{n:'Guard Dog',c:2,step:2,art:'🐕',t:'action',r:true,
  tx:l=>`+${2+l} Cards. ⛨ When a threat attacks, reveal this to block it.`,
  fx:async(s,l)=>{ draw(2+l); }});
def('riposte',{n:'Riposte',c:3,art:'🤺',t:'action',r:true,
  tx:l=>`+${2*tierMult(l)} Coin. ⛨ When a threat attacks, discard this to block it and strike it for ${ripPct(l)}%.`,
  fx:async(s,l)=>{ C(2*tierMult(l)); }});
def('snare',{n:'Snare',c:4,art:'🪤',t:'action',r:true,
  tx:l=>`+${plural(1+l,'Card')}, +1 Action. ⛨ When a threat attacks, trash this to destroy it${l?'':' (not Elites)'}.`,
  fx:async(s,l)=>{ draw(1+l); A(1); }});
def('nightwatch',{n:'Night Watch',c:3,art:'🏮',t:'action',r:true,
  tx:l=>`Draw until you have ${6+l} cards. ⛨ While in hand, Jinxes and Rubble you'd gain are turned away.`,
  fx:async(s,l)=>{ draw(Math.max(0,6+l-G.hand.length)); }});

const KINGDOM=Object.keys(DB).filter(k=>DB[k].t==='action'||DB[k].kingdom);
// Splice mode keeps the market small: depth comes from splicing keywords onto these.
const CORE=['teahouse','maproom','inventor','encore','bonfire','springclean','forge','coinpress','archer','guarddog'];

/* ==========================================================
   SPLICES — keywords grafted onto a card in your deck.
   Clearing a threat in splice mode offers a choice of them;
   a threat that detonates brands a scar onto a card instead.
   once: a card can carry it only one time. only: card type.
   Splices trigger every time the card resolves (Encore, Echo, Twin).
   ========================================================== */
const SPLICES={
  quick: {n:'Quick',   art:'⚡',r:'common',  tx:'+1 Action'},
  draw:  {n:'Drawing', art:'🃏',r:'common',  tx:'+1 Card'},
  trade: {n:'Trading', art:'🛒',r:'common',  tx:'+1 Buy'},
  coin:  {n:'Gilded',  art:'🪙',r:'common',  tx:c=>c?`+${tierMult(c.lv)} Coin`:'+1 Coin (more on upgraded cards)'},
  strike:{n:'Barbed',  art:'🏹',r:'uncommon',tx:'Strike the most urgent threat for 15%'},
  grow:  {n:'Sprouting',art:'🌱',r:'uncommon',tx:c=>`+${(c&&c.grow)||0} Coin, 1 more each time it is played`},
  guard: {n:'Guarded', art:'🛡',r:'uncommon',once:true,tx:'⛨ When a threat attacks, discard this from your hand to block it'},
  free:  {n:'Nimble',  art:'🍃',r:'rare',once:true,only:'action',tx:'Costs no Action to play'},
  twin:  {n:'Twin',    art:'👯',r:'rare',once:true,tx:'Resolves twice when played'},
  retain:{n:'Sticky',  art:'📌',r:'rare',once:true,tx:'Stays in your hand at end of turn'},
  rust:  {n:'Rusty',   art:'🦠',scar:true,tx:c=>`−${c?tierMult(c.lv):1} Coin when played`},
  heavy: {n:'Heavy',   art:'🪨',scar:true,once:true,tx:'Costs an extra Action to play'},
  brittle:{n:'Brittle',art:'💔',scar:true,once:true,tx:'Trashed after you play it'},
};
const SCARS=Object.keys(SPLICES).filter(k=>SPLICES[k].scar);
const spliceText = (k,c) => { const t=SPLICES[k].tx; return typeof t==='function'?t(c):t; };

function clone(c){ const g=mk(c.key,c.lv); g.mods=c.mods.slice(); if(c.grow) g.grow=c.grow; return g; }
function upTreasure(k,l){ if(k==='copper')return ['silver',l]; if(k==='silver')return ['gold',l]; return [k,l+1]; }

/* ==========================================================
   CHARMS — rule-benders drafted between waves.
   (Called "jokers" in code: G.jokers, JOKERS, hasJ.)
   ========================================================== */
const JOKERS={
  greedy:  {n:'Greedy Hands',art:'🖐',r:'common',tx:'+1 card in every hand you draw.'},
  wind:    {n:'Second Wind',art:'💨',r:'common',tx:'+1 Action at the start of each turn.'},
  seal:    {n:"Merchant's Seal",art:'🛒',r:'common',tx:'+1 Buy each turn. Market cards cost 1 less.'},
  gilded:  {n:'Gilded Copper',art:'🪙',r:'common',tx:'Copper produces +2 Coin.'},
  piggy:   {n:'Piggy Bank',art:'🐷',r:'common',tx:'Half your unspent Coin carries over to next turn.'},
  scrapper:{n:'Scrapper',art:'♻',r:'common',tx:'Whenever a card is trashed, +2 Coin.'},
  bounty:  {n:'Bounty Hunter',art:'🎯',r:'common',tx:'Clearing a threat gives +1 Card, +1 Action and +2 Coin.'},
  tidy:    {n:'Tidy Mind',art:'🧹',r:'common',tx:'Hauling Rubble costs no Action and draws a card.'},
  eagle:   {n:'Eagle Eye',art:'🦅',r:'common',tx:'Every strike against a threat hits 15% harder.'},
  momentum:{n:'Momentum',art:'🌀',r:'uncommon',tx:'Each Action you play gives +1 Coin for every Action already played this turn.'},
  midas:   {n:'Midas Touch',art:'✨',r:'uncommon',tx:'Every Treasure produces +1 Coin.'},
  echo:    {n:'Echo',art:'🔔',r:'uncommon',tx:'The first Action you play each turn resolves twice.'},
  minimal: {n:'Minimalist',art:'📏',r:'uncommon',tx:'While your deck is 15 cards or fewer, Treasures produce ×2 Coin.'},
  hoarder: {n:'Hoarder',art:'🗃',r:'uncommon',tx:'+1 Coin at the start of each turn for every 4 cards in your deck.'},
  wall:    {n:'Iron Wall',art:'🛡',r:'uncommon',tx:'The first attack each turn is blocked automatically.'},
  thorns:  {n:'Thorns',art:'🌵',r:'uncommon',tx:'Whenever you block an attack, strike that threat for 20%.'},
  clerk:   {n:'Head Clerk',art:'🖋',r:'uncommon',tx:'Actions and Buys spent on threats count double.'},
  mirror:  {n:'Mirror',art:'🪞',r:'uncommon',tx:'The first Treasure you play each turn produces twice.'},
  trophy:  {n:'Trophy Wall',art:'🦌',r:'uncommon',tx:'+1 Coin at the start of each turn for every 2 threats cleared this run.'},
  goose:   {n:'Golden Goose',art:'🪿',r:'uncommon',tx:'Nest Eggs grow by 2 each time you play them, not 1.'},
  hourglass:{n:'Hourglass',art:'⏳',r:'uncommon',tx:'Threats attack one turn less often.'},
  mittens: {n:'Warm Mittens',art:'🧤',r:'common',tx:'Your cards cannot be frozen (Ice Coffins still hold).'},
  stone:   {n:"Philosopher's Stone",art:'🔮',r:'rare',tx:'Crucible pays double.'},
  ovation: {n:'Standing Ovation',art:'👏',r:'rare',tx:'Encores play their Action one extra time.'},
  golden:  {n:'Golden Ratio',art:'🏅',r:'rare',tx:'All Treasures produce ×2 Coin.'},
  interest:{n:'Compound Interest',art:'💹',r:'rare',tx:'Coin poured into threats counts double.'},
  glass:   {n:'Glass Crown',art:'🥂',r:'rare',tx:'Treasures produce ×3 Coin — but every threat attacks one turn sooner.'},
  vintage: {n:'Vintage',art:'🍷',r:'rare',tx:'Treasures produce +1 Coin for each wave this charm has been held.'},
};
const RARITY={common:60,uncommon:30,rare:10};

/* ==========================================================
   THREATS — each one demands a resource and attacks on a timer.
   In splice mode the timer is a fuse: when it runs out the threat
   detonates once (its attack, a scar, a lost heart) and leaves.
   ========================================================== */
const THREATS={
  taxman:{fuse:5,n:'Tax Collector',art:'🧾',kind:'prog_coin',need:18,bar:'cash',label:'Progressive — Coin',
    desc:()=>'The crown wants its due. Pour in coin across as many turns as you like.',
    atk:{k:'grow',pct:20,every:3,name:'Late fees'}},
  ogre:{fuse:3,scar:'brittle',n:'Ogre at the Gate',art:'👹',kind:'once_coin',need:10,bar:'cash',label:'One shot — Coin',late:true,
    desc:t=>`It will leave for a fee — the whole ${t.need} coin, in a single turn.`,
    atk:{k:'discard',n:2,every:2,name:'Stomp'}},
  idol:{fuse:3,scar:'brittle',n:'Hungry Idol',art:'🗿',kind:'sacrifice',need:3,bar:'blood',label:'Sacrifice — Cards',
    desc:t=>`Feed it ${t.need} cards from your hand. Rubble is refused. The cards are trashed for good.`,
    atk:{k:'trash',n:1,every:3,name:'Hunger'}},
  redtape:{fuse:5,scar:'heavy',n:'Red Tape',art:'📜',kind:'prog_action',need:5,bar:'act',label:'Progressive — Actions',
    desc:()=>'Forms in triplicate, forever. Spend Actions into it across as many turns as you need.',
    atk:{k:'bulk',n:2,every:3,name:'Paperwork'}},
  pirates:{fuse:4,scar:'heavy',n:'Pirate Blockade',art:'🏴‍☠️',kind:'prog_buy',need:4,bar:'buy',label:'Progressive — Buys',
    desc:()=>'Nothing sails in while they sit in the harbour. Spend Buys into it across turns.',
    atk:{k:'nobuy',n:1,every:2,name:'Blockade'}},
  witch:{fuse:3,scar:'rust',n:'Bog Witch',art:'🧙',kind:'prog_discard',need:7,bar:'blood',label:'Progressive — Discards',
    desc:()=>'She takes whatever you hand over. Discard cards from your hand into her cauldron across turns.',
    atk:{k:'curse',n:1,every:3,name:'Hex'}},
  devil:{fuse:3,n:"Devil's Bargain",art:'😈',kind:'panic',curses:2,bar:'blood',label:'Panic button',
    desc:t=>`Shake on it and it is gone at once — but ${plural(t.curses,'Jinx','Jinxes')} go straight into your discard pile.`,
    atk:{k:'price',n:1,every:2,name:'Fine print'}},
  dragon:{fuse:3,scar:'rust',n:'Greedy Dragon',art:'🐉',kind:'once_hybrid',needCoin:14,needAct:2,bar:'cash',label:'One shot — Coin + Actions',late:true,
    desc:t=>`Buying it off takes ${t.needCoin} coin and ${t.needAct} Actions, all within a single turn.`,
    atk:{k:'trash',n:1,filter:'treasure',every:3,name:'Plunder'}},
  rift:{fuse:4,n:'Magic Rift',art:'🌌',kind:'upgrade',bar:'act',label:'Sacrifice — Treasure + Action',
    desc:t=>`Trash ${plural(t.needT,'Treasure')} and ${plural(t.needA,'Action')} from your hand into the rift, over any turns.`,
    atk:{k:'warp',n:1,every:3,name:'Rift'}},
  bandit:{fuse:4,scar:'rust',n:'Bandit King',art:'🗡',kind:'prog_coin',need:8,bar:'cash',label:'Progressive — Coin',
    desc:()=>'Wants his cut — and jinxes you every single turn he stays.',
    atk:{k:'curse',n:1,every:1,name:'Shakedown'}},
  goblins:{fuse:4,scar:'rust',n:'Goblin Pickpockets',art:'👺',kind:'prog_coin',need:10,bar:'cash',label:'Progressive — Coin',
    desc:()=>'Small, quick and everywhere. Pay them off before your purse is empty.',
    atk:{k:'pickpocket',n:2,every:2,name:'Pickpocket'}},
  blizzard:{fuse:4,scar:'heavy',n:'Blizzard',art:'❄',kind:'prog_action',need:4,bar:'act',label:'Progressive — Actions',
    desc:()=>'Shovel it out with Actions, across as many turns as you need.',
    atk:{k:'freeze',n:1,every:2,name:'Frostbite'}},
  rats:{fuse:3,n:'Rat King',art:'🐀',kind:'scavenge',need:4,bar:'blood',label:'Scavenge — Cards',
    desc:t=>`Trash cards from your hand into its nest until it has ${t.need}. Junk counts double.`,
    atk:{k:'warp',n:1,every:2,name:'Nesting'}},
  ghost:{fuse:3,scar:'brittle',n:'Restless Ghost',art:'👻',kind:'banish',need:3,bar:'act',label:'Banish — Actions played',late:true,
    desc:t=>`Play ${plural(t.need-t.prog,'Action')} in a single turn, then banish it.`,
    atk:{k:'discard',n:1,filter:'action',every:2,name:'Spook'}},
  queen:{fuse:4,scar:'heavy',scarBest:true,n:'Snow Queen',art:'🧊',kind:'prog_coin',need:12,bar:'cash',label:'Progressive — Coin',late:true,coffin:1,
    desc:()=>'She covets your finest card and seals it in ice. Nothing in a coffin can be played, forged or copied until she is paid off.',
    atk:{k:'entomb',n:1,every:3,name:'Ice Coffin'}},
  bookworm:{fuse:4,scar:'rust',n:'Bookworm',art:'🐛',kind:'leech',need:5,bar:'act',label:'Leech — Draws',
    desc:t=>`It eats your pages. Until it has had ${t.need}, every card your Actions or splices would draw feeds it instead. It cannot be paid any other way.`,
    atk:{k:'discard',n:1,every:2,name:'Gnaw'}},
};
const THREAT_KEYS=Object.keys(THREATS);
