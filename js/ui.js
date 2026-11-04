"use strict";
/* ==========================================================
   Coinkeep: Forays. The screens. All rules live in game.js:
   this file calls them, then redraws and plays the event list
   they leave in T.ev.
   ========================================================== */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let P=null, T=null, busy=false, tab='spend', pick=null, deploying=null, swapSel=null, power=null, startAt=null, boardSel=null, turnPower=0;

/* ---------- screens ---------- */
function show(id){ for(const s of ['title','keep','fight']){ const e=$(s); const on=s===id; e.hidden=!on; e.classList.toggle('on',on); } }
function persist(){ scheduleSave(P,T); }
function sheet(html){ $('sheetBox').innerHTML=html; $('sheet').hidden=false; }
function closeSheet(){ $('sheet').hidden=true; }

/* ---------- wording ---------- */
function ctx(){ if(T) return {gun:T.gun,mas:T.mas,mult:T.mult*T.surge,temper:T.temper}; return {gun:lvl(1,P.lv.gun),mas:lvl(1,P.lv.mason),mult:standing(P),temper:1}; }
function modeText(m,c){
  const t=[];
  if(m.p) t.push(`+${m.p} Powder`);
  if(m.salvo) t.push(`Powder: 1 + your Bastions`);
  if(m.d) t.push(`<b>${fmt(m.d*c.gun*c.mult*c.temper)}</b> damage`);
  if(m.rally) t.push(`<b>${fmt(m.rally*c.gun*c.mult*c.temper)}</b> damage per Bastion fired this turn`);
  if(m.s) t.push(`<b>${fmt(m.s*c.mas*c.mult*c.temper)}</b> shields`);
  if(m.b) t.push(`<b>${fmt(m.b*c.gun*c.mult*c.temper)}</b> Blight`);
  if(m.hex) t.push(`Next ${m.hex} attacks halved`);
  if(m.draw) t.push(`Draw ${m.draw}`);
  if(m.e) t.push(`+${m.e}⚡`);
  if(m.repair) t.push(`Mend the worst Bastion 40%`);
  if(m.refire) t.push(`The last Bastion to fire fires again`);
  if(m.fuse) t.push(`Half-fill the first Bastion that can fire`);
  if(m.fileall) t.push(`File all stuck cards free`);
  if(m.burn) t.push(`<i>Once a fight</i>`);
  return t.join('. ');
}
function baseText(k,c){ const d=BASTIONS[k], tmp=c.temper||1;
  if(d.d) return `<b>${fmt(d.d*c.gun*c.mult*tmp)}</b> damage`;
  if(d.s) return `<b>${fmt(d.s*c.mas*c.mult*tmp)}</b> shields`+(d.hits?', mend 1 hit':'');
  if(d.b) return `<b>${fmt(d.b*c.gun*c.mult*tmp)}</b> Blight`;
  if(d.hex) return `Next ${d.hex} attacks halved`;
  if(d.coin) return `Coin: ¼ of this fight's purse`;
  if(d.draw) return `Draw ${d.draw}`;
  if(d.p) return `+${d.p} Powder`;
  if(d.temper) return `Next payout ×${d.temper}`;
  return '';
}
function intentText(I,amt,tgt){
  const who=tgt<0||!T.board[tgt]?'you':BASTIONS[T.board[tgt].k].n;
  switch(I.type){
    case 'hit': return `⚔️ Hits <b>${who}</b> for <b>${fmt(amt)}</b>`;
    case 'snipe': return `🎯 Snipes <b>${who}</b>, far right, for <b>${fmt(amt)}</b>`;
    case 'face': return `🗡️ Hits <b>you</b> for <b>${fmt(amt)}</b>`;
    case 'ram': return `🐏 Charges <b>${who}</b> for <b>${fmt(amt)}</b>`;
    case 'volley': return `🌧️ Hits <b>every Bastion</b> for <b>${fmt(amt)}</b>, you for half`;
    case 'drain': return `💧 Takes ${I.x} Powder from your fullest Bastion`;
    case 'jam': return I.x<0?`🔒 Seizes slots from the left: no Powder next turn`:`🔒 Jams your ${I.x===0?'left':'right'} end: no Powder there next turn`;
    case 'rubble': return `🪨 Throws ${I.x} Rubble in your discard pile`;
    case 'hunker': return `🐢 Will hunker: takes ¼ damage during your next turn`;
    case 'dodge': return `💨 Will dodge the first hit of your next turn`;
    default: return `😴 Resting`;
  }
}
const oddsOf = hp => (power||1)/hp;
const oddsTxt = r => r>=100?'×'+fmt(r):'×'+(r<10?r.toFixed(1):Math.round(r));

