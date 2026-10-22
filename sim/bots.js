"use strict";
/* ==========================================================
   Coinkeep simulator — the sandbox half. Runs next to data.js
   and game.js (loaded by sim/sim.js), stands in for ui.js and
   plays whole runs with a bot, recording what happened.
   ========================================================== */

const SIM = { bot:null, P:null, dens:null, entries:[], keepLog:false, over:null, cur:null, splice:null, run:null };

/* ---------- ui.js stand-ins ---------- */
function log(msg,cls){ if(SIM.keepLog) SIM.entries.push([msg,cls||'']); }
function render(){}
function fx(){}
function toast(){}
function resetUI(){ SIM.entries=[]; SIM.over=null; }
function showGameOver(text){ SIM.over=text; }
function threatProgress(){ return {pct:0,left:'',note:''}; }

// Pickers answer at once. The bot's answer is trimmed to what the picker allows.
function chooseCards(pool,o={}){
  const min=o.min||0, max=o.max??1;
  if(!pool.length||max<=0) return Promise.resolve([]);
  let ch=[...new Set(SIM.bot.cards(pool,o)||[])].filter(c=>pool.includes(c)).slice(0,max);
  for(const c of pool){ if(ch.length>=min) break; if(!ch.includes(c)) ch.push(c); }
  return Promise.resolve(ch);
}
function chooseOption(title,sub,options){
  const keys=options.map(o=>o[0]), k=SIM.bot.option(keys,title);
  return Promise.resolve(keys.includes(k)?k:keys[0]);
}
// Called a second time, with {skip}, to ask which charm to give away when the slots are full.
function chooseJoker(keys,title,sub,o){ return Promise.resolve(o?SIM.bot.giveAway(keys):SIM.bot.charm(keys)); }
function chooseSplice(keys){ const k=SIM.bot.spliceKey(keys); SIM.splice=k; return Promise.resolve(k); }

/* ---------- seeded randomness: the same seed plays the same run ---------- */
function seedRandom(s){
  let a=s>>>0;
  Math.random=()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
}

/* ==========================================================
   WHAT CARDS DO, roughly — the bots plan with this.
   act/draw/buy/coin per play at tier l, before splices.
   ========================================================== */
const live = () => G.slots.filter(Boolean);
const GIVES={
  teahouse:   l=>({act:2*tierMult(l), draw:1+l}),
  maproom:    l=>({draw:3+2*l}),
  inventor:   l=>({act:1, draw:2+l}),
  parade:     l=>({act:1+tierMult(l), buy:1+Math.floor(l/2), coin:2*tierMult(l)}),
  springclean:l=>({act:1, draw:l}),
  strategist: l=>({draw:2+l}),
  dowser:     l=>({draw:2+l, treasure:true}),
  bargain:    l=>({buy:1+l, coin:3*tierMult(l)}),
  ringleader: l=>({coin:2*tierMult(l)}),
  orchard:    l=>({coin:1+3*tierMult(l)}),
  ragpicker:  l=>({act:1}),
  archer:     l=>({act:1}),
  lullaby:    l=>({act:1, draw:1}),
  tollgate:   l=>({coin:2*tierMult(l)*live().length}),
  guarddog:   l=>({draw:2+l}),
  riposte:    l=>({coin:2*tierMult(l)}),
  snare:      l=>({act:1, draw:1+l}),
  nightwatch: l=>({draw:Math.max(0,6+l-G.hand.length)}),
};
// Merge cards say what they do.
const gives = c => { const d=DB[c.key];
  if(d.merge){ const e=d.eff(c.lv); return {act:e.energy,draw:e.cards,buy:e.buys,coin:d.t==='action'?e.coin:0}; }
  return (GIVES[c.key]||(()=>({})))(c.lv); };
