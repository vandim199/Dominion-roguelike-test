"use strict";
/* ==========================================================
   Coinkeep: Forays (tap the deck). The screens. All rules live in game.js.
   ========================================================== */
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const UI={P:null,T:null,tab:'board',buy:1,noPress:0,phaseShown:null,lastT:performance.now(),lastSave:0,dps:[],dpsShown:0,sig:'',bsig:'',lastCrit:false,hold:null,holdT:null,callAt:0,heat:0,autoAt:0,nextWc:0,breatherFor:-1};
function show(id){ for(const s of ['title','home','fight']) $(s).hidden=s!==id; }
function persist(){ saveGame(UI.P,UI.T); }
const mmss=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
const pctStr=x=>Math.round(x*100)+'%';

/* ---------- title ---------- */
function renderTitle(){
  const s=readSave(); show('title');
  $('tSummary').textContent=s?`Deepest fight ${s.P.deepest+1} · ${fmt(s.P.coin)} coin · power ${fmt(estPower(s.P))}`:'';
  $('tPlay').textContent=s?'Continue':'Play'; $('tNew').hidden=!s; $('tNew').textContent='New game'; $('tNew').dataset.arm='';
}
$('tPlay').onclick=()=>{ SFX.unlock(); const s=readSave(); if(s){ UI.P=s.P; UI.T=s.T; } else { UI.P=newProfile((Date.now()%1e9)|0); UI.T=null; persist(); } route(); };
$('tNew').onclick=()=>{ const b=$('tNew'); if(!b.dataset.arm){ b.dataset.arm='1'; b.textContent='Really erase everything?'; return; } UI.P=null; UI.T=null; clearSave(); renderTitle(); };
$('tClassic').onclick=()=>{ location.href='classic/index.html'; };
$('tHow').onclick=()=>howTo();
function howTo(){ sheet(`<h2>How to play</h2>
<p><b>Tap the deck.</b> Each tap draws the top card and plays it for free. There is no hand and no energy. The real choices are what you pack and how you level it, at home. Tap fast, or hold the deck to draw steadily.</p>
<p><b>Bastions</b> land on your field when drawn, in the order you set at home. Your field starts every trip empty. Powder runs along them left to right. A full bastion fires, and the Powder moves on to the next, looping back to the first. Cards and the Wheel make Powder.</p>
<p><b>Combos.</b> Every card and firing builds Combo, up to ×3 on everything. Pause and it fades. The same card twice in a row pays ×2, three times ×3. An attack card right after a gun fired, or a gun right after an attack card, is a <b>Crossfire</b>: ×2. Some cards build on these. One in twenty plays is a crit: ×5.</p>
<p><b>Enemies</b> swing on a timer, and the bar shows when. Aimed hits strike your leftmost bastion (a Gatehouse first), archers the rightmost, and some go straight for you. Block stops everything first and empties after each swing. A destroyed bastion goes back in your deck.</p>
<p><b>Trips.</b> After each kill, tap the deck to press on, or go home. Going home between fights keeps all your coin. Being beaten, or running mid-fight, keeps 70%. Marched fights pay a tenth: the real money is at your limit. Nothing else is ever lost.</p>
<p><b>Getting strong.</b> Levels multiply a card; every 10 levels pays triple. Levels 5, 20 and 40 open sockets, which you can rearrange free. Caravans come once, every 7 fights. Bosses every 12 fights change the rules. A Title Deed must be packed for each slot past two, and it does nothing when drawn.</p>
<button class="btn gold" onclick="closeSheet()">Got it</button>`); }
function sheet(html){ const s=$('sheet'); s.innerHTML='<div class="panel">'+html+'</div>'; s.hidden=false; s.onclick=e=>{ if(e.target===s&&!s.dataset.lock) closeSheet(); }; }
function closeSheet(){ const s=$('sheet'); s.hidden=true; s.dataset.lock=''; }

/* ---------- router ---------- */
function route(){
  const T=UI.T, P=UI.P; closeSheet(); persist();
  if(!T){ renderHome(); return; }
  if(T.marchList&&T.marchList.length) return playMarch();
  if(T.phase==='caravan') return renderCaravan();
  if(T.phase==='prefight'){ beginFight(P,T); T.ev=[]; }
  if(T.phase==='bossreward') return renderBossReward();
  if(T.phase==='defeat') return renderDefeat();
  buildFight();
  if(T.phase==='postfight') showBreather();
}
function goHome(how){ const P=UI.P,T=UI.T; const secs=P.secs-T.stat.start; const r=endTrip(P,T,how); r.secs=secs; r.rate=r.got/Math.max(30,secs)*60; r.best=P.bestRate; if(r.rate>P.bestRate) P.bestRate=r.rate;
  UI.T=null; clearHold(); document.body.className=''; persist(); renderHome(true); }

/* ---------- home ---------- */
function renderHome(fresh){
  const P=UI.P; show('home'); closeSheet();
  const p=estPower(P), reach=marchReach(P), r=fresh&&P.last;
  let html=`<header class="hbar"><div class="coin">🪙 <b>${fmt(P.coin)}</b></div><div class="pow">Power <b>${fmt(p)}</b></div><button class="ghost" onclick="renderTitle()">☰</button></header>`;
  if(r) html+=reportCard(P,r);
  html+=sparkline(P);
  html+=`<div class="go"><button class="btn gold big" onclick="startTripUI()">March ▶<small>${reach>0?`sweeps through ${reach} fight${reach>1?'s':''}, then you take over`:'you fight from the first'}</small></button></div>`;
  html+=scoutRow(P,reach);
  html+=readout(P);
  html+=`<div class="modes"><small>Quick buy</small>${[[1,'+1'],[2,'To triple'],[3,'Max']].map(([k,n])=>`<button class="${UI.buy===k?'on':''}" onclick="UI.buy=${k};renderHome()">${n}</button>`).join('')}</div>`;
  html+=`<nav class="tabs">${[['board','Board'],['pack','Pack'],['keep','Keep']].map(([k,n])=>`<button class="${UI.tab===k?'on':''}" onclick="UI.tab='${k}';renderHome()">${n}</button>`).join('')}</nav>`;
  html+=UI.tab==='board'?boardTab(P):UI.tab==='pack'?packTab(P):keepTab(P);
  $('home').innerHTML=html;
}
// What your deck does right now, re-measured after every change, so a swap at home shows at once.
function readout(P){ const st=testFire(P), tot=st.hand+st.board||1;
  return `<div class="readout"><div class="rbar"><i style="width:${100*st.hand/tot}%"></i></div><small><b>${pctStr(st.hand/tot)}</b> cards / <b>${pctStr(st.board/tot)}</b> bastions · ${fmt(st.dmg/st.secs)} damage/s · ${fmt(st.block/st.secs)} block/s · ${(st.powder/st.secs).toFixed(1)} Powder/s · ${(st.plays/st.secs).toFixed(1)} cards/s</small></div>`; }
