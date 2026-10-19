"use strict";
/* ==========================================================
   Coinkeep — UI: layout & scaling, rendering, modals, card
   inspector, effects, title screen, settings and input wiring.

   Every size in style.css is in rem, so the UI scale is one
   number: the root font-size. The layout (wide / narrow / short)
   is picked from the viewport measured in rem *after* scaling,
   so scaling up on a small screen switches to a compact layout.
   ========================================================== */

const UI = { layout:'wide', side:true, auto:1, scale:1, user:1, tapInspect:null, tab:'threats', touch:false,
             lastCoin:0, hits:new Set() };
const mqCoarse = matchMedia('(pointer: coarse)');

function loadPrefs(){
  try{ const p=JSON.parse(localStorage.getItem('dcrisis.ui')||'{}');
    if(p.user) UI.user=clamp(+p.user,.6,1.6);
    if(typeof p.tapInspect==='boolean') UI.tapInspect=p.tapInspect;
  }catch(e){}
}
function savePrefs(){ try{ localStorage.setItem('dcrisis.ui',JSON.stringify({user:UI.user,tapInspect:UI.tapInspect})); }catch(e){} }
const inspectOnTap = () => UI.tapInspect ?? UI.touch;

/* ---------- layout & scale ---------- */
function autoScale(){
  const W=innerWidth, H=innerHeight;
  if(H<520&&W>H) return clamp(H/460,.72,.95);              // phone, landscape
  if(W<700)      return clamp(W/430,.78,1);                // phone, portrait
  if(H>W*1.15)   return clamp(W/600,1,1.6);                // tablet / tall window, portrait
  return clamp(Math.min(W/1440,H/880),.85,1.9);            // tablet landscape, laptop, desktop, 4K
}
function applyLayout(){
  UI.touch=mqCoarse.matches;
  UI.auto=autoScale(); UI.scale=UI.auto*UI.user;
  const px=16*UI.scale;
  document.documentElement.style.fontSize=px+'px';
  const W=innerWidth/px, H=innerHeight/px;                 // viewport in rem
  UI.layout = (H<34&&W>H) ? 'short' : W<60 ? 'narrow' : 'wide';
  UI.side = UI.layout==='wide' && W>=78;
  const b=document.body;
  b.classList.remove('L-wide','L-narrow','L-short');
  b.classList.add('L-'+UI.layout);
  b.classList.toggle('compact',UI.layout!=='wide');
  b.classList.toggle('has-side',UI.side);
  b.classList.toggle('tab-market',UI.layout==='short'&&UI.tab==='market');
  b.classList.toggle('touch',UI.touch);
  if(UI.side) $('side').classList.remove('open');
  // cards too small to read drop their rules text (tap / hold to read them instead)
  const cardPx=v=>parseFloat(getComputedStyle(b).getPropertyValue(v))*px;
  b.classList.toggle('mini-mk',cardPx('--mk-w')<88);
  b.classList.toggle('mini-hd',cardPx('--hd-w')<88);
  syncSettings();
}
function setUserScale(v){ UI.user=clamp(Math.round(v*100)/100,.6,1.6); savePrefs(); applyLayout(); render(); }

function syncSettings(){
  const pct=Math.round(UI.user*100);
  $('sRange').value=pct; $('sVal').textContent=pct+'%';
  $('sEff').textContent=`Effective size ${Math.round(UI.scale*100)}% · ${UI.layout} layout`;
  $('sTap').checked=inspectOnTap();
}

/* ---------- log & toasts ---------- */
function log(msg,cls){
  const d=document.createElement('div'); if(cls)d.className=cls; d.textContent=msg;
  const l=$('log'); l.appendChild(d);
  while(l.children.length>200) l.removeChild(l.firstChild);
  l.scrollTop=l.scrollHeight;
  if(cls==='good'||cls==='bad'||cls==='big') toast(msg,cls);
}
function toast(msg,cls){
  if(UI.side&&cls!=='big') return;                         // the ledger is on screen already
  const box=$('toasts'), d=document.createElement('div');
  d.className='toast '+(cls||''); d.textContent=msg; box.appendChild(d);
  while(box.children.length>3) box.removeChild(box.firstChild);
  setTimeout(()=>d.remove(),3200);
}

