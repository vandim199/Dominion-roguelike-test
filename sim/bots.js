"use strict";
/* Fight bots, all on the real rules.
   randomTurn: any legal move.  fixedTurn (js/game.js): no thought.
   thinkTurn: samples whole turns on a copy of the fight, with the unseen draw reshuffled, and keeps the turn that scores best after the enemy acts. */
function cloneT(T){ const F=T.F; return {...T,ev:null,stat:{...T.stat},offer:null,board:T.board.map(b=>({...b})),
  F:{...F,enemy:{...F.enemy},draw:F.draw.slice(),hand:F.hand.slice(),disc:F.disc.slice(),boost:{...F.boost}}}; }
function legalMoves(P,T,withSwap){ const F=T.F,out=[]; for(let i=0;i<F.hand.length;i++){ if(canPlay(P,T,i)) out.push({a:'play',i}); if(canBurn(P,T,i)) out.push({a:'burn',i}); }
  if(withSwap&&F.energy>=TUNE.swapCost) for(let i=0;i+1<T.board.length;i++) out.push({a:'swap',i}); out.push({a:'end'}); return out; }
function randomTurn(P,T,rs){ const F=T.F,turn=F.turn; let n=0; while(!F.over&&F.turn===turn&&n++<40){ const ms=legalMoves(P,T,true); const m=ms[Math.floor(rng32(rs,'s')*ms.length)]; doAction(P,T,m); } }
// Scale-free score of a position after the enemy has acted.
function evalT(P,T,turn0){
  const F=T.F;
  if(F.over==='win') return 1000+200*T.hp/T.maxHp+50*(T.board.reduce((s,b)=>s+b.hp/b.maxHp,0))-5*(F.turn-turn0);
  if(F.over==='loss'||T.hp<=0) return -1000+(1-F.enemy.hp/F.enemy.maxHp)*100;
  if(F.over==='fled') return 20;
  const e=F.enemy; let s=0;
  s+=300*(1-Math.max(0,e.hp-e.poison*1.5)/e.maxHp);
  s+=160*T.hp/T.maxHp;
  for(const b of T.board){ s+=26+14*b.hp/b.maxHp; const c=cardOf(P,b.id); s+=6*b.fill/pieceNeed(c); }
  s+=F.mag*2+ e.hex*6;
  return s;
}
function thinkTurn(P,T,rs,samples,opts){
  const F=T.F, turn=F.turn, swap=!opts||opts.swap!==false; let bestSeq=null,bv=-Infinity;
  for(let k=0;k<samples;k++){
    const c=cloneT(T), seq=[]; c.F.rng=(c.F.rng+k*7919+1)|0; shuffle(c.F,c.F.draw);
    let n=0;
    if(k===0){ // the fixed line is always a candidate
      while(!c.F.over&&c.F.turn===turn&&n++<40){ const m=fixedMove(P,c); if(!m) break; seq.push(m); doAction(P,c,m); if(m.a==='end') break; }
    } else while(!c.F.over&&c.F.turn===turn&&n++<30){
      const ms=legalMoves(P,c,swap);
      // lean towards acting: ending the turn is one option among many, and is not taken with energy and cards in hand half the time
      let m=ms[Math.floor(rng32(rs,'s')*ms.length)];
      if(m.a==='end'&&ms.length>1&&rng32(rs,'s')<.7) m=ms[Math.floor(rng32(rs,'s')*(ms.length-1))];
      seq.push(m); doAction(P,c,m);
    }
    const v=evalT(P,c,turn); if(v>bv){ bv=v; bestSeq=seq; }
  }
  for(const m of bestSeq){ if(F.over||F.turn!==turn) break; doAction(P,T,m); }
  if(!F.over&&F.turn===turn) doAction(P,T,{a:'end'});
}
function playTurn(P,T,bot,rs,opts){
  if(bot==='random') randomTurn(P,T,rs); else if(bot==='fixed') fixedTurn(P,T); else thinkTurn(P,T,rs,(opts&&opts.samples)||60,opts);
}
/* Run the fight T is standing at. Returns turns used. */
function playFight(P,T,bot,rs,opts){ beginFight(P,T); const F=T.F; let g=0; while(!F.over&&g++<40) playTurn(P,T,bot,rs,opts); if(!F.over){ F.over='loss'; T.hp=0; T.phase='defeat'; } return F.turn; }
if(typeof module!=='undefined') Object.assign(globalThis,{cloneT,legalMoves,randomTurn,evalT,thinkTurn,playTurn,playFight});