function reportCard(P,r){
  const head=r.how==='defeat'?`Beaten at fight ${r.f+1}`:r.how==='flee'?`Ran from fight ${r.f+1}`:`Home from fight ${r.f+1}`;
  const body=r.how==='retreat'?`Kept all <b>${fmt(r.got)}</b> coin.`:`Kept <b>${fmt(r.got)}</b> coin, ${fmt(r.lost)} dropped.${r.how==='defeat'&&P.nemesis?` ${ENEMIES[P.nemesis.key].name} had ${Math.round(P.nemesis.left*100)}% left.`:''}`;
  const rate=`${mmss(r.secs)} away · ${fmt(r.rate)} coin/min${r.rate>r.best&&r.best>0?' · <b>new best!</b>':r.best?` · best ${fmt(r.best)}`:''}`;
  return `<div class="report ${r.how}"><b>${head}</b><br>${body}<br><small>${rate} · marched ${r.marched}, fought ${r.fights}</small></div>`;
}
function sparkline(P){ const h=(P.hist||[]).slice(-40); if(h.length<2) return ''; const ls=h.map(x=>Math.log10(Math.max(1,x))), a=Math.min(...ls), b=Math.max(...ls,a+.01);
  const pts=ls.map((v,i)=>`${(i/(ls.length-1)*300).toFixed(1)},${(34-(v-a)/(b-a)*30).toFixed(1)}`).join(' ');
  return `<div class="spark"><svg viewBox="0 0 300 36" preserveAspectRatio="none"><polyline points="${pts}"/></svg><small>${fmt(h[0])} → ${fmt(h[h.length-1])} over ${h.length} trips</small></div>`; }
function scoutRow(P,reach){
  let out=''; for(let f=reach;f<reach+5;f++){ const k=enemyKey(P,f), e=ENEMIES[k], w=winChance(P,f,null,3);
    const tags=(isCaravanF(f)&&!P.caravans[f]?'🐪':'')+(e.boss?'★':''); out+=`<div class="sc ${w<.5?'bad':w<1?'mid':'ok'}" title="${esc(e.name)}"><span>${e.art}</span><small>${tags||f+1}</small><b>${pctStr(w)}</b></div>`; }
  let nb=reach; while(!(isBossF(nb)&&!P.bosses[nb])&&nb<400) nb++; let nc=reach; while(!(isCaravanF(nc)&&!P.caravans[nc])&&nc<400) nc++;
  return `<div class="scout"><small>Ahead</small>${out}</div><p class="note goals">★ Next boss, a new rule: fight ${nb+1} · 🐪 Next caravan: fight ${nc+1}${P.won?' · <b>You felled the last King</b>':''}</p>`;
}
function bundle(P,c){ // what the row's quick button buys in the current mode: one level, up to the next triple, or as many as you can afford
  let n=0,k=0,l=c.lvl, stop=UI.buy===1?1:UI.buy===2?TUNE.mileEvery-(c.lvl%TUNE.mileEvery):1e3;
  while(n<stop){ const x=levelCost({key:c.key,lvl:l}); if(UI.buy===3&&k+x>P.coin) break; k+=x; n++; l++; }
  if(!n){ n=1; k=levelCost(c); } return {n,k}; }