/* ---------- effects: floating numbers, shakes, banners ---------- */
const buzz = ms => { try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} };
function floatText(anchor,text,cls){
  const r=anchor.getBoundingClientRect(), d=document.createElement('div');
  d.className='float '+(cls||''); d.textContent=text;
  d.style.left=(r.left+r.width/2)+'px'; d.style.top=r.top+'px';
  document.body.appendChild(d); setTimeout(()=>d.remove(),1000);
}
function pulseClass(el,cls,ms){ el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(()=>el.classList.remove(cls),ms); }
function banner(text,sub){
  const b=$('banner'); b.innerHTML=`<div>${text}</div>${sub?`<small>${sub}</small>`:''}`;
  pulseClass(b,'on',1500);
}
function fx(kind,arg){
  switch(kind){
    case 'shake': pulseClass(document.body,'shake',420); buzz(40); break;
    case 'hurt':  pulseClass(document.body,'hurt',500); buzz(80); break;
    case 'hit':   UI.hits.add(arg.id); break;
    case 'clear': floatText($('threats'),`${arg.art} cleared!`,'good'); buzz(25); break;
    case 'wave':  banner(`Wave ${arg}`,arg%TUNE.eliteEvery===0?'An Elite leads the charge':''); break;
    case 'lose':  buzz([90,60,180]); break;
  }
}

function resetUI(){
  $('log').innerHTML=''; $('toasts').innerHTML='';
  $('over').classList.remove('on'); closeInspect(); closeMenu();
  UI.lastCoin=0;
}
function showGameOver(text){
  $('overText').textContent=text;
  $('over').classList.add('on'); $('overBtn').focus();
}

/* ==========================================================
   MODALS
   ========================================================== */
function closeVeil(){ $('veil').classList.remove('on'); $('pool').innerHTML=''; $('mOpts').innerHTML=''; $('mBtns').innerHTML=''; }
function openVeil(title,sub,kind){
  closeInspect();
  $('mTitle').textContent=title; $('mSub').textContent=sub;
  $('pool').innerHTML=''; $('mOpts').innerHTML=''; $('mBtns').innerHTML='';
  $('pool').className=kind||'';
  $('veil').classList.add('on'); $('veil').scrollTop=0;
}

function chooseCards(pool,{min=0,max=1,title='Choose',sub='',badge=null}={}){
  return new Promise(res=>{
    if(!pool.length||max<=0){ res([]); return; }
    const chosen=new Set();
    openVeil(title,sub+(UI.touch?' Press and hold a card to read it.':' Right-click a card to read it up close.'));
    const p=$('pool');
    const ok=document.createElement('button'); ok.className='mbtn go';
    const upd=()=>{ ok.textContent=chosen.size?`Confirm ${chosen.size}`:(min===0?'Skip':'Confirm'); ok.disabled=chosen.size<min; };
    pool.forEach(c=>{
      const el=cardEl(c,{badge}); el.style.cursor='pointer'; el.tabIndex=0;
      const tog=()=>{
        if(chosen.has(c)) chosen.delete(c);
        else{
          if(chosen.size>=max){ if(max!==1) return; chosen.clear(); p.querySelectorAll('.selected').forEach(x=>x.classList.remove('selected')); }
          chosen.add(c);
        }
        el.classList.toggle('selected',chosen.has(c)); upd(); };
      el.onclick=()=>{ if(el._held){ el._held=false; return; } tog(); };
      el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tog();}};
      el.oncontextmenu=e=>{e.preventDefault();inspectCard(c);};
      onLongPress(el,()=>inspectCard(c));
      p.appendChild(el);
    });
    ok.onclick=()=>{closeVeil();res([...chosen]);};
    $('mBtns').appendChild(ok); upd();
    ok.focus();
  });
}

