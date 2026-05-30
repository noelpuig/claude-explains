# Video Generation Pipeline

Part of the claude-explains repo. This directory contains the Claude-powered pipeline for creating videos. The CLI tool source lives in `../cli/`.

**When asked to create a video: read `briefings/before-start.md` FIRST.** It contains mandatory questions to ask the user, delegation rules, and rendering constraints. Do not skip it regardless of how the conversation starts.

## Structure

```
pipeline/
├── .claude/
│   ├── agents/         ← 8 agents (orchestrator, planner, chapter-coordinator, scene-author, diagram-author, narration-writer, timing-engineer, visual-verifier)
│   └── skills/         ← 3 skills (/make-video, /verify-diagram, /make-chapter)
├── briefings/          ← Canonical rule files read by sub-agents from disk
└── templates/          ← JSON schemas (progress, plans, timelines)
```

## Projects

Video projects are created in `../projects/<name>/` (one level up from pipeline/, gitignored). Each project gets its own subdirectory:

```
videos/
├── pipeline/
└── projects/
    └── my-video/
        ├── references/        source material, research, links — factual truth for the video
        ├── plan/              outline.json, chapter plans, scene plans
        ├── diagrams/          standalone visual files (SVG, HTML/CSS, Canvas)
        ├── scenes/            per-scene HTML files
        ├── timing/            TTS timing data per chapter
        ├── chapters/          assembled chapter HTML files
        ├── assembly/          final assembled HTML + review pages
        ├── output/            rendered MP4
        └── progress.json      pipeline state (survives compaction)
```

## References Folder

Every project has a `references/` folder that serves as the **single source of factual truth** for the video content. Before planning or writing anything, agents must consult this folder for the material they are explaining.

Contents may include:
- **Source files** — code, configs, specs, or documents being explained
- **Research markdown** — notes, summaries, or prior research on the topic
- **External links** — URLs to documentation, papers, or references
- **Paths to other resources** — pointers to files elsewhere on the system

All factual claims in narration, diagrams, and scenes must be grounded in `references/`. If the references are insufficient, agents should flag what's missing rather than inventing information.

## How to Create a Video

**Start Claude Code from inside `pipeline/`** so it discovers the agents and skills:

```bash
cd pipeline
claude
# Then use /make-video or claude --agent orchestrator
```

## Pipeline Stages

1. **Plan** — planner agent creates design brief (color palette, content plan, watchlist) + outline
2. **Diagrams** — standalone SVGs, each verified by visual-verifier
3. **Scenes** — per-scene HTML, each validated by CLI
4. **Timing** — TTS analysis, timestamp mapping to scenes
5. **Assembly** — combine into final HTML, storyboard, automated quality checks
6. **Human Review** — if opted in: interactive review HTML, user annotations, fix loop
7. **Render** — final MP4

## Human Review Mode

At pipeline start, the orchestrator asks whether the user wants to review before render.

If **yes**:
- After all automated checks pass (Stage 5), generate an interactive review HTML via `--review`
- User opens it in their browser, plays the animation, draws annotation boxes on problems, copies feedback
- User pastes annotations back — orchestrator fixes and regenerates review until "approved"
- Only then does render run

If **no**: fully autonomous, straight from assembly to render.

This is a FINAL human approval gate. It does not replace automated verification (validation, storyboard, visual verifier, quality audits). Those all run first. The review catches subjective issues code cannot detect.

## Max Quality Mode

At pipeline start, the orchestrator also asks the user what quality level they want.

If **maximum**: after every diagram and every scene is created, a visual-verifier sub-agent renders it to PNG and visually inspects for overlapping text, misaligned connectors, out-of-position components, clipping, poor spacing, and layout defects. Issues are returned as a strict fix list — the author must apply ALL fixes and re-verify until zero issues remain. This is expensive (one extra agent per artifact) but mandatory when requested.

If **standard**: automated CLI validation + storyboard checks only. No visual inspection agents.

## Key Rules

- **Sub-agents read rules from `briefings/` on disk.** Never paraphrase rules in prompts.
- **Progress survives compaction.** The orchestrator writes `progress.json` after each unit.
- **Quality is CLI-verified, not self-reported.** Sub-agents run `--validate` and `--preview`.
- **Scene 300 must match scene 1.** Quality does not degrade over time.
- **The CLI tool is at `../cli/bin/claude-explains.js`.** Do not modify CLI source from here.
- **Default TTS: supertonic 3.** Always use `--tts-engine supertonic --tts-model supertonic-3` unless the user requests otherwise.