const power = c => DB[c.key].merge ? U(c.lv) : tierMult(c.lv);
// Actions a card leaves you with: Tea House +1, Inventor 0, Map Room −1.
const netAct = c => ((gives(c).act||0)+modCount(c,'quick'))*(hasMod(c,'twin')?2:1)-actCost(c);
const cardCoin = c => c.t==='treasure' ? tval(c) : c.t==='action' ? 1.5 : 0;
// What a drawn card is worth on average. Nothing left to draw: drawing is worth nothing.
// Cached while the bot weighs one decision (SIM.dens is cleared before each).
function density(){
  if(SIM.dens!=null) return SIM.dens;
  const pile=G.deck.length?G.deck:G.discard;
  return SIM.dens = pile.length ? pile.reduce((s,c)=>s+cardCoin(c),0)/pile.length : 0;
}
function avgTreasure(){
  const tr=[...G.deck,...G.discard].filter(c=>c.t==='treasure');
  return tr.length ? tr.reduce((s,c)=>s+tval(c),0)/tr.length : 0;
}
// What a threat still wants, in coin: Actions and cards are worth about 3 coin each.
function owedCoin(t){
  switch(t.kind){
    case 'prog_coin':   return t.need-t.prog;
    case 'once_coin':   return t.need;
    case 'once_hybrid': return t.needCoin+3*t.needAct;
    case 'panic':       return 4*t.curses;
    case 'upgrade':     return 3*((t.needT-t.gotT)+(t.needA-t.gotA));
  }
  return 3*(t.need-t.prog);
}
const strikeValue = frac => Math.max(0,...live().map(t=>frac*owedCoin(t)));
const junkIn = cards => cards.filter(isJunk);
const isCopper = c => c.key==='copper'||(c.key==='coin'&&c.lv===0);

function playValue(c){
  const g=gives(c), l=c.lv, d=density(), junk=junkIn(G.hand).length;
  const tr=()=>G.hand.filter(x=>x.t==='treasure'&&!isFrozen(x)).map(tval).sort((a,b)=>a-b);
  let v=(g.coin||0)+(g.buy||0)*.5+(g.draw||0)*(g.treasure?avgTreasure():d);
  const worm=live().find(t=>t.kind==='leech');                 // the Bookworm only eats what cards draw
  if(worm&&g.draw&&!g.treasure) v+=3*Math.min(g.draw+modCount(c,'draw'),worm.need-worm.prog);
  switch(c.key){
    case 'bonfire':     v+=3*junk; break;
    case 'springclean': v+=junk*d; break;
    case 'pawnshop':    v+=junk?3+l:0; break;
    case 'ragpicker':   v+=junk*(2+l); break;
    case 'crucible':    v+=tr().slice(0,1+l).reduce((s,x)=>s+2*x,0); break;
    case 'forge': case 'coinpress': v+=G.hand.some(x=>x.t==='treasure'&&!isFrozen(x))?2:0; break;
    case 'encore': { const o=G.hand.filter(x=>x.key!=='encore'&&x.t==='action'&&!isFrozen(x));
                     v+=o.length?(2+l)*Math.max(...o.map(playValue)):0; break; }
    case 'archer':      v+=strikeValue(strikePct(30,l)/100); break;
    case 'powderkeg':   v+=strikeValue(strikePct(60,l)/100)-2; break;
    case 'lullaby':     v+=live().length?1:0; break;
    case 'anvil':       v+=4*Math.min(DB.anvil.eff(l).merges,pairsIn(G.hand).length); break;
    case 'kindling':    v+=3*Math.min(U(l),junk); break;
    case 'bowman':      v+=strikeValue(DB.bowman.eff(l).strike/100); break;
  }
  v+=modCount(c,'draw')*d+modCount(c,'coin')+(hasMod(c,'grow')?(c.grow||0):0)
    +modCount(c,'strike')*strikeValue(.15)+modCount(c,'trade')*.5-modCount(c,'rust');
  return hasMod(c,'twin')?2*v:v;
}

