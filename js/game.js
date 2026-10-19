"use strict";
/* ==========================================================
   Dominion: Crisis — rules: state, waves, threats, turn flow.
   Rendering and modals live in ui.js.
   ========================================================== */

let G=null, busy=false, tid=0, uid=0;
function mk(key,lv=0){ return {uid:++uid,key,lv:DB[key].noLv?0:lv,t:DB[key].t}; }
function pull(a,c){const i=a.indexOf(c);if(i>=0)a.splice(i,1);return i>=0;}
const hasJ  = k => !!G && G.jokers.some(j=>j.key===k);
const cname = c => DB[c.key].n+plus(c.lv);
const ctext = c => { const d=DB[c.key];
  if(typeof d.tx==='function') return d.tx(c.lv);
  if(d.tx) return d.tx;
  return `+${d.v*(1+c.lv)} Coin`; };
const baseCost = c => DB[c.key].c + DB[c.key].step*c.lv;
const costOf   = c => Math.max(0, baseCost(c)-(G?G.discount:0));
const allCards = () => [...G.deck,...G.hand,...G.discard,...G.inPlay];
const deckSize = () => allCards().length;
const handSize = () => TUNE.handSize+(hasJ('greedy')?1:0);
const waveCleared = () => !G.queue.length && G.slots.every(s=>!s);

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

function newRun(){
  G={ deck:[],hand:[],discard:[],inPlay:[],trash:[],
      coin:0,actions:0,buys:0,actionsPlayed:0,treasuresPlayed:0,discount:0,echoUsed:false,wallUsed:false,
      market:[], slots:new Array(TUNE.slots).fill(null), queue:[],
      wave:0, turn:0, turnInWave:0, waveTotal:0, runCleared:0,
      jokers:[], next:{actions:0,buys:0,coin:0}, phase:'turn', over:false };
  for(let i=0;i<7;i++)G.deck.push(mk('copper'));
  for(let i=0;i<3;i++)G.deck.push(mk('estate'));
  resetUI();
  log('Your dominion braces for an endless crisis. Your deck is yours for the whole run — build it with care.','hl');
  startWave(1);
}

function newThreat(key,w,elite){
  const d=THREATS[key], cs=TUNE.coinScale(w), ks=TUNE.countScale(w), em=elite?1.8:1, steps=Math.floor((w-1)/3);
  const t={key,...d,atk:{...d.atk},prog:0,id:++tid,elite:!!elite,age:0};
  switch(d.kind){
    case 'prog_coin': case 'once_coin': t.need=Math.round(d.need*cs*em); break;
    case 'prog_action': case 'prog_buy': case 'prog_discard': t.need=Math.round(d.need*ks*em); break;
    case 'sacrifice':   t.need=Math.round((d.need+steps)*em); break;
    case 'panic':       t.curses=Math.round((d.curses+steps)*em); break;
    case 'once_hybrid': t.needCoin=Math.round(d.needCoin*cs*em); t.needAct=Math.round((d.needAct+steps)*em); break;
    case 'upgrade':     t.needT=t.needA=Math.round((1+Math.floor((w-1)/4))*em); t.gotT=t.gotA=0; break;
  }
  if(t.atk.n) t.atk.n+=Math.floor((w-1)/5);
  if(elite){ t.n='Elite '+d.n; t.atk.every=Math.max(1,d.atk.every-1); }
  t.cd=effEvery(t);
  return t;
}
function effEvery(t){
  if(t.age>=TUNE.enrageAfter) return 1;
  return Math.max(1, t.atk.every-(hasJ('glass')?1:0));
}

/* ---------- market ---------- */
function rollTier(){ const m=TUNE.maxTier(G.wave); return Math.max(0,wpick([[m,45],[m-1,35],[m-2,15],[m+1,5]])); }
function randomTreasure(){
  const w=G.wave;
  return mk(wpick([['copper',Math.max(6,40-w*6)],['silver',40],['gold',12+w*4]]),rollTier());
}
function marketCard(){ return mk(pick(KINGDOM),rollTier()); }
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
function draw(n){ let g=0; for(let i=0;i<n;i++){const c=popDeck(); if(!c)break; G.hand.push(c); g++;} return g; }
function gatherDeck(){
  G.deck=shuffle([...G.deck,...G.hand,...G.discard,...G.inPlay]);
  G.hand=[]; G.discard=[]; G.inPlay=[];
}
function trashCard(c,quiet){
  G.trash.push(c);
  const scrap=hasJ('scrapper'); if(scrap) C(2);
  if(!quiet||scrap) log(`${cname(c)} is trashed${scrap?' (+2 Scrapper)':''}.`);
}
// Curses and Bulk arriving from threats — a Watchtower in hand turns them away.
function gainJunk(key,n,where='discard'){
  if(n<=0) return;
  if(G.hand.some(c=>c.key==='watchtower')){
    for(let i=0;i<n;i++) trashCard(mk(key),true);
    log(`Watchtower turns away ${plural(n,DB[key].n)}.`,'good'); return;
  }
  for(let i=0;i<n;i++){ const c=mk(key);
    if(where==='deck') G.deck.splice(rnd(G.deck.length+1),0,c); else G.discard.push(c); }
  log(`${plural(n,DB[key].n)} land${n===1?'s':''} in your ${where==='deck'?'draw pile':'discard pile'}.`,'bad');
}

