"use strict";
/* Whole game, fresh start to 1e15 power or the time cap, on the real rules.
   node sim/loop.js [seeds=3] [log]      careful and naive upgrade bots, same fight bot.
   Time estimate: 15 s per played turn, 3 s per fight's modals, 5 s per march, 10 s per caravan, 25 s per home visit. */
require('./load.js'); require('./bots.js');
const SEC={turn:15,fight:3,march:5,caravan:10,home:25};
let OPT={};

/* ---- how each upgrader spends ---- */
const defOf=P=>{ let d=maxHpOf(P); for(const c of P.cards){ if(!c.packed&&!onBoard(P,c.id)) continue; for(const [k,x] of CARDS[c.key].fx) if(k==='block') d+=fxAmount(c,k,x)*.8; if(onBoard(P,c.id)) d+=pieceHp(c)*.3; } return d; };
const buyables=P=>P.cards.filter(c=>c.key!=='deed'&&c.key!=='ward'&&(onBoard(P,c.id)||c.packed));
function bestPerks(P,c){ // careful: fill open sockets greedily by what the estimator and the role say
  const n=socketsOpen(P,c); if(!n||OPT.noSock) return; c.sock=[];
  const dmg=CARDS[c.key].fx.some(([k])=>k==='dmg'||k==='poison'||k==='block');
  for(let i=0;i<n;i++){ let best=null,bv=-1; const base=estPower(P);
    for(const k of Object.keys(PERKS)){ if(!perkFits(k,c)||c.sock.includes(k)||(OPT.noCharge&&k==='charge')) continue; c.sock.push(k);
      let v=estPower(P)/base; c.sock.pop();
      if(k==='keen'&&dmg) v=Math.max(v,2.5); if(k==='bulwark') v=Math.max(v,CARDS[c.key].taunt?2.2:1.05); if(k==='swift'||k==='light') v=Math.max(v,1.15); if(k==='primed') v=Math.max(v,1.1);
      if(v>bv){ bv=v; best=k; } }
    if(best) c.sock.push(best); }
}
function layoutCareful(P){
  // Keep every available gun on the board; a shield up front takes the hits and fills first.
  const open=slotsOpen(P), pieces=P.cards.filter(isPiece);
  const score=c=>{ let v=0; for(const [k,x] of CARDS[c.key].fx){ if(k==='dmg') v+=fxAmount(c,k,x)/pieceNeed(c); if(k==='poison') v+=fxAmount(c,k,x)*1.5/pieceNeed(c); } return v; };
  const guns=pieces.filter(c=>score(c)>0).sort((a,b)=>score(b)-score(a)); // the strongest gun goes last in the chain, once the slots are chosen
  const pay=c=>CARDS[c.key].fx.reduce((s,[k,x])=>s+(k==='dmg'||k==='poison'?fxAmount(c,k,x):0),0);
  const front=pieces.filter(c=>CARDS[c.key].taunt||c.key==='stake'||c.key==='bellows').sort((a,b)=>(CARDS[b.key].taunt?1:0)-(CARDS[a.key].taunt?1:0));
  const out=[]; if(front[0]) out.push(front[0]); for(const g of guns){ if(out.length<open) out.push(g); }
  for(const f of front.slice(1)) if(out.length<open) out.push(f);
  for(const c of pieces) if(out.length<open&&!out.includes(c)) out.push(c);
  { const on=out.slice(0,open), fr=on.filter(c=>score(c)===0), gu=on.filter(c=>score(c)>0).sort((a,b)=>pay(a)-pay(b)); out.length=0; out.push(...fr,...gu); }
  P.layout=out.slice(0,open).map(c=>c.id).concat(pieces.filter(c=>!out.slice(0,open).includes(c)).map(c=>c.id)); for(const c of pieces) c.packed=out.slice(0,open).includes(c);
}
function packCareful(P){
  // Deeds as slots are worth having; then the strongest cards by role.
  const cards=P.cards.filter(c=>!isPiece(c)&&c.key!=='deed');
  const pieces=P.cards.filter(isPiece).length;
  const deeds=P.cards.filter(c=>c.key==='deed'); const useDeeds=Math.min(deeds.length,Math.max(0,pieces-2));
  deeds.forEach((d,i)=>d.packed=i<useDeeds);
  const v=c=>{ let s=0; for(const [k,x] of CARDS[c.key].fx) s+=({dmg:1,poison:.8,block:.5,powder:.3,draw:.4,energy:.4})[k]?fxAmount(c,k,x)*({dmg:1,poison:.8,block:.5})[k]||0:0; return s/Math.max(.7,cardCost(c)); };
  const cap=TUNE.deckMax-useDeeds, want=[]; const take=(f,n)=>{ for(const c of cards.filter(f).sort((a,b)=>v(b)-v(a)||b.lvl-a.lvl)){ if(n<=0||want.length>=cap) break; if(!want.includes(c)){ want.push(c); n--; } } };
  take(c=>CARDS[c.key].fx.some(([k])=>k==='dmg'),5); take(c=>CARDS[c.key].fx.some(([k])=>k==='block'),2); take(c=>CARDS[c.key].fx.some(([k])=>k==='powder'||k==='draw'||k==='energy'),2); take(c=>true,Math.max(0,TUNE.deckMin+useDeeds-want.length-useDeeds));
  while(want.length<TUNE.deckMin&&want.length<cards.length){ take(c=>true,1); }
  for(const c of cards) c.packed=want.includes(c);
}
function spendCareful(P){
  layoutCareful(P); packCareful(P); for(const c of P.cards) if(c.key!=='deed') bestPerks(P,c);
  for(let guard=0;guard<4000;guard++){
    const p0=estPower(P), d0=defOf(P), fp=Math.log(p0/TUNE.hp0)/Math.log(TUNE.hpG), fd=Math.log(d0/(5*TUNE.atk0))/Math.log(TUNE.atkG);
    const wantDef=fd<fp; let best=null,bs=0;
    const consider=(cost,gain,fn)=>{ if(cost<=P.coin*1.0001&&gain>0){ const s=gain/cost; if(s>bs){ bs=s; best={fn,cost}; } } };
    for(const c of buyables(P)){
      const m=Math.min(TUNE.mileEvery-(c.lvl%TUNE.mileEvery),10); let cost=0; const L=c.lvl;
      for(let n=1;n<=m;n++){ cost+=levelCost({key:c.key,lvl:L+n-1}); if(n!==1&&n!==m) continue; c.lvl=L+n; const g=wantDef?Math.log(defOf(P)/d0):Math.log(estPower(P)/p0); c.lvl=L; consider(cost,g,(k=>()=>{ for(let i=0;i<k;i++) buyLevel(P,c.id); })(n)); }
    }
    { P.hearth++; const g=wantDef?Math.log(defOf(P)/d0):0; P.hearth--; consider(hearthCost(P),g,()=>buyKeep(P,'hearth')); }
    if(!OPT.noWheel){ consider(wheelCost(P),.15,()=>buyKeep(P,'wheel')); } if(!OPT.noWheel&&!wantDef){ let k=0; for(let n=1;n<=4;n++){ k+=TUNE.wheelCost*Math.pow(TUNE.wheelG,(P.wheelBuys||0)+n-1); P.wheel+=n; const g=Math.log(estPower(P)/p0); P.wheel-=n; consider(k,g,(m=>()=>{ for(let i=0;i<m;i++) buyKeep(P,'wheel'); })(n)); } }
    consider(ledgerCost(P),.26*.5,()=>buyKeep(P,'ledger'));
    if(!best){ // saving for the other side is wasteful: if nothing helps the wanted side, buy the other side once
      break; }
    best.fn();
    for(const c of P.cards) if(c.key!=='deed'&&socketsOpen(P,c)!==c.sock.length) bestPerks(P,c);
  }
}
function spendNaive(P){
  // Cheapest thing, over and over; first perk that fits; bastions join the board if there is room.
  for(const c of P.cards.filter(isPiece)) if(!onBoard(P,c.id)&&P.layout.slice(0,slotsOpen(P)).length<slotsOpen(P)) placePiece(P,c.id,P.layout.length);
  for(const c of P.cards.filter(x=>x.key==='deed')) c.packed=packedCount(P)<TUNE.deckMax||c.packed;
  for(const c of P.cards.filter(x=>!isPiece(x)&&x.key!=='deed')) if(!c.packed&&packedCount(P)<TUNE.deckMax) c.packed=true;
  for(let g=0;g<4000;g++){
    let best=null,bk=Infinity; for(const c of buyables(P)){ const k=levelCost(c); if(k<bk){ bk=k; best=()=>buyLevel(P,c.id); } }
    for(const [w,fn] of [['hearth',hearthCost],['wheel',wheelCost],['mag',magCost],['ledger',ledgerCost]]){ const k=fn(P); if(k<bk){ bk=k; best=()=>buyKeep(P,w); } }
    if(bk>P.coin) break; best();
  }
  for(const c of P.cards){ if(c.key==='deed') continue; const n=socketsOpen(P,c); const list=Object.keys(PERKS).filter(k=>perkFits(k,c)); c.sock=[]; for(let i=0;i<n;i++){ const j=Math.floor(hash01(c.id*31+i,P.seed)*list.length); c.sock.push(list.splice(j,1)[0]); } }
}
function caravanPick(P,T,kind,rs){
  const o=T.offer; if(T.coin+P.coin<o.price) return caravanLeave(P,T);
  if(kind==='naive') return caravanBuy(P,T,0);
  const pieces=P.cards.filter(isPiece).length, free=P.slots>pieces;
  const v=it=>{ const d=CARDS[it.key]; let s=0; for(const [k,x] of d.fx) s+=({dmg:1,poison:.8,block:.3,energy:6,draw:5,powder:4})[k]?x*({dmg:1,poison:.8,block:.3})[k]||({energy:6,draw:5,powder:4})[k]*2:0; s/=Math.max(.7,d.piece?d.need/1.6:d.cost); if(d.piece) s*=free?4:1.5; return s; };
  let bi=0,bv=-1; o.items.forEach((it,i)=>{ const x=v(it); if(x>bv){ bv=x; bi=i; } });
  return caravanBuy(P,T,bi);
}
function rewardPick(P,T,kind){ const a=T.offer.rewards; let k=a[0]; if(kind!=='naive'){ const pri=['slot4','slot3','slot2','slot1','energy2','energy1','hand1','sluice','hand2','socket','magz']; const hasPieces=P.cards.filter(isPiece).length>P.slots; k=pri.find(x=>a.includes(x)&&(!x.startsWith('slot')||hasPieces||true))||a[0]; } takeReward(P,T,k); }

