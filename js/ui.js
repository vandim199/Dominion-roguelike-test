"use strict";
/* ==========================================================
   Coinkeep: Forays. The screens. All rules live in game.js.
   ========================================================== */
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const UI={P:null,T:null,tab:'board',sel:null,buy:1};
function show(id){ for(const s of ['title','home','fight']) $(s).hidden=s!==id; }
function persist(){ saveGame(UI.P,UI.T); }
const mmss=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');

/* ---------- title ---------- */
function renderTitle(){
  const s=readSave(); show('title');
  $('tSummary').textContent=s?`Deepest fight ${s.P.deepest+1} · ${fmt(s.P.coin)} coin · power ${fmt(estPower(s.P))}`:'';
  $('tPlay').textContent=s?'Continue':'Play'; $('tNew').hidden=!s; $('tNew').textContent='New game'; $('tNew').dataset.arm='';
}
$('tPlay').onclick=()=>{ const s=readSave(); if(s){ UI.P=s.P; UI.T=s.T; } else { UI.P=newProfile((Date.now()%1e9)|0); UI.T=null; persist(); } route(); };
$('tNew').onclick=()=>{ const b=$('tNew'); if(!b.dataset.arm){ b.dataset.arm='1'; b.textContent='Really erase everything?'; return; } UI.P=null; UI.T=null; clearSave(); renderTitle(); };
$('tClassic').onclick=()=>{ location.href='classic/index.html'; };
$('tHow').onclick=()=>howTo();
function howTo(){ sheet(`<h2>How to play</h2>
<p><b>Trips.</b> Leave the Keep and fight deeper and deeper until you go home or get beaten. Going home keeps all your coin, defeat keeps 70%. Nothing else is ever lost. Spend at the Keep, then go again: what beat you dies in the march.</p>
<p><b>Your hand.</b> Each card is a choice. <b>Play</b> it for its effect, paying energy. Or <b>Burn</b> it for Powder: expensive cards burn hotter (cost + 1).</p>
<p><b>The board.</b> Powder runs left to right into your bastions. A full bastion fires at once, once a turn. The Wheel adds Powder every turn. Spare Powder waits in the Magazine, and past that it is wasted.</p>
<p><b>Enemies</b> show what they will do. Aimed hits strike your leftmost bastion (a Gatehouse first), archers the rightmost, and some go straight for you. Block stops everything first. A destroyed bastion goes to your discard and must be drawn and paid for again.</p>
<p><b>Getting strong.</b> Levels multiply a card; every 10 levels pays triple. Levels 5, 20 and 40 open sockets, which you can rearrange free. Caravans come once, every 7 fights. Bosses every 12 fights change the rules. A Title Deed must be packed for each slot past two, and it is dead in your hand.</p>
<button class="btn gold" onclick="closeSheet()">Got it</button>`); }
function sheet(html){ const s=$('sheet'); s.innerHTML='<div class="panel">'+html+'</div>'; s.hidden=false; s.onclick=e=>{ if(e.target===s&&!s.dataset.lock) closeSheet(); }; }
function closeSheet(){ const s=$('sheet'); s.hidden=true; s.dataset.lock=''; }

/* ---------- router ---------- */
function route(){
  const T=UI.T, P=UI.P; closeSheet(); persist();
  if(!T){ renderHome(); return; }
  if(T.marchList&&T.marchList.length) return playMarch();
  if(T.phase==='caravan') return renderCaravan();
  if(T.phase==='prefight') return renderPrefight();
  if(T.phase==='fight') return renderFight();
  if(T.phase==='bossreward') return renderBossReward();
  if(T.phase==='postfight') return renderPostFight();
  if(T.phase==='defeat') return renderDefeat();
  renderHome();
}
function goHome(how){ const P=UI.P,T=UI.T; const secs=P.secs-T.stat.start; const r=endTrip(P,T,how); r.secs=secs; r.rate=r.got/Math.max(30,secs)*60; r.best=P.bestRate; if(r.rate>P.bestRate) P.bestRate=r.rate;
  UI.T=null; UI.sel=null; persist(); renderHome(true); }

