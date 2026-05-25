import { resolve, dirname } from 'path';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { peekConfig, analyzeHTML, previewFrame, renderFrames, renderStoryboard, renderPDF, bundleHTML, renderReview, validateHTML } from './renderer.js';
import { assembleScenes } from './assembler.js';
import { createEncoder } from './encoder.js';
import { generateTTSWithTimeline, analyzeTTSOnly, generateFromScript, cleanupTTS } from './tts.js';
import { generateTemplate, listTemplates } from './templates.js';

function printHelp() {
  const help = `
claude-explains - Render HTML/CSS/JS animations to video with TTS narration
Designed for autonomous LLM agent video generation pipelines.

** IMPORTANT: If you are an LLM agent generating a video:
   1. Read --help-design FIRST — mandatory visual rules, animation quality, color rules
   2. Read --help-format — scene models, narrator sync, continuity rules
   3. Read --help-components — built-in tags + diagram annotation patterns
   4. Run --analyze --tts before rendering to get exact audio durations
   5. Run --validate to catch errors, then --storyboard to visually self-check
   6. NEVER render the final video without checking the storyboard first

   YOU ARE MAKING AN ANIMATED VIDEO, NOT SLIDES.
   - Every scene must have >=8 data-appear events staggered over time
   - Every scene must have >=3 data-highlight events synced to narrator words
   - Diagram elements start GREY and only highlight when the narrator mentions them
   - If screenshots at different timestamps look the same, the scene is STATIC and wrong
   Read --help-design 'ANIMATION QUALITY' — this is the most important section. **

USAGE
  claude-explains <input> [options]
  Input accepts HTML or SVG files. SVG files are auto-wrapped for preview.

MODES
  (default)              Render HTML to video
  --analyze              Analyze HTML + TTS timing. Outputs JSON with animation
                         info, TTS audio durations, overlap detection, and
                         suggested timing. ALWAYS RUN THIS FIRST before rendering.
  --preview <seconds>    Render a single frame at the given time (outputs PNG).
  --storyboard <n>       N frames composited into one grid image.
  --validate             Pre-render lint: font sizes, contrast, sync timestamps,
                         animation quality (appear count, highlight count,
                         fade-out matching, timestamp spread, overlay count).
  --review               Interactive HTML preview with play controls,
                         annotation tools, TTS subtitles.
  --assemble <timeline>  Assemble per-scene HTML files into one playable
                         document using a timeline JSON. Validates timestamps
                         and detects scene-local/chapter-global mismatches.
  --tts-first <script>   Generate TTS audio before HTML exists, return exact
                         timestamps. Script is JSON array of {text, pause_after}.
  --template <name>      Scaffold ready-to-fill HTML (presentation, narrated).
  --pdf <output.pdf>     Export scenes as static PDF pages.
  --html-bundle          Self-contained HTML with all resources as base64.
  --help                 Show this help
  --help-components      Built-in component tags: bar-chart, combo-chart,
                         scatter-chart, stat-grid, time-line, compare-grid,
                         quote-block, anim-text. USE THESE instead of writing
                         chart/component JS from scratch.
  --help-design          Design rules: theming, 60-30-10 color rule, contrast,
                         typography, spacing, animation. MANDATORY reading.
  --help-format          HTML scene structure, boilerplate, scene switching,
                         TTS sync workflow, chapter-global timestamps, assembly.

RENDER OPTIONS
  -o, --output <file>    Output video file (default: output.mp4)
  --width <px>           Video width (default: 1920)
  --height <px>          Video height (default: 1080)
  --fps <n>              Frames per second (default: 30)
  -d, --duration <sec>   Duration in seconds (auto-detect from HTML meta, or 10)
  --no-components        Disable auto-injected component library

TTS OPTIONS
  --tts                  Enable text-to-speech voiceover
  --tts-engine <name>    TTS engine: auto (default) or supertonic
                         auto: uses espeak-ng or gtts (whatever is installed)
                         supertonic: high-quality local neural TTS (offline)
                           Install: pip install supertonic
                           Models download on first use
  --tts-voice <voice>    Voice selection (default: en)
                         For auto/espeak/gtts: language code (en, es, fr...)
                         For supertonic: M1-M5 (male), F1-F5 (female)
  --tts-model <name>     Supertonic model (default: supertonic-3)
                         supertonic: English-only v1, fastest, smallest
                         supertonic-2: multilingual v2, fast
                         supertonic-3: multilingual v3, best quality
  --tts-quality <level>  Supertonic synthesis quality (default: normal)
                         fast: 4 diffusion steps — quick drafts
                         normal: 8 steps — good balance (default)
                         high: 16 steps — cleaner audio, 2x slower
                         ultra: 32 steps — best quality, 4x slower
  --tts-speed <n>        Supertonic speech speed multiplier (default: 1.05)
                         Lower = slower speech, higher = faster
  --tts-rate <n>         Speaking rate for espeak (default: 175)

ASSEMBLY OPTIONS
  --auto-offset          With --assemble: auto-add scene start offsets to all
                         timestamps. Safety net for scene-local timestamps.
                         Skips scenes already at chapter-global (no double-offset).
  --template-scenes <n>  Number of scenes for --template (default: 5)

ENCODING OPTIONS
  --codec <name>         Video codec (default: libx264)
  --quality <preset>     Encoding preset (default: medium)

TTS MARKUP (place anywhere in HTML body)
  <div data-tts="Narration text" data-tts-start="2.5"></div>
  <meta name="claude-explains:duration" content="10">

NARRATOR SYNC EFFECTS (use with data-appear and data-highlight)
  data-highlight-effect   Highlight animation: color (default), underline,
                          marker, glow, box. See --help-format for details.
  data-appear-effect      Entrance animation: fade (default), fadeUp, fadeDown,
                          fadeLeft, fadeRight, scaleIn, popIn, flipIn, revealDown

LLM AGENT WORKFLOW — follow these steps in order:
  1. Read --help-design for rules, --help-components for available tags
  2. Write HTML using built-in components + TTS cues (estimate timing)
  3. claude-explains input.html --analyze --tts
     → Parse the JSON output. Read tts.cues[].audio_duration for each clip.
     → Read tts.suggested_minimum_duration for required video length.
     → Read tts.cues[].adjusted_start for overlap-corrected start times.
  4. Update HTML: set duration meta, adjust data-tts-start values to match
     adjusted_start from step 3, add data-appear/data-highlight using
     word_timestamps, time animations to TTS boundaries
  5. claude-explains input.html --validate → fix ALL errors before proceeding
  6. claude-explains input.html --storyboard 9 -o storyboard
     → INSPECT the storyboard image. Check: text readable? theme correct?
       content visible? narrator sync used? layout varied? scenes switch?
     → If ANY issue found: fix HTML, re-storyboard, re-check.
     → See --help-format "MANDATORY STORYBOARD SELF-CHECK" for full list.
  7. ONLY after storyboard passes: render final video
     claude-explains input.html -o final.mp4 --tts -d <suggested_duration>

  ** RENDER WARNING — SEQUENTIAL ONLY **
  Each render spawns Chromium + TTS engine + FFmpeg. A single render uses
  ~500MB RAM. Do NOT launch parallel renders — they will crash. Render one
  chapter at a time, verify each output has audio (ffprobe), then continue.
  NEVER remove --tts flags to work around a failure. A silent video is a
  failed video. If a render times out, the cause is resource pressure —
  wait and retry, do not drop features.

ANALYZE OUTPUT KEY FIELDS
  tts.cues[].audio_duration       Actual seconds of generated speech
  tts.cues[].adjusted_start       Start time after overlap prevention
  tts.cues[].adjusted_end         End time after overlap prevention
  tts.cues[].word_timestamps[]    Per-word timing: [{word, time}, ...]
  tts.cues[].word_count           Words in this cue
  tts.cues[].long_cue_warning     Warning if cue exceeds 120 words
  tts.suggested_minimum_duration   Minimum video duration to fit all speech
  tts.total_speech_duration       Total audio duration across all cues
  tts.has_overlaps                 True if any cue was shifted for overlap
  tts.overlap_warnings[]          Human-readable overlap descriptions
  tts.long_cue_warnings[]         Cues exceeding 120 words (split these)
  animations[]                    Detected CSS/JS animations with durations
  canvases[]                      Canvas elements detected
`;
  console.log(help);
}

