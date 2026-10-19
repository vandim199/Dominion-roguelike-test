"use strict";
/* ==========================================================
   Dominion: Crisis — static data: tuning, cards, jokers, threats.
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
  coinScale:  w => Math.pow(1.3, w-1),      // coin demands grow exponentially
  countScale: w => 1 + 0.22*(w-1),          // action / buy / discard demands grow linearly
  maxTier:    w => Math.floor((w-1)/2),     // market tier: base on waves 1-2, + on 3-4, ++ on 5-6 ...
};

/* ==========================================================
   CARDS — every card has tiers. Village, Village+, Village++…
   fx(self, lv) runs the card at its tier.
   ========================================================== */
const DB={};
function def(k,o){ DB[k]=Object.assign({key:k,step:3},o); }
const plus = lv => lv<=0 ? '' : lv<=3 ? '+'.repeat(lv) : `+${lv}`;
const tierName = lv => lv<=0 ? 'base' : plus(lv);

def('copper',{n:'Copper',c:0,step:2,t:'treasure',v:1,art:'🥉'});
def('silver',{n:'Silver',c:3,step:4,t:'treasure',v:2,art:'🥈'});
def('gold',  {n:'Gold',  c:6,step:5,t:'treasure',v:3,art:'🥇'});
def('bank',  {n:'Bank',  c:7,step:4,t:'treasure',kingdom:true,art:'🏦',
  tx:l=>`+${1+l} Coin for each Treasure you have in play, counting this.`});

def('estate',{n:'Estate',c:2,t:'victory',noLv:true,art:'🏡',tx:'Dead weight. Trash it or feed it to a threat.'});
def('curse', {n:'Curse', c:0,t:'curse',  noLv:true,art:'💀',tx:'Dead weight. Cannot be played.'});
def('bulk',  {n:'Bulk',  c:0,t:'junk',   noLv:true,art:'📦',tx:'Salvage left by a threat. Spend 1 Action to trash it for good.'});

const A = n => { if(G.phase==='attack') G.next.actions+=n; else G.actions+=n; };
const B = n => { if(G.phase==='attack') G.next.buys+=n;    else G.buys+=n; };
const C = n => { if(G.phase==='attack') G.next.coin+=n;    else G.coin+=n; };

/* --- draw & actions --- */
def('village',{n:'Village',c:3,art:'🏘',t:'action',
  tx:l=>`+${plural(1+l,'Card')}, +${2+Math.floor(1.5*l)} Actions.`,
  fx:async(s,l)=>{ draw(1+l); A(2+Math.floor(1.5*l)); }});
def('smithy',{n:'Smithy',c:4,art:'⚒',t:'action',
  tx:l=>`+${3+2*l} Cards.`,
  fx:async(s,l)=>{ draw(3+2*l); }});
def('laboratory',{n:'Laboratory',c:5,art:'⚗',t:'action',
  tx:l=>`+${2+l} Cards, +1 Action.`,
  fx:async(s,l)=>{ draw(2+l); A(1); }});
def('festival',{n:'Festival',c:5,art:'🎪',t:'action',
  tx:l=>`+${2+l} Actions, +${plural(1+Math.floor(l/2),'Buy')}, +${2+2*l} Coin.`,
  fx:async(s,l)=>{ A(2+l); B(1+Math.floor(l/2)); C(2+2*l); }});

/* --- deck control --- */
def('cellar',{n:'Cellar',c:2,step:2,art:'🪜',t:'action',
  tx:l=>`+1 Action. Discard any number of cards, then draw that many${l?` +${l}`:''}.`,
  fx:async(s,l)=>{ A(1);
    const ch=await chooseCards(G.hand,{min:0,max:99,title:cname(s),sub:`Discard any number, then draw that many${l?` plus ${l}`:''}.`});
    ch.forEach(c=>{pull(G.hand,c);G.discard.push(c);}); draw(ch.length+l); }});