/* ---------- home ---------- */
function renderHome(fresh){
  const P=UI.P; show('home');
  const p=estPower(P), reach=marchReach(P), r=fresh&&P.last;
  let html=`<header class="hbar"><div class="coin">🪙 <b>${fmt(P.coin)}</b></div><div class="pow">Power <b>${fmt(p)}</b></div><button class="ghost" onclick="renderTitle()">☰</button></header>`;
  if(r) html+=reportCard(P,r);
  html+=sparkline(P);
  html+=`<div class="go"><button class="btn gold big" onclick="startTripUI()">March ▶<small>${reach>0?`sweeps through ${reach} fight${reach>1?'s':''}, then you take over`:'you fight from the first'}</small></button></div>`;
  html+=scoutRow(P,reach);
  html+=`<div class="modes"><small>Quick buy</small>${[[1,'+1'],[2,'To triple'],[3,'Max']].map(([k,n])=>`<button class="${UI.buy===k?'on':''}" onclick="UI.buy=${k};renderHome()">${n}</button>`).join('')}</div>`;
  html+=`<nav class="tabs">${[['board','Board'],['pack','Pack'],['keep','Keep']].map(([k,n])=>`<button class="${UI.tab===k?'on':''}" onclick="UI.tab='${k}';renderHome()">${n}</button>`).join('')}</nav>`;
  html+=UI.tab==='board'?boardTab(P):UI.tab==='pack'?packTab(P):keepTab(P);
  $('home').innerHTML=html;
}
function reportCard(P,r){
  const head=r.how==='defeat'?`Beaten at fight ${r.f+1}`:`Home from fight ${r.f+1}`;
  const body=r.how==='defeat'?`Kept <b>${fmt(r.got)}</b> coin, ${fmt(r.lost)} dropped. ${P.nemesis?`${ENEMIES[P.nemesis.key].name} had ${Math.round(P.nemesis.left*100)}% left. Odds were ×${ratioAt(P,P.nemesis.f).toFixed(2)}.`:''}`:`Kept all <b>${fmt(r.got)}</b> coin.`;
  const rate=`${mmss(r.secs)} away · ${fmt(r.rate)} coin/min${r.rate>r.best&&r.best>0?' · <b>new best!</b>':r.best?` · best ${fmt(r.best)}`:''}`;
  return `<div class="report ${r.how}"><b>${head}</b><br>${body}<br><small>${rate} · marched ${r.marched}, fought ${r.fights}</small></div>`;
}
function sparkline(P){ const h=(P.hist||[]).slice(-40); if(h.length<2) return ''; const ls=h.map(x=>Math.log10(Math.max(1,x))), a=Math.min(...ls), b=Math.max(...ls,a+.01);
  const pts=ls.map((v,i)=>`${(i/(ls.length-1)*300).toFixed(1)},${(34-(v-a)/(b-a)*30).toFixed(1)}`).join(' ');
  return `<div class="spark"><svg viewBox="0 0 300 36" preserveAspectRatio="none"><polyline points="${pts}"/></svg><small>${fmt(h[0])} → ${fmt(h[h.length-1])} over ${h.length} trips</small></div>`; }
function scoutRow(P,reach){
  let out=''; for(let f=reach;f<reach+5;f++){ const k=enemyKey(P,f), e=ENEMIES[k], R=ratioAt(P,f);
    const tags=(isCaravanF(f)&&!P.caravans[f]?'🐪':'')+(e.boss?'★':''); out+=`<div class="sc ${R<1?'bad':R<2?'mid':'ok'}" title="${esc(e.name)}"><span>${e.art}</span><small>${tags||f+1}</small><b>×${R<10?R.toFixed(1):fmt(R)}</b></div>`; }
  let nb=reach; while(!(isBossF(nb)&&!P.bosses[nb])&&nb<400) nb++; let nc=reach; while(!(isCaravanF(nc)&&!P.caravans[nc])&&nc<400) nc++;
  return `<div class="scout"><small>Ahead</small>${out}</div><p class="note goals">★ Next boss, a new rule: fight ${nb+1} · 🐪 Next caravan: fight ${nc+1}${P.won?' · <b>You felled the last King</b>':''}</p>`;
}
function bundle(P,c){ // what the row's quick button buys in the current mode: one level, up to the next triple, or as many as you can afford
  let n=0,k=0,l=c.lvl, stop=UI.buy===1?1:UI.buy===2?TUNE.mileEvery-(c.lvl%TUNE.mileEvery):1e3;
  while(n<stop){ const x=levelCost({key:c.key,lvl:l}); if(UI.buy===3&&k+x>P.coin) break; k+=x; n++; l++; }
  if(!n){ n=1; k=levelCost(c); } return {n,k}; }