function itemRow(P,c,extra){
  const d=CARDS[c.key], B=bundle(P,c), k=B.k, can=P.coin>=k, mile=TUNE.mileEvery-(c.lvl%TUNE.mileEvery), junk=c.key==='deed';
  return `<div class="row ${extra||''}" onclick="openItem(${c.id})"><span class="art">${d.art}</span><div class="mid"><b>${esc(d.name)}</b>${junk?'':` <small>Lv ${c.lvl}${c.sock.length?' · '+c.sock.map(s=>PERKS[s].name).join(', '):''}</small>`}<div class="dsc">${esc(describe(c))}</div>${junk?'':`<div class="mile" title="next triple"><i style="width:${(1-mile/TUNE.mileEvery)*100}%"></i></div>`}</div>
  ${junk?'':`<button class="buy ${can?'':'off'}" onclick="event.stopPropagation();quick(${c.id})">+${B.n}<small>${fmt(k)}</small></button>`}</div>`;
}
function boardTab(P){
  const open=slotsOpen(P), on=P.layout.slice(0,open);
  let h=`<p class="note">Bastions in these <b>${open}</b> slots${P.slots>open?` (of ${P.slots}: pack a Title Deed for more)`:''} shuffle into your deck. When drawn, each lands in its place. Powder runs left to right, then loops. Wheel: <b>${P.wheel}</b> a second.</p>`;
  on.forEach(id=>{ h+=itemRow(P,cardOf(P,id)); });
  for(let i=on.length;i<open;i++) h+=`<div class="row empty">Empty slot: tap a bastion below</div>`;
  const reserve=P.cards.filter(c=>isPiece(c)&&!onBoard(P,c.id));
  if(reserve.length) h+=`<p class="note">Reserve: not in your deck</p>`+reserve.map(c=>itemRow(P,c,'res')).join('');
  return h;
}
function packTab(P){
  const list=P.cards.filter(c=>!isPiece(c)), cnt=packedCount(P);
  let h=`<p class="note">Your pack holds <b>${cnt}</b> cards (${TUNE.deckMin} to ${TUNE.deckMax}), plus your bastions. A thin deck draws its best cards more often, but reshuffles more. Tap a card to pack, level or socket it.</p>`;
  const packed=list.filter(c=>c.packed), vault=list.filter(c=>!c.packed);
  h+=packed.map(c=>itemRow(P,c)).join('');
  if(vault.length) h+=`<p class="note">In the vault</p>`+vault.map(c=>itemRow(P,c,'res')).join('');
  return h;
}
function keepTab(P){
  const row=(art,name,val,what,cost)=>`<div class="row"><span class="art">${art}</span><div class="mid"><b>${name}</b> <small>${val}</small><div class="dsc">${what}</div></div><button class="buy ${P.coin>=cost.k?'':'off'}" onclick="keepBuy('${cost.w}')">+1<small>${fmt(cost.k)}</small></button></div>`;
  return `<p class="note">Rules so far: Combo to ×${(1+P.comboCap*TUNE.comboStep).toFixed(0)}, ${Math.round(P.crit*100)}% crits, ${P.slots} slots${P.rewards.length?' · '+P.rewards.map(k=>REWARDS[k].name).join(', '):''}.</p>`+
   row('⚙️','The Wheel',`${P.wheel} Powder a second`,'Grinds Powder for your field the whole fight, whether you tap or not.',{k:wheelCost(P),w:'wheel'})+
   row('🧒','The Page',P.auto?`${P.auto} cards a second`:'not hired','Draws cards for you as you fight. Once hired, the Page also presses on by itself when a fight looks safe.',{k:autoCost(P),w:'auto'})+
   row('🔥','The Hearth',`${fmt(maxHpOf(P))} health`,'Your health on every trip.',{k:hearthCost(P),w:'hearth'})+
   row('📒','The Ledger',`coin ×${fmt(coinMult(P))}`,'Every bounty pays 25% more, compounding.',{k:ledgerCost(P),w:'ledger'});
}
function quick(id){ const P=UI.P,c=cardOf(P,id),B=bundle(P,c); if(P.coin<B.k) return; for(let i=0;i<B.n;i++) if(buyLevel(P,id)) flashMile(c); SFX.unlock(); SFX.buy(); persist(); renderHome(); }
function keepBuy(w){ if(buyKeep(UI.P,w)){ SFX.unlock(); SFX.buy(); persist(); renderHome(); } }
function flashMile(c){ if(c.lvl%TUNE.mileEvery===0&&c.lvl>0){ banner(`${CARDS[c.key].name} level ${c.lvl}: pays triple!`); SFX.fanfare(); } else if(TUNE.sockAt.includes(c.lvl)) banner(`${CARDS[c.key].name}: a socket opens`); }
function banner(t){ const b=document.createElement('div'); b.className='banner'; b.textContent=t; $('fx').appendChild(b); setTimeout(()=>b.remove(),1700); }
function openItem(id){
  const P=UI.P, c=cardOf(P,id), d=CARDS[c.key], junk=c.key==='deed', piece=isPiece(c), p0=estPower(P);
  let gain=''; if(!junk){ c.lvl++; const p1=estPower(P); c.lvl--; gain=p1>p0*1.0005?`Power ×${(p1/p0).toFixed(2)}`:'Not more damage'; }
  let toMile=0,cum=0; if(!junk){ const m=TUNE.mileEvery-(c.lvl%TUNE.mileEvery); let l=c.lvl; for(let i=0;i<m;i++){ cum+=levelCost({key:c.key,lvl:l++}); } toMile=m; }
  let h=`<h2>${d.art} ${esc(d.name)} ${junk?'':`<small>Lv ${c.lvl}</small>`}</h2><p>${esc(describe(c))}</p>`;
  if(piece) h+=`<p class="note">Needs ${pieceNeed(c)} Powder · ${fmt(pieceHp(c))} health</p>`;
  if(!junk) h+=`<div class="acts"><button class="btn ${P.coin>=levelCost(c)?'gold':''}" onclick="sheetBuy(${id},1)">+1 level<small>${fmt(levelCost(c))} · ${gain}</small></button><button class="btn ${P.coin>=cum?'gold':''}" onclick="sheetBuy(${id},${toMile})">+${toMile} to triple<small>${fmt(cum)}</small></button></div>`;
  if(!junk){ const n=Math.max(3,socketsOpen(P,c)); h+=`<h3>Sockets</h3><div class="socks">`;
    for(let i=0;i<n+(P.extraSock?1:0)&&i<4;i++){ const need=i<3?TUNE.sockAt[i]:60, open=c.lvl>=need, cur=c.sock[i];
      h+=`<div class="sock ${open?'':'shut'}">${open?(cur?`<b>${PERKS[cur].name}</b>`:'empty'):`Lv ${need}`}</div>`; } h+='</div>';
    if(socketsOpen(P,c)>0){ h+='<div class="perks">'+Object.keys(PERKS).filter(k=>perkFits(k,c)).map(k=>`<button class="perk ${c.sock.includes(k)?'on':''}" onclick="togglePerk(${id},'${k}')"><b>${PERKS[k].name}</b><small>${PERKS[k].text}</small>${k==='echo'?'<small class="gain" id="echoGain">Measuring…</small>':''}</button>`).join('')+'</div>'; }
  }
  if(piece){ const i=P.layout.indexOf(id), on=onBoard(P,id), open=slotsOpen(P);
    h+='<div class="acts">'; if(on){ if(i>0) h+=`<button class="btn" onclick="movePiece(${id},${i-1})">◀ Left</button>`; if(i<open-1&&i+1<P.layout.length) h+=`<button class="btn" onclick="movePiece(${id},${i+1})">Right ▶</button>`; h+=`<button class="btn" onclick="movePiece(${id},null)">To reserve</button>`; }
    else { if(P.layout.slice(0,open).length<open) h+=`<button class="btn gold" onclick="movePiece(${id},${P.layout.slice(0,open).length})">Put on board</button>`; else h+=[...Array(open).keys()].map(s=>`<button class="btn" onclick="swapIn(${id},${s})">Replace ${esc(CARDS[cardOf(P,P.layout[s]).key].name)}</button>`).join(''); }
    h+='</div>'; }
  else h+=`<div class="acts"><button class="btn" onclick="packIt(${id})">${c.packed?'Leave in the vault':'Pack it'}</button></div>`;
  h+=`<button class="btn close" onclick="closeSheet();renderHome()">Done</button>`;
  sheet(h);
  clearTimeout(UI.gainT); if($('echoGain')) UI.gainT=setTimeout(()=>showEchoGain(id),40);   // the sheet shows first: a jumpy deck can take a moment to measure
}
function showEchoGain(id){ const el=$('echoGain'); if(!el) return; const P=UI.P,c=cardOf(P,id);
  if(!deckIds(P).includes(id)){ el.textContent='Not in your deck'; return; }
  const G=perkGain(P,c,'echo'), same=Math.abs(Math.log(G.ratio))<Math.max(.05,2*G.se), amt=same?'about the same damage':`about ×${G.ratio<10?G.ratio.toFixed(1):fmt(G.ratio)} damage`;
  el.textContent=c.sock.includes('echo')?(same?'Adding no clear damage':`Adding ${amt}`):G.out?`Replaces ${PERKS[G.out].name}: ${amt}`:amt[0].toUpperCase()+amt.slice(1);
  el.className='gain '+(same?'':G.ratio>1?'up':'down'); }