function chooseOption(title,sub,options){
  return new Promise(res=>{
    openVeil(title,sub);
    const box=$('mOpts');
    options.forEach(([k,label],i)=>{
      const b=document.createElement('button'); b.className='opt'; b.textContent=label;
      b.onclick=()=>{closeVeil();res(k);};
      box.appendChild(b); if(i===0) setTimeout(()=>b.focus(),0);
    });
  });
}

function chooseJoker(keys,title,sub,{skip='Skip'}={}){
  return new Promise(res=>{
    openVeil(title,sub,'jokers');
    const p=$('pool');
    keys.forEach(k=>{
      const el=jokerCardEl(k); el.tabIndex=0; el.setAttribute('role','button');
      el.onclick=()=>{closeVeil();res(k);};
      el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();closeVeil();res(k);}};
      p.appendChild(el);
    });
    const b=document.createElement('button'); b.className='mbtn'; b.textContent=skip;
    b.onclick=()=>{closeVeil();res(null);};
    $('mBtns').appendChild(b);
    setTimeout(()=>{ const f=p.querySelector('.jcard'); if(f) f.focus(); },0);
  });
}

function chooseSplice(keys,title,sub){
  return new Promise(res=>{
    openVeil(title,sub,'jokers');
    const p=$('pool');
    keys.forEach(k=>{
      const el=spliceCardEl(k); el.tabIndex=0; el.setAttribute('role','button');
      el.onclick=()=>{closeVeil();res(k);};
      el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();closeVeil();res(k);}};
      p.appendChild(el);
    });
    const b=document.createElement('button'); b.className='mbtn'; b.textContent='Skip';
    b.onclick=()=>{closeVeil();res(null);};
    $('mBtns').appendChild(b);
    setTimeout(()=>{ const f=p.querySelector('.jcard'); if(f) f.focus(); },0);
  });
}

function viewPile(title,pile){
  const list=pile.slice().sort((a,b)=>cname(a).localeCompare(cname(b)));
  openVeil(title,plural(pile.length,'card')+' — tap a card to read it.');
  const p=$('pool');
  list.forEach(c=>{ const el=cardEl(c); el.tabIndex=0; el.style.cursor='zoom-in';
    el.onclick=()=>inspectCard(c); el.onkeydown=e=>{if(e.key==='Enter')inspectCard(c);}; p.appendChild(el); });
  const b=document.createElement('button'); b.className='mbtn'; b.textContent='Close'; b.onclick=closeVeil;
  $('mBtns').appendChild(b); b.focus();
}

/* ---------- inspector: a large, readable view of one card / joker / threat ---------- */
function openInspect(node,info,actions=[]){
  const body=$('inspectBody'); body.innerHTML=''; body.appendChild(node);
  $('inspectInfo').textContent=info||'';
  const btns=$('inspectBtns'); btns.innerHTML='';
  for(const [label,fn,cls,dis] of actions){
    const b=document.createElement('button'); b.className='mbtn '+(cls||''); b.textContent=label; b.disabled=!!dis;
    b.onclick=()=>{ closeInspect(); if(fn) fn(); }; btns.appendChild(b);
  }
  const close=document.createElement('button'); close.className='mbtn'; close.textContent='Close'; close.onclick=closeInspect;
  btns.appendChild(close);
  $('inspect').classList.add('on');
  (btns.querySelector('button:not(:disabled)')||close).focus();
}
function closeInspect(){ $('inspect').classList.remove('on'); }

function inspectCard(c,act,label){
  const el=cardEl(c); el.classList.add('big');
  const info=[];
  if(c.t==='treasure'&&G) info.push(`Produces ${tval(c)} Coin right now.`);
  if(label&&label.startsWith('Buy')) info.push('Bought cards go to the bottom of your draw pile.');
  openInspect(el,info.join(' '),label?[[label,act,'go',!act]]:[]);
}

/* touch press-and-hold (iOS has no contextmenu); swallows the click that follows */
function onLongPress(el,fn){
  let timer=0, x=0, y=0;
  const cancel=()=>clearTimeout(timer);
  el.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse') return;
    x=e.clientX; y=e.clientY; cancel();
    timer=setTimeout(()=>{ el._held=true; fn(); },450);
  });
  el.addEventListener('pointermove',e=>{ if(Math.hypot(e.clientX-x,e.clientY-y)>10) cancel(); });
  el.addEventListener('pointerup',cancel);
  el.addEventListener('pointercancel',cancel);
}