function itemRow(P,c,extra){
  const d=CARDS[c.key], B=bundle(P,c), k=B.k, can=P.coin>=k, mile=TUNE.mileEvery-(c.lvl%TUNE.mileEvery), junk=c.key==='deed'||c.key==='ward';
  return `<div class="row ${extra||''}" onclick="openItem(${c.id})"><span class="art">${d.art}</span><div class="mid"><b>${esc(d.name)}</b>${junk?'':` <small>Lv ${c.lvl}${c.sock.length?' · '+c.sock.map(s=>PERKS[s].name).join(', '):''}</small>`}<div class="dsc">${esc(describe(c))}</div>${junk?'':`<div class="mile" title="next triple"><i style="width:${(1-mile/TUNE.mileEvery)*100}%"></i></div>`}</div>
  ${junk?'':`<button class="buy ${can?'':'off'}" onclick="event.stopPropagation();quick(${c.id})">+${B.n}<small>${fmt(k)}</small></button>`}</div>`;
}
function boardTab(P){
  const open=slotsOpen(P), on=P.layout.slice(0,open);
  let h=`<p class="note">Powder runs left to right. <b>${open}</b> of ${P.slots} slots open${P.slots>open?` (pack a Title Deed for more)`:''}. Wheel: <b>${P.wheel}</b> a turn.</p>`;
  on.forEach((id,i)=>{ h+=itemRow(P,cardOf(P,id)).replace('</div>\n','</div>\n'); });
  for(let i=on.length;i<open;i++) h+=`<div class="row empty">Empty slot: tap a bastion below</div>`;
  const reserve=P.cards.filter(c=>isPiece(c)&&!onBoard(P,c.id));
  if(reserve.length) h+=`<p class="note">Reserve (off the board; packed ones can be drawn and deployed mid-fight)</p>`+reserve.map(c=>itemRow(P,c,'res')).join('');
  return h;
}
function packTab(P){
  const list=P.cards.filter(c=>!isPiece(c)), cnt=packedCount(P);
  let h=`<p class="note">Your pack holds <b>${cnt}</b> cards (${TUNE.deckMin} to ${TUNE.deckMax}). Tap a card to pack, level or socket it. Everything you ever bought stays here.</p>`;
  const packed=list.filter(c=>c.packed), vault=list.filter(c=>!c.packed);
  h+=packed.map(c=>itemRow(P,c)).join('');
  if(vault.length) h+=`<p class="note">In the vault</p>`+vault.map(c=>itemRow(P,c,'res')).join('');
  return h;
}
function keepTab(P){
  const row=(art,name,val,what,cost)=>`<div class="row"><span class="art">${art}</span><div class="mid"><b>${name}</b> <small>${val}</small><div class="dsc">${what}</div></div><button class="buy ${P.coin>=cost.k?'':'off'}" onclick="keepBuy('${cost.w}')">+1<small>${fmt(cost.k)}</small></button></div>`;
  return `<p class="note">Rules so far: ${P.energy} energy, ${P.hand} cards in hand, ${P.slots} slots${P.rewards.length?' · '+P.rewards.map(k=>REWARDS[k].name).join(', '):''}.</p>`+
   row('⚙️','The Wheel',`${P.wheel} Powder a turn`,`Each turn it pours Powder in before you act. Your machine alone, on this Powder, sweeps the March: +1 would reach fight ${wheelReachNext(P)+1}, now ${marchReach(P)+1}.`,{k:wheelCost(P),w:'wheel'})+
   row('🔥','The Hearth',`${fmt(maxHpOf(P))} health`,'Your health on every trip.',{k:hearthCost(P),w:'hearth'})+
   row('🧺','The Magazine',`holds ${TUNE.magBase+P.mag}`,'Spare Powder waits here for next turn.',{k:magCost(P),w:'mag'})+
   row('📒','The Ledger',`coin ×${fmt(coinMult(P))}`,'Every bounty pays 25% more, compounding.',{k:ledgerCost(P),w:'ledger'});
}
function wheelReachNext(P){ P.wheel++; const r=marchReach(P); P.wheel--; return r; }
function quick(id){ const P=UI.P,c=cardOf(P,id),B=bundle(P,c); if(P.coin<B.k) return; for(let i=0;i<B.n;i++) if(buyLevel(P,id)) flashMile(c); persist(); renderHome(); }
function keepBuy(w){ if(buyKeep(UI.P,w)){ persist(); renderHome(); } }
function flashMile(c){ if(c.lvl%TUNE.mileEvery===0&&c.lvl>0) banner(`${CARDS[c.key].name} level ${c.lvl}: pays triple!`); else if(TUNE.sockAt.includes(c.lvl)) banner(`${CARDS[c.key].name}: a socket opens`); }
function banner(t){ const b=document.createElement('div'); b.className='banner'; b.textContent=t; $('fx').appendChild(b); setTimeout(()=>b.remove(),1700); }
function openItem(id){
  const P=UI.P, c=cardOf(P,id), d=CARDS[c.key], junk=c.key==='deed'||c.key==='ward', piece=isPiece(c), p0=estPower(P);
  let gain=''; if(!junk){ c.lvl++; const p1=estPower(P); c.lvl--; gain=p1>p0*1.0005?`Power ×${(p1/p0).toFixed(2)}`:'No effect on damage'; }
  let toMile=0,cum=0; if(!junk){ const m=TUNE.mileEvery-(c.lvl%TUNE.mileEvery); let l=c.lvl; for(let i=0;i<m;i++){ cum+=levelCost({key:c.key,lvl:l++}); } toMile=m; }
  let h=`<h2>${d.art} ${esc(d.name)} ${junk?'':`<small>Lv ${c.lvl}</small>`}</h2><p>${esc(describe(c))}</p>`;
  if(piece) h+=`<p class="note">Needs ${pieceNeed(c)} Powder · ${fmt(pieceHp(c))} health · deploy ${cardCost(c)} energy</p>`; else if(!junk) h+=`<p class="note">Costs ${cardCost(c)} energy · burns for ${stokeOf(c)} Powder</p>`;
  if(!junk) h+=`<div class="acts"><button class="btn ${P.coin>=levelCost(c)?'gold':''}" onclick="sheetBuy(${id},1)">+1 level<small>${fmt(levelCost(c))} · ${gain}</small></button><button class="btn ${P.coin>=cum?'gold':''}" onclick="sheetBuy(${id},${toMile})">+${toMile} to triple<small>${fmt(cum)}</small></button></div>`;
  if(!junk){ const n=Math.max(3,socketsOpen(P,c)); h+=`<h3>Sockets</h3><div class="socks">`;
    for(let i=0;i<n+(P.extraSock?1:0)&&i<4;i++){ const need=i<3?TUNE.sockAt[i]:60, open=c.lvl>=need, cur=c.sock[i];
      h+=`<div class="sock ${open?'':'shut'}">${open?(cur?`<b>${PERKS[cur].name}</b>`:'empty'):`Lv ${need}`}</div>`; } h+='</div>';
    if(socketsOpen(P,c)>0){ h+='<div class="perks">'+Object.keys(PERKS).filter(k=>perkFits(k,c)).map(k=>`<button class="perk ${c.sock.includes(k)?'on':''}" onclick="togglePerk(${id},'${k}')"><b>${PERKS[k].name}</b><small>${PERKS[k].text}</small></button>`).join('')+'</div>'; }
  }
  if(piece){ const i=P.layout.indexOf(id), on=onBoard(P,id), open=slotsOpen(P);
    h+='<div class="acts">'; if(on){ if(i>0) h+=`<button class="btn" onclick="movePiece(${id},${i-1})">◀ Left</button>`; if(i<open-1&&i+1<P.layout.length) h+=`<button class="btn" onclick="movePiece(${id},${i+1})">Right ▶</button>`; h+=`<button class="btn" onclick="movePiece(${id},null)">To reserve</button>`; }
    else { if(P.layout.slice(0,open).length<open) h+=`<button class="btn gold" onclick="movePiece(${id},${P.layout.slice(0,open).length})">Put on board</button>`; else h+=[...Array(open).keys()].map(s=>`<button class="btn" onclick="swapIn(${id},${s})">Replace ${esc(CARDS[cardOf(P,P.layout[s]).key].name)}</button>`).join(''); h+=`<button class="btn" onclick="packIt(${id})">${c.packed?'Leave out of pack':'Pack as a card'}</button>`; }
    h+='</div>'; }
  else h+=`<div class="acts"><button class="btn" onclick="packIt(${id})">${c.packed?'Leave in the vault':'Pack it'}</button></div>`;
  h+=`<button class="btn close" onclick="closeSheet();renderHome()">Done</button>`;
  sheet(h);
}
function sheetBuy(id,n){ let any=false; for(let i=0;i<n;i++) if(buyLevel(UI.P,id)){ any=true; flashMile(cardOf(UI.P,id)); } if(any){ persist(); renderHome(); openItem(id); } }
function togglePerk(id,k){ const P=UI.P,c=cardOf(P,id); if(c.sock.includes(k)) c.sock=c.sock.filter(x=>x!==k); else { if(c.sock.length>=socketsOpen(P,c)) c.sock.shift(); c.sock.push(k); } persist(); renderHome(); openItem(id); }
function movePiece(id,slot){ placePiece(UI.P,id,slot); if(slot==null){ const c=cardOf(UI.P,id); c.packed=false; } persist(); renderHome(); openItem(id); }
function swapIn(id,s){ const P=UI.P, out=P.layout[s]; const j=P.layout.indexOf(id); if(j>=0) P.layout.splice(j,1); P.layout[s]=id; cardOf(P,id).packed=true; cardOf(P,out).packed=false; persist(); renderHome(); openItem(id); }
function packIt(id){ if(!togglePack(UI.P,id)) banner(`The pack holds ${TUNE.deckMin} to ${TUNE.deckMax} cards`); persist(); renderHome(); openItem(id); }

