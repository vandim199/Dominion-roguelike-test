"use strict";
/* ==========================================================
   Runs inside the simulator's sandbox, after data.js and
   game.js: stand-ins for ui.js, the bots, the recording.
   ========================================================== */
let BOT='mage', LOG=null, REC=null;
function render(){} function fx(k,a){} function saveNow(){} function deleteSave(){}
function log(m,cls){ if(LOG) LOG.push((cls==='wave'?'\n== ':'')+m); }
function onRunEnd(){}
async function onVictory(){ REC.won=true; return REC.endless; }

/* ---------- card values ---------- */
const typeOf = c => DB[c.key].t;
const want = { // share of the deck each bot aims for, by type
  mage:  {spell:.40, mana:.35, arcana:.20, rune:.05},
  money: {spell:.35, mana:.20, arcana:.40, rune:.05},
  burner:{spell:.45, mana:.30, arcana:.20, rune:.05},
};
function deckShare(){
  const a=allCards().concat(G.exhausted).filter(c=>!DB[c.key].noLv), n=a.length||1, o={};
  for(const t of ['spell','mana','arcana','rune']) o[t]=a.filter(c=>typeOf(c)===t).length/n;
  return o;
}
// How much the bot wants a card: its price stands in for its power, nudged by what the deck lacks.
function desire(c){
  if(BOT==='random') return Math.random();
  const t=typeOf(c), w=want[BOT]||want.mage, sh=deckShare();
  let v=baseCost(c)+3*c.lv;
  v*=1+3*Math.max(0,w[t]-sh[t]);
  if(t==='mana'&&opsOf(c).some(o=>o[0]==='trash')) v*= allCards().length>14?0.6:0.2;
  if(BOT==='burner'&&['ignite','fireball','focus','cataclysm'].includes(c.key)) v*=1.6;
  if(c.key==='amplify'||c.key==='cataclysm') v*=1.3;
  return v;
}

/* ---------- playing: look ahead over orderings of the hand ---------- */
function drawStats(){
  const pile=(G.deck.length?G.deck:G.discard).filter(c=>!DB[c.key].unplayable);
  let d=0,a=0; const n=Math.max(1,(G.deck.length?G.deck:G.discard).length);
  for(const c of pile){ for(const o of opsOf(c)){ if(o[0]==='dmg') d+=o[1]*(o[2]||1); if(o[0]==='arc') a+=o[1]; if(o[0]==='burn') d+=o[1]*2; } }
  return {d:d/n,a:a/n};
}
function arcRef(){ return Math.max(4,G.market.reduce((s,c)=>s+(c?baseCost(c):0),0)/Math.max(1,G.market.length)); }

function score(S,ctx){
  let dmg=S.dealt+S.burnAdd*ctx.ticks;
  // Cards drawn but not yet seen: worth an average card each, for as many as the leftover Mana can play.
  const k=Math.min(S.drawn,S.mana); let dd=0, da=0;
  for(let j=0;j<k;j++){ dd+=ctx.ds.d*(S.mana-j); da+=ctx.ds.a; }
  dmg+=dd*0.7;
  dmg+=(S.focus-G.focus)*3*Math.max(2,S.mana)*ctx.after;
  dmg+=S.runeMana*ctx.ds.d*4*ctx.after;
  const arc=S.arc+da*0.7;
  if(G.won) return arc;
  const eff=Math.min(dmg,ctx.need);
  return eff/ctx.need*ctx.wD + arc/ctx.ref*ctx.wA + 0.001*S.mana;
}
function bestLine(){
  const playable=G.hand.filter(c=>!DB[c.key].unplayable&&!c.frozen);
  if(!playable.length||G.mana<playCost()) return null;
  const left=turnsMax()-G.turn;
  const need=Math.max(1,G.foe.hp - G.burn*(left+1));
  const ctx={need, ticks:left+1, after:left, ds:drawStats(), ref:arcRef(),
    wD: 1, wA: BOT==='money'?0.35:0.2};
  // Behind the pace: damage matters more than Arcana.
  if(!G.won&&need>0) ctx.wA*= left<=1 ? 0.05 : 1;
  let best={v:score(lightState(),ctx),first:null};
  const lim=Math.min(playable.length,6); let nodes=0;
  function dfs(S,rest,first,depth){
    if(depth>=lim||nodes>1500) return;
    const seen=new Set();
    for(const c of rest){
      const id=c.key+'|'+c.lv; if(seen.has(id)) continue; seen.add(id);
      const cost=playCost();
      if(S.mana<cost) continue;
      nodes++;
      const T={...S,flags:{...S.flags}};
      resolveDry(T,c); T.mana=Math.max(0,T.mana-cost);
      const v=score(T,ctx), f=first||c;
      if(v>best.v+1e-9) best={v,first:f};
      dfs(T,rest.filter(x=>x!==c),f,depth+1);
    }
  }
  const S0=lightState();
  dfs(S0,playable,null,0);
  return best.first;
}

