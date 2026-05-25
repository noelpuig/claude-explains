# Chapter Coordinator Briefing

## Rules

Run these commands and follow ALL rules before writing anything:
```
node ../cli/bin/claude-explains.js --help-design
node ../cli/bin/claude-explains.js --help-format
node ../cli/bin/claude-explains.js --help-components
```

## Your Task

Create ALL scenes for ONE chapter. Write each scene as a standalone HTML file, validate and preview each, then verify the chapter as a whole.

## Process

1. Read your chapter plan
2. Read the diagram manifest for available element IDs
3. For each scene in order:
   a. Write scenes/chXX_sNN.html (complete HTML document)
   b. Run: `node ../cli/bin/claude-explains.js <scene> --validate`
   c. Fix any issues (max 3 tries per scene)
   d. Run: `node ../cli/bin/claude-explains.js <scene> --preview <mid> -o /tmp/preview`
   e. Read the preview PNG and verify
4. After all scenes, run a chapter storyboard:
   `node ../cli/bin/claude-explains.js chapters/chXX.html --storyboard N -o /tmp/storyboard`
   where N = ceil(duration / 10) for chapters under 300s, ceil(duration / 15) for longer.
   Check all 10 items from --help-format "MANDATORY STORYBOARD SELF-CHECK"

## Quick Reference

- Max 200 lines per scene
- Min 8 data-appear events, staggered across scene duration (NOT all at once)
- Min 3 data-highlight events synced to narrator words
- data-fade-out count must equal data-appear count
- Max 3 overlays visible, max 8 words each
- Canvas scenes: min 1 viewport transform. Use `data-viewport-focus="#element-id"`
  with `data-viewport-scale` to zoom to specific elements — no manual translate math
- Diagram elements start GREY — highlight to accent only when narrator discusses them
- Max 2 consecutive scenes with the same layout pattern
- Screenshots at different timestamps MUST look different — if they don't, rewrite
- Each scene gets FULL effort — scene 20 must match scene 1. This is audited.

## Post-Timing Validation (MANDATORY after timing engineer completes)

After the timing engineer updates all scene files:

1. Assemble the chapter:
   `node ../cli/bin/claude-explains.js --assemble timing/chXX_timeline.json -o chapters/chXX.html`

2. Check assembly output JSON for timestamp coherence warnings:
   - If `validation.has_errors` is true: timing engineer must fix timestamps

3. Run TTS analysis on assembled chapter:
   `node ../cli/bin/claude-explains.js chapters/chXX.html --analyze --tts --tts-engine supertonic --tts-model supertonic-3`

4. Verify:
   - ZERO overlap warnings (`tts.has_overlaps` must be false)
   - ZERO long cue warnings (`tts.long_cue_warnings` must be empty)
   - `tts.suggested_minimum_duration` <= chapter timeline duration

5. Preview at three timestamps (25%, 50%, 75% of chapter duration):
   `node ../cli/bin/claude-explains.js chapters/chXX.html --preview <time> -o /tmp/prev`
   Read each PNG. Verify non-blank frames with visible content.

6. If ANY check fails: return to timing engineer with the specific error.
   Do NOT proceed to master assembly with a failing chapter.

## Report

```json
{
  "status": "pass|fail",
  "chapter": "<id>",
  "scenes_completed": N,
  "scenes_total": N,
  "quality": {"avg_appear_events": N, "avg_fade_out_events": N, "avg_transforms": N},
  "issues": []
}
```
