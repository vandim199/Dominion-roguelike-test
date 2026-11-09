#!/usr/bin/env node
"use strict";
/* ==========================================================
   Spellbook simulator. Loads js/data.js and js/game.js as they
   are into a sandbox, plays seeded runs with bots (sim/bots.js)
   and prints a balance report.

     node sim/sim.js                       all bots, 100 runs each
     node sim/sim.js --bot mage --runs 500
     node sim/sim.js --endless 1 --fights 40   keep going after the 8th boss
     node sim/sim.js --bot mage --log run.txt  also save run 1's log
     node sim/sim.js --json out.json           every run, raw
     node sim/sim.js --tune '{"growth":1.5}'    override TUNE values

   Bots: mage (balanced engine),
   burner (Burn and big spells), naive (buys like mage, plays
   in random order: the cost of bad sequencing), random.
   ========================================================== */
const fs=require('fs'), path=require('path'), vm=require('vm');
const ROOT=path.join(__dirname,'..');
const SCRIPTS=['js/data.js','js/game.js','sim/bots.js'].map(f=>new vm.Script(fs.readFileSync(path.join(ROOT,f),'utf8'),{filename:f}));
const BOTS=['mage','naive','burner','random'];

function args(){
  const o={bot:'all',runs:100,seed:1,fights:24,endless:0,json:null,log:null,tune:null};
  const a=process.argv.slice(2);
  for(let i=0;i<a.length;i++){
    const k=a[i].replace(/^--/,''), v=a[i+1];
    if(k==='help'||k==='h'){ console.log(fs.readFileSync(__filename,'utf8').split('\n').slice(3,16).join('\n').replace(/^ *\*? ?/gm,'')); process.exit(0); }
    if(!(k in o)){ console.error(`Unknown option --${k}. Try --help.`); process.exit(1); }
    o[k]= typeof o[k]==='number' ? +v : v; i++;
  }
  o.bots = o.bot==='all' ? BOTS : o.bot.split(',');
  if(o.endless&&o.fights===24) o.fights=45;
  return o;
}
function sandbox(){
  const ctx=vm.createContext({console, setTimeout:f=>{ f(); return 0; }, clearTimeout(){}});
  for(const s of SCRIPTS) s.runInContext(ctx);
  if(OPT.tune) vm.runInContext(`Object.assign(TUNE,${OPT.tune})`,ctx);
  return ctx;
}
async function play(o,bot){
  const ctx=sandbox(), runs=[];
  for(let i=0;i<o.runs;i++){
    const opts={bot, seed:o.seed+i, maxFights:o.fights, endless:!!o.endless, keepLog:!!o.log&&i===0};
    runs.push(JSON.parse(JSON.stringify(await vm.runInContext(`simRun(${JSON.stringify(opts)})`,ctx))));
    if(process.stderr.isTTY) process.stderr.write(`\r${bot}: ${i+1}/${o.runs}`);
  }
  if(process.stderr.isTTY) process.stderr.write('\r'+' '.repeat(30)+'\r');
  const names=JSON.parse(JSON.stringify(vm.runInContext(`({cards:Object.fromEntries(Object.entries(DB).map(([k,d])=>[k,d.n])),
    relics:Object.fromEntries(Object.entries(RELICS).map(([k,r])=>[k,r.n])), bosses:Object.fromEntries(Object.entries(BOSSES).map(([k,b])=>[k,b.n]))})`,ctx)));
  return {runs,names};
}

const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const pct=x=>(100*x).toFixed(0).padStart(3)+'%';
const pad=(s,n)=>String(s).padEnd(n);
const fmt=n=>{ n=Math.round(n); if(Math.abs(n)<10000) return String(n); const u=['K','M','B','T']; let i=-1,v=n; while(v>=1000&&i<3){v/=1000;i++;} return v>=1000?n.toExponential(1):(v<100?v.toFixed(1):Math.round(v))+u[i]; };