/* ---------- trip ---------- */
function startTripUI(){ const P=UI.P; (P.hist=P.hist||[]).push(estPower(P)); UI.T=startTrip(P); route(); }
function playMarch(){
  const T=UI.T, P=UI.P, list=T.marchList.slice(); T.marchList=[];
  const m=$('march'); m.hidden=false; const tail=list.slice(-14), head=list.length-tail.length;
  let coin=list.slice(0,head).reduce((s,x)=>s+x.coin,0), i=0, done=false;
  const nem=P.nemesis; const step=Math.min(240,3000/Math.max(1,tail.length));
  m.innerHTML=`<div class="mbox"><h2>The March</h2><div id="mEnemy" class="menemy"></div><div id="mBig" class="mbig"></div><div class="mcoin">🪙 <b id="mCoin">${fmt(coin)}</b></div><div id="mNote" class="mnote"></div><small>tap to skip</small></div>`;
  const finish=()=>{ if(done) return; done=true; clearInterval(iv); m.hidden=true; m.onclick=null; persist(); route(); };
  m.onclick=finish;
  const iv=setInterval(()=>{
    if(i>=tail.length){ finish(); return; }
    const x=tail[i++], e=ENEMIES[x.key]; coin+=x.coin;
    $('mEnemy').innerHTML=`<span class="kill">${e.art}</span><b>${esc(e.name)}</b><small>fight ${x.f+1}</small>`;
    $('mBig').textContent=`${fmt(x.hp*Math.max(1,x.over))}!`; $('mBig').className='mbig '+(x.over>30?'huge':x.over>8?'large':''); $('mBig').style.animation='none'; void $('mBig').offsetWidth; $('mBig').style.animation='';
    $('mCoin').textContent=fmt(coin);
    if(nem&&x.f===nem.f){ $('mNote').innerHTML=`<b>Your nemesis falls!</b> It beat you last trip. Today: ${x.over>=1?'×'+fmt(x.over)+' overkill':'gone'}.`; }
  },step);
}
function renderCaravan(){
  const T=UI.T,P=UI.P,o=T.offer; show('fight'); $('fight').innerHTML=''; const have=T.coin+P.coin;
  sheetLock(`<h2>🐪 A caravan</h2><p>It comes this way once, and you can buy one thing. <b>${fmt(o.price)}</b> coin, you have ${fmt(have)}. It stays in your collection for good.</p>`+
   o.items.map((it,i)=>{ const c={key:it.key,lvl:it.lvl,sock:[]},d=CARDS[it.key]; return `<button class="offer ${have>=o.price?'':'off'}" onclick="buyCaravan(${i})"><span class="art">${d.art}</span><div class="mid"><b>${esc(d.name)}</b> <small>${d.piece?'Bastion':'Card'} · Lv ${it.lvl} · ${d.piece?`needs ${pieceNeed(c)} Powder`:`cost ${d.cost}`}</small><div class="dsc">${esc(describe(c))}</div></div></button>`; }).join('')+
   `<button class="btn" onclick="caravanLeave(UI.P,UI.T);route()">Let it pass</button>`);
}
function sheetLock(h){ sheet(h); $('sheet').dataset.lock='1'; }
function buyCaravan(i){ if(caravanBuy(UI.P,UI.T,i)){ banner('Bought. Find it in your Pack or Reserve at home.'); route(); } }
function renderBossReward(){
  const T=UI.T; show('fight');
  sheetLock(`<h2>★ The boss falls</h2>${UI.P.won?'<p><b>That was the last of the Hollow Kings. The Keep is safe, and the road still goes on for as long as you care to walk it.</b></p>':''}<p>Choose one change. It lasts forever.</p>`+T.offer.rewards.map(k=>`<button class="offer" onclick="takeReward(UI.P,UI.T,'${k}');route()"><div class="mid"><b>${REWARDS[k].name}</b><div class="dsc">${REWARDS[k].text}</div></div></button>`).join(''));
}
function enemyBrief(P,f){ const k=enemyKey(P,f), e=ENEMIES[k], R=ratioAt(P,f); return {k,e,R,txt:`<span class="big-art">${e.art}</span><b>${esc(e.name)}</b> <small>fight ${f+1}</small><div class="note">${fmt(enemyHp(P,f))} health · odds ×${R<10?R.toFixed(1):fmt(R)} ${R>=2?'(easy)':R>=1?'(fair)':'(against you)'} · bounty ${fmt(bounty(P,f))}</div>`}; }
function hpLine(T){ return `<div class="bar you"><i style="width:${100*T.hp/T.maxHp}%"></i><span>❤ ${fmt(T.hp)} / ${fmt(T.maxHp)}</span></div>`; }
function renderPrefight(){
  const T=UI.T,P=UI.P; show('fight'); renderBoardOnly();
  const b=enemyBrief(P,T.f), nem=P.nemesis&&P.nemesis.f===T.f;
  sheetLock(`<h2>Next up</h2><div class="brief">${b.txt}${nem?'<div class="note"><b>This one beat you last time.</b></div>':''}</div>${hpLine(T)}<p>Trip coin <b>${fmt(T.coin)}</b>.</p>
   <div class="acts"><button class="btn gold" onclick="fightUI()">Fight</button><button class="btn" onclick="goHome('retreat')">Go home, keep it all</button></div>`);
}
function renderPostFight(){
  const T=UI.T,P=UI.P; show('fight'); const F=T.F, b=enemyBrief(P,T.f);
  const risk=fmt(T.coin*(1-TUNE.defeatKeep));
  sheetLock(`<h2>${F.over==='fled'?'It got away':`${ENEMIES[F.key].art} Felled`}</h2><p>${F.over==='fled'?'The Cutpurse ran off with a tenth of your trip coin.':`+${fmt(F.reward)} coin.`} Trip coin <b>${fmt(T.coin)}</b>.${T.nemesisFell?' <b>Your nemesis is dead.</b>':''}</p>${hpLine(T)}<div class="brief">${b.txt}</div>
  <div class="acts"><button class="btn gold" onclick="pressOn()">Press on<small>a defeat drops ${risk}</small></button><button class="btn" onclick="goHome('retreat')">Go home<small>keep ${fmt(T.coin)}</small></button></div>`);
  T.nemesisFell=false;
}
function pressOn(){ tripAdvance(UI.P,UI.T); route(); }
function renderDefeat(){
  const T=UI.T,P=UI.P; show('fight'); const F=T.F; const left=F?F.enemy.hp/F.enemy.maxHp:1;
  sheetLock(`<h2>Beaten</h2><p>${F?`${ENEMIES[F.key].art} ${esc(ENEMIES[F.key].name)} had ${Math.round(left*100)}% left.`:''} You drag home <b>${fmt(T.coin*TUNE.defeatKeep)}</b> of ${fmt(T.coin)} coin. Your cards, levels and Keep are untouched.</p><button class="btn gold" onclick="goHome('defeat')">Home</button>`);
}
function fightUI(){ beginFight(UI.P,UI.T); UI.T.ev=[]; UI.sel=null; route(); }