function printComponentHelp() {
  console.log(`
BUILT-IN COMPONENTS (auto-injected, no <script> needed)

Components are split into two categories. Choose based on content type.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DATA CHARTS — ONLY for real, measured, numerical data
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 ** IMPORTANT: NEVER use charts to visualize abstract concepts, opinions,
    or qualitative ideas. Charts are EXCLUSIVELY for quantitative data
    that was measured, counted, or calculated. If the numbers don't come
    from a real data source, DO NOT use a chart. Use narrative components
    (quote-block, compare-grid, time-line, anim-text) instead.

    WRONG: bar-chart with data like "Ambition: 90, Caution: 30" (fabricated)
    RIGHT: bar-chart with data like "Q1 Revenue: $1.2M, Q2: $1.8M" (real)

    Ask yourself: "Could someone verify these numbers?" If no, don't chart it. **

  BAR CHART — categorical data comparison
    <bar-chart
      data='[{"label":"Q1","value":300},{"label":"Q2","value":450}]'
      colors="#0f3460,#e94560,#16c79a">
    </bar-chart>

  COMBO CHART — two related metrics over same categories (bar + line)
    <combo-chart
      data='[{"label":"Jan","bar":300,"line":120},{"label":"Feb","bar":450,"line":350}]'
      bar-color="#0f3460" line-color="#e94560">
    </combo-chart>

  SCATTER CHART — correlation between two measured variables
    <scatter-chart
      data='[{"x":10,"y":15},{"x":25,"y":35},{"x":40,"y":55}]'
      color="#e94560" regression x-label="Cost" y-label="Revenue">
    </scatter-chart>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NARRATIVE & LAYOUT — for concepts, arguments, comparisons, structure
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  These are the primary components for most presentations. Use them to
  convey ideas, structure arguments, show contrasts, and display quotes.

  STAT GRID — key metrics or highlighted values (use real figures only)
    <stat-grid cols="3">
      <stat-box value="42%" label="Conversion" color="#e94560"></stat-box>
      <stat-box value="$1.2M" label="Revenue" color="#0f3460" delay="0.15"></stat-box>
    </stat-grid>

  TIMELINE — chronological events or sequential steps
    <time-line>
      <time-item year="2020" title="Founded">Started the company</time-item>
      <time-item year="2022" title="Series A" delay="0.2">Raised funding</time-item>
    </time-line>

  COMPARISON — contrasting two states, sides, or viewpoints
    <compare-grid>
      <compare-box type="bad" label="Before" value="2.3s">Slow load</compare-box>
      <compare-box type="good" label="After" value="0.4s" delay="0.2">Fast</compare-box>
    </compare-grid>

  QUOTE — attributed quotation
    <quote-block cite="Steve Jobs">Stay hungry, stay foolish.</quote-block>

  ANIMATED TEXT — wrap any content with an entrance animation
    <anim-text effect="fadeUp" delay="0.3">This text animates in</anim-text>
    Effects: fadeUp, fadeDown, fadeLeft, fadeRight, scaleIn, popIn, flipIn, revealDown

COMPONENT ATTRIBUTES
  delay="0.3"     Animation delay in seconds (stagger with 0.12s increments)
  effect="popIn"  Animation effect (stat-box: popIn, time-item: fadeLeft)
  colors="..."    Comma-separated hex colors for chart data series

NARRATOR SYNC EFFECTS (use on any element with data-appear or data-highlight)
  Highlight effects (data-highlight-effect="..."):
    color      Default. Animated accent color shift + glow
    underline  Line draws left-to-right under text
    marker     Translucent highlighter pen sweep across background
    glow       Text-shadow pulses bright then softens
    box        Rounded accent-tinted box behind text

  Appear effects (data-appear-effect="..."):
    fade       Default. Simple opacity fade-in
    fadeUp     Slide up while fading in
    fadeDown   Slide down while fading in
    fadeLeft   Slide in from left
    fadeRight  Slide in from right
    scaleIn    Scale from 80% to 100%
    popIn      Bouncy scale entrance
    flipIn     3D Y-axis rotation reveal
    revealDown Clip-path reveal top to bottom

  Example:
    <span data-highlight="14.2" data-highlight-effect="underline">key term</span>
    <div data-appear="22.0" data-appear-effect="popIn">content</div>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DIAGRAM ANNOTATION PATTERNS — for canvas scenes (manual, not tags)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  These are NOT built-in component tags. Copy the code templates below
  and adjust coordinates. Use inside canvas scenes (--help-format).

  VIEWPORT-FRAME PATTERN — camera zoom/pan on a diagram wrapper
    ** RECOMMENDED: Use data-viewport-focus to zoom to specific elements.
    No math needed — the CLI auto-centers the element in the frame. **

    <!-- Zoom to a specific element (PREFERRED): -->
    <div data-viewport="canvas-01" data-viewport-at="5"
         data-viewport-focus="#server-component" data-viewport-scale="2.5"
         data-viewport-duration="1.5"></div>
    <div data-viewport="canvas-01" data-viewport-at="12"
         data-viewport-focus="#database-component" data-viewport-scale="3"
         data-viewport-duration="1.2"></div>
    <div data-viewport="canvas-01" data-viewport-at="20"
         data-viewport-transform="scale(1)" data-viewport-duration="2"></div>

    Use data-viewport-focus for zooming into specific components.
    Use data-viewport-transform="scale(1)" to zoom back out to full view.
    See --help-format 'VIEWPORT TRANSFORMS' for full attribute reference.

  CALLOUT-LABEL PATTERN — text label connected by line to diagram point
    Use when inline labels would be too small or would overlap.
    Place inside the text overlay layer (position:absolute over diagram).

    <svg style="position:absolute;inset:0;pointer-events:none;overflow:visible"
         viewBox="0 0 1920 1080">
      <line x1="350" y1="200" x2="600" y2="80"
            stroke="#e94560" stroke-width="2"/>
      <circle cx="350" cy="200" r="4" fill="#e94560"/>
      <text x="610" y="85" fill="#e94560" font-size="20" font-weight="600">
        SYN packet
      </text>
    </svg>

  FOCUS-REGION PATTERN — dim everything outside a target rectangle
    Draws attention to a specific part of the diagram.

    <svg data-appear="T" data-fade-out="T+6"
         style="position:absolute;inset:0;pointer-events:none;z-index:100"
         viewBox="0 0 1920 1080">
      <defs>
        <mask id="focus-01">
          <rect width="1920" height="1080" fill="white"/>
          <rect x="200" y="100" width="400" height="300" fill="black" rx="8"/>
        </mask>
      </defs>
      <rect width="1920" height="1080" fill="rgba(0,0,0,0.6)"
            mask="url(#focus-01)"/>
    </svg>

NOTES
  - Components auto-inject CSS + JS via the renderer. No imports needed.
  - All animations work with deterministic frame capture.
  - Use --no-components to disable if writing your own from scratch.
  - Data attributes use JSON. Wrap values in single quotes in HTML.
  - Diagram patterns above are manual CSS/SVG. No component tag needed.
  - Canvas scenes have different rules from slide scenes. See --help-format.
`);
}

