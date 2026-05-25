import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { createHash } from 'crypto';

const BOILERPLATE_CSS = `* { margin:0; padding:0; box-sizing:border-box }
body { width:1920px; height:1080px; overflow:hidden; font-family:system-ui,-apple-system,sans-serif }
.scene { position:absolute; inset:0; padding:60px 80px; display:flex; flex-direction:column; opacity:0; pointer-events:none }
.scene.active { opacity:1; pointer-events:auto }
h1 { font-size:clamp(2.5rem,5vw,4rem); font-weight:700; margin-bottom:0.6em }
p, li { font-size:clamp(1.2rem,2vw,1.6rem); line-height:1.5 }`;

function extractBetween(html, openTag, closeTag) {
  const openRe = new RegExp(openTag, 'i');
  const closeRe = new RegExp(closeTag, 'i');
  const openMatch = openRe.exec(html);
  if (!openMatch) return '';
  const startIdx = openMatch.index + openMatch[0].length;
  const closeMatch = closeRe.exec(html.slice(startIdx));
  if (!closeMatch) return '';
  return html.slice(startIdx, startIdx + closeMatch.index);
}

function extractAll(html, pattern) {
  const re = new RegExp(pattern, 'gi');
  const results = [];
  let m;
  while ((m = re.exec(html)) !== null) results.push(m[1]);
  return results;
}

function hashStr(s) {
  return createHash('md5').update(s.replace(/\s+/g, ' ').trim()).digest('hex');
}

function extractThemeFromStyles(styles) {
  const bodyMatch = styles.join('\n').match(/body\s*\{([^}]*)\}/);
  if (!bodyMatch) return { bg: '#1a1a2e', color: '#e0e0e0' };
  const block = bodyMatch[1];
  const bgMatch = block.match(/background\s*:\s*([^;]+)/);
  const colorMatch = block.match(/(?:^|;)\s*color\s*:\s*([^;]+)/);
  return {
    bg: bgMatch ? bgMatch[1].trim() : '#1a1a2e',
    color: colorMatch ? colorMatch[1].trim() : '#e0e0e0',
  };
}

function extractAccent(styles) {
  const m = styles.join('\n').match(/\.accent\s*\{[^}]*color\s*:\s*([^;}]+)/);
  return m ? m[1].trim() : '#e94560';
}

const TIMESTAMP_ATTRS = /data-(appear|fade-out|highlight|viewport-at|tts-start)="([^"]+)"/g;

function extractTimestamps(dom, ttsCues) {
  const timestamps = [];
  const scan = (str) => {
    let m;
    const re = new RegExp(TIMESTAMP_ATTRS.source, 'g');
    while ((m = re.exec(str)) !== null) {
      const v = parseFloat(m[2]);
      if (!isNaN(v)) timestamps.push(v);
    }
  };
  scan(dom);
  for (const cue of ttsCues) scan(cue);
  return timestamps;
}

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function offsetTimestamps(str, offset) {
  return str.replace(
    new RegExp(TIMESTAMP_ATTRS.source, 'g'),
    (match, attr, val) => {
      const n = parseFloat(val);
      if (isNaN(n)) return match;
      return `data-${attr}="${(n + offset).toFixed(1)}"`;
    }
  );
}

function validateTimeline(timeline) {
  const issues = [];
  const scenes = timeline.scenes;

  if (scenes.length > 1 && scenes.every(s => s.start === 0)) {
    issues.push({ severity: 'error', type: 'all-zeros', message: 'All scenes have start=0. Timeline starts must be cumulative offsets (e.g. 0, 25, 50).' });
  }

  for (let i = 1; i < scenes.length; i++) {
    if (scenes[i].start < scenes[i - 1].start) {
      issues.push({ severity: 'error', type: 'non-monotonic', message: `Scene ${i} start (${scenes[i].start}s) is before scene ${i - 1} start (${scenes[i - 1].start}s). Starts must be monotonically increasing.` });
    } else if (scenes[i].start === scenes[i - 1].start && scenes.length > 1) {
      issues.push({ severity: 'error', type: 'duplicate-start', message: `Scenes ${i - 1} and ${i} both have start=${scenes[i].start}s. Each scene needs a unique start time.` });
    }
  }

  for (let i = 0; i < scenes.length - 1; i++) {
    const gap = scenes[i + 1].start - scenes[i].start;
    if (gap > 0 && gap < 3) {
      issues.push({ severity: 'warning', type: 'short-gap', message: `Gap between scene ${i} and ${i + 1} is only ${gap.toFixed(1)}s (< 3s minimum).` });
    } else if (gap > 300) {
      issues.push({ severity: 'warning', type: 'long-gap', message: `Gap between scene ${i} and ${i + 1} is ${gap.toFixed(0)}s (> 300s). Verify this is intentional.` });
    }
  }

  const lastStart = scenes[scenes.length - 1].start;
  if (lastStart + 5 > timeline.duration) {
    issues.push({ severity: 'warning', type: 'duration-tight', message: `Last scene starts at ${lastStart}s but total duration is ${timeline.duration}s. Scene has less than 5s.` });
  }

  return issues;
}