/* ---------- fight screen ---------- */
function targetName(P,T,a){ const n=b=>b?CARDS[cardOf(P,b.id).key].name:'you';
  if(a.at==='you'||!T.board.length) return 'you'; if(a.at==='all') return 'everything';
  if(a.at==='right') return n(T.board[T.board.length-1]);
  return n(T.board.find(b=>CARDS[cardOf(P,b.id).key].taunt)||T.board[0]); }
function targetIds(P,T){ const ids=new Set(); const F=T.F; for(const a of F.intent){ if(a.hit&&T.board.length){ if(a.at==='left') ids.add((T.board.find(b=>CARDS[cardOf(P,b.id).key].taunt)||T.board[0]).id); if(a.at==='right') ids.add(T.board[T.board.length-1].id); if(a.at==='all') T.board.forEach(b=>ids.add(b.id)); } } return ids; }
function intentHtml(P,T){ const F=T.F; return F.intent.map(a=>{
    if(a.hit) return `<span class="int hit">⚔ ${fmt(intentHit(F,a))} → ${esc(targetName(P,T,a))}</span>`;
    if(a.drain) return `<span class="int">💧 drains ${T.board.length?esc(targetName(P,T,{at:'left'}))+' and ':''}Magazine</span>`;
    if(a.seal) return `<span class="int">🔒 seals ${T.board[0]?esc(CARDS[cardOf(P,T.board[0].id).key].name):'nothing'}</span>`;
    if(a.rubble) return `<span class="int">🪨 adds Rubble to your hand</span>`; return ''; }).join('')+(ENEMIES[F.key].flee?`<span class="int">🏃 flees after turn ${ENEMIES[F.key].flee}</span>`:'')+(F.enemy.wardUp?`<span class="int">🛡 ignores your next hit</span>`:''); }