function printDesignHelp() {
  console.log(`
VISUAL DESIGN RULES — read BEFORE writing any HTML

** MANDATORY. FOUR CRITICAL RULES before you read anything else:
   1. Diagrams start large (fill viewport), can zoom out to make room for text
   2. Every data-appear MUST have a matching data-fade-out
   3. Max 8 words per text overlay, max 3 overlays visible at once
   4. NEVER just increase font-size to fix small text — see FIX HIERARCHY **

━━━━ THEME: PICK ONE, STICK TO IT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  DARK (default):  body { background:#1a1a2e; color:#e0e0e0 }
                   .accent { color:#e94560 }
  LIGHT:           body { background:#f5f5f5; color:#1a1a2e }
                   .accent { color:#2563eb }

  Components auto-detect the body background. Just set body correctly.

  ** CRITICAL: NEVER use saturated colors for the background. **
  Saturated purple, blue, green, or red backgrounds compete with the
  content for the viewer's attention. Backgrounds must be NEUTRAL:
    GOOD: near-black (#1a1a2e, #111, #0d0d0d), near-white (#f5f5f5, #fafafa),
          very light pastels (#f0f4f8, #faf5f0), dark grays (#1e1e2e, #222)
    BAD:  saturated blue (#1a3a8e), purple (#4a1a6e), teal (#0a4a4a),
          any hue clearly visible in the background
  The background is a CANVAS — it should disappear. All color attention
  belongs to the accent and the content.

━━━━ COLOR: THE 60-30-10 RULE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  60% background, 30% text, 10% ONE accent color.
  - Pick ONE accent. Define as .accent { color:X }
  - Accent is for: data-highlight moments ONLY — the brief flash when
    the narrator mentions something. It is NOT a permanent element color.
  - NEVER use multiple saturated colors as permanent fills on diagram elements
  - NEVER draw diagrams with red, blue, green fills from the start
  - Diagram elements should start GREY/MUTED (any unsaturated grey shades —
    use different greys for visual hierarchy between components) and ONLY
    highlight to accent color when the narrator discusses them, then
    fade back to grey when the narrator moves on
  - NEVER use the accent on more than ~10% of visible elements at once

  WRONG: SVG with <rect fill="#dc2626"/> and <rect fill="#2563eb"/>
         Two saturated colors competing. Both always visible.
  RIGHT: SVG with <rect fill="#ddd"/> that gets data-highlight="5.0"
         to briefly flash accent, then fades back to grey at data-fade-out.

  DARK accents:  #e94560 (coral), #16c79a (teal), #4ecdc4 (cyan)
  LIGHT accents: #2563eb (blue), #dc2626 (red), #059669 (green)

━━━━ CONTRAST ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Every text element must contrast its background (>=3:1 ratio).
  NEVER: white-on-light, dark-on-dark, rgba opacity below 0.65.

━━━━ TYPOGRAPHY — TWO SIZE TIERS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Use ONE font family (system-ui). Two contexts have different minimums:

  SLIDE TEXT (inside padded .scene divs):
    Title:   40px (2.5rem) minimum — bold 700
    Body:    24px (1.5rem) minimum — regular 400
    Labels:  20px (1.25rem) minimum

  SVG DIAGRAM TEXT (inside <svg> with full-viewport viewBox):
    Title:   24px
    Primary: 18px (component names, major labels)
    Secondary: 14px (annotations, axis values, formulas)

  ** SVG minimums are valid when the diagram is large on screen.
     A 14px label in a tiny sidebar diagram is unreadable. When the diagram
     zooms out to a smaller size, remove or simplify detail labels.
     See --help-format 'TWO SCENE MODELS' for canvas scene setup. **

━━━━ WHEN VALIDATOR FLAGS SMALL TEXT: 8-STEP FIX HIERARCHY ━━━━━━━━━

  ** CRITICAL: Do NOT just increase font-size. That causes label overlaps.
     Try these fixes in order. Stop at the first one that works. **

  1. ENLARGE THE DIAGRAM — make the SVG/container fill more viewport.
     Same font renders bigger in a bigger container.
  2. ZOOM TO REGION — CSS transform on a wrapper div zooms the camera
     closer. Full diagram persists; the view just got bigger.
     See --help-format 'TWO SCENE MODELS' for the viewport transform pattern.
  3. SPLIT THE DIAGRAM — one complex diagram becomes 2-3 simpler ones
     shown in sequence. Each sub-diagram can be larger.
  4. SIMPLIFY LABELS — "Transmission Control Protocol" -> "TCP".
     Narrator speaks the full name; label uses the abbreviation.
  5. MOVE LABELS OUTSIDE — callout lines from diagram point to a label
     in the margin where there is space.
     See --help-components 'CALLOUT-LABEL PATTERN'.
  6. REDUCE CLUTTER — remove decorative elements, redundant labels.
     Fewer elements = more space for remaining labels.
  7. ENLARGE SVG CANVAS — increase the viewBox dimensions.
     e.g., viewBox="0 0 1920 1080" -> viewBox="0 0 2400 1350".
  8. LAST RESORT: INCREASE FONT-SIZE — only after steps 1-7.
     If you increase font-size without increasing container space,
     labels WILL overlap.

  ANTI-PATTERN: Naive Font-Size Fix — validator says "14px too small",
  LLM bumps to 20px, labels now overlap and are LESS readable.

━━━━ DIAGRAM-PRIMARY LAYOUT — MANDATORY FOR TECHNICAL CONTENT ━━━━━

  ** BANNED: static small diagram next to a wall of text.
     REQUIRED: diagram starts large, drives the explanation visually. **

  BANNED LAYOUT — "Tiny Diagram Syndrome":
    +--------------------------------------+
    |  Title              | [small        ||
    |  * bullet 1         |  diagram      ||
    |  * bullet 2         |  that never   ||
    |  * bullet 3         |  changes]     ||
    |  paragraph text     |               ||
    +--------------------------------------+

  GOOD — diagram fills viewport during explanation:
    +--------------------------------------+
    | Brief Title (appears, then fades)    |
    | +----------------------------------+ |
    | |                                  | |
    | |    DIAGRAM FILLS VIEWPORT        | |
    | |    labels + arrows appear/fade   | |
    | |                                  | |
    | +----------------------------------+ |
    | brief label (appears/fades with TTS) |
    +--------------------------------------+

  ALSO GOOD — diagram zooms out to make room for text:
    +--------------------------------------+
    | +------------+                       |
    | | diagram    |  Explanatory text     |
    | | (zoomed    |  appears here after   |
    | |  out,      |  the diagram was      |
    | |  labels    |  shown large first.   |
    | |  removed)  |  Detail labels gone.  |
    | +------------+                       |
    +--------------------------------------+

  The key rule: the diagram must be SHOWN LARGE first, then can shrink.
  A diagram that is always small and decorative is a wasted visual.
  When zooming out, remove detail labels that become unreadable at the
  smaller scale — keep only major component names or abbreviations.
  See --help-format 'TWO SCENE MODELS' for the canvas scene template.

━━━━ TEXT ON SCREEN — MANDATORY LIMITS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. Max 8 words per text overlay.
  2. ** MANDATORY ** Every data-appear MUST have a data-fade-out.
  3. Max 3 text overlays visible simultaneously.
  4. Clear before fill: old text fades 0.4s BEFORE new text appears.
  5. The narrator carries the explanation. On-screen text is LABELS.

  WRONG — text accumulation ("Slide Deck Syndrome"):
    t=10s: "Bullet 1" appears              (1 visible)
    t=14s: "Bullet 2" appears              (2 visible)
    t=18s: "Bullet 3" appears              (3 visible)
    t=22s: "Bullet 4" appears              (4 visible — VIOLATION)
    All 4 stay. 25+ words on screen. This is a PowerPoint, not a video.

  RIGHT — enter and exit:
    t=10s: "Bullet 1" appears              (1 visible)
    t=13.6s: "Bullet 1" fades out
    t=14s: "Bullet 2" appears              (1 visible)
    t=17.6s: "Bullet 2" fades out
    Narrator speaks the full explanation. Overlays are cue cards.

━━━━ VISUAL EXPLANATION MANDATE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Explanations are DIAGRAM MOTIONS: zoom into a region, highlight an
  element, draw an arrow, recolor a node, pan to the next component.
  On-screen text is a brief label, not the explanation itself.

  WRONG: Narrator says "Data flows from A to B." Screen shows text:
         "Data flows from component A to component B via the bus."
  RIGHT: Narrator says "Data flows from A to B." Screen shows an arrow
         animating from node A to node B. Label "A->B" appears for 3s.

━━━━ ANIMATION QUALITY — THE #1 MOST IMPORTANT RULE ━━━━━━━━━━━━━━━

  ** THIS IS THE DIFFERENCE BETWEEN A VIDEO AND A SLIDESHOW.
     If your scene has all elements visible from frame 1 with only a
     fade-in at the start, YOU HAVE MADE A SLIDE, NOT A VIDEO SCENE.
     Every scene must have elements that appear, highlight, move, and
     disappear IN SYNC with the narrator's words throughout the scene. **

  ANTI-PATTERN: "Static Diagram" — the #1 most common failure.
    The LLM draws a complete SVG with all paths, labels, and colors
    visible at once, wraps it in a single data-appear, and calls it done.
    The result: a static image that the narrator talks over.
    THIS IS UNACCEPTABLE. The diagram must BUILD piece by piece.

  WRONG — static diagram (everything visible, nothing moves):
    <svg data-appear="5.0">
      <!-- ALL elements visible at once. No highlights. No build. -->
      <polyline points="..." stroke="red"/>    <!-- path fully drawn -->
      <text>Total = 330</text>                  <!-- label always visible -->
      <polyline points="..." stroke="blue"/>   <!-- second path fully drawn -->
      <text>Total = 120</text>                  <!-- always visible too -->
    </svg>

  RIGHT — animated diagram (builds with narrator, 15+ sync events):
    <!-- Elements start hidden, appear as narrator mentions them -->
    <line data-appear="5.0" data-fade-out="25.0" .../>  <!-- number line -->
    <circle data-appear="6.0" data-fade-out="25.0" .../>  <!-- request dot 1 -->
    <circle data-appear="6.5" data-fade-out="25.0" .../>  <!-- request dot 2 -->
    <circle data-appear="7.0" data-fade-out="25.0" .../>  <!-- request dot 3 -->
    <!-- narrator says "head bounces back and forth" -->
    <polyline data-appear="8.0" data-fade-out="15.0" stroke="#888" .../>
    <text data-appear="9.0" data-fade-out="15.0"
          data-highlight="9.0" data-highlight-effect="color">
      Total = 330 cylinders
    </text>
    <!-- narrator says "smart scheduler reorders" — old path fades, new builds -->
    <polyline data-appear="16.0" data-fade-out="25.0" stroke="#888" .../>
    <text data-appear="17.0" data-fade-out="25.0"
          data-highlight="17.0" data-highlight-effect="color">
      Total = 120 cylinders
    </text>
    <!-- narrator says "64% less" — result highlights -->
    <rect data-appear="18.0" data-fade-out="25.0" .../>
    <text data-appear="18.5" data-fade-out="25.0"
          data-highlight="18.5" data-highlight-effect="box">
      64% less head movement
    </text>

  MINIMUM SYNC REQUIREMENTS PER SCENE:
    - At least 8 data-appear events (elements appearing over time)
    - At least 3 data-highlight events (words/elements highlighting with narrator)
    - data-fade-out on EVERY data-appear (elements must leave)
    - Elements must NOT all appear at the same time — stagger by 0.5-1.5s

  HIGHLIGHT SYNC WITH NARRATION:
    When the narrator says a key term, that term MUST be highlighted on screen
    using data-highlight at the exact word_timestamp. This means:
    - Read word_timestamps from --analyze --tts output
    - For each important concept the narrator mentions, add data-highlight
    - The highlight should be on the DIAGRAM element (label, component, path),
      not just on text overlays
    - Use different highlight effects: color, underline, marker, glow, box

  COLOR DURING ANIMATION — HIGHLIGHT LIFECYCLE:
    Every diagram element follows this mandatory lifecycle:
    1. Element APPEARS in grey/muted (any unsaturated grey shade — diagrams
       can use different greys for visual hierarchy and readability)
    2. Narrator MENTIONS the element → highlight to accent color
       (via data-highlight at the word_timestamp)
    3. Narrator MOVES ON to next topic → fade back to grey
       (via data-fade-out, or a timed style reset)
    ONLY the currently-discussed element should have the accent color.

    FAILURE MODE A — "Always Saturated" (most common):
      Element has fill="#dc2626" or stroke="#2563eb" from creation.
      Never changes. Competes with accent. No visual link to narration.
      ALSO INCLUDES: light-but-saturated backgrounds (background:#e8d5f5),
      colored outlines, tinted container fills. ALL must start grey/muted.

    FAILURE MODE B — "Never Highlighted":
      A new term appears in the diagram as grey. The narrator explains it
      for 30 seconds. The element stays grey. The viewer cannot tell which
      element is being discussed.
      FIX: Add data-highlight at the narrator's word_timestamp for the term.
      The element turns accent when mentioned, grey when the narrator moves on.

    Both failure modes are caught by --validate (SVG saturation scan) and
    by the visual-verifier during max quality mode.

  CONSTRUCTION ANIMATION:
    Animate elements the way they are naturally built:
    - Paths: draw stroke-by-stroke (use stroke-dashoffset animation)
    - Bars: grow from baseline upward
    - Circles/arcs: radius extends then arc sweeps
    - Connections: a dot travels from source to destination
    - Labels: appear AFTER the element they label, not before

  EVERY scene must answer: "If I screenshot this at 5 different timestamps,
  do the screenshots look DIFFERENT?" If they all look the same,
  the scene is static and must be rewritten.

━━━━ SPACING & DENSITY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  - ONE idea per scene. Max ONE supporting component.
  - Max 4 bullet points, max 8 words each
  - Content must fill 60%+ of the frame — center or enlarge
  - Padding: 60px 80px minimum (slide scenes)

━━━━ LAYOUT VARIETY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Max 2 consecutive scenes with the same layout. Patterns:
    A) Quote-focused    B) Comparison     C) Timeline
    D) Centered text    E) Two-column     F) Full-bleed stat
    G) Full-bleed diagram (canvas scene — SVG fills viewport)

  For technical videos: use G for >=60% of scenes.

━━━━ TITLE SCENE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Must use accent color at least once. Vertically center all content.

━━━━ SUMMARY (repeated for emphasis) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. Diagrams start large, can zoom out — see DIAGRAM-PRIMARY above
  2. Every data-appear MUST have data-fade-out — see TEXT ON SCREEN
  3. Max 8 words, max 3 overlays — see TEXT ON SCREEN
  4. Never just increase font-size — see 8-STEP FIX HIERARCHY
`);
}

