"use strict";
/* ==========================================================
   Spellkeep — rendering, choices, effects, settings.
   Every size in style.css is in rem; the UI scale sets the
   root font-size.
   ========================================================== */
const $ = id => document.getElementById(id);
const LEDGER=[];
const UI={ scale:1, tap:false };
try{ const s=JSON.parse(localStorage.getItem('spellkeep.ui')||'{}'); if(s.scale) UI.scale=s.scale; UI.tap=!!s.tap; }catch(e){}
if(UI.tap===false&&matchMedia('(hover: none)').matches&&localStorage.getItem('spellkeep.ui')==null) UI.tap=true;
function saveUI(){ try{ localStorage.setItem('spellkeep.ui',JSON.stringify({scale:UI.scale,tap:UI.tap})); }catch(e){} }

/* ---------- scale & layout ---------- */
function autoPx(){ return clamp(Math.min(innerWidth/26, innerHeight/44),12,19); }
function layout(){
  const px=autoPx()*UI.scale;
  document.documentElement.style.fontSize=px+'px';
  const W=innerWidth/px, b=document.body;
  b.classList.toggle('L-wide',W>=58); b.classList.toggle('L-narrow',W<58);
  $('sVal').textContent=Math.round(UI.scale*100)+'%';
  $('sEff').textContent=`Text is ${Math.round(px)}px at this size.`;
}
function setScale(s){ UI.scale=clamp(Math.round(s*20)/20,0.6,1.6); $('sRange').value=Math.round(UI.scale*100); saveUI(); layout(); }
addEventListener('resize',()=>{ layout(); if(typeof fitVeil==='function') fitVeil(); });

/* ---------- log, toasts, effects ---------- */
function addLogLine(m,cls){
  const l=$('log'), d=document.createElement('div'); if(cls) d.className=cls; d.textContent=m; l.appendChild(d);
  while(l.children.length>200) l.removeChild(l.firstChild);
  l.scrollTop=l.scrollHeight;
}
function log(m,cls){ LEDGER.push([m,cls||'']); addLogLine(m,cls); if(cls==='good'||cls==='bad') toast(m,cls); }
function toast(m,cls){
  const box=$('toasts'), d=document.createElement('div'); d.className='toast '+(cls||''); d.textContent=m;
  box.appendChild(d); while(box.children.length>3) box.removeChild(box.firstChild);
  setTimeout(()=>d.remove(),3000);
}
function pulse(el,cls,ms){ if(!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(()=>el.classList.remove(cls),ms); }
function fx(kind,a){
  if(typeof document==='undefined') return;
  const foe=document.querySelector('#foe .fart');
  if(kind==='hit'&&foe){
    const r=foe.getBoundingClientRect(), d=document.createElement('div');
    d.className='dmgpop'+(a>=G.foe.max*0.5?' big':''); d.textContent='-'+fmt(a);
    d.style.left=(r.left+r.width/2+(Math.random()*60-30))+'px'; d.style.top=(r.top+r.height*0.3)+'px';
    document.body.appendChild(d); setTimeout(()=>d.remove(),1100);
    pulse(foe,'struck',350);
  }
  if(kind==='kill') pulse($('foe'),'slain',900);
  if(kind==='fail') pulse($('app'),'quake',500);
  if(kind==='foe') pulse($('foe'),'arrive',700);
  if(kind==='mana'&&a>0){ const o=document.querySelector('#mana .orb'); if(!o) return;
    const r=o.getBoundingClientRect(), d=document.createElement('div'); d.className='manapop'; d.textContent=`+${fmt(a)} ${MANA}`;
    d.style.left=(r.left+r.width/2)+'px'; d.style.top=(r.top-6)+'px'; document.body.appendChild(d); setTimeout(()=>d.remove(),1000); }
}
function downloadLog(){
  const txt=LEDGER.map(([m])=>m).join('\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain'}));
  a.download=`spellkeep-log-${new Date().toISOString().slice(0,10)}.txt`; document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- cards ---------- */
