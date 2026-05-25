# Diagram Author Briefing

## Rules

Run these commands and follow ALL rules before writing anything:
```
node ../cli/bin/claude-explains.js --help-design
node ../cli/bin/claude-explains.js --help-format
node ../cli/bin/claude-explains.js --help-components
```

## Your Task

Create ONE visual diagram file. SVG is the default, but HTML/CSS, JS Canvas, or a mix are valid if the content benefits.

**Before writing any code**, plan the layout:
1. List all elements with names, sizes, and spatial relationships
2. Assign coordinates — place major components first, then labels
3. Check spacing — no two labels within 30px vertically
4. Verify coverage — content spans 70-90% of the 1920x1080 space

## Output

One file at the path specified in your task. Update the diagram manifest with element IDs when done.

## Verification

Render the diagram directly (the CLI accepts SVG files natively — no wrapper needed):
```
node ../cli/bin/claude-explains.js <diagram.svg> --preview 0 -o /tmp/diagram_preview
```
READ the preview PNG. Check EVERY item:
- Can you read ALL labels without zooming?
- Are any labels overlapping each other? (even partial overlap)
- Are connector lines/arrows touching the elements they connect?
- Does the diagram fill 70-90% of the 1920x1080 viewport?
- Are elements grey/muted (not permanently saturated)?
- Is the overall layout balanced (not crammed in one corner)?

Fix every issue you find and re-render. Do NOT report "pass" if you see ANY defect.
Iterate until the PNG matches your intended layout.

The visual-verifier agent will inspect your PNG next. Every defect you miss,
it will catch and send back. Save yourself the round-trip: be thorough now.

## Quick Reference

- viewBox: "0 0 1920 1080" for SVG
- Font sizes: 24px titles, 18px primary labels, 14px secondary
- Every animatable element needs a unique id (used by data-highlight AND
  data-viewport-focus for element-targeted zoom)
- Max 15 labels per diagram
- Max 150 lines per file
- Group related elements in `<g>` tags with descriptive IDs
- No saturated colors anywhere: not in fills, not in backgrounds, not in
  outlines/strokes. Everything starts grey/muted (#888, #666, #ddd).
  This includes container backgrounds — use rgba(255,255,255,0.05) or
  similar near-transparent, not tinted pastels like #e8d5f5.
  The scene author adds data-highlight to color elements when narrated.

## Report

```json
{"status": "pass|fail", "file": "<path>", "element_ids": ["#id1", "#id2"], "label_count": N, "issues": []}
```
