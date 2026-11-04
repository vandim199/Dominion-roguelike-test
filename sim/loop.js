"use strict";
/* Whole game, fresh start to the target Power or the time cap, on the real rules.
   node sim/loop.js [seeds=3] [log] [careful,naive]
   Fights run on the game's own clock at a set tap rate (default 4 a second).
   Time outside fights is an estimate: 25 s per home visit, 5 s per march, 10 s per caravan, 1 s between fights. */
require('./load.js');
const SEC={home:25,march:5,caravan:10,between:1};
let OPT={};

/* ---- how a careful player judges a deck: test-fire it ---- */
const quick=P=>testFire(P,{seeds:1,dt:.2,rate:OPT.rate==null?TUNE.powTap:OPT.rate});
function defOf(P,st){ let d=maxHpOf(P)+st.block/st.secs*TUNE.swing*2; for(const id of P.layout.slice(0,slotsOpen(P))) d+=pieceHp(cardOf(P,id))*.3; return d; }
function score(P){ const st=quick(P); return Math.log(Math.max(1,st.dmg))+.6*Math.log(defOf(P,st)); }
const buyables=P=>P.cards.filter(c=>c.key!=='deed'&&(onBoard(P,c.id)||(c.packed&&!isPiece(c))));
function bestPerks(P,c){
  const n=socketsOpen(P,c); if(!n||OPT.noSock){ c.sock=[]; return; } c.sock=[];
  for(let i=0;i<n;i++){ let best=null,bv=-Infinity;
    for(const k of Object.keys(PERKS)){ if(!perkFits(k,c)||c.sock.includes(k)||(OPT.noCharge&&k==='charge')) continue; c.sock.push(k); const v=score(P); c.sock.pop(); if(v>bv){ bv=v; best=k; } }
    if(best) c.sock.push(best); }
}
function layoutCareful(P){
  const open=slotsOpen(P), pieces=P.cards.filter(isPiece); const on=[], rest=pieces.slice();
  P.layout=[];
  while(on.length<open&&rest.length){ let bi=0,bv=-Infinity; rest.forEach((c,i)=>{ P.layout=on.map(x=>x.id).concat(c.id); const v=score(P); if(v>bv){ bv=v; bi=i; } }); on.push(rest.splice(bi,1)[0]); P.layout=on.map(x=>x.id); }
  // Order: a pass of adjacent swaps, since Powder runs left to right.
  for(let i=0;i+1<on.length;i++){ const base=score(P), a=P.layout; [a[i],a[i+1]]=[a[i+1],a[i]]; if(score(P)<=base) [a[i],a[i+1]]=[a[i+1],a[i]]; }
  P.layout=P.layout.concat(rest.map(c=>c.id));
}
function packCareful(P){
  const all=P.cards.filter(c=>!isPiece(c)&&c.key!=='deed');
  for(let it=0;it<8;it++){
    const base=score(P); let best=null,bv=base+.001;
    const inn=all.filter(c=>c.packed), out=all.filter(c=>!c.packed), cnt=packedCount(P);
    const tryIt=(a,b)=>{ if(a) a.packed=false; if(b) b.packed=true; const v=score(P); if(a) a.packed=true; if(b) b.packed=false; if(v>bv){ bv=v; best=[a,b]; } };
    if(cnt<TUNE.deckMax) for(const b of out) tryIt(null,b);
    if(inn.length>TUNE.deckMin-deedsPacked(P)&&cnt>TUNE.deckMin) for(const a of inn) tryIt(a,null);
    for(const a of inn) for(const b of out) tryIt(a,b);
    if(!best) break; if(best[0]) best[0].packed=false; if(best[1]) best[1].packed=true;
  }
}
function deedsCareful(P){
  const deeds=P.cards.filter(c=>c.key==='deed'), pieces=P.cards.filter(isPiece).length; if(!deeds.length) return;
  let bk=0,bv=-Infinity;
  for(let k=0;k<=Math.min(deeds.length,Math.max(0,pieces-TUNE.startBoard.length));k++){ deeds.forEach((d,i)=>d.packed=i<k); layoutCareful(P); const v=score(P); if(v>bv){ bv=v; bk=k; } }
  deeds.forEach((d,i)=>d.packed=i<bk); layoutCareful(P);
}
function rebuildDeck(P){ if(OPT.noDeck) return; deedsCareful(P); layoutCareful(P); packCareful(P); for(const c of buyables(P)) if(socketsOpen(P,c)!==c.sock.length) bestPerks(P,c); }
function spendCareful(P){
  rebuildDeck(P);
  for(let guard=0;guard<600;guard++){
    const st0=quick(P), p0=st0.dmg, d0=defOf(P,st0), fp=Math.log(Math.max(1,p0)/TUNE.hp0)/Math.log(TUNE.hpG), fd=Math.log(d0/(5*TUNE.atk0))/Math.log(TUNE.atkG);
    const wantDef=fd<fp; let best=null,bs=0;
    const gain=()=>{ const st=quick(P); return wantDef?Math.log(defOf(P,st)/d0):Math.log(Math.max(1,st.dmg)/Math.max(1,p0)); };
    const consider=(cost,g,fn)=>{ if(cost<=P.coin*1.0001&&g>0){ const s=g/cost; if(s>bs){ bs=s; best=fn; } } };
    for(const c of buyables(P)){
      const m=TUNE.mileEvery-(c.lvl%TUNE.mileEvery); let cost=0; const L=c.lvl;
      for(let n=1;n<=m;n++){ cost+=levelCost({key:c.key,lvl:L+n-1}); if(n!==1&&n!==m) continue; if(cost>P.coin) break; c.lvl=L+n; const g=gain(); c.lvl=L; consider(cost,g,(k=>()=>{ for(let i=0;i<k;i++) buyLevel(P,c.id); })(n)); }
    }
    { P.hearth++; const g=wantDef?gain():0; P.hearth--; consider(hearthCost(P),g,()=>buyKeep(P,'hearth')); }
    if(!OPT.noWheel&&wheelCost(P)<=P.coin){ P.wheel++; const g=gain(); P.wheel--; consider(wheelCost(P),g,()=>buyKeep(P,'wheel')); }
    if(!OPT.noAuto&&autoCost(P)<=P.coin){ P.auto+=TUNE.autoStep; const g=gain(); P.auto-=TUNE.autoStep; consider(autoCost(P),g,()=>buyKeep(P,'auto')); }
    consider(ledgerCost(P),.13,()=>buyKeep(P,'ledger'));
    if(!best) break;
    best();
    for(const c of buyables(P)) if(socketsOpen(P,c)!==c.sock.length) bestPerks(P,c);
  }
}
function spendNaive(P){
  // Everything goes in the pack, bastions fill the slots as they come, and the cheapest thing gets bought over and over. Sockets are filled at random.
  for(const c of P.cards.filter(isPiece)) if(!P.layout.includes(c.id)) P.layout.push(c.id);
  for(const c of P.cards.filter(x=>x.key==='deed')) c.packed=packedCount(P)<TUNE.deckMax||c.packed;
  for(const c of P.cards.filter(x=>!isPiece(x)&&x.key!=='deed')) if(!c.packed&&packedCount(P)<TUNE.deckMax) c.packed=true;
  for(let g=0;g<4000;g++){
    let best=null,bk=Infinity; for(const c of buyables(P)){ const k=levelCost(c); if(k<bk){ bk=k; best=()=>buyLevel(P,c.id); } }
    for(const [w,fn] of [['hearth',hearthCost],['wheel',wheelCost],['auto',autoCost],['ledger',ledgerCost]]){ const k=fn(P); if(k<bk){ bk=k; best=()=>buyKeep(P,w); } }
    if(bk>P.coin) break; best();
  }
  for(const c of P.cards){ if(c.key==='deed') continue; const n=socketsOpen(P,c); const list=Object.keys(PERKS).filter(k=>perkFits(k,c)); c.sock=[]; for(let i=0;i<n&&list.length;i++){ const j=Math.floor(hash01(c.id*31+i,P.seed)*list.length); c.sock.push(list.splice(j,1)[0]); } }
}
function caravanPick(P,T,kind){
  const o=T.offer; if(T.coin+P.coin<o.price) return caravanLeave(P,T);
  if(kind==='naive') return caravanBuy(P,T,0);
  // Try each on: does the deck test better with it in? Packs and layouts are put back afterwards.
  const snap=JSON.stringify({l:P.layout,c:P.cards.map(c=>c.packed)}), base=score(P);
  let bi=0,bv=-Infinity;
  o.items.forEach((it,i)=>{ const c=addCard(P,it.key,it.lvl,false); let v;
    if(isPiece(c)){ const open=slotsOpen(P), l=P.layout.slice(); let top=-Infinity; for(let s=0;s<open;s++){ P.layout=l.slice(0,open); if(s<P.layout.length) P.layout[s]=c.id; else P.layout.push(c.id); top=Math.max(top,score(P)); } v=top; P.layout=l; }
    else { let top=-Infinity; for(const x of P.cards.filter(y=>y.packed&&!isPiece(y)&&y.id!==c.id)){ x.packed=false; c.packed=true; top=Math.max(top,score(P)); x.packed=true; } c.packed=false; v=top; }
    P.cards.pop(); P.nid--; if(v>bv){ bv=v; bi=i; } });
  const s=JSON.parse(snap); P.layout=s.l; P.cards.forEach((c,i)=>c.packed=s.c[i]);
  return caravanBuy(P,T,bi);
}
function rewardPick(P,T,kind){ const a=T.offer.rewards; let k=a[0]; if(kind!=='naive'){ const pri=['slot4','slot3','slot2','slot1','hot2','hot1','crit2','crit1','riffle','page','sluice','socket']; k=pri.find(x=>a.includes(x))||a[0]; } takeReward(P,T,k); }

