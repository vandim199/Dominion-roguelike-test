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
  if(!pool.length||max<=0) return Promise.resolve(o.back?null:[]);
  const said=SIM.bot.cards(pool,o);
  if(said===null&&o.back) return Promise.resolve(null);                 // the bot backed out
  let ch=[...new Set(said||[])].filter(c=>pool.includes(c)).slice(0,max);
  for(const c of pool){ if(ch.length>=min) break; if(!ch.includes(c)) ch.push(c); }
  return Promise.resolve(ch);
}
function chooseOption(title,sub,options){
  const keys=options.map(o=>o[0]), k=SIM.bot.option(keys,title);
  return Promise.resolve(keys.includes(k)?k:keys[0]);
}
// Called a second time, with {skip}, to ask which charm to give away when the slots are full.
// eds: the edition each offer rolled (merge mode).
function chooseJoker(keys,title,sub,o={}){ return Promise.resolve(o.skip?SIM.bot.giveAway(keys):SIM.bot.charm(keys,o.eds||{})); }
function confirmCard(){ return Promise.resolve(true); }
function saveNow(){}
function deleteSave(){}
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
// Merge mode's Mult, as the bots see it. Coin is worth what it lands at: × the Mult at that moment.
const effOf = c => DB[c.key].merge ? DB[c.key].eff(c.lv) : {};
const isMult = c => { const e=effOf(c); return !!(e.addm||e.xm||e.cresc); };
// When to play it: the engine first, then +Mult, Crescendo, ×Mult, and Coin last (Treasures and Alchemist after these).
const stageOf = c => { const e=effOf(c); return e.xm?3 : e.cresc?2 : e.addm?1 : e.coin&&!e.energy&&!e.cards?4 : 0; };
function multAfter(e,n=1){ let m=G.mult;
  for(let i=0;i<n;i++){ m+=(e.addm||0)+(e.cresc||0)*(G.actionsPlayed+G.treasuresPlayed+1+i); if(e.xm) m*=e.xm; }
  return m; }
const multGain = (e,n=1) => merge() ? chainMult(multAfter(e,n),G.jokers)-chainMult(G.mult,G.jokers) : 0;
// Coin still to come this turn, before Mult: Treasures and Coin cards in hand, and a guess at what draws bring.
function coinAhead(skip){
  let s=0, dr=0;
  for(const x of G.hand){ if(x===skip||isFrozen(x)) continue; const e=effOf(x);
    if(x.t==='treasure') s+=tval(x); else if(e.coin) s+=e.coin*(actCost(x)<=G.actions?1:.3);
    if(e.cards) dr+=e.cards; }
  return s+dr*density()*.7;
}
const power = c => DB[c.key].merge ? 1+c.lv : tierMult(c.lv);
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

