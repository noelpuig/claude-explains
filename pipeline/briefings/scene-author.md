# Scene Author Briefing

## Rules

Run these commands and follow ALL rules before writing anything:
```
node ../cli/bin/claude-explains.js --help-design
node ../cli/bin/claude-explains.js --help-format
node ../cli/bin/claude-explains.js --help-components
```

## Your Task

Create ONE scene HTML file. The scene plan JSON specifies: scene type (slide,
canvas, or programmatic-canvas), duration, diagram reference, narration text,
and visual actions.

**Factual accuracy**: If the scene presents technical content (code snippets,
terminology, process steps, architecture), verify it against the files in
`references/`. The references folder is the single source of truth for all
factual content in the video.

If the scene type is **programmatic-canvas**, the scene plan includes a
`canvas_animation` block from the planner's design brief with: what the
animation shows, why it's better than static SVG, and a phase-by-phase timeline.
Read `pipeline/examples/canvas-animation.md` for the implementation pattern and
`pipeline/examples/canvas-animation-reference.html` for a complete working
example. Follow the architecture: `requestAnimationFrame` loop, elapsed-time
phases, easing on all motion, pre-planned coordinates, alpha parameter on every
draw function. The reference shows a cursor dragging to create a selection,
typing text, and clicking a button — study how each phase transitions to the
next.

If the scene references a diagram, read the diagram manifest for element IDs — do NOT read the SVG file itself.

## Output

One HTML file at the path specified in your task. Must be a complete, self-contained HTML document that works with `--validate` and `--preview`.

## Verification

After writing, run:
```
node ../cli/bin/claude-explains.js <scene-file> --validate
node ../cli/bin/claude-explains.js <scene-file> --preview <mid_timestamp> -o /tmp/preview
```
Read the preview PNG. Fix and re-validate if needed. Max 3 iterations.

## Quick Reference (numbers only — rules are in --help)

- **Read `plan/design-brief.json` for the color palette.** Use ONLY those colors.
- Min 8 data-appear events (staggered across the scene, NOT all at once)
- Min 3 data-highlight events (synced to narrator word_timestamps)
- data-fade-out count must equal data-appear count
- Max 3 text overlays visible simultaneously
- Max 8 words per text overlay
- Canvas scenes: min 1 viewport transform. Use `data-viewport-focus="#element-id"`
  with `data-viewport-scale` to zoom to specific elements — the CLI auto-centers.
  Do NOT compute translate values manually.
- **Viewport zoom clipping**: When zooming to an element near the diagram edge,
  neighboring labels get cut off (e.g. "Verify Passwo...", "XSS Preve...").
  Keep zoom scale conservative (≤ 2.0) for edge elements. If a label is being
  clipped at a zoom level, reduce the scale or use `data-viewport-transform`
  with an explicit offset to keep all visible text within frame.
- Diagram elements start GREY — only highlight to accent when narrator mentions them
- **Backgrounds: 0% saturation only.** Use the background/surface colors from the
  design brief (pure dark grays like #111111, #1a1a1a). NEVER use dark blues,
  dark purples, or any background with a hue component.
- 0 CLI validation errors
- Screenshots at different timestamps MUST look different (not a static slide)
- If a scene has NO diagram (slide scene), text must fill the viewport:
  titles 40px+, body 24px+. Do NOT use small text in a corner when the
  whole 1920x1080 screen is available. Center content vertically.
  If something more important comes later, you can shrink/move the text then.
- Highlight lifecycle: diagram elements start GREY. They highlight to accent
  color when the narrator mentions them (data-highlight), then fade back to
  grey when narration moves on. An element that appears and stays grey while
  the narrator discusses it is WRONG.
- **No blank gaps between phases.** When transitioning from one content group
  to the next, start appearing new elements 1-2 seconds BEFORE the old group
  fully fades. The viewer should never see a blank screen between phases.
  Overlap the data-fade-out of the outgoing group with the data-appear of the
  incoming group. If previewing at the transition boundary shows an empty
  frame, tighten the overlap.

## Timestamp Handling

Use provisional timestamps when writing scenes. The timing engineer will replace
ALL timestamps with TTS-derived values after audio analysis.

Good provisional values: sequential like 0.5, 1.0, 1.5, 2.0, etc.
These make the scene previewable during development but are NOT final times.
Do NOT include the word "placeholder" in HTML comments or content.

Do NOT:
- Estimate final timestamps based on word count (150 wpm estimate drifts)
- Use chapter-global offsets yourself (the timing engineer handles this)
- Hard-code specific seconds that "feel right"

## Programmatic Canvas Scenes

These scenes use `<canvas>` with `requestAnimationFrame` for continuous motion.
The data-appear/data-highlight/data-fade-out rules do NOT apply — animation is
driven by the render loop's elapsed-time phases instead.

Requirements for programmatic-canvas scenes:
- Must use `requestAnimationFrame` with elapsed-time phases (NOT setTimeout)
- Must have ≥ 5 distinct animation phases with visual transitions between them
- Must include easeInOut on all position/size interpolation (no linear motion)
- All coordinates pre-planned as constants (no runtime layout computation)
- Every draw function takes an alpha parameter for crossfade transitions
- Wrap canvas in a `.scene` div (never bare canvas)
- Never set inline `opacity:1` on the `.scene` wrapper
- Include `<anim-text>` trigger element for CSS injection
- Preview at ≥ 3 timestamps to verify phase transitions are visible

Verification for canvas scenes:
```
node ../cli/bin/claude-video.js <scene-file> --preview 0 -o /tmp/canvas_t0
node ../cli/bin/claude-video.js <scene-file> --preview <25%> -o /tmp/canvas_t25
node ../cli/bin/claude-video.js <scene-file> --preview <50%> -o /tmp/canvas_t50
node ../cli/bin/claude-video.js <scene-file> --preview <75%> -o /tmp/canvas_t75
```
Read ALL four PNGs. Each must show visibly different content. If any two look
the same, the phase timeline has gaps — fix and re-verify.

## Report

```json
{"status": "pass|fail", "file": "<path>", "lines": N, "animation_type": "svg-canvas|programmatic-canvas|slide", "data_appear_count": N, "data_fade_out_count": N, "viewport_transforms": N, "canvas_phases": N, "issues": []}
```