async function botTurn(){
  let guard=0;
  while(!G.over&&G.phase==='turn'&&guard++<60){
    let c;
    if(BOT==='naive'){ const p=G.hand.filter(canPlay); c=p.length?pick(p):null; }
    else if(BOT==='random'){ const p=G.hand.filter(canPlay); c=p.length&&Math.random()<0.85?pick(p):null; }
    else c=bestLine();
    if(!c) break;
    await playCard(c);
    REC.plays[c.key]=(REC.plays[c.key]||0)+1;
  }
  if(G.phase==='turn') botBuy();
}
function botBuy(){
  if(!marketOpen()) return;
  for(let g=0;g<6;g++){
    const vals=G.market.map((c,i)=>({c,i,v:desire(c),p:baseCost(c)}));
    const top=Math.max(...vals.map(x=>x.v));
    const ok=vals.filter(x=>x.p<=G.arcana&&x.v>=0.55*top).sort((a,b)=>b.v-a.v);
    if(!ok.length) return;
    const x=ok[0]; if(buyCard(x.i)) REC.buys[x.c.key]=(REC.buys[x.c.key]||0)+1;
  }
}

/* ---------- choices ---------- */
async function chooseCards(list,o){
  const worth=c=>DB[c.key].noLv?-99:desire(c);
  const by=list.slice().sort((a,b)=>worth(a)-worth(b));
  switch(o.why){
    case 'reward': { const c=by[by.length-1]; return c&&BOT!=='random'&&worth(c)>avgWorth()?[c]:(BOT==='random'&&Math.random()<.5?[pick(list)]:[]); }
    case 'toll': return by.slice(0,o.min);
    case 'cycle': return list.filter(c=>DB[c.key].noLv||(!G.won&&typeOf(c)==='arcana'&&G.mana<=2));
    case 'trash': case 'purge': {
      const cur=list.filter(c=>DB[c.key].noLv);
      const extra=allCards().length>12?list.filter(c=>c.key==='mote'||c.key==='zap'):[];
      return cur.concat(extra).slice(0,o.max);
    }
    case 'temper': { const c=by[by.length-1]; return c?[c]:[]; }
    case 'copy': { const c=by[by.length-1]; return c?[c]:[]; }
  }
  return list.slice(0,o.min);
}
function avgWorth(){ const a=allCards().filter(c=>!DB[c.key].noLv); return a.reduce((s,c)=>s+desire(c),0)/Math.max(1,a.length); }
const RELIC_RANK=['vintage','glass','twin','staff','crystalball','familiar','stone','overflow','ember','lens','crescendo','battery','robes','hourglass','ascetic','coin','trophy','quill'];
async function chooseRelic(keys,title,sub,opts){
  if(opts&&opts.skip){ // full: give up the lowest-ranked one only if the new one is better
    const worst=keys.slice().sort((a,b)=>RELIC_RANK.indexOf(b)-RELIC_RANK.indexOf(a))[0];
    return worst;
  }
  const k = BOT==='random'||Math.random()<0.4 ? pick(keys) : keys.slice().sort((a,b)=>RELIC_RANK.indexOf(a)-RELIC_RANK.indexOf(b))[0];
  REC.relics.push(k); return k;
}
async function chooseOption(title,sub,opts){
  if(G.hearts<TUNE.hearts&&G.hearts<=1) return 'heal';
  const n=allCards().length;
  const junk=allCards().filter(c=>DB[c.key].noLv||c.key==='mote'||c.key==='zap').length;
  if(junk>=2&&n>14) return 'purge';
  return 'temper';
}

/* ---------- a run ---------- */
async function simRun(o){
  BOT=o.bot; LOG=o.keepLog?[]:null; uid=0;
  REC={bot:o.bot,seed:o.seed,won:false,endless:!!o.endless,plays:{},buys:{},relics:[],fights:[],end:null};
  G=null; await newRun(o.seed*2654435761>>>0);
  let lastFight=-1, fightRec=null;
  while(!G.over && G.fight<o.maxFights){
    if(G.fight!==lastFight){
      lastFight=G.fight;
      fightRec={f:G.fight,kind:G.foe.kind,boss:G.foe.boss||null,hp:G.foe.max,deck:allCards().length,turnWon:0,dealt:G.stats.dealt,arc:G.arcana};
      REC.fights.push(fightRec);
    }
    await botTurn();
    const f=G.fight, t=G.turn, h=G.hearts;
    await endTurn();
    if(G.fight!==f||G.over){ fightRec.won=G.hearts===h&&!(G.over&&!G.won&&G.hearts<=0); fightRec.turnWon=fightRec.won?t:0;
      fightRec.dealt=G.stats.dealt-fightRec.dealt; }
  }
  REC.end={fight:G.fight, over:G.over, hearts:G.hearts, deck:allCards().length, arcana:G.arcana, best:G.stats.best, relics:G.relics.map(r=>r.key)};
  if(LOG) REC.log=LOG;
  return REC;
}