function sheetBuy(id,n){ let any=false; for(let i=0;i<n;i++) if(buyLevel(UI.P,id)){ any=true; flashMile(cardOf(UI.P,id)); } if(any){ SFX.unlock(); SFX.buy(); persist(); renderHome(); openItem(id); } }
function togglePerk(id,k){ const P=UI.P,c=cardOf(P,id); if(c.sock.includes(k)) c.sock=c.sock.filter(x=>x!==k); else { if(c.sock.length>=socketsOpen(P,c)) c.sock.shift(); c.sock.push(k); } persist(); renderHome(); openItem(id); }
function movePiece(id,slot){ placePiece(UI.P,id,slot); persist(); renderHome(); openItem(id); }
function swapIn(id,s){ const P=UI.P; const j=P.layout.indexOf(id); if(j>=0) P.layout.splice(j,1); const out=P.layout[s]; P.layout[s]=id; if(out!=null) P.layout.push(out); persist(); renderHome(); openItem(id); }
function packIt(id){ if(!togglePack(UI.P,id)) banner(`The pack holds ${TUNE.deckMin} to ${TUNE.deckMax} cards`); persist(); renderHome(); openItem(id); }

/* ---------- trip ---------- */
function startTripUI(){ const P=UI.P; SFX.unlock(); (P.hist=P.hist||[]).push(estPower(P)); UI.T=startTrip(P); route(); }
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
    $('mCoin').textContent=fmt(coin); SFX.fire(i*2);
    if(nem&&x.f===nem.f){ $('mNote').innerHTML=`<b>Your nemesis falls!</b> It beat you last trip. Today: ${x.over>=1?'×'+fmt(x.over)+' overkill':'gone'}.`; }
  },step);
}
function renderCaravan(){
  const T=UI.T,P=UI.P,o=T.offer; show('fight'); $('fight').innerHTML=''; const have=T.coin+P.coin;
  sheetLock(`<h2>🐪 A caravan</h2><p>It comes this way once, and you can buy one thing. <b>${fmt(o.price)}</b> coin, you have ${fmt(have)}. It stays in your collection for good, ready to pack at home.</p>`+
   o.items.map((it,i)=>{ const c={key:it.key,lvl:it.lvl,sock:[]},d=CARDS[it.key]; return `<button class="offer ${have>=o.price?'':'off'}" onclick="buyCaravan(${i})"><span class="art">${d.art}</span><div class="mid"><b>${esc(d.name)}</b> <small>${d.piece?`Bastion · needs ${pieceNeed(c)} Powder`:'Card'} · Lv ${it.lvl}</small><div class="dsc">${esc(describe(c))}</div></div></button>`; }).join('')+
   `<button class="btn" onclick="caravanLeave(UI.P,UI.T);route()">Let it pass</button>`);
}
function sheetLock(h){ sheet(h); $('sheet').dataset.lock='1'; }
function buyCaravan(i){ if(caravanBuy(UI.P,UI.T,i)){ SFX.fanfare(); banner(UI.T.joined?'Bought. It joins your deck now.':'Bought. No room in the deck: find it at home.'); route(); } }
function renderBossReward(){
  const T=UI.T; show('fight'); SFX.fanfare();
  sheetLock(`<h2>★ The boss falls</h2>${UI.P.won?'<p><b>That was the last of the Hollow Kings. The Keep is safe, and the road still goes on for as long as you care to walk it.</b></p>':''}<p>Choose one change. It lasts forever.</p>`+T.offer.rewards.map(k=>`<button class="offer" onclick="takeReward(UI.P,UI.T,'${k}');route()"><div class="mid"><b>${REWARDS[k].name}</b><div class="dsc">${REWARDS[k].text}</div></div></button>`).join(''));
}
function renderDefeat(){
  const T=UI.T; show('fight'); const F=T.F; const left=F?Math.max(0,F.enemy.hp)/F.enemy.maxHp:1;
  sheetLock(`<h2>Beaten</h2><p>${F?`${ENEMIES[F.key].art} ${esc(ENEMIES[F.key].name)} had ${Math.round(left*100)}% left.`:''} You drag home <b>${fmt(T.coin*TUNE.defeatKeep)}</b> of ${fmt(T.coin)} coin. Your cards, levels and Keep are untouched.</p><button class="btn gold" onclick="goHome('defeat')">Home</button>`);
}

