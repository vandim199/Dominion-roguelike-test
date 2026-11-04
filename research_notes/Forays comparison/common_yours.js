"use strict";
// Measures Forays-yours on the common clock. Its own clock already uses these figures, so only the burst
// definition changes. The patched copy of loop.js lives in memory, so the branch is not touched: it lets
// the naive spender retreat like the careful one, to match how the other take's naive bot behaves.
const fs=require('fs'), Module=require('module'), path=require('path');
const W=process.env.W; // path to a checkout of this take's branch
const {summarise}=require('./common.js');
const file=path.join(W,'sim/loop.js');
function load(patch){ let src=fs.readFileSync(file,'utf8'); if(patch){ const a="kind==='naive'||o.neverRetreat?true:"; if(!src.includes(a)) throw new Error('patch target missing'); src=src.replace(a,'o.neverRetreat?true:'); }
  const m=new Module(file,null); m.filename=file; m.paths=Module._nodeModulePaths(path.dirname(file)); m._compile(src,file); return m.exports; }
const plain=load(false), patched=load(true);
const orig=globalThis.startTrip; let pows=[];
globalThis.startTrip=function(P){ pows.push(estPower(P)); return orig(P); };
const SEEDS=+process.argv[2]||12, CAP=400;
function batch(name,run,kind,o){ const runs=[]; for(let s=1;s<=SEEDS;s++){ pows=[]; const r=run(s*97+3,kind,Object.assign({capMin:CAP,target:1e15,samples:16},o));
    let prev=null; runs.push(r.log.map((l,i)=>{ const pow=pows[i], jump=prev?pow/prev:1; prev=pow; return {sec:(parseFloat(l.min)-r.tripMins[i])*60,pow,jump,turns:l.turns,fights:l.fights,tripSec:r.tripMins[i]*60,how:l.how}; })); }
  return summarise(name,runs); }
batch('yours: think, careful',plain.runGame,'careful',{});
batch('yours: fixed, careful',plain.runGame,'careful',{fightBot:'fixed'});
batch('yours: think, naive, never retreats (as shipped)',plain.runGame,'naive',{});
batch('yours: think, naive, retreats like careful',patched.runGame,'naive',{});
batch('yours: fixed, naive, retreats like careful',patched.runGame,'naive',{fightBot:'fixed'});
