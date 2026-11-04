"use strict";
/* ==========================================================
   Coinkeep: Forays. Every sound is made on the spot, so there are no files to load.
   Tap notes climb a pentatonic scale with your Combo.
   ========================================================== */
const SFX={
  ctx:null, master:null, last:{},
  on:(()=>{ try{ return localStorage.getItem('coinkeep.mute')!=='1'; }catch(e){ return true; } })(),
  unlock(){ if(!this.on) return; try{
      if(!this.ctx){ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; this.ctx=new AC(); this.master=this.ctx.createGain(); this.master.gain.value=.5; const comp=this.ctx.createDynamicsCompressor(); this.master.connect(comp); comp.connect(this.ctx.destination); }
      if(this.ctx.state==='suspended') this.ctx.resume();
    }catch(e){} },
  toggle(){ this.on=!this.on; try{ localStorage.setItem('coinkeep.mute',this.on?'0':'1'); }catch(e){} if(this.on) this.unlock(); return this.on; },
  // At most one of each kind in any gap, so a big chain stays music and not a buzz.
  gate(k,ms){ const n=performance.now(); if(this.last[k]&&n-this.last[k]<ms) return false; this.last[k]=n; return true; },
  ready(){ return this.on&&this.ctx&&this.ctx.state==='running'; },
  tone(f,d,type,v,slide,when){ if(!this.ready()) return; const c=this.ctx, t=c.currentTime+(when||0), o=c.createOscillator(), g=c.createGain();
    o.type=type||'triangle'; o.frequency.setValueAtTime(f,t); if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,f*slide),t+d);
    g.gain.setValueAtTime(v||.2,t); g.gain.exponentialRampToValueAtTime(.001,t+d); o.connect(g); g.connect(this.master); o.start(t); o.stop(t+d+.02); },
  noise(d,v,freq,when){ if(!this.ready()) return; const c=this.ctx, t=c.currentTime+(when||0), n=Math.floor(c.sampleRate*d), buf=c.createBuffer(1,n,c.sampleRate), a=buf.getChannelData(0);
    for(let i=0;i<n;i++) a[i]=(Math.random()*2-1)*(1-i/n); const s=c.createBufferSource(), f=c.createBiquadFilter(), g=c.createGain();
    s.buffer=buf; f.type='lowpass'; f.frequency.value=freq||1200; g.gain.value=v||.2; s.connect(f); f.connect(g); g.connect(this.master); s.start(t); },
  note(step){ const sc=[0,2,4,7,9], o=Math.floor(step/5), n=sc[((step%5)+5)%5]; return 196*Math.pow(2,(Math.min(o,3)*12+n)/12); },
  tap(combo){ if(this.gate('tap',45)) this.tone(this.note(Math.floor(combo/3)),.09,'triangle',.16); },
  dud(){ if(this.gate('dud',60)) this.tone(110,.12,'square',.07,.7); },
  fire(step){ if(this.gate('fire',55)){ this.noise(.12,.3,900); this.tone(150,.14,'sine',.3,.4); this.tone(this.note(step+8),.1,'square',.05); } },
  land(){ if(this.gate('land',70)){ this.tone(90,.16,'sine',.4,.5); this.noise(.07,.2,2400); } },
  crit(){ if(this.gate('crit',90)){ this.tone(1320,.12,'square',.09); this.tone(1980,.2,'triangle',.11,1,.05); } },
  cross(){ if(this.gate('cross',120)){ this.tone(660,.08,'sawtooth',.06); this.tone(990,.11,'sawtooth',.06,1,.05); } },
  run(n){ if(this.gate('run',80)) for(let i=0;i<Math.min(n,4);i++) this.tone(523*Math.pow(1.335,i),.09,'square',.06,1,i*.045); },
  coin(){ if(this.gate('coin',70)){ this.tone(1568,.06,'square',.06); this.tone(2093,.1,'square',.06,1,.05); } },
  kill(){ this.noise(.28,.4,1800); for(let i=0;i<5;i++) this.tone(392*Math.pow(1.26,i),.12,'triangle',.16,1,i*.055); },
  heat(m){ for(let i=0;i<3;i++) this.tone((330+m*2.2)*Math.pow(1.26,i),.22,'sawtooth',.07,1,i*.03); },
  riffle(){ for(let i=0;i<5;i++) this.noise(.03,.1,4000,i*.05); },
  hurt(){ if(this.gate('hurt',120)){ this.tone(120,.22,'sawtooth',.2,.5); this.noise(.1,.25,700); } },
  swing(){ if(this.gate('swing',200)) this.noise(.16,.14,500); },
  buy(){ if(this.gate('buy',40)) this.tone(880,.07,'triangle',.14,1.3); },
  fanfare(){ [523,659,784,1047].forEach((f,i)=>this.tone(f,.26,'triangle',.18,1,i*.09)); },
};