/* ==========================================================
   BOT POLICIES. w: how much each card is worth per play at
   tier 0 (scaled by tierMult); cap: most copies wanted.
   ========================================================== */
const POLICY={
  money:{ name:'Big Money',
    w:{silver:2,gold:3,treasury:3,nestegg:2.5,maproom:3,dowser:2.5},
    cap:{maproom:2,dowser:1}, terminalsPer:8, thin:false,
    charms:{golden:10,glass:8,midas:7,vintage:6,mirror:6,greedy:6,minimal:5,hourglass:5,gilded:4,piggy:4,wall:4,seal:3},
    splices:{twin:9,coin:6,retain:6,grow:5,draw:4,strike:4,trade:3,guard:3,quick:2,free:1} },
  // Merge mode. w is per level-one unit (×1, 2, 4… a level). energy: ⚡ supply wanted per ⚡ the deck's Actions cost.
  merge_money:{ name:'Big Money (merge)',
    w:{coin:1.2,spark:1,scout:1.3,anvil:3,bazaar:1.2}, cap:{bazaar:1}, energy:1, thin:false,
    charms:{golden:10,glass:8,midas:7,vintage:6,mirror:6,greedy:6,minimal:6,hourglass:5,gilded:4,piggy:4,wall:4,seal:3},
    splices:{} },
  merge_engine:{ name:'Engine (merge)',
    w:{coin:1,spark:1.3,scout:1.6,anvil:3,kindling:1.5,bazaar:1.5,bowman:1.8,watchdog:1.3}, cap:{kindling:1}, energy:1, thin:false,
    charms:{greedy:8,wind:7,echo:7,golden:7,midas:6,momentum:6,minimal:5,hourglass:5,wall:4,seal:4,eagle:3,bounty:3},
    splices:{} },
  engine:{ name:'Engine',
    w:{silver:2,gold:3,treasury:2.5,nestegg:2.5,teahouse:3,maproom:3.5,inventor:4,parade:4,springclean:1.5,bonfire:2,
       strategist:2.5,encore:3,dowser:3,crucible:2.5,forge:2.5,coinpress:2,bargain:3,ringleader:3,orchard:3,pawnshop:1.5,
       ragpicker:1,archer:3,powderkeg:2.5,lullaby:2,tollgate:3,guarddog:2.5,riposte:2.5,snare:3,nightwatch:2.5},
    cap:{bonfire:1,encore:2,forge:1,coinpress:1,pawnshop:1,ragpicker:1,springclean:1,lullaby:1}, balance:true, thin:true,
    charms:{greedy:8,wind:7,echo:7,golden:7,midas:6,momentum:6,hourglass:5,wall:4,seal:4,ovation:3,eagle:3,bounty:3},
    splices:{twin:9,free:8,draw:6,quick:6,retain:5,coin:4,strike:4,grow:3,guard:3,trade:2} },
};

