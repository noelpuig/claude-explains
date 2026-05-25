# Narration Writer Briefing

## Rules

Run these commands to understand how visuals sync with narration:
```
node ../cli/bin/claude-explains.js --help-design
node ../cli/bin/claude-explains.js --help-format
```

Pay special attention to: ANIMATION QUALITY, VISUAL EXPLANATION MANDATE, TEXT ON SCREEN rules, and CONTINUITY RULES sections.

## Your Task

Write the narration script for ONE chapter. The chapter plan specifies topics, scenes, and source material.

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
