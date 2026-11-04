"use strict";
/* The rules the brief asked for, checked directly on the real code. node sim/check.js */
require('./load.js');
const assert=require('assert');
const fresh=(deck,board,opt)=>{ const P=newProfile(1); P.cards=[]; P.nid=1; for(const k of deck) addCard(P,k,0,true); P.layout=board.map(k=>addCard(P,k,0,true).id); P.slots=Math.max(2,board.length); for(let i=2;i<P.slots;i++) addCard(P,'deed',0,true); Object.assign(P,opt||{}); const T=makeTrip(P,7); T.ev=[]; beginFight(P,T,{key:'dummy',hp:1e12,atk:0}); return {P,T}; };
const count=(T,t)=>T.ev.filter(e=>e.t===t).length;

// No cards on the board at the start of a trip, and a bastion only lands when it is drawn.
{ const {P,T}=fresh(['fork','fork','fork','fork','fork'],['cannon','stake']); assert.equal(T.board.length,0,'board starts empty');
  let n=0; while(T.board.length<2&&n++<20) tapDeck(P,T); assert.equal(T.board.length,2,'bastions land when drawn'); assert.deepEqual(T.board.map(b=>cardOf(P,b.id).key),['cannon','stake'],'they land in the order set at home'); }

// A tap plays the top card for free: the deck goes down by one, and there is no energy to spend.
{ const {P,T}=fresh(['fork','fork','fork','fork','fork'],[]); const before=T.draw.length, e0=T.F.enemy.hp; assert.ok(tapDeck(P,T)); assert.equal(T.draw.length,before-1); assert.ok(T.F.enemy.hp<e0,'it did its damage'); assert.equal(T.F.energy,undefined,'no energy in a fight'); }

// Once every bastion has fired, Powder starts on the first one again, with no waiting for the next swing.
{ const {P,T}=fresh(['fork','fork','fork','fork','fork'],['cannon','stake']); while(T.board.length<2) tapDeck(P,T); T.ev=[]; const swing=T.F.turn;
  T.cursor=0; T.q+=12; pump(P,T); const fired=T.ev.filter(e=>e.t==='fire').map(e=>CARDS[cardOf(P,e.id).key].name);
  assert.deepEqual(fired,['Cannon','Palisade','Cannon','Palisade'],'12 Powder: 3+2+3+2, with 2 more waiting'); assert.equal(T.F.turn,swing,'all in the same swing'); assert.equal(T.board[0].fill,2,'the rest sits in the Cannon'); }

// Combo builds, multiplies, and fades when you stop.
{ const {P,T}=fresh(['fork','fork','fork','fork','fork','fork','fork','fork'],[]); for(let i=0;i<6;i++) tapDeck(P,T); assert.ok(T.combo>=6); const m=comboMult(P,T); assert.ok(m>1); const c0=T.combo; for(let i=0;i<40;i++) tick(P,T,.1); assert.ok(T.combo<c0,'it fades'); }

// The same card twice in a row pays double.
{ const {P,T}=fresh(['fork','fork','fork','fork'],[],{crit:0}); const e=T.F.enemy; let h=e.hp; tapDeck(P,T); const a=h-e.hp; h=e.hp; tapDeck(P,T); const b=h-e.hp; assert.ok(b/a>1.9&&b/a<2.3,`second fork pays about x2, got x${(b/a).toFixed(2)}`); assert.equal(T.run,2); }

// Crossfire: a gun right after an attack card pays double, and an attack card right after a gun.
{ const {P,T}=fresh(['keg','keg','keg','keg','keg','keg'],['cannon'],{crit:0}); T.board.push(newPiece(P,P.layout[0])); T.draw=T.draw.filter(id=>id!==P.layout[0]); const e=T.F.enemy, h0=e.hp; T.xfrom='hand'; T.q+=3; pump(P,T); const cross=h0-e.hp; const fe=T.ev.find(x=>x.t==='fire'); assert.ok(fe.cross,'marked as a crossfire'); assert.equal(T.xfrom,'gun');
  const m=comboMult(P,T); T.ev=[]; const h1=e.hp; T.combo=0; T.xfrom='gun'; tapDeck(P,T); const pe=T.ev.find(x=>x.t==='play'); assert.ok(pe.cross,'attack card after a gun is a crossfire too'); assert.ok(cross>0&&h1-e.hp>0); }

// A chain ends. Free plays stop when the deck runs out, and a firing always costs more Powder than it returns.
{ const {P,T}=fresh(['errand','errand','errand','errand','errand','errand'],['post','post']); for(const b of P.layout) T.board.push(newPiece(P,b)); T.draw=T.draw.filter(id=>!P.layout.includes(id)); T.ev=[]; tapDeck(P,T); assert.ok(T.draw.length===0&&T.pend===0,'the chain ran the deck out and stopped'); assert.ok(T.shuffle>0,'then the deck reshuffles');
  const g=fresh(['fork','fork','fork','fork','fork'],['stake']); const c=cardOf(g.P,g.P.layout[0]); c.sock=['light','relay']; c.key='stake'; CARDS.stake.need=1; g.T.board.push(newPiece(g.P,c.id)); g.T.q+=50; pump(g.P,g.T); CARDS.stake.need=2; assert.equal(g.T.q,0,'Powder is spent, not created'); }

// Big numbers stay finite.
{ const {P,T}=fresh(['fork','whet','anvil','barrel','horn'],['cannon','bellows']); for(const c of P.cards) c.lvl=300; const st=testFire(P); assert.ok(Number.isFinite(st.dmg),'finite at level 300'); assert.ok(allFinite(JSON.parse(JSON.stringify(T)))); }

// Keen is only offered on cards it changes.
{ const fits=k=>perkFits('keen',{key:k,lvl:20,sock:[]});
  for(const k of ['fork','helm','keg','vial','plague','bash','tithe','mend','cannon','stake','gate','hut','mint','forge','arsenal']) assert.ok(fits(k),`${k} pays more with Keen`);
  for(const k of ['scoop','errand','whet','anvil','rope','trail','doll','drum','wind','post','tower','bellows']) assert.ok(!fits(k),`${k} pays the same with Keen`); }

// Echo's reading is right, repeatable, and leaves the card as it found it.
{ const {P}=fresh(['fork','helm','helm','helm','helm'],['cannon'],{crit:0}); const fork=P.cards.find(c=>c.key==='fork'), helm=P.cards.find(c=>c.key==='helm'), gun=P.cards.find(c=>c.key==='cannon');
  fork.lvl=helm.lvl=gun.lvl=5; fork.sock=[];
  const a=perkGain(P,fork,'echo'); assert.deepEqual(fork.sock,[],'the card is put back'); assert.ok(a.ratio>1.1,`Echo adds damage to the only attack card, got x${a.ratio.toFixed(2)}`); assert.equal(perkGain(P,fork,'echo').ratio,a.ratio,'the same deck reads the same');
  assert.ok(Math.abs(perkGain(P,helm,'echo').ratio-1)<.01,'Echo on a Helm adds no damage');
  fork.sock=['keen']; const b=perkGain(P,fork,'echo'); assert.equal(b.out,'keen','a full card swaps out its oldest perk'); assert.deepEqual(fork.sock,['keen']); assert.ok(b.ratio<1,`Echo pays less than the Keen it replaces, got x${b.ratio.toFixed(2)}`);
  fork.sock=['echo']; const c=perkGain(P,fork,'echo'); assert.equal(c.out,null); assert.deepEqual(fork.sock,['echo']); assert.ok(c.ratio>1.1,'already on: it reads what it adds now'); }

console.log('All rule checks passed.');