function tval(c){
  let v = c.key==='bank'
    ? (1+c.lv)*(G.inPlay.filter(x=>x.t==='treasure'&&x!==c).length+1)
    : DB[c.key].v*(1+c.lv);
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
  log(`Wave ${w}`,'wave');
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
  const k=await chooseJoker(offers,`Wave ${G.wave} cleared — choose a joker`,
    full?`Your ${TUNE.jokerSlots} joker slots are full. Taking one means selling another.`
        :`Joker slots ${G.jokers.length}/${TUNE.jokerSlots}.${G.wave%TUNE.eliteEvery===0?' The Elite fell: an extra joker is on offer.':''}`);
  if(!k) return;
  if(full){
    const out=await chooseJoker(G.jokers.map(j=>j.key),`Sell a joker for ${JOKERS[k].n}?`,'Pick the joker to let go.',{skip:'Keep my jokers'});
    if(!out){ log(`You pass on ${JOKERS[k].n}.`); return; }
    G.jokers=G.jokers.filter(j=>j.key!==out);
    log(`${JOKERS[out].n} leaves your court.`);
  }
  G.jokers.push({key:k,age:0});
  log(`${JOKERS[k].art} ${JOKERS[k].n} joins your court.`,'good');
  render();
}

function deckSummary(){
  const all=allCards(), by=t=>all.filter(c=>c.t===t).length;
  const junk=all.filter(c=>DB[c.key].noLv).length;
  return `${all.length} cards — ${by('treasure')} Treasures, ${by('action')} Actions, ${junk} junk`;
}

async function campService(){
  const o=await chooseOption('The camp',`${deckSummary()}. Choose one service before wave ${G.wave+1}.`,[
    ['purge','🔥 Purge — trash up to 2 cards'],
    ['temper','⚒ Temper — upgrade a card one tier'],
    ['copy','📜 Duplicate — copy a card'],
    ['rest','Move on']]);
  const sorted=()=>G.deck.slice().sort((a,b)=>cname(a).localeCompare(cname(b)));
  if(o==='purge'){
    const s=await chooseCards(sorted(),{min:0,max:2,title:'Purge',sub:'Trash up to 2 cards from your deck for good.'});
    s.forEach(c=>{pull(G.deck,c);trashCard(c);});
  } else if(o==='temper'){
    const s=await chooseCards(sorted().filter(c=>!DB[c.key].noLv),{min:0,max:1,title:'Temper',
      sub:'Upgrade one card a tier.',badge:c=>DB[c.key].n+plus(c.lv+1)});
    if(s[0]){ const was=cname(s[0]); s[0].lv++; log(`${was} is tempered into ${cname(s[0])}.`,'good'); }
  } else if(o==='copy'){
    const s=await chooseCards(sorted().filter(c=>!DB[c.key].noLv),{min:0,max:1,title:'Duplicate',sub:'Add a copy of one card to your deck.'});
    if(s[0]){ G.deck.push(mk(s[0].key,s[0].lv)); log(`You copy ${cname(s[0])}.`,'good'); }
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
  t.fresh=true; t.age=0; t.cd=effEvery(t);
  G.slots[idx]=t;
  log(`${t.art} ${t.n} takes slot ${idx+1}.`,'bad');
  return true;
}

function completeThreat(t){
  const i=G.slots.indexOf(t); if(i<0) return;
  G.slots[i]=null;
  G.runCleared++;
  log(`${t.n} cleared.`,'good');
  gainJunk('bulk',1);
  if(hasJ('bounty')){ draw(1); A(1); C(2); log('Bounty Hunter pays out: +1 Card, +1 Action, +2 Coin.','good'); }
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

// Reactions and jokers "strike" a threat: knock a fraction off what it demands.
function strike(t,frac){
  if(!G.slots.includes(t)) return;
  const hit=x=>Math.max(1,Math.ceil(x*frac));
  switch(t.kind){
    case 'once_coin':   { const d=hit(t.need); t.need=Math.max(0,t.need-d); log(`${t.n}'s fee drops by ${d}.`,'good'); break; }
    case 'once_hybrid': { const d=hit(t.needCoin); t.needCoin=Math.max(0,t.needCoin-d);
                          if(t.needCoin<=0) t.needAct=0; log(`${t.n}'s price drops by ${d} coin.`,'good'); break; }
    case 'panic':       { const d=hit(t.curses); t.curses=Math.max(0,t.curses-d); log(`${t.n} loses ${plural(d,'Curse')} from its terms.`,'good'); break; }
    case 'upgrade':     { if(t.gotT<t.needT) t.gotT++; else t.gotA++; log(`${t.n} collapses a little.`,'good'); break; }
    default:            { const d=hit(t.need); t.prog=Math.min(t.need,t.prog+d); log(`${t.n} takes ${d} progress.`,'good'); }
  }
  if(isDone(t)) completeThreat(t);
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
    case 'sacrifice':     return G.hand.some(c=>c.key!=='bulk');
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
        const s=await chooseCards(G.hand.filter(c=>c.key!=='bulk'),{min:0,max:rem,title:t.n,
          sub:`Trash cards into the shrine. ${rem} still wanted. Bulk is refused.`});
        s.forEach(c=>{pull(G.hand,c);trashCard(c);});
        t.prog+=s.length;
        if(s.length) log(`You sacrifice ${plural(s.length,'card')} to ${t.n} (${t.prog}/${t.need}).`,'hl'); break; }
      case 'panic':{
        const ok=await chooseOption(t.n,`Sign the pact? It clears at once and ${plural(t.curses,'Curse')} go into your discard pile.`,
          [['y','Sign it'],['n','Step back']]);
        if(ok!=='y') break;
        log(`You sign the ${t.n}.`,'bad');
        gainJunk('curse',t.curses); t.curses=0; break; }
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
    if(waveCleared()) await endWave();
  } finally { busy=false; render(); }
}

