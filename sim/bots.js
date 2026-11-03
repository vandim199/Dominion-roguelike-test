"use strict";
/* Bots that play fights through the real rules (js/game.js). */
const D=require('../js/data.js'); Object.assign(globalThis,D);
const G=require('../js/game.js');
const {playCard,swapBases,endTurn,autoTurn,cloneT,cardCost,shuffle,fightCoin}=G;
const {BASTIONS,CARDS}=D;
if(process.env.TUNE) Object.assign(D.TUNE,JSON.parse(process.env.TUNE));   // experiments: TUNE='{"atk0":12}' node sim/...

function legal(T){
  const out=[], seen=new Set();
  T.hand.forEach((c,i)=>{
    const cost=cardCost(T,c); if(cost>T.energy) return;
    if(c.b){ T.board.forEach((b,s)=>{ if(!b) out.push({i,m:0,slot:s}); }); return; }
    const d=CARDS[c.k]; const ms=d.sticky?[0]:d.m.map((_,x)=>x);
    for(const m of ms){ const key=c.k+m; if(!seen.has(key)){ seen.add(key); out.push({i,m}); } }
  });
  if(T.freeSwap>0||T.energy>=D.TUNE.swapCost) for(let a=0;a<T.board.length-1;a++) if(T.board[a]||T.board[a+1]) out.push({swap:[a,a+1]});
  return out;
}
const doAct=(T,a)=>a.swap?swapBases(T,a.swap[0],a.swap[1]):playCard(T,a.i,a.m,a.slot);

const BOTS={
  // floor: random legal actions, stops at random
  random(T,R){ let g=0; while(T.phase==='turn'&&g++<30){ const L=legal(T).filter(a=>!a.swap); if(!L.length||R()<.15) break; doAct(T,L[Math.floor(R()*L.length)]); } },
  // no thinking: Powder first, then damage, then the rest. Never moves a Bastion.
  fixed(T){ autoTurn(T); },
};
// Thinks by playing it out: try each next action, finish the fight with the fixed routine from a reshuffled draw pile, keep the best average.
function rollValue(s,base){
  const baseFrac=s.board.reduce((a,b)=>a+(b?(b.hits?b.hits/b.hitsMax:b.hp/b.max):0),0);
  if(s.phase==='won') return 100+s.hp/s.maxHp*40+baseFrac*8-s.turn*2+(s.coin-base)/fightCoin(s.f)*2;
  return -100-(s.enemy.hp/s.enemy.max)*60;
}
BOTS.thinker=function(T,R,M){ M=M||8; let g=0; const base=T.coin;
  while(T.phase==='turn'&&g++<14){
    let best=null, bv=-Infinity;
    // stopping here is one option: the rollout then ends the turn without further plays
    { let sum=0; for(let i=0;i<M;i++){ const s=cloneT(T); s.seed=Math.floor(R()*2e9)|0; shuffle(s,s.draw); endTurn(s); let h=0; while(s.phase==='turn'&&h++<14){ autoTurn(s); if(s.phase==='turn') endTurn(s); } sum+=rollValue(s,base); } bv=sum/M; }
    for(const a of legal(T)){ const c=cloneT(T); if(!doAct(c,a)) continue;
      let sum=0; for(let i=0;i<M;i++){ const s=cloneT(c); s.seed=Math.floor(R()*2e9)|0; shuffle(s,s.draw); let h=0; while(s.phase==='turn'&&h++<14){ autoTurn(s); if(s.phase==='turn') endTurn(s); } sum+=rollValue(s,base); }
      const v=sum/M; if(v>bv+.01){ bv=v; best=a; } }
    if(!best) break; if(!doAct(T,best)) break;
  }
};
function mkR(seed){ let s=seed|0; return ()=>{ s=(s+0x6D2B79F5)|0; let t=s; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
// Play the current fight to its end.
function playFight(T,bot,R,limit,maxTurns){ const b=BOTS[bot]; let g=0;
  while(T.phase==='turn'&&g++<(maxTurns||40)){ b(T,R,limit); if(T.phase==='turn') endTurn(T); }
  if(T.phase==='turn') T.phase='lost';
  return T.turn; }
module.exports={BOTS,legal,doAct,mkR,playFight};
