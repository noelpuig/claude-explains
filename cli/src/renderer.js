import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync, unlinkSync, rmdirSync } from 'fs';
import { join, dirname } from 'path';
import { TIME_CONTROL_SCRIPT } from './time-controller.js';
import { COMPONENTS_SCRIPT } from './components.js';
import { REVIEW_SCRIPT } from './review-ui.js';

const LAUNCH_OPTS = {
  headless: true,
  protocolTimeout: 180000,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--hide-scrollbars',
    '--run-all-compositor-stages-before-draw',
    '--disable-new-content-rendering-timeout',
    '--font-render-hinting=none',
  ]
};

async function launchPage(htmlPath, width, height, opts = {}) {
  const browser = await puppeteer.launch(LAUNCH_OPTS);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.evaluateOnNewDocument(TIME_CONTROL_SCRIPT);
    if (opts.components !== false) {
      await page.evaluateOnNewDocument(COMPONENTS_SCRIPT);
    }
    const url = htmlPath.startsWith('http') ? htmlPath : `file://${htmlPath}`;
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => window.__claudeVideo.tick(0));
    return { browser, page };
  } catch (err) {
    await browser.close();
    throw err;
  }
}

export async function peekConfig(htmlPath, width, height) {
  const { browser, page } = await launchPage(htmlPath, width, height);
  try {
    return await page.evaluate(() => window.__claudeVideo.getConfig());
  } finally {
    await browser.close();
  }
}

export async function analyzeHTML(htmlPath, width, height) {
  const { browser, page } = await launchPage(htmlPath, width, height);
  try {
    const config = await page.evaluate(() => window.__claudeVideo.getConfig());
    const analysis = await page.evaluate(() => window.__claudeVideo.analyze());
    return { config, analysis };
  } finally {
    await browser.close();
  }
}

export async function previewFrame(htmlPath, timeMs, width, height, outputPath) {
  const { browser, page } = await launchPage(htmlPath, width, height);
  try {
    const frameDelta = 1000 / 30;
    const steps = Math.floor(timeMs / frameDelta);
    for (let i = 0; i < steps; i++) {
      await page.evaluate((d) => window.__claudeVideo.tick(d), frameDelta);
    }
    const remaining = timeMs - (steps * frameDelta);
    if (remaining > 0) {
      await page.evaluate((d) => window.__claudeVideo.tick(d), remaining);
    }

    await page.screenshot({
      path: outputPath,
      type: 'png',
      omitBackground: false,
      captureBeyondViewport: false,
    });

    return outputPath;
  } finally {
    await browser.close();
  }
}

export async function renderFrames(htmlPath, options, onFrame) {
  const { width, height, fps, duration } = options;
  const frameDelta = 1000 / fps;
  const totalFrames = Math.round(fps * duration);

  const { browser, page } = await launchPage(htmlPath, width, height);
  try {
    for (let i = 0; i < totalFrames; i++) {
      if (i > 0) {
        await page.evaluate((d) => window.__claudeVideo.tick(d), frameDelta);
      }

      const buf = await page.screenshot({
        type: 'png',
        omitBackground: false,
        captureBeyondViewport: false
      });

      await onFrame(buf, i, totalFrames);
    }
  } finally {
    await browser.close();
  }
}