function checkTimestampCoherence(parsed, duration) {
  const issues = [];
  for (let i = 0; i < parsed.length; i++) {
    const scene = parsed[i];
    const windowEnd = i < parsed.length - 1 ? parsed[i + 1].start : duration;
    const timestamps = extractTimestamps(scene.dom, scene.ttsCues);
    if (timestamps.length === 0) continue;

    if (scene.start > 5) {
      const med = median(timestamps);
      if (med < scene.start * 0.5) {
        issues.push({ severity: 'error', type: 'scene-local', message: `Scene ${i} (${scene.file}) appears to use scene-local timestamps (median=${med.toFixed(1)}s) but starts at ${scene.start}s. Add ${scene.start}s to all timestamps in this scene.` });
      }
    }

    for (const t of timestamps) {
      if (t < scene.start - 1) {
        issues.push({ severity: 'warning', type: 'before-window', message: `Scene ${i} (${scene.file}): timestamp ${t.toFixed(1)}s is before scene start ${scene.start}s.` });
        break;
      }
    }
    for (const t of timestamps) {
      if (t > windowEnd + 5) {
        issues.push({ severity: 'warning', type: 'past-window', message: `Scene ${i} (${scene.file}): timestamp ${t.toFixed(1)}s extends well past scene window end ${windowEnd.toFixed(1)}s.` });
        break;
      }
    }

    const sceneWindow = windowEnd - scene.start;
    let estimatedAudio = 0;
    for (const cue of scene.ttsCues) {
      const textMatch = cue.match(/data-tts="([^"]*)"/);
      if (textMatch) {
        const words = textMatch[1].split(/\s+/).filter(w => w.length > 0).length;
        estimatedAudio += words / 2.5;
      }
    }
    if (estimatedAudio > 0 && estimatedAudio > sceneWindow + 5) {
      issues.push({ severity: 'warning', type: 'audio-overflow', message: `Scene ${i} (${scene.file}): estimated narration ~${estimatedAudio.toFixed(0)}s may exceed scene window ${sceneWindow.toFixed(0)}s. Shorten narration or increase scene duration.` });
    }
  }
  return issues;
}

function parseScene(filePath) {
  const html = readFileSync(filePath, 'utf-8');

  const headContent = extractBetween(html, '<head[^>]*>', '</head>');
  const bodyContent = extractBetween(html, '<body[^>]*>', '</body>');

  const styles = extractAll(headContent, '<style[^>]*>([\\s\\S]*?)</style>');
  const scripts = extractAll(bodyContent, '<script\\b(?![^>]*type=)[^>]*>([\\s\\S]*?)</script>');

  let dom = bodyContent.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').trim();

  const ttsCues = [];
  dom = dom.replace(/<div[^>]*data-tts="([^"]*)"[^>]*><\/div>/gi, (match) => {
    ttsCues.push(match);
    return '';
  });
  dom = dom.trim();

  return { styles, scripts, dom, ttsCues };
}

