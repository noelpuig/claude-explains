# Before Starting Any Video Generation

** Read this BEFORE doing anything else. These rules apply regardless of whether
you are the main session, the orchestrator agent, or the /make-video skill. **

## Three Mandatory Questions

Your FIRST message when asked to create a video must be these questions.
Nothing else — no planning, no file reading, no acknowledging the topic.
Do NOT proceed until the user answers ALL three.

> Before I start, I need to know:
>
> 1. **Review before render?**
>    - **Yes** — I'll pause after assembly so you can annotate problems in your browser.
>    - **No** — Fully autonomous, render without stopping.
>
> 2. **Quality level?**
>    - **Standard** — Automated validation + storyboard checks.
>    - **Maximum** — All standard checks PLUS visual verification sub-agents that render
>      every diagram and scene to PNG and inspect for layout issues.
>
> 3. **How deep should the explanations go?** (Estimate durations based on
>    the topic and source material complexity):
>    - **Brief** (~X min) — Main concepts, skip details.
>    - **Standard** (~Y min) — Clear explanations with examples.
>    - **Deep** (~Z min) — Full deep-dive, exercises, derivations, summaries.

After the user answers, choose ONE accent color for the entire video and confirm it
with the user. Pick based on the topic's tone (coral/red for energy, teal for tech,
blue for corporate, green for nature/growth). State: "I'll use **#XXXXXX** as the
accent color throughout." The user can override with a specific color.

Store in progress.json: `"human_review"`, `"max_quality"`, `"target_depth"`,
`"estimated_duration_min"`, `"accent_color": "#XXXXXX"`. If progress.json already
exists with answers, confirm with the user and resume from the stored phase.

Every sub-agent delegation must include the accent color. Every scene, diagram,
and chapter must use this exact color for `.accent { color: #XXXXXX }`. The
accent color MUST NOT change between scenes, chapters, or diagrams.

## You MUST Use Sub-Agents

You are a COORDINATOR. You never write HTML, SVG, CSS, narration, or timing
data yourself. Always delegate to the appropriate sub-agent:
- diagram-author — creates SVG diagrams
- scene-author — creates scene HTML files (via chapter-coordinator for batching)
- narration-writer — writes narration scripts
- timing-engineer — runs TTS analysis and updates timestamps
- visual-verifier — renders to PNG and inspects for defects (max quality mode)

If a sub-agent fails: re-spawn with error context (max 3 retries), try a
different agent type, or STOP and ask the user. NEVER implement the work yourself.

## Sequential Rendering Only

Render ONE chapter at a time. Each render spawns Chromium + TTS + FFmpeg (~500MB RAM).
Parallel renders WILL crash. Never write bash loops to batch renders.
Never remove --tts flags to work around failures. After each render, verify the
output has audio: `ffprobe -v error -select_streams a -show_entries stream=codec_name output.mp4`

## Read the CLI Guides

Before planning, read ALL three:
```
node ../cli/bin/claude-explains.js --help-design
node ../cli/bin/claude-explains.js --help-format
node ../cli/bin/claude-explains.js --help-components
```
These are the source of truth for visual rules, scene structure, and available components.
Key features agents must use:
- `data-viewport-focus="#element-id"` + `data-viewport-scale` for element-targeted zoom
  (the CLI auto-centers — never compute translate values manually)
- `data-highlight` for narrator-synced element highlighting (grey → accent → grey lifecycle)
- Native SVG preview: `claude-explains diagram.svg --preview 0` (no wrapper HTML needed)
