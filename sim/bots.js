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
  mage:  {spell:.52, mana:.40, rune:.08},
  burner:{spell:.58, mana:.34, rune:.08},
};
function deckShare(){
  const a=allCards().concat(G.exhausted).filter(c=>!DB[c.key].noLv), n=a.length||1, o={};
  for(const t of ['spell','mana','rune']) o[t]=a.filter(c=>typeOf(c)===t).length/n;
  return o;
}
const RAREBONUS={basic:0.5,common:1,uncommon:1.4,rare:2};
// How much the bot wants a card: its worth stands in for its power, nudged by rarity and by what the deck lacks.
function desire(c){
  if(BOT==='random') return Math.random();
  const d=DB[c.key], t=typeOf(c), w=want[BOT]||want.mage, sh=deckShare();
  let v=(baseCost(c)+3*c.lv)*(RAREBONUS[d.r]||1);
  v*=1+3*Math.max(0,(w[t]||0)-(sh[t]||0));
  if(opsOf(c).some(o=>o[0]==='trash')) v*= allCards().length>12?0.7:0.2;
  if(BOT==='burner'&&['ignite','conflag','fireball','focus','cataclysm'].includes(c.key)) v*=1.6;
  return v;
}
// Worth gained by raising the best card in the deck one tier.
function bestUpgrade(){
  let best=null, g=0;
  for(const c of allCards().concat(G.exhausted)){ if(DB[c.key].noLv) continue;
    const up={...c,lv:c.lv+1}, d=desire(up)-desire(c); if(d>g){ g=d; best=c; } }
  return {c:best,g};
}

