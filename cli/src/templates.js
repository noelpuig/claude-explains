export function generateTemplate(name, options = {}) {
  const scenes = options.scenes || 5;
  const duration = options.duration || scenes * 20;

  switch (name) {
    case 'presentation': return presentationTemplate(scenes, duration);
    case 'narrated': return narratedTemplate(duration);
    default: throw new Error(`Unknown template: ${name}. Available: presentation, narrated`);
  }
}

export function listTemplates() {
  return [
    { name: 'presentation', description: 'Multi-scene presentation with scene switching, TTS cues, and narrator sync' },
    { name: 'narrated', description: 'Single continuous scene with timed text reveals and narration' },
  ];
}

function presentationTemplate(sceneCount, duration) {
  const sceneSeconds = Math.floor(duration / sceneCount);
  const sceneTimes = Array.from({ length: sceneCount }, (_, i) => i * sceneSeconds);

  let ttsHtml = '';
  let scenesHtml = '';

  scenesHtml += `
    <!-- Scene 0: Title -->
    <div class="scene active">
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
        <anim-text effect="fadeUp"><h1>TITLE HERE</h1></anim-text>
        <anim-text effect="fadeUp" delay="0.3"><p class="subtitle accent">Subtitle Here</p></anim-text>
        <anim-text effect="fadeUp" delay="0.5"><div class="divider"></div></anim-text>
        <anim-text effect="fadeUp" delay="0.7"><p class="secondary">Description</p></anim-text>
      </div>
    </div>\n`;
  ttsHtml += `  <div data-tts="NARRATION FOR TITLE SCENE" data-tts-start="${sceneTimes[0]}"></div>\n`;

  for (let i = 1; i < sceneCount - 1; i++) {
    const layouts = ['quote', 'compare', 'centered', 'timeline'];
    const layout = layouts[(i - 1) % layouts.length];
    let content = '';

    if (layout === 'quote') {
      content = `
      <anim-text effect="fadeUp"><p class="concept-num accent">CONCEPT ${i}</p></anim-text>
      <anim-text effect="fadeUp" delay="0.15"><h1>Topic Title</h1></anim-text>
      <anim-text effect="fadeUp" delay="0.3">
        <quote-block cite="Author">A relevant quote here.</quote-block>
      </anim-text>
      <anim-text effect="fadeUp" delay="0.6">
        <p>Key insight in one sentence. Use <span data-highlight="${sceneTimes[i] + 5}" style="font-weight:700">highlights</span> for key words.</p>
      </anim-text>`;
    } else if (layout === 'compare') {
      content = `
      <anim-text effect="fadeUp"><p class="concept-num accent">CONCEPT ${i}</p></anim-text>
      <anim-text effect="fadeUp" delay="0.15"><h1>Topic Title</h1></anim-text>
      <div data-appear="${sceneTimes[i] + 3}" style="margin-top:1.5em">
        <compare-grid>
          <compare-box type="bad" label="Before" value="OLD" delay="0.3">Description</compare-box>
          <compare-box type="good" label="After" value="NEW" delay="0.5">Description</compare-box>
        </compare-grid>
      </div>
      <anim-text effect="fadeUp" delay="0.8"><p style="margin-top:1.5em">Supporting insight.</p></anim-text>`;
    } else if (layout === 'centered') {
      content = `
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
        <anim-text effect="fadeUp"><p class="concept-num accent">CONCEPT ${i}</p></anim-text>
        <anim-text effect="scaleIn" delay="0.2"><h1 style="font-size:clamp(3rem,6vw,5rem)">Big Statement</h1></anim-text>
        <anim-text effect="fadeUp" delay="0.5"><div class="divider"></div></anim-text>
        <anim-text effect="fadeUp" delay="0.7"><p style="max-width:800px">Supporting text centered.</p></anim-text>
      </div>`;
    } else {
      content = `
      <anim-text effect="fadeUp"><p class="concept-num accent">CONCEPT ${i}</p></anim-text>
      <anim-text effect="fadeUp" delay="0.15"><h1>Topic Title</h1></anim-text>
      <div data-appear="${sceneTimes[i] + 2}" style="margin-top:1em">
        <time-line color="#e94560">
          <time-item year="Step 1" title="First Event" delay="0.3">Description</time-item>
          <time-item year="Step 2" title="Second Event" delay="0.5">Description</time-item>
          <time-item year="Step 3" title="Third Event" delay="0.7">Description</time-item>
        </time-line>
      </div>`;
    }

    scenesHtml += `
    <!-- Scene ${i} -->
    <div class="scene">${content}
    </div>\n`;
    ttsHtml += `  <div data-tts="NARRATION FOR SCENE ${i}" data-tts-start="${sceneTimes[i]}"></div>\n`;
  }

  scenesHtml += `
    <!-- Scene ${sceneCount - 1}: Closing -->
    <div class="scene">
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
        <anim-text effect="fadeUp"><h1>CLOSING TITLE</h1></anim-text>
        <anim-text effect="fadeUp" delay="0.3"><p>Summary statement.</p></anim-text>
        <anim-text effect="fadeUp" delay="0.5"><div class="divider"></div></anim-text>
        <anim-text effect="fadeUp" delay="0.7"><p class="secondary">Thank you</p></anim-text>
      </div>
    </div>\n`;
  ttsHtml += `  <div data-tts="NARRATION FOR CLOSING" data-tts-start="${sceneTimes[sceneCount - 1]}"></div>\n`;

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="claude-explains:duration" content="${duration}">
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body {
    width:1920px; height:1080px; overflow:hidden;
    background:#1a1a2e; color:#e0e0e0;
    font-family:system-ui,-apple-system,sans-serif;
  }
  .scene {
    position:absolute; inset:0; padding:60px 80px;
    display:flex; flex-direction:column;
    opacity:0; pointer-events:none;
  }
  .scene.active { opacity:1; pointer-events:auto }
  h1 { font-size:clamp(2.8rem,5vw,4.5rem); font-weight:700; margin-bottom:0.5em }
  p { font-size:clamp(1.4rem,2.2vw,1.8rem); line-height:1.5 }
  .subtitle { font-size:clamp(1.5rem,2.5vw,2rem); font-weight:600 }
  .secondary { opacity:0.7; font-size:clamp(1.1rem,1.6vw,1.3rem) }
  .accent { color:#e94560 }
  .concept-num { font-size:clamp(0.9rem,1.2vw,1.1rem); text-transform:uppercase; letter-spacing:3px; margin-bottom:0.5em }
  .divider { width:60px; height:3px; background:#e94560; margin:0.8em auto }
</style>
</head><body>

  <!-- TTS CUES (adjust data-tts-start after running --analyze --tts) -->
${ttsHtml}
  <!-- SCENES -->
${scenesHtml}
  <script>
    const scenes = document.querySelectorAll('.scene');
    const times = [${sceneTimes.join(', ')}].map(t => t * 1000);
    times.forEach((t, i) => {
      setTimeout(() => {
        scenes.forEach(s => s.classList.remove('active'));
        scenes[i].classList.add('active');
      }, t);
    });
  </script>
</body></html>`;
}

function narratedTemplate(duration) {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="claude-explains:duration" content="${duration}">
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body {
    width:1920px; height:1080px; overflow:hidden;
    background:#1a1a2e; color:#e0e0e0;
    font-family:system-ui,-apple-system,sans-serif;
  }
  .container {
    padding:80px 100px; height:100%;
    display:flex; flex-direction:column; justify-content:center;
  }
  h1 { font-size:clamp(3rem,6vw,5rem); font-weight:700; margin-bottom:0.8em }
  p { font-size:clamp(1.5rem,2.5vw,2rem); line-height:1.6 }
  .accent { color:#e94560 }
  .divider { width:60px; height:3px; background:#e94560; margin:1em 0 }
</style>
</head><body>

  <!-- TTS CUES -->
  <div data-tts="NARRATION PART ONE" data-tts-start="0"></div>
  <div data-tts="NARRATION PART TWO" data-tts-start="10"></div>

  <div class="container">
    <anim-text effect="fadeUp"><h1>Title</h1></anim-text>
    <anim-text effect="fadeUp" delay="0.3"><div class="divider"></div></anim-text>

    <anim-text effect="fadeUp" delay="0.5">
      <p>First paragraph of content with <span data-highlight="3.0" style="font-weight:700">highlighted keywords</span>.</p>
    </anim-text>

    <div data-appear="8.0" style="margin-top:2em">
      <anim-text effect="fadeUp">
        <p>Second section that <span data-appear="12.0">appears later</span>.</p>
      </anim-text>
    </div>

    <div data-appear="15.0" style="margin-top:2em">
      <quote-block cite="Author">A relevant quote that appears with narration.</quote-block>
    </div>
  </div>

</body></html>`;
}