/* ---------- attacks ---------- */
function atkText(t){
  const a=t.atk, n=a.n;
  switch(a.k){
    case 'grow':    return `its demand grows ${a.pct}%`;
    case 'discard': return `discard ${plural(n,'random card')} from your hand`;
    case 'trash':   return `trash ${plural(n,a.filter?'random Treasure':'random card')} from your hand`;
    case 'bulk':    return `${n} Bulk into your discard pile`;
    case 'curse':   return `${plural(n,'Curse')} into your discard pile`;
    case 'nobuy':   return `−${plural(n,'Buy')} next turn`;
    case 'price':   return `the pact demands ${plural(n,'more Curse','more Curses')}`;
    case 'warp':    return `${n} Bulk shuffled into your draw pile`;
  }
  return '';
}

function applyAttack(t){
  const a=t.atk, n=a.n;
  switch(a.k){
    case 'grow':
      if(t.kind==='once_hybrid') t.needCoin=Math.ceil(t.needCoin*(1+a.pct/100));
      else t.need=Math.ceil(t.need*(1+a.pct/100));
      log(`${t.n} now wants ${t.kind==='once_hybrid'?t.needCoin:t.need}.`,'bad'); break;
    case 'discard':
      for(let i=0;i<n&&G.hand.length;i++){ const c=pick(G.hand); pull(G.hand,c); G.discard.push(c);
        log(`${cname(c)} is knocked from your hand.`,'bad'); } break;
    case 'trash':
      for(let i=0;i<n;i++){ const pool=G.hand.filter(c=>!a.filter||c.t===a.filter); if(!pool.length)break;
        const c=pick(pool); pull(G.hand,c); trashCard(c,true); log(`${t.n} destroys your ${cname(c)}.`,'bad'); } break;
    case 'bulk':  gainJunk('bulk',n); break;
    case 'curse': gainJunk('curse',n); break;
    case 'nobuy': G.next.buys-=n; log(`You will have ${plural(n,'Buy')} fewer next turn.`,'bad'); break;
    case 'price': t.curses+=n; log(`${t.n} now costs ${plural(t.curses,'Curse')}.`,'bad'); break;
    case 'warp':  gainJunk('bulk',n,'deck'); break;
  }
}

function blocked(t){
  if(hasJ('thorns')&&G.slots.includes(t)){ log('Thorns bite back.','good'); strike(t,.2); }
}