/* ---------- playing: look ahead over orderings of the hand ---------- */
function drawStats(){
  const src=G.deck.length?G.deck:G.discard, n=Math.max(1,src.length); let d=0;
  for(const c of src) for(const o of opsOf(c)){ if(o[0]==='dmg') d+=o[1]*(o[2]||1); if(o[0]==='burn') d+=o[1]*2; }
  return {d:d/n};
}
function score(S,ctx){
  let dmg=S.dealt+S.burnAdd*ctx.ticks;
  // Cards drawn but not yet seen: worth an average card each, for as many as the leftover Mana can play.
  const k=Math.min(S.drawn,S.mana); let dd=0;
  for(let j=0;j<k;j++) dd+=ctx.ds.d*(S.mana-j);
  dmg+=dd*0.7;
  dmg+=(S.focus-G.focus)*3*Math.max(2,S.mana)*ctx.after;
  dmg+=S.runeMana*ctx.ds.d*4*ctx.after;
  dmg+=S.focusGrow*3*Math.max(2,S.mana)*ctx.after*(ctx.after+1)/2;
  // Mana kept for later turns is worth what it will multiply then.
  const keep=Math.min(1,TUNE.carry+(hasR('battery')?0.5:0));
  if(keep&&ctx.after>0) dmg+=keep*S.mana*ctx.ds.d*2.2*Math.min(ctx.after,2);
  return Math.min(dmg,ctx.need)/ctx.need + 0.0005*S.mana;
}
function bestLine(){
  const playable=G.hand.filter(c=>!DB[c.key].unplayable&&!c.frozen);
  if(!playable.length||G.mana<playCost()) return null;
  const left=turnsMax()-G.turn;
  const need=Math.max(1,G.foe.hp - G.burn*(left+1));
  const ctx={need, ticks:left+1, after:left, ds:drawStats()};
  let best={v:score(lightState(),ctx),first:null};
  const lim=Math.min(playable.length,7); let nodes=0;
  function dfs(S,rest,first,depth){
    if(depth>=lim||nodes>3000) return;
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
  dfs(lightState(),playable,null,0);
  return best.first;
}

async function botTurn(){
  let guard=0; const f=G.fight;
  while(!G.over&&G.phase==='turn'&&!G.won&&G.fight===f&&guard++<60){
    let c;
    if(BOT==='naive'){ const p=G.hand.filter(canPlay); c=p.length?pick(p):null; }
    else if(BOT==='random'){ const p=G.hand.filter(canPlay); c=p.length&&Math.random()<0.85?pick(p):null; }
    else c=bestLine();
    if(!c) break;
    await playCard(c);
    REC.plays[c.key]=(REC.plays[c.key]||0)+1;
  }
}

/* ---------- choices ---------- */
async function chooseCards(list,o){
  const worth=c=>DB[c.key].noLv?-99:desire(c);
  const by=list.slice().sort((a,b)=>worth(a)-worth(b));
  switch(o.why){
    case 'reward': {
      if(BOT==='random') return Math.random()<.2?'upgrade':Math.random()<.8?[pick(list)]:[];
      const c=by[by.length-1], up=bestUpgrade();
      // A weak card dilutes the deck: raise a good card instead when that gains more.
      const canRaise=(o.extra||[]).length>0;
      if(!c||up.g>worth(c)*0.8||worth(c)<avgWorth()*0.6){ if(canRaise&&up.c){ REC.ups++; return 'upgrade'; } if(!c||worth(c)<avgWorth()*0.6) return []; }
      REC.takes[c.key]=(REC.takes[c.key]||0)+1; return [c];
    }
    case 'toll': return by.slice(0,o.min);
    case 'cycle': return list.filter(c=>DB[c.key].noLv);
    case 'trash': case 'purge': {
      const cur=list.filter(c=>DB[c.key].noLv);
      const extra=allCards().length>10?list.filter(c=>c.key==='zap'&&c.lv===0):[];
      return cur.concat(extra).slice(0,o.max);
    }
    case 'temper': { const u=bestUpgrade().c, r=u&&list.includes(u)?u:by[by.length-1]; if(r) REC.raised[r.key]=(REC.raised[r.key]||0)+1; return r?[r]:[]; }
    case 'copy': { const c=by[by.length-1]; return c?[c]:[]; }
  }
  return list.slice(0,o.min);
}
function avgWorth(){ const a=allCards().filter(c=>!DB[c.key].noLv); return a.reduce((s,c)=>s+desire(c),0)/Math.max(1,a.length); }
const RELIC_RANK=['vintage','glass','twin','staff','crystalball','familiar','stone','overflow','ember','lens','crescendo','battery','robes','hourglass','ascetic','quill','clasp','haste'];
async function chooseRelic(keys,title,sub,opts){
  if(opts&&opts.skip) return keys.slice().sort((a,b)=>RELIC_RANK.indexOf(b)-RELIC_RANK.indexOf(a))[0];
  const k = BOT==='random'||Math.random()<0.4 ? pick(keys) : keys.slice().sort((a,b)=>RELIC_RANK.indexOf(a)-RELIC_RANK.indexOf(b))[0];
  REC.relics.push(k); return k;
}
async function chooseOption(title,sub,opts){
  if(G.hearts<TUNE.hearts&&G.hearts<=1) return 'heal';
  const n=allCards().length, junk=allCards().filter(c=>DB[c.key].noLv||(c.key==='zap'&&c.lv===0)).length;
  if(junk>=2&&n>12) return 'purge';
  return 'temper';
}

/* ---------- a run ---------- */
async function simRun(o){
  BOT=o.bot; LOG=o.keepLog?[]:null; uid=0;
  REC={bot:o.bot,seed:o.seed,won:false,endless:!!o.endless,plays:{},takes:{},ups:0,raised:{},relics:[],fights:[],end:null};
  G=null; await newRun(o.seed*2654435761>>>0);
  let lastFight=-1, fightRec=null;
  while(!G.over && G.fight<o.maxFights){
    if(G.fight!==lastFight){
      lastFight=G.fight;
      fightRec={f:G.fight,kind:G.foe.kind,boss:G.foe.boss||null,hp:G.foe.max,deck:allCards().length,turnWon:0,dealt:G.stats.dealt};
      REC.fights.push(fightRec);
    }
    const f=G.fight, t=G.turn, h=G.hearts;
    await botTurn();
    if(G.fight===f&&!G.over) await endTurn();
    if(G.fight!==f||G.over){ fightRec.won=G.hearts===h&&!(G.over&&G.hearts<=0); fightRec.turnWon=fightRec.won?t:0;
      fightRec.dealt=G.stats.dealt-fightRec.dealt; }
  }
  REC.end={fight:G.fight, over:G.over, hearts:G.hearts, deck:allCards().length, best:G.stats.best, relics:G.relics.map(r=>r.key)};
  if(LOG) REC.log=LOG;
  return REC;
}