export function assembleScenes(timelinePath, outputPath, options = {}) {
  const timelineDir = dirname(resolve(timelinePath));
  const timeline = JSON.parse(readFileSync(timelinePath, 'utf-8'));

  if (!timeline.scenes || timeline.scenes.length === 0) {
    throw new Error('Timeline has no scenes');
  }
  if (!timeline.duration || timeline.duration <= 0) {
    throw new Error('Timeline missing or invalid duration');
  }

  const timelineIssues = validateTimeline(timeline);
  for (const issue of timelineIssues) {
    process.stderr.write(`  [${issue.severity.toUpperCase()}] ${issue.message}\n`);
  }

  const parsed = [];
  for (let i = 0; i < timeline.scenes.length; i++) {
    const entry = timeline.scenes[i];
    const filePath = resolve(timelineDir, entry.file);
    if (!existsSync(filePath)) {
      throw new Error(`Scene file not found: ${entry.file} (resolved: ${filePath})`);
    }
    process.stderr.write(`  Reading scene ${i + 1}/${timeline.scenes.length}: ${entry.file}\n`);
    parsed.push({ ...parseScene(filePath), start: entry.start, file: entry.file });
  }

  if (options.autoOffset) {
    for (let i = 0; i < parsed.length; i++) {
      if (parsed[i].start === 0) continue;
      const ts = extractTimestamps(parsed[i].dom, parsed[i].ttsCues);
      if (ts.length === 0) continue;
      const med = median(ts);
      if (med >= parsed[i].start * 0.5) {
        process.stderr.write(`  [WARNING] Scene ${i} (${parsed[i].file}): timestamps already appear chapter-global (median=${med.toFixed(1)}s, start=${parsed[i].start}s). Skipping auto-offset.\n`);
        continue;
      }
      process.stderr.write(`  Auto-offsetting scene ${i} (${parsed[i].file}) by +${parsed[i].start}s\n`);
      parsed[i].dom = offsetTimestamps(parsed[i].dom, parsed[i].start);
      parsed[i].ttsCues = parsed[i].ttsCues.map(cue => offsetTimestamps(cue, parsed[i].start));
    }
  }

  const coherenceIssues = checkTimestampCoherence(parsed, timeline.duration);
  for (const issue of coherenceIssues) {
    process.stderr.write(`  [${issue.severity.toUpperCase()}] ${issue.message}\n`);
  }

  const seenStyles = new Set();
  const uniqueStyles = [];
  const theme = extractThemeFromStyles(parsed[0].styles);
  const accent = extractAccent(parsed[0].styles);

  for (const scene of parsed) {
    for (const style of scene.styles) {
      const h = hashStr(style);
      if (!seenStyles.has(h)) {
        seenStyles.add(h);
        uniqueStyles.push(style);
      }
    }
  }

  const allTtsCues = parsed.flatMap(s => s.ttsCues).join('\n');

  const sceneDivs = parsed.map((s, i) => {
    let dom = s.dom.replace(/class="scene\s+active"/, 'class="scene"');
    if (i === 0) dom = dom.replace(/class="scene"/, 'class="scene active"');
    return `<!-- Scene ${i}: ${s.file} (${s.start}s) -->\n${dom}`;
  }).join('\n\n');

  const timesArray = parsed.map(s => Math.round(s.start * 1000));
  const switchScript = `const scenes = document.querySelectorAll('.scene');
const times = [${timesArray.join(', ')}];
times.forEach((t, i) => {
  setTimeout(() => {
    scenes.forEach(s => s.classList.remove('active'));
    scenes[i].classList.add('active');
  }, t);
});`;

  const perSceneScripts = parsed
    .filter(s => s.scripts.length > 0)
    .map((s, i) => `// Scene ${i}: ${s.file}\n(function() {\n${s.scripts.join('\n')}\n})();`)
    .join('\n\n');

  const mergedStyles = [...uniqueStyles, BOILERPLATE_CSS, `body { background:${theme.bg}; color:${theme.color} }`, `.accent { color:${accent} }`].join('\n');

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="claude-explains:duration" content="${timeline.duration}">
<style>
${mergedStyles}
</style>
</head><body>

${allTtsCues}

${sceneDivs}

<script>
${switchScript}

${perSceneScripts}
</script>
</body></html>`;

  writeFileSync(outputPath, html, 'utf-8');

  const allIssues = [...timelineIssues, ...coherenceIssues];
  return {
    output: outputPath,
    duration: timeline.duration,
    scene_count: parsed.length,
    size: html.length,
    validation: {
      issues: allIssues,
      has_errors: allIssues.some(i => i.severity === 'error'),
    },
  };
}
