# Quality Floor — Quick Reference Checklist

These are the quantitative minimums. For full rules, run `--help-design` and `--help-format`.

## Scene HTML

| Metric | Requirement |
|--------|-------------|
| data-appear events | >= 8 (elements must appear over time, not all at once) |
| data-highlight events | >= 3 (narrator words must trigger visual highlights) |
| data-fade-out count | must equal data-appear count |
| Viewport transforms (canvas scenes) | >= 1 |
| Max simultaneous overlays | 3 |
| Max words per overlay | 8 |
| CLI validation errors | 0 |
| Staggered timing | data-appear times must span the full scene duration, NOT all at the same second |

## SVG Diagram

| Metric | Requirement |
|--------|-------------|
| viewBox | "0 0 1920 1080" |
| Unique IDs on animatable elements | all |
| Max labels | 15 |
| Label overlaps | 0 |
| Default element colors | grey/muted (#888, #ddd, #aaa) — NOT saturated |

## Timeline JSON

| Metric | Requirement |
|--------|-------------|
| Scene start values | Monotonically increasing |
| Duplicate starts | No two scenes may have start=0 (unless single scene) |
| Start gaps | >= 3s between consecutive scene starts |
| Duration | Last scene start + 5s <= total duration |

## TTS Cues

| Metric | Requirement |
|--------|-------------|
| Max words per cue | 120 (split longer narration into multiple cues) |
| Overlap warnings | 0 (after --analyze --tts on assembled chapter) |
| Timestamp model | Chapter-global absolute (NOT scene-local) |
| Narration density | Must NOT fill 90%+ of scene duration continuously |
| Animation-paced content | Items with per-item animation >2s must use micro-cues (one keyword per cue) with data-tts-pause matching animation duration |

## Dark Mode Color Rules

All videos use dark backgrounds with ZERO saturation (pure grays, no hue).

| Role | Correct range | HSL |
|------|--------------|-----|
| Main background | #0d0d0d – #141414 | hsl(0, 0%, 5–8%) |
| Surface/panel | #1a1a1a – #222222 | hsl(0, 0%, 10–13%) |
| Border/divider | #2a2a2a – #333333 | hsl(0, 0%, 16–20%) |
| Text primary | #e0e0e0 – #ebebeb | hsl(0, 0%, 88–92%) |
| Text secondary | #888888 – #999999 | hsl(0, 0%, 53–60%) |
| Element default | #888888 | Grey until highlighted |

**BANNED backgrounds**: any hex/rgb/hsl where saturation > 0%. This includes dark blues (#1a1a2e), dark purples (#1e1028), dark teals (#0d1f1f), and anything with a visible hue component. The planner defines exact palette values in `plan/design-brief.json`.

## Auto-Reject (any of these = immediate failure)

- "Content here", "TODO", "placeholder", "Lorem ipsum"
- data-appear without matching data-fade-out
- Background color with HSL saturation > 0% (dark blues, purples, teals — any hue)
- Diagram elements with permanent saturated fill colors (red, blue, green)
- Blank gap > 2 seconds between content phases (old elements fully faded before new ones appear)
- Labels clipped by viewport zoom (truncated text visible in preview PNG)
- All data-appear events at the same timestamp (static fade-in, not animation)
- Zero data-highlight events (no narrator sync)
- Empty data-tts attributes
- Screenshots at different timestamps look identical (static scene)
- Timeline JSON with all scene starts at 0 (except single-scene chapters)
- TTS overlap warnings present in assembled chapter
- Scene-local timestamps detected by assembler validation
- data-tts cue exceeding 120 words without being split
- Narration that fills 90%+ of scene duration with continuous speech (no pauses)
- Rendered MP4 without an audio stream (rendered without TTS — always use --tts)
- Rendered MP4 under 1MB per minute of duration (likely missing audio or frames)
- Slide scene (no diagram) where largest text is under 32px (use the space)
- SVG diagram elements with permanent saturated fill/stroke (must start grey)
- Diagram element discussed by narrator but never highlighted (missing data-highlight)
