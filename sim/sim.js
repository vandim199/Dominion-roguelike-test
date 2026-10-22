#!/usr/bin/env node
"use strict";
/* ==========================================================
   Coinkeep simulator. Loads js/data.js and js/game.js as they
   are into a sandbox, plays seeded runs with bots (sim/bots.js)
   and prints a balance report.

     node sim/sim.js                       all bots, 100 runs each (~45s)
     node sim/sim.js --bot engine --runs 1000
     node sim/sim.js --mode classic --waves 20
     node sim/sim.js --bot money --log run.txt     also save run 1's log
     node sim/sim.js --json out.json               every run, raw
     --waves 30 --turns 2000 --deckcap 400         when a run stops early

   Bots: engine (Actions & draw), money (Big Money), random.
   ========================================================== */
const fs=require('fs'), path=require('path'), vm=require('vm');

const ROOT=path.join(__dirname,'..');
const SCRIPTS=['js/data.js','js/game.js','sim/bots.js'].map(f=>new vm.Script(fs.readFileSync(path.join(ROOT,f),'utf8'),{filename:f}));
const BOTS=['engine','money','random'];

function args(){
  const o={bot:'all',runs:100,mode:'splice',seed:1,waves:30,turns:2000,deckcap:400,json:null,log:null};
  const a=process.argv.slice(2);
  for(let i=0;i<a.length;i++){
    const k=a[i].replace(/^--/,''), v=a[i+1];
    if(k==='help'||k==='h'){ console.log(fs.readFileSync(__filename,'utf8').split('\n').slice(3,15).join('\n').replace(/^ *\*? ?/gm,'')); process.exit(0); }
    if(!(k in o)){ console.error(`Unknown option --${k}. Try --help.`); process.exit(1); }
    o[k]= typeof o[k]==='number' ? +v : v; i++;
  }
  o.bots = o.bot==='all' ? BOTS : o.bot.split(',');
  for(const b of o.bots) if(!BOTS.includes(b)){ console.error(`Unknown bot "${b}". Bots: ${BOTS.join(', ')}.`); process.exit(1); }
  if(!['splice','classic'].includes(o.mode)){ console.error('--mode is splice or classic.'); process.exit(1); }
  return o;
}

function sandbox(){
  const ctx=vm.createContext({console, setTimeout:f=>{ f(); return 0; }, clearTimeout(){}});
  for(const s of SCRIPTS) s.runInContext(ctx);
  return ctx;
}

async function play(o,bot){
  const ctx=sandbox(), runs=[];
  for(let i=0;i<o.runs;i++){
    const opts={bot, mode:o.mode, seed:o.seed+i, waves:o.waves, maxTurns:o.turns, deckCap:o.deckcap, keepLog:!!o.log&&i===0};
    runs.push(JSON.parse(JSON.stringify(await vm.runInContext(`simRun(${JSON.stringify(opts)})`,ctx))));
    if(process.stderr.isTTY) process.stderr.write(`\r${bot}: ${i+1}/${o.runs}`);
  }
  if(process.stderr.isTTY) process.stderr.write('\r'+' '.repeat(40)+'\r');
  const names=vm.runInContext(`({cards:Object.fromEntries(Object.entries(DB).map(([k,d])=>[k,d.n])),
    charms:Object.fromEntries(Object.entries(JOKERS).map(([k,j])=>[k,j.n])),
    threats:Object.fromEntries(Object.entries(THREATS).map(([k,t])=>[k,t.n])),
    splices:Object.fromEntries(Object.entries(SPLICES).map(([k,s])=>[k,s.n]))})`,ctx);
  return {runs,names:JSON.parse(JSON.stringify(names))};
}

/* ---------- report ---------- */
const mean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : 0;
const quant = (a,q) => { if(!a.length) return 0; const s=a.slice().sort((x,y)=>x-y); return s[Math.min(s.length-1,Math.floor(q*s.length))]; };
const pct = (n,d) => d ? Math.round(100*n/d)+'%' : '—';
const f1 = x => (Math.round(x*10)/10).toFixed(1);
function table(head,rows){
  const all=[head,...rows].map(r=>r.map(String)), w=head.map((_,i)=>Math.max(...all.map(r=>r[i].length)));
  return all.map((r,j)=>r.map((c,i)=>i===0?c.padEnd(w[i]):c.padStart(w[i])).join('  ')+(j===0?'\n'+w.map(n=>'─'.repeat(n)).join('  '):'')).join('\n');
}