// A card's raw worth to this bot: weight × tier power.
const worth = (P,c) => isJunk(c) ? -1 : (P.w[c.key]||0)*power(c)*(hasMod(c,'twin')?2:1)+slotsUsed(c);
// Merge mode: ⚡ the deck makes (Sparks, net, plus a turn's own) against ⚡ its other Actions cost.
function energyBudget(cards){
  let supply=TUNE.energy, demand=0;
  for(const c of cards) if(c.t==='action'){ const n=netAct(c); if(n>0) supply+=n; else demand+=actCost(c); }
  return {supply,demand};
}
function want(P,c){
  let w=worth(P,c); if(w<=0) return 0;
  const mine=allCards(), have=mine.filter(x=>x.key===c.key).length;
  if(P.cap[c.key]!=null&&have>=P.cap[c.key]) return 0;
  if(DB[c.key].merge){
    if(c.key==='anvil') return have<1+Math.floor(mine.length/10) ? w : 0;
    const {supply,demand}=energyBudget(mine);
    if(c.key==='spark'&&supply>demand*P.energy+2) w*=.4;
    if(c.t==='action'&&netAct(c)<0&&demand+actCost(c)>supply*P.energy+1) w*=.3;
    if(mine.filter(x=>twins(x,c)).length%2===1) w*=1.3;                // it would make a pair
    return w;
  }
  if(c.t==='action'){
    const acts=mine.filter(x=>x.t==='action'), V=acts.filter(x=>netAct(x)>=1).length, T=acts.filter(x=>netAct(x)<0).length;
    if(P.terminalsPer&&netAct(c)<0&&T+1>mine.length/P.terminalsPer) return 0;
    if(P.balance&&netAct(c)<0&&T>=V+1) w*=.35;
    if(P.balance&&netAct(c)>=1&&V>T+1) w*=.4;
  }
  return w;
}
const best = (arr,f) => arr.reduce((b,x)=>{ const v=f(x); return !b||v>b[1]?[x,v]:b; },null)?.[0];
const rankBy = (keys,table) => best(keys,k=>(table[k]||1)+Math.random()*.5);

// Will this threat get away (detonate / attack) unless we pay now?
function pressing(t){
  if(t.cd<=1||t.age>=4) return true;
  const inc=Math.max(1,SIM.run.income);
  return ['prog_coin','once_coin','once_hybrid'].includes(t.kind) ? owedCoin(t)>inc*(t.cd-1)*.9 : t.cd<=2;
}

/* ---------- the heuristic bot (money / engine) ---------- */
function heuristic(P){
  const thinOk = () => allCards().filter(c=>c.t==='treasure').reduce((s,c)=>s+tval(c),0)>=12;
  const coppers = pool => pool.filter(isCopper).sort((a,b)=>a.lv-b.lv);
  const cheapest = pool => pool.filter(c=>!isJunk(c)).sort((a,b)=>worth(P,a)-worth(P,b));
  const self={ P,
    cards(pool,o){
      const t=SIM.cur, urg=t&&pressing(t), junk=junkIn(pool);
      switch(o.why){
        case 'springclean': return pool.filter(c=>isJunk(c)||isFrozen(c));
        case 'bonfire': case 'purge': return [...junk,...(P.thin&&thinOk()?coppers(pool):[])];
        case 'pawnshop':  return junk.length?junk:(P.thin&&thinOk()?coppers(pool).slice(0,1):[]);
        case 'ragpicker': return junk;
        case 'strategist': { const dead=pool.filter(c=>c.t==='action'&&G.actions===0);
          return [dead.length?best(dead,c=>worth(P,c)):best(pool,c=>-cardWorth(c))]; }
        case 'encore':    return [best(pool,playValue)];
        case 'crucible':  { const s=pool.slice().sort((a,b)=>tval(a)-tval(b)); const low=s.filter(c=>tval(c)<=2);
          return (low.length?low:s.slice(0,1)).slice(0,o.max); }
        case 'forge': case 'coinpress': return [best(pool,tval)];
        case 'temper': case 'copy': return [best(pool,c=>worth(P,c)||cardWorth(c)/10)];
        case 'mend':      return [best(pool,c=>worth(P,c))];
        case 'splice':    return [spliceTarget(pool)];
        case 'merge':     return pool.slice().sort((a,b)=>worth(P,b)-worth(P,a));
        case 'smith':     return [best(pool,c=>worth(P,c))];
        case 'spoils':    return [best(pool,c=>want(P,c)||worth(P,c)/4)];
        case 'kindling':  return junk;
        // Before playing, give up the least useful cards; after, whatever is left over.
        case 'prog_discard': return SIM.stage==='hand'?[...junk,...coppers(pool),...cheapest(pool)]:pool.filter(c=>!hasMod(c,'retain'));
        case 'sacrifice': case 'scavenge': return urg?[...junk,...coppers(pool),...cheapest(pool)]:junk;
        case 'upgrade': { const low=ty=>cheapest(pool.filter(c=>c.t===ty)), nT=t.needT-t.gotT, nA=t.needA-t.gotA;
          return [...(urg?low('treasure'):coppers(pool)).slice(0,nT),...(urg?low('action'):[]).slice(0,nA)]; }
      }
      return pool.slice(0,o.min||0);
    },
    option(keys){
      if(keys.includes('take')) return ['snare','moat','dog','guard','rip'].find(k=>keys.includes(k))||'take';   // a reaction: always block
      if(keys.includes('rest')) return inn(keys);
      if(keys.includes('y')) return 'y';                                                                 // only asked once we chose to
      const ts=live().filter(t=>keys.includes(t.id));                                                     // aiming a strike
      return best(ts,t=>-t.cd*100+owedCoin(t))?.id ?? keys[0];
    },
    charm:keys=>G.jokers.length>=TUNE.jokerSlots?null:rankBy(keys,P.charms),
    giveAway:()=>null,
    spliceKey:keys=>rankBy(keys,P.splices),
    turn:()=>heuristicTurn(self),
  };
  function spliceTarget(pool){
    const pref={quick:'action',draw:'action',free:'action',strike:'action',coin:'treasure',grow:'treasure',retain:'treasure'}[SIM.splice];
    return best(pool,c=>(worth(P,c)||cardWorth(c)/10)*(c.t===pref?2:1));
  }
  function inn(keys){
    const all=allCards(), junk=junkIn(all).length;
    if(keys.includes('heal')&&G.hearts<=2) return 'heal';
    if(keys.includes('smith')) return pairsIn(all).length ? 'smith' : junk>=2 ? 'purge' : 'copy';
    if(keys.includes('mend')&&all.some(c=>worth(P,c)>3&&(hasMod(c,'heavy')||hasMod(c,'brittle')))) return 'mend';
    if(junk>=2) return 'purge';
    return 'temper';
  }
  return self;
}