const TYPE_NAME={mana:'Mana',spell:'Spell',rune:'Rune',curse:'Curse'};
const RAR_NAME={uncommon:'Uncommon',rare:'Rare'};
// What Twincast, Empower, Twin Wand and Owl's Eye will do to this card if it's played next:
// times = how often it resolves, dmg = what its hits are multiplied by. null when nothing.
const DMG_OPS=['dmg','chain','burn','nova','handdmg','burndmg','pct'];
function boostOf(c){
  if(!G||G.won||G.phase!=='turn'||DB[c.key].unplayable||c.frozen) return null;
  const times=1+G.echo+(hasR('twin')&&!G.flags.twin?1:0);
  const dmg=isSpell(c)?G.empower*(hasR('familiar')&&!G.flags.owl?2:1):1;
  return times>1||dmg>1 ? {times,dmg} : null;
}
// One card's face. where: 'hand' (live preview) or 'pick'.
function cardEl(c,where,extra){
  const d=DB[c.key], el=document.createElement('div');
  el.className=`card t-${d.t} r-${d.r}${c.lv?' up':''}${c.frozen?' frozen':''}`;
  const ops=opsOf(c);
  let pv=null, bo=null;
  if(where==='hand'&&G&&!d.unplayable&&!G.won&&G.phase==='turn'){ pv=predict(c); bo=boostOf(c); }
  // A boosted card shows its factor on each line it changes, and a seal in the corner.
  const fac=o=>!bo||['echo','empower','exhaust','cycle','trash','dispel'].includes(o[0])?1:bo.times*(DMG_OPS.includes(o[0])?bo.dmg:1);
  const lines=ops.map(o=>`<li class="op op-${o[0]}">${opText(o)}${fac(o)>1?` <em class="x">×${fac(o)}</em>`:''}</li>`).join('')||`<li class="op">${d.unplayable?'Cannot be played.':''}</li>`;
  if(bo){ el.classList.add('boosted');
    const why=[]; if(bo.times>1) why.push(bo.times===2?'resolves twice':`resolves ${bo.times} times`); if(bo.dmg>1) why.push(`hits ×${bo.dmg}`);
    el.title=`Played next, this card ${why.join(' and ')}.`; }
  let foot='';
  if(!d.unplayable) foot=`<span class="cost">${playCost()} ${MANA}</span>`;
  let badge='';
  if(pv){
    const bits=[];
    if(pv.dealt) bits.push(`<b class="bd">⚔ ${fmt(pv.dealt)}</b>`);
    if(pv.burnAdd) bits.push(`<b class="bb">🔥 ${fmt(pv.burnAdd)}</b>`);
    bits.push(`<b class="bm">${MANA} ${G.mana}→${pv.mana}</b>`);
    badge=`<div class="pv">${bits.join('')}</div>`;
  }
  const seal=bo?`<div class="seal">${bo.times>1?`<b>${bo.times}×</b><small>cast</small>`:''}${bo.dmg>1?`<b>×${bo.dmg}</b><small>dmg</small>`:''}</div>`:'';
  el.innerHTML=`${seal}<div class="ch"><span class="cart">${d.art}</span><span class="cn">${d.n}<i>${plus(c.lv)}</i></span></div>
    <div class="ctype">${TYPE_NAME[d.t]}${RAR_NAME[d.r]?` · <b>${RAR_NAME[d.r]}</b>`:''}</div><ol class="ops">${lines}</ol>${badge}<div class="cf">${foot}${extra||''}</div>`;
  el.oncontextmenu=e=>{ e.preventDefault(); inspect(c,where); };
  return el;
}