function pieceHtml(P,T,b,tg){ const c=cardOf(P,b.id),d=CARDS[c.key],need=pieceNeed(c),max=has(c,'twin')?2:1,done=b.fires>=max;
  const pay=d.fx.filter(([k])=>k==='dmg'||k==='block'||k==='poison').map(([k,x])=>fmt(fxAmount(c,k,x)*(T.F&&T.F.whet?T.F.whet:1))+({dmg:'⚔',block:'🛡',poison:'☠'})[k]).join(' ')||(d.fx[0]?d.fx[0][0]:'');
  let pips=''; for(let i=0;i<need;i++) pips+=`<i class="${i<b.fill?'on':''}"></i>`;
  return `<div class="piece ${done?'fired':''} ${b.sealed?'sealed':''} ${tg.has(b.id)?'tgt':''}" data-id="${b.id}"><div class="pa">${d.art}</div><div class="pn">${esc(d.name)}</div><div class="pips">${pips}</div><div class="py">${pay}</div><div class="bar"><i style="width:${100*b.hp/b.maxHp}%"></i></div></div>`; }
function boardHtml(P,T){ const tg=T.F?targetIds(P,T):new Set(), F=T.F;
  return `<div class="board"><div class="wheel"><div class="wa">⚙️</div><small>+${P.wheel}</small><div class="mag" title="Magazine">🧺${F?F.mag:0}/${TUNE.magBase+P.mag}</div></div>${T.board.map(b=>pieceHtml(P,T,b,tg)).join('')}${[...Array(Math.max(0,slotsOpen(P)-T.board.length)).keys()].map(()=>'<div class="piece hole">empty</div>').join('')}</div>`; }