// Threats paid in cards from hand. When pressing, they're paid before anything is played.
const HAND_KINDS=['prog_discard','sacrifice','scavenge','upgrade'];
function shouldPay(t,stage){
  if(!threatReady(t)) return false;
  const u=stage==='rest'||pressing(t), rem=t.need-t.prog;
  if(stage==='hand') return HAND_KINDS.includes(t.kind)&&t.cd<=1;
  switch(t.kind){
    case 'prog_coin':    return u||G.coin>=rem;
    case 'prog_action':  return u||G.actions>=rem;
    case 'prog_buy':     return u||G.buys>=rem;
    case 'once_coin': case 'once_hybrid': return u||t.cd<=2;
    case 'prog_discard': return u;
    case 'sacrifice': case 'scavenge': return u||junkIn(G.hand).length>0;
    case 'upgrade':      return u||G.hand.some(isCopper);
    case 'banish':       return true;
    case 'panic':        return t.cd<=1||t.curses<=1;
  }
  return false;
}

async function heuristicTurn(B){
  const P=B.P, t0=G.turn, same=()=>!G.over&&G.turn===t0&&G.phase==='turn';
  SIM.dens=null;
  // 0. Threats that want cards from hand and can't wait take them before anything is played.
  await payThreats('hand',same);
  // 1. Actions: everything that keeps an Action spare first, then the best terminal.
  for(let i=0;i<80&&same();i++){
    SIM.dens=null;
    const acts=G.hand.filter(c=>c.t==='action'&&canPlay(c));
    if(!acts.length) break;
    // Free: leaves the Actions (⚡) where they were or better, and does something (an Anvil with no pair waits).
    const free=acts.filter(c=>netAct(c)>0||(netAct(c)===0&&playValue(c)>0));
    // Otherwise the best value per Action (⚡) spent; draw first while there's ⚡ to spare after it.
    const c=free.length ? best(free,c=>netAct(c)+playValue(c))
                        : best(acts,c=>playValue(c)/Math.max(1,actCost(c))*(G.actions>actCost(c)&&gives(c).draw?1.2:1));
    if(!free.length&&playValue(c)<=.01) break;
    SIM.dens=null;
    await playCard(c);
  }
  // 2. Treasures (Heavy ones cost an Action).
  if(same()) await playAllTreasures();
  for(const c of G.hand.filter(c=>c.t==='treasure'&&canPlay(c))) if(same()) await playCard(c);
  if(!same()) return;
  recordTurn();
  // 3. Pay what can't wait, 4. buy, 5. pour the rest into the threats.
  await payThreats('urgent',same);
  for(let i=0;i<10&&same()&&G.buys>0;i++){
    const offer=G.market.map((c,i)=>[c,i]).filter(([c])=>c&&costOf(c)<=G.coin);
    const pickd=best(offer,([c])=>want(P,c));
    if(!pickd||want(P,pickd[0])<=1.1) break;
    noteBuy(pickd[0]); buyCard(pickd[1]);
  }
  if(!same()) return;
  for(const c of G.hand.filter(c=>c.key==='rubble')) if(same()&&canPlay(c)&&!live().some(t=>t.kind==='prog_action'&&pressing(t))) await playCard(c);
  await payThreats('rest',same);
  if(same()) await endTurn();
}
async function payThreats(stage,same){
  for(const t of live().sort((a,b)=>a.cd-b.cd)){
    if(!same()) return;
    if(G.slots.includes(t)&&shouldPay(t,stage)){ SIM.cur=t; SIM.stage=stage; await clickThreat(t); SIM.cur=null; }
  }
}