/* ---------- render ---------- */
function render(){
  if(typeof document==='undefined'||!G) return;
  const f=G.foe, circ=circleOf(Math.max(0,G.fight));
  $('cCircle').textContent=`Circle ${circ} · ${f?(f.kind==='boss'?'Boss':f.kind==='elite'?'Elite':'Foe')+' '+(G.fight%3+1)+'/3':''}${G.endless?' · Endless':''}`;
  $('cHearts').textContent='❤'.repeat(Math.max(0,G.hearts))+'♡'.repeat(Math.max(0,TUNE.hearts-G.hearts));
  const nb=G.nextBoss&&BOSSES[G.nextBoss], ntx=nb?bossTx(G.nextBoss,circ):'';
  $('cBoss').textContent=nb?`Boss: ${nb.art} ${nb.n}`:''; $('cBoss').title=ntx; $('cBoss').onclick=()=>nb&&toast(`${nb.n}: ${ntx}`);
  // relics
  const R=$('relics'); R.innerHTML='';
  G.relics.forEach(r=>{ const j=RELICS[r.key], b=document.createElement('button'); b.className='relic r-'+j.r; b.textContent=j.art;
    b.title=`${j.n}: ${j.tx}`; b.onclick=()=>toast(`${j.art} ${j.n}: ${j.tx}`); R.appendChild(b); });
  for(let i=G.relics.length;i<TUNE.relicSlots;i++){ const s=document.createElement('span'); s.className='relic empty'; R.appendChild(s); }
  // foe
  if(f){
    const pctHp=clamp(f.hp/f.max,0,1)*100, tm=turnsMax();
    const pips=Array.from({length:tm},(_,i)=>`<i class="${i<G.turn-1?'past':i===G.turn-1?'now':''}"></i>`).join('');
    $('foe').className=`k-${f.kind}${G.won?' dead':''}`;
    $('foe').innerHTML=`<div class="fart">${f.art}</div>
      <div class="fbody"><div class="fname">${f.n} <span class="fkind">${f.kind==='boss'?'Boss':f.kind==='elite'?'Elite':''}</span></div>
      <div class="hpbar"><div class="hpfill" style="width:${pctHp}%"></div><span>${G.won?'Defeated':`${fmt(Math.max(0,f.hp))} / ${fmt(f.max)}`}</span></div>
      <div class="frow"><span class="turns" title="Turns">${pips}</span><span class="tlabel">${G.won?'Defeated':`Turn ${G.turn} of ${tm}`}</span>
      ${G.burn?`<span class="burn">🔥 ${fmt(G.burn)}</span>`:''}</div>
      ${f.boss?`<div class="frule">${f.tx}</div>`:''}</div>`;
  }
  // bar
  const keep=Math.floor(G.mana*Math.min(1,TUNE.carry+(hasR('battery')?0.5:0)));
  $('mana').innerHTML=`<span class="orb">${fmt(G.mana)}</span><span class="mx"><b>×${fmt(Math.max(1,G.mana))}</b><small>damage · ${fmt(keep)} ${MANA} carries over</small></span>`;
  $('mana').style.setProperty('--glow',clamp(Math.log2(1+G.mana)/4,0.1,1).toFixed(2));
  const bf=[];
  if(G.focus) bf.push(`<span class="buff" title="Every hit deals more">🔷 +${fmt(G.focus)}</span>`);
  if(G.vuln) bf.push(`<span class="buff" title="Foe takes more damage this turn">🧿 +${G.vuln}%</span>`);
  if(G.empower>1) bf.push(`<span class="buff" title="Your next spell hits harder">💪 ×${G.empower}</span>`);
  if(G.echo) bf.push(`<span class="buff" title="Your next card resolves again">👥 +${G.echo}</span>`);
  const rm=G.runes.reduce((s,c)=>s+(c.manarune||0),0); if(rm) bf.push(`<span class="buff" title="Mana each turn from runes">🔶 +${rm}</span>`);
  $('buffs').innerHTML=bf.join('');
  $('pDeck').textContent=`📖 Deck ${G.deck.length}`; $('pDisc').textContent=`🪶 Spent ${G.discard.length}`;
  const et=$('endturn');
  et.textContent=G.won?'Claim victory':G.turn>=turnsMax()?'End last turn':'End turn';
  et.classList.toggle('win',!!G.won); et.classList.toggle('last',!G.won&&G.turn>=turnsMax());
  et.disabled=G.phase!=='turn'||G.over;
  // hand
  const H=$('hand'); H.innerHTML='';
  G.hand.forEach((c,i)=>{
    const el=cardEl(c,'hand'); el.classList.add(canPlay(c)?'playable':'dim');
    el.onclick=()=>{ if(UI.tap) inspect(c,'hand'); else playCard(c); };
    H.appendChild(el);
  });
  H.classList.toggle('crowd',G.hand.length>6);
}