/* tap/click behaviour shared by hand and market cards */
function bindCard(el,c,act,label){
  el.tabIndex=0;
  el.onclick=()=>{ if(act&&!inspectOnTap()) act(); else inspectCard(c,act,label); };
  el.oncontextmenu=e=>{ e.preventDefault(); inspectCard(c,act,label); };
  el.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); act?act():inspectCard(c,act,label); } };
}

/* ==========================================================
   RENDER
   ========================================================== */
function cardEl(c,{badge}={}){
  const d=DB[c.key], el=document.createElement('div');
  el.className=`card t-${d.t}${d.r?' r':''}${c.lv?` lv${Math.min(3,c.lv)}`:''}${c.frozen?' frozen':''}`;
  const kind=d.r?'Reaction':({treasure:'Treasure',action:'Action',victory:'Junk',junk:'Junk',curse:'Junk'}[d.t]||d.t);
  const stars=c.lv?(c.lv<=3?'★'.repeat(c.lv):`★${c.lv}`):'';
  // splices: icon chips (scars in red), empty slots in splice mode, and full text lines for the big view
  let chips='', lines='';
  if(c.mods.length||(splice()&&!isJunk(c))){
    chips=c.mods.map(k=>`<i class="${SPLICES[k].scar?'scar':''}">${SPLICES[k].art}</i>`).join('');
    if(splice()&&!isJunk(c)) chips+='<i class="open"></i>'.repeat(Math.max(0,TUNE.spliceSlots(c)-slotsUsed(c)));
    lines=c.mods.map(k=>`<span class="mline${SPLICES[k].scar?' scar':''}">${SPLICES[k].art} ${spliceText(k,c)}</span>`).join('');
    if(c.mods.length) el.classList.add('spliced');
  }
  el.innerHTML=`<div class="banner">${cname(c)}</div>
    <div class="art"><span>${d.art||'✦'}</span>${chips?`<div class="mods">${chips}</div>`:''}</div>
    <div class="tx"><span>${ctext(c)}</span>${lines}</div>
    <div class="foot"><span>${kind}</span><span class="stars">${stars}</span></div>`;
  const cost=document.createElement('div'); cost.className='cost'; cost.textContent=costOf(c);
  el.appendChild(cost);
  const bt=badge&&badge(c);
  if(bt){ const b=document.createElement('div'); b.className='badge'; b.textContent=bt; el.appendChild(b); }
  return el;
}

function jokerCardEl(k,status){
  const j=JOKERS[k], el=document.createElement('div');
  el.className=`jcard ${j.r}`;
  el.innerHTML=`<div class="jr">${j.r}</div><div class="jart">${j.art}</div><div class="jn">${j.n}</div><div class="jtx">${j.tx}</div>${status?`<div class="jst">Now: ${status}</div>`:''}`;
  return el;
}

function spliceCardEl(k){
  const S=SPLICES[k], el=document.createElement('div');
  el.className=`jcard splice ${S.r}`;
  el.innerHTML=`<div class="jr">${S.r} splice</div><div class="jart">${S.art}</div><div class="jn">${S.n}</div><div class="jtx">${spliceText(k)}${S.once?'':'<br><small>Stacks.</small>'}${S.only?`<br><small>Actions only.</small>`:''}</div>`;
  return el;
}