function printFormatHelp() {
  console.log(`
HTML FORMAT & WORKFLOW RULES

** MANDATORY for LLM agents. These rules prevent the most common failures.
   THREE CRITICAL RULES before you read anything else:
   1. Use CANVAS SCENES (not slides) for technical/diagram content
   2. Every data-appear MUST have a matching data-fade-out
   3. For videos >3 minutes, use the MULTI-FILE WORKFLOW — never one giant file **

━━━━ TWO SCENE MODELS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Every scene is either a SLIDE or a CANVAS. Choose based on content.
  ** CRITICAL: For technical/educational videos, use CANVAS for >=60%
     of scenes. SLIDE is only for intros, conclusions, quotes, stats. **

  MODEL A: SLIDE SCENE (text-primary)
    Use for: introductions, conclusions, quotes, statistics, comparisons.
    Standard flex-column layout with padding. Built-in components work here.

    <div class="scene" style="position:absolute; inset:0; padding:60px 80px;
         display:flex; flex-direction:column; opacity:0">
      <h1 data-appear="T" data-fade-out="T+10">Topic Title</h1>
      <div data-appear="T+1" data-fade-out="T+8" data-appear-effect="fadeUp">
        <quote-block cite="Author">A relevant quote.</quote-block>
      </div>
    </div>

  MODEL B: CANVAS SCENE (diagram-primary)
    Use for: diagrams, architecture, data flow, spatial explanations.
    SVG fills the entire viewport. Text enters/exits as positioned overlays.
    Camera zooms/pans via CSS transforms on the wrapper div.

    <!-- Canvas scene: persistent diagram + text overlays -->
    <div class="scene" style="position:absolute; inset:0; opacity:0; overflow:hidden">
      <!-- Viewport target: contains BOTH diagram AND overlays so they zoom together -->
      <div id="canvas-01" style="position:absolute; inset:0;
           transition:transform 1.5s ease-in-out">
        <svg viewBox="0 0 1920 1080" style="width:100%;height:100%">
          <!-- diagram content here -->
        </svg>
        <!-- Text overlay layer: INSIDE viewport target (zooms with diagram) -->
        <div style="position:absolute; inset:0; pointer-events:none; padding:40px">
          <h2 data-appear="T" data-fade-out="T+8" data-appear-effect="fadeUp"
              style="position:absolute;top:40px;left:60px;font-size:2rem">
            Section Title
          </h2>
          <p data-appear="T+2" data-fade-out="T+6"
             style="position:absolute;bottom:60px;left:60px;font-size:1.4rem">
            Brief label (max 8 words)
          </p>
        </div>
      </div>
    </div>
    <!-- Viewport transforms: zoom/pan via data attributes (no script needed) -->
    <div data-viewport="canvas-01" data-viewport-at="T"
         data-viewport-transform="scale(1)" data-viewport-duration="0"></div>
    <div data-viewport="canvas-01" data-viewport-at="T+2"
         data-viewport-transform="scale(2) translate(-200px,-150px)"
         data-viewport-duration="1.5"></div>
    <div data-viewport="canvas-01" data-viewport-at="T+8"
         data-viewport-transform="scale(1)" data-viewport-duration="2"></div>

    VIEWPORT TRANSFORMS — two methods:

    METHOD 1: Focus on an element (RECOMMENDED — no math needed):
      data-viewport="canvas-01"           Target wrapper to transform
      data-viewport-at="5.0"              Time in seconds
      data-viewport-focus="#tcp-label"     Element ID to center in frame
      data-viewport-scale="2"             Zoom level
      data-viewport-duration="1.5"        Animation duration in seconds

      The CLI auto-computes the translate to center the focused element.
      Use this for zooming into specific diagram components. The element
      is centered regardless of where it sits in the diagram.

    METHOD 2: Manual transform (for complex custom animations):
      data-viewport="canvas-01"
      data-viewport-at="5.0"
      data-viewport-transform="scale(2) translate(-200px,-150px)"
      data-viewport-duration="1.5"

      You compute the translate yourself. Use only when focus-based
      doesn't give the framing you want.

    Place these as hidden divs anywhere in the body. The time controller
    processes them automatically — smooth transitions rendered frame-by-frame.
    Apply transforms to a wrapper <div>, not the <svg> directly.

    CANVAS RULES:
    - SVG fills 100% of viewport (inset:0, no padding on the diagram layer)
    - Text overlays are absolutely positioned OVER the diagram
    - ** Text overlays MUST be CHILDREN of the viewport target div, not siblings.
      If overlays are siblings, they will NOT zoom/pan with the diagram.
      When the diagram scales 2x, sibling overlays stay at 1x — position mismatch. **
    - Every overlay has BOTH data-appear AND data-fade-out
    - Camera zooms/pans connect topics — animate between views, never jump-cut
    - Max 3 text overlays visible at any moment, max 8 words each
    - See --help-design 'DIAGRAM-PRIMARY LAYOUTS' for layout rules
    - See --help-components 'VIEWPORT-FRAME PATTERN' for zoom/pan details

━━━━ CONTINUITY RULES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ** Every visible element must have a REASON and a LIFESPAN. **

  1. ** MANDATORY ** Every data-appear MUST have a data-fade-out.
     Exception: the background diagram in a canvas scene (it persists).
     Everything else — titles, labels, arrows, callouts, formulas —
     must fade out before being replaced.

  2. Clear before fill. Old text fades out 0.4s BEFORE new text appears.
     At no point should more than 3 text overlays be visible.

  3. Camera moves connect ideas. When transitioning between diagram
     regions, animate the viewport transform. The viewer must see how
     region A relates spatially to region B.
     WRONG: Scene 7 shows full diagram. Scene 8 is a different diagram.
     RIGHT: Scene 7 shows full diagram. Camera zooms into the TCP layer.

  4. No orphaned elements. If an element appears, it either stays
     relevant (persistent diagram) or fades out before the next beat.

  5. Diagrams persist within a canvas scene. Do NOT rebuild or replace
     the SVG — zoom, pan, highlight, and annotate the SAME diagram.

━━━━ SCENE VISIBILITY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Use setTimeout to switch between scenes:

    <style>
      .scene { position:absolute; inset:0; opacity:0; pointer-events:none }
      .scene.active { opacity:1; pointer-events:auto }
    </style>
    <script>
      const scenes = document.querySelectorAll('.scene');
      const times = [0, 8000, 16000, 24000]; // ms when each scene starts
      times.forEach((t, i) => {
        setTimeout(() => {
          scenes.forEach(s => s.classList.remove('active'));
          scenes[i].classList.add('active');
        }, t);
      });
    </script>

  Time each scene to match TTS cue start times from --analyze output.

━━━━ CONTENT PER SCENE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  MANDATORY LIMITS:
  - ONE main idea per scene
  - ONE title (large, bold)
  - Max ONE supporting component (quote OR timeline OR compare — not all)
  - Max 4 bullet points, max 8 words each
  - Max 3 text overlays visible simultaneously
  - Max 200 lines per scene HTML file
  - NEVER repeat the same information in multiple components

━━━━ LAYOUT VARIETY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  No more than 2 consecutive scenes with the same layout. Alternate:

    A) Quote-focused:      title + large quote-block + one sentence
    B) Comparison:         title + compare-grid + explanation
    C) Timeline:           title + time-line with 3-4 events
    D) Centered text:      large centered quote/statement, no title bar
    E) Two-column:         title + left text column + right component
    F) Full-bleed stat:    one giant stat-box or keyword, centered
    G) Full-bleed diagram: SVG fills viewport, text overlays enter/exit

  For technical/educational videos: use pattern G (canvas scene) for
  >=60% of scenes. Example rotation: G, A, G, G, D, G, B, G

━━━━ TITLE SCENE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  The title scene must NOT be entirely grayscale. Use the accent color
  at least once (a subtitle, a decorative line, a keyword).
  Vertically center all content. Use justify-content:center.

  WRONG: Scene has a title + quote + timeline + stat grid + compare boxes
  RIGHT: Scene has a title + one key quote + 2-3 animated bullet points

━━━━ NARRATOR SYNC — MANDATORY FOR ALL NARRATED VIDEOS ━━━━━━━━━━━━

  ** REQUIREMENT: Every narrated video MUST use data-appear,
     data-highlight, AND data-fade-out to sync visuals with speech.
     A presentation where all content appears at once while the narrator
     talks over a static slide is UNACCEPTABLE. **

  ATTRIBUTES (values are in SECONDS, matching TTS timeline):
    data-appear="14.2"                Hides element, fades in at t=14.2s
    data-appear-effect="fadeUp"       Entrance animation (default: fade)
       Options: fade, fadeUp, fadeDown, fadeLeft, fadeRight,
                scaleIn, popIn, flipIn, revealDown
    data-highlight="14.2"             Highlights text at t=14.2s
    data-highlight-effect="underline" Highlight animation (default: color)
       Options: color, underline, marker, glow, box
    data-fade-out="18.0"              ** MANDATORY ** Fades out at t=18.0s
       Every data-appear MUST have a matching data-fade-out.

  HIGHLIGHT EFFECTS:
    color      Animated color shift to accent + soft glow (default)
    underline  Accent line draws left-to-right under the text
    marker     Translucent highlighter pen sweeps across background
    glow       Text-shadow pulses bright then settles to soft glow
    box        Rounded accent-tinted box grows behind the text

  APPEAR EFFECTS:
    fade       Simple opacity fade-in (default, fastest)
    fadeUp     Slides up 30px while fading in
    fadeDown   Slides down 30px while fading in
    fadeLeft   Slides in from left while fading in
    fadeRight  Slides in from right while fading in
    scaleIn    Scales from 80% to 100%
    popIn      Bouncy scale (50% -> 105% -> 100%)
    flipIn     3D Y-axis rotation reveal
    revealDown Clip-path reveal top to bottom

  EXAMPLE — scene with narrator sync and mandatory fade-outs:
    <div data-tts="The creature was born good, but rejection made it
         a monster." data-tts-start="50.7"></div>
    <div class="scene">
      <h1 data-appear="50.7" data-fade-out="58.0">Nature vs. Nurture</h1>
      <p style="font-size:2rem" data-appear="51.5" data-fade-out="58.0">
        The creature was
        <span data-highlight="52.0" data-highlight-effect="marker">born good</span>,
        but <span data-highlight="54.0" data-highlight-effect="glow">rejection</span>
        made it a monster.
      </p>
      <div data-appear="55.0" data-fade-out="58.0" data-appear-effect="popIn">
        <quote-block cite="The Creature">I was benevolent.</quote-block>
      </div>
    </div>

  WORKFLOW WITH --analyze --tts:
    1. Run --analyze --tts on your HTML
    2. Read word_timestamps from the JSON output:
       [{"word": "creature", "time": 51.2}, {"word": "born", "time": 52.0}, ...]
    3. Use the word's "time" value for data-appear/data-highlight
    4. Set data-fade-out to 6-10 seconds after data-appear (or before
       the next scene's content appears, whichever is sooner)
    5. Preview with --preview at that timestamp to verify

━━━━ HTML BOILERPLATE (slide scene) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  <!DOCTYPE html>
  <html><head>
  <meta charset="utf-8">
  <meta name="claude-explains:duration" content="30">
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
    h1 { font-size:clamp(2.5rem,5vw,4rem); font-weight:700; margin-bottom:0.6em }
    p, li { font-size:clamp(1.2rem,2vw,1.6rem); line-height:1.5 }
    .accent { color:#e94560 }
  </style>
  </head><body>
  <div data-tts="Welcome." data-tts-start="0"></div>
  <div class="scene active">
    <h1 data-appear="0.5" data-fade-out="8.0">Title</h1>
  </div>
  <script>
    const scenes = document.querySelectorAll('.scene');
    const times = [0]; // match TTS start times in ms
    times.forEach((t, i) => {
      setTimeout(() => {
        scenes.forEach(s => s.classList.remove('active'));
        scenes[i].classList.add('active');
      }, t);
    });
  </script>
  </body></html>

  For canvas scenes, use the template from TWO SCENE MODELS above.

━━━━ TTS SYNC WORKFLOW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. Write HTML with estimated data-tts-start values
  2. Run --analyze --tts to get actual audio durations
  3. Set duration meta to tts.suggested_minimum_duration
  4. Adjust data-tts-start to match tts.cues[].adjusted_start
  5. Set scene switch times to match TTS cue boundaries
  6. Add data-appear, data-highlight, AND data-fade-out using word_timestamps
  7. Run --validate — fix ALL errors before proceeding
  8. Run --storyboard N where:
       Short (<=60s):    N = 9
       Medium (60-300s): N = ceil(duration / 10)
       Long (>300s):     N = ceil(duration / 15)
     Then SELF-CHECK against all 10 items below.
  9. ONLY after storyboard passes all checks: render final video

━━━━ MULTI-FILE WORKFLOW — FOR VIDEOS >3 MINUTES ━━━━━━━━━━━━━━━━━━

  ** CRITICAL: Do NOT write all scenes in one file for videos over 3
     minutes. A 10-minute video needs ~20-40 scenes. Writing 4000+ lines
     in one shot guarantees errors. Use the chapter-based workflow: **

  1. PLAN — write one JSON per chapter with title, scene descriptions,
     estimated durations. Target 1-3 min per chapter, 3-6 scenes each.
  2. DIAGRAMS — create standalone SVGs. Max 150 lines per SVG, max 15
     labels, viewBox "0 0 1920 1080". Verify each with --preview.
  3. SCENES — write one HTML file per scene. Max 200 lines each.
     Run --validate on every scene. Fix errors before the next scene.
  4. TIMING — run --analyze --tts per chapter. Map word_timestamps to
     data-appear/data-highlight/data-fade-out in each scene file.
  5. ASSEMBLY — combine scenes into playable HTML:
     claude-explains --assemble timeline.json -o chapter.html
     Timeline JSON format:
     { "duration": 120, "scenes": [
         { "file": "ch01_s01.html", "start": 0 },
         { "file": "ch01_s02.html", "start": 25 }
     ]}
     Run --storyboard on each assembled chapter. Check all 10 items.
  6. REVIEW — storyboard the full assembled video. Verify continuity
     across chapters. Use --review for interactive human review.

  NEVER write all scenes in one HTML file.
  NEVER skip per-scene validation.
  NEVER use fewer storyboard frames than the formula requires.

━━━━ CHAPTER-GLOBAL TIMESTAMPS — MANDATORY FOR ASSEMBLY ━━━━━━━━━━━

  ** CRITICAL: The --assemble command copies scene DOM VERBATIM.
     It does NOT rewrite any timestamp values. **

  When using multi-file workflow with --assemble:
  - ALL data-appear, data-fade-out, data-highlight, data-viewport-at,
    and data-tts-start values MUST be chapter-global absolute times
  - "Chapter-global" means relative to the START of the chapter, not
    the start of the individual scene
  - Add the scene's timeline start offset to every timestamp

  EXAMPLE:
    Scene 3 starts at 60s in the chapter timeline.
    A narration word is spoken at scene-local time 5.2s.
    The correct data-appear value is: 60 + 5.2 = 65.2

    WRONG: data-appear="5.2"   ← scene-local, will fire at t=5.2 of chapter
    RIGHT: data-appear="65.2"  ← chapter-global, fires when scene 3 is active

  The assembler validates timestamps and will warn if scene-local
  patterns are detected. Use --auto-offset as a safety net:
    claude-explains --assemble timeline.json --auto-offset -o chapter.html
  This auto-adds scene start offsets to all timestamps. It skips scenes
  whose timestamps already appear chapter-global (double-offset protection).

  STANDALONE SCENES (not assembled):
    Use whatever timestamps make sense. This rule only applies when
    scenes will be combined via --assemble.

━━━━ MANDATORY STORYBOARD SELF-CHECK (10 items) ━━━━━━━━━━━━━━━━━━━

  ** You MUST generate a storyboard and check ALL 10 items BEFORE
     rendering. If ANY check fails, fix and re-storyboard. **

  CHECK 1 — TEXT READABILITY
    Can you read ALL text in every frame?
    ✗ White text on white/light background
    ✗ Dark text on dark background
    ✗ Text too small or overlapping other elements
    If unreadable → fix theme, colors, or see --help-design FIX HIERARCHY

  CHECK 2 — THEME CONSISTENCY
    Is the theme uniform across all scenes?
    ✗ Some scenes dark, others light
    ✗ Accent color changing between scenes
    If inconsistent → standardize body background + .accent

  CHECK 3 — CONTENT VISIBILITY
    Does every scene have visible, meaningful content?
    ✗ Empty or near-empty frames
    ✗ Content crammed into top 20% of frame
    If missing → check data-appear times, scene switching

  CHECK 4 — NARRATOR SYNC PRESENT
    Do elements appear/highlight progressively?
    ✗ All content visible in frame 1 (nothing animated)
    ✗ No data-appear or data-highlight used
    If static → add data-appear/data-highlight per workflow

  CHECK 5 — LAYOUT VARIETY
    Do scenes use different layouts?
    ✗ 3+ consecutive scenes with identical structure
    If monotonous → rotate patterns (A, G, D, G, B, G, F...)

  CHECK 6 — SCENE TRANSITIONS WORK
    Are different scenes showing at different timestamps?
    ✗ Same scene in all frames, or multiple scenes overlapping
    If broken → check setTimeout scene switching times

  CHECK 7 — DIAGRAM PRESENCE (technical/educational content)
    Is the diagram the primary visual at some point in the scene?
    ✗ Diagram is always small and decorative, never fills the frame
    ✗ Diagram was never shown large before being shrunk
    ✗ Diagram shows info already stated in text (redundant)
    If diagram is always secondary → show it large first, then zoom out

  CHECK 8 — TEXT ACCUMULATION
    Does text fade out before new text appears?
    ✗ 4+ text overlays visible simultaneously
    ✗ No data-fade-out attributes used
    ✗ End of scene has more visible text than beginning
    If accumulating → add data-fade-out to every data-appear element

  CHECK 9 — CAMERA ACTIVITY (canvas scenes)
    Does the viewport zoom/pan between frames?
    ✗ Same zoom level in every frame of a diagram scene
    ✗ No viewport transforms in the scene scripts
    If static → add viewport transforms synced to topic changes

  CHECK 10 — CONTINUITY
    Do adjacent frames share visual context?
    ✗ Every frame shows a completely different diagram
    ✗ Hard cuts between unrelated layouts
    If disconnected → keep the same diagram, zoom/pan between regions

  If ALL 10 checks pass → proceed to final render.
  If ANY check fails → fix the issue, re-run --storyboard, re-check.

  SUMMARY OF CRITICAL RULES (repeated for emphasis):
  - Canvas scenes for >=60% of technical content — see TWO SCENE MODELS
  - Every data-appear MUST have data-fade-out — see CONTINUITY RULES
  - Multi-file workflow for videos >3 minutes — see MULTI-FILE WORKFLOW
`);
}