def('chapel',{n:'Chapel',c:2,step:2,art:'⛪',t:'action',
  tx:l=>`Trash up to ${4+2*l} cards from your hand.`,
  fx:async(s,l)=>{ const ch=await chooseCards(G.hand,{min:0,max:4+2*l,title:cname(s),sub:`Trash up to ${4+2*l} cards.`});
    ch.forEach(c=>{pull(G.hand,c);trashCard(c);}); }});
def('courtyard',{n:'Courtyard',c:2,art:'🏛',t:'action',
  tx:l=>`+${3+l} Cards. Put a card from your hand on top of your deck.`,
  fx:async(s,l)=>{ draw(3+l);
    const ch=await chooseCards(G.hand,{min:1,max:1,title:cname(s),sub:'Put one card back on top of your deck.'});
    if(ch[0]){pull(G.hand,ch[0]);G.deck.unshift(ch[0]);} }});
def('throneroom',{n:'Throne Room',c:4,step:4,art:'🪑',t:'action',
  tx:l=>`Play an Action from your hand ${['twice','three times','four times'][l]||(2+l)+' times'}.`,
  fx:async(s,l)=>{ const cand=G.hand.filter(c=>c.t==='action');
    if(!cand.length){log('No Action to crown.');return;}
    const n=2+l+(hasJ('crown')?1:0);
    const ch=await chooseCards(cand,{min:1,max:1,title:cname(s),sub:`Play this Action ${n} times.`});
    const c=ch[0]; if(!c)return; pull(G.hand,c); G.inPlay.push(c);
    for(let i=0;i<n;i++){ await runAction(c); render(); } }});

/* --- economy --- */
def('crucible',{n:'Crucible',c:4,step:4,art:'🔥',t:'action',
  tx:l=>`Trash up to ${plural(1+l,'Treasure')} from your hand. +Coin equal to each one's value squared.`,
  fx:async(s,l)=>{ const tr=G.hand.filter(c=>c.t==='treasure');
    if(!tr.length){log('Nothing to melt.');return;}
    const ex=hasJ('stone')?3:2;
    const ch=await chooseCards(tr,{min:0,max:1+l,title:cname(s),
      sub:`Melt up to ${1+l}. Each pays its value ${ex===3?'cubed':'squared'}.`,badge:c=>'→ '+Math.pow(tval(c),ex)});
    for(const c of ch){ const v=tval(c), g=Math.pow(v,ex);
      pull(G.hand,c); trashCard(c,true); C(g);
      log(`${cname(s)} melts ${cname(c)} (${v}) into ${g} coin!`,'big'); } }});
def('mine',{n:'Mine',c:5,step:4,art:'⛰',t:'action',
  tx:l=>`Trash a Treasure from your hand. Gain one ${plural(1+l,'step')} better into your hand (Copper→Silver→Gold→Gold+).`,
  fx:async(s,l)=>{ const tr=G.hand.filter(c=>c.t==='treasure');
    if(!tr.length){log('No Treasure to mine.');return;}
    const up=c=>{ let [k,v]=[c.key,c.lv]; for(let i=0;i<=l;i++) [k,v]=upTreasure(k,v); return [k,v]; };
    const ch=await chooseCards(tr,{min:1,max:1,title:cname(s),sub:`Upgrade it ${plural(1+l,'step')}.`,
      badge:c=>{ const [k,v]=up(c); return DB[k].n+plus(v); }});
    const c=ch[0]; if(!c)return;
    const [k,v]=up(c);
    pull(G.hand,c); trashCard(c,true);
    const g=mk(k,v); G.hand.push(g); log(`${cname(s)} turns ${cname(c)} into ${cname(g)}.`,'hl'); }});
def('mint',{n:'Mint',c:5,step:4,art:'🏭',t:'action',
  tx:l=>`Choose a Treasure in your hand. Gain ${l?`${1+l} copies`:'a copy'} of it into your discard pile.`,
  fx:async(s,l)=>{ const tr=G.hand.filter(c=>c.t==='treasure');
    if(!tr.length){log('No Treasure to mint.');return;}
    const ch=await chooseCards(tr,{min:1,max:1,title:cname(s),sub:`Gain ${l?`${1+l} copies`:'a copy'} of it.`});
    const c=ch[0]; if(!c)return;
    for(let i=0;i<1+l;i++) G.discard.push(mk(c.key,c.lv));
    log(`${cname(s)} strikes ${plural(1+l,'new '+cname(c),'new '+cname(c)+'s')}.`,'hl'); }});