/* ---- whole game ---- */
function runGame(seed,kind,o={}){
  OPT=o; const P=newProfile(seed), rs={s:seed*7|0}, spend=kind==='naive'?spendNaive:spendCareful; let plays=0,burns=0; const tripMins=[], fightBot=o.fightBot||'think';
  let sec=0, bursts=[], last=estPower(P), marks={}, bands={hi:0,mid:0,lo:0}, nonFinite=0, log=[], turnsTotal=0, handDmg=0, boardDmg=0, handBy=[];
  const cap=(o.capMin||400)*60, samples=o.samples||24;
  const mark=()=>{ const p=estPower(P); for(const m of [1e6,1e9,1e12,1e15]) if(p>=m&&marks[m]==null) marks[m]=sec; return p; };
  while(sec<cap){
    // home
    const before=estPower(P); spend(P); sec+=SEC.home; const after=mark();
    if(after/before>=1.5||P.trips===0) bursts.push(sec);
    if(after>=(o.target||1e15)) break;
    // trip
    const T=startTrip(P); const tripStart=sec; sec+=T.stat.marched?SEC.march:0; bands.hi+=T.stat.marched?SEC.march:0;
    let how=null, g=0;
    while(!how&&g++<400){
      if(T.phase==='caravan'){ sec+=SEC.caravan; const b0=estPower(P); caravanPick(P,T,kind,rs); if(T.phase==='caravan') caravanLeave(P,T); if(T.stat.marched) {} continue; }
      if(T.phase==='prefight'||T.phase==='postfight'){
        if(T.phase==='postfight'){ tripAdvance(P,T); if(T.phase==='caravan') continue; }
        const R=oddsAt(P,T.f);
        const go=kind==='naive'||o.neverRetreat?true:!(R<(o.retreatR||.75)||(T.hp/T.maxHp<.35&&R<1.6))||(T.stat.fights===0&&T.stat.marched===0);
        if(!go||(o.farm&&T.stat.marched>0&&T.stat.fights===0)){ how='retreat'; break; }
        const t0=T.stat.turns; playFight(P,T,fightBot,rs,{samples});
        const dt=(T.stat.turns-t0)*SEC.turn+SEC.fight; sec+=dt; turnsTotal+=T.stat.turns-t0;
        if(R>=2) bands.hi+=dt; else if(R>=1) bands.mid+=dt; else bands.lo+=dt;
        if(!allFinite(T)||!allFinite(P)) nonFinite++;
        if(T.phase==='bossreward'){ rewardPick(P,T,kind); bursts.push(sec); mark(); }
        if(T.F.over==='loss'||T.phase==='defeat') how='defeat';
        continue;
      }
      break;
    }
    if(!how) how='retreat';
    handDmg+=T.stat.dmgHand; boardDmg+=T.stat.dmgBoard;
    if(T.stat.dmgHand+T.stat.dmgBoard>0) handBy.push({p:after,share:T.stat.dmgHand/(T.stat.dmgHand+T.stat.dmgBoard)});
    plays+=T.stat.plays||0; burns+=T.stat.burns||0; tripMins.push((sec-tripStart)/60);
    const r=endTrip(P,T,how);
    log.push({trip:P.trips,min:(sec/60).toFixed(1),how,f:r.f,got:fmt(r.got),power:fmt(after),jump:(after/before).toFixed(1),fights:r.fights,marched:r.marched,turns:r.turns,wheel:P.wheel,lost:r.lostPieces,ledger:P.ledger,slots:slotsOpen(P),pcs:P.cards.filter(isPiece).length,top:Math.max(...P.cards.map(c=>c.lvl))});
  }
  return {P,sec,bursts,marks,bands,nonFinite,log,handBy,plays,burns,turns:turnsTotal,tripMins,handShare:handDmg/(handDmg+boardDmg||1)};
}
if(require.main===module){
  const seeds=+process.argv[2]||3, wantLog=process.argv[3]==='log', kinds=(process.argv[4]||'careful,naive').split(',');
  for(const kind of kinds){
    const rs=[]; for(let s=1;s<=seeds;s++){ rs.push(runGame(s*97+3,kind,{capMin:+process.env.CAP||400,target:+process.env.TARGET||1e15,samples:+process.env.SAMPLES||24})); }
    console.log(`\n=== ${kind} ===`);
    for(const r of rs){ const q=m=>r.marks[m]==null?'never':(r.marks[m]/60).toFixed(0)+'m';
      const gaps=[]; for(let i=1;i<r.bursts.length;i++) gaps.push((r.bursts[i]-r.bursts[i-1])/60); gaps.sort((a,b)=>a-b); const Q=p=>gaps.length?gaps[Math.floor(p*(gaps.length-1))].toFixed(1):'-';
      const tot=r.bands.hi+r.bands.mid+r.bands.lo||1, D=r.P.defeats;
      console.log(`total ${(r.sec/60).toFixed(0)}m trips ${r.P.trips} defeats ${D} | 1e6 ${q(1e6)} 1e9 ${q(1e9)} 1e12 ${q(1e12)} 1e15 ${q(1e15)} | burst gap med ${Q(.5)} p10 ${Q(.1)} p90 ${Q(.9)} | R>=2 ${(100*r.bands.hi/tot).toFixed(0)}% 1-2 ${(100*r.bands.mid/tot).toFixed(0)}% <1 ${(100*r.bands.lo/tot).toFixed(0)}% | hand ${(100*r.handBy.reduce((s,x)=>s+x.share,0)/Math.max(1,r.handBy.length)).toFixed(0)}% plays ${(r.plays/Math.max(1,r.turns)).toFixed(1)} burns ${(r.burns/Math.max(1,r.turns)).toFixed(1)} | nonfinite ${r.nonFinite} | wheel ${r.P.wheel} slots ${slotsOpen(r.P)}`);
      if(wantLog) for(const l of r.log.slice(0,+process.env.LOGN||60)) console.log(JSON.stringify(l).replace(/"/g,''));
    }
  }
}
if(typeof module!=='undefined') module.exports={runGame};
