import { execFileSync, execSync, spawnSync } from 'child_process';
import { mkdtempSync, existsSync, unlinkSync, renameSync, readdirSync, rmdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const EXEC_TIMEOUT = 30000;

function findTTSEngine() {
  try { execFileSync('espeak-ng', ['--version'], { stdio: 'pipe' }); return 'espeak-ng'; } catch {}
  try { execFileSync('espeak', ['--version'], { stdio: 'pipe' }); return 'espeak'; } catch {}
  try { execSync('python3 -c "from gtts import gTTS"', { stdio: 'pipe', timeout: 5000 }); return 'gtts-python'; } catch {}
  try { execSync('gtts-cli --help', { stdio: 'pipe', timeout: 5000 }); return 'gtts-cli'; } catch {}
  return null;
}

function resolveEngine(preferred) {
  if (preferred === 'supertonic') {
    try {
      execSync('python3 -c "from supertonic import TTS"', { stdio: 'pipe', timeout: 10000 });
      return 'supertonic';
    } catch {
      throw new Error(
        'supertonic not installed. Install: pip install supertonic\n' +
        'Neural TTS model (~200MB) downloads automatically on first use.'
      );
    }
  }
  return findTTSEngine();
}

function mapSupertonicVoice(voice) {
  if (/^[MF]\d$/.test(voice)) return voice;
  return 'M1';
}

const TTS_QUALITY_PRESETS = {
  fast: 4,
  normal: 8,
  high: 16,
  ultra: 32,
};

function generateBatchSupertonic(texts, tempDir, voice, supertonicOpts = {}) {
  const scriptPath = join(dirname(fileURLToPath(import.meta.url)), 'supertonic_tts.py');
  const inputFile = join(tempDir, 'supertonic_input.json');

  const steps = TTS_QUALITY_PRESETS[supertonicOpts.quality] || TTS_QUALITY_PRESETS.normal;
  const speed = supertonicOpts.speed || 1.05;
  const model = supertonicOpts.model || 'supertonic-3';

  writeFileSync(inputFile, JSON.stringify({
    voice: mapSupertonicVoice(voice),
    model,
    total_steps: steps,
    speed,
    clips: texts.map((text, i) => ({
      text,
      output: join(tempDir, `clip_${i}.wav`)
    }))
  }));

  const stepsMultiplier = steps / 8;
  const timeout = 120000 + texts.length * 15000 * stepsMultiplier;
  const result = spawnSync('python3', [scriptPath, inputFile], {
    encoding: 'utf-8',
    timeout,
    stdio: ['ignore', 'pipe', 'inherit']
  });

  if (result.error) {
    throw new Error(`Supertonic TTS failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error('Supertonic TTS failed (non-zero exit)');
  }

  const stdout = (result.stdout || '').trim();
  if (!stdout) {
    throw new Error('Supertonic TTS returned no output');
  }
  return JSON.parse(stdout);
}

function getAudioDuration(filePath) {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 }
    );
    return parseFloat(out.trim());
  } catch {
    return 0;
  }
}

function generateClip(engine, text, outputPath, voice, rate) {
  const safeText = text.replace(/'/g, "\\'").replace(/\$/g, '\\$').replace(/`/g, '\\`');

  switch (engine) {
    case 'espeak-ng':
      execFileSync('espeak-ng', ['-v', voice, '-s', String(rate), '-w', outputPath, text], { timeout: EXEC_TIMEOUT });
      break;
    case 'espeak':
      execFileSync('espeak', ['-v', voice, '-s', String(rate), '-w', outputPath, text], { timeout: EXEC_TIMEOUT });
      break;
    case 'gtts-python': {
      const mp3Path = outputPath.replace(/\.wav$/, '.mp3');
      const textFile = join(dirname(outputPath), 'text.txt');
      writeFileSync(textFile, text);
      execSync(
        `python3 -c "from gtts import gTTS; gTTS(open('${textFile}').read(), lang='${voice.slice(0, 2)}').save('${mp3Path}')"`,
        { timeout: EXEC_TIMEOUT, stdio: 'pipe' }
      );
      execSync(`ffmpeg -y -i "${mp3Path}" -ar 44100 -ac 1 "${outputPath}"`, { stdio: 'pipe', timeout: EXEC_TIMEOUT });
      try { unlinkSync(mp3Path); } catch {}
      try { unlinkSync(textFile); } catch {}
      break;
    }
    case 'gtts-cli': {
      const mp3Path = outputPath.replace(/\.wav$/, '.mp3');
      const textFile = join(dirname(outputPath), 'text.txt');
      writeFileSync(textFile, text);
      execFileSync('gtts-cli', ['-f', textFile, '-l', voice.slice(0, 2), '-o', mp3Path], { timeout: EXEC_TIMEOUT, stdio: 'pipe' });
      execSync(`ffmpeg -y -i "${mp3Path}" -ar 44100 -ac 1 "${outputPath}"`, { stdio: 'pipe', timeout: EXEC_TIMEOUT });
      try { unlinkSync(mp3Path); } catch {}
      try { unlinkSync(textFile); } catch {}
      break;
    }
    default:
      throw new Error('No TTS engine available. Install espeak-ng or gtts (pip install gtts).');
  }
}

export function calculateTTSTimeline(cues, clipDurations) {
  const timeline = [];
  let currentEnd = 0;

  for (let i = 0; i < cues.length; i++) {
    const requestedStart = cues[i].start;
    const audioDuration = clipDurations[i] || 0;
    const adjustedStart = Math.max(requestedStart, currentEnd);
    const adjustedEnd = adjustedStart + audioDuration;
    const hasOverlap = requestedStart < currentEnd && i > 0;
    const overlapSeconds = hasOverlap ? currentEnd - requestedStart : 0;

    const words = cues[i].text.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const wordsPerSecond = audioDuration > 0 ? wordCount / audioDuration : 0;
    const charLengths = words.map(w => Math.max(w.length, 1));
    const totalChars = charLengths.reduce((a, b) => a + b, 0);
    let charCum = 0;
    const wordTimestamps = words.map((word, wi) => {
      const wordStart = adjustedStart + (audioDuration * (charCum / totalChars));
      charCum += charLengths[wi];
      return { word, time: Math.round(wordStart * 1000) / 1000 };
    });

    const pauseAfter = cues[i].pause_after ?? 0.15;

    timeline.push({
      index: i,
      text: cues[i].text,
      requested_start: requestedStart,
      audio_duration: Math.round(audioDuration * 1000) / 1000,
      requested_end: Math.round((requestedStart + audioDuration) * 1000) / 1000,
      adjusted_start: Math.round(adjustedStart * 1000) / 1000,
      adjusted_end: Math.round(adjustedEnd * 1000) / 1000,
      overlap_detected: hasOverlap,
      overlap_seconds: Math.round(overlapSeconds * 1000) / 1000,
      word_count: wordCount,
      words_per_second: Math.round(wordsPerSecond * 10) / 10,
      word_timestamps: wordTimestamps,
      pause_after: pauseAfter,
      long_cue_warning: wordCount > 120
        ? `Cue ${i} has ${wordCount} words (max recommended: 120). Split into shorter cues for better narrator sync accuracy.`
        : undefined,
    });

    currentEnd = adjustedEnd + pauseAfter;
  }

  const totalSpeech = clipDurations.reduce((a, b) => a + b, 0);
  const suggestedDuration = timeline.length > 0
    ? Math.ceil(timeline[timeline.length - 1].adjusted_end + 1)
    : 0;

  return {
    cues: timeline,
    total_speech_duration: Math.round(totalSpeech * 1000) / 1000,
    suggested_minimum_duration: suggestedDuration,
    has_overlaps: timeline.some(c => c.overlap_detected),
    overlap_warnings: timeline
      .filter(c => c.overlap_detected)
      .map(c => `Cue ${c.index} ("${c.text.slice(0, 30)}...") requested at ${c.requested_start}s but previous audio ends at ${c.adjusted_start}s (shifted +${c.overlap_seconds}s)`),
    long_cue_warnings: timeline
      .filter(c => c.word_count > 120)
      .map(c => `Cue ${c.index} has ${c.word_count} words (${c.audio_duration}s). Split at sentence boundaries for better sync.`),
  };
}

export async function generateTTSWithTimeline(cues, duration, options = {}) {
  if (!cues || cues.length === 0) return { audioPath: null, timeline: null };

  const { voice = 'en', rate = 175, engine: preferredEngine, model: ttsModel, quality: ttsQuality, speed: ttsSpeed } = options;

  let engine;
  try {
    engine = resolveEngine(preferredEngine);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    return { audioPath: null, timeline: null };
  }
  if (!engine) {
    process.stderr.write('Warning: No TTS engine found. Install espeak-ng, gtts, or supertonic. Skipping TTS.\n');
    return { audioPath: null, timeline: null };
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'claude-explains-tts-'));

  const clips = [];
  const clipDurations = [];

  if (engine === 'supertonic') {
    const superVoice = mapSupertonicVoice(voice);
    process.stderr.write(`TTS engine: supertonic (voice: ${superVoice}), generating ${cues.length} clip(s)...\n`);
    try {
      const batch = generateBatchSupertonic(cues.map(c => c.text), tempDir, voice, { model: ttsModel, quality: ttsQuality, speed: ttsSpeed });
      for (let i = 0; i < cues.length; i++) {
        const dur = batch[i] ? batch[i].duration : 0;
        clipDurations.push(dur);
        if (dur > 0) {
          clips.push({ path: join(tempDir, `clip_${i}.wav`), start: cues[i].start });
        }
      }
    } catch (err) {
      process.stderr.write(`  Error: ${err.message}\n`);
      return { audioPath: null, timeline: null };
    }
  } else {
    process.stderr.write(`TTS engine: ${engine}, generating ${cues.length} clip(s)...\n`);
    for (let i = 0; i < cues.length; i++) {
      const clipPath = join(tempDir, `clip_${i}.wav`);
      try {
        process.stderr.write(`  Clip ${i + 1}/${cues.length}: "${cues[i].text.slice(0, 50)}..."\n`);
        generateClip(engine, cues[i].text, clipPath, voice, rate);
        if (existsSync(clipPath)) {
          const dur = getAudioDuration(clipPath);
          clips.push({ path: clipPath, start: cues[i].start });
          clipDurations.push(dur);
          process.stderr.write(`    Duration: ${dur.toFixed(2)}s\n`);
        } else {
          clipDurations.push(0);
        }
      } catch (err) {
        process.stderr.write(`  Warning: TTS failed for cue ${i}: ${err.message}\n`);
        clipDurations.push(0);
      }
    }
  }

  const timeline = calculateTTSTimeline(cues, clipDurations);

  if (timeline.has_overlaps) {
    process.stderr.write(`  Overlap detected! Adjusting timing:\n`);
    for (const w of timeline.overlap_warnings) {
      process.stderr.write(`    - ${w}\n`);
    }
  }

  if (clips.length === 0) {
    for (const f of readdirSync(tempDir)) {
      try { unlinkSync(join(tempDir, f)); } catch {}
    }
    try { rmdirSync(tempDir); } catch {}
    return { audioPath: null, timeline };
  }

  const outputPath = join(tempDir, 'tts_combined.wav');
  const adjustedCues = timeline.cues.filter(c => clipDurations[c.index] > 0);

  if (adjustedCues.length === 1) {
    const delayMs = Math.round(adjustedCues[0].adjusted_start * 1000);
    execSync(
      `ffmpeg -y -i "${clips[0].path}" ` +
      `-af "adelay=${delayMs}|${delayMs},apad=whole_dur=${duration}" ` +
      `-ar 44100 -ac 2 -t ${duration} "${outputPath}"`,
      { stdio: 'pipe', timeout: EXEC_TIMEOUT }
    );
  } else {
    const silenceDur = Math.max(duration, timeline.suggested_minimum_duration);
    const inputs = [
      `-f lavfi -t ${silenceDur} -i "anullsrc=channel_layout=stereo:sample_rate=44100"`,
      ...clips.map(c => `-i "${c.path}"`)
    ].join(' ');

    const filters = [];
    let prevLabel = '0:a';
    for (let i = 0; i < adjustedCues.length; i++) {
      const delayMs = Math.round(adjustedCues[i].adjusted_start * 1000);
      const inputIdx = i + 1;
      const outLabel = `out${i}`;
      filters.push(`[${inputIdx}:a]adelay=${delayMs}|${delayMs},apad[d${i}]`);
      filters.push(`[${prevLabel}][d${i}]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[${outLabel}]`);
      prevLabel = outLabel;
    }

    const lastFilter = filters[filters.length - 1];
    const lastLabel = prevLabel;
    filters[filters.length - 1] = lastFilter.replace(`[${lastLabel}]`, '');

    execSync(
      `ffmpeg -y ${inputs} -filter_complex "${filters.join(';')}" ` +
      `-ar 44100 -ac 2 -t ${duration} "${outputPath}"`,
      { stdio: 'pipe', timeout: 60000 }
    );
  }

  const hasOutput = existsSync(outputPath);
  return {
    audioPath: hasOutput ? outputPath : null,
    timeline,
  };
}

export async function analyzeTTSOnly(cues, options = {}) {
  if (!cues || cues.length === 0) return { timeline: null, engine: null };

  const { voice = 'en', rate = 175, engine: preferredEngine, model: ttsModel, quality: ttsQuality, speed: ttsSpeed } = options;

  let engine;
  try {
    engine = resolveEngine(preferredEngine);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    return { timeline: null, engine: null };
  }
  if (!engine) return { timeline: null, engine: null };

  const tempDir = mkdtempSync(join(tmpdir(), 'claude-explains-tts-'));

  const clipDurations = [];
  if (engine === 'supertonic') {
    try {
      const batch = generateBatchSupertonic(cues.map(c => c.text), tempDir, voice, { model: ttsModel, quality: ttsQuality, speed: ttsSpeed });
      for (let i = 0; i < cues.length; i++) {
        clipDurations.push(batch[i] ? batch[i].duration : 0);
      }
    } catch (err) {
      process.stderr.write(`  Error: ${err.message}\n`);
      for (let i = 0; i < cues.length; i++) clipDurations.push(0);
    }
  } else {
    for (let i = 0; i < cues.length; i++) {
      const clipPath = join(tempDir, `clip_${i}.wav`);
      try {
        generateClip(engine, cues[i].text, clipPath, voice, rate);
        clipDurations.push(existsSync(clipPath) ? getAudioDuration(clipPath) : 0);
      } catch {
        clipDurations.push(0);
      }
    }
  }

  for (const f of readdirSync(tempDir)) {
    try { unlinkSync(join(tempDir, f)); } catch {}
  }
  try { rmdirSync(tempDir); } catch {}

  return {
    timeline: calculateTTSTimeline(cues, clipDurations),
    engine,
  };
}

export async function generateFromScript(scriptPath, options = {}) {
  const { readFileSync: readF } = await import('fs');
  const script = JSON.parse(readF(scriptPath, 'utf-8'));
  if (!Array.isArray(script) || script.length === 0) {
    throw new Error('TTS script must be a JSON array of {text, pause_after?} objects');
  }

  const { voice = 'en', rate = 175, engine: preferredEngine, model: ttsModel, quality: ttsQuality, speed: ttsSpeed } = options;

  let engine;
  try {
    engine = resolveEngine(preferredEngine);
  } catch (err) {
    throw new Error(err.message);
  }
  if (!engine) throw new Error('No TTS engine found. Install espeak-ng, gtts, or supertonic.');

  const tempDir = mkdtempSync(join(tmpdir(), 'claude-explains-tts-'));

  process.stderr.write(`TTS-first mode: ${engine}${engine === 'supertonic' ? ' (voice: ' + mapSupertonicVoice(voice) + ')' : ''}, generating ${script.length} clip(s)...\n`);

  const cues = [];
  const clipDurations = [];
  let currentTime = 0;

  if (engine === 'supertonic') {
    const batch = generateBatchSupertonic(script.map(s => s.text), tempDir, voice, { model: ttsModel, quality: ttsQuality, speed: ttsSpeed });
    for (let i = 0; i < script.length; i++) {
      const dur = batch[i] ? batch[i].duration : 0;
      clipDurations.push(dur);
      cues.push({ text: script[i].text, start: currentTime, pause_after: script[i].pause_after });
      process.stderr.write(`    Start: ${currentTime.toFixed(2)}s, Duration: ${dur.toFixed(2)}s\n`);
      currentTime += dur + (script[i].pause_after ?? 0.5);
    }
  } else {
    for (let i = 0; i < script.length; i++) {
      const item = script[i];
      const clipPath = join(tempDir, `clip_${i}.wav`);
      process.stderr.write(`  Clip ${i + 1}/${script.length}: "${item.text.slice(0, 50)}"\n`);
      generateClip(engine, item.text, clipPath, voice, rate);

      const dur = existsSync(clipPath) ? getAudioDuration(clipPath) : 0;
      clipDurations.push(dur);
      cues.push({ text: item.text, start: currentTime, pause_after: item.pause_after });
      process.stderr.write(`    Start: ${currentTime.toFixed(2)}s, Duration: ${dur.toFixed(2)}s\n`);
      currentTime += dur + (item.pause_after ?? 0.5);
    }
  }

  const timeline = calculateTTSTimeline(cues, clipDurations);
  const totalDuration = Math.ceil(currentTime + 1);

  const validClips = cues.map((c, i) => ({ path: join(tempDir, `clip_${i}.wav`), start: c.start }))
    .filter((_, i) => clipDurations[i] > 0);

  const outputPath = join(tempDir, 'tts_combined.wav');

  const adjustedCuesFS = timeline.cues.filter(c => clipDurations[c.index] > 0);
  if (validClips.length === 1) {
    const delayMs = Math.round(adjustedCuesFS[0].adjusted_start * 1000);
    execSync(
      `ffmpeg -y -i "${validClips[0].path}" -af "adelay=${delayMs}|${delayMs},apad=whole_dur=${totalDuration}" -ar 44100 -ac 2 -t ${totalDuration} "${outputPath}"`,
      { stdio: 'pipe', timeout: EXEC_TIMEOUT }
    );
  } else if (validClips.length > 1) {
    const silenceDur = totalDuration;
    const inputs = [`-f lavfi -t ${silenceDur} -i "anullsrc=channel_layout=stereo:sample_rate=44100"`, ...validClips.map(c => `-i "${c.path}"`)].join(' ');
    const adjustedCues = timeline.cues.filter(c => clipDurations[c.index] > 0);
    const filters = [];
    let prevLabel = '0:a';
    for (let i = 0; i < adjustedCues.length; i++) {
      const delayMs = Math.round(adjustedCues[i].adjusted_start * 1000);
      filters.push(`[${i + 1}:a]adelay=${delayMs}|${delayMs},apad[d${i}]`);
      filters.push(`[${prevLabel}][d${i}]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out${i}]`);
      prevLabel = `out${i}`;
    }
    filters[filters.length - 1] = filters[filters.length - 1].replace(`[${prevLabel}]`, '');
    execSync(`ffmpeg -y ${inputs} -filter_complex "${filters.join(';')}" -ar 44100 -ac 2 -t ${totalDuration} "${outputPath}"`, { stdio: 'pipe', timeout: 60000 });
  }

  return {
    audioPath: existsSync(outputPath) ? outputPath : null,
    timeline,
    suggested_duration: totalDuration,
  };
}

export function cleanupTTS(audioPath) {
  if (!audioPath) return;
  try {
    const dir = join(audioPath, '..');
    for (const f of readdirSync(dir)) {
      try { unlinkSync(join(dir, f)); } catch {}
    }
    try { rmdirSync(dir); } catch {}
  } catch {}
}
