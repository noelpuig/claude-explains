---
description: Generate a full video using the multi-stage pipeline. Use for any video creation request. Reads source material, plans chapters, creates diagrams, writes scenes, generates timing, assembles, and renders.
argument-hint: [topic-or-source-path] [duration-minutes]
arguments: [topic, duration]
---

## Video Generation Pipeline

Topic: $topic
Target duration: $duration minutes
CLI tool: ../cli/bin/claude-video.js

** MANDATORY FIRST STEP — do this BEFORE anything else, no exceptions: **

Ask the user these questions BEFORE reading help commands, before planning,
before creating any files. Do NOT proceed until they answer ALL of them:

> Before I start:
>
> 1. Do you want to review the animation before final render?
>    - **Yes** — I'll pause after assembly so you can annotate problems in your browser.
>    - **No** — Fully autonomous, render without stopping.
>
> 2. What quality level?
>    - **Standard** — Automated validation + storyboard checks.
>    - **Maximum** — All standard checks PLUS visual verification sub-agents that render
>      every diagram and scene to PNG and visually inspect for layout issues. Slower but
>      catches problems the LLM can't see from code alone.
>
> 3. How deep should the explanations go? Here are three estimated lengths based on
>    what you asked for:
>    - **Brief** (~X minutes) — Cover the main concepts, skip details. Quick overview.
>    - **Standard** (~Y minutes) — Explain each concept clearly with examples.
>    - **Deep** (~Z minutes) — Full deep-dive with step-by-step walkthroughs,
>      exercises, formula derivations, and repeated summaries for retention.
>
>    (Fill X, Y, Z with estimates based on the source material and topic complexity.)

After the user answers, spawn the **planner** agent immediately with the topic,
source material path, user answers, and estimated duration. Do NOT pick colors
yourself — the planner creates the design brief with the full palette.

When the planner returns:
- Read `plan/design-brief.json`
- Confirm the accent color with the user: "I'll use **#XXXXXX** as the accent."
- Store in progress.json: `"human_review"`, `"max_quality"`, `"target_depth"`,
  `"estimated_duration_min"`, `"accent_color"`, and the full palette
- The planner also creates `plan/outline.json` — review it before proceeding

Pass `plan/design-brief.json` path to EVERY sub-agent delegation. Sub-agents
read their colors from this file. The accent color MUST NOT change across the video.

DO NOT skip this. DO NOT assume the answers. DO NOT start implementation until
the planner has completed and the user has confirmed the accent color.

---

### Stage 0: References
Ensure the project's `references/` folder exists and contains the source material
for the video. This folder is the **single source of factual truth** — all
explanations, narration, and diagrams must be grounded in its contents. It may
contain source files, research markdown, external links, or paths to other resources.
If the user provided source material, confirm it's in `references/` before proceeding.

### Stage 1: Plan (via planner agent)
1. Spawn planner agent with topic, source material, user answers, estimated duration
2. Planner reads `references/` and CLI guides, then creates:
   - `plan/design-brief.json` — color palette (0-saturation dark backgrounds), content plan, watchlist
   - `plan/outline.json` — chapter/scene structure
3. Confirm accent color with user
4. Create a project directory at `../projects/$topic/` (if planner hasn't already),
   including `references/` for source material
5. Create plan/chapters/chXX.json for each chapter
6. Create plan/scenes/chXX_sXX.json for each scene

### Stage 2: Diagrams
7. Identify unique diagrams needed from the outline
8. For each diagram, spawn a diagram-author agent
9. Verify each diagram passes validation
10. **IF max_quality:** For EACH diagram, spawn a visual-verifier agent that:
    - Renders the diagram to PNG via `--preview 0`
    - Reads the PNG and visually inspects for: overlapping text, text outside containers,
      misaligned connector lines, components out of position, unreadable labels,
      elements clipped by the viewport edge, poor spacing, unclear hierarchy
    - Returns a strict list of fixes — diagram-author must apply ALL fixes and re-verify
    - This loop repeats until the visual-verifier passes with zero issues

### Stage 3: Scenes
11. For each chapter, spawn a chapter-coordinator agent
12. Each coordinator creates and verifies all scenes in its chapter
13. Quality audit: randomly preview 2-3 scenes per chapter AT DIFFERENT TIMESTAMPS
    - If previews at t=25%, t=50%, t=75% of a scene look identical → the scene is STATIC
    - Static scenes must be rewritten with staggered data-appear and data-highlight events
    - Every scene needs ≥8 data-appear (staggered), ≥3 data-highlight (synced to narrator)
    - Diagram elements must start GREY and only highlight when narrator discusses them
    - Viewport zooms must use `data-viewport-focus="#element-id"` to target specific
      elements — do NOT compute translate values manually (the CLI auto-centers)
14. **IF max_quality:** For EACH scene, spawn a visual-verifier agent that:
    - Renders the scene at 3 timestamps (25%, 50%, 75% of scene duration)
    - Reads each PNG and checks: elements visible? highlights active? text readable?
      layout correct? colors muted except current highlight? no overlapping elements?
    - Returns a strict list of fixes — the scene must be corrected and re-verified

### Stage 4: Timing
13. For each chapter, spawn a timing-engineer agent
14. Update all scene files with exact TTS timestamps

### Stage 5: Assembly + Automated Review
15. Combine chapter files into final HTML
16. Run storyboard with auto-scaled frame count
17. Inspect storyboard against the 10-point checklist
18. ALL automated checks must pass before proceeding

### Stage 6: Human Review (only if opted in)
19. Generate review page: `node ../cli/bin/claude-video.js assembly/video.html --review -o assembly/review`
20. Tell the user to open the review HTML in their browser
21. Wait for the user to paste annotations or say "approved"
22. If annotations: fix issues, re-run stages 5-6 until approved
23. This does NOT replace any automated checks — it is additional

### Stage 7: Render
24. `node ../cli/bin/claude-video.js assembly/video.html -o output/video.mp4 --tts --tts-engine supertonic --tts-model supertonic-3`

### Progress Tracking
After every completed unit, update progress.json. If conversation is compacted, read progress.json to resume.