function threatProgress(t){
  const cm=coinMult()>1?' (×2)':'', um=unitMult()>1?' (×2)':'';
  switch(t.kind){
    case 'prog_coin':    return {pct:t.prog/t.need, left:`${t.prog} / ${t.need} coin`, note:`${t.need-t.prog} owed${cm}`};
    case 'once_coin':    return {pct:Math.min(1,G.coin/Math.max(1,coinFor(t.need))), left:`${t.need} coin at once${cm}`, note:`you hold ${G.coin}`};
    case 'prog_action':  return {pct:t.prog/t.need, left:`${t.prog} / ${t.need} Actions`, note:`${t.need-t.prog} owed${um}`};
    case 'prog_buy':     return {pct:t.prog/t.need, left:`${t.prog} / ${t.need} Buys`, note:`${t.need-t.prog} owed${um}`};
    case 'prog_discard': return {pct:t.prog/t.need, left:`${t.prog} / ${t.need} cards fed`, note:`${t.need-t.prog} wanted`};
    case 'sacrifice':    return {pct:t.prog/t.need, left:`${t.prog} / ${t.need} cards trashed`, note:`${t.need-t.prog} wanted`};
    case 'panic':        return {pct:0, left:'instant', note:`costs ${plural(t.curses,'Curse')}`};
    case 'once_hybrid':  { const nc=Math.max(1,coinFor(t.needCoin)), na=Math.max(1,unitsFor(t.needAct));
                           return {pct:Math.min(1,(Math.min(G.coin,nc)/nc*0.75)+(Math.min(G.actions,na)/na*0.25)),
                                   left:`${t.needCoin} coin + ${t.needAct} Actions`, note:`you hold ${G.coin} / ${G.actions}`}; }
    case 'scavenge':     return {pct:t.prog/t.need, left:`${t.prog} / ${t.need} fed`, note:'junk counts ×2'};
    case 'banish':       { const n=t.need-t.prog;
                           return {pct:Math.min(1,G.actionsPlayed/Math.max(1,n)), left:`${n} Actions in one turn`, note:`played ${G.actionsPlayed}`}; }
    case 'upgrade':      return {pct:(t.gotT+t.gotA)/(t.needT+t.needA),
                                 left:`Treasure ${t.gotT}/${t.needT} · Action ${t.gotA}/${t.needA}`, note:'trash from hand'};
  }
  return {pct:0,left:'',note:''};
}
function threatButton(t){
  const rem=t.need-t.prog;
  switch(t.kind){
    case 'prog_coin':    return `Deposit ${Math.min(G.coin,coinFor(rem))} coin`;
    case 'once_coin':    return `Pay ${coinFor(t.need)} coin`;
    case 'prog_action':  return `Spend ${plural(Math.min(G.actions,unitsFor(rem)),'Action')}`;
    case 'prog_buy':     return `Spend ${plural(Math.min(G.buys,unitsFor(rem)),'Buy')}`;
    case 'prog_discard': return 'Feed cards';
    case 'sacrifice':    return 'Sacrifice cards';
    case 'panic':        return 'Shake on it';
    case 'once_hybrid':  return `Pay ${coinFor(t.needCoin)} coin + ${plural(unitsFor(t.needAct),'Action')}`;
    case 'upgrade':      return 'Trash into the rift';
    case 'scavenge':     return 'Feed the nest';
    case 'banish':       return 'Banish it';
  }
  return 'Act';
}
const attackWhen = t => t.cd<=1 ? 'at end of this turn' : `in ${t.cd} turns`;
// The attack line under a threat; in splice mode it is the fuse.
function atkLine(t){
  if(!splice()) return `⚔ <b>${t.atk.name}</b> ${attackWhen(t)}: ${atkText(t)}.`;
  const what=t.atk.k==='grow'?'':t.atk.k==='price'?`you take ${junkName('jinx',t.curses)}, `:`${atkText(t)}, `;
  return `💥 <b>Detonates</b> ${attackWhen(t)}: ${what}scars a card, −${t.elite?2:1} ❤.`;
}
function rewardLine(t){
  if(!splice()) return '';
  const swift=t.age<=1;
  return `<div class="treward">✨ Clear it: splice a keyword${swift?` · <b>swift bonus</b> ${t.age===0?'this turn or next':'this turn'}`:''}</div>`;
}

function threatInfoEl(t){
  const p=threatProgress(t), el=document.createElement('div');
  el.className='tinfo'+(t.elite?' elite':'');
  el.innerHTML=`<div class="thead"><div class="tart">${t.art}</div><div><div class="tname">${t.n}</div><div class="tkind">${t.label}</div></div></div>
    <p>${t.desc(t)}</p>
    <div class="tatk${t.cd<=1?' imminent':''}">${atkLine(t)}</div>
    ${rewardLine(t)}
    <p class="tnum"><span>${p.left}</span><span>${p.note}</span></p>
    ${!splice()&&t.age>=TUNE.enrageAfter?'<p class="warn">Enraged: it attacks every turn until cleared.</p>':''}`;
  return el;
}