/* ---------- fight screen: built once, then updated in place, so the deck never moves under your thumb ---------- */
function buildFight(){
  const T=UI.T; show('fight'); UI.sig=''; UI.bsig=''; UI.phaseShown=T.phase; UI.dps=[];
  $('fight').innerHTML=`<div class="tbar"><span id="fFight"></span><span class="tcoin">🪙 <b id="fCoin"></b></span><span class="tbtns"><button class="ghost" id="fSound" onclick="toggleSound()">${SFX.on?'🔊':'🔇'}</button><button class="homebtn" id="fHome" onclick="homeBtn()">🏠 Home</button></span></div>
  <div class="bar you" id="fHp"><i></i><span></span></div>
  <div class="enemy" id="enemy"><div class="ea" id="eArt"></div><div class="eb"><div class="ename"><b id="eName"></b><small id="eDps"></small></div><div class="bar foe" id="eHp"><i></i><span></span></div><div class="swing"><i id="eSwing"></i></div><div class="ints" id="eInt"></div></div></div>
  <div class="combo" id="fCombo"><i></i><span></span></div>
  <div class="board" id="fBoard"></div>
  <div class="status" id="fStatus"></div>
  <div class="ribbon" id="fRib"></div>
  <button class="deck" id="fDeck" aria-label="Tap the deck"><span class="back b3"></span><span class="back b2"></span><span class="back b1"><span class="dl" id="dLabel">TAP</span><small id="dSub"></small><span class="reveal" id="dReveal"></span></span><small class="dcount" id="dCount"></small></button>`;
  const d=$('fDeck');
  d.onpointerdown=e=>{ e.preventDefault(); tapUI(false); clearHold(); UI.holdT=setTimeout(()=>{ UI.hold=setInterval(()=>tapUI(true),333); },350); };
  d.onpointerup=d.onpointercancel=d.onpointerleave=clearHold; d.oncontextmenu=e=>e.preventDefault();
  updateFight();
}
function clearHold(){ clearTimeout(UI.holdT); clearInterval(UI.hold); UI.hold=null; }
function toggleSound(){ const on=SFX.toggle(); const b=$('fSound'); if(b) b.textContent=on?'🔊':'🔇'; }
function homeBtn(){ const T=UI.T; if(T.phase==='postfight'){ SFX.buy(); goHome('retreat'); return; }
  sheet(`<h2>Run for it?</h2><p>Going home mid-fight drops 30% of your trip coin, the same as being beaten. Between fights you keep it all.</p><div class="acts"><button class="btn" onclick="closeSheet()">Stay</button><button class="btn hot" onclick="goHome('flee')">Run<small>keep ${fmt(T.coin*TUNE.defeatKeep)} of ${fmt(T.coin)}</small></button></div>`); }
function tapUI(fromHold){
  SFX.unlock(); const T=UI.T,P=UI.P; if(!T||$('fight').hidden||!$('sheet').hidden||!$('march').hidden) return;
  if(T.phase==='postfight'){ if(fromHold||performance.now()<UI.noPress) return; return pressOn(); }
  if(T.phase!=='fight') return;
  if(tapDeck(P,T)){ const d=$('fDeck'); d.classList.remove('kick'); void d.offsetWidth; d.classList.add('kick'); flyCard(); }
  flush();
}
function pressOn(){ const T=UI.T,P=UI.P; tripAdvance(P,T);
  if(T.phase==='prefight'&&!T.marchList.length){ beginFight(P,T); UI.phaseShown='fight'; UI.sig=''; UI.bsig=''; UI.breatherFor=-1; const en=$('enemy'); if(en){ en.classList.remove('next','enter'); void en.offsetWidth; en.classList.add('enter'); } $('fHome').classList.remove('safe'); $('fHome').textContent='🏠 Home'; tapDeck(P,T); flush(); return; }
  route(); }
// Between fights the clock stops. The next enemy waits, with honest odds, until you tap or go home.
function showBreather(){ const T=UI.T,P=UI.P; if(UI.breatherFor===T.f||T.phase!=='postfight') return; UI.breatherFor=T.f; UI.noPress=performance.now()+450; UI.autoAt=performance.now()+1800;
  const f=T.f, nextCaravan=isCaravanF(f)&&!P.caravans[f]; const k=enemyKey(P,f), e=ENEMIES[k]; UI.nextWc=nextCaravan?1:winChance(P,f,T,5);
  const home=$('fHome'); if(home){ home.classList.add('safe'); home.textContent=`🏠 Keep ${fmt(T.coin)}`; }
  const en=$('enemy'); if(!en) return; en.classList.add('next'); en.classList.remove('boss'); if(e.boss) en.classList.add('boss');
  $('eArt').textContent=nextCaravan?'🐪':e.art; $('eName').textContent=nextCaravan?'A caravan ahead':`Next: ${e.name}`; $('eDps').textContent=`fight ${f+1}`;
  $('eHp').querySelector('i').style.width='100%'; $('eHp').querySelector('span').textContent=nextCaravan?'One purchase, once':`${fmt(enemyHp(P,f))} health · bounty ${fmt(bounty(P,f))}`; $('eSwing').style.width='0';
  $('eInt').innerHTML=nextCaravan?'':`<span class="int ${UI.nextWc<.5?'hit':'odds'}">${pctStr(UI.nextWc)} to win as you stand${UI.nextWc<.5?': a defeat drops '+fmt(T.coin*(1-TUNE.defeatKeep)):''}</span>${T.nemesisFell?'<span class="int odds">Your nemesis is dead!</span>':''}`; T.nemesisFell=false;
  updateFight();
}
function targetName(P,T,a){ const n=b=>b?CARDS[cardOf(P,b.id).key].name:'you';
  if(a.at==='you'||!T.board.length) return 'you'; if(a.at==='all') return 'everything';
  if(a.at==='right') return n(T.board[T.board.length-1]);
  return n(T.board.find(b=>CARDS[cardOf(P,b.id).key].taunt)||T.board[0]); }