def('bridge',{n:'Bridge',c:4,art:'🌉',t:'action',
  tx:l=>`+${plural(1+l,'Buy')}, +${1+l} Coin. Market cards cost ${1+l} less this turn.`,
  fx:async(s,l)=>{ B(1+l); C(1+l); G.discount+=1+l; }});
def('conspirator',{n:'Conspirator',c:4,art:'🗝',t:'action',
  tx:l=>`+${2+2*l} Coin. If you've played 3+ Actions this turn: +1 Card, +1 Action.`,
  fx:async(s,l)=>{ C(2+2*l); if(G.actionsPlayed>=3){draw(1);A(1);} }});

/* --- reactions: answer a threat's attack from your hand --- */
const ripPct = l => 25+10*l;
def('moat',{n:'Moat',c:2,step:2,art:'🌊',t:'action',r:true,
  tx:l=>`+${2+l} Cards. ⛨ When a threat attacks, reveal this to block it.`,
  fx:async(s,l)=>{ draw(2+l); }});
def('riposte',{n:'Riposte',c:3,art:'🤺',t:'action',r:true,
  tx:l=>`+${2+2*l} Coin. ⛨ When a threat attacks, discard this to block it and strike it for ${ripPct(l)}%.`,
  fx:async(s,l)=>{ C(2+2*l); }});
def('snare',{n:'Snare',c:4,art:'🪤',t:'action',r:true,
  tx:l=>`+${plural(1+l,'Card')}, +1 Action. ⛨ When a threat attacks, trash this to destroy it${l?'':' (not Elites)'}.`,
  fx:async(s,l)=>{ draw(1+l); A(1); }});
def('watchtower',{n:'Watchtower',c:3,art:'🗼',t:'action',r:true,
  tx:l=>`Draw until you have ${6+l} cards. ⛨ While in hand, Curses and Bulk you'd gain are trashed.`,
  fx:async(s,l)=>{ let g=0; while(G.hand.length<6+l&&g++<30){ if(!draw(1))break; } }});

const KINGDOM=Object.keys(DB).filter(k=>DB[k].t==='action'||DB[k].kingdom);

function upTreasure(k,l){ if(k==='copper')return ['silver',l]; if(k==='silver')return ['gold',l]; return [k,l+1]; }

/* ==========================================================
   JOKERS — rule-benders drafted between waves.
   ========================================================== */
const JOKERS={
  greedy:  {n:'Greedy Hands',art:'🖐',r:'common',tx:'+1 card in every hand you draw.'},
  wind:    {n:'Second Wind',art:'💨',r:'common',tx:'+1 Action at the start of each turn.'},
  seal:    {n:"Merchant's Seal",art:'🛒',r:'common',tx:'+1 Buy each turn. Market cards cost 1 less.'},
  gilded:  {n:'Gilded Copper',art:'🪙',r:'common',tx:'Copper produces +2 Coin.'},
  piggy:   {n:'Piggy Bank',art:'🐷',r:'common',tx:'Half your unspent Coin carries over to next turn.'},
  scrapper:{n:'Scrapper',art:'♻',r:'common',tx:'Whenever a card is trashed, +2 Coin.'},
  bounty:  {n:'Bounty Hunter',art:'🎯',r:'common',tx:'Clearing a threat gives +1 Card, +1 Action and +2 Coin.'},
  tidy:    {n:'Tidy Mind',art:'🧹',r:'common',tx:'Hauling Bulk costs no Action and draws a card.'},
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
  stone:   {n:"Philosopher's Stone",art:'🔮',r:'rare',tx:'Crucible cubes Treasure value instead of squaring it.'},
  crown:   {n:'Crown of Crowns',art:'👑',r:'rare',tx:'Throne Rooms play their Action one extra time.'},
  golden:  {n:'Golden Ratio',art:'🏅',r:'rare',tx:'All Treasures produce ×2 Coin.'},
  interest:{n:'Compound Interest',art:'💹',r:'rare',tx:'Coin poured into threats counts double.'},
  glass:   {n:'Glass Crown',art:'🥂',r:'rare',tx:'Treasures produce ×3 Coin — but every threat attacks one turn sooner.'},
  vintage: {n:'Vintage',art:'🍷',r:'rare',tx:'Treasures produce +1 Coin for each wave this joker has been held.'},
};
const RARITY={common:60,uncommon:30,rare:10};