export async function renderStoryboard(htmlPath, count, duration, width, height, outputPath) {
  const { browser, page } = await launchPage(htmlPath, width, height);
  const tmpDir = join(dirname(outputPath), '.storyboard_tmp');
  mkdirSync(tmpDir, { recursive: true });

  const framePaths = [];
  try {
    const frameDelta = 1000 / 30;
    const timestamps = [];
    for (let i = 0; i < count; i++) {
      timestamps.push((i / (count - 1 || 1)) * duration);
    }

    let currentTime = 0;

    for (let i = 0; i < timestamps.length; i++) {
      const targetMs = timestamps[i] * 1000;
      while (currentTime < targetMs) {
        const step = Math.min(frameDelta, targetMs - currentTime);
        await page.evaluate((d) => window.__claudeVideo.tick(d), step);
        currentTime += step;
      }
      const fp = join(tmpDir, `frame_${String(i).padStart(3, '0')}.png`);
      await page.screenshot({ path: fp, type: 'png', omitBackground: false, captureBeyondViewport: false });
      framePaths.push(fp);
      process.stderr.write(`  Frame ${i + 1}/${count} at ${timestamps[i].toFixed(1)}s\n`);
    }

    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const tileW = Math.round(width / 4);
    const tileH = Math.round(height / 4);
    const inputs = framePaths.map(f => `-i "${f}"`).join(' ');
    execSync(
      `ffmpeg -y ${inputs} -filter_complex "` +
      framePaths.map((_, i) => `[${i}:v]scale=${tileW}:${tileH}[s${i}]`).join(';') +
      ';' + Array.from({ length: count }, (_, i) => `[s${i}]`).join('') +
      `xstack=inputs=${count}:layout=` +
      Array.from({ length: count }, (_, i) => `${(i % cols) * tileW}_${Math.floor(i / cols) * tileH}`).join('|') +
      `" "${outputPath}"`,
      { stdio: 'pipe', timeout: 30000 }
    );

    return { output: outputPath, frames: timestamps.map((t, i) => ({ index: i, time: Math.round(t * 1000) / 1000 })) };
  } finally {
    framePaths.forEach(f => { try { unlinkSync(f); } catch {} });
    try { rmdirSync(tmpDir); } catch {}
    await browser.close();
  }
}

