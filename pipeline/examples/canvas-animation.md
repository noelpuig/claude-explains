# Canvas Animation Pattern

## Reference implementation

`pipeline/examples/canvas-animation-reference.html` is a complete working scene.
Read it alongside this guide. It implements the exact pattern described here.

**What it shows:** An interactive review workflow. A cursor appears, moves to a
position, drags to create a selection box, a text input materializes, the cursor
changes to an I-beam, text types character by character with a blinking cursor,
the cursor moves to a "Copy" button, the button shows hover/pressed states, and
a checkmark confirms the action.

**Why it matters:** This scene could have been a static slide showing a rectangle
on a preview. Instead it shows the entire PROCESS — and that's what makes it
feel like a walkthrough instead of a slide deck. The viewer watches the interaction
happen, which teaches them how the feature works far better than a screenshot.

## When to use canvas vs SVG+data-attributes

Canvas animation (`<canvas>` + `requestAnimationFrame`) is for scenes where the
**motion is the content** — the viewer needs to see something happen frame by frame.

SVG+data-attributes is for scenes where the **layout is the content** — the viewer
needs to see spatial relationships, with elements revealed and highlighted over time.

### Canvas is the right choice when:
- Someone does something (cursor movement, drag, typing, clicking)
- Data moves visibly (packets, requests, signals traveling through a system)
- Something is built step by step (code written, config assembled, deployment rolling out)
- An action causes a visible chain reaction
- A transformation happens (source → compiled, raw → processed)

### SVG is the right choice when:
- The diagram's spatial layout teaches the concept (architecture, hierarchy, flow)
- Revealing and zooming into sections is the main interaction
- Comparing side-by-side structures
- The content is about what exists, not about what happens

## Architecture

```
requestAnimationFrame loop
  └─ elapsed = (timestamp - startTime) / 1000
  └─ clear canvas
  └─ draw each layer based on elapsed time
       ├─ background (always)
       ├─ persistent elements (selection box after completion)
       ├─ current animation phase (cursor, typing, button)
       └─ transitions (easing between phases)
```

The CLI's time controller overrides `Date.now`, `setTimeout`, and `requestAnimationFrame` — so canvas animations tied to elapsed time render frame-perfectly regardless of system speed.

## Timeline Design

Define phases as time ranges. Each phase draws only its relevant elements. Phases can overlap for crossfades.

```
PHASE 1  [0s────2s]     Background fade-in + label
PHASE 2  [1.8s──3.5s]   Cursor appears, moves to start position
PHASE 3  [3.5s──6s]     Cursor drags, selection box grows
PHASE 4  [6s────7.2s]   Text input fades in, cursor transitions
PHASE 5  [7.2s──11.5s]  Text cursor types characters
PHASE 6  [11.5s─14s]    Button appears, cursor moves to it, clicks
PHASE 7  [14s───16s]    Confirmation state (checkmark, label change)
```

## Pseudocode

```js
// === Setup ===
const W = 1966, H = 962;                    // match body dimensions
const ctx = canvas.getContext('2d');
const ACCENT = '#43add0', BG = '#0d1117';

// === Layout constants (all coordinates pre-planned) ===
const selStart = {x: 680, y: 220};           // where drag begins
const selEnd = {x: 1420, y: 540};            // where drag ends
const textBoxPos = {x: selEnd.x-380, y: selEnd.y+15};
const btnPos = {x: textBoxPos.x+300, y: textBoxPos.y+70, w: 130, h: 46};

// === Easing ===
function lerp(a, b, t) { return a + (b-a) * clamp(t, 0, 1); }
function easeInOut(t) { return t<0.5 ? 2*t*t : 1-pow(-2*t+2, 2)/2; }

// === Draw functions (each self-contained, takes alpha) ===
function drawCursor(x, y, type, alpha)       // 'pointer' | 'text' | 'crosshair'
function drawSelectionBox(x1, y1, x2, y2, alpha)  // dashed rect + tinted fill
function drawTextBox(x, y, text, cursorOn, alpha, confirmed)  // input field
function drawButton(x, y, w, h, state, alpha)     // 'normal' | 'hover' | 'pressed'
function drawCheckmark(x, y, scale, alpha)         // success indicator

// === Render loop ===
let startTime = null;
function render(timestamp) {
  if (!startTime) startTime = timestamp;
  const t = (timestamp - startTime) / 1000;   // seconds elapsed

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);

  // ALWAYS: background
  drawMockSlide(min(1, t/1.2));

  // PHASE 2: cursor appears and moves to drag start
  if (t >= 1.8 && t < 3.5) {
    const p = easeInOut((t - 1.8) / 1.5);
    drawCursor(lerp(center.x, selStart.x, p),
               lerp(center.y, selStart.y, p), 'crosshair', 1);
  }

  // PHASE 3: drag creates selection box
  if (t >= 3.5 && t < 6) {
    const p = easeInOut((t - 3.5) / 2.2);
    const cx = lerp(selStart.x, selEnd.x, p);
    const cy = lerp(selStart.y, selEnd.y, p);
    drawSelectionBox(selStart.x, selStart.y, cx, cy, 1);
    drawCursor(cx, cy, 'crosshair', 1);        // cursor at drag edge
  }

  // PHASE 5: typing
  if (t >= 7.2 && t < 14) {
    const chars = min(text.length, floor((t - 7.5) * 9));  // 9 chars/sec
    const blink = floor(t * 2.5) % 2 === 0;
    drawTextBox(pos.x, pos.y, text.slice(0, chars), blink, 1, false);
  }

  // PHASE 6: button + cursor moves to it
  if (t >= 11.5 && t < 14) {
    const state = t >= 13.2 ? 'pressed' : t >= 12.5 ? 'hover' : 'normal';
    drawButton(btn.x, btn.y, btn.w, btn.h, state, 1);
    // cursor lerps from text box to button center
    const p = easeInOut((t - 12.2) / 0.6);
    drawCursor(lerp(textX, btnCenterX, p), lerp(textY, btnCenterY, p), 'pointer', 1);
  }

  if (t < 16) requestAnimationFrame(render);
}
requestAnimationFrame(render);
```