async function resolveAttack(t){
  const a=t.atk, txt=atkText(t);
  log(`${t.art} ${t.n} — ${a.name}: ${txt}.`,'bad');
  if(hasJ('wall')&&!G.wallUsed){ G.wallUsed=true; log('Iron Wall absorbs the blow.','good'); blocked(t); return; }
  const best=f=>G.hand.filter(f).sort((x,y)=>y.lv-x.lv)[0];
  const moat =best(c=>c.key==='moat');
  const rip  =best(c=>c.key==='riposte');
  const snare=best(c=>c.key==='snare'&&(!t.elite||c.lv>=1));
  const opts=[];
  if(moat)  opts.push(['moat', `🌊 Reveal ${cname(moat)} — block`]);
  if(rip)   opts.push(['rip',  `🤺 Discard ${cname(rip)} — block & strike ${ripPct(rip.lv)}%`]);
  if(snare) opts.push(['snare',`🪤 Trash ${cname(snare)} — destroy it`]);
  if(opts.length){
    opts.push(['take','Take the hit']);
    const ch=await chooseOption(`${t.art} ${t.n} attacks!`,`${a.name}: ${txt}.`,opts);
    if(ch==='moat'){ log(`You reveal ${cname(moat)}. The attack washes away.`,'good'); blocked(t); return; }
    if(ch==='rip'){ pull(G.hand,rip); G.discard.push(rip);
      log(`${cname(rip)} parries and strikes back!`,'good'); blocked(t); strike(t,ripPct(rip.lv)/100); return; }
    if(ch==='snare'){ pull(G.hand,snare); trashCard(snare,true);
      log(`${cname(snare)} springs shut on ${t.n}!`,'good'); completeThreat(t); return; }
  }
  applyAttack(t);
}

/* ==========================================================
   CARD PLAY / BUY
   ========================================================== */
function canPlay(c){
  if(G.over||G.phase!=='turn') return false;
  if(c.t==='treasure') return true;
  if(c.key==='bulk')   return G.actions>0||hasJ('tidy');
  if(c.t==='action')   return G.actions>0;
  return false;                      // Estate, Curse
}

function playTreasure(c){
  pull(G.hand,c); G.inPlay.push(c);
  let v=tval(c);
  if(hasJ('mirror')&&G.treasuresPlayed===0){ v*=2; log('Mirror doubles it.','hl'); }
  G.treasuresPlayed++;
  C(v); log(`${cname(c)} adds ${v} to your purse.`);
}

async function runAction(c){
  G.actionsPlayed++;
  if(hasJ('momentum')&&G.actionsPlayed>1){ C(G.actionsPlayed-1); log(`Momentum: +${G.actionsPlayed-1} Coin.`,'hl'); }
  await DB[c.key].fx(c,c.lv);
}

async function playCard(c){
  if(busy||!canPlay(c)||!G.hand.includes(c)) return;
  busy=true;
  try{
    if(c.t==='treasure') playTreasure(c);
    else if(c.key==='bulk'){
      if(!hasJ('tidy')) G.actions--;
      pull(G.hand,c); trashCard(c,true);
      log('You haul the Bulk away. It is gone from your deck for good.','good');
      if(hasJ('tidy')) draw(1);
    } else {
      G.actions--; pull(G.hand,c); G.inPlay.push(c);
      log(`You play ${cname(c)}.`,'hl');
      const times=(hasJ('echo')&&!G.echoUsed)?2:1; G.echoUsed=true;
      for(let i=0;i<times;i++){ if(i) log('Echo — it resolves again.','hl'); await runAction(c); render(); }
    }
  } finally { busy=false; render(); }
}

function playAllTreasures(){
  if(busy||G.over||G.phase!=='turn') return;
  const tr=G.hand.filter(c=>c.t==='treasure').sort((a,b)=>(a.key==='bank')-(b.key==='bank'));
  if(!tr.length) return;
  tr.forEach(playTreasure); render();
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
  G.coin=Math.max(0,n.coin);
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
    for(const c of G.hand.splice(0))   G.discard.push(c);
    G.coin=0; G.actions=0; G.buys=0;
    G.next={actions:0,buys:0,coin:carry};

    draw(handSize());
    render(); await sleep(180);

    // threats strike at the hand you just drew — reactions in it can answer
    G.phase='attack'; G.wallUsed=false;
    for(const t of G.slots.slice()){
      if(!t||!G.slots.includes(t)) continue;
      t.age++; t.cd--;
      if(t.cd<=0){
        t.cd=effEvery(t); render();
        await resolveAttack(t); render();
        if(G.over) return;
        await sleep(160);
      }
    }
    G.phase='turn';
    if(waveCleared()){ await endWave(); return; }

    cycleMarket(); render(); await sleep(200);

    const due=G.turnInWave%TUNE.spawnEvery(G.wave)===0 || G.slots.every(s=>!s);
    if(due&&G.queue.length){ if(!spawnThreat()) return; await sleep(220); }
    startTurn();
  } finally { if(G.phase==='attack') G.phase='turn'; busy=false; render(); }
}

function lose(title,text){
  G.over=true;
  const cleared=G.wave-1; saveBest(cleared);
  showGameOver(`${title}. ${text} You survived ${plural(cleared,'wave')} and cleared ${plural(G.runCleared,'threat')} with a deck of ${deckSize()} cards. Best run: ${plural(loadBest(),'wave')} cleared.`);
}
