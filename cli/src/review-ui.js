export const REVIEW_SCRIPT = `
(function() {
  'use strict';
  const cv = window.__claudeVideo;
  if (!cv) return;

  const DURATION = (function() {
    const m = document.querySelector('meta[name="claude-explains:duration"]');
    return m ? parseFloat(m.getAttribute('content')) : 10;
  })();
  const BUILD_ID = (function() {
    const m = document.querySelector('meta[name="claude-explains:review-build"]');
    return m ? m.getAttribute('content') : '0';
  })();
  const STORAGE_KEY = 'cv-review-' + location.pathname + '-' + BUILD_ID;
  const ANN_LEAD = 0.5;
  const ANN_TRAIL = 2;
  const origRAF = cv._origRAF;
  const origCAF = cv._origCAF;
  const origPerfNow = cv._origPerfNow;
  let playing = false, currentTime = 0, speed = 1, annotations = [], drawMode = false;
  let drawStart = null, pendingBox = null, animId = null, lastReal = 0, subsOn = false;
  const _isDark = (function() {
    try { const bg = getComputedStyle(document.body).backgroundColor;
      const m = bg.match(/\\d+/g);
      return m ? (0.299*+m[0]+0.587*+m[1]+0.114*+m[2])/255 < 0.5 : true;
    } catch(e) { return true; }
  })();
  const ANN_DRAW_COLOR = _isDark ? '#ff0' : '#7c3aed';
  const ANN_DRAW_BG = _isDark ? 'rgba(255,255,0,0.08)' : 'rgba(124,58,237,0.08)';

  // Build TTS cue list from the page
  const ttsCues = [];
  document.querySelectorAll('[data-tts]').forEach(el => {
    ttsCues.push({ text: el.getAttribute('data-tts'), start: parseFloat(el.getAttribute('data-tts-start')||'0') });
  });
  ttsCues.sort((a,b) => a.start - b.start);
  for (let i = 0; i < ttsCues.length; i++) {
    ttsCues[i].end = (i + 1 < ttsCues.length) ? ttsCues[i+1].start : DURATION;
  }

  // --- Inject UI ---
  const css = document.createElement('style');
  css.textContent = \`
    :root{--cv-draw:\${ANN_DRAW_COLOR}}
    #cv-review{position:fixed;bottom:0;left:0;right:0;z-index:99999;font-family:system-ui,sans-serif;font-size:13px}
    #cv-controls{background:rgba(10,10,15,0.92);backdrop-filter:blur(8px);border-top:1px solid #333;
      padding:6px 14px;display:flex;align-items:center;gap:10px;color:#ccc}
    #cv-controls button{background:none;border:1px solid #555;color:#ddd;padding:3px 10px;border-radius:4px;
      cursor:pointer;font-size:12px}
    #cv-controls button:hover{background:#333}
    #cv-controls button.on{background:#e94560;border-color:#e94560;color:#fff}
    #cv-tl-wrap{flex:1;height:20px;display:flex;align-items:center;cursor:pointer}
    #cv-tl{width:100%;height:4px;background:#333;border-radius:2px;position:relative}
    #cv-tl-fill{height:100%;background:#e94560;border-radius:2px;width:0%;pointer-events:none}
    #cv-tl-thumb{position:absolute;top:50%;width:12px;height:12px;background:#fff;border-radius:50%;
      transform:translate(-50%,-50%);pointer-events:none;left:0%}
    .cv-marker{position:absolute;top:-3px;width:6px;height:10px;background:var(--cv-draw);border-radius:2px;
      transform:translateX(-50%);cursor:pointer;z-index:2}
    #cv-time{font-variant-numeric:tabular-nums;min-width:90px;text-align:center;color:#888;font-size:12px}
    #cv-speed{background:#1a1a2e;color:#ccc;border:1px solid #555;border-radius:4px;padding:1px 4px;font-size:12px}
    #cv-ann-layer{position:fixed;top:0;left:0;width:100%;height:100%;z-index:99998;pointer-events:none}
    #cv-ann-layer.draw{pointer-events:auto;cursor:crosshair}
    .cv-ann{position:absolute;border:2px solid #e94560;background:rgba(233,69,96,0.12);pointer-events:auto;cursor:pointer}
    .cv-ann:hover{background:rgba(233,69,96,0.25)}
    .cv-ann-num{position:absolute;top:-9px;left:-9px;width:18px;height:18px;border-radius:50%;background:#e94560;
      color:#fff;font-size:10px;display:flex;align-items:center;justify-content:center;font-weight:700}
    .cv-ann-tip{position:absolute;bottom:-20px;left:0;font-size:10px;color:#e94560;white-space:nowrap;
      max-width:180px;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
    #cv-panel{position:fixed;bottom:38px;right:0;width:360px;max-height:260px;overflow-y:auto;
      background:rgba(10,10,15,0.95);border:1px solid #333;border-bottom:none;border-radius:8px 8px 0 0;
      z-index:99999;display:none;font-size:12px;color:#ccc}
    #cv-panel.show{display:block}
    #cv-panel-head{padding:6px 12px;border-bottom:1px solid #222;font-weight:600;display:flex;justify-content:space-between}
    .cv-ann-item{display:flex;gap:6px;padding:5px 12px;border-bottom:1px solid #1a1a2e;cursor:pointer}
    .cv-ann-item:hover{background:#1a1a2e}
    .cv-ann-item .t{color:#e94560;font-weight:600;min-width:42px;font-variant-numeric:tabular-nums}
    .cv-ann-item .r{color:#555;font-size:10px;min-width:90px}
    .cv-ann-item .c{flex:1}
    .cv-ann-item .x{color:#555;cursor:pointer;padding:0 3px}
    .cv-ann-item .x:hover{color:#e94560}
    #cv-comment{position:fixed;z-index:100000;display:none}
    #cv-comment textarea{width:260px;height:52px;background:#1a1a2e;color:#e0e0e0;border:2px solid #e94560;
      border-radius:6px;padding:6px;font-size:12px;font-family:system-ui;resize:none}
    #cv-comment .h{font-size:10px;color:#666;margin-top:1px}
    #cv-toast{position:fixed;bottom:50px;left:50%;transform:translateX(-50%);background:#16c79a;color:#000;
      padding:6px 18px;border-radius:5px;font-size:13px;font-weight:600;display:none;z-index:100001}
    #cv-subs{position:fixed;bottom:44px;left:50%;transform:translateX(-50%);max-width:70%;text-align:center;
      background:rgba(0,0,0,0.75);color:#fff;font-size:18px;line-height:1.4;padding:6px 20px;border-radius:6px;
      z-index:99997;display:none;pointer-events:none}
  \`;
  document.head.appendChild(css);

  const annLayer = document.createElement('div');
  annLayer.id = 'cv-ann-layer';
  document.body.appendChild(annLayer);

  const subsEl = document.createElement('div');
  subsEl.id = 'cv-subs';
  document.body.appendChild(subsEl);

  const commentBox = document.createElement('div');
  commentBox.id = 'cv-comment';
  commentBox.innerHTML = '<textarea placeholder="What\\'s wrong here..."></textarea><div class="h">Enter=save Esc=cancel</div>';
  document.body.appendChild(commentBox);
  const commentTA = commentBox.querySelector('textarea');

  const panelEl = document.createElement('div');
  panelEl.id = 'cv-panel';
  panelEl.innerHTML = '<div id="cv-panel-head"><span>Annotations (<span id="cv-cnt">0</span>)</span></div><div id="cv-list"></div>';
  document.body.appendChild(panelEl);

  const toastEl = document.createElement('div');
  toastEl.id = 'cv-toast';
  document.body.appendChild(toastEl);

  const bar = document.createElement('div');
  bar.id = 'cv-review';
  bar.innerHTML = '<div id="cv-controls">'
    + '<button id="cv-play" title="Space">&#9654;</button>'
    + '<button id="cv-back" title="Left">&#8592;1s</button>'
    + '<button id="cv-fwd" title="Right">1s&#8594;</button>'
    + '<div id="cv-tl-wrap"><div id="cv-tl"><div id="cv-tl-fill"></div><div id="cv-tl-thumb"></div></div></div>'
    + '<span id="cv-time">0.0 / ' + DURATION.toFixed(0) + 's</span>'
    + '<select id="cv-speed"><option value="0.25">0.25x</option><option value="0.5">0.5x</option>'
    + '<option value="1" selected>1x</option><option value="2">2x</option><option value="4">4x</option></select>'
    + '<button id="cv-ann" title="A">Annotate</button>'
    + '<button id="cv-subs-btn" title="S">Subs</button>'
    + '<button id="cv-notes" title="P">Notes</button>'
    + '<button id="cv-copy" title="C">Copy</button>'
    + '</div>';
  document.body.appendChild(bar);

  // add bottom padding so video content isn't hidden behind controls
  document.body.style.paddingBottom = '44px';

  const fill = document.getElementById('cv-tl-fill');
  const thumb = document.getElementById('cv-tl-thumb');
  const timeEl = document.getElementById('cv-time');
  const tlEl = document.getElementById('cv-tl');

  function fmt(s) { const m=Math.floor(s/60),r=(s%60).toFixed(1); return m>0?m+':'+r.padStart(4,'0'):r+'s'; }
  function toast(m) { toastEl.textContent=m; toastEl.style.display='block'; setTimeout(()=>toastEl.style.display='none',2000); }

  function load() { try{annotations=JSON.parse(localStorage.getItem(STORAGE_KEY))||[];}catch{annotations=[];} }
  function save() { localStorage.setItem(STORAGE_KEY,JSON.stringify(annotations)); }

  function updateTL() {
    const p = DURATION>0?(currentTime/DURATION)*100:0;
    fill.style.width=p+'%'; thumb.style.left=p+'%';
    timeEl.textContent=fmt(currentTime)+' / '+fmt(DURATION);
  }

  function rebuildAnnEls() {
    annLayer.querySelectorAll('.cv-ann').forEach(e=>e.remove());
    annotations.forEach((a,i) => {
      const d=document.createElement('div');
      d.className='cv-ann';
      d.style.cssText='left:'+a.x+'px;top:'+a.y+'px;width:'+a.w+'px;height:'+a.h+'px;display:none';
      d.dataset.time=a.time;
      d.innerHTML='<div class="cv-ann-num">'+(i+1)+'</div>'
        +(a.text?'<div class="cv-ann-tip">'+a.text.slice(0,35)+'</div>':'');
      d.onclick=()=>seekTo(a.time);
      annLayer.appendChild(d);
    });
    syncAnnVisibility();
  }

  function syncAnnVisibility() {
    annLayer.querySelectorAll('.cv-ann').forEach(d => {
      const t=parseFloat(d.dataset.time);
      const visible = currentTime >= t - ANN_LEAD && currentTime < t + ANN_TRAIL;
      d.style.display = visible ? 'block' : 'none';
    });
  }

  function syncSubs() {
    if(!subsOn||!ttsCues.length){subsEl.style.display='none';return;}
    const cue=ttsCues.find(c=>currentTime>=c.start&&currentTime<c.end);
    if(cue){subsEl.textContent=cue.text;subsEl.style.display='block';}
    else{subsEl.style.display='none';}
  }

  function renderList() {
    const list=document.getElementById('cv-list');
    document.getElementById('cv-cnt').textContent=annotations.length;
    list.innerHTML='';
    annotations.forEach((a,i) => {
      const d=document.createElement('div');
      d.className='cv-ann-item';
      d.innerHTML='<span class="t">'+fmt(a.time)+'</span><span class="r">['+a.x+','+a.y+' '+a.w+'x'+a.h+']</span>'
        +'<span class="c">'+(a.text||'<em>-</em>')+'</span><span class="x" data-i="'+i+'">&#10005;</span>';
      d.onclick=(e)=>{
        if(e.target.classList.contains('x')){annotations.splice(+e.target.dataset.i,1);save();rebuildAnnEls();renderList();renderMarkers();return;}
        seekTo(a.time);
      };
      list.appendChild(d);
    });
  }

  function renderMarkers() {
    tlEl.querySelectorAll('.cv-marker').forEach(m=>m.remove());
    annotations.forEach((a,i) => {
      const m=document.createElement('div');
      m.className='cv-marker';
      m.style.left=(a.time/DURATION*100)+'%';
      m.title='#'+(i+1)+': '+(a.text||'').slice(0,30);
      m.onclick=(e)=>{e.stopPropagation();seekTo(a.time);};
      tlEl.appendChild(m);
    });
  }

  const PENDING_KEY = STORAGE_KEY + '-pending';

  function savePendingAnnotation() {
    if(!pendingBox || commentBox.style.display!=='block') return;
    const box = pendingBox.getBoundingClientRect();
    localStorage.setItem(PENDING_KEY, JSON.stringify({
      x: Math.round(box.left), y: Math.round(box.top),
      w: Math.round(box.width), h: Math.round(box.height),
      text: commentTA.value, time: Math.round(currentTime*10)/10
    }));
  }

  function restorePendingAnnotation() {
    const raw = localStorage.getItem(PENDING_KEY);
    if(!raw) return;
    localStorage.removeItem(PENDING_KEY);
    try {
      const p = JSON.parse(raw);
      drawMode = true;
      document.getElementById('cv-ann').classList.add('on');
      annLayer.classList.add('draw');
      pendingBox = document.createElement('div');
      pendingBox.style.cssText = 'position:fixed;border:2px dashed '+ANN_DRAW_COLOR+';background:'+ANN_DRAW_BG
        +';z-index:99999;pointer-events:none;left:'+p.x+'px;top:'+p.y+'px;width:'+p.w+'px;height:'+p.h+'px';
      document.body.appendChild(pendingBox);
      const ann = {time:p.time, x:p.x, y:p.y, w:p.w, h:p.h, text:''};
      commentBox.style.display = 'block';
      commentBox.style.left = Math.min(p.x+p.w, window.innerWidth-280)+'px';
      commentBox.style.top = Math.min(p.y+p.h, window.innerHeight-80)+'px';
      commentTA.value = p.text||'';
      commentTA.focus();
      commentTA.onkeydown = (ke)=>{
        if(ke.key==='Enter'&&!ke.shiftKey){ke.preventDefault();ann.text=commentTA.value.trim();annotations.push(ann);save();rebuildAnnEls();renderList();renderMarkers();clearPending();toast('Annotation #'+annotations.length+' saved');}
        else if(ke.key==='Escape'){clearPending();}
      };
    } catch(e) {}
  }

  function seekTo(t) {
    if(playing) togglePlay();
    currentTime=Math.max(0,Math.min(t,DURATION));
    const target = Math.round(currentTime*1000);
    const params = new URLSearchParams(location.search);
    const startFrom = parseInt(params.get('t'))||0;
    if(target < cv.getTime()) {
      savePendingAnnotation();
      params.set('t', target);
      location.search = params.toString();
      return;
    }
    // forward: just tick the gap
    const gap = target - cv.getTime();
    if(gap > 0) {
      const step = 1000/30;
      let remaining = gap;
      while(remaining > 0) { const d=Math.min(step,remaining); cv.tick(d); remaining-=d; }
    }
    updateTL();
    syncAnnVisibility();
    syncSubs();
  }

  function togglePlay() {
    playing=!playing;
    document.getElementById('cv-play').innerHTML=playing?'&#9646;&#9646;':'&#9654;';
    if(playing){lastReal=origPerfNow();playLoop();}
    else if(animId){origCAF(animId);animId=null;}
  }

  function playLoop() {
    if(!playing) return;
    const now=origPerfNow(), delta=(now-lastReal)*speed;
    lastReal=now;
    if(currentTime<DURATION){
      cv.tick(delta);
      currentTime+=delta/1000;
      if(currentTime>=DURATION){currentTime=DURATION;playing=false;document.getElementById('cv-play').innerHTML='&#9654;';}
      updateTL();
      syncAnnVisibility();
      syncSubs();
    }
    if(playing) animId=origRAF(playLoop);
  }

  function copyFeedback() {
    if(!annotations.length){toast('No annotations');return;}
    const sorted=[...annotations].sort((a,b)=>a.time-b.time);
    let txt='## Video Review Feedback\\n\\nSource: '+location.pathname.split('/').pop()
      +'\\nDuration: '+fmt(DURATION)+'\\nAnnotations: '+sorted.length+'\\n\\n';
    sorted.forEach((a,i)=>{
      txt+='### '+(i+1)+'. At '+fmt(a.time)+' (region: x='+a.x+' y='+a.y+' w='+a.w+' h='+a.h+')\\n';
      txt+=(a.text||'No comment')+'\\n\\n';
    });
    txt+='---\\nFix each annotation at the specified timestamp. Region coordinates are in the page\\'s pixel space.\\n';
    navigator.clipboard.writeText(txt).then(()=>toast('Copied!'),()=>toast('Copy failed'));
  }

  // --- Events ---
  document.getElementById('cv-play').onclick=togglePlay;
  document.getElementById('cv-back').onclick=()=>seekTo(currentTime-1);
  document.getElementById('cv-fwd').onclick=()=>seekTo(currentTime+1);
  document.getElementById('cv-ann').onclick=function(){drawMode=!drawMode;this.classList.toggle('on',drawMode);annLayer.classList.toggle('draw',drawMode);if(drawMode&&playing)togglePlay();};
  document.getElementById('cv-subs-btn').onclick=function(){subsOn=!subsOn;this.classList.toggle('on',subsOn);syncSubs();};
  document.getElementById('cv-notes').onclick=()=>panelEl.classList.toggle('show');
  document.getElementById('cv-copy').onclick=copyFeedback;
  document.getElementById('cv-speed').onchange=function(){speed=parseFloat(this.value);};

  document.getElementById('cv-tl-wrap').onclick=(e)=>{
    const r=tlEl.getBoundingClientRect();
    seekTo(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*DURATION);
  };

  function clearPending(){
    if(pendingBox){pendingBox.remove();pendingBox=null;}
    drawStart=null;
    commentBox.style.display='none';
  }

  annLayer.onmousedown=(e)=>{
    if(!drawMode)return;
    if(playing)togglePlay();
    clearPending();
    drawStart={x:e.clientX,y:e.clientY};
    pendingBox=document.createElement('div');
    pendingBox.style.cssText='position:fixed;border:2px dashed '+ANN_DRAW_COLOR+';background:'+ANN_DRAW_BG+';z-index:99999;pointer-events:none';
    document.body.appendChild(pendingBox);
  };
  annLayer.onmousemove=(e)=>{
    if(!drawStart||!pendingBox)return;
    const x=Math.min(drawStart.x,e.clientX),y=Math.min(drawStart.y,e.clientY);
    const w=Math.abs(e.clientX-drawStart.x),h=Math.abs(e.clientY-drawStart.y);
    pendingBox.style.left=x+'px';pendingBox.style.top=y+'px';pendingBox.style.width=w+'px';pendingBox.style.height=h+'px';
  };
  annLayer.onmouseup=(e)=>{
    if(!drawStart)return;
    const x=Math.min(drawStart.x,e.clientX),y=Math.min(drawStart.y,e.clientY);
    const w=Math.abs(e.clientX-drawStart.x),h=Math.abs(e.clientY-drawStart.y);
    drawStart=null;
    if(w<10||h<10){clearPending();return;}
    // keep the yellow box visible while typing
    const ann={time:Math.round(currentTime*10)/10,x:Math.round(x),y:Math.round(y),w:Math.round(w),h:Math.round(h),text:''};
    commentBox.style.display='block';
    commentBox.style.left=Math.min(e.clientX,window.innerWidth-280)+'px';
    commentBox.style.top=Math.min(e.clientY,window.innerHeight-80)+'px';
    commentTA.value='';commentTA.focus();
    commentTA.onkeydown=(ke)=>{
      if(ke.key==='Enter'&&!ke.shiftKey){ke.preventDefault();ann.text=commentTA.value.trim();annotations.push(ann);save();rebuildAnnEls();renderList();renderMarkers();clearPending();toast('Annotation #'+annotations.length+' saved');}
      else if(ke.key==='Escape'){clearPending();}
    };
  };

  document.addEventListener('keydown',(e)=>{
    if(commentBox.style.display==='block')return;
    if(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;
    switch(e.key){
      case ' ':e.preventDefault();togglePlay();break;
      case 'ArrowLeft':e.preventDefault();seekTo(currentTime-(e.shiftKey?5:1));break;
      case 'ArrowRight':e.preventDefault();seekTo(currentTime+(e.shiftKey?5:1));break;
      case 'a':case 'A':document.getElementById('cv-ann').click();break;
      case 's':case 'S':document.getElementById('cv-subs-btn').click();break;
      case 'p':case 'P':document.getElementById('cv-notes').click();break;
      case 'c':case 'C':if(!e.ctrlKey&&!e.metaKey)copyFeedback();break;
    }
  });

  // --- Init ---
  // Handle ?t= param for seek-on-load (backward seek reloads with this)
  const params = new URLSearchParams(location.search);
  const startT = parseInt(params.get('t'))||0;
  if(startT>0){
    const step=1000/30;
    let t=0;
    while(t<startT){const d=Math.min(step,startT-t);cv.tick(d);t+=d;}
    currentTime=startT/1000;
  }
  load();
  updateTL();
  rebuildAnnEls();
  renderList();
  renderMarkers();
  restorePendingAnnotation();
})();
`;