## Cursor Sprites

Three cursor types, all drawn with `ctx.beginPath()` paths:

**Pointer** — white filled arrow with dark outline. 7-point polygon: tip at (0,0), shaft down to (0,28), elbow to click-hand shape.

**Text (I-beam)** — white stroked. Three lines: top serif (-8,0)→(8,0), vertical bar (0,0)→(0,28), bottom serif (-8,28)→(8,28). Use lineWidth 3 for visibility.

**Crosshair** — red stroked cross with faint circle. Horizontal (-16,0)→(16,0), vertical (0,-16)→(0,16) at lineWidth 2.5, plus a 10px radius circle at 30% opacity for visibility against dark backgrounds.

## Critical Implementation Rules

1. **Wrap canvas in a `.scene` div** — the assembler toggles `.active` to show/hide scenes. A bare canvas outside `.scene` bleeds through to subsequent scenes.

2. **Never set inline `opacity:1`** on the `.scene` wrapper — it overrides the CSS `.scene { opacity:0 }` that hides inactive scenes. Use only the class.

3. **Include `<anim-text>` trigger** — the component CSS (which defines highlight effects) only loads when a custom element exists. Add `<anim-text style="position:absolute;opacity:0;pointer-events:none">.</anim-text>` to ensure CSS injection.

4. **All coordinates pre-planned** — define start/end positions as constants at the top. Don't compute layout at draw time. The canvas is 1966x962 (or whatever the video resolution is).

5. **easeInOut on all movement** — linear interpolation looks robotic. Wrap every `lerp` progress value in `easeInOut()` for natural acceleration/deceleration.

6. **Each draw function takes an alpha parameter** — this enables crossfade transitions between phases. Multiply with `ctx.globalAlpha`, reset to 1 after drawing.

7. **Typing speed: 8-10 chars/sec** — `floor((t - startTime) * 9)` gives natural-feeling typing. Add a blinking cursor toggled by `floor(t * 2.5) % 2`.

8. **Button states** — three visual states: normal (accent), hover (lighter), pressed (darker + white border). Transition by checking time ranges, not events.

## Verification Process

This animation was verified using the following multi-agent frame inspection pipeline:

### Step 1: Export every second as PNG
```bash
for t in 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  claude-video scene.html --preview $t --width 1966 --height 962 -o /tmp/frame_${t}
done
```

### Step 2: Launch 3 visual-verifier agents in parallel
Each agent receives 5-6 frames and a checklist of what should be visible at each timestamp. The checklist is derived from the timeline phases above.

**Agent 1 (frames 0-5):** Checks background rendering, cursor visibility/size, selection box growth rate, crosshair positioning at drag edge.

**Agent 2 (frames 6-10):** Checks text input box appearance, I-beam cursor transition, typing speed/character count, cursor blink visibility, text box border styling.

**Agent 3 (frames 11-15):** Checks full text rendering, button appearance/states, pointer cursor positioning over button, checkmark rendering, confirmation label, selection box fade.

### Step 3: Fix every reported issue, re-export, re-verify
First pass found 11 issues:
- Crosshair too small (10px → 16px + circle)
- Typing too slow (6 chars/sec → 9 chars/sec)
- Labels overlapping at confirmation (fixed by hiding old label at t≥14)
- Text input overlapping selection box border (repositioned +15px)
- Canvas bleeding through to next scene (inline opacity:1 removed)
- Button text changed to match actual workflow ("Copy" not "Confirm")

Second pass: all frames clean. No bleed-through, no overlaps, all cursors correctly positioned and sized, typing completes before button appears, button states transition visually.

### Rule: never render video until every frame passes visual inspection.