/* ==========================================================
   THREATS — each one demands a resource and attacks on a timer.
   ========================================================== */
const THREATS={
  bribe:{n:'Royal Bribe',art:'💼',kind:'prog_coin',need:18,bar:'cash',label:'Progressive — Coin',
    desc:()=>'A chain of officials must be paid off. Pour in coin across as many turns as you like.',
    atk:{k:'grow',pct:20,every:3,name:'Inflation'}},
  siege:{n:'Monster Siege',art:'🏯',kind:'once_coin',need:10,bar:'cash',label:'One shot — Coin',late:true,
    desc:t=>`Mercenaries want the whole fee up front: ${t.need} coin in a single turn.`,
    atk:{k:'discard',n:2,every:2,name:'Raid'}},
  shrine:{n:'Corrupted Shrine',art:'🕍',kind:'sacrifice',need:3,bar:'blood',label:'Sacrifice — Cards',
    desc:t=>`Feed it ${t.need} cards from your hand. Bulk is refused. The cards are trashed for good.`,
    atk:{k:'trash',n:1,every:3,name:'Hunger'}},
  redtape:{n:'Bureaucratic Red Tape',art:'📜',kind:'prog_action',need:5,bar:'act',label:'Progressive — Actions',
    desc:()=>'Paperwork, endlessly. Spend Actions into it across as many turns as you need.',
    atk:{k:'bulk',n:2,every:3,name:'Paperwork'}},
  embargo:{n:'Trade Embargo',art:'⛔',kind:'prog_buy',need:4,bar:'buy',label:'Progressive — Buys',
    desc:()=>'Negotiating it away costs trade rights. Spend Buys into it across turns.',
    atk:{k:'nobuy',n:1,every:2,name:'Blockade'}},
  offering:{n:'Dark Offering',art:'🩸',kind:'prog_discard',need:7,bar:'blood',label:'Progressive — Discards',
    desc:()=>'It eats whatever you hand over. Discard cards from your hand into it across turns.',
    atk:{k:'curse',n:1,every:3,name:'Hex'}},
  pact:{n:'Blood Pact',art:'🤝',kind:'panic',curses:2,bar:'blood',label:'Panic button',
    desc:t=>`Sign and it is gone at once — but ${plural(t.curses,'Curse')} go straight into your discard pile.`,
    atk:{k:'price',n:1,every:2,name:'Fine print'}},
  hoard:{n:"Dragon's Hoard",art:'🐉',kind:'once_hybrid',needCoin:14,needAct:2,bar:'cash',label:'One shot — Coin + Actions',late:true,
    desc:t=>`Buying it off takes ${t.needCoin} coin and ${t.needAct} Actions, all within a single turn.`,
    atk:{k:'trash',n:1,filter:'treasure',every:3,name:'Plunder'}},
  anomaly:{n:'Magical Anomaly',art:'🌌',kind:'upgrade',bar:'act',label:'Sacrifice — Treasure + Action',
    desc:t=>`Trash ${plural(t.needT,'Treasure')} and ${plural(t.needA,'Action')} from your hand into the rift, over any turns.`,
    atk:{k:'warp',n:1,every:3,name:'Rift'}},
  extort:{n:'Extortionist',art:'🗡',kind:'prog_coin',need:8,bar:'cash',label:'Progressive — Coin, escalating',
    desc:()=>'Wants its cut — and hexes you every single turn it stays.',
    atk:{k:'curse',n:1,every:1,name:'Shakedown'}},
};
const THREAT_KEYS=Object.keys(THREATS);
