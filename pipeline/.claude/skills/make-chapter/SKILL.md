---
description: Create all scenes for one chapter of a video. Reads chapter plan, creates scene HTML files, validates each.
argument-hint: [chapter-plan-path]
arguments: [chapter_plan]
---

## Chapter Creation

### Setup
1. Read the chapter plan at $chapter_plan
2. Read pipeline/briefings/scene-author.md for scene creation rules
3. Read pipeline/briefings/quality-floor.md for minimum requirements

### For Each Scene
1. Read the scene plan
2. Write the scene HTML (max 200 lines)
3. Run: `node ../cli/bin/claude-explains.js <scene> --validate`
4. Fix and re-validate if needed (max 3 tries)
5. Run --preview at mid-timestamp to visually verify

### Quality Checks Per Scene
- ≥3 data-appear events
- ≥2 data-fade-out events  
- ≥1 viewport transform (canvas scenes)
- No placeholder text
- ≤200 lines

### Report
```json
{"chapter": "...", "scenes": N, "pass": N, "fail": N}
```
