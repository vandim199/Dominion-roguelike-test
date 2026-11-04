"use strict";
// Measures Forays-claude on the common clock. Wraps the rules module; changes nothing in the branch.
const W=process.env.W; // path to a checkout of this take's branch
const D=require(W+'/js/data.js'); Object.assign(globalThis,D);
const G=require(W+'/js/game.js');
const {summarise}=require('./common.js');
let cur=null; const orig={start:G.startTrip,end:G.endTrip,cache:G.pickCache};
let trips=[], clock=0, lastPow=null;
G.startTrip=function(P,o){ const pow=o.pw; clock+=25; const jump=lastPow?pow/lastPow:1; lastPow=pow; cur={sec:clock,pow,jump,caches:0}; return orig.start(P,o); };
G.pickCache=function(T,i){ if(cur) cur.caches++; return orig.cache(T,i); };
G.endTrip=function(P,T,how){ const turns=T.st.turns, fights=Math.max(0,T.f-T.startF+1), tripSec=turns*15+fights*3+cur.caches*10;
  clock+=tripSec; Object.assign(cur,{turns,fights,tripSec,how}); trips.push(cur); cur=null; return orig.end(P,T,how); };
const {runOne}=require(W+'/sim/loop.js');
const SEEDS=+process.argv[2]||12;
function batch(name,c){ const runs=[]; for(let s=1;s<=SEEDS;s++){ trips=[]; clock=0; lastPow=null; runOne(s,Object.assign({fight:'thinker',spend:'careful',m:4,to:'1e15',trace:false,retreat:1},c)); runs.push(trips); } return summarise(name,runs); }
batch('claude: think, careful',{});
batch('claude: fixed, careful',{fight:'fixed'});
batch('claude: think, naive',{spend:'naive'});
batch('claude: fixed, naive',{fight:'fixed',spend:'naive'});
