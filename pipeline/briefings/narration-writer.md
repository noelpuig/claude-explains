# Narration Writer Briefing

## Rules

Run these commands and follow ALL rules before writing anything:
```
node ../cli/bin/claude-video.js --help-design
node ../cli/bin/claude-video.js --help-format
node ../cli/bin/claude-video.js --help-components
```

Read these files before writing:
- `pipeline/briefings/quality-floor.md` — auto-reject criteria for TTS cues and narration density
- `plan/design-brief.json` — color palette and canvas animation entries
- Files in `references/` relevant to this chapter — the factual source material

Pay special attention to: ANIMATION QUALITY, VISUAL EXPLANATION MANDATE, TEXT ON SCREEN rules, and CONTINUITY RULES sections.

## Your Task

Write the narration script for ONE chapter. The chapter plan specifies topics, scenes, and source material.

**Factual accuracy**: All explanations must be grounded in the `references/` folder.
Read the relevant reference files for this chapter before writing. Do not invent
technical details, processes, or terminology not present in the references. If the
references are insufficient for a point you need to make, flag it in your report
rather than guessing.

## Canvas Animation Scenes

Check `plan/design-brief.json` for `canvas_animations` entries. If any scene in
your chapter is marked as programmatic-canvas, your visual_cues must reference
animation phases instead of data-highlight IDs. For example:

- SVG scene cue: `{"at_word": "server", "action": "highlight #server-box"}`
- Canvas scene cue: `{"at_word": "submits", "action": "cursor moves to submit button"}`

Canvas scenes have continuous motion driven by elapsed time. Your cues describe
what the viewer should SEE at that moment, not what DOM attribute to toggle.
The scene author uses your cues to align animation phases with narration.

## Output Format

One JSON file at the path specified in your task:
```json
[
  {
    "scene": "ch01_s01",
    "text": "Full narration for this scene.",
    "pause_after": 0.5,
    "visual_cues": [
      {"at_word": "hard drive", "action": "highlight #hdd-label"},
      {"at_word": "platter", "action": "zoom to #platter-region"},
      {"at_word": "moves on", "action": "dim previous highlight to grey"}
    ]
  }
]
```

## Animation-Paced Cues (Micro-Cues)

When narration lists items and EACH item triggers a multi-second animation
(zoom, diagram build, highlight lifecycle), split each item into its own cue.
The narrator says one keyword, then pauses while the animation plays.

```json
// BAD — narrator finishes all words before animations complete:
[{"scene": "ch03_s02", "text": "The three layers are: transport, session, and application.", "pause_after": 0.5}]

// GOOD — micro-cues, narrator waits for each animation:
[
  {"scene": "ch03_s02", "text": "The three layers are:", "pause_after": 0.5},
  {"scene": "ch03_s02", "text": "transport,", "pause_after": 3.0,
   "visual_cues": [{"at_word": "transport", "action": "highlight #transport-layer, zoom to #transport-layer"}]},
  {"scene": "ch03_s02", "text": "session,", "pause_after": 3.0,
   "visual_cues": [{"at_word": "session", "action": "highlight #session-layer, zoom to #session-layer"}]},
  {"scene": "ch03_s02", "text": "and application.", "pause_after": 3.0,
   "visual_cues": [{"at_word": "application", "action": "highlight #app-layer, zoom to #app-layer"}]}
]
```

The rule: **when each keyword triggers an animation lasting >2 seconds, that
keyword must be its own cue** with `pause_after` set to match the animation
duration. The timing engineer will translate `pause_after` into `data-tts-pause`
attributes, which tell the TTS system to insert silence after the cue.

Identify these patterns while writing:
- Listing components/features with per-item visual highlight
- Walking through steps where each step has a diagram build
- Comparing items where each one zooms to a different region
- Any narration where the viewer needs time to WATCH something happen

## Key Constraints

- Target pace: 150 words per minute
- After formulas: pause_after 2.0. After dense concepts: 1.5. Normal: 0.5
- Every sentence needs at least one visual_cue
- Include de-emphasis cues: when narration moves on, dim/grey the previous highlight
- Include construction cues: "build radius then sweep arc" not "show pie section"
- Narration drives visuals — on-screen text is labels (max 8 words), not the explanation
- Max 3 visual_cues active simultaneously
- End each chapter with a bridge to the next
- Max 120 words per data-tts cue. If a scene's narration exceeds 120 words,
  split into multiple cues at natural sentence breaks. Each cue gets its own
  data-tts element with its own data-tts-start time.
  REASON: The TTS engine generates one audio clip per cue. Within a long clip,
  word-level timing drifts progressively. Splitting into shorter cues resets
  the drift at every boundary, keeping sync within ~1-2 seconds.
- Cue splits create natural silence gaps. Set pause_after values deliberately:
    After formulas or proofs:              pause_after: 2.0
    After dense concept introductions:     pause_after: 1.5
    After memorization-heavy content:      pause_after: 2.5
    During visual-only animation beats:    pause_after: 3.0–5.0
    Normal sentence boundary:              pause_after: 0.5
- Do NOT write filler narration to cover visual animation time. If a diagram
  is building for 4 seconds and the narrator has nothing meaningful to add,
  end the cue and set a high pause_after. Silence during animation lets the
  viewer watch and process. Padding with "As we can see, the diagram now
  shows..." is bloated and distracting.
- Narration must NOT fill 90%+ of scene duration with continuous speech.
  Every scene needs deliberate silence gaps for cognitive processing.

## Report

```json
{"status": "done", "file": "<path>", "scenes": N, "word_count": N, "estimated_duration_sec": N}
```