/* ---------- the random bot: a baseline any real strategy should beat ---------- */
function randomBot(){
  const coin = p => Math.random()<p;
  const self={
    cards(pool,o){ const max=Math.min(o.max??1,pool.length), n=(o.min||0)+rnd(max-(o.min||0)+1); return shuffle(pool.slice()).slice(0,n); },
    option:keys=>pick(keys),
    charm:keys=>coin(.85)?pick(keys):null,
    giveAway:()=>null,
    spliceKey:keys=>pick(keys),
    async turn(){
      const t0=G.turn, same=()=>!G.over&&G.turn===t0&&G.phase==='turn';
      for(let i=0;i<60&&same();i++){
        const moves=[...G.hand.filter(canPlay).map(c=>()=>playCard(c)),
                     ...live().filter(threatReady).filter(t=>t.kind!=='panic'||coin(.2)).map(t=>()=>clickThreat(t))];
        const buys=G.buys>0?G.market.map((c,i)=>[c,i]).filter(([c])=>c&&costOf(c)<=G.coin&&!isJunk(c)):[];
        if(buys.length&&coin(.3)){ const [c,i]=pick(buys); noteBuy(c); buyCard(i); continue; }
        if(!moves.length||coin(.08)) break;
        await pick(moves)();
      }
      if(same()){ recordTurn(); await endTurn(); }
    },
  };
  return self;
}

/* ==========================================================
   RECORDING
   ========================================================== */