function renderBoardOnly(){ const T=UI.T,P=UI.P; $('fight').innerHTML=boardHtml(P,T); }
function renderFight(){
  const T=UI.T,P=UI.P,F=T.F; show('fight'); if(!F) return route();
  const e=F.enemy, def=ENEMIES[F.key];
  const cardsH=F.hand.map((id,i)=>{ const c=cardOf(P,id),d=CARDS[c.key],can=canPlay(P,T,i),big=(F.boost[id]||1)>1;
    return `<button class="card ${UI.sel===i?'sel':''} ${can?'':'dim'} ${d.junk?'junk':''} ${d.piece?'pc':''}" onclick="selectCard(${i})"><span class="cost">${d.junk?'':cardCost(c)}</span><span class="art">${d.art}</span><span class="nm">${esc(d.name)}</span><span class="val">${cardVal(c,id,F)}${big?' ×3':''}</span><span class="burn">🔥${stokeOf(c)}</span></button>`; }).join('');
  const sel=UI.sel!=null&&F.hand[UI.sel]!=null?cardOf(P,F.hand[UI.sel]):null;
  const detail=sel?`<div class="detail"><div class="dt">${esc(describe(sel))}</div><div class="acts"><button class="btn gold" ${canPlay(P,T,UI.sel)?'':'disabled'} onclick="act('play')">Play${CARDS[sel.key].junk?'':' ('+cardCost(sel)+'⚡)'}</button><button class="btn hot" ${canBurn(P,T,UI.sel)?'':'disabled'} onclick="act('burn')">Burn +${stokeOf(sel)}<small>${burnPreview(P,T,stokeOf(sel))}</small></button></div></div>`
   :`<div class="detail hint"><div>${hintText(P,T)}</div></div>`;
  $('fight').innerHTML=`<div class="tbar"><span>Fight ${F.f+1} · turn ${F.turn}</span><span>🪙 ${fmt(T.coin)}</span></div>
  ${hpLine(T)}
  <div class="enemy ${def.boss?'boss':''}" id="enemy"><div class="ea">${def.art}</div><div class="eb"><b>${esc(def.name)}</b><div class="bar foe"><i style="width:${clamp(100*e.hp/e.maxHp,0,100)}%"></i><span>${fmt(e.hp)} / ${fmt(e.maxHp)}</span></div>
   <div class="ints">${intentHtml(P,T)}${e.poison>0?`<span class="int psn">☠ ${fmt(e.poison)}</span>`:''}${e.hex>0?`<span class="int hexed">🎎 ${e.hex} halved</span>`:''}</div></div></div>
  ${boardHtml(P,T)}
  <div class="status"><span class="energy">⚡ <b>${F.energy}</b></span><span class="blk">🛡 <b>${fmt(F.block)}</b></span>${F.whet>1?`<span class="chg">⚡×${fmt(F.whet)} next</span>`:''}<span class="dk">deck ${F.draw.length} · discard ${F.disc.length}</span></div>
  ${detail}
  <div class="hand">${cardsH}</div>
  <div class="acts end"><button class="btn" onclick="autoTurn()">Auto turn</button><button class="btn gold" id="endBtn" onclick="endT()">End turn</button></div>`;
  playEvents();
}
function cardVal(c,id,F){ const d=CARDS[c.key]; const f=d.fx.find(([k])=>k==='dmg'||k==='block'||k==='poison'); if(!f) return ''; return fmt(fxAmount(c,f[0],f[1])*(F.boost[id]||1))+({dmg:'⚔',block:'🛡',poison:'☠'})[f[0]]; }
function burnPreview(P,T,n){ let left=n; for(const b of (T.F.aim>0?T.board.slice().reverse():T.board)){ const c=cardOf(P,b.id); if(b.sealed||b.fires>=(has(c,'twin')?2:1)) continue; const need=pieceNeed(c)-b.fill; if(need<=left) return `${CARDS[c.key].name} fires`; return `${CARDS[c.key].name} ${b.fill+left}/${pieceNeed(c)}`; } return 'to the Magazine'; }
function hintText(P,T){ const F=T.F; if(P.trips<=2&&F.f<3){ return F.turn===1?'Tap a card. <b>Play</b> spends energy. <b>Burn</b> feeds Powder to the board, left to right.':'A full bastion fires at once. Each fires once a turn. Watch where the enemy will hit.'; }
  const R=ratioAt(P,F.f); return `Odds ×${R<10?R.toFixed(1):fmt(R)}. Tap a card to see it.`; }