function parseArgs(argv) {
  const opts = {
    input: null, output: 'output.mp4',
    width: 1920, height: 1080, fps: 30, duration: null,
    tts: false, ttsVoice: 'en', ttsRate: 175, ttsEngine: 'auto',
    ttsModel: 'supertonic-3', ttsQuality: 'normal', ttsSpeed: null,
    codec: 'libx264', quality: 'medium',
    analyze: false, preview: null, components: true,
    storyboard: null, validate: false,
    ttsFirst: null,
    template: null, templateScenes: 5,
    pdf: null, htmlBundle: false, review: false, assemble: null, autoOffset: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], n = argv[i + 1];
    switch (a) {
      case '--help': printHelp(); process.exit(0);
      case '--help-components': printComponentHelp(); process.exit(0);
      case '--help-design': printDesignHelp(); process.exit(0);
      case '--help-format': printFormatHelp(); process.exit(0);
      case '-o': case '--output': opts.output = n; i++; break;
      case '--width': opts.width = parseInt(n, 10); i++; break;
      case '--height': opts.height = parseInt(n, 10); i++; break;
      case '--fps': opts.fps = parseInt(n, 10); i++; break;
      case '-d': case '--duration': opts.duration = parseFloat(n); i++; break;
      case '--tts': opts.tts = true; break;
      case '--tts-voice': opts.ttsVoice = n; i++; break;
      case '--tts-rate': opts.ttsRate = parseInt(n, 10); i++; break;
      case '--tts-engine': opts.ttsEngine = n; i++; break;
      case '--tts-model': opts.ttsModel = n; i++; break;
      case '--tts-quality': opts.ttsQuality = n; i++; break;
      case '--tts-speed': opts.ttsSpeed = parseFloat(n); i++; break;
      case '--tts-audio': i++; break;
      case '--tts-first': opts.ttsFirst = n; i++; break;
      case '--codec': opts.codec = n; i++; break;
      case '--quality': opts.quality = n; i++; break;
      case '--analyze': opts.analyze = true; break;
      case '--preview': opts.preview = parseFloat(n); i++; break;
      case '--no-components': opts.components = false; break;
      case '--storyboard': opts.storyboard = parseInt(n, 10) || 9; i++; break;
      case '--validate': opts.validate = true; break;
      case '--template': opts.template = n; i++; break;
      case '--template-scenes': opts.templateScenes = parseInt(n, 10); i++; break;
      case '--pdf': opts.pdf = n; i++; break;
      case '--html-bundle': opts.htmlBundle = true; break;
      case '--review': opts.review = true; break;
      case '--assemble': opts.assemble = n; i++; break;
      case '--auto-offset': opts.autoOffset = true; break;
      default:
        if (!a.startsWith('-') && !opts.input) opts.input = a;
        else if (a.startsWith('-')) { console.error(`Unknown option: ${a}`); process.exit(1); }
    }
  }

  return opts;
}