function targetIds(P,T){ const ids=new Set(); const F=T.F; for(const a of F.intent){ if(a.hit&&T.board.length){ if(a.at==='left') ids.add((T.board.find(b=>CARDS[cardOf(P,b.id).key].taunt)||T.board[0]).id); if(a.at==='right') ids.add(T.board[T.board.length-1].id); if(a.at==='all') T.board.forEach(b=>ids.add(b.id)); } } return ids; }
function intentHtml(P,T){ const F=T.F; return F.intent.map(a=>{
    if(a.hit) return `<span class="int hit">⚔ ${fmt(intentHit(F,a))} → ${esc(targetName(P,T,a))}</span>`;
    if(a.drain) return `<span class="int">💧 drains ${T.board.length?esc(targetName(P,T,{at:'left'})):'your hopper'}</span>`;
    if(a.seal) return `<span class="int">🔒 seals ${T.board[0]?esc(CARDS[cardOf(P,T.board[0].id).key].name):'nothing'}</span>`;
    if(a.rubble) return `<span class="int">🪨 Rubble on your deck</span>`; return ''; }).join('')+(ENEMIES[F.key].flee?`<span class="int">🏃 flees after swing ${ENEMIES[F.key].flee}</span>`:'')+(ENEMIES[F.key].ward?`<span class="int">🛡 ignores its first hit each swing</span>`:''); }
function pieceHtml(P,T,b){ const c=cardOf(P,b.id),d=CARDS[c.key],need=pieceNeed(c);
  const sym={dmg:'⚔',block:'🛡',poison:'☠',coin:'🪙'}, pay=d.fx.filter(([k])=>sym[k]).map(([k,x])=>(k==='coin'?pctStr(fxAmount(c,k,x)):fmt(fxAmount(c,k,x)))+sym[k]).join(' ')||(d.art+' ready');
  let pips=''; for(let i=0;i<need;i++) pips+=`<i></i>`;
  return `<div class="piece" data-id="${b.id}"><div class="pa">${d.art}</div><div class="pn">${esc(d.name)}</div><div class="pips">${pips}</div><div class="py">${pay}</div><div class="bar"><i></i></div></div>`; }