function chip(id,long,short,cls){
  const e=$(id); e.innerHTML=`<span class="long">${long}</span><span class="short">${short}</span>`;
  e.className='chip'+(cls?' '+cls:'');
}

function render(){
  if(!G) return;
  const live=!busy&&!G.over&&G.phase==='turn';

  // top bar
  chip('cWave',`Wave ${G.wave}`,`W${G.wave}`,'wave');
  chip('cTurn',`Turn ${G.turnInWave}`,`T${G.turnInWave}`);
  chip('cHearts',`❤ ${G.hearts} / ${TUNE.hearts}`,`❤ ${G.hearts}`,G.hearts<=2?'now':'hearts');
  $('cHearts').hidden=!splice();
  const remaining=G.queue.length+G.slots.filter(s=>s).length;
  chip('cQueue',`Threats ${remaining} / ${G.waveTotal}`,`☠ ${remaining}/${G.waveTotal}`);
  chip('cTier',`Market tier: ${tierName(TUNE.maxTier(G.wave))}`,`Tier ${tierName(TUNE.maxTier(G.wave))}`);
  const every=TUNE.spawnEvery(G.wave), untilSpawn=G.slots.every(s=>!s)?0:every-(G.turnInWave%every||every);
  if(!G.queue.length) chip('cNext','No more threats this wave','⏳ —');
  else chip('cNext', untilSpawn===0?'Next threat at end of this turn':`Next threat in ${plural(untilSpawn,'turn')}`,
                     `⏳ ${untilSpawn===0?'now':untilSpawn}`, untilSpawn===0?'now':untilSpawn===1?'soon':'');

  // jokers
  const J=$('jokers'); J.innerHTML='<span class="jlabel">CHARMS</span>';
  for(let i=0;i<TUNE.jokerSlots;i++){
    const j=G.jokers[i], el=document.createElement('button');
    if(!j){ el.className='joker empty'; el.disabled=true; el.setAttribute('aria-label','Empty charm slot'); J.appendChild(el); continue; }
    const d=JOKERS[j.key], st=jokerStatus(j);
    el.className='joker '+d.r;
    el.setAttribute('aria-label',`${d.n}: ${d.tx}`);
    el.innerHTML=`<span class="ja">${d.art}</span><span class="jname">${d.n}</span>${st?`<span class="js">${st}</span>`:''}
      <span class="jtip"><b>${d.n}</b> · <i>${d.r}</i><br>${d.tx}</span>`;
    el.onclick=()=>openInspect(jokerCardEl(j.key,st),'');
    J.appendChild(el);
  }

  // market
  const m=$('market'); m.innerHTML=''; let affordable=0;
  G.market.forEach((c,i)=>{
    const slot=document.createElement('div'); slot.className='slot'+(i<2?' leaving':'');
    if(c){
      const el=cardEl(c), price=costOf(c);
      const afford=G.buys>0&&G.coin>=price&&live; if(afford) affordable++;
      el.classList.toggle('buyable',afford); el.classList.toggle('dead',!afford);
      bindCard(el,c,afford?()=>buyCard(i):null,`Buy for ${price}`);
      slot.appendChild(el);
      if(i<2){ const tag=document.createElement('div'); tag.className='leaving-tag'; tag.textContent='leaves'; slot.appendChild(tag); }
    }
    m.appendChild(slot);
  });
  $('tabBadge').textContent=affordable?affordable:'';
  $('tabThreats').classList.toggle('on',UI.tab==='threats');
  $('tabMarket').classList.toggle('on',UI.tab==='market');

  // threats
  const T=$('threats'); T.innerHTML='';
  G.slots.forEach((t,i)=>{
    const box=document.createElement('div');
    if(!t){ box.className='tslot empty'; box.textContent=`Slot ${i+1} — clear`; T.appendChild(box); return; }
    const p=threatProgress(t), ready=threatReady(t)&&live;
    box.className='tslot'+(ready?' ready':'')+(t.fresh?' new':'')+(t.elite?' elite':'')+(UI.hits.has(t.id)?' hit':'');
    box.innerHTML=`
      <button class="thead" title="Read this threat"><span class="tart">${t.art}</span>
        <span class="tnames"><span class="tname">${t.n}</span><span class="tkind">${t.label}</span></span><span class="ti">ⓘ</span></button>
      <div class="tdesc">${t.desc(t)}</div>
      <div class="tatk${t.cd<=1?' imminent':''}">${atkLine(t)}</div>
      ${rewardLine(t)}
      <div class="tnum"><span>${p.left}</span><span class="dim">${p.note}</span></div>
      <div class="tbar"><div class="tfill ${t.bar}" style="width:${Math.round(clamp(p.pct,0,1)*100)}%"></div></div>`;
    box.querySelector('.thead').onclick=()=>openInspect(threatInfoEl(t),'',[[threatButton(t),()=>clickThreat(t),'go',!(threatReady(t)&&live)]]);
    const pips=[];
    if(t.elite) pips.push('<span class="pip elite">ELITE</span>');
    if(!splice()&&t.age>=TUNE.enrageAfter) pips.push('<span class="pip">ENRAGED</span>');
    if(pips.length){ const d=document.createElement('div'); d.className='pips'; d.innerHTML=pips.join(''); box.appendChild(d); }
    const b=document.createElement('button');
    b.className='tbtn2'+(t.kind==='panic'?' blood':ready?' go':'');
    b.textContent=threatButton(t); b.disabled=!ready;
    b.onclick=()=>clickThreat(t);
    box.appendChild(b);
    T.appendChild(box);
  });

  UI.hits.clear();

  // resources
  const r=(id,v,label,icon)=>{const e=$(id); e.innerHTML=`${icon}<span class="lbl"> ${label}</span> <b>${v}</b>`; e.classList.toggle('spent',v<=0);};
  r('rAct',G.actions,'Actions','⚡'); r('rBuy',G.buys,'Buys','🛒');
  $('rCoin').innerHTML=`🪙<span class="lbl"> Coin</span> <b>${G.coin}</b>`;
  if(G.coin>UI.lastCoin){ floatText($('rCoin'),`+${G.coin-UI.lastCoin}`,'coin'); pulseClass($('rCoin'),'bump',300); }
  UI.lastCoin=G.coin;
  $('pDeck').innerHTML=`<span class="long">Draw </span><span class="short">📚 </span>${G.deck.length}`;
  $('pDisc').innerHTML=`<span class="long">Discard </span><span class="short">🗑 </span>${G.discard.length}`;
  $('pTreas').disabled=!live||!G.hand.some(c=>c.t==='treasure');
  $('btnDeck').textContent=`Deck (${deckSize()})`;
  $('endturn').disabled=!live;

  // hand — overlap cards just enough to fit the width
  const h=$('hand'); h.innerHTML='';
  G.hand.forEach(c=>{
    const el=cardEl(c), ok=canPlay(c)&&live;
    el.classList.toggle('playable',ok); el.classList.toggle('dead',!ok);
    bindCard(el,c,ok?()=>playCard(c):null,'Play');
    h.appendChild(el);
  });
  if(h.children.length){
    const cw=h.children[0].offsetWidth, n=h.children.length;
    const avail=$('handwrap').clientWidth-12;
    const m=Math.min(-cw*.12,(avail/n-cw)/2);
    for(const el of h.children) el.style.margin=`0 ${m}px`;
  }
}