function waveRec(){
  const w=G.wave;
  return SIM.run.waves[w] ||= {wave:w,turns:0,coin:0,actsLeft:0,buysLeft:0,played:0,seen:0,deck:0,drewAll:0,stuck:0,
    threats:[],market:[],maxTier:TUNE.maxTier(w),merges0:G.merges,merges:0,topLv:0};
}
function noteWave(){
  if(SIM.run.lastWave===G.wave) return;
  SIM.run.lastWave=G.wave;
  const w=waveRec();
  w.market=G.market.filter(Boolean).map(c=>({key:c.key,lv:c.lv,cost:baseCost(c)}));
  w.threats=[...live(),...G.queue].map(t=>({key:t.key,kind:t.kind,elite:t.elite,coin:t.kind==='prog_coin'||t.kind==='once_coin'?t.need:t.needCoin||0,need:t.need??null}));
  w.threats.forEach(t=>{ const r=SIM.run.threats[t.key] ||= {spawned:0,cleared:0,detonated:0,hits:0,clearAge:0}; r.spawned++; });
}
function recordTurn(){
  const w=waveRec(), R=SIM.run;
  w.turns++; w.coin+=G.coin; w.actsLeft+=G.actions; w.buysLeft+=G.buys; w.played+=G.actionsPlayed;
  w.seen+=G.hand.length+G.inPlay.length; w.deck+=deckSize();
  if(!G.deck.length&&!G.discard.length) w.drewAll++;
  if(G.hand.some(c=>c.t==='action'&&!isFrozen(c)&&actCost(c)>G.actions)) w.stuck++;
  w.merges=G.merges-w.merges0; w.topLv=Math.max(w.topLv,...allCards().map(c=>c.lv));
  R.income = R.turns++ ? R.income*.7+G.coin*.3 : G.coin;
}
function noteBuy(c){ const k=c.key; SIM.run.bought[k]=(SIM.run.bought[k]||0)+1; SIM.run.buyTiers.push(c.lv); }

// Wrap a few rules to count clears, detonations and hits per threat.
const _complete=completeThreat, _detonate=detonate, _apply=applyAttack;
completeThreat=function(t){ const r=SIM.run&&SIM.run.threats[t.key]; if(r&&G.slots.includes(t)){ r.cleared++; r.clearAge+=t.age; } return _complete(t); };
detonate=async function(t){ const r=SIM.run&&SIM.run.threats[t.key]; if(r) r.detonated++; return _detonate(t); };
applyAttack=function(t){ const r=SIM.run&&SIM.run.threats[t.key]; if(r&&!t.detonating) r.hits++; return _apply(t); };

/* ==========================================================
   ONE RUN
   ========================================================== */
async function simRun(o){
  seedRandom(o.seed); SIM.dens=null;
  SIM.keepLog=!!o.keepLog;
  SIM.bot = o.bot==='random' ? randomBot() : heuristic(POLICY[(o.mode==='merge'?'merge_':'')+o.bot]);
  SIM.run={ seed:o.seed, bot:o.bot, mode:o.mode, waves:{}, threats:{}, bought:{}, buyTiers:[], income:0, turns:0, lastWave:0 };
  newRun(o.mode);
  let steps=0;
  while(!G.over&&G.wave<=o.waves&&steps++<o.maxTurns&&deckSize()<=o.deckCap){ noteWave(); await SIM.bot.turn(); }
  const R=SIM.run, over=SIM.over||'';
  const killer=(over.match(/^(.*?) arrives with nowhere to stand/)||over.match(/\. (.*?) was the last straw/)||[])[1];
  return {
    seed:R.seed, bot:R.bot, mode:R.mode,
    cleared: G.over ? G.wave-1 : Math.min(G.wave-1,o.waves),
    result: G.over ? (/lost heart/.test(over)?'hearts':'board full') : G.wave>o.waves ? 'survived' : deckSize()>o.deckCap ? 'runaway deck' : 'stalled',
    killer: killer ? killer.replace(/^Elite /,'') : null,
    turns:G.turn, hearts:G.hearts, deckSize:deckSize(), cleared_threats:G.runCleared,
    deck: allCards().map(c=>c.key+(c.lv?'+'+c.lv:'')),
    charms: G.jokers.map(j=>j.key), splices: allCards().flatMap(c=>c.mods),
    bought:R.bought, buyTiers:R.buyTiers, threats:R.threats, waves:Object.values(R.waves),
    log: o.keepLog ? logText(SIM.entries,`bot ${o.bot}, seed ${o.seed}`) : null,
  };
}