/* ---------- home ---------- */
function refreshPower(){ power=estPower(P).dmg; }
function renderKeep(){
  fixLayout(P); refreshPower();
  $('kCoin').textContent=fmt(P.coin); $('kPower').textContent=fmt(power); $('kDeep').textContent=P.deepest; $('kCrest').textContent=P.crests;
  $('kCrestBox').hidden=!P.crests&&!Object.keys(P.works).length;
  const l=P.last;
  const rf=P.deepest+1, boss=isBoss(rf)||rf===TUNE.finalBoss;
  const nextE=enemyFor(rf); const rr=power/(fightHp(rf)*nextE.h*(boss?TUNE.bossHp:1));
  let rm='';
  if(l&&l.lostTo){ const r=power/(fightHp(l.lostTo.f)); rm=`<b>${l.lostTo.i} ${esc(l.lostTo.n)}</b> beat you at fight ${l.lostTo.f}. Odds of a rematch now: <b class="${r>=1?'ok':'bad'}">${oddsTxt(r)}</b>`; }
  else if(l) rm=`You walked home from fight ${l.f}. Next new ground: <b>${nextE.i} ${esc(nextE.n)}</b>, odds <b class="${rr>=1?'ok':'bad'}">${oddsTxt(rr)}</b>`;
  else rm=`Your board is two Bastions and a debt. Set out and see how far it gets.`;
  $('kRematch').innerHTML=rm+(boss?` <span class="bossnote">A boss stands at fight ${rf}.</span>`:'');
  renderStairs();
  for(const b of $('kTabs').children) b.classList.toggle('on',b.dataset.t===tab);
  const body=$('kBody'); body.innerHTML={spend:spendHtml,board:boardTabHtml,deck:deckHtml,works:worksHtml}[tab]();
  const drop=dropIn(P,power); if(startAt==null||startAt>Math.max(1,drop)) startAt=Math.max(1,drop);
  $('kF').innerHTML=`Start at fight <b>${startAt}</b> <span class="dim">odds ${oddsTxt(power/fightHp(startAt))}</span>`;
  persist();
}
function renderStairs(){
  const h=P.hist.slice(-40).concat([power]); if(h.length<2){ $('kStairs').innerHTML=''; return; }
  const ls=h.map(v=>Math.log10(Math.max(1,v))), max=Math.max(...ls,1), w=300/(h.length-1);
  let d=`M0 ${44-ls[0]/max*40}`; ls.forEach((y,i)=>{ if(i){ d+=`H${(i*w).toFixed(1)}V${(44-y/max*40).toFixed(1)}`; } });
  $('kStairs').innerHTML=`<path d="${d}" fill="none" stroke="var(--gold)" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
}
function spendHtml(){
  let s='<h3>Upgrades <span class="dim">every card and Bastion reads from these</span></h3>';
  const cap=levelCap(P);
  for(const k in TRACKS){ const d=TRACKS[k], L=P.lv[k], pr=levelPrice(P,k), gain=lvl(1,L+1)/lvl(1,L), mile=(L+1)%5===0, atCap=L>=cap;
    s+=`<div class="row"><div class="ric">${d.i}</div><div class="rmain"><b>${d.n}</b> <span class="lv">Lv ${L}</span><div class="dim">${d.d}</div><div class="rnext ${mile?'mile':''}">Next: ×${gain.toFixed(1)}${mile?' milestone':''}${atCap?` · capped until fight ${Math.ceil((L+1-TUNE.capBase)*TUNE.capPer)}`:''}</div></div>
      <div class="rbtns"><button class="buy" data-act="lv" data-k="${k}" ${canLevel(P,k)?'':'disabled'}>${fmt(pr)}</button><button class="ghost small" data-act="max" data-k="${k}" ${canLevel(P,k)?'':'disabled'}>Max</button></div></div>`; }
  const n=deedCount(P), nextSlot=DEED_SLOTS.find(([need])=>need>n), dp=deedPrice(n);
  s+='<h3>Deeds <span class="dim">junk in hand, and the only way to more slots</span></h3>';
  s+=`<div class="row"><div class="ric">📜</div><div class="rmain"><b>Buy a Deed</b> <span class="lv">${n} owned · ×${fmt2(standing(P))}</span><div class="dim">×${TUNE.standing} to all payouts${nextSlot?`. ${nextSlot[0]} Deeds open slot ${nextSlot[1]}`:''}. It sticks in your hand until you pay 1⚡ to file it, for a little rent.</div></div>
    <div class="rbtns"><button class="buy" data-act="deed" ${P.coin>=dp?'':'disabled'}>${fmt(dp)}</button></div></div>`;
  if(P.own.deed>=2){ const cp=charterPrice(P); s+=`<div class="row"><div class="ric">👑</div><div class="rmain"><b>Merge 2 Deeds into a Charter</b><div class="dim">Still counts as 2, takes one card's room, triple rent.</div></div><div class="rbtns"><button class="buy" data-act="charter" ${P.coin>=cp?'':'disabled'}>${fmt(cp)}</button></div></div>`; }
  s+='<h3>For sale <span class="dim">new stock every trip, priced by your depth</span></h3><div class="offers">';
  const c=ctx();
  for(const k of P.offers){ const pr=offerPrice(P,k), isB=!!BASTIONS[k], d=defOf(k);
    s+=`<div class="offer ${isB?'isb':''}"><div class="otop"><span class="oic">${d.i}</span><b>${esc(d.n)}</b></div><div class="otxt">${isB?`<span class="tagb">Bastion · fill ${d.fill}</span> ${baseText(k,c)}`:(d.sticky?esc(d.tip):`<span class="tagc">${d.c}⚡</span> `+d.m.map(m=>modeText(m,c)).join(' <i>or</i> '))}</div>
      <button class="buy" data-act="offer" data-k="${k}" ${P.coin>=pr?'':'disabled'}>${fmt(pr)}</button></div>`; }
  if(!P.offers.length) s+='<p class="dim">Sold out until your next trip.</p>';
  return s+'</div>';
}
const fmt2 = x => x<100?x.toFixed(1):fmt(x);
function boardTabHtml(){
  const c=ctx(); let s='<h3>Your board <span class="dim">tap two to swap</span></h3><p class="dim">Powder fills from the left. Attacks hit the left end first. A full Bastion fires, once a turn.</p><div class="board kboard">';
  P.layout.forEach((k,i)=>{ const d=k&&BASTIONS[k]; s+=`<button class="slot ${boardSel===`s${i}`?'sel':''} ${k?'':'empty'}" data-act="bsel" data-k="s${i}">${k?`<div class="sic">${d.i}</div><div class="sname">${esc(d.n)}</div><div class="sfill">fill ${d.fill}</div><div class="spay">${baseText(k,c)}</div>`:'<div class="sname dim">empty</div>'}</button>`; });
  s+='</div>';
  const spare=Object.keys(P.bases).filter(k=>!P.layout.includes(k));
  s+=`<h3>In your deck <span class="dim">Bastions not on the board are cards you can deploy mid-fight</span></h3><div class="offers">`;
  for(const k of spare){ const d=BASTIONS[k]; s+=`<button class="offer spare ${boardSel===`b${k}`?'sel':''}" data-act="bsel" data-k="b${k}"><div class="otop"><span class="oic">${d.i}</span><b>${esc(d.n)}</b></div><div class="otxt"><span class="tagb">fill ${d.fill}</span> ${baseText(k,c)}</div></button>`; }
  if(!spare.length) s+='<p class="dim">None. New Bastions go straight into an empty slot.</p>';
  s+='</div>';
  const sel=boardSel&&(boardSel[0]==='s'?P.layout[+boardSel.slice(1)]:boardSel.slice(1));
  if(sel) s+=`<p class="tip"><b>${esc(BASTIONS[sel].n)}:</b> ${esc(BASTIONS[sel].tip)}</p>`;
  return s;
}
function deckHtml(){
  const c=ctx(); let s='<h3>Your deck <span class="dim">bench a copy to leave it at home</span></h3>';
  for(const k in P.own){ const n=P.own[k]||0; if(!n) continue; const d=CARDS[k], b=P.bench[k]||0;
    s+=`<div class="row"><div class="ric">${d.i}</div><div class="rmain"><b>${esc(d.n)}</b> <span class="lv">${n-b} of ${n} in deck</span><div class="dim">${d.sticky?esc(d.tip):`${d.c}⚡ `+d.m.map(m=>modeText(m,c)).join(' <i>or</i> ')}</div></div>
      <div class="rbtns"><div class="step"><button class="ghost small" data-act="bench" data-k="${k}" data-d="1" ${n-b>0&&!d.sticky?'':'disabled'}>−</button><button class="ghost small" data-act="bench" data-k="${k}" data-d="-1" ${b>0?'':'disabled'}>+</button></div></div></div>`; }
  return s;
}
function worksHtml(){
  let s=`<h3>Works <span class="dim">a Crest from each boss buys one rule change</span></h3>`;
  for(const k in WORKS){ const d=WORKS[k], has=P.works[k];
    s+=`<div class="row"><div class="ric">${d.i}</div><div class="rmain"><b>${esc(d.n)}</b><div class="dim">${esc(d.d)}</div></div><div class="rbtns">${has?'<span class="ok">Built</span>':`<button class="buy" data-act="work" data-k="${k}" ${P.crests>0?'':'disabled'}>1 Crest</button>`}</div></div>`; }
  return s;
}
function keepAct(e){
  const b=e.target.closest('[data-act]'); if(!b||b.disabled) return; const a=b.dataset.act, k=b.dataset.k; const before=power;
  if(a==='lv') buyLevel(P,k); else if(a==='max') buyMax(P,k); else if(a==='deed'){ buyDeed(P); }
  else if(a==='charter') buyCharter(P); else if(a==='offer') buyOffer(P,k); else if(a==='work') buyWork(P,k);
  else if(a==='bench') setBench(P,k,+b.dataset.d);
  else if(a==='bsel'){ if(!boardSel||boardSel===k){ boardSel=boardSel===k?null:k; } else { applyBoardSwap(boardSel,k); boardSel=null; } }
  renderKeep();
  if(['lv','max','deed','offer','charter'].includes(a)&&power>before*1.001){ const box=$('kPower'); box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop'); floatAt(box,`×${fmt2(power/before)}`,'gold',1.2); }
}
function applyBoardSwap(a,b){
  const isS=x=>x[0]==='s';
  if(isS(a)&&isS(b)){ const i=+a.slice(1), j=+b.slice(1); const x=P.layout[i]; P.layout[i]=P.layout[j]; P.layout[j]=x; return; }
  const s=isS(a)?a:b, sp=isS(a)?b:a; if(!isS(s)||isS(sp)) return; P.layout[+s.slice(1)]=sp.slice(1);
}
function setOut(){
  refreshPower(); P.hist.push(power); if(P.hist.length>200) P.hist.shift();
  T=startTrip(P,{f:startAt||1}); startAt=null; deploying=null; swapSel=null; turnPower=power;
  show('fight'); renderFight(); playEvents(); saveNow(P,T); maybeWon();
}

/* ---------- the fight ---------- */
function renderFight(){
  const E=T.enemy;
  $('fF').textContent=`Fight ${T.f}`+(E.boss?' · BOSS':''); $('fCoin').textContent='🪙 '+fmt(T.coin);
  const r=(turnPower*T.surge)/E.max; $('fOdds').textContent='odds '+oddsTxt(r); $('fOdds').className='chip num '+(r>=2?'ok':r>=1?'':'bad');
  $('fAuto').hidden=!(r>=2);
  $('eArt').textContent=E.i; $('eName').textContent=E.n; $('enemy').classList.toggle('boss',!!E.boss);
  $('eBar').style.width=Math.max(0,E.hp/E.max*100)+'%'; $('eHp').textContent=fmt(Math.max(0,E.hp));
  const st=[]; if(E.hunker) st.push('🐢 hunkered: takes ¼'); if(E.dodge) st.push('💨 will dodge one hit'); if(E.blight>0) st.push('☣️ '+fmt(E.blight)); if(E.rule) st.push(E.rule); if(enrageFactor(T)>1) st.push('😡 enraged ×'+fmt2(enrageFactor(T)));
  $('eStat').textContent=st.join(' · ');
  const I=intentOf(T), amt=intentAmount(T,I), tg=hitTarget(T,I), nx=intentOf(T,1);
  $('eIntent').innerHTML=intentText(I,amt,tg);
  $('eNext').innerHTML='Then: '+intentText(nx,intentAmount(T,nx),hitTarget(T,nx));
  // board
  const c=ctx(); const atk=['hit','snipe','ram'].includes(I.type)?tg:-1; const volley=I.type==='volley';
  let h=''; T.board.forEach((b,i)=>{ if(!b){ h+=`<button class="slot empty ${deploying!=null?'target':''}" data-slot="${i}"><div class="sname dim">empty</div></button>`; return; }
    const d=BASTIONS[b.k]; let pips=''; for(let p=0;p<d.fill;p++) pips+=`<i class="${p<b.fill?'f':''}"></i>`;
    const hb=b.hits?`<div class="hits">${'🛡️'.repeat(b.hits)}</div>`:`<div class="bar sh"><i style="width:${b.hp/b.max*100}%"></i></div>`;
    h+=`<button class="slot ${b.fired?'fired':''} ${b.jam?'jam':''} ${swapSel===i?'sel':''} ${(atk===i||volley)?'tgt':''} ${deploying!=null?'target':''}" data-slot="${i}" id="sl${i}"><div class="sic">${d.i}</div><div class="sname">${esc(d.n)}</div><div class="spay">${baseText(b.k,c)}</div><div class="pipsrow">${pips}</div>${hb}${b.jam?'<div class="stag">🔒</div>':b.fired?'<div class="stag">✓</div>':''}</button>`; });
  $('board').innerHTML=h; $('board').dataset.n=T.board.length;
  $('fSwap').textContent=T.freeSwap>0?'1 free swap: tap two':`swap: ${TUNE.swapCost}⚡`;
  // you
  $('yBar').style.width=Math.max(0,T.hp/T.maxHp*100)+'%'; $('yHp').textContent=`❤️ ${fmt(Math.max(0,T.hp))} / ${fmt(T.maxHp)}`;
  $('yShield').textContent='🛡️ '+fmt(T.shield); $('yShield').style.visibility=T.shield>0?'':'hidden';
  let ep=''; const mx=Math.max(T.energyMax,T.energy); for(let i=0;i<mx;i++) ep+=`<i class="${i<T.energy?'on':''}">⚡</i>`; $('yEnergy').innerHTML=ep;
  $('yMag').textContent=`Magazine ${T.mag}/${T.magCap}`;
  const ys=[]; if(T.hex) ys.push(`🔮 ${T.hex}`); if(T.temper>1) ys.push(`⚒️ next ×${T.temper}`); const wc=wardCount(T); if(wc) ys.push(`🧿 ${wc}`); if(T.surge>1) ys.push(`✨×${fmt2(T.surge)}`); if(T.tollLeft>0) ys.push(`🤴 toll ${T.tollLeft}`);
  $('yStat').textContent=ys.join(' ');
  $('yPiles').textContent=`Draw ${T.draw.length} · Discard ${T.disc.length}`;
  // hand
  let hh=''; T.hand.forEach((cd,i)=>{ const cost=cardCost(T,cd), can=cost<=T.energy;
    if(cd.b){ const d=BASTIONS[cd.k]; hh+=`<div class="card isb ${can?'':'no'} ${deploying===i?'sel':''}" data-i="${i}"><span class="cost">${cost}</span><div class="cic">${d.i}</div><div class="cname">${esc(d.n)}</div><button class="mode" data-i="${i}" data-m="0">Deploy<br>${baseText(cd.k,c)}</button></div>`; return; }
    const d=CARDS[cd.k];
    if(d.sticky){ const rent=cd.k==='deed'?.25:cd.k==='charter'?.75:0; hh+=`<div class="card stuck ${can?'':'no'}" data-i="${i}"><span class="cost">${cost}</span><div class="cic">${d.i}</div><div class="cname">${esc(d.n)}</div><button class="mode" data-i="${i}" data-m="0">File it${rent?`<br>🪙 ${fmt(fightCoin(T.f)*rent)}`:cd.k==='ward'?'<br>cuts attacks':''}</button></div>`; return; }
    hh+=`<div class="card ${can?'':'no'}" data-i="${i}"><span class="cost">${cost}</span><div class="cic">${d.i}</div><div class="cname">${esc(d.n)}</div>`+d.m.map((m,mi)=>`<button class="mode" data-i="${i}" data-m="${mi}">${modeText(m,c)}</button>`).join('')+`</div>`; });
  $('hand').innerHTML=hh; $('hand').dataset.n=T.hand.length;
  $('fEnd').disabled=busy;
  coach();
}
function coach(){
  const box=$('coach'); let msg='';
  if(P.trips===0){ if(T.turn===1&&T.f===1&&!T.played) msg='Tap a card to play it. Cartridges and Flint make Powder. Powder runs left to right, and a full Bastion fires, once a turn.';
    else if(T.turn===2&&T.f===1) msg='The red frame marks who the next attack hits: the leftmost Bastion first. One swap a turn is free. Tap two slots.';
    else if(T.f===2&&T.turn===1) msg='Health and Bastion damage carry through the whole trip. Losing is normal here: you keep 70% of your coin and all your upgrades.'; }
  else if(!P.seen.stuck&&T.hand.some(c=>CARDS[c.k]&&CARDS[c.k].sticky)){ msg='Stuck cards stay in your hand and take up room until you pay 1⚡ to file them. Filing a Deed pays rent.'; }
  box.textContent=msg; box.hidden=!msg;
}
function handClick(e){
  const m=e.target.closest('.mode'), card=e.target.closest('.card'); if(busy||!card) return;
  const i=+card.dataset.i, mi=m?+m.dataset.m:0; const c=T.hand[i]; if(!c) return;
  if(cardCost(T,c)>T.energy){ shake(card); return; }
  if(c.b){ deploying=deploying===i?null:i; swapSel=null; renderFight(); return; }
  if(CARDS[c.k].sticky&&!P.seen.stuck){ P.seen.stuck=1; }
  deploying=null; playCard(T,i,mi); afterAction();
}
function boardClick(e){
  const s=e.target.closest('.slot'); if(!s||busy) return; const i=+s.dataset.slot;
  if(deploying!=null){ const d=deploying; deploying=null; playCard(T,d,0,i); afterAction(); return; }
  if(swapSel==null){ if(!T.board[i]&&false) return; swapSel=i; renderFight(); return; }
  if(swapSel===i){ swapSel=null; renderFight(); return; }
  const a=swapSel; swapSel=null;
  if(!swapBases(T,a,i)){ renderFight(); shake(s); return; } afterAction();
}
function afterAction(){ renderFight(); playEvents(); persist(); maybeWon(); }
function maybeWon(){ if(T&&T.phase==='won') setTimeout(wonSheet,650); else if(T&&T.phase==='lost') setTimeout(lostSheet,650); }
function endTurnClick(){ if(busy||!T||T.phase!=='turn') return; deploying=null; swapSel=null; busy=true; $('fEnd').disabled=true;
  $('enemy').classList.add('act'); setTimeout(()=>$('enemy').classList.remove('act'),300);
  endTurn(T); const ms=playEvents(); setTimeout(()=>{ busy=false; renderFight(); persist(); maybeWon(); },Math.min(900,ms+120)); }
function autoClick(){ if(busy||T.phase!=='turn') return; autoTurn(T); renderFight(); playEvents(); persist(); if(T.phase==='turn') setTimeout(endTurnClick,350); else maybeWon(); }

/* ---------- event playback ---------- */
function floatAt(el,text,cls,size){ if(!el) return; const r=el.getBoundingClientRect(); const f=document.createElement('div'); f.className='float '+(cls||''); f.textContent=text; f.style.left=(r.left+r.width/2)+'px'; f.style.top=(r.top+r.height*.4)+'px'; if(size) f.style.fontSize=size+'rem'; $('fx').appendChild(f); f.addEventListener('animationend',()=>f.remove()); setTimeout(()=>f.remove(),1500); }
function flash(el,cls){ if(!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function shake(el){ flash(el,'shk'); }
function playEvents(){
  const evs=T.ev; T.ev=[]; const shown=evs.filter(e=>['fire','hurt','hit','hitYou','win','absorb','baseDown','dodged','toll','carry','waste','rent','jam','drain','rubbleIn','hunker','dodge','lost','tick','refire','deploy'].includes(e.t));
  const step=Math.min(170,1000/Math.max(1,shown.length)); let t=0;
  for(const e of shown){ setTimeout(()=>oneEvent(e),t); t+=step; }
  return t;
}
function oneEvent(e){
  const en=$('eArt'), sl=i=>$('sl'+i);
  switch(e.t){
    case 'fire': { flash(sl(e.i),'firing'); const c=e.dmg!=null?null:e.shield?`🛡️ ${fmt(e.shield)}`:e.blight?`☣️ ${fmt(e.blight)}`:e.coin?`🪙 ${fmt(e.coin)}`:e.powder?`+${e.powder} Powder`:e.draw?`Draw ${e.draw}`:e.temper?`×${e.temper}`:e.hex?'Curse':null; if(c) floatAt(sl(e.i),c,e.shield?'blue':e.coin?'gold':''); break; }
    case 'hurt': { const E=T.enemy, rel=e.n/E.max; const size=rel>3?3:rel>1?2.4:rel>.3?1.8:1.3; floatAt(en,fmt(e.n),'red',size); flash(en,'hurt'); const bar=$('eBar'); if(bar) bar.style.width=Math.max(0,e.hp/E.max*100)+'%'; $('eHp').textContent=fmt(Math.max(0,e.hp)); break; }
    case 'tick': floatAt(en,'☣️ '+fmt(e.n),'green',1.3); break;
    case 'dodged': floatAt(en,'dodged!','dim',1.3); break;
    case 'hit': floatAt(sl(e.i),e.gate?'−1 hit':'−'+fmt(e.n),'red'); flash(sl(e.i),'hurt'); break;
    case 'hitYou': floatAt($('yHp'),'−'+fmt(e.n),'red',1.4); flash($('yHp').parentElement,'hurt'); break;
    case 'absorb': floatAt($('yShield'),'🛡️ −'+fmt(e.n),'blue'); break;
    case 'baseDown': floatAt($('board'),`${BASTIONS[e.k].n} falls! Back to your discard pile`,'red',.9); break;
    case 'toll': floatAt($('board'),`The Toll King takes ${e.n} Powder`,'dim',.9); break;
    case 'waste': floatAt($('yMag'),`${e.n} Powder wasted`,'dim',.85); break;
    case 'rent': floatAt($('fCoin'),'🪙 +'+fmt(e.n),'gold'); break;
    case 'carry': floatAt(en,`Overkill carries: ${fmt(e.n)}`,'gold',1.1); break;
    case 'win': { const big=e.ratio>=1; banner(e.boss?'Boss down!':'Down!',big?`Overkill ×${fmt2(e.ratio+1)}`:'',Math.min(1+Math.log10(1+Math.max(0,e.ratio))*.5,2.2)); break; }
  }
}
function banner(a,b,scale){ const f=document.createElement('div'); f.className='banner'; f.innerHTML=`<b>${esc(a)}</b>${b?`<span>${esc(b)}</span>`:''}`; f.style.setProperty('--s',scale||1); $('fx').appendChild(f); setTimeout(()=>f.remove(),1100); }

/* ---------- between fights ---------- */
function cacheLabel(o){ if(o.t==='card'){ const d=CARDS[o.k]; return `${d.i} <b>${esc(d.n)}</b><div class="dim">${d.sticky?esc(d.tip):d.m.map(m=>modeText(m,ctx())).join(' or ')}. Yours for this trip.</div>`; }
  if(o.t==='surge') return `✨ <b>War chest</b><div class="dim">All payouts ×${TUNE.surge} for the rest of this trip.</div>`;
  if(o.t==='mend') return `⛑️ <b>Field repairs</b><div class="dim">Heal half your health and mend every Bastion.</div>`;
  return `💰 <b>Strongbox</b><div class="dim">${fmt(fightCoin(T.f)*2)} coin.</div>`; }
function wonSheet(){
  if(!T||T.phase!=='won') return;
  const f=T.f;
  if(T.cache){ sheet(`<h2>A cache on the road</h2><p class="dim">Take one.</p><div class="choices">${T.cache.map((o,i)=>`<button class="choice" data-cache="${i}">${cacheLabel(o)}</button>`).join('')}</div>`); return; }
  const nf=f+1, ne=enemyFor(nf), boss=isBoss(nf)||nf===TUNE.finalBoss, r=turnPower*T.surge/(fightHp(nf)*ne.h*(boss?TUNE.bossHp:1));
  const crest=T.beaten>P.beaten&&T.beaten===f;
  sheet(`<h2>Fight ${f} won</h2><p>${crest?'<b class="gold">You took a Crest.</b> Spend it at home.<br>':''}Carrying <b class="gold">🪙 ${fmt(T.coin)}</b>. ❤️ ${fmt(T.hp)} of ${fmt(T.maxHp)}.</p>
    <div class="nextup ${boss?'boss':''}"><span class="big">${ne.i}</span><div><b>${esc(ne.n)}</b>${boss?' · BOSS':''}<div class="dim">Fight ${nf}. Odds <b class="${r>=1?'ok':'bad'}">${oddsTxt(r)}</b>${nf>T.deepest?' · new ground pays double':''}</div>${ne.rule?`<div class="dim">${esc(ne.rule)}</div>`:''}</div></div>
    <div class="choices row2"><button class="go" data-next="1">Onward</button><button class="ghost" data-home="1">Go home, keep all</button></div>`);
}
function lostSheet(){
  if(!T||T.phase!=='lost') return;
  const kept=T.coin*TUNE.defeatKeep, E=T.enemy;
  sheet(`<h2>Beaten at fight ${T.f}</h2><p><b>${E.i} ${esc(E.n)}</b> had ${Math.ceil(E.hp/E.max*100)}% health left.</p><p>You bring home <b class="gold">🪙 ${fmt(kept)}</b>, and drop 🪙 ${fmt(T.coin-kept)} on the road. Every upgrade stays.</p><div class="choices"><button class="go" data-endtrip="defeat">Go home</button></div>`);
}
function sheetClick(e){
  const b=e.target.closest('button'); if(!b) return;
  if(b.dataset.cache!=null){ pickCache(T,+b.dataset.cache); renderFight(); persist(); wonSheet(); return; }
  if(b.dataset.next){ closeSheet(); nextFight(T); renderFight(); playEvents(); persist(); maybeWon(); return; }
  if(b.dataset.home){ endTripUI('retreat'); return; }
  if(b.dataset.endtrip){ endTripUI(b.dataset.endtrip); return; }
  if(b.dataset.keep!=null){ keepSpoil(P,b.dataset.keep||null); closeSheet(); renderKeep(); saveNow(P,null); return; }
  if(b.dataset.close){ closeSheet(); if(b.dataset.after==='title') toTitle(); return; }
  if(b.dataset.giveup){ closeSheet(); T.phase='lost'; lostSheet(); return; }
}
function endTripUI(how){
  const beat=T.beaten>=TUNE.finalBoss&&!P.won;
  const l=endTrip(P,T,how); T=null; closeSheet(); tab='spend'; boardSel=null; show('keep'); renderKeep(); saveNow(P,null);
  if(beat) sheet(`<h2>🏦 Paid in full</h2><p>The Foreclosure is down, at a number nobody in town can read aloud. The road keeps going if you do.</p><div class="choices"><button class="go" data-close="1">Back to the Keep</button></div>`);
  else if(P.keep.length) sheet(`<h2>Keep one spoil?</h2><p class="dim">It joins your deck for good. Thin decks draw better, so leaving it is fine.</p><div class="choices">${P.keep.slice(0,4).map(k=>`<button class="choice" data-keep="${k}">${CARDS[k].i} <b>${esc(CARDS[k].n)}</b><div class="dim">${CARDS[k].sticky?esc(CARDS[k].tip):CARDS[k].m.map(m=>modeText(m,ctx())).join(' or ')}</div></button>`).join('')}<button class="ghost" data-keep="">Leave them</button></div>`);
}

/* ---------- title ---------- */
function toTitle(){ if(P) saveNow(P,T); renderTitle(); show('title'); }
function renderTitle(){
  const s=P&&(P.trips||T);
  $('tPlay').textContent=s?'Continue':'Play';
  $('tBest').textContent=s?`Deepest fight ${P.deepest} · power ${fmt(estPower(P).dmg)} · ${P.trips} trips`:'';
  $('tWipe').hidden=!s;
}
function howTo(){ sheet(`<h2>How to play</h2><ul class="how">
  <li><b>Cards cost ⚡.</b> You get 3 a turn and draw 5 cards.</li>
  <li><b>Powder</b> runs into your board from the left. A full Bastion fires, once a turn, and starts filling again. Part-fills carry over.</li>
  <li><b>Attacks hit the leftmost Bastion</b> unless they say otherwise. Damage past it carries on, and what is left lands on you. A fallen Bastion goes to your discard pile.</li>
  <li><b>One swap a turn is free.</b> Tap two slots. It changes who gets fed first and who gets hit first.</li>
  <li><b>Stuck cards</b> (Deeds, Wards, Rubble) stay in hand until you pay 1⚡ to file them.</li>
  <li><b>Go home</b> after any win and keep all your coin. If you are beaten you keep 70%. Your upgrades are never lost.</li>
  <li><b>At home</b>, spend. You come back at the fights you can now flatten, and walk into the next wall.</li></ul>
  <div class="choices"><button class="go" data-close="1">Got it</button></div>`); }

/* ---------- start ---------- */
function boot(){
  const s=loadSave(); if(s){ P=s.P; T=s.T; } else P=newProfile((Date.now()&0xffffff)|1);
  renderTitle();
  $('tPlay').onclick=()=>{ if(T&&T.phase){ refreshPower(); turnPower=P.hist.length?P.hist[P.hist.length-1]:power; show('fight'); renderFight(); if(T.phase==='won') wonSheet(); if(T.phase==='lost') lostSheet(); } else { show('keep'); renderKeep(); if(P.keep.length) keepSpoil(P,null); } };
  $('tHow').onclick=howTo;
  $('tClassic').onclick=()=>{ location.href='classic/index.html'; };
  $('tWipe').onclick=()=>{ sheet(`<h2>Erase this save?</h2><p>Your whole climb goes. There is no undo.</p><div class="choices row2"><button class="ghost" data-close="1">Keep it</button><button class="ghost danger" id="wipeYes">Erase</button></div>`); $('wipeYes').onclick=()=>{ wipeSave(); P=newProfile((Date.now()&0xffffff)|1); T=null; closeSheet(); renderTitle(); }; };
  $('kTabs').onclick=e=>{ const b=e.target.closest('button'); if(b){ tab=b.dataset.t; boardSel=null; renderKeep(); } };
  $('kBody').onclick=keepAct;
  $('kGo').onclick=setOut;
  $('kFm').onclick=()=>{ startAt=Math.max(1,(startAt||1)-1); renderKeep(); };
  $('kFp').onclick=()=>{ startAt=Math.min(Math.max(1,dropIn(P,power)),(startAt||1)+1); renderKeep(); };
  $('kMenu').onclick=toTitle;
  $('hand').onclick=handClick; $('board').onclick=boardClick;
  $('fEnd').onclick=endTurnClick; $('fAuto').onclick=autoClick;
  $('fMenu').onclick=()=>{ if(busy) return; sheet(`<h2>Give up this trip?</h2><p class="dim">Counts as a defeat: you keep 70% of your coin. Your progress in this fight is saved if you just close the page.</p><div class="choices row2"><button class="ghost" data-close="1">Keep fighting</button><button class="ghost danger" data-giveup="1">Give up</button></div>`); };
  $('sheet').onclick=sheetClick;
  addEventListener('pagehide',()=>saveNow(P,T));
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) saveNow(P,T); });
}
boot();