/* ==========================================================
   MENU / SETTINGS
   ========================================================== */
function openMenu(){ syncSettings(); $('menu').classList.add('on'); $('mClose').focus(); }
function closeMenu(){ $('menu').classList.remove('on'); }
function toggleLedger(force){
  const s=$('side'), on=force??!s.classList.contains('open');
  s.classList.toggle('open',on);
  if(on){ const l=$('log'); l.scrollTop=l.scrollHeight; }
}
async function confirmNewRun(){
  closeMenu();
  if(busy) return;
  if(G&&!G.over&&G.turn>1){
    busy=true; render();
    const k=await chooseOption('Abandon this run?',`You are on wave ${G.wave}. Your deck and jokers will be lost.`,
      [['n','Keep playing'],['y','Start a new run']]);
    busy=false;
    if(k!=='y'){ render(); return; }
  }
  newRun();
}
function setTab(tab){ UI.tab=tab; document.body.classList.toggle('tab-market',UI.layout==='short'&&tab==='market'); render(); }

/* ---------- wiring ---------- */
$('endturn').onclick=endTurn;
$('pTreas').onclick=playAllTreasures;
$('btnDeck').onclick=()=>viewPile('Your whole deck',allCards());
$('btnTrash').onclick=()=>viewPile('Trash',G.trash);
$('btnNew').onclick=confirmNewRun;
$('btnLedger').onclick=()=>toggleLedger();
$('sideClose').onclick=()=>toggleLedger(false);
$('btnMenu').onclick=openMenu;
$('pDeck').onclick=()=>viewPile('Draw pile (sorted)',G.deck);
$('pDisc').onclick=()=>viewPile('Discard pile',G.discard);
$('tabThreats').onclick=()=>setTab('threats');
$('tabMarket').onclick=()=>setTab('market');
$('overBtn').onclick=()=>newRun(G.mode);
const startMode=mode=>{ $('title').classList.remove('on'); newRun(mode); };
$('tPlay').onclick=()=>startMode('splice');
$('tClassic').onclick=()=>startMode('classic');
$('tHow').onclick=()=>$('howto').classList.add('on');
$('hClose').onclick=()=>$('howto').classList.remove('on');
$('mHow').onclick=()=>{ closeMenu(); $('howto').classList.add('on'); };

