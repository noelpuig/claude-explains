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

**Factual accuracy**: If your diagram depicts technical concepts (architecture,
processes, data flows, components), verify all element names, relationships, and
labels against the files in `references/`. The references folder is the single
source of truth. Do not invent components or connections not present in the source
material.

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
- Group related elements in `<g>` tags with descriptive IDs
- **Viewport zoom padding**: Labels and text near diagram edges WILL get clipped
  when the scene author zooms into nearby elements. Keep all labels at least
  120px from the SVG edges (top, bottom, left, right). If an element is meant
  to be a zoom target (used with data-viewport-focus), keep its labels at least
  200px from edges so neighboring text stays visible at 2x zoom.
- **Read `plan/design-brief.json` for the color palette.** Use ONLY those colors.
- No saturated colors anywhere: not in fills, not in backgrounds, not in
  outlines/strokes. Everything starts grey/muted (#888, #666, #ddd).
- Container/panel backgrounds: use the surface color from the design brief
  (pure gray, 0% saturation — typically #1a1a1a to #222222). NEVER use
  tinted pastels (#e8d5f5), dark blues (#1a1a2e), or any color with hue.
- The scene author adds data-highlight to color elements when narrated.

## Report

```json
{"status": "pass|fail", "file": "<path>", "element_ids": ["#id1", "#id2"], "label_count": N, "issues": []}
```