// Replaying a card n times (Encore): ×Mult cards compound.
function replayValue(x,n){
  if(x.t==='treasure') return n*tval(x)*multNow();
  return isMult(x) ? multGain(effOf(x),n)*coinAhead(x) : n*playValue(x);
}
function playValue(c){
  const g=gives(c), l=c.lv, M=multNow(), d=density()*M, junk=junkIn(G.hand).length, e=effOf(c);
  const tr=()=>G.hand.filter(x=>x.t==='treasure'&&!isFrozen(x)).map(tval).sort((a,b)=>a-b);
  let v=(g.coin||0)*M+(g.buy||0)*.5+(g.draw||0)*(g.treasure?avgTreasure()*M:d);
  if(e.addm||e.xm||e.cresc) v+=multGain(e)*coinAhead(c);
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
    case 'anvil':       v+=4*Math.min(DB.anvil.eff(l).merges,pairsIn([...G.discard,...G.inPlay,...G.deck,...G.hand]).length); break;
    case 'kindling':    v+=3*Math.min(1+l,junk); break;
    case 'bowman':      v+=strikeValue(DB.bowman.eff(l).strike/100); break;
    case 'strongbox':   v+=G.hand.some(x=>x.t==='treasure'&&!isFrozen(x))?1+l:0; break;
    case 'almanac':     v+=(2+l)*d*.8; break;
    case 'seer':        v+=G.deck.slice(0,1+l).some(isJunk)?1:.1; break;
    case 'rummage':     v+=(1+Math.min(1+l,junk))*d; break;
    case 'patron':      v+=1.5*(1+l); break;
    case 'reprise': { const o=G.hand.filter(x=>x.key!=='reprise'&&(x.t==='action'||x.t==='treasure')&&!isFrozen(x));
                      v+=o.length?Math.max(...o.map(x=>replayValue(x,DB.reprise.eff(l).replay))):0; break; }
    case 'alchemist':   break;                                   // played after the Treasures, see heuristicTurn
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
  // The new Mult cards and charms get middling weights here: these two take what comes, they don't build for Mult.
  merge_money:{ name:'Big Money (merge)',
    w:{coin:1.2,spark:1,scout:1.3,bazaar:1.2,strongbox:1,rummage:1.2,alchemist:2,ward:.8,drum:1.2,crescendo:.8,fireworks:1.3}, cap:{bazaar:1,alchemist:2,ward:1}, energy:1, thin:false,
    charms:{golden:10,glass:8,midas:7,vintage:6,mirror:6,greedy:6,minimal:6,hourglass:5,gilded:4,piggy:4,wall:4,seal:3,
            banner:5,melon:5,tide:4,crier:4,hologram:3,campfire:3,bus:2,constellation:2,blueprint:3,brainstorm:3},
    splices:{} },
  merge_engine:{ name:'Engine (merge)',
    w:{coin:1,spark:1.3,scout:1.6,kindling:1.5,bazaar:1.5,bowman:1.8,watchdog:1.3,strongbox:1.2,almanac:1.4,seer:.6,
       reprise:2,patron:1,rummage:1.4,alchemist:1.8,ward:1.2,drum:1.2,crescendo:1.2,fireworks:1.5}, cap:{kindling:1,seer:1,patron:1,ward:2}, energy:1, thin:false,
    charms:{greedy:8,wind:7,echo:7,golden:7,midas:6,momentum:6,minimal:5,hourglass:5,wall:4,seal:4,eagle:3,bounty:3,
            banner:5,hologram:5,tide:5,melon:4,crier:4,campfire:3,glass:3,constellation:2,bus:2,blueprint:3,brainstorm:3},
    splices:{} },
  // Commits to Mult: buys +Mult and ×Mult cards and the draw and ⚡ to play them, plays them in order before its Coin,
  // drafts and swaps charms for the biggest Mult chain (editions included), keeps them in the best order, and bribes.
  merge_mult:{ name:'Mult (merge)', mult:true,
    w:{coin:1.3,spark:1.5,scout:1.7,drum:2.4,crescendo:2,fireworks:3.6,reprise:2.2,alchemist:2,rummage:1.3,bowman:1.2,
       kindling:1,bazaar:1.1,watchdog:.8,almanac:1.1,seer:.5,patron:1,ward:1,strongbox:.3},
    cap:{kindling:1,seer:1,patron:1,ward:1,alchemist:3,reprise:2}, energy:1, thin:true,
    charms:{greedy:7,wind:7,echo:6,golden:6,midas:5,mirror:4,hourglass:5,wall:4,seal:3,minimal:2,bounty:3,eagle:3},
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
const worth = (P,c) => isJunk(c) ? -1 : DB[c.key].fused ? partsOf(c).reduce((s,p)=>s+(P.w[p.key]||0)*(1+p.lv),0)
  : (P.w[c.key]||0)*power(c)*(hasMod(c,'twin')?2:1)+slotsUsed(c);
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
    const pair=mine.filter(x=>twins(x,c)).length%2===1; if(pair) w*=1.3;   // it would make a pair
    if(P.mult&&!pair&&w<1+mine.length/25) return 0;                      // the Mult bot keeps its deck lean
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

/* ---------- the Mult bot's charms: draft, swap and order them for the biggest Mult chain ---------- */
// Every order of up to 7 charms (Blueprint and Brainstorm make it matter); the one with the biggest Mult.
function perms(a){ if(a.length<=1) return [a.slice()]; const out=[];
  a.forEach((x,i)=>{ for(const p of perms([...a.slice(0,i),...a.slice(i+1)])) out.push([x,...p]); }); return out; }
function bestOrder(js,base){
  if(js.length>7) return js.slice();
  let top=js, tv=-1; for(const p of perms(js)){ const v=chainMult(base,p); if(v>tv+1e-9){ tv=v; top=p; } } return top;
}
// A charm a few waves from now: what its counters will have grown to (Glass Crown and the Melon may break).
function ahead(j){ const w=Math.max(1,G.wave), per=x=>3*x/w;
  const k=j.key, n=j.n||0;
  switch(k){
    case 'hologram': return {...j,n:n+per(G.merges)};
    case 'campfire': return {...j,n:n+Math.min(4,per(G.trash.length))};
    case 'crier':    return {...j,n:n+per(G.runCleared)};
    case 'tide':     return {...j,age:j.age+3};
    case 'constellation': return {...j,n:n+(allCards().some(c=>c.key==='patron')?6:0)};
    case 'glass':    return {...j,age:j.age+1};
  }
  return j;
}
const RISK={glass:.35,melon:.3};
// A set of charms, in ln(Mult) of its best order (plus what the rest are worth to this bot).
function setValue(P,js){
  const base=Math.max(1.5,SIM.run.cardMult||1.5), fut=js.map(ahead);
  let v=Math.log(chainMult(base,bestOrder(fut,base))/base);
  for(const j of js){ if(!JOKERS[j.key].mx&&!['blueprint','brainstorm'].includes(j.key)) v+=(P.charms[j.key]||1)/12;
    v-=RISK[j.key]||0; if(j.ed==='negative') v+=.15; }
  return v;
}
function multCharm(self,keys,eds){
  const P=self.P, cur=G.jokers; let top=null, tv=setValue(P,cur)+.04; self.out=null;
  for(const k of keys){ const j={key:k,age:0,n:0,ed:eds[k]||''};
    if(slotted()<TUNE.jokerSlots||j.ed==='negative'){ const v=setValue(P,[...cur,j]); if(v>tv){ tv=v; top=k; self.out=null; } continue; }
    for(const o of cur){ if(o.ed==='negative') continue;
      const v=setValue(P,[...cur.filter(x=>x!==o),j]); if(v>tv+.06){ tv=v; top=k; self.out=o.key; } } }
  return top;
}
// Put the charms in their best order (free to do at any time).
function orderCharms(){
  const sig=G.jokers.map(j=>j.key).join();
  if(SIM.run.order===sig) return;
  G.jokers=bestOrder(G.jokers,Math.max(1.5,SIM.run.cardMult||1.5)); SIM.run.order=G.jokers.map(j=>j.key).join();
}

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
        // Fuse a Spark into the best card that costs 1 ⚡: it pays for itself and frees a slot.
        case 'fuse':      { const f=fusePair(pool); return f?[f[0]]:null; }
        case 'fuse2':     { const f=fusePair(G.deck); return f?[f[1]]:null; }
        case 'spoils':    return P.mult ? [best(pool,c=>want(P,c))].filter(c=>want(P,c)>0) : [best(pool,c=>want(P,c)||worth(P,c)/4)];
        case 'kindling':  return junk;
        case 'seer':      return junk;
        case 'rummage':   return pool.filter(c=>isJunk(c)||isFrozen(c)||DB[c.key].stays);   // a Ward only works from the discard pile
        case 'strongbox': return [best(pool,c=>-tval(c))];
        case 'reprise':   { const n=+((/(\d+) times/.exec(o.sub||'')||[])[1]||2); return [best(pool,c=>replayValue(c,n))]; }
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
    charm:(keys,eds)=>P.mult ? multCharm(self,keys,eds) : slotted()>=TUNE.jokerSlots?null:rankBy(keys,P.charms),
    giveAway:()=>self.out||null,
    spliceKey:keys=>rankBy(keys,P.splices),
    turn:()=>heuristicTurn(self),
  };
  function spliceTarget(pool){
    const pref={quick:'action',draw:'action',free:'action',strike:'action',coin:'treasure',grow:'treasure',retain:'treasure'}[SIM.splice];
    return best(pool,c=>(worth(P,c)||cardWorth(c)/10)*(c.t===pref?2:1));
  }
  function fusePair(cards){
    const sp=cards.find(c=>c.key==='spark'), one=cards.filter(c=>fusable(c)&&c!==sp&&actCost(c)===1&&!DB[c.key].fused);
    return sp&&one.length ? [sp,best(one,c=>worth(P,c))] : null;
  }
  function inn(keys){
    const all=allCards(), junk=junkIn(all).length;
    // Asked again in the same camp: the service picked last time had nothing to work on (no card to copy, say). Move on.
    const at=G.wave+':'+G.turn; if(self.innAt===at) return keys.includes('heal')&&G.hearts<TUNE.hearts?'heal':'rest'; self.innAt=at;
    if(keys.includes('heal')&&G.hearts<=2) return 'heal';
    if(keys.includes('fuse')&&P.mult&&hasJ('campfire')&&junk+all.filter(isCopper).length>=2) return 'purge';    // feed the fire
    if(keys.includes('fuse')) return junk>=2 ? 'purge' : fusePair(all) ? 'fuse' : 'copy';
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
  if(P.mult) orderCharms();
  // 0. Threats that want cards from hand and can't wait take them before anything is played.
  await payThreats('hand',same);
  // 1. Actions: everything that keeps an Action spare first, then the best terminal.
  for(let i=0;i<80&&same();i++){
    SIM.dens=null;
    // Merge mode: an Alchemist worth more than a card keeps its ⚡ for the end of the turn.
    const alch=merge()&&G.hand.filter(c=>c.key==='alchemist'&&!isFrozen(c)).sort((a,b)=>b.lv-a.lv)[0];
    const alchV=alch?(effOf(alch).mult-1)*(G.coin+coinAhead(alch)*multNow()):0;
    const acts=G.hand.filter(c=>c.t==='action'&&canPlay(c)&&c!==alch&&(!alch||netAct(c)>=0||playValue(c)>alchV||G.actions-actCost(c)>=actCost(alch)));
    if(!acts.length) break;
    // Free: leaves the Actions (⚡) where they were or better, and does something (an Anvil with no pair waits).
    const free=acts.filter(c=>netAct(c)>0||(netAct(c)===0&&playValue(c)>0));
    // Otherwise the best value per Action (⚡) spent; draw first while there's ⚡ to spare after it.
    let c=free.length ? best(free,c=>netAct(c)+playValue(c))
                      : best(acts,c=>playValue(c)/Math.max(1,actCost(c))*(G.actions>actCost(c)&&gives(c).draw?1.2:1));
    if(!free.length&&playValue(c)<=.01) break;
    // Merge mode: whatever is played, the engine goes first, then +Mult, then ×Mult, and Coin last.
    if(merge()){ const lower=acts.filter(x=>x!==c&&stageOf(x)<stageOf(c)&&playValue(x)>.01&&actCost(x)+actCost(c)<=G.actions+(effOf(x).energy||0));
      if(lower.length){ const s=Math.min(...lower.map(stageOf)); c=best(lower.filter(x=>stageOf(x)===s),playValue); } }
    SIM.dens=null;
    await playCard(c);
  }
  // 2. Treasures (Heavy ones cost an Action).
  if(same()) await playAllTreasures();
  for(const c of G.hand.filter(c=>c.t==='treasure'&&canPlay(c))) if(same()) await playCard(c);
  for(const c of G.hand.filter(c=>c.key==='alchemist').sort((a,b)=>b.lv-a.lv)) if(same()&&G.coin>1&&canPlay(c)) await playCard(c);
  if(!same()) return;
  recordTurn();
  await bribeThreats('urgent',same);
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
  await bribeThreats('rest',same);
  await payThreats('rest',same);
  if(same()) await endTurn();
}
// Could the threat be finished this turn the ordinary way?
function canFinish(t){
  const rem=t.need-t.prog;
  switch(t.kind){
    case 'prog_action':  return G.actions*unitMult()>=rem;
    case 'prog_buy':     return G.buys*unitMult()>=rem;
    case 'prog_discard': return G.hand.length>=rem;
    case 'sacrifice':    return G.hand.filter(c=>c.key!=='rubble').length>=rem;
    case 'scavenge':     return G.hand.reduce((n,c)=>n+(isJunk(c)?2:1),0)>=rem;
    case 'banish': case 'once_hybrid': return threatReady(t);
    case 'upgrade':      return G.hand.filter(c=>c.t==='treasure').length>=t.needT-t.gotT&&G.hand.filter(c=>c.t==='action').length>=t.needA-t.gotA;
  }
  return false;
}
// The valve: bribe a threat that is about to go off and can't be paid in time, or any that's cheap next to the purse.
// After buying, bribe whatever won't be finished the ordinary way before its fuse, keeping what coin threats due now still need.
async function bribeThreats(stage,same){
  for(const t of live().sort((a,b)=>a.cd-b.cd)){
    if(!same()) return;
    if(!G.slots.includes(t)||!canBribe(t)) continue;
    const c=bribeCost(t), coinOwed=live().filter(x=>x!==t&&!bribable(x)&&x.cd<=1).reduce((s,x)=>s+owedCoin(x),0);
    const spare=G.coin-coinOwed, stuck=!canFinish(t)&&(t.kind!=='panic'||t.curses>1);
    if(c<=spare*.35||(stuck&&(t.cd<=1||stage==='rest'&&t.cd<=3)&&c<=Math.max(spare,t.cd<=1?G.coin:0))) await bribeThreat(t);
  }
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
        const br=live().filter(canBribe); if(br.length&&coin(.15)){ await bribeThreat(pick(br)); continue; }
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
  const m=multNow(); w.mult=(w.mult||0)+m; w.peakMult=Math.max(w.peakMult||0,m);
  R.cardMult = R.turns ? R.cardMult*.8+G.mult*.2 : G.mult;
  if(m>R.peakMult) R.peakMult=m;
  R.income = R.turns++ ? R.income*.7+G.coin*.3 : G.coin;
  if(G.coin>R.peak){ R.peak=G.coin; R.peakWave=G.wave; }
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
  SIM.bot = o.bot==='random' ? randomBot() : heuristic(POLICY[(o.mode==='merge'?'merge_':'')+o.bot]||POLICY.engine);   // mult plays engine outside merge mode
  SIM.run={ seed:o.seed, bot:o.bot, mode:o.mode, waves:{}, threats:{}, bought:{}, buyTiers:[], income:0, turns:0, lastWave:0, peak:0, peakWave:0, peakMult:1, cardMult:1, order:'' };
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
    bought:R.bought, buyTiers:R.buyTiers, threats:R.threats, waves:Object.values(R.waves), peak:R.peak, peakWave:R.peakWave, peakMult:R.peakMult, bestTurn:G.bestTurn||0,
    jokers: G.jokers.map(j=>j.key+(j.ed?'/'+j.ed:'')),
    log: o.keepLog ? logText(SIM.entries,`bot ${o.bot}, seed ${o.seed}`) : null,
  };
}
