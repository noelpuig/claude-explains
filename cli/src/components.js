export const COMPONENTS_SCRIPT = `
(function() {
  'use strict';

  let _cssInjected = false;
  let _theme = 'dark';

  function detectTheme() {
    try {
      const bg = getComputedStyle(document.body).backgroundColor;
      const m = bg.match(/\\d+/g);
      if (m) {
        const lum = (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) / 255;
        _theme = lum > 0.5 ? 'light' : 'dark';
      }
    } catch(e) {}
    document.documentElement.setAttribute('data-h2v-theme', _theme);
  }

  function getAccentColor() {
    const el = document.querySelector('.accent,[class*="accent"]');
    if (el) {
      const c = getComputedStyle(el).color;
      const m = c.match(/\\d+/g);
      if (m) return 'rgb('+m[0]+','+m[1]+','+m[2]+')';
    }
    const css = document.querySelector('style');
    if (css) {
      const match = css.textContent.match(/\\.accent\\s*\\{[^}]*color:\\s*([^;\\}]+)/);
      if (match) return match[1].trim();
    }
    return _theme === 'dark' ? '#e94560' : '#2563eb';
  }

  function injectCSS() {
    if (_cssInjected) return;
    _cssInjected = true;
    detectTheme();
    const accent = getAccentColor();
    const s = document.createElement('style');
    s.id = 'h2v-components';
    s.textContent = COMPONENT_CSS.replace(/__ACCENT__/g, accent);
    (document.head || document.documentElement).appendChild(s);
  }

  function observeScene(el, renderFn) {
    const scene = el.closest('.scene');
    if (!scene || scene.classList.contains('active')) return;
    const obs = new MutationObserver(() => {
      if (scene.classList.contains('active')) {
        obs.disconnect();
        renderFn();
      }
    });
    obs.observe(scene, { attributes: true, attributeFilter: ['class'] });
  }

  const COMPONENT_CSS = \`
    /* ===== Narrator Sync Classes ===== */
    .h2v-highlighted { color:__ACCENT__ !important; text-shadow:0 0 20px color-mix(in srgb, __ACCENT__ 30%, transparent) }
    [data-appear] { opacity:0 }
    .h2v-visible { opacity:1 !important }
    .h2v-faded { opacity:0 !important }

    /* ===== Animation Keyframes ===== */
    @keyframes h2v-fadeUp    { from { opacity:0; transform:translateY(30px) } to { opacity:1; transform:translateY(0) } }
    @keyframes h2v-fadeDown  { from { opacity:0; transform:translateY(-30px) } to { opacity:1; transform:translateY(0) } }
    @keyframes h2v-fadeLeft  { from { opacity:0; transform:translateX(-40px) } to { opacity:1; transform:translateX(0) } }
    @keyframes h2v-fadeRight { from { opacity:0; transform:translateX(40px) } to { opacity:1; transform:translateX(0) } }
    @keyframes h2v-scaleIn   { from { opacity:0; transform:scale(0.8) } to { opacity:1; transform:scale(1) } }
    @keyframes h2v-popIn     { 0% { opacity:0; transform:scale(0.5) } 70% { transform:scale(1.05) } 100% { opacity:1; transform:scale(1) } }
    @keyframes h2v-flipIn    { from { opacity:0; transform:perspective(400px) rotateY(-90deg) } to { opacity:1; transform:perspective(400px) rotateY(0) } }
    @keyframes h2v-growUp    { from { opacity:1; transform:scaleY(0) } to { opacity:1; transform:scaleY(1) } }
    @keyframes h2v-revealDown { from { clip-path:inset(0 0 100% 0); opacity:0 } to { clip-path:inset(0); opacity:1 } }
    @keyframes h2v-drawLine  { to { stroke-dashoffset: 0 } }
    @keyframes h2v-fadeInPt  { from { opacity:0 } to { opacity:1 } }
    @keyframes h2v-scaleUpCol { from { transform:scaleY(0); opacity:0 } to { transform:scaleY(1); opacity:1 } }

    /* ===== Highlight Effect Keyframes ===== */
    @keyframes h2v-hlColor { from { color:inherit; text-shadow:none } to { color:__ACCENT__; text-shadow:0 0 20px color-mix(in srgb, __ACCENT__ 30%, transparent) } }
    @keyframes h2v-hlUnderline { from { transform:scaleX(0) } to { transform:scaleX(1) } }
    @keyframes h2v-hlMarker { from { background-size:0% 100% } to { background-size:100% 100% } }
    @keyframes h2v-hlGlow { 0% { color:inherit; text-shadow:0 0 0 transparent } 40% { color:__ACCENT__; text-shadow:0 0 35px __ACCENT__, 0 0 60px color-mix(in srgb, __ACCENT__ 40%, transparent) } 100% { color:__ACCENT__; text-shadow:0 0 15px color-mix(in srgb, __ACCENT__ 35%, transparent) } }
    @keyframes h2v-hlBox { from { background-color:transparent } to { background-color:color-mix(in srgb, __ACCENT__ 18%, transparent) } }

    /* ===== Highlight Effect Classes ===== */
    .h2v-hl-color { animation:h2v-hlColor 0.35s ease-out forwards }
    .h2v-hl-underline { position:relative; display:inline-block; color:__ACCENT__ !important }
    .h2v-hl-underline::after { content:''; position:absolute; left:0; bottom:-3px; width:100%; height:3px; background:__ACCENT__; transform-origin:left center; animation:h2v-hlUnderline 0.45s cubic-bezier(0.22,1,0.36,1) forwards }
    .h2v-hl-marker { display:inline; background-image:linear-gradient(color-mix(in srgb, __ACCENT__ 25%, transparent), color-mix(in srgb, __ACCENT__ 25%, transparent)); background-repeat:no-repeat; background-position:left center; background-size:0% 100%; animation:h2v-hlMarker 0.5s cubic-bezier(0.22,1,0.36,1) forwards; border-radius:3px; padding:2px 4px; margin:-2px -4px }
    .h2v-hl-glow { animation:h2v-hlGlow 0.7s ease-out forwards }
    .h2v-hl-box { display:inline-block; border-radius:6px; padding:4px 12px; margin:-4px -4px; color:__ACCENT__ !important; animation:h2v-hlBox 0.4s cubic-bezier(0.22,1,0.36,1) forwards }

    /* ===== Appear Effect Classes ===== */
    .h2v-appear-fadeUp { animation:h2v-fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) forwards !important }
    .h2v-appear-fadeDown { animation:h2v-fadeDown 0.5s cubic-bezier(0.22,1,0.36,1) forwards !important }
    .h2v-appear-fadeLeft { animation:h2v-fadeLeft 0.5s cubic-bezier(0.22,1,0.36,1) forwards !important }
    .h2v-appear-fadeRight { animation:h2v-fadeRight 0.5s cubic-bezier(0.22,1,0.36,1) forwards !important }
    .h2v-appear-scaleIn { animation:h2v-scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards !important }
    .h2v-appear-popIn { animation:h2v-popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards !important }
    .h2v-appear-flipIn { animation:h2v-flipIn 0.5s ease-out forwards !important }
    .h2v-appear-revealDown { animation:h2v-revealDown 0.5s ease-out forwards !important }

    /* ===== Component Base Styles ===== */
    bar-chart, combo-chart, scatter-chart { display:block; width:100%; overflow:visible }
    bar-chart svg, combo-chart svg, scatter-chart svg { width:100%; height:auto; overflow:visible }

    /* --- DARK THEME DEFAULTS --- */
    stat-grid { display:grid; gap:1.5em }
    stat-box { display:block; border-radius:8px; padding:1.5em; text-align:center;
               background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1) }
    stat-box .h2v-val { font-size:clamp(2.5rem,5vw,4rem); font-weight:700; color:inherit }
    stat-box .h2v-lbl { font-size:clamp(1.1rem,1.8vw,1.4rem); margin-top:0.3em; color:rgba(255,255,255,0.7) }

    time-line { display:flex; flex-direction:column; gap:1.5em; padding-left:35px; margin-left:10px; position:relative }
    time-line::before { content:''; position:absolute; left:12px; top:0; bottom:0; width:4px; border-radius:2px }
    time-item { display:block; position:relative }
    time-item::before { content:''; position:absolute; left:-28px; top:0.15em; width:14px; height:14px; border-radius:50% }
    time-item .h2v-yr { font-size:clamp(1.2rem,1.8vw,1.5rem); font-weight:700 }
    time-item .h2v-ti { font-size:clamp(1.3rem,2vw,1.7rem); font-weight:600; color:inherit }
    time-item .h2v-tx { font-size:clamp(1.1rem,1.6vw,1.4rem); margin-top:0.2em; color:rgba(255,255,255,0.65) }

    compare-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:1.5em }
    compare-box { display:block; padding:1.5em; border-radius:8px; text-align:center }
    compare-box[type="bad"]  { background:rgba(233,69,96,0.1); border:2px solid rgba(233,69,96,0.3) }
    compare-box[type="good"] { background:rgba(22,199,154,0.1); border:2px solid rgba(22,199,154,0.3) }
    compare-box .h2v-lbl { font-size:clamp(1.1rem,1.6vw,1.3rem); font-weight:600; margin-bottom:0.3em }
    compare-box .h2v-val { font-size:clamp(2.5rem,5vw,4rem); font-weight:700 }
    compare-box .h2v-desc { font-size:clamp(1.1rem,1.6vw,1.3rem); margin-top:0.3em; color:rgba(255,255,255,0.7) }
    compare-box[type="bad"] .h2v-lbl, compare-box[type="bad"] .h2v-val { color:#ff6b6b }
    compare-box[type="good"] .h2v-lbl, compare-box[type="good"] .h2v-val { color:#4ecdc4 }

    quote-block { display:block; font-style:italic; padding:1.2em 1.8em; border-left:4px solid; background:rgba(255,255,255,0.05); border-radius:0 8px 8px 0; margin:1em 0; font-size:clamp(1.4rem,2.2vw,1.8rem); line-height:1.5; color:rgba(255,255,255,0.85) }
    quote-block .h2v-cite { font-size:0.75em; margin-top:0.5em; font-style:normal; display:block; color:rgba(255,255,255,0.65) }

    anim-text { display:block; opacity:0 }

    /* --- LIGHT THEME OVERRIDES --- */
    [data-h2v-theme="light"] stat-box { background:rgba(0,0,0,0.04); border-color:rgba(0,0,0,0.08) }
    [data-h2v-theme="light"] stat-box .h2v-lbl { color:rgba(0,0,0,0.5) }
    [data-h2v-theme="light"] time-item .h2v-tx { color:rgba(0,0,0,0.55) }
    [data-h2v-theme="light"] compare-box .h2v-desc { color:rgba(0,0,0,0.55) }
    [data-h2v-theme="light"] compare-box[type="bad"] .h2v-lbl,
    [data-h2v-theme="light"] compare-box[type="bad"] .h2v-val { color:#c62828 }
    [data-h2v-theme="light"] compare-box[type="good"] .h2v-lbl,
    [data-h2v-theme="light"] compare-box[type="good"] .h2v-val { color:#2e7d32 }
    [data-h2v-theme="light"] quote-block { background:rgba(0,0,0,0.03); color:rgba(0,0,0,0.8) }
    [data-h2v-theme="light"] quote-block .h2v-cite { color:rgba(0,0,0,0.5) }

    /* Chart common */
    .h2v-chart-label { fill:#64748b; font-size:13px; font-weight:500 }
    .h2v-grid-line { stroke:#e9ecef; stroke-width:1 }
    .h2v-bar { rx:4; transform-box:fill-box; transform-origin:center bottom; opacity:0 }
    .h2v-combo-line { fill:none; stroke-width:3.5; stroke-linecap:round; stroke-linejoin:round }
    .h2v-combo-pt { stroke-width:3; opacity:0 }
    .h2v-scatter-pt { stroke-width:2; opacity:0; cursor:pointer }
    .h2v-reg-line { fill:none; stroke:#0f3460; stroke-width:3; stroke-linecap:round }
  \`;

  // ===== BAR CHART =====
  class H2VBarChart extends HTMLElement {
    connectedCallback() { injectCSS(); this._render(); observeScene(this, () => this._render()); }
    _render() {
      const data = JSON.parse(this.getAttribute('data') || '[]');
      if (!data.length) return;
      const colors = (this.getAttribute('colors') || getAccentColor()+',#0f3460,#16c79a,#f5a623,#6c5ce7').split(',');
      const W = 700, H = 340, P = { t:25, r:20, b:45, l:50 };
      const cW = W-P.l-P.r, cH = H-P.t-P.b;
      const maxV = Math.max(...data.map(d=>d.value)) * 1.1;
      const bW = Math.min(50, cW/data.length*0.6);
      const gap = cW/data.length;
      let svg = '<svg viewBox="0 0 '+W+' '+H+'">';
      for (let i=0;i<=4;i++) {
        const y=P.t+(cH/4)*i, v=Math.round(maxV-(maxV/4)*i);
        svg+='<line x1="'+P.l+'" y1="'+y+'" x2="'+(W-P.r)+'" y2="'+y+'" class="h2v-grid-line" '+(i?'stroke-dasharray="4"':'')+'/>';
        svg+='<text x="'+(P.l-8)+'" y="'+(y+4)+'" class="h2v-chart-label" text-anchor="end">'+v+'</text>';
      }
      data.forEach((d,i) => {
        const x=P.l+gap*i+gap/2, h=d.value/maxV*cH, y=H-P.b-h;
        const c=colors[i%colors.length].trim(), del=i*0.15;
        svg+='<rect x="'+(x-bW/2)+'" y="'+y+'" width="'+bW+'" height="'+h+'" fill="'+c+'" class="h2v-bar" style="animation:h2v-scaleUpCol 0.6s cubic-bezier(0.34,1.56,0.64,1) '+del+'s forwards"/>';
        svg+='<text x="'+x+'" y="'+(H-12)+'" class="h2v-chart-label" text-anchor="middle">'+d.label+'</text>';
        svg+='<text x="'+x+'" y="'+(y-8)+'" class="h2v-chart-label" text-anchor="middle" opacity="0" style="animation:h2v-fadeInPt 0.3s ease '+(del+0.4)+'s forwards">'+(d.display||d.value)+'</text>';
      });
      svg+='</svg>';
      this.innerHTML = svg;
    }
  }
  customElements.define('bar-chart', H2VBarChart);

  // ===== COMBO CHART =====
  class H2VComboChart extends HTMLElement {
    connectedCallback() { injectCSS(); this._render(); observeScene(this, () => this._render()); }
    _render() {
      const data = JSON.parse(this.getAttribute('data') || '[]');
      if (!data.length) return;
      const barC = this.getAttribute('bar-color') || getAccentColor();
      const lineC = this.getAttribute('line-color') || '#0f3460';
      const W=700,H=350,P={t:30,r:30,b:50,l:50};
      const cW=W-P.l-P.r, cH=H-P.t-P.b;
      const maxB=Math.max(...data.map(d=>d.bar)), maxL=Math.max(...data.map(d=>d.line));
      const maxV=Math.max(maxB,maxL)*1.1;
      const yS=cH/maxV, bW=Math.min(40,cW/data.length*0.5);
      const marg=bW*1.5, usW=cW-marg*2, stepX=data.length>1?usW/(data.length-1):0;
      const xPos=data.map((_,i)=>P.l+marg+i*stepX);
      const yVals=data.map(d=>H-P.b-d.line*yS);
      const cumLen=[0]; let totLen=0;
      for(let i=1;i<data.length;i++){const dx=stepX,dy=yVals[i]-yVals[i-1];totLen+=Math.sqrt(dx*dx+dy*dy);cumLen.push(totLen)}
      const barDur=0.5, barStag=0.1, lineDur=1.8, ptDur=0.4;
      const lineDel=(data.length-1)*barStag+barDur*0.5;
      let svg='<svg viewBox="0 0 '+W+' '+H+'">';
      const gL=P.l+marg-bW/2-5, gR=P.l+marg+usW+bW/2+5;
      for(let i=0;i<=4;i++){const y=P.t+cH/4*i,v=Math.round(maxV-maxV/4*i);svg+='<line x1="'+gL+'" y1="'+y+'" x2="'+gR+'" y2="'+y+'" class="h2v-grid-line" '+(i?'stroke-dasharray="4"':'')+'/>'; svg+='<text x="'+(gL-8)+'" y="'+(y+4)+'" class="h2v-chart-label" text-anchor="end" font-size="11">'+v+'</text>'}
      let path='',bars='',pts='',labels='';
      data.forEach((d,i) => {
        const x=xPos[i],bY=H-P.b-d.bar*yS,bH=H-P.b-bY,lY=yVals[i];
        const bDel=i*barStag;
        const pFrac=totLen?cumLen[i]/totLen:0;
        const lArr=lineDel+pFrac*lineDur;
        const pDel=Math.max(0,lArr-ptDur/2);
        bars+='<rect x="'+(x-bW/2)+'" y="'+bY+'" width="'+bW+'" height="'+bH+'" fill="'+barC+'" class="h2v-bar" style="animation:h2v-scaleUpCol '+barDur+'s cubic-bezier(0.34,1.56,0.64,1) '+bDel+'s forwards"/>';
        if(i===0)path+='M '+x+' '+lY+' ';
        else{const px=xPos[i-1],py=yVals[i-1],cp1=px+(x-px)/2,cp2=x-(x-px)/2;path+='C '+cp1+' '+py+', '+cp2+' '+lY+', '+x+' '+lY+' '}
        labels+='<text x="'+x+'" y="'+(H-15)+'" class="h2v-chart-label" text-anchor="middle">'+d.label+'</text>';
        pts+='<circle cx="'+x+'" cy="'+lY+'" r="6" fill="#fff" stroke="'+lineC+'" class="h2v-combo-pt" style="animation:h2v-fadeInPt '+ptDur+'s ease-out '+pDel+'s forwards"/>';
      });
      svg+=bars;
      svg+='<path d="'+path+'" class="h2v-combo-line" stroke="'+lineC+'" id="h2v-cl-'+this.id+'"/>';
      svg+=pts+labels+'</svg>';
      this.innerHTML=svg;
      const pathEl=this.querySelector('.h2v-combo-line');
      if(pathEl){const len=pathEl.getTotalLength();pathEl.style.strokeDasharray=len;pathEl.style.strokeDashoffset=len;pathEl.getBoundingClientRect();pathEl.style.transition='stroke-dashoffset '+lineDur+'s linear '+lineDel+'s';pathEl.style.strokeDashoffset='0'}
    }
  }
  customElements.define('combo-chart', H2VComboChart);

  // ===== SCATTER CHART =====
  class H2VScatterChart extends HTMLElement {
    connectedCallback() { injectCSS(); this._render(); observeScene(this, () => this._render()); }
    _render() {
      const data = JSON.parse(this.getAttribute('data') || '[]');
      if (!data.length) return;
      const color = this.getAttribute('color') || getAccentColor();
      const showReg = this.hasAttribute('regression');
      const xLabel = this.getAttribute('x-label') || '';
      const yLabel = this.getAttribute('y-label') || '';
      const W=650,H=320,P={t:30,r:30,b:45,l:55};
      const cW=W-P.l-P.r, cH=H-P.t-P.b;
      const maxX=Math.max(...data.map(d=>d.x))*1.1, maxY=Math.max(...data.map(d=>d.y))*1.1;
      const xS=cW/maxX, yS=cH/maxY;
      const ptDur=0.5, ptStag=1.0, lineDel=ptStag+ptDur, lineDur=1.2;
      let svg='<svg viewBox="0 0 '+W+' '+H+'">';
      for(let i=0;i<=5;i++){const y=P.t+cH/5*i,v=Math.round(maxY-maxY/5*i);svg+='<line x1="'+P.l+'" y1="'+y+'" x2="'+(W-P.r)+'" y2="'+y+'" class="h2v-grid-line"/>'; svg+='<text x="'+(P.l-10)+'" y="'+(y+4)+'" class="h2v-chart-label" text-anchor="end">'+v+'</text>'}
      for(let i=0;i<=5;i++){const x=P.l+cW/5*i,v=Math.round(maxX/5*i);svg+='<text x="'+x+'" y="'+(H-12)+'" class="h2v-chart-label" text-anchor="middle">'+v+'</text>'}
      if(xLabel)svg+='<text x="'+(P.l+cW/2)+'" y="'+(H-2)+'" class="h2v-chart-label" text-anchor="middle">'+xLabel+'</text>';
      if(yLabel)svg+='<text x="12" y="'+(P.t+cH/2)+'" class="h2v-chart-label" text-anchor="middle" transform="rotate(-90,12,'+(P.t+cH/2)+')">'+yLabel+'</text>';
      const sorted=[...data].sort((a,b)=>a.x-b.x);
      sorted.forEach((p,i) => {
        const cx=P.l+p.x*xS, cy=H-P.b-p.y*yS, del=(i/data.length)*ptStag;
        svg+='<circle cx="'+cx+'" cy="'+cy+'" r="5" fill="'+color+'33" stroke="'+color+'" class="h2v-scatter-pt" style="animation:h2v-fadeInPt '+ptDur+'s ease-in-out '+del+'s forwards"/>';
      });
      if(showReg&&data.length>1){
        let sX=0,sY=0,sXY=0,sXX=0;const n=data.length;
        data.forEach(p=>{sX+=p.x;sY+=p.y;sXY+=p.x*p.y;sXX+=p.x*p.x});
        const sl=(n*sXY-sX*sY)/(n*sXX-sX*sX), ic=(sY-sl*sX)/n;
        const mx=Math.max(...data.map(d=>d.x));
        const x1=P.l,y1=H-P.b-ic*yS,x2=P.l+mx*xS,y2=H-P.b-(sl*mx+ic)*yS;
        const len=Math.sqrt((x2-x1)**2+(y2-y1)**2);
        svg+='<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" class="h2v-reg-line" stroke-dasharray="'+len+'" stroke-dashoffset="'+len+'" style="animation:h2v-drawLine '+lineDur+'s ease-in-out '+lineDel+'s forwards"/>';
      }
      svg+='</svg>';
      this.innerHTML=svg;
    }
  }
  customElements.define('scatter-chart', H2VScatterChart);

  // ===== STAT GRID + STAT BOX =====
  class H2VStatGrid extends HTMLElement {
    connectedCallback() {
      injectCSS();
      const cols=this.getAttribute('cols')||'3';
      this.style.gridTemplateColumns='repeat('+cols+',1fr)';
    }
  }
  customElements.define('stat-grid', H2VStatGrid);

  class H2VStatBox extends HTMLElement {
    connectedCallback() { injectCSS(); this._render(); observeScene(this, () => this._render()); }
    _render() {
      const v=this.getAttribute('value')||'';
      const l=this.getAttribute('label')||'';
      const c=this.getAttribute('color')||'inherit';
      const del=parseFloat(this.getAttribute('delay')||'0');
      const effect=this.getAttribute('effect')||'popIn';
      this.innerHTML='<div class="h2v-val" style="color:'+c+'">'+v+'</div><div class="h2v-lbl">'+l+'</div>';
      this.style.opacity='0';
      this.style.animation='h2v-'+effect+' 0.6s cubic-bezier(0.34,1.56,0.64,1) '+del+'s forwards';
    }
  }
  customElements.define('stat-box', H2VStatBox);

  // ===== TIMELINE =====
  class H2VTimeLine extends HTMLElement {
    connectedCallback() {
      injectCSS();
      const c=this.getAttribute('color')||getAccentColor();
      const before=document.createElement('style');
      before.textContent='time-line::before{background:'+c+'}time-item::before{background:'+c+';box-shadow:0 0 0 4px '+c+'33}.h2v-yr{color:'+c+' !important}';
      (document.head||document.documentElement).appendChild(before);
    }
  }
  customElements.define('time-line', H2VTimeLine);

  class H2VTimeItem extends HTMLElement {
    connectedCallback() { injectCSS(); this._desc=this.textContent.trim(); this._render(); observeScene(this, () => this._render()); }
    _render() {
      const yr=this.getAttribute('year')||'';
      const ti=this.getAttribute('title')||'';
      const desc=this._desc||'';
      const del=parseFloat(this.getAttribute('delay')||'0');
      this.innerHTML=(yr?'<div class="h2v-yr">'+yr+'</div>':'')+(ti?'<div class="h2v-ti">'+ti+'</div>':'')+(desc?'<div class="h2v-tx">'+desc+'</div>':'');
      this.style.opacity='0';
      this.style.animation='h2v-fadeLeft 0.7s cubic-bezier(0.22,1,0.36,1) '+del+'s forwards';
    }
  }
  customElements.define('time-item', H2VTimeItem);

  // ===== COMPARE GRID + BOX =====
  class H2VCompareGrid extends HTMLElement {
    connectedCallback() { injectCSS(); }
  }
  customElements.define('compare-grid', H2VCompareGrid);

  class H2VCompareBox extends HTMLElement {
    connectedCallback() { injectCSS(); this._desc=this.textContent.trim(); this._render(); observeScene(this, () => this._render()); }
    _render() {
      const l=this.getAttribute('label')||'';
      const v=this.getAttribute('value')||'';
      const desc=this._desc||'';
      const del=parseFloat(this.getAttribute('delay')||'0');
      this.innerHTML='<div class="h2v-lbl">'+l+'</div><div class="h2v-val">'+v+'</div>'+(desc?'<div class="h2v-desc">'+desc+'</div>':'');
      this.style.opacity='0';
      this.style.animation='h2v-scaleIn 0.6s cubic-bezier(0.34,1.56,0.64,1) '+del+'s forwards';
    }
  }
  customElements.define('compare-box', H2VCompareBox);

  // ===== QUOTE BLOCK =====
  class H2VQuoteBlock extends HTMLElement {
    connectedCallback() { injectCSS(); this._text=this.textContent.trim(); this._render(); }
    _render() {
      const cite=this.getAttribute('cite')||'';
      const text=this._text||'';
      this.innerHTML='<p>'+text+'</p>'+(cite?'<span class="h2v-cite">\\u2014 '+cite+'</span>':'');
      this.style.borderColor = getAccentColor();
    }
  }
  customElements.define('quote-block', H2VQuoteBlock);

  // ===== ANIM-TEXT =====
  class H2VAnimText extends HTMLElement {
    connectedCallback() { injectCSS(); this._render(); observeScene(this, () => this._render()); }
    _render() {
      const fx=this.getAttribute('effect')||'fadeUp';
      const del=parseFloat(this.getAttribute('delay')||'0');
      const dur=parseFloat(this.getAttribute('duration')||'0.7');
      this.style.animation='h2v-'+fx+' '+dur+'s cubic-bezier(0.22,1,0.36,1) '+del+'s forwards';
    }
  }
  customElements.define('anim-text', H2VAnimText);

  // Inject CSS unconditionally on page load — highlight effects (h2v-hl-color,
  // h2v-hl-underline, etc.) and appear animations require this CSS even when
  // no custom elements are present in the document.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCSS);
  } else {
    injectCSS();
  }

})();
`;
