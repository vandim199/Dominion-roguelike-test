#!/usr/bin/env node
"use strict";
/* Prints the whole-loop tables in docs/RESULTS.md as markdown.
   node sim/results.js [--seeds 10]
   The fight tables come from: node sim/decision.js */
const {report}=require('./loop.js');
const A=process.argv.slice(2); const i=A.indexOf('--seeds'); const SEEDS=i>=0?+A[i+1]:10;
const base={fight:'thinker',spend:'careful',m:4,to:'1e15',trace:false,retreat:.55};
const f=x=>x==null||isNaN(x)?'not reached':(+x).toFixed(1);
function row(name,c){ const r=report(Object.assign({},base,c),c.seeds||SEEDS);
  return {name,r,line:`| ${name} | ${f(r.minTo['1e6'])} | ${f(r.minTo['1e9'])} | ${f(r.minTo['1e12'])} | ${f(r.minTo['1e15'])} | ${r.burstMin.median} / ${r.burstMin.p10} / ${r.burstMin.p90} | ${r.share['R>=2']} / ${r.share['R1-2']} / ${r.share['R<1']} | ${r.trips} | ${r.defeats} | ${r.nonFinite} |`}; }
const head='| Run | Min to 1e6 | 1e9 | 1e12 | 1e15 | Burst gap min: median / p10 / p90 | % turns at R>=2 / 1-2 / <1 | Trips | Defeats | Non-finite |\n|---|---|---|---|---|---|---|---|---|---|';
const rows=[
  row('Thinking fights, careful spending',{}),
  row('Fixed fights, careful spending',{fight:'fixed'}),
  row('Thinking fights, naive spending',{spend:'naive'}),
  row('Fixed fights, naive spending',{fight:'fixed',spend:'naive'}),
];
console.log(`### Whole loop, ${SEEDS} seeds each, medians, 15 seconds per played turn, Keep time not counted\n\n${head}`);
for(const x of rows) console.log(x.line);
const m=rows[0].r;
console.log(`\nMain run detail: deepest fight ${m.deepest}, ${m.turns} turns, ${m.reached1e15}/${SEEDS} reached 1e15, ${m.won}/${SEEDS} beat the final boss, ${m.firesPerTurn} Bastion firings per turn, ${m.wastedPerTurn} Powder wasted per turn, board share of direct damage in the last trip ${m.boardShareLastTrip}, final board of seed 1: ${m.finalBoard}. Final deck of seed 1: ${m.lastDeck}.`);
console.log(`\n### Retreat policy (leave when the next fight's R falls below this), to 1e12\n\n${head}`);
for(const r of [.3,.55,.8,1.2,1.8]) console.log(row('Leave below R '+r,{retreat:r,to:'1e12'}).line);
console.log(`\n### Other spending rules, to 1e12\n\n${head}`);
console.log(row('Careful, Bastion offers first',{spend:'board',to:'1e12'}).line);
console.log(row('Careful, never buys a Deed',{nodeed:true,to:'1e12'}).line);