export async function renderPDF(htmlPath, sceneTimes, width, height, outputPath) {
  const { browser, page } = await launchPage(htmlPath, width, height);
  try {
    const frameDelta = 1000 / 30;
    const pages = [];
    let currentTime = 0;

    for (let i = 0; i < sceneTimes.length; i++) {
      const targetMs = sceneTimes[i] * 1000;
      while (currentTime < targetMs) {
        const step = Math.min(frameDelta, targetMs - currentTime);
        await page.evaluate((d) => window.__claudeVideo.tick(d), step);
        currentTime += step;
      }
      const buf = await page.screenshot({ type: 'png', omitBackground: false, captureBeyondViewport: false });
      pages.push(buf);
      process.stderr.write(`  Page ${i + 1}/${sceneTimes.length} at ${sceneTimes[i].toFixed(1)}s\n`);
    }

    const tmpDir = join(dirname(outputPath), '.pdf_tmp');
    mkdirSync(tmpDir, { recursive: true });
    const pagePaths = pages.map((buf, i) => {
      const p = join(tmpDir, `page_${i}.png`);
      writeFileSync(p, buf);
      return p;
    });

    const imgTags = pagePaths.map(p => {
      const b64 = readFileSync(p).toString('base64');
      return `<img src="data:image/png;base64,${b64}" style="width:100%;page-break-after:always">`;
    }).join('\n');

    const pdfHtml = `<!DOCTYPE html><html><head><style>*{margin:0;padding:0}img{display:block}</style></head><body>${imgTags}</body></html>`;
    const pdfPage = await browser.newPage();
    await pdfPage.setContent(pdfHtml, { waitUntil: 'load' });
    await pdfPage.pdf({
      path: outputPath,
      width: '20in',
      height: '11.25in',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    pagePaths.forEach(p => { try { unlinkSync(p); } catch {} });
    try { rmdirSync(tmpDir); } catch {}

    return { output: outputPath, pages: sceneTimes.length };
  } finally {
    await browser.close();
  }
}

export async function bundleHTML(htmlPath, width, height, outputPath) {
  const { browser, page } = await launchPage(htmlPath, width, height);
  try {
    const bundled = await page.evaluate(() => {
      const promises = [];
      document.querySelectorAll('img[src]').forEach(img => {
        if (img.src.startsWith('data:')) return;
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 300;
        canvas.height = img.naturalHeight || img.height || 200;
        const ctx = canvas.getContext('2d');
        try {
          ctx.drawImage(img, 0, 0);
          img.src = canvas.toDataURL('image/png');
        } catch (e) {}
      });

      document.querySelectorAll('link[rel="stylesheet"][href]').forEach(link => {
        try {
          const rules = [];
          for (const sheet of document.styleSheets) {
            if (sheet.href === link.href) {
              for (const rule of sheet.cssRules) rules.push(rule.cssText);
            }
          }
          if (rules.length) {
            const style = document.createElement('style');
            style.textContent = rules.join('\n');
            link.replaceWith(style);
          }
        } catch (e) {}
      });

      return '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
    });

    writeFileSync(outputPath, bundled, 'utf-8');
    return { output: outputPath, size: bundled.length };
  } finally {
    await browser.close();
  }
}

export async function renderReview(htmlPath, width, height, outputPath) {
  const { browser, page } = await launchPage(htmlPath, width, height);
  try {
    const config = await page.evaluate(() => window.__claudeVideo.getConfig());
    const duration = config.duration || 10;

    const bundled = await page.evaluate(() => {
      document.querySelectorAll('img[src]').forEach(img => {
        if (img.src.startsWith('data:')) return;
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 300;
        canvas.height = img.naturalHeight || img.height || 200;
        const ctx = canvas.getContext('2d');
        try { ctx.drawImage(img, 0, 0); img.src = canvas.toDataURL('image/png'); } catch {}
      });
      document.querySelectorAll('link[rel="stylesheet"][href]').forEach(link => {
        try {
          const rules = [];
          for (const sheet of document.styleSheets) {
            if (sheet.href === link.href) {
              for (const rule of sheet.cssRules) rules.push(rule.cssText);
            }
          }
          if (rules.length) {
            const style = document.createElement('style');
            style.textContent = rules.join('\n');
            link.replaceWith(style);
          }
        } catch {}
      });
      return '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
    });

    const buildId = Date.now().toString(36);
    const buildMeta = `<meta name="claude-explains:review-build" content="${buildId}">`;
    const scripts = `<script>${TIME_CONTROL_SCRIPT}<\/script>\n<script>${COMPONENTS_SCRIPT}<\/script>`;
    const reviewTag = `<script>${REVIEW_SCRIPT}<\/script>`;
    let html = bundled.replace('</head>', buildMeta + '\n' + scripts + '\n</head>');
    html = html.replace('</body>', reviewTag + '\n</body>');

    writeFileSync(outputPath, html, 'utf-8');
    return { output: outputPath, duration, size: html.length };
  } finally {
    await browser.close();
  }
}

export async function validateHTML(htmlPath, width, height) {
  const { browser, page } = await launchPage(htmlPath, width, height);
  try {
    const issues = await page.evaluate(() => {
      const warnings = [];

      function getLuminance(r, g, b) {
        const [rs, gs, bs] = [r, g, b].map(c => {
          c = c / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      }
      function getContrastRatio(l1, l2) {
        const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      }
      function parseColor(c) {
        const m = c.match(/\\d+/g);
        return m ? [+m[0], +m[1], +m[2]] : null;
      }

      const skipTags = new Set(['SCRIPT','STYLE','NOSCRIPT','META','LINK','HEAD','TITLE','BR','HR']);
      document.querySelectorAll('*').forEach(el => {
        if (skipTags.has(el.tagName)) return;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        const hasDirectText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
        if (!hasDirectText) return;
        const text = el.textContent.trim();
        if (!text) return;

        const fontSize = parseFloat(style.fontSize);
        if (fontSize > 0 && fontSize < 18) {
          const sel = el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '');
          warnings.push({ severity: 'error', type: 'font-size', message: `Text "${text.slice(0, 30)}" is ${fontSize.toFixed(0)}px (minimum 18px)`, element: sel });
        }

        const fgColor = parseColor(style.color);
        const bgEl = el.closest('[style*="background"], .scene, body') || document.body;
        const bgColor = parseColor(getComputedStyle(bgEl).backgroundColor);
        if (fgColor && bgColor) {
          const fgLum = getLuminance(...fgColor);
          const bgLum = getLuminance(...bgColor);
          const ratio = getContrastRatio(fgLum, bgLum);
          if (ratio < 3) {
            const sel = el.id ? '#' + el.id : el.tagName.toLowerCase();
            warnings.push({ severity: 'error', type: 'contrast', message: `Text "${text.slice(0, 25)}" has contrast ratio ${ratio.toFixed(1)}:1 (minimum 3:1). Text color and background are too similar.`, element: sel });
          }
        }
      });

      const images = document.querySelectorAll('img[src]');
      images.forEach(img => {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('data:')) {
          if (!img.complete || img.naturalWidth === 0) {
            warnings.push({ severity: 'error', type: 'image-broken', message: `Image failed to load: ${src.slice(0, 80)}`, element: src });
          }
        }
      });

      const scenes = document.querySelectorAll('.scene');
      const ttsCues = document.querySelectorAll('[data-tts]');
      if (scenes.length > 0 && ttsCues.length === 0) {
        warnings.push({ severity: 'warning', type: 'no-tts', message: 'Scenes found but no data-tts narration cues defined' });
      }

      const dur = document.querySelector('meta[name="claude-explains:duration"]');
      if (!dur) {
        warnings.push({ severity: 'warning', type: 'no-duration', message: 'Missing <meta name="claude-explains:duration"> — will default to 10s' });
      }

      const syncEls = document.querySelectorAll('[data-appear],[data-highlight],[data-fade-out]');
      const maxDur = dur ? parseFloat(dur.getAttribute('content')) : 10;
      syncEls.forEach(el => {
        const t = parseFloat(el.getAttribute('data-appear') || el.getAttribute('data-highlight') || el.getAttribute('data-fade-out'));
        if (t > maxDur) {
          warnings.push({ severity: 'error', type: 'sync-oob', message: `Sync timestamp ${t}s exceeds duration ${maxDur}s`, element: el.textContent.slice(0, 30) });
        }
      });

      const appearEls = document.querySelectorAll('[data-appear]');
      if (appearEls.length > 0 && appearEls.length < 8) {
        warnings.push({ severity: 'warning', type: 'low-appear-count',
          message: `Only ${appearEls.length} data-appear events (minimum 8). Scene may be too static.` });
      }

      const highlightEls = document.querySelectorAll('[data-highlight]');
      if (appearEls.length > 0 && highlightEls.length < 3) {
        warnings.push({ severity: 'warning', type: 'low-highlight-count',
          message: `Only ${highlightEls.length} data-highlight events (minimum 3). Narrator words should trigger visual highlights.` });
      }

      const fadeOutEls = document.querySelectorAll('[data-fade-out]');
      if (appearEls.length > 0 && appearEls.length !== fadeOutEls.length) {
        warnings.push({ severity: 'error', type: 'fade-out-mismatch',
          message: `${appearEls.length} data-appear but ${fadeOutEls.length} data-fade-out. Every appear must have a matching fade-out.` });
      }

      if (appearEls.length >= 2) {
        const times = Array.from(appearEls).map(el => parseFloat(el.getAttribute('data-appear'))).filter(t => !isNaN(t));
        if (times.length >= 2) {
          const spread = Math.max(...times) - Math.min(...times);
          if (spread < maxDur * 0.3) {
            warnings.push({ severity: 'warning', type: 'clustered-timestamps',
              message: `data-appear timestamps span only ${spread.toFixed(1)}s across ${maxDur}s duration. Elements should appear throughout the scene, not all at once.` });
          }
        }
      }

      if (appearEls.length > 0 && fadeOutEls.length > 0) {
        const intervals = Array.from(appearEls).map(el => {
          const a = parseFloat(el.getAttribute('data-appear'));
          const f = parseFloat(el.getAttribute('data-fade-out'));
          return (!isNaN(a) && !isNaN(f)) ? { start: a, end: f } : null;
        }).filter(Boolean);
        let maxVisible = 0;
        const cappedDur = Math.min(maxDur, 600);
        for (let t = 0; t <= cappedDur; t += 0.5) {
          const visible = intervals.filter(iv => t >= iv.start && t < iv.end).length;
          if (visible > maxVisible) maxVisible = visible;
        }
        if (maxVisible > 3) {
          warnings.push({ severity: 'warning', type: 'too-many-overlays',
            message: `Up to ${maxVisible} elements visible simultaneously (maximum 3). Fade out old elements before showing new ones.` });
        }
      }

      const allScenes = document.querySelectorAll('.scene');
      allScenes.forEach((scene, si) => {
        if (scene.querySelector('svg')) return;
        const textEls = scene.querySelectorAll('h1,h2,h3,p,span,div,li');
        let maxFS = 0;
        textEls.forEach(el => {
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden') return;
          const hasDirectText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
          if (!hasDirectText) return;
          const fs = parseFloat(s.fontSize);
          if (fs > maxFS) maxFS = fs;
        });
        if (maxFS > 0 && maxFS < 32) {
          warnings.push({ severity: 'warning', type: 'small-slide-text',
            message: `Scene ${si}: largest text is ${maxFS.toFixed(0)}px on a slide scene (no diagram). Use the full viewport — titles should be 40px+, body 24px+.` });
        }
      });

      function hexToHsl(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        const r = parseInt(hex.slice(0,2),16)/255;
        const g = parseInt(hex.slice(2,4),16)/255;
        const b = parseInt(hex.slice(4,6),16)/255;
        const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
        const l = (mx+mn)/2;
        if (mx === mn) return {s:0,l};
        const d = mx-mn;
        return {s: l > 0.5 ? d/(2-mx-mn) : d/(mx+mn), l};
      }
      const accentEl = document.querySelector('.accent,[class*="accent"]');
      let accentHex = '';
      if (accentEl) {
        const c = getComputedStyle(accentEl).color;
        const m = c.match(/\d+/g);
        if (m) accentHex = ((1<<24)+(+m[0]<<16)+(+m[1]<<8)+(+m[2])).toString(16).slice(1).toLowerCase();
      }
      let saturatedCount = 0, totalChecked = 0;
      document.querySelectorAll('svg [fill], svg [stroke]').forEach(el => {
        ['fill','stroke'].forEach(attr => {
          const val = el.getAttribute(attr);
          if (!val || val === 'none' || val === 'currentColor' || !val.startsWith('#')) return;
          const clean = val.replace('#','').toLowerCase();
          if (accentHex && clean === accentHex) return;
          totalChecked++;
          const hsl = hexToHsl(val);
          if (hsl.s > 0.4 && hsl.l > 0.15 && hsl.l < 0.85) saturatedCount++;
        });
      });
      if (totalChecked > 0 && saturatedCount / totalChecked > 0.15) {
        warnings.push({ severity: 'warning', type: 'saturated-svg-colors',
          message: `${saturatedCount}/${totalChecked} SVG fill/stroke values are saturated (>40% saturation). Diagram elements should be grey/muted by default. Use accent color only for brief data-highlight moments.` });
      }

      return warnings;
    });

    const imageResults = await page.evaluate(async () => {
      const results = [];
      const imgs = document.querySelectorAll('img[src]');
      for (const img of imgs) {
        const src = img.getAttribute('src');
        if (src && src.startsWith('http')) {
          try {
            const resp = await fetch(src, { method: 'HEAD' });
            results.push({ src: src.slice(0, 80), status: resp.status, ok: resp.ok });
          } catch (e) {
            results.push({ src: src.slice(0, 80), status: 0, ok: false, error: e.message });
          }
        }
      }
      return results;
    });

    imageResults.filter(r => !r.ok).forEach(r => {
      issues.push({ severity: 'error', type: 'image-http', message: `Image HTTP ${r.status || 'failed'}: ${r.src}`, element: r.src });
    });

    return { issues, image_checks: imageResults, total_issues: issues.length, has_errors: issues.some(i => i.severity === 'error') };
  } finally {
    await browser.close();
  }
}