function report(bot,{runs,names},o){
  const out=[], N=runs.length, cl=runs.map(r=>r.cleared);
  out.push(`\n████ ${bot.toUpperCase()} — ${N} runs, ${o.mode} mode, seeds ${o.seed}–${o.seed+N-1}, cap ${o.waves} waves`);
  out.push(`Waves cleared: mean ${f1(mean(cl))} · median ${quant(cl,.5)} · p10 ${quant(cl,.1)} · p90 ${quant(cl,.9)} · best ${Math.max(...cl)}`);
  const ends={}; runs.forEach(r=>ends[r.result]=(ends[r.result]||0)+1);
  out.push('Ends: '+Object.entries(ends).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${k} ${pct(n,N)}`).join(' · '));
  const kill={}; runs.forEach(r=>{ if(r.killer) kill[r.killer]=(kill[r.killer]||0)+1; });
  out.push('Last straw: '+(Object.entries(kill).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,n])=>`${k} ${pct(n,N)}`).join(' · ')||'—'));

  // Per wave: what a turn looks like, and what the wave asks of it.
  const W={};
  for(const r of runs) for(const w of r.waves){
    const a=W[w.wave] ||= {runs:0,lost:0,turns:0,coin:0,actsLeft:0,played:0,seen:0,deck:0,drewAll:0,stuck:0,tc:[],price:[],tier:w.maxTier};
    a.runs++; a.turns+=w.turns; a.coin+=w.coin; a.actsLeft+=w.actsLeft; a.played+=w.played; a.seen+=w.seen; a.deck+=w.deck;
    a.drewAll+=w.drewAll; a.stuck+=w.stuck;
    a.tc.push(...w.threats.filter(t=>t.coin).map(t=>t.coin)); a.price.push(...w.market.map(m=>m.cost));
    if(r.cleared===w.wave-1&&(r.result==='hearts'||r.result==='board full')) a.lost++;
  }
  out.push('\nPer wave (averages per turn). seen = cards in hand+play ÷ deck size. drew all = turns that drew the whole deck.');
  out.push('stuck = turns ending with an Action in hand and no Actions left. threat ÷ income = turns of income a coin threat asks for.');
  out.push(table(['wave','runs','lost','tier','turns','coin','⚡ spare','played','seen','deck','drew all','stuck','coin threat','÷ income','market med','÷ income'],
    Object.entries(W).map(([wave,a])=>{ const T=a.turns||1, inc=a.coin/T, tc=mean(a.tc), mp=quant(a.price,.5);
      return [wave,a.runs,pct(a.lost,a.runs),a.tier,f1(a.turns/a.runs),f1(inc),f1(a.actsLeft/T),f1(a.played/T),
        pct(a.seen,a.deck),f1(a.deck/T),pct(a.drewAll,T),pct(a.stuck,T),Math.round(tc),inc?f1(tc/inc):'—',mp,inc?f1(mp/inc):'—']; })));

  // Threats: which ones get cleared, which ones get through.
  const TH={};
  for(const r of runs) for(const [k,t] of Object.entries(r.threats)){
    const a=TH[k] ||= {spawned:0,cleared:0,detonated:0,hits:0,clearAge:0};
    for(const f in a) a[f]+=t[f];
  }
  const classic=o.mode==='classic';
  out.push('\nThreats. turns = average turns on the board before being cleared.'+(classic?' hits = attacks that landed (not blocked).':''));
  out.push(table(['threat','seen','cleared',classic?'hits':'detonated','turns'],
    Object.entries(TH).sort((a,b)=>(a[1].cleared/a[1].spawned)-(b[1].cleared/b[1].spawned))
      .map(([k,a])=>[names.threats[k],a.spawned,pct(a.cleared,a.spawned),classic?a.hits:pct(a.detonated,a.spawned),a.cleared?f1(a.clearAge/a.cleared):'—'])));

  // Cards, charms, splices: how often taken, and how runs that took them did.
  const lift=(label,key,get)=>{
    const has={}; runs.forEach(r=>new Set(get(r)).forEach(k=>(has[k] ||= []).push(r.cleared)));
    const rows=Object.entries(has).map(([k,c])=>{ const other=runs.filter(r=>!get(r).includes(k)).map(r=>r.cleared);
      return [names[key][k]||k,pct(c.length,N),f1(mean(c)),other.length?f1(mean(c)-mean(other)):'—']; })
      .sort((a,b)=>parseFloat(b[1])-parseFloat(a[1]));
    if(rows.length){ out.push(''); out.push(table([label,'runs','waves','vs without'],rows)); }
  };
  out.push('\nTaken in what share of runs, average waves cleared in those runs, and the difference from runs without it.');
  lift('card bought','cards',r=>Object.keys(r.bought));
  lift('charm','charms',r=>r.charms);
  lift('splice','splices',r=>r.splices);
  return out.join('\n');
}

(async()=>{
  const o=args(), all={};
  const t0=Date.now();
  for(const bot of o.bots){
    const res=await play(o,bot); all[bot]=res.runs;
    console.log(report(bot,res,o));
    if(o.log){
      const file=o.bots.length>1?o.log.replace(/(\.\w+)?$/,`-${bot}$1`):o.log;
      fs.writeFileSync(file,res.runs[0].log); console.log(`\nRun 1's log saved to ${file}`);
    }
  }
  if(o.bots.length>1){
    console.log('\n████ SUMMARY');
    console.log(table(['bot','runs','mean waves','median','p90'],o.bots.map(b=>{ const c=all[b].map(r=>r.cleared); return [b,c.length,f1(mean(c)),quant(c,.5),quant(c,.9)]; })));
  }
  if(o.json){ for(const b in all) all[b].forEach(r=>{ delete r.log; }); fs.writeFileSync(o.json,JSON.stringify({options:o,runs:all},null,1)); console.log(`\nRaw runs saved to ${o.json}`); }
  console.log(`\n${o.bots.length*o.runs} runs in ${((Date.now()-t0)/1000).toFixed(1)}s`);
})().catch(e=>{ console.error(e); process.exit(1); });