function report(bot,{runs,names}){
  const out=[];
  const cleared=runs.map(r=>r.fights.filter(f=>f.won).length);
  const reached=runs.map(r=>r.fights.length);
  const wins=runs.filter(r=>r.won).length;
  out.push(`\n=== ${bot} — ${runs.length} runs ===`);
  out.push(`fights won: mean ${mean(cleared).toFixed(1)}, median ${cleared.slice().sort((a,b)=>a-b)[runs.length>>1]}; fights reached mean ${mean(reached).toFixed(1)}; beat circle 8: ${pct(wins/runs.length)}`);
  // per fight
  out.push('fight  kind    hp       reach  win%  turn   deck  dealt/hp');
  const maxF=Math.max(...runs.map(r=>r.fights.length));
  for(let f=0;f<maxF;f++){
    const fs_=runs.map(r=>r.fights[f]).filter(Boolean); if(fs_.length<3) break;
    const w=fs_.filter(x=>x.won);
    out.push(`${pad(f+1,6)} ${pad(fs_[0].kind,7)} ${pad(fmt(fs_[0].hp),8)} ${pad(fs_.length,6)} ${pct(w.length/fs_.length)}  ${mean(w.map(x=>x.turnWon)).toFixed(1).padStart(4)}  ${mean(fs_.map(x=>x.deck)).toFixed(0).padStart(4)}   ${mean(fs_.map(x=>x.dealt/x.hp)).toFixed(2)}`);
  }
  { const all=runs.flatMap(r=>r.fights), n=all.length||1, d={};
    all.forEach(f=>{ const k=f.won?'T'+f.turnWon:'lost'; d[k]=(d[k]||0)+1; });
    out.push('how fights end: '+Object.keys(d).sort().map(k=>`${k} ${pct(d[k]/n)}`).join(', ')); }
  // bosses
  const bs={}; runs.forEach(r=>r.fights.filter(f=>f.boss).forEach(f=>{ (bs[f.boss]=bs[f.boss]||[]).push(f.won); }));
  out.push('bosses: '+Object.entries(bs).sort((a,b)=>mean(a[1])-mean(b[1])).map(([k,v])=>`${names.bosses[k]} ${pct(mean(v.map(Number)))} (${v.length})`).join(', '));
  // relics
  const rl={}; runs.forEach((r,i)=>r.relics.forEach(k=>{ (rl[k]=rl[k]||[]).push(cleared[i]); }));
  out.push('relics (taken, fights won): '+Object.entries(rl).sort((a,b)=>mean(b[1])-mean(a[1])).map(([k,v])=>`${names.relics[k]} ${v.length}/${mean(v).toFixed(1)}`).join(', '));
  // cards
  const cb={}; runs.forEach((r,i)=>Object.entries(r.takes).forEach(([k,n])=>{ (cb[k]=cb[k]||{n:0,runs:[]}); cb[k].n+=n; cb[k].runs.push(cleared[i]); }));
  out.push(`rewards: ${mean(runs.map(r=>Object.values(r.takes).reduce((a,b)=>a+b,0))).toFixed(1)} cards taken, ${mean(runs.map(r=>r.ups)).toFixed(1)} upgrades instead`);
  out.push('taken (copies, runs, fights won): '+Object.entries(cb).sort((a,b)=>b[1].n-a[1].n).map(([k,v])=>`${names.cards[k]} ${v.n}/${v.runs.length}/${mean(v.runs).toFixed(1)}`).join(', '));
  const pl={}; runs.forEach(r=>Object.entries(r.plays).forEach(([k,n])=>pl[k]=(pl[k]||0)+n));
  out.push('plays per run: '+Object.entries(pl).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${names.cards[k]} ${(n/runs.length).toFixed(0)}`).join(', '));
  out.push(`biggest hit: median ${fmt(runs.map(r=>r.end.best).sort((a,b)=>a-b)[runs.length>>1])}; end deck ${mean(runs.map(r=>r.end.deck)).toFixed(0)} cards`);
  return out.join('\n');
}

let OPT={};
(async()=>{
  const o=OPT=args(), all={};
  for(const b of o.bots){ all[b]=await play(o,b); console.log(report(b,all[b])); }
  if(o.log){ const r=all[o.bots[0]].runs[0]; fs.writeFileSync(o.log,(r.log||[]).join('\n')); }
  if(o.json) fs.writeFileSync(o.json,JSON.stringify(Object.fromEntries(Object.entries(all).map(([k,v])=>[k,v.runs]))));
})();