function wrapSvgInput(inputPath) {
  const content = readFileSync(inputPath, 'utf-8').trim();
  const isSvg = inputPath.endsWith('.svg') || content.startsWith('<svg');
  if (!isSvg) return { path: inputPath, cleanup: null };

  process.stderr.write('SVG input detected, wrapping in preview HTML...\n');
  const wrapped = `<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="claude-explains:duration" content="1">
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:1920px;height:1080px;overflow:hidden;background:#1a1a2e;color:#e0e0e0}
svg{width:100%;height:100%}</style>
</head><body>${content}</body></html>`;

  const tmpPath = inputPath + '.h2v-preview.html';
  writeFileSync(tmpPath, wrapped, 'utf-8');
  return { path: tmpPath, cleanup: () => { try { unlinkSync(tmpPath); } catch {} } };
}

export async function main(argv) {
  const opts = parseArgs(argv);

  if (opts.template) {
    return runTemplate(opts);
  }

  if (opts.ttsFirst) {
    return runTTSFirst(opts);
  }

  if (opts.assemble) {
    return runAssemble(opts);
  }

  if (!opts.input) {
    console.error('Error: Input file is required (HTML or SVG).');
    printHelp();
    process.exit(1);
  }

  const inputPath = resolve(opts.input);
  if (!existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  const svgWrap = wrapSvgInput(inputPath);
  const effectivePath = svgWrap.path;
  try {
    if (opts.validate) {
      await runValidate(effectivePath, opts);
    } else if (opts.analyze) {
      await runAnalyze(effectivePath, opts);
    } else if (opts.preview !== null) {
      await runPreview(effectivePath, opts);
    } else if (opts.storyboard !== null) {
      await runStoryboard(effectivePath, opts);
    } else if (opts.pdf) {
      await runPDF(effectivePath, opts);
    } else if (opts.htmlBundle) {
      await runHTMLBundle(effectivePath, opts);
    } else if (opts.review) {
      await runReview(effectivePath, opts);
    } else {
      await runRender(effectivePath, opts);
    }
  } finally {
    if (svgWrap.cleanup) svgWrap.cleanup();
  }
}

async function runAnalyze(inputPath, opts) {
  process.stderr.write('Analyzing HTML...\n');
  const { config, analysis } = await analyzeHTML(inputPath, opts.width, opts.height);

  const duration = opts.duration || config.duration || 10;

  const result = {
    input: inputPath,
    dimensions: { width: opts.width, height: opts.height },
    duration: {
      specified: opts.duration || null,
      from_html: config.duration || null,
      effective: duration,
    },
    animations: analysis.animations,
    canvases: analysis.canvases,
    pending_timers: analysis.pending_timers,
    active_raf_callbacks: analysis.active_raf_callbacks,
    dom_element_count: analysis.dom_element_count,
    tts: null,
  };

  if (opts.tts && config.ttsCues && config.ttsCues.length > 0) {
    process.stderr.write(`Generating TTS to measure durations (${config.ttsCues.length} cues)...\n`);
    const { timeline, engine } = await analyzeTTSOnly(config.ttsCues, {
      voice: opts.ttsVoice,
      rate: opts.ttsRate,
      engine: opts.ttsEngine,
      model: opts.ttsModel,
      quality: opts.ttsQuality,
      speed: opts.ttsSpeed,
    });
    result.tts = { engine, ...timeline };

    if (timeline && timeline.suggested_minimum_duration > duration) {
      result.duration.suggested_by_tts = timeline.suggested_minimum_duration;
      result.duration.warning = `TTS content requires at least ${timeline.suggested_minimum_duration}s but effective duration is ${duration}s. Increase duration or adjust TTS cue start times.`;
    }
  } else if (config.ttsCues && config.ttsCues.length > 0) {
    result.tts = {
      engine: null,
      note: 'TTS cues found but --tts flag not set. Add --tts to analyze audio timing.',
      raw_cues: config.ttsCues,
    };
  }

  console.log(JSON.stringify(result, null, 2));
}

async function runPreview(inputPath, opts) {
  const timeMs = opts.preview * 1000;
  const outputPath = resolve(opts.output.replace(/\.\w+$/, '') + `_preview_${opts.preview}s.png`);

  process.stderr.write(`Rendering preview frame at t=${opts.preview}s...\n`);
  await previewFrame(inputPath, timeMs, opts.width, opts.height, outputPath);
  process.stderr.write(`Preview saved: ${outputPath}\n`);

  console.log(JSON.stringify({
    preview: { time: opts.preview, time_ms: timeMs, output: outputPath }
  }));
}

async function runRender(inputPath, opts) {
  const outputPath = resolve(opts.output);
  const startTime = Date.now();

  process.stderr.write(`claude-explains v1.0.0\n`);
  process.stderr.write(`Input:  ${inputPath}\n`);
  process.stderr.write(`Output: ${outputPath}\n`);
  process.stderr.write(`Size:   ${opts.width}x${opts.height} @ ${opts.fps}fps\n`);

  process.stderr.write('Pre-render validation...\n');
  const validation = await validateHTML(inputPath, opts.width, opts.height);
  const criticals = validation.issues.filter(i => i.type === 'contrast');
  if (criticals.length > 0) {
    process.stderr.write(`  WARNING: ${criticals.length} contrast issue(s) detected:\n`);
    for (const c of criticals) process.stderr.write(`    - ${c.message}\n`);
    process.stderr.write(`  These may produce unreadable text. Run --validate for full report.\n\n`);
  }
  if (validation.issues.length > 0 && criticals.length === 0) {
    process.stderr.write(`  ${validation.issues.length} minor issue(s) found. Run --validate for details.\n`);
  }

  const config = await peekConfig(inputPath, opts.width, opts.height);
  const duration = opts.duration || config.duration || 10;
  process.stderr.write(`Duration: ${duration}s (${Math.ceil(opts.fps * duration)} frames)\n`);

  let audioPath = null;
  let ttsTimeline = null;

  if (opts.tts && config.ttsCues && config.ttsCues.length > 0) {
    const ttsResult = await generateTTSWithTimeline(config.ttsCues, duration, {
      voice: opts.ttsVoice,
      rate: opts.ttsRate,
      engine: opts.ttsEngine,
      model: opts.ttsModel,
      quality: opts.ttsQuality,
      speed: opts.ttsSpeed,
    });
    audioPath = ttsResult.audioPath;
    ttsTimeline = ttsResult.timeline;

    if (audioPath) process.stderr.write(`TTS audio generated: ${audioPath}\n`);
    if (ttsTimeline) {
      process.stderr.write(`TTS timeline:\n`);
      for (const c of ttsTimeline.cues) {
        const marker = c.overlap_detected ? ' [SHIFTED]' : '';
        process.stderr.write(`  [${c.adjusted_start.toFixed(2)}s - ${c.adjusted_end.toFixed(2)}s] "${c.text.slice(0, 50)}"${marker}\n`);
      }
      if (ttsTimeline.suggested_minimum_duration > duration) {
        process.stderr.write(`\n  WARNING: TTS audio needs ${ttsTimeline.suggested_minimum_duration}s but video duration is ${duration}s.\n`);
        process.stderr.write(`  Audio will be truncated at ${duration}s. Increase duration with: -d ${ttsTimeline.suggested_minimum_duration}\n`);
        process.stderr.write(`  Or run --analyze --tts to see full timing breakdown.\n\n`);
      }
    }
  } else if (opts.tts) {
    process.stderr.write('No TTS cues found in HTML.\n');
  }

  const encoder = createEncoder({
    output: outputPath, fps: opts.fps,
    codec: opts.codec, quality: opts.quality,
    audioPath,
  });

  try {
    const isTTY = process.stderr.isTTY;
    let lastProgressSec = -10;
    await renderFrames(inputPath, { ...opts, duration }, async (buf, i, total) => {
      await encoder.write(buf);
      const sec = i / opts.fps;
      const pct = ((i + 1) / total * 100).toFixed(1);
      if (isTTY) {
        if (i % opts.fps === 0 || i === total - 1) {
          process.stderr.clearLine(0);
          process.stderr.cursorTo(0);
          process.stderr.write(`Rendering: ${sec.toFixed(1)}s / ${duration}s [${pct}%]`);
        }
      } else if (sec - lastProgressSec >= 10 || i === total - 1) {
        process.stderr.write(`Rendering: ${sec.toFixed(1)}s / ${duration}s [${pct}%]\n`);
        lastProgressSec = sec;
      }
    });

    if (isTTY) { process.stderr.clearLine(0); process.stderr.cursorTo(0); }
    process.stderr.write('Encoding final video...\n');
    await encoder.finish();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stderr.write(`Done in ${elapsed}s → ${outputPath}\n`);

    const summary = {
      output: outputPath,
      duration,
      frames: Math.ceil(opts.fps * duration),
      elapsed_seconds: parseFloat(elapsed),
    };
    if (ttsTimeline) summary.tts_timeline = ttsTimeline;
    console.log(JSON.stringify(summary));

  } catch (err) {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  } finally {
    cleanupTTS(audioPath);
  }
}

async function runStoryboard(inputPath, opts) {
  const config = await peekConfig(inputPath, opts.width, opts.height);
  const duration = opts.duration || config.duration || 10;
  const count = opts.storyboard;
  const outputPath = resolve(opts.output.replace(/\.\w+$/, '') + '_storyboard.png');

  process.stderr.write(`Generating ${count}-frame storyboard (${duration}s)...\n`);
  const result = await renderStoryboard(inputPath, count, duration, opts.width, opts.height, outputPath);
  process.stderr.write(`Storyboard saved: ${outputPath}\n`);
  console.log(JSON.stringify(result));
}

async function runValidate(inputPath, opts) {
  process.stderr.write('Validating HTML...\n');
  const result = await validateHTML(inputPath, opts.width, opts.height);
  if (result.has_errors) {
    process.stderr.write(`Found ${result.total_issues} issue(s):\n`);
    for (const issue of result.issues) {
      const icon = issue.severity === 'error' ? 'ERROR' : 'WARN';
      process.stderr.write(`  [${icon}] ${issue.type}: ${issue.message}\n`);
    }
  } else {
    process.stderr.write('No issues found.\n');
  }
  console.log(JSON.stringify(result, null, 2));
}

function runTemplate(opts) {
  const outputPath = resolve(opts.output.replace(/\.\w+$/, '') + '.html');
  process.stderr.write(`Generating template: ${opts.template} (${opts.templateScenes} scenes)...\n`);
  const html = generateTemplate(opts.template, { scenes: opts.templateScenes, duration: opts.duration });
  writeFileSync(outputPath, html, 'utf-8');
  process.stderr.write(`Template saved: ${outputPath}\n`);
  console.log(JSON.stringify({ output: outputPath, template: opts.template, scenes: opts.templateScenes }));
}

async function runTTSFirst(opts) {
  const scriptPath = resolve(opts.ttsFirst);
  if (!existsSync(scriptPath)) {
    console.error(`Error: Script file not found: ${scriptPath}`);
    process.exit(1);
  }
  const result = await generateFromScript(scriptPath, {
    voice: opts.ttsVoice,
    rate: opts.ttsRate,
    engine: opts.ttsEngine,
  });
  process.stderr.write(`TTS audio: ${result.audioPath}\n`);
  process.stderr.write(`Suggested duration: ${result.suggested_duration}s\n`);
  console.log(JSON.stringify({
    audio: result.audioPath,
    suggested_duration: result.suggested_duration,
    timeline: result.timeline,
  }, null, 2));
}

async function runPDF(inputPath, opts) {
  const outputPath = resolve(opts.pdf);
  const pdfTimesStr = opts.duration ? null : null;
  const config = await peekConfig(inputPath, opts.width, opts.height);
  const duration = opts.duration || config.duration || 10;

  const sceneTimes = [];
  if (config.ttsCues && config.ttsCues.length > 0) {
    for (const cue of config.ttsCues) {
      const sceneEnd = cue.start + 5;
      sceneTimes.push(Math.min(sceneEnd, duration - 0.5));
    }
  } else {
    const sceneCount = Math.max(1, Math.round(duration / 15));
    for (let i = 0; i < sceneCount; i++) {
      sceneTimes.push(Math.min((i + 0.5) * (duration / sceneCount), duration - 0.5));
    }
  }

  process.stderr.write(`Rendering PDF with ${sceneTimes.length} pages...\n`);
  const result = await renderPDF(inputPath, sceneTimes, opts.width, opts.height, outputPath);
  process.stderr.write(`PDF saved: ${outputPath}\n`);
  console.log(JSON.stringify(result));
}

async function runHTMLBundle(inputPath, opts) {
  const outputPath = resolve(opts.output.replace(/\.\w+$/, '') + '_bundle.html');
  process.stderr.write('Bundling HTML with embedded resources...\n');
  const result = await bundleHTML(inputPath, opts.width, opts.height, outputPath);
  process.stderr.write(`Bundle saved: ${outputPath} (${(result.size / 1024).toFixed(0)}KB)\n`);
  console.log(JSON.stringify(result));
}

async function runReview(inputPath, opts) {
  const outputPath = resolve(opts.output.replace(/\.\w+$/, '') + '_review.html');
  process.stderr.write('Generating interactive review page...\n');
  const result = await renderReview(inputPath, opts.width, opts.height, outputPath);
  process.stderr.write(`Review page saved: ${outputPath} (${(result.size / 1024).toFixed(0)}KB)\n`);
  process.stderr.write(`Duration: ${result.duration}s\n`);
  process.stderr.write(`Open in a browser to review. Keyboard shortcuts:\n`);
  process.stderr.write(`  Space = play/pause, A = annotate mode, Left/Right = step ±1s\n`);
  process.stderr.write(`  P = toggle annotation panel, C = copy feedback to clipboard\n`);
  console.log(JSON.stringify({ review: outputPath, duration: result.duration }));
}

function runAssemble(opts) {
  const timelinePath = resolve(opts.assemble);
  if (!existsSync(timelinePath)) {
    console.error(`Error: Timeline file not found: ${timelinePath}`);
    process.exit(1);
  }
  const outputPath = resolve(opts.output.replace(/\.\w+$/, '') + '.html');
  process.stderr.write(`Assembling scenes from ${timelinePath}...\n`);
  try {
    const result = assembleScenes(timelinePath, outputPath, { autoOffset: opts.autoOffset });
    process.stderr.write(`Assembled ${result.scene_count} scenes (${result.duration}s)\n`);
    process.stderr.write(`Output: ${outputPath} (${(result.size / 1024).toFixed(0)}KB)\n`);
    if (result.validation && result.validation.issues.length > 0) {
      process.stderr.write(`\n  Validation: ${result.validation.issues.length} issue(s):\n`);
      for (const issue of result.validation.issues) {
        process.stderr.write(`    [${issue.severity.toUpperCase()}] ${issue.message}\n`);
      }
      process.stderr.write('\n');
    }
    console.log(JSON.stringify(result));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