/* ---------- inspector ---------- */
function inspect(c,where,i){
  const body=$('inspectBody'); body.innerHTML=''; body.appendChild(cardEl(c,where));
  const help=[...new Set(opsOf(c).map(o=>OP_HELP[o[0]]).filter(Boolean))];
  $('inspectInfo').innerHTML=(help.length?help.map(h=>`<p>${h}</p>`).join(''):'');
  const B=$('inspectBtns'); B.innerHTML='';
  const btn=(t,f,go)=>{ const b=document.createElement('button'); b.className='mbtn'+(go?' go':''); b.textContent=t; b.onclick=f; B.appendChild(b); };
  if(where==='hand'&&canPlay(c)) btn('Play',()=>{ closeInspect(); playCard(c); },true);
  btn('Close',closeInspect);
  $('inspect').classList.add('on');
}
function closeInspect(){ $('inspect').classList.remove('on'); }

/* ---------- choices (game.js awaits these) ---------- */
function openVeil(title,sub){ $('mTitle').textContent=title; $('mSub').textContent=sub||''; ['pool','mOpts','mPrev','mBtns'].forEach(id=>$(id).innerHTML=''); $('veil').scrollTop=0; $('veil').classList.add('on'); requestAnimationFrame(fitVeil); }
// When the list is taller than the screen, the buttons get a backdrop so cards scrolling under them stay out of the way.
function fitVeil(){ const v=$('veil'); v.classList.toggle('tall',v.scrollHeight>v.clientHeight+2); }
// A skip that loses a reward takes two taps, so a stray click can't throw it away.
function guardSkip(b,label,go){
  let armed=false; b.textContent=label;
  b.onclick=()=>{ if(armed) return go(); armed=true; b.textContent='Really skip? Tap again'; b.classList.add('warn');
    setTimeout(()=>{ armed=false; b.textContent=label; b.classList.remove('warn'); },2500); };
}
function closeVeil(){ $('veil').classList.remove('on'); }
// o.back adds a button that resolves 'back'; o.preview(c) shows the chosen card before → after.
function chooseCards(list,o){
  return new Promise(res=>{
    openVeil(o.title,o.sub);
    const chosen=new Set(), P=$('pool'), B=$('mBtns'), V=$('mPrev');
    const done=v=>{ closeVeil(); res(v); };
    const ok=document.createElement('button'); ok.className='mbtn go';
    const skipping=()=>o.max===1&&o.min===0&&!chosen.size;
    const upd=()=>{
      ok.disabled=chosen.size<o.min; ok.classList.remove('warn');
      if(skipping()&&o.why==='reward') guardSkip(ok,'Skip the reward',()=>done([]));
      else { ok.textContent=skipping()?'Skip':`Confirm${o.max>1?` (${chosen.size})`:''}`; ok.onclick=()=>done([...chosen]); }
      V.innerHTML='';
      if(o.preview&&chosen.size===1){ const c=[...chosen][0];
        V.append(cardEl(c,'pick'),Object.assign(document.createElement('span'),{className:'arrow',textContent:'➜'}),cardEl(o.preview(c),'pick')); }
      requestAnimationFrame(fitVeil);
    };
    list.forEach(c=>{
      const el=cardEl(c,'pick',o.badge?`<span class="badge">${o.badge(c)}</span>`:'');
      el.onclick=()=>{
        if(chosen.has(c)){ chosen.delete(c); el.classList.remove('selected'); }
        else { if(chosen.size>=o.max){ if(o.max!==1) return; chosen.clear(); P.querySelectorAll('.selected').forEach(x=>x.classList.remove('selected')); }
          chosen.add(c); el.classList.add('selected'); }
        upd();
      };
      let t=0; el.onpointerdown=()=>{ t=setTimeout(()=>inspectOnly(c),550); }; el.onpointerup=el.onpointerleave=()=>clearTimeout(t);
      P.appendChild(el);
    });
    if(o.back){ const b=document.createElement('button'); b.className='mbtn'; b.textContent=o.back; b.onclick=()=>done('back'); B.appendChild(b); }
    for(const [v,label] of o.extra||[]){ const b=document.createElement('button'); b.className='mbtn alt'; b.textContent=label; b.onclick=()=>done(v); B.appendChild(b); }
    B.appendChild(ok); upd();
  });
}
function inspectOnly(c){ inspect(c,'pick'); }
function chooseOption(title,sub,opts){
  return new Promise(res=>{
    openVeil(title,sub);
    for(const [k,t] of opts){ const b=document.createElement('button'); b.className='opt'; b.textContent=t; b.onclick=()=>{ closeVeil(); res(k); }; $('mOpts').appendChild(b); }
  });
}
// Pick a relic, then confirm: a first tap only selects, so it can be changed.
function chooseRelic(keys,title,sub,o){
  o=o||{};
  return new Promise(res=>{
    openVeil(title,sub);
    let sel=null; const done=v=>{ closeVeil(); res(v); };
    const ok=document.createElement('button'); ok.className='mbtn go';
    const upd=()=>{ ok.disabled=!sel; ok.textContent=!sel?(o.swap?'Choose one to let go':'Choose a relic'):o.swap?`Let ${RELICS[sel].n} go`:`Take ${RELICS[sel].n}`; };
    for(const k of keys){ const j=RELICS[k], b=document.createElement('button'); b.className='opt relicopt r-'+j.r;
      b.innerHTML=`<span class="ra">${j.art}</span><span><b>${j.n}</b> <i>${j.r}</i><br>${j.tx}</span>`;
      b.onclick=()=>{ sel=sel===k?null:k; $('mOpts').querySelectorAll('.relicopt').forEach(x=>x.classList.toggle('selected',x===b&&sel===k)); upd(); };
      $('mOpts').appendChild(b); }
    ok.onclick=()=>sel&&done(sel);
    const s=document.createElement('button'); s.className='mbtn';
    if(o.skip) { s.textContent=o.skip; s.onclick=()=>done(null); } else guardSkip(s,'Skip',()=>done(null));
    $('mBtns').append(s,ok); upd();
  });
}
function onRunEnd(title,text){
  $('oTitle').textContent=title;
  $('oText').textContent=`${text} You won ${plural(G.stats.kills,'fight')}; your biggest hit was ${fmt(G.stats.best)}. Best run: ${loadBest()} fights.`;
  $('over').classList.add('on');
}
function onVictory(){
  return new Promise(res=>{
    openVeil('The 8th Boss falls!',`You won the run with ${plural(G.hearts,'heart')} to spare. Play on into endless circles, where foes grow without limit?`);
    const a=document.createElement('button'); a.className='mbtn go'; a.textContent='Play on'; a.onclick=()=>{ closeVeil(); res(true); };
    const b=document.createElement('button'); b.className='mbtn'; b.textContent='End the run'; b.onclick=()=>{ closeVeil(); res(false); onRunEnd('Victory','You conquered all 8 circles.'); };
    $('mBtns').append(a,b);
  });
}