$('menu').onclick=e=>{ if(e.target.id==='menu') closeMenu(); };
$('mClose').onclick=closeMenu;
$('sRange').oninput=e=>setUserScale(+e.target.value/100);
$('sDown').onclick=()=>setUserScale(UI.user-.1);
$('sUp').onclick=()=>setUserScale(UI.user+.1);
$('sAuto').onclick=()=>setUserScale(1);
$('sTap').onchange=e=>{ UI.tapInspect=e.target.checked; savePrefs(); };
$('mDeck').onclick=()=>{ closeMenu(); viewPile('Your whole deck',allCards()); };
$('mTrash').onclick=()=>{ closeMenu(); viewPile('Trash',G.trash); };
$('mLedger').onclick=()=>{ closeMenu(); if(!UI.side) toggleLedger(true); };
$('mNew').onclick=confirmNewRun;
$('inspect').onclick=e=>{ if(e.target.id==='inspect') closeInspect(); };

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){ closeInspect(); closeMenu(); toggleLedger(false); $('howto').classList.remove('on'); return; }
  if($('title').classList.contains('on')||$('howto').classList.contains('on')) return;
  if($('veil').classList.contains('on')||$('inspect').classList.contains('on')||$('menu').classList.contains('on')||busy) return;
  if(e.target.tagName==='INPUT') return;
  if(e.key==='e') endTurn();
  if(e.key==='t') playAllTreasures();
  if(e.key==='+'||e.key==='=') setUserScale(UI.user+.1);
  if(e.key==='-') setUserScale(UI.user-.1);
});

let rq=0;
const relayout=()=>{ cancelAnimationFrame(rq); rq=requestAnimationFrame(()=>{ applyLayout(); render(); }); };
addEventListener('resize',relayout);
addEventListener('orientationchange',relayout);
if(window.visualViewport) visualViewport.addEventListener('resize',relayout);
if(mqCoarse.addEventListener) mqCoarse.addEventListener('change',relayout);

loadPrefs();
applyLayout();
newRun();
{ const b=loadBest(); $('tBest').textContent=b?`Best run: ${plural(b,'wave')} cleared`:'No runs yet — good luck, steward!'; }
