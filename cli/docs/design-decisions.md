# Key Design Decisions

## Deterministic Time Control
The time-controller.js is injected via `evaluateOnNewDocument` before any page scripts run.
It overrides ALL timing APIs (Date.now, performance.now, requestAnimationFrame, setTimeout,
setInterval) and uses a WeakMap to track/seek CSS animations via Web Animations API.
Each frame: `tick(frameDelta)` → process timers → fire RAF → seek CSS animations → process sync items → screenshot.

## Narrator Sync System
Elements with `data-appear="14.2"`, `data-highlight="14.2"`, or `data-fade-out="18.0"` are
processed by the time controller during each tick. This lets visuals sync precisely with TTS
narration — text highlights when the narrator says that word, components appear on cue.
The `--analyze --tts` and `--tts-first` modes provide `word_timestamps` arrays so the LLM
can look up exactly when each word is spoken and set sync attributes accordingly.

## TTS Overlap Prevention
Audio clips are measured with ffprobe for actual duration. Overlapping clips are auto-shifted
with 150ms gaps. The mixing uses a silent base track + sequential `amix` chain (NOT a single
amix with all inputs, which caused the original overlap bug).

## Component Library (dark-theme default)
Auto-injected Web Components using light DOM and semi-transparent rgba() backgrounds that
work on dark backgrounds without creating jarring white boxes. Components inherit text color
from the page. Charts are gated in --help-components with explicit warnings against
fabricating data for abstract concepts — charts are ONLY for real numerical data.

## Design Guide as LLM Steering
The --help-design, --help-format, and --help-components pages are the primary mechanism for
controlling LLM output quality. These went through 3 iterations of subagent testing.
Key rules enforced:
- 60-30-10 color rule: ONE accent color, everything else base+text
- No mixed themes: all dark or all light, never both
- Minimum 18px text, no opacity below 0.65
- ONE idea per scene, max ONE supporting component
- Layout variety: no more than 2 consecutive scenes with same template
- Content must fill 60%+ of frame vertically
- Charts only for verifiable numerical data (not abstract concepts)

## Browser Launch Architecture
TTS generation (blocking execSync) must happen BEFORE the render browser session, not during.
A quick `peekConfig` browser opens/closes to extract HTML metadata, then TTS runs, then the
render browser opens fresh. This prevents CDP socket timeouts during blocking TTS generation.
