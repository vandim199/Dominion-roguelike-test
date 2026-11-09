"use strict";
/* ==========================================================
   Spellbook — rules: state, fights, turns, card resolution.
   Rendering and choices live in ui.js (or sim/bots.js), which
   provides: render, log, fx, chooseCards, chooseOption,
   chooseRelic, saveNow, deleteSave, onRunEnd.
   Every chooseCards call carries a why, so bots know what
   they are choosing for; the UI ignores it.
   ========================================================== */

let G=null, busy=false, uid=0;
// Each published version (v/<branch>/ on the site) keeps its own save and best run.
const SLOT = (typeof location!=='undefined'&&(/\/v\/([\w-]+)\//.exec(location.pathname)||[])[1]) || '';
const slotKey = k => SLOT ? `${k}.${SLOT}` : k;
// Seeded randomness, saved with the run: a reload can't reroll a shuffle, a draw or an offer.
const nativeRandom=Math.random;
Math.random=()=>{
  if(!G||G.rng==null) return nativeRandom();
  let t=G.rng=(G.rng+0x6D2B79F5)>>>0;
  t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61);
  return ((t^(t>>>14))>>>0)/4294967296;
};
function mk(key,lv=0){ return {uid:++uid,key,lv:DB[key].noLv?0:lv,t:DB[key].t}; }
function pull(a,c){const i=a.indexOf(c);if(i>=0)a.splice(i,1);return i>=0;}
const hasR  = k => !!G && G.relics.some(r=>r.key===k);
const cname = c => DB[c.key].n+plus(c.lv);
const opsOf = c => DB[c.key].ops(c.lv,c);
const ctext = c => opsOf(c).map(opText);
const isSpell = c => opsOf(c).some(o=>['dmg','chain','burn','nova'].includes(o[0]));
const baseCost = c => { const d=DB[c.key]; return d.c + (d.c||2)*(tierMult(c.lv)-1) + d.step*c.lv; };
const allCards = () => [...G.deck,...G.hand,...G.discard,...G.inPlay,...G.runes];
const deckSize = () => allCards().length + G.exhausted.length;
const circleOf = f => Math.floor(f/TUNE.fightsPerCircle)+1;
const turnsMax = () => TUNE.turns+(hasR('hourglass')?1:0)-(hasR('glass')?1:0);
const handSize = () => TUNE.handSize+(hasR('robes')?1:0)-(boss('ogre')?1:0);
const boss = k => !!G && !!G.foe && G.foe.boss===k;
const manaCap = () => boss('rift') ? 8 : Infinity;
const cardWorth = c => DB[c.key].noLv ? -1 : baseCost(c);
const playCost = () => boss('heavy') ? 2 : 1;

function loadBest(){ try{ return +localStorage.getItem(slotKey('spellkeep.best'))||0; }catch(e){ return 0; } }
function saveBest(n){ try{ if(n>loadBest()) localStorage.setItem(slotKey('spellkeep.best'),String(n)); }catch(e){} }

async function newRun(seed){
  G={ rng:seed!=null?seed>>>0:(nativeRandom()*4294967296)>>>0, hearts:TUNE.hearts, arcana:TUNE.startArcana,
      deck:[],hand:[],discard:[],inPlay:[],runes:[],exhausted:[],trash:[],
      mana:0, carry:0, turn:0, fight:-1, foe:null, burn:0, focus:0, vuln:0, empower:1, echo:0,
      spells:0, played:0, flags:{}, market:[], relics:[], bossesSeen:[], phase:'turn', over:false, won:false,
      stats:{dealt:0,best:0,kills:0,fails:0} };
  for(let i=0;i<4;i++) G.deck.push(mk('mote'));
  for(let i=0;i<4;i++) G.deck.push(mk('zap'));
  for(let i=0;i<2;i++) G.deck.push(mk('channel'));
  log('Your tower stands. Foes come one at a time: bring each down within its turns.','hl');
  await startFight();
}

/* ---------- market ---------- */
function rollTier(){ const m=TUNE.maxTier(circleOf(G.fight)); return Math.max(0,wpick([[m,50],[m-1,30],[m-2,10],[m+1,10]])); }
function marketCard(){ return mk(wpick(MARKET_KEYS.filter(k=>DB[k].t!=='arcana').map(k=>[k,DB[k].rare?2:10])),rollTier()); }
function arcanaCard(){ const c=circleOf(G.fight); return mk(wpick([['crystal',40],['starshard',10+5*c],['alembic',12],['hoard',10]]),rollTier()); }
function newMarket(){
  G.market=[]; for(let i=0;i<TUNE.marketSize-2;i++) G.market.push(marketCard());
  G.market.push(arcanaCard(),arcanaCard()); shuffle(G.market);
}
const marketOpen = () => !boss('pirate');
function buyCard(i){
  if(busy||G.over||G.phase!=='turn'||!marketOpen()) return false;
  const c=G.market[i]; if(!c) return false;
  const p=baseCost(c); if(G.arcana<p) return false;
  G.arcana-=p; G.discard.push(c);
  G.market[i]= DB[c.key].t==='arcana' ? arcanaCard() : marketCard();
  log(`You learn ${cname(c)} for ${p} ${ARC}.`,'good'); fx('buy',c);
  render(); return true;
}

/* ---------- deck ---------- */
function popDeck(){
  if(!G.deck.length){ if(!G.discard.length)return null;
    G.deck=shuffle(G.discard.slice()); G.discard=[]; log('You shuffle your discard pile into your deck.'); }
  return G.deck.shift()||null;
}
function draw(n,bySpell){
  let got=0, eaten=0;
  for(let i=0;i<n;i++){
    if(bySpell&&boss('worm')&&G.flags.eaten<4){ G.flags.eaten++; eaten++; const c=popDeck(); if(c) G.discard.push(c); continue; }
    const c=popDeck(); if(!c)break; G.hand.push(c); got++;
  }
  if(eaten) log(`The Bookworm eats ${plural(eaten,'card')}.`,'bad');
  return got;
}
function gatherDeck(){
  G.deck=shuffle([...G.deck,...G.hand,...G.discard,...G.inPlay,...G.runes,...G.exhausted]);
  G.hand=[]; G.discard=[]; G.inPlay=[]; G.runes=[]; G.exhausted=[];
  G.deck.forEach(c=>{ c.frozen=false; });
}
function trashCard(c){ G.trash.push(c); }

/* ==========================================================
   FIGHTS
   ========================================================== */
async function startFight(){
  G.fight++; const f=G.fight, c=circleOf(f), slot=f%TUNE.fightsPerCircle;
  gatherDeck();
  const kind = slot===2?'boss':slot===1?'elite':'minion';
  let hp=TUNE.hp0*TUNE.hpGrowth(f)*(kind==='boss'?TUNE.bossHp:kind==='elite'?TUNE.eliteHp:1);
  hp=niceHp(hp);
  if(slot===0||!G.nextBoss){
    let pool=BOSS_KEYS.filter(k=>!G.bossesSeen.includes(k)); if(!pool.length){ G.bossesSeen=[]; pool=BOSS_KEYS.slice(); }
    G.nextBoss=pick(pool); G.bossesSeen.push(G.nextBoss);
  }
  let foe;
  if(kind==='boss') foe={...BOSSES[G.nextBoss],boss:G.nextBoss};
  else foe={...pick(kind==='elite'?ELITES:MINIONS)};
  G.foe={...foe,kind,hp,max:hp,circle:c};
  G.burn=0; G.focus=0; G.turn=0; G.carry=0; G.won=false; G.phase='turn';
  newMarket();
  log(`Circle ${c} · ${kind==='boss'?'Boss':kind==='elite'?'Elite':'Foe'} ${f%3+1}/3`,'wave');
  log(`${foe.art} ${foe.n} appears with ${fmt(hp)} health. You have ${plural(turnsMax(),'turn')}.`,'hl');
  if(foe.boss) log(`${foe.n}: ${foe.tx}`,'bad');
  else if(slot===0) log(`This circle's Boss: ${BOSSES[G.nextBoss].art} ${BOSSES[G.nextBoss].n}. ${BOSSES[G.nextBoss].tx}`);
  if(boss('queen')) freezeBest(2);
  if(boss('pirate')&&G.arcana>0){ const s=Math.floor(G.arcana/2); G.arcana-=s; log(`The Pirate Lich plunders ${s} ${ARC}.`,'bad'); }
  fx('foe',G.foe);
  await startTurn();
}
function niceHp(x){ if(x<100) return Math.round(x); const p=Math.pow(10,Math.floor(Math.log10(x))-1); return Math.round(x/p)*p; }
function freezeBest(n){
  for(let i=0;i<n;i++){ const c=allCards().filter(c=>!c.frozen&&!DB[c.key].noLv).sort((a,b)=>cardWorth(b)-cardWorth(a))[0];
    if(!c) return; c.frozen=true; log(`🧊 Your ${cname(c)} is frozen for this fight.`,'bad'); }
}

async function startTurn(){
  G.turn++; G.played=0; G.spells=0; G.vuln=0; G.empower=1; G.echo=0;
  G.flags={eaten:0,firstHit:false,twin:false,owl:false};
  G.mana=TUNE.startMana+(hasR('crystalball')?1:0)+G.carry+G.runes.reduce((s,c)=>s+(c.manarune||0),0);
  G.mana=Math.min(G.mana,manaCap()); G.carry=0;
  if(boss('witch')) gainCurse(2,true);
  if(boss('goblin')&&G.arcana>0){ const s=Math.ceil(G.arcana/4); G.arcana-=s; log(`The Goblin Thief steals ${s} ${ARC}.`,'bad'); }
  if(hasR('quill')){ const q=Math.floor(deckSize()/5); if(q) { G.arcana+=q; } }
  draw(handSize());
  log(`Turn ${G.turn}/${turnsMax()} · ${G.mana} ${MANA}`);
  render();
  if(boss('toll')&&!G.won){
    const n=Math.min(2,G.hand.length);
    const ch=await chooseCards(G.hand,{min:n,max:n,why:'toll',title:'Toll Golem',sub:`Discard ${plural(n,'card')}.`});
    ch.forEach(c=>{pull(G.hand,c);G.discard.push(c);}); render();
  }
  saveNow();
}
function gainCurse(n,intoDeck){
  for(let i=0;i<n;i++){ const c=mk('curse'); if(intoDeck) G.deck.splice(rnd(G.deck.length+1),0,c); else G.discard.push(c); }
  log(`${plural(n,'Curse')} ${intoDeck?'are shuffled into your draw pile':'land in your discard pile'}.`,'bad'); }

/* ==========================================================
   PLAYING CARDS
   State S is G itself, or a light copy when a bot or the UI
   looks ahead (dry: no draws, choices or logs).
   ========================================================== */
function canPlay(c){
  if(G.over||G.phase!=='turn'||busy) return false;
  const d=DB[c.key]; if(d.unplayable||c.frozen) return false;
  return G.mana>=playCost();
}
// Damage multiplier for one hit, before the hit's own base.
function hitMult(S){
  let m=Math.max(1,S.mana)*S.cardMult;
  if(S.vuln) m*=1+S.vuln/100;
  if(hasR('glass')) m*=3;
  if(hasR('ascetic')&&deckSize()<=12) m*=2;
  const v=G.relics.find(r=>r.key==='vintage'); if(v) m*=1+0.5*v.age;
  return m;
}
function hitBase(S,b){ return b+S.focus+(hasR('lens')?2:0)+(hasR('crescendo')?S.played:0); }
function hit(S,b,dry){
  let d=Math.floor(hitBase(S,b)*hitMult(S));
  if(boss('wraith')&&!S.flags.firstHit){ S.flags.firstHit=true; if(!dry) log('The hit passes through the Wraith.','bad'); return 0; }
  if(boss('mirror')&&d<G.foe.max*0.2){ if(!dry) log(`${fmt(d)} glances off the Mirror Knight.`,'bad'); return 0; }
  S.dealt+=d;
  if(!dry){ G.foe.hp-=d; G.stats.dealt+=d; if(d>G.stats.best) G.stats.best=d; fx('hit',d); }
  return d;
}
function addMana(S,n){ S.mana=Math.min(manaCap(),S.mana+n); }
function gainArc(S,n,dry){ n=(n+(hasR('coin')?1:0))*(hasR('stone')?2:1); S.arc+=n; if(!dry) G.arcana+=n; return n; }

// Choice steps need a player; everything else is applyOp, which is synchronous so look-ahead can run it.
async function choiceOp(o,c){
  const [k,a]=o;
  if(k==='cycle'){
    const ch=await chooseCards(G.hand,{min:0,max:99,why:'cycle',title:cname(c),sub:`Discard any number, then draw that many${a?` plus ${a}`:''}.`});
    ch.forEach(x=>{pull(G.hand,x);G.discard.push(x);}); draw(ch.length+a,true);
  } else if(k==='trash'){
    const ch=await chooseCards(G.hand,{min:0,max:a,why:'trash',title:cname(c),sub:`Banish up to ${a} cards for good.`});
    ch.forEach(x=>{pull(G.hand,x);trashCard(x);}); if(ch.length) log(`Banished: ${ch.map(cname).join(', ')}.`);
  }
}
const CHOICE_OPS=['cycle','trash'];
function applyOp(S,o,c,dry){
  const [k,a,b]=o;
  switch(k){
    case 'arc':  gainArc(S,a,dry); break;
    case 'alch': gainArc(S,a*Math.max(1,S.mana),dry); break;
    case 'grow': if(!dry) c.grow=(c.grow||0)+a; break;
    case 'mana': addMana(S,a+(hasR('staff')?1:0)); break;
    case 'lose': S.mana=Math.max(0,S.mana-a); break;
    case 'double': S.mana=Math.min(manaCap(),S.mana*a); break;
    case 'echo': S.echo+=a; break;
    case 'draw': if(dry) S.drawn+=a; else draw(a,true); break;
    case 'cycle': S.drawn+=a; break;
    case 'trash': break;
    case 'dmg': for(let i=0;i<(b||1);i++) hit(S,a,dry); break;
    case 'chain': if(S.spells) hit(S,a*S.spells,dry); break;
    case 'nova': { hit(S,a*Math.max(1,S.mana),dry); S.mana=Math.min(S.mana,1); } break;
    case 'burn': { const n=Math.floor(a*Math.max(1,S.mana)*S.cardMult*(hasR('ember')?2:1)); S.burn+=n; S.burnAdd+=n;
      if(!dry) log(`Burn +${fmt(n)} (now ${fmt(S.burn)}).`); } break;
    case 'vuln': S.vuln+=a; break;
    case 'empower': S.empower*=a; break;
    case 'focus': S.focus+=a; break;
    case 'manarune': if(!dry) c.manarune=a; S.runeMana=(S.runeMana||0)+a; break;
    case 'exhaust': break;
  }
}
// Resolve a card's steps (times = 1 + echoes). Look-ahead uses resolveDry on a light copy.
function preCard(S,c){
  let times=1+S.echo; S.echo=0;
  if(hasR('twin')&&!S.flags.twin){ S.flags.twin=true; times++; }
  S.cardMult=1;
  if(isSpell(c)){ S.cardMult=S.empower; S.empower=1; if(hasR('familiar')&&!S.flags.owl){ S.flags.owl=true; S.cardMult*=2; } }
  return times;
}
function postCard(S,c){ S.cardMult=1; if(isSpell(c)) S.spells++; S.played++; }
function resolveDry(S,c){
  const ops=opsOf(c), times=preCard(S,c);
  for(let t=0;t<times;t++) for(const o of ops) applyOp(S,o,c,true);
  postCard(S,c);
}
async function resolveCard(c){
  const ops=opsOf(c), times=preCard(G,c);
  for(let t=0;t<times;t++) for(const o of ops){
    if(CHOICE_OPS.includes(o[0])) await choiceOp(o,c); else applyOp(G,o,c,false);
  }
  postCard(G,c);
}

async function playCard(c){
  if(!canPlay(c)||!G.hand.includes(c)) return false;
  busy=true;
  try{
    const cost=playCost();
    pull(G.hand,c); G.inPlay.push(c);
    G.dealt=0; G.arc=0; G.drawn=0; G.burnAdd=0;
    await resolveCard(c);
    G.mana=Math.max(0,G.mana-cost);
    const t=DB[c.key].t, ops=opsOf(c);
    if(t==='rune'){ pull(G.inPlay,c); G.runes.push(c); }
    else if(ops.some(o=>o[0]==='exhaust')){ pull(G.inPlay,c); G.exhausted.push(c); }
    log(`${DB[c.key].art} ${cname(c)}${G.dealt?` hits for ${fmt(G.dealt)}`:''}${G.arc?` · +${fmt(G.arc)} ${ARC}`:''}. ${G.mana} ${MANA} left.`, G.dealt?'dmg':'');
    checkKill();
  } finally { busy=false; }
  render(); saveNow();
  return true;
}
function checkKill(){
  if(!G.won&&G.foe.hp<=0){ G.won=true; G.foe.hp=0; G.stats.kills++;
    log(`${G.foe.n} falls on turn ${G.turn}! Finish your turn, then claim your reward.`,'good'); fx('kill',G.foe); }
}

// What a card would do if played now: {dmg, burn, arc, mana after}. Used by the UI and bots.
function predict(c,S0){
  const S=lightState(S0);
  resolveDry(S,c);
  S.mana=Math.max(0,S.mana-playCost());
  return S;
}
function lightState(S0){
  const s=S0||G;
  return {mana:s.mana,focus:s.focus,vuln:s.vuln,empower:s.empower,echo:s.echo,spells:s.spells,played:s.played,burn:s.burn,
    flags:{...s.flags},cardMult:1,dealt:0,arc:0,drawn:0,burnAdd:0,runeMana:0};
}

/* ==========================================================
   END OF TURN
   ========================================================== */
async function endTurn(){
  if(busy||G.over||G.phase!=='turn') return; busy=true;
  try{
    if(!G.won){
      if(hasR('overflow')&&G.mana>0){ G.dealt=0; const S=G; S.cardMult=1; hit(S,3*G.mana,false); log(`Overflow: ${G.mana} unspent ${MANA} strike for ${fmt(G.dealt)}.`,'dmg'); }
      if(G.burn>0&&G.foe.hp>0){ G.foe.hp-=G.burn; G.stats.dealt+=G.burn; log(`🔥 Burn deals ${fmt(G.burn)}.`,'dmg'); fx('hit',G.burn); }
      checkKill();
      if(!G.won&&boss('dragon')){ const h=Math.round(G.foe.max*0.2); G.foe.hp=Math.min(G.foe.max,G.foe.hp+h); log(`The Dragon heals ${fmt(h)}.`,'bad'); }
    }
    if(hasR('battery')) G.carry=Math.floor(G.mana/2);
    G.discard.push(...G.hand,...G.inPlay); G.hand=[]; G.inPlay=[];
    if(G.won){ busy=false; await winFight(); return; }
    if(G.turn>=turnsMax()){ busy=false; await failFight(); return; }
  } finally { busy=false; }
  await startTurn();
}

async function winFight(){
  G.phase='camp'; render();
  const c=G.foe.circle, left=turnsMax()-G.turn;
  const pay=TUNE.winArcana(c)+left*TUNE.bounty(c)*(hasR('trophy')?2:1);
  G.arcana+=pay;
  log(`Victory! +${pay} ${ARC}${left?` (${plural(left,'turn')} to spare)`:''}.`,'good');
  saveBest(G.fight+1);
  const kind=G.foe.kind;
  if(kind==='boss') G.relics.forEach(r=>r.age++);
  G.camp={step:'card',offers:[marketCard(),marketCard(),marketCard()],relics:kind!=='minion'?rollRelics(kind==='boss'?4:3):null,sanctum:kind==='boss'};
  saveNow();
  await campFlow();
}
async function failFight(){
  G.hearts--; G.stats.fails++;
  log(`${G.foe.n} still stands after ${plural(turnsMax(),'turn')}. You lose a heart (${G.hearts} left).`,'bad');
  fx('fail');
  if(G.hearts<=0){ lose(`${G.foe.n} overwhelms you`,`Fallen in circle ${G.foe.circle}, fight ${G.fight+1}.`); return; }
  G.phase='camp'; G.camp={step:'next'}; saveNow();
  await campFlow();
}
// Between fights: the card reward, a relic after Elites and Bosses, the Sanctum after Bosses.
// Saved before each step, so a reload resumes at the same step with the same offers.
async function campFlow(){
  const C=G.camp;
  if(C.step==='card'){
    const ch=await chooseCards(C.offers,{min:0,max:1,why:'reward',title:'Spoils',sub:'Take one card into your deck, or none.'});
    if(ch[0]){ G.deck.push(ch[0]); log(`${cname(ch[0])} joins your deck.`,'good'); }
    C.step=C.relics?'relic':C.sanctum?'sanctum':'next'; saveNow();
  }
  if(C.step==='relic'){ await relicDraft(C.relics); C.step=C.sanctum?'sanctum':'next'; saveNow(); }
  if(C.step==='sanctum'){ await sanctum(); C.step='next'; saveNow(); }
  G.camp=null;
  if(G.fight+1===TUNE.circles*TUNE.fightsPerCircle&&!G.endless){
    G.endless=true; saveBest(G.fight+1);
    const go=await onVictory(); if(!go){ G.over=true; G.phase='over'; deleteSave(); render(); return; }
  }
  await startFight();
}

function rollRelics(n){
  const cand=Object.keys(RELICS).filter(k=>!hasR(k)), out=[];
  while(out.length<n&&cand.length){ const k=wpick(cand.map(k=>[k,RARITY[RELICS[k].r]])); out.push(k); pull(cand,k); }
  return out;
}
async function relicDraft(offers){
  if(!offers.length) return;
  const full=G.relics.length>=TUNE.relicSlots;
  const k=await chooseRelic(offers,'Choose a relic',full?`Your ${TUNE.relicSlots} relic slots are full: taking one means letting another go.`:`Relics ${G.relics.length}/${TUNE.relicSlots}.`);
  if(!k) return;
  if(full){
    const out=await chooseRelic(G.relics.map(r=>r.key),`Give up a relic for ${RELICS[k].n}?`,'Pick the relic to let go.',{skip:'Keep mine'});
    if(!out) return; G.relics=G.relics.filter(r=>r.key!==out);
  }
  G.relics.push({key:k,age:0}); log(`${RELICS[k].art} ${RELICS[k].n} is yours.`,'good'); render();
}
function deckSummary(){ const a=[...G.deck,...G.discard,...G.hand], by=t=>a.filter(c=>c.t===t).length;
  return `${a.length} cards: ${by('spell')} spells, ${by('mana')} mana, ${by('arcana')} arcana, ${by('rune')} runes, ${by('curse')} curses`; }
async function sanctum(){
  const o=await chooseOption('🕯 The Sanctum',`${deckSummary()}. Choose one rite.`,[
    ['purge','🕳 Purge: banish up to 2 cards'],['temper','✨ Empower: raise a card one tier'],
    ['copy','📜 Transcribe: copy a card'],['heal',`❤ Rest: recover a heart (${G.hearts}/${TUNE.hearts})`],['skip','Move on']]);
  gatherDeck();
  const sorted=()=>G.deck.slice().sort((a,b)=>cname(a).localeCompare(cname(b)));
  if(o==='purge'){ const s=await chooseCards(sorted(),{min:0,max:2,why:'purge',title:'Purge',sub:'Banish up to 2 cards for good.'});
    s.forEach(c=>{pull(G.deck,c);trashCard(c);}); if(s.length) log(`Purged: ${s.map(cname).join(', ')}.`); }
  else if(o==='temper'){ const s=await chooseCards(sorted().filter(c=>!DB[c.key].noLv),{min:0,max:1,why:'temper',title:'Empower',sub:'Raise one card a tier.',badge:c=>DB[c.key].n+plus(c.lv+1)});
    if(s[0]){ const w=cname(s[0]); s[0].lv++; log(`${w} becomes ${cname(s[0])}.`,'good'); } }
  else if(o==='copy'){ const s=await chooseCards(sorted().filter(c=>!DB[c.key].noLv),{min:0,max:1,why:'copy',title:'Transcribe',sub:'Add a copy of one card.'});
    if(s[0]){ G.deck.push(mk(s[0].key,s[0].lv)); log(`You transcribe ${cname(s[0])}.`,'good'); } }
  else if(o==='heal'){ G.hearts=Math.min(TUNE.hearts,G.hearts+1); log(`You rest: ${plural(G.hearts,'heart')}.`,'good'); }
}

function lose(title,text){
  G.over=true; G.phase='over'; deleteSave(); saveBest(G.fight);
  log(`${title}. ${text}`,'bad'); render();
  onRunEnd(title,text);
}
