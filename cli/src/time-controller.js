export const TIME_CONTROL_SCRIPT = `
(function() {
  'use strict';

  const _OrigDate = Date;
  const _origDateNow = Date.now;
  const _origPerfNow = performance.now.bind(performance);
  const _origRAF = window.requestAnimationFrame;
  const _origCAF = window.cancelAnimationFrame;
  const _origSetTimeout = window.setTimeout.bind(window);
  const _origClearTimeout = window.clearTimeout.bind(window);
  const _origSetInterval = window.setInterval.bind(window);
  const _origClearInterval = window.clearInterval.bind(window);

  const _epochBase = _origDateNow();
  let _elapsed = 0;

  // --- Date override ---
  function VirtualDate(...args) {
    if (!new.target) return new _OrigDate(_epochBase + _elapsed).toString();
    if (args.length === 0) return new _OrigDate(_epochBase + _elapsed);
    return new _OrigDate(...args);
  }
  VirtualDate.now = () => _epochBase + _elapsed;
  VirtualDate.parse = _OrigDate.parse;
  VirtualDate.UTC = _OrigDate.UTC;
  VirtualDate.prototype = _OrigDate.prototype;
  window.Date = VirtualDate;

  // --- performance.now override ---
  Object.defineProperty(performance, 'now', {
    value: () => _elapsed,
    writable: true,
    configurable: true
  });

  // --- RAF override ---
  let _rafId = 0;
  const _rafQueue = new Map();

  window.requestAnimationFrame = function(cb) {
    const id = ++_rafId;
    _rafQueue.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = function(id) {
    _rafQueue.delete(id);
  };

  // --- setTimeout/setInterval override ---
  let _timerId = 1000000;
  const _timers = new Map();

  window.setTimeout = function(cb, delay, ...args) {
    if (typeof cb !== 'function') {
      const code = String(cb);
      cb = () => eval(code);
    }
    const id = ++_timerId;
    _timers.set(id, {
      cb, fire: _elapsed + Math.max(0, delay || 0),
      args, type: 'timeout'
    });
    return id;
  };
  window.clearTimeout = function(id) { _timers.delete(id); };

  window.setInterval = function(cb, delay, ...args) {
    if (typeof cb !== 'function') {
      const code = String(cb);
      cb = () => eval(code);
    }
    const id = ++_timerId;
    const ms = Math.max(1, delay || 1);
    _timers.set(id, {
      cb, fire: _elapsed + ms,
      args, type: 'interval', interval: ms
    });
    return id;
  };
  window.clearInterval = function(id) { _timers.delete(id); };

  // --- CSS animation tracking ---
  const _knownAnims = new WeakMap();

  function seekAnimations() {
    let anims;
    try { anims = document.getAnimations(); } catch(e) { return; }
    for (const anim of anims) {
      if (!_knownAnims.has(anim)) {
        _knownAnims.set(anim, _elapsed);
        try { anim.pause(); } catch(e) {}
      }
      const born = _knownAnims.get(anim);
      try { anim.currentTime = _elapsed - born; } catch(e) {}
    }
  }

  // --- Tick ---
  function processTimers() {
    let rounds = 0;
    while (rounds++ < 500) {
      let earliest = null;
      let earliestId = null;
      for (const [id, t] of _timers) {
        if (t.fire <= _elapsed && (earliest === null || t.fire < earliest.fire)) {
          earliest = t;
          earliestId = id;
        }
      }
      if (!earliest) break;
      if (earliest.type === 'timeout') {
        _timers.delete(earliestId);
        try { earliest.cb(...earliest.args); } catch(e) { console.error(e); }
      } else {
        earliest.fire += earliest.interval;
        try { earliest.cb(...earliest.args); } catch(e) { console.error(e); }
      }
    }
    if (rounds >= 500) { try { console.warn('[claude-video] Timer processing hit 500-round cap'); } catch(e) {} }
  }

  function processRAF() {
    const batch = new Map(_rafQueue);
    _rafQueue.clear();
    for (const [, cb] of batch) {
      try { cb(_elapsed); } catch(e) { console.error(e); }
    }
  }

  // --- SVG highlight support ---
  function _getAccent() {
    const el = document.querySelector('.accent,[class*="accent"]');
    if (el) {
      const c = getComputedStyle(el).color;
      const m = c.match(/\\d+/g);
      if (m) return 'rgb('+m[0]+','+m[1]+','+m[2]+')';
    }
    return '#e94560';
  }

  function applySvgHighlight(el, effect) {
    const accent = _getAccent();
    const svg = el.closest('svg');
    if (!svg) return;
    const ns = 'http://www.w3.org/2000/svg';
    let bbox;
    try { bbox = el.getBBox(); } catch(e) { return; }

    if (effect === 'color' || effect === 'glow') {
      el.style.fill = accent;
      if (effect === 'glow') {
        el.style.filter = 'drop-shadow(0 0 12px ' + accent + ')';
      }
      return;
    }

    if (effect === 'underline') {
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', bbox.x);
      line.setAttribute('y1', bbox.y + bbox.height + 3);
      line.setAttribute('x2', bbox.x + bbox.width);
      line.setAttribute('y2', bbox.y + bbox.height + 3);
      line.setAttribute('stroke', accent);
      line.setAttribute('stroke-width', '3');
      const len = bbox.width;
      line.setAttribute('stroke-dasharray', len);
      line.setAttribute('stroke-dashoffset', len);
      line.setAttribute('data-h2v-hl', '');
      el.parentNode.insertBefore(line, el);
      el.style.fill = accent;
      line.animate([
        { strokeDashoffset: len },
        { strokeDashoffset: 0 }
      ], { duration: 450, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'forwards' });
      return;
    }

    if (effect === 'marker' || effect === 'box') {
      const rect = document.createElementNS(ns, 'rect');
      const pad = effect === 'box' ? 6 : 2;
      rect.setAttribute('x', bbox.x - pad);
      rect.setAttribute('y', bbox.y - pad);
      rect.setAttribute('width', bbox.width + pad * 2);
      rect.setAttribute('height', bbox.height + pad * 2);
      if (effect === 'box') { rect.setAttribute('rx', '6'); rect.setAttribute('ry', '6'); }
      rect.setAttribute('fill', accent);
      rect.setAttribute('opacity', '0');
      rect.setAttribute('data-h2v-hl', '');
      el.parentNode.insertBefore(rect, el);
      el.style.fill = accent;
      const targetOpacity = effect === 'box' ? 0.18 : 0.25;
      rect.animate([
        { opacity: 0 },
        { opacity: targetOpacity }
      ], { duration: 400, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'forwards' });
      return;
    }

    el.style.fill = accent;
  }

  // --- Narrator sync: data-appear and data-highlight ---
  let _syncScanned = false;
  let _syncItems = [];

  function scanSyncElements() {
    if (_syncScanned) return;
    _syncScanned = true;

    document.querySelectorAll('[data-appear]').forEach(el => {
      const t = parseFloat(el.getAttribute('data-appear')) * 1000;
      const effect = el.getAttribute('data-appear-effect') || 'fade';
      el.style.opacity = '0';
      el.style.transition = 'none';
      if (effect !== 'fade') {
        const cs = getComputedStyle(el);
        if (cs.display === 'inline') el.style.display = 'inline-block';
      }
      _syncItems.push({ el, time: t, type: 'appear', effect, fired: false });
    });

    document.querySelectorAll('[data-highlight]').forEach(el => {
      const t = parseFloat(el.getAttribute('data-highlight')) * 1000;
      const effect = el.getAttribute('data-highlight-effect') || 'color';
      const cs = getComputedStyle(el);
      if (effect !== 'marker' && cs.display === 'inline' && !el.closest('svg')) el.style.display = 'inline-block';
      if (effect === 'underline' && !el.closest('svg')) el.style.position = el.style.position || 'relative';
      _syncItems.push({ el, time: t, type: 'highlight', effect, fired: false });
    });

    document.querySelectorAll('[data-fade-out]').forEach(el => {
      const t = parseFloat(el.getAttribute('data-fade-out')) * 1000;
      _syncItems.push({ el, time: t, type: 'fadeout', fired: false });
    });

    _syncItems.sort((a, b) => a.time - b.time);
  }

  function processSyncItems() {
    scanSyncElements();
    for (const item of _syncItems) {
      if (item.fired || _elapsed < item.time) continue;
      item.fired = true;
      if (item.type === 'appear') {
        if (item.effect === 'fade') {
          item.el.style.transition = 'opacity 0.4s ease-out';
          item.el.style.opacity = '1';
        } else {
          item.el.style.opacity = '';
          item.el.classList.add('h2v-appear-' + item.effect);
        }
        item.el.classList.add('h2v-visible');
      } else if (item.type === 'highlight') {
        if (item.el.closest('svg')) {
          applySvgHighlight(item.el, item.effect);
        } else {
          item.el.classList.add('h2v-hl-' + item.effect);
        }
      } else if (item.type === 'fadeout') {
        item.el.style.transition = 'opacity 0.4s ease-out';
        item.el.style.opacity = '0';
        item.el.classList.add('h2v-faded');
        if (item.el.closest('svg')) {
          const parent = item.el.parentNode;
          if (parent) parent.querySelectorAll('[data-h2v-hl]').forEach(function(hl) {
            hl.style.transition = 'opacity 0.4s ease-out';
            hl.style.opacity = '0';
          });
        }
      }
    }
  }

  // --- Viewport transforms: data-viewport zoom/pan ---
  let _vpScanned = false;
  let _vpItems = [];

  function scanViewportItems() {
    if (_vpScanned) return;
    _vpScanned = true;
    document.querySelectorAll('[data-viewport]').forEach(el => {
      const targetId = el.getAttribute('data-viewport');
      const target = document.getElementById(targetId);
      if (!target) return;
      const time = parseFloat(el.getAttribute('data-viewport-at') || '0') * 1000;
      const transform = el.getAttribute('data-viewport-transform') || 'scale(1)';
      const duration = parseFloat(el.getAttribute('data-viewport-duration') || '1.5') * 1000;
      const focusSel = el.getAttribute('data-viewport-focus');
      const focusEl = focusSel ? document.querySelector(focusSel) : null;
      if (focusSel && !focusEl) console.error('[claude-explains] data-viewport-focus selector "' + focusSel + '" matched no element');
      const scale = parseFloat(el.getAttribute('data-viewport-scale') || '1');
      _vpItems.push({ target, time, transform, duration, focusEl, scale, fired: false });
    });
    _vpItems.sort((a, b) => a.time - b.time);
  }

  function processViewportItems() {
    scanViewportItems();
    for (const item of _vpItems) {
      if (item.fired || _elapsed < item.time) continue;
      item.fired = true;
      item.target.style.transition = 'transform ' + item.duration + 'ms ease-in-out';
      if (item.focusEl) {
        const vw = item.target.offsetWidth;
        const vh = item.target.offsetHeight;
        if (!vw || !vh) { item.target.style.transform = item.transform; continue; }
        item.target.style.transformOrigin = '50% 50%';
        let prevT = item.target.style.transform;
        item.target.style.transition = 'none';
        item.target.style.transform = 'none';
        item.target.offsetWidth;
        let rect = item.focusEl.getBoundingClientRect();
        let tRect = item.target.getBoundingClientRect();
        let elCX = (rect.left + rect.right) / 2 - tRect.left;
        let elCY = (rect.top + rect.bottom) / 2 - tRect.top;
        let tx = vw / 2 - elCX;
        let ty = vh / 2 - elCY;
        item.target.style.transform = prevT;
        item.target.offsetWidth;
        item.target.style.transition = 'transform ' + item.duration + 'ms ease-in-out';
        item.target.style.transform = 'scale(' + item.scale + ') translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px)';
      } else {
        item.target.style.transform = item.transform;
      }
    }
  }

  window.__claudeVideo = {
    _origRAF: _origRAF,
    _origCAF: _origCAF,
    _origPerfNow: _origPerfNow,
    tick: function(deltaMs) {
      _elapsed += deltaMs;
      processTimers();
      processRAF();
      processSyncItems();
      processViewportItems();
      seekAnimations();
    },
    getTime: function() { return _elapsed; },
    getConfig: function() {
      const meta = document.querySelector('meta[name="claude-explains:duration"]');
      const dur = meta ? parseFloat(meta.getAttribute('content')) : null;
      const ttsCues = [];
      document.querySelectorAll('[data-tts]').forEach(el => {
        const startVal = parseFloat(el.getAttribute('data-tts-start') || '0');
        const cue = {
          text: el.getAttribute('data-tts'),
          start: isNaN(startVal) ? 0 : startVal
        };
        const pause = parseFloat(el.getAttribute('data-tts-pause'));
        if (!isNaN(pause) && pause > 0) cue.pause_after = pause;
        ttsCues.push(cue);
      });
      const script = document.querySelector('script[type="text/claude-explains-tts"]');
      if (script) {
        try {
          const parsed = JSON.parse(script.textContent);
          if (Array.isArray(parsed)) ttsCues.push(...parsed);
        } catch(e) {}
      }
      ttsCues.sort((a, b) => a.start - b.start);
      return { duration: dur, ttsCues };
    },
    analyze: function() {
      const animations = [];
      try {
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule.type === 7) {
                animations.push({ type: 'css-keyframes', name: rule.name, keyframe_count: rule.cssRules.length });
              }
            }
          } catch(e) {}
        }
      } catch(e) {}

      try {
        for (const anim of document.getAnimations()) {
          const target = anim.effect && anim.effect.target;
          let selector = 'unknown';
          if (target) {
            if (target.id) selector = '#' + target.id;
            else if (target.className) selector = '.' + String(target.className).split(' ')[0];
            else selector = target.tagName.toLowerCase();
          }
          const timing = anim.effect && anim.effect.getTiming ? anim.effect.getTiming() : {};
          const isTrans = anim.constructor.name === 'CSSTransition';
          animations.push({
            type: isTrans ? 'css-transition' : 'css-animation',
            element: selector,
            property: isTrans ? anim.transitionProperty : (anim.animationName || null),
            duration_ms: timing.duration || null,
            delay_ms: timing.delay || 0,
            iterations: timing.iterations || 1,
            fill: timing.fill || 'none',
          });
        }
      } catch(e) {}

      const canvases = [];
      for (const c of document.querySelectorAll('canvas')) {
        canvases.push({
          element: c.id ? '#' + c.id : 'canvas',
          width: c.width,
          height: c.height,
        });
      }

      const pendingTimers = [];
      for (const [id, t] of _timers) {
        pendingTimers.push({ id, fire_at_ms: t.fire, type: t.type, interval_ms: t.interval || null });
      }

      return {
        animations,
        canvases,
        pending_timers: pendingTimers,
        active_raf_callbacks: _rafQueue.size,
        virtual_time_ms: _elapsed,
        dom_element_count: document.querySelectorAll('*').length,
      };
    }
  };
})();
`;
