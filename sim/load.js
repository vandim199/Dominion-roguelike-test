"use strict";
// Load the browser scripts into this Node context, so sims call the game's real rules.
const fs=require('fs'), path=require('path'), vm=require('vm');
for(const f of ['data.js','game.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname,'..','js',f),'utf8'),{filename:f});
if(process.env.TUNEX) Object.assign(TUNE,JSON.parse(process.env.TUNEX));