/* ---- whole game ---- */
function runGame(seed,kind,o={}){
  OPT=o; const P=newProfile(seed), spend=kind==='naive'?spendNaive:spendCareful, rate=o.rate==null?TUNE.powTap:o.rate;
  let sec=0, bursts=[], marks={}, bands={hi:0,mid:0,lo:0}, nonFinite=0, log=[], hand=0, board=0, tripMins=[], fightSecs=[], shareBy=[], plays=0;
  const cap=(o.capMin||400)*60;
  const mark=()=>{ const p=estPower(P); for(const m of [1e6,1e9,1e12,1e15]) if(p>=m&&marks[m]==null) marks[m]=sec; return p; };
  let last=estPower(P);
  while(sec<cap){
    const before=last; spend(P); sec+=SEC.home; const after=mark(); last=after;
    if(after/Math.max(1,before)>=2) bursts.push(sec);
    if(after>=(o.target||1e15)) break;
    const T=startTrip(P), tripStart=sec; if(T.stat.marched) sec+=SEC.march;
    let how=null, g=0;
    while(!how&&g++<400){
      if(T.phase==='caravan'){ sec+=SEC.caravan; caravanPick(P,T,kind); if(T.phase==='caravan') caravanLeave(P,T); continue; }
      if(T.phase==='prefight'||T.phase==='postfight'){
        if(T.phase==='postfight'){ tripAdvance(P,T); if(T.phase==='caravan') continue; }
        const wc=winChance(P,T.f,T,5);
        const go=kind==='naive'||o.neverRetreat?true:wc>=(o.leaveBelow==null?.5:o.leaveBelow)||T.stat.fights===0;   // a person tries at least one real fight a trip
        if(!go){ how='retreat'; break; }
        beginFight(P,T); const dt=runFight(P,T,rate,.1,240)+SEC.between; sec+=dt; fightSecs.push(dt);
        if(wc>=.8) bands.hi+=dt; else if(wc>=.5) bands.mid+=dt; else bands.lo+=dt;
        if(!allFinite(T)||!allFinite(P)) nonFinite++;
        if(T.phase==='bossreward'){ rewardPick(P,T,kind); bursts.push(sec); }
        if(T.F.over==='loss'||T.phase==='defeat') how='defeat';
        continue;
      }
      break;
    }
    if(!how) how='retreat';
    hand+=T.stat.dmgHand; board+=T.stat.dmgBoard; plays+=T.stat.plays; tripMins.push((sec-tripStart)/60);
    if(T.stat.dmgHand+T.stat.dmgBoard>0) shareBy.push({p:after,share:T.stat.dmgHand/(T.stat.dmgHand+T.stat.dmgBoard)});
    const r=endTrip(P,T,how);
    log.push({trip:P.trips,min:(sec/60).toFixed(1),how,f:r.f,got:fmt(r.got),power:fmt(after),jump:(after/Math.max(1,before)).toFixed(1),fights:r.fights,marched:r.marched,lost:r.lostPieces,hand:shareBy.length?Math.round(shareBy[shareBy.length-1].share*100)/100:0,wheel:P.wheel,auto:P.auto,ledger:P.ledger,slots:slotsOpen(P),pack:packedCount(P),top:Math.max(...P.cards.map(c=>c.lvl))});
  }
  return {P,sec,bursts,marks,bands,nonFinite,log,tripMins,fightSecs,shareBy,handShare:hand/(hand+board||1),plays};
}
if(require.main===module){
  const seeds=+process.argv[2]||3, wantLog=process.argv[3]==='log', kinds=(process.argv[4]||'careful,naive').split(',');
  for(const kind of kinds){
    console.log(`\n=== ${kind} ===`);
    for(let s=1;s<=seeds;s++){ const t0=Date.now(), r=runGame(s*97+3,kind,{capMin:+process.env.CAP||400,target:+process.env.TARGET||1e15}), q=m=>r.marks[m]==null?'never':(r.marks[m]/60).toFixed(0)+'m';
      const gaps=[]; for(let i=1;i<r.bursts.length;i++) gaps.push((r.bursts[i]-r.bursts[i-1])/60); gaps.sort((a,b)=>a-b); const Q=p=>gaps.length?gaps[Math.floor(p*(gaps.length-1))].toFixed(1):'-';
      const tot=r.bands.hi+r.bands.mid+r.bands.lo||1, med=a=>{ const b=a.slice().sort((x,y)=>x-y); return b.length?b[Math.floor(b.length/2)]:0; };
      console.log(`total ${(r.sec/60).toFixed(0)}m trips ${r.P.trips} defeats ${r.P.defeats} | 1e6 ${q(1e6)} 1e9 ${q(1e9)} 1e12 ${q(1e12)} 1e15 ${q(1e15)} | burst gap med ${Q(.5)} p10 ${Q(.1)} p90 ${Q(.9)} (n=${gaps.length}) | trip ${med(r.tripMins).toFixed(1)}m fight ${med(r.fightSecs).toFixed(0)}s | win>=80 ${(100*r.bands.hi/tot).toFixed(0)}% 50-80 ${(100*r.bands.mid/tot).toFixed(0)}% <50 ${(100*r.bands.lo/tot).toFixed(0)}% | hand ${(100*r.handShare).toFixed(0)}% | nonfinite ${r.nonFinite} | wheel ${r.P.wheel} auto ${r.P.auto} slots ${slotsOpen(r.P)} | ran ${((Date.now()-t0)/1000).toFixed(1)}s`);
      if(wantLog) for(const l of r.log.slice(0,+process.env.LOGN||60)) console.log(JSON.stringify(l).replace(/"/g,''));
    }
  }
}
if(typeof module!=='undefined') module.exports={runGame,spendCareful,spendNaive,rebuildDeck,score,quick,defOf,bestPerks,layoutCareful,packCareful,setOpt:o=>{OPT=o;}};