/* ---------- piles ---------- */
function showPile(title,cards){
  openVeil(title,cards.length?`${plural(cards.length,'card')}${title==='Draw pile'?', in no particular order':''}.`:'Empty.');
  cards.slice().sort((a,b)=>cname(a).localeCompare(cname(b))).forEach(c=>{ const el=cardEl(c,'pick'); el.onclick=()=>inspectOnly(c); $('pool').appendChild(el); });
  const b=document.createElement('button'); b.className='mbtn go'; b.textContent='Close'; b.onclick=closeVeil; $('mBtns').appendChild(b);
}
const showDeck=()=>{ if(G) showPile('Your spellbook',[...G.deck,...G.hand,...G.discard,...G.inPlay,...G.runes,...G.exhausted]); };

/* ---------- menus & title ---------- */
function openMenu(){ $('menu').classList.add('on'); }
function closeMenu(){ $('menu').classList.remove('on'); }
function toggleLog(){ $('side').classList.toggle('open'); }
async function startNew(){
  if(readSave()&&G&&!G.over&&!confirm('Start a new run? Your current run will be lost.')) return;
  deleteSave(); LEDGER.length=0; $('log').innerHTML='';
  ['title','over','menu'].forEach(id=>$(id).classList.remove('on')); closeVeil();
  SAVE.armed=true;
  await newRun(); render();
}
async function continueRun(){
  if(!loadGame()) return;
  $('title').classList.remove('on'); SAVE.armed=true; render();
  if(G.phase==='camp'&&G.camp) await campFlow();
}
function showTitle(){
  $('title').classList.add('on');
  const s=saveSummary(); $('tContinue').hidden=!s; $('tSave').textContent=s||'';
  const b=loadBest(); $('tBest').textContent=b?`Best run: ${plural(b,'fight')} won`:'';
}