function syncBoard(P,T){ const box=$('fBoard'), open=slotsOpen(P), sig=T.board.map(b=>b.id).join(',')+'/'+open;
  if(sig!==UI.bsig){ UI.bsig=sig; const had=box._ids||[]; box.innerHTML=T.board.map(b=>pieceHtml(P,T,b)).join('')+[...Array(Math.max(0,open-T.board.length)).keys()].map(()=>'<div class="piece hole">empty</div>').join('')+`<div class="wheel"><div class="wa">⚙️</div><small>${P.wheel}/s</small><div class="mag" title="Powder waiting">${T.mag?'🧺'+T.mag:'⟲'}</div></div>`;
    box._ids=T.board.map(b=>b.id); for(const id of box._ids) if(!had.includes(id)){ const el=box.querySelector(`.piece[data-id="${id}"]`); if(el) el.classList.add('landed'); } UI.sig=''; }
  const tg=T.F&&T.phase==='fight'?UI.tgts:new Set();
  T.board.forEach((b,i)=>{ const el=box.querySelector(`.piece[data-id="${b.id}"]`); if(!el) return;
    const ps=el.querySelector('.pips').children; if(el._fill!==b.fill){ el._fill=b.fill; for(let j=0;j<ps.length;j++) ps[j].className=j<b.fill?'on':''; }
    const w=clamp(100*b.hp/b.maxHp,0,100); if(el._hp!==w){ el._hp=w; el.querySelector('.bar i').style.width=w+'%'; }
    el.classList.toggle('cur',i===T.cursor%Math.max(1,T.board.length)); el.classList.toggle('sealed',!!b.sealed); el.classList.toggle('tgt',!!(tg&&tg.has(b.id))); });
  const mg=box.querySelector('.mag'); if(mg) mg.textContent=T.mag?'🧺'+T.mag:'⟲';
}
function updateFight(){
  const T=UI.T,P=UI.P; if(!T||!T.F||!$('fDeck')) return; const F=T.F,e=F.enemy,def=ENEMIES[F.key],live=T.phase==='fight';
  $('fFight').textContent=`Fight ${F.f+1}`; $('fCoin').textContent=fmt(T.coin);
  const yh=$('fHp'); yh.querySelector('i').style.width=clamp(100*T.hp/T.maxHp,0,100)+'%'; yh.querySelector('span').textContent=`❤ ${fmt(T.hp)} / ${fmt(T.maxHp)}`;
  if(live){
    const sig=F.key+'|'+F.turn+'|'+T.board.map(b=>b.id).join(',');
    if(sig!==UI.sig){ UI.sig=sig; UI.tgts=targetIds(P,T); $('eArt').textContent=def.art; $('eName').textContent=def.name; $('enemy').classList.toggle('boss',!!def.boss); $('eInt').innerHTML=intentHtml(P,T); }
    const eh=$('eHp'); eh.querySelector('i').style.width=clamp(100*e.hp/e.maxHp,0,100)+'%'; eh.querySelector('span').textContent=`${fmt(Math.max(0,e.hp))} / ${fmt(e.maxHp)}${e.poison>0?` · ☠ ${fmt(e.poison)}`:''}${e.hex>0?` · 🎎 ${e.hex}`:''}`;
    const sw=$('eSwing'); sw.style.width=clamp(100*F.swing/TUNE.swing,0,100)+'%'; sw.classList.toggle('soon',F.swing<1);
    const now=performance.now(); UI.dps=UI.dps.filter(x=>now-x.t<3000); const d=UI.dps.reduce((s,x)=>s+x.n,0)/3; $('eDps').textContent=d>0?`${fmt(d)}/s`:'';
  }
  syncBoard(P,T);
  const cm=comboMult(P,T), cb=$('fCombo'); cb.querySelector('i').style.width=clamp(100*T.combo/P.comboCap,0,100)+'%'; cb.querySelector('span').textContent=`🔥 Combo ${Math.floor(T.combo)} · ×${cm.toFixed(1)}`; cb.classList.toggle('full',T.combo>=P.comboCap);
  const tier=T.combo>=P.comboCap?3:T.combo>=50?2:T.combo>=25?1:0; if(tier!==UI.heat){ UI.heat=tier; document.body.className=tier?'heat'+tier:''; }
  const am=T.whet*T.chain;
  $('fStatus').innerHTML=`<span class="blk">🛡 <b>${fmt(F.block)}</b></span>${am>1?`<span class="chg">⚡×${fmt(am)} next</span>`:''}${T.anvil?`<span class="chg">⚒️ next card</span>`:''}${F.forge?`<span class="chg">🏭 +${pctStr(F.forge)}</span>`:''}${P.auto?`<span class="pg">🧒 ${P.auto}/s</span>`:''}`;
  const lbl=$('dLabel'), sub=$('dSub');
  if(T.phase==='postfight'){ lbl.textContent='PRESS ON'; sub.textContent='tap the deck'; }
  else if(!F.live){ lbl.textContent='TAP'; sub.textContent=P.trips<=2?'each tap plays the top card, for free':'to start'; }
  else if(T.shuffle>0){ lbl.textContent='SHUFFLING'; sub.textContent=''; }
  else { lbl.textContent='TAP'; sub.textContent=''; }
  $('fDeck').classList.toggle('shuf',T.shuffle>0); $('fDeck').classList.toggle('press',T.phase==='postfight'||!F.live);
  $('dCount').textContent=`deck ${T.draw.length} · discard ${T.disc.length}`;
}
/* Everything the rules just did, on screen. Big chains are thinned so the page keeps up: the largest numbers always show. */
function playEvents(){
  const T=UI.T,P=UI.P, ev=T.ev; if(!ev||!ev.length) return; T.ev=[]; const en=$('enemy'); const hits=[]; let chips=0;
  for(const e of ev){ switch(e.t){
    case 'play': { const c=e.id!=null?cardOf(P,e.id):{key:e.key,lvl:0,sock:[]}, d=CARDS[e.key];
      if(chips++<5) ribbon(d.art,e.dud?'':ribText(c,e),(e.dud?'dud':'')+(e.crit?' crit':'')+(e.cross?' cross':''));
      reveal(d,e.dud?'does nothing':ribText(c,e),(e.dud?'dud':'')+(e.crit?' crit':''));
      if(e.dud) SFX.dud(); else SFX.tap(T.combo);
      if(e.run>=2){ callout(e.run===2?'DOUBLE ×2':e.run===3?'TRIPLE ×3':`${e.run} IN A ROW ×${e.run}`,'run',true); SFX.run(e.run); }
      if(e.cross){ callout('CROSSFIRE ×2','cross'); SFX.cross(); }
      if(e.crit){ UI.lastCrit=true; SFX.crit(); } break; }
    case 'land': { const d=CARDS[cardOf(P,e.id).key]; callout(`${d.art} ${d.name} lands!`,'land',true); reveal(d,'lands on your field',''); SFX.land(); break; }
    case 'fire': { const el=document.querySelector(`.piece[data-id="${e.id}"]`); if(el){ el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } SFX.fire(Math.floor(T.combo/3)); if(e.cross){ callout('CROSSFIRE ×2','cross'); SFX.cross(); } if(e.m>1) callout(`CHAIN ×${fmt(e.m)}`,'chain'); if(e.crit){ UI.lastCrit=true; SFX.crit(); } break; }
    case 'dmg': { UI.dps.push({t:performance.now(),n:e.n}); hits.push({n:e.n,ratio:e.ratio,src:e.src,crit:UI.lastCrit}); UI.lastCrit=false; break; }
    case 'block': if(ev.length<20&&performance.now()-(UI.blkAt||0)>260){ UI.blkAt=performance.now(); floatAt(document.querySelector('.blk'),'+'+fmt(e.n),'blkf'); } break;
    case 'blocked': floatAt(document.querySelector('.blk'),'-'+fmt(e.n),'blkf'); break;
    case 'poison': if(ev.length<20) floatAt(en,'☠'+fmt(e.n),'psn'); break;
    case 'coin': floatAt(document.querySelector('.tcoin'),'+'+fmt(e.n),'cn'); SFX.coin(); break;
    case 'hurt': { const p=document.querySelector(`.piece[data-id="${e.id}"]`); floatAt(p||$('fBoard'),'-'+fmt(e.n),'hurt'); if(p){ p.classList.remove('hit'); void p.offsetWidth; p.classList.add('hit'); } SFX.hurt(); break; }
    case 'lost': banner(`${CARDS[cardOf(P,e.id).key].name} destroyed: back in your deck`); break;
    case 'you': floatAt($('fHp'),'-'+fmt(e.n),'hurt big'); shake(); SFX.hurt(); if(navigator.vibrate) navigator.vibrate(30); break;
    case 'waste': break;
    case 'warded': floatAt(en,'warded!','blkf'); break;
    case 'swing': if(en){ en.classList.remove('lunge'); void en.offsetWidth; en.classList.add('lunge'); } SFX.swing(); break;
    case 'shuffle': SFX.riffle(); break;
    case 'heat': { const name=e.m>=150?'INFERNO!!':e.m>=100?'INFERNO!':e.m>=75?'BLAZING!':e.m>=50?'ON FIRE!':'HOT!'; callout(name,'heat',true); SFX.heat(e.m); break; }
    case 'kill': killFx(e); break;
    case 'fled': callout('It got away!','land',true); break;
  } }
  // The largest hits get a number each. The rest of a big chain are added into one.
  hits.sort((a,b)=>b.n-a.n); const shown=hits.slice(0,4), rest=hits.slice(4).reduce((s,h)=>s+h.n,0);
  for(const h of shown) hitFloat(h); if(rest>0) floatAt(en,`+${fmt(rest)} (${hits.length-4} more)`,'dmg');
  if(hits.length&&en){ en.classList.remove('shake'); void en.offsetWidth; en.classList.add('shake'); }
}
function ribText(c,e){ const d=CARDS[c.key], f=d.fx.find(([k])=>k==='dmg'||k==='block'||k==='poison'||k==='powder'||k==='draw'||k==='combo'); if(!f) return ''; const a=fxAmount(c,f[0],f[1]);
  return f[0]==='powder'?`+${fmt(a*(e.run||1))}`:f[0]==='draw'?`▶${a}`:f[0]==='combo'?`+${fmt(a)}🔥`:fmt(a*(e.mul||1)*comboMult(UI.P,UI.T)); }
