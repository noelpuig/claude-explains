---
description: Verify an SVG diagram or HTML scene for visual quality. Renders to PNG, checks for overlaps, clipping, readability, density.
argument-hint: [file-path]
arguments: [file]
---

## Visual Verification

Verify the visual quality of: $file

### Step 1: CLI Validation
```
node ../cli/bin/claude-explains.js $file --validate
```
Parse the JSON output. Report all issues.

### Step 2: Render Preview
```
node ../cli/bin/claude-explains.js $file --preview 0 -o /tmp/verify_preview
```
Read the rendered PNG.

### Step 3: Visual Inspection
- [ ] All labels readable (not overlapping, not clipped)
- [ ] Content fills 80%+ of viewport
- [ ] Clear visual hierarchy (3 size tiers)
- [ ] Connector lines properly attached
- [ ] Content centered or intentionally positioned
- [ ] Colors match theme (60-30-10 rule)

### Step 4: Report
```json
{"file": "$file", "pass": true, "issues": []}
```