addEventListener('DOMContentLoaded',()=>{
  layout(); $('sRange').value=Math.round(UI.scale*100); $('sTap').checked=UI.tap;
  $('endturn').onclick=()=>endTurn();
  $('pDeck').onclick=()=>G&&showPile('Draw pile',G.deck);
  $('pDisc').onclick=()=>G&&showPile('Discard pile',G.discard);
  $('btnDeck').onclick=showDeck; $('mDeck').onclick=()=>{ closeMenu(); showDeck(); };
  $('btnLedger').onclick=toggleLog; $('mLedger').onclick=()=>{ closeMenu(); toggleLog(); }; $('sideClose').onclick=toggleLog;
  $('logSave').onclick=downloadLog; $('mSave').onclick=downloadLog; $('oSave').onclick=downloadLog;
  $('btnMenu').onclick=openMenu; $('mClose').onclick=closeMenu;
  $('mNew').onclick=()=>{ closeMenu(); startNew(); };
  $('sDown').onclick=()=>setScale(UI.scale-0.05); $('sUp').onclick=()=>setScale(UI.scale+0.05);
  $('sRange').oninput=e=>setScale(e.target.value/100); $('sAuto').onclick=()=>setScale(1);
  $('sTap').onchange=e=>{ UI.tap=e.target.checked; saveUI(); };
  const how=()=>$('how').classList.add('on');
  $('tHow').onclick=how; $('mHow').onclick=()=>{ closeMenu(); how(); }; $('howClose').onclick=()=>$('how').classList.remove('on');
  $('tPlay').onclick=startNew; $('tContinue').onclick=continueRun; $('oAgain').onclick=()=>{ $('over').classList.remove('on'); deleteSave(); G=null; startNew(); };
  $('inspect').onclick=e=>{ if(e.target.id==='inspect') closeInspect(); };
  addEventListener('keydown',e=>{
    if(e.target.tagName==='INPUT') return;
    if(e.key==='+'||e.key==='=') setScale(UI.scale+0.05);
    else if(e.key==='-') setScale(UI.scale-0.05);
    if(!G||$('veil').classList.contains('on')||$('title').classList.contains('on')) return;
    if(e.key==='e'||e.key==='E') endTurn();
    else if(/^[1-9]$/.test(e.key)){ const c=G.hand[+e.key-1]; if(c) playCard(c); }
    else if(e.key==='Escape'){ closeInspect(); closeMenu(); }
  });
  showTitle();
});
