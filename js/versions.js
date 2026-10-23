"use strict";
/* ==========================================================
   Coinkeep — the version switcher on the title screen.
   The published site holds main at its root and every wild/*
   branch under v/<branch>/, listed in versions.json (built by
   .github/workflows/pages.yml). Opened as a local file, or
   with only one version, it shows nothing.
   ========================================================== */
(()=>{
  const p=location.pathname, i=p.indexOf('/v/'), root=i>=0?p.slice(0,i+1):p.replace(/[^/]*$/,'');
  const here=i>=0?p.slice(i+1).replace(/[^/]*$/,''):'';
  fetch(root+'versions.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(vs=>{
    const box=document.getElementById('tVersions');
    if(!box||!Array.isArray(vs)||vs.length<2) return;
    box.innerHTML='<span class="vlbl">Versions</span>';
    for(const v of vs){
      const b=document.createElement('button');
      b.className='tbtn'+(v.path===here?' on':''); b.textContent=v.label;
      if(v.updated) b.title=`Updated ${v.updated}`;
      b.onclick=()=>{ if(v.path!==here) location.href=root+v.path+'index.html'; };
      box.appendChild(b);
    }
    box.hidden=false;
  }).catch(()=>{});
})();