// The card you just drew, big, on the face of the deck.
function reveal(d,txt,cls){ const r=$('dReveal'); if(!r) return; r.className='reveal on '+cls; r.innerHTML=`<b>${d.art}</b><span>${esc(d.name)}</span><em>${esc(txt)}</em>`; r.style.animation='none'; void r.offsetWidth; r.style.animation=''; }
function ribbon(art,txt,cls){ const r=$('fRib'); if(!r) return; const s=document.createElement('span'); s.className='chip '+cls; s.innerHTML=`<b>${art}</b><small>${esc(txt)}</small>`; r.prepend(s); while(r.children.length>6) r.lastChild.remove(); }
function flyCard(){ const d=$('fDeck'), box=$('fx'); if(!d||box.childElementCount>40) return; const r=d.getBoundingClientRect(), c=document.createElement('div'); c.className='fly'; c.style.left=(r.left+r.width/2-22+(Math.random()*40-20))+'px'; c.style.top=(r.top+14)+'px'; box.appendChild(c); setTimeout(()=>c.remove(),300); }
function hitFloat(h){ const en=$('eArt'); if(!en) return; const cls=h.src==='poison'?'psn':h.ratio>=1?'n4':h.ratio>=.4?'n3':h.ratio>=.12?'n2':h.ratio>=.03?'n1':'n0'; floatAt(en,(h.crit?'CRIT ':'')+fmt(h.n)+(h.crit?'!':''),'dmg '+cls+(h.crit?' crit':'')+(h.src==='board'?' gun':'')); }
function floatAt(el,txt,cls){ const box=$('fx'); if(!el||box.childElementCount>48) return; const r=el.getBoundingClientRect(), d=document.createElement('div'); d.className='float '+cls; d.textContent=txt; d.style.left=clamp(r.left+r.width/2-30+Math.random()*70-35,4,innerWidth-140)+'px'; d.style.top=(r.top+r.height/2-10+Math.random()*16-8)+'px'; box.appendChild(d); setTimeout(()=>d.remove(),900); }
function callout(t,cls,force){ const now=performance.now(); if(!force&&now-UI.callAt<280) return; UI.callAt=now; const box=$('fx'), bd=$('fBoard'); if(!bd||box.childElementCount>48) return; const r=bd.getBoundingClientRect(), d=document.createElement('div'); d.className='call '+cls; d.textContent=t; d.style.top=(r.top-6+Math.random()*14)+'px'; box.appendChild(d); setTimeout(()=>d.remove(),850); }
function shake(){ const f=$('fight'); f.classList.remove('jolt'); void f.offsetWidth; f.classList.add('jolt'); }
function killFx(e){ const art=$('eArt'), r=art.getBoundingClientRect(), box=$('fx'), d=ENEMIES[e.key];
  SFX.kill(); if(navigator.vibrate) navigator.vibrate(20);
  art.classList.remove('pop'); void art.offsetWidth; art.classList.add('pop');
  floatAt($('fCoin'),'+'+fmt(e.coin),'cn big');
  if(e.over>=2) callout(`OVERKILL ×${e.over>=100?fmt(e.over):e.over.toFixed(0)}`,'heat',true);
  const n=Math.min(14,6+Math.floor(UI.T.F.f/6)), target=$('fCoin').getBoundingClientRect();
  for(let i=0;i<n;i++){ const c=document.createElement('div'); c.className='coinp'; c.textContent=i%4===0?d.art:'🪙'; c.style.left=(r.left+r.width/2)+'px'; c.style.top=(r.top+r.height/2)+'px'; c.style.setProperty('--dx',(Math.random()*180-90)+'px'); c.style.setProperty('--dy',(-40-Math.random()*90)+'px'); c.style.setProperty('--tx',(target.left-r.left-r.width/2)+'px'); c.style.setProperty('--ty',(target.top-r.top-r.height/2)+'px'); c.style.animationDelay=(i*22)+'ms'; box.appendChild(c); setTimeout(()=>c.remove(),900+i*22); }
}

/* ---------- the clock: the fight runs here, about 25 times a second ---------- */
function flush(){ const T=UI.T; if(!T||!T.F||$('fight').hidden) return; if(T.ev&&T.ev.length) playEvents(); if(UI.T!==T) return; updateFight();
  if(T.phase!==UI.phaseShown){ UI.phaseShown=T.phase; clearHold(); persist();
    if(T.phase==='postfight') setTimeout(()=>{ if(UI.T===T) showBreather(); },320);
    else if(T.phase==='bossreward'||T.phase==='defeat') setTimeout(()=>{ if(UI.T===T) route(); },800); } }
setInterval(()=>{ const now=performance.now(), dt=Math.min(.25,(now-UI.lastT)/1000); UI.lastT=now; const T=UI.T,P=UI.P;
  if(!T||!T.F||document.hidden||$('fight').hidden||!$('sheet').hidden||!$('march').hidden) return;
  if(T.phase==='fight'&&T.F.live){ tick(P,T,dt); flush(); if(now-UI.lastSave>3000){ UI.lastSave=now; persist(); } }
  else if(T.phase==='postfight'&&P.auto>0&&UI.breatherFor===T.f&&now>UI.autoAt&&UI.nextWc>=.6) pressOn();
},40);
addEventListener('keydown',e=>{ if(e.code==='Space'&&!$('fight').hidden&&$('sheet').hidden){ e.preventDefault(); tapUI(e.repeat); } });

/* ---------- clock: real seconds, for the coin-per-minute report ---------- */
setInterval(()=>{ if(UI.P&&!document.hidden&&$('title').hidden) UI.P.secs+=1; },1000);
addEventListener('pagehide',()=>{ if(UI.P) persist(); });
renderTitle();
