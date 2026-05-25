# Timing Engineer Briefing

## Rules

Run these commands for the narrator sync workflow and timing constraints:
```
node ../cli/bin/claude-explains.js --help-format
```

Pay special attention to: TTS SYNC WORKFLOW, CONTINUITY RULES, and NARRATOR SYNC sections.

## Your Task

Handle TTS timing for ONE chapter. Read the chapter's narration JSON and scene files.

## Process

1. Read the chapter's narration file and scene files
2. Read the chapter timeline to get each scene's `start` offset
3. Create a temporary HTML with ALL TTS cues for this chapter
   - Set data-tts-start values as cumulative chapter offsets:
     scene 1 cues start at 0, scene 2 cues start at scene2.start, etc.
   - If any cue text exceeds 120 words, split it into multiple cues
     at sentence boundaries BEFORE running TTS
4. Run: `node ../cli/bin/claude-explains.js <temp_file> --analyze --tts --tts-engine supertonic --tts-model supertonic-3`
5. Parse JSON output:
   - Extract adjusted_start (NOT requested_start) for each cue
   - Extract word_timestamps for each cue
   - Check for overlap warnings — if present, the cue timing needs adjustment
   - Check for long_cue_warnings — split any flagged cues and re-run
6. Update each scene HTML with CHAPTER-GLOBAL timestamps:
   - data-tts-start = cue's adjusted_start
   - data-appear = word_timestamp.time (already chapter-global from step 3)
   - data-highlight = word_timestamp.time for key terms
   - data-fade-out = appear_time + lifespan (5-10s, or before next topic)
   - data-viewport-at = scene.start + relative_viewport_time
   - data-viewport-focus = "#element-id" (CLI auto-centers the element)
   - data-viewport-scale = zoom level (e.g., 2.5)
   - Do NOT compute translate values manually — use data-viewport-focus instead
7. Insert deliberate silence gaps between cues:
   - Read the narration JSON's pause_after values for each cue — these are
     authoritative. Set each cue's data-tts-start to:
     previous_cue_adjusted_end + pause_after
   - If pause_after is missing, use these fallbacks:
     After formulas/proofs: 2.0s. After dense concepts: 1.5s.
     After memorization-heavy content: 2.5s. Normal: 0.5s.
   - During visual-only animation beats (builds, zooms, pans): match gap to
     animation duration — let it play in silence
   - Do NOT compress all cues back-to-back with 0.15s gaps. The pauses are
     intentional. Silence during animation is a feature, not dead air.
8. Verify: ALL timestamps in each scene must be >= scene.start offset

## Chapter-Global Timestamps (MANDATORY)

The CLI assembler (`--assemble`) copies all timestamps VERBATIM. It does NOT
rewrite any data-appear, data-fade-out, data-highlight, data-viewport-at, or
data-tts-start values. Therefore:

**ALL timestamps in scene files MUST be chapter-global absolute times.**

How to compute: add each scene's timeline `start` offset to every timestamp.
If scene 3 starts at 60s and a word is spoken at scene-local 5.2s, the correct
data-appear value is 60 + 5.2 = 65.2.

If you are uncertain about offsets, use `--auto-offset` as a safety net:
`node ../cli/bin/claude-explains.js --assemble timeline.json --auto-offset -o chapter.html`

## TTS Cue Length Limit

Max 120 words per data-tts cue. Split longer narration at sentence breaks.
Long cues cause cumulative word-timestamp drift because the TTS engine
generates one audio clip per cue and word timing is interpolated within it.

## Post-Update Verification

After updating all scene files:
1. Assemble: `node ../cli/bin/claude-explains.js --assemble timeline.json -o /tmp/chapter_test.html`
2. Check assembly output JSON for `validation.has_errors` — must be false
3. Run: `node ../cli/bin/claude-explains.js /tmp/chapter_test.html --analyze --tts --tts-engine supertonic --tts-model supertonic-3`
4. Verify ZERO overlap warnings and ZERO long_cue_warnings in the output
5. If issues found: fix timestamps and re-verify

## Timing Constraints

- data-fade-out count must equal data-appear count
- 0.4s minimum gap between one fade-out and next appear
- No overlays during viewport transitions (0.3s buffer after transform starts)
- Max 3 overlays visible at any timestamp
- Viewport transforms: 1.0-2.0s duration, ease-in-out
- Allocate time for construction-based animations (build + hold + de-emphasis)

## Report

```json
{"status": "done", "file": "<path>", "cues": N, "total_duration_sec": N, "overlaps_fixed": N}
```
