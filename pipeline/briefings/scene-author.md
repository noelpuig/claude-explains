# Scene Author Briefing

## Rules

Run these commands and follow ALL rules before writing anything:
```
node ../cli/bin/claude-explains.js --help-design
node ../cli/bin/claude-explains.js --help-format
node ../cli/bin/claude-explains.js --help-components
```

## Your Task

Create ONE scene HTML file. The scene plan JSON specifies: scene type (slide or canvas), duration, diagram reference, narration text, and visual actions.

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

- Max 200 lines per file
- Min 8 data-appear events (staggered across the scene, NOT all at once)
- Min 3 data-highlight events (synced to narrator word_timestamps)
- data-fade-out count must equal data-appear count
- Max 3 text overlays visible simultaneously
- Max 8 words per text overlay
- Canvas scenes: min 1 viewport transform. Use `data-viewport-focus="#element-id"`
  with `data-viewport-scale` to zoom to specific elements — the CLI auto-centers.
  Do NOT compute translate values manually.
- Diagram elements start GREY — only highlight to accent when narrator mentions them
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

## Report

```json
{"status": "pass|fail", "file": "<path>", "lines": N, "data_appear_count": N, "data_fade_out_count": N, "viewport_transforms": N, "issues": []}
```