function selectCard(i){ UI.sel=UI.sel===i?null:i; renderFight(); }
function act(a){ const T=UI.T,P=UI.P; if(UI.sel==null) return; const i=UI.sel; UI.sel=null; if(doAction(P,T,{a,i})) afterAct(); else renderFight(); }
function endT(){ UI.sel=null; doAction(UI.P,UI.T,{a:'end'}); afterAct(); }
function autoTurn(){ UI.sel=null; fixedTurn(UI.P,UI.T); afterAct(); }
function afterAct(){ const T=UI.T; persist(); if(T.phase==='fight'){ renderFight(); return; }
  // Show the last blows, then move on.
  renderFight(); setTimeout(route,Math.min(900,200+eventsSpan)); }
let eventsSpan=0;
function playEvents(){
  const T=UI.T, ev=(T.ev||[]).filter(e=>e.t!=='feed'||T.ev.length<30); T.ev=[]; if(!ev.length){ eventsSpan=0; return; }
  const step=Math.min(130,900/ev.length); eventsSpan=step*ev.length;
  ev.forEach((e,i)=>setTimeout(()=>{
    const en=$('enemy');
    if(e.t==='dmg'){ floatAt(en,fmt(e.n),e.src==='poison'?'psn':e.over>3?'crit':'dmg'); if(en){ en.classList.remove('shake'); void en.offsetWidth; en.classList.add('shake'); } }
    else if(e.t==='block') floatAt(document.querySelector('.blk'),'+'+fmt(e.n),'blkf');
    else if(e.t==='poison') floatAt(en,'☠'+fmt(e.n),'psn');
    else if(e.t==='coin') floatAt(document.querySelector('.tbar'),'+'+fmt(e.n)+' 🪙','cn');
    else if(e.t==='fire'){ const p=document.querySelector(`.piece[data-id="${e.id}"]`); if(p){ p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash'); } }
    else if(e.t==='hurt'){ const p=document.querySelector(`.piece[data-id="${e.id}"]`); floatAt(p||document.querySelector('.board'),'-'+fmt(e.n),'hurt'); }
    else if(e.t==='lost') banner(`${CARDS[cardOf(UI.P,e.id).key].name} destroyed: back to the discard`);
    else if(e.t==='you') floatAt(document.querySelector('.bar.you'),'-'+fmt(e.n),'hurt');
    else if(e.t==='waste') floatAt(document.querySelector('.mag'),'wasted','hurt');
    else if(e.t==='warded') floatAt(en,'warded!','blkf');
  },i*step));
}
function floatAt(el,txt,cls){ if(!el) return; const r=el.getBoundingClientRect(), d=document.createElement('div'); d.className='float '+cls; d.textContent=txt; d.style.left=(r.left+r.width/2-20+Math.random()*30-15)+'px'; d.style.top=(r.top+r.height/2-10)+'px'; $('fx').appendChild(d); setTimeout(()=>d.remove(),1000); }

/* ---------- clock: real seconds, for the coin-per-minute report ---------- */
setInterval(()=>{ if(UI.P&&!document.hidden&&$('title').hidden) UI.P.secs+=1; },1000);
addEventListener('pagehide',()=>{ if(UI.P) persist(); });
renderTitle();
