# claude-explains CLI

Part of the claude-explains repo. This directory contains the CLI tool source — HTML/CSS/JS to video renderer with deterministic animation capture and TTS narration. The generation pipeline lives in `../pipeline/`.

## Standards

- Assume maximum scope. Be proactive. Don't ask for clarification when a reasonable assumption works.
- Strive for perfection. Release production-quality code only — no half-measures, no "good enough."
- Account for ALL edge cases. Think through what can go wrong at every boundary, every input variant, every timing condition.
- Research further than normal. Read the surrounding code, trace call chains, understand the full context before changing anything. Look at how callers use the function, what the tests expect, what the help text promises.
- Minimize dependencies. Currently: 1 npm dep (puppeteer), 2 system tools (ffmpeg, gtts). Do NOT add npm packages. Use child_process for system tools. Parse args manually.
- Every feature assumes an LLM (not a human) is the primary user. Structured JSON on stdout, progress on stderr.
- **When changing CLI behavior, ALWAYS update all affected documentation.** This includes: `--help` text in `cli.js` (printHelp, printDesignHelp, printFormatHelp, printComponentHelp), pipeline briefings in `../pipeline/briefings/`, agent definitions in `../pipeline/.claude/agents/`, the `/make-video` skill, and `docs/*.md`. The tool is useless if the agents using it don't know about its capabilities. Even the greatest most complex tool is nonsense if not used.

## Relationship to Pipeline

This directory is CLI tool source code only. The video generation pipeline lives in `../pipeline/` with its own CLAUDE.md, agents, and skills. Do not add pipeline orchestration logic here. The `--review` mode generates interactive preview HTML that the pipeline uses for human feedback loops — see `../pipeline/CLAUDE.md` for how it fits into the generation workflow.

## Documentation

Read these docs before implementing or planning anything related to their domain.

| Doc | Read when... |
|-----|-------------|
| [docs/architecture.md](docs/architecture.md) | Touching any source file, adding CLI modes, understanding the file map or how modules connect |
| [docs/design-decisions.md](docs/design-decisions.md) | Modifying time control, narrator sync, TTS, component rendering, browser launch, or the design guide system |
| [docs/components.md](docs/components.md) | Adding/modifying components, working with narrator sync attributes, or generating HTML that uses data-appear/data-highlight |
| [docs/testing.md](docs/testing.md) | Running tests, validating changes, or working around WSL2/Puppeteer performance constraints |
| [docs/directives.md](docs/directives.md) | Making product decisions, choosing between approaches, or unclear on project philosophy |

# Core project philosophy

The CLI and pipeline need to be engineered to produce animated visual walkthroughs, not static narrated slide decks. All implementation decisions need to help generation agents create large, central, readable, persistent diagrams that act as the main teaching surface. The tooling needs to make visual explanation easy: timed zooms, pans, highlights, arrows, callouts, color changes, component motion, staged reveals, narration-synced transitions, and temporary text overlays that appear and clear without clutter.

The generation workflow needs to support masterclass-quality educational videos with no artificial shortcuts. It needs to guide agents toward top-down explanations, clear concept hierarchy, careful pacing, cognitive pauses, repeated summaries when concepts were introduced long ago, and step-by-step walkthroughs when source material includes exercises, examples, or procedures. Dense material needs to be decomposed into understandable visual sequences rather than compressed into text-heavy slides.

The renderer, validators, help flags, schemas, and generation workflow need to be layout-aware and verification-driven. Small-text warnings should not encourage naive font-size increases; the system needs to guide agents toward structural fixes first, including spacing, scale, canvas size, label placement, callouts, staged reveals, diagram splitting, or scene decomposition. SVG/HTML outputs need to be renderable to PNG and visually/verifiably checked for overlap, clipping, unreadable labels, broken connectors, poor centering, excessive whitespace, weak hierarchy, visual inaccuracy, and animation readiness.

Diagrams need to be persistent and stable whenever continuity matters. The pipeline should discourage diagrams that appear, disappear, or zoom awkwardly without context. Instead, it needs to support stable visual anchors whose internal parts, surrounding labels, arrows, circles, highlights, and annotations animate in sync with narration. Text needs to advance alongside spoken words, remain brief, and clear before it creates clutter.

The CLI needs to support long-form video generation through granular, multi-stage artifacts rather than one large write. It needs to make chapters, scenes, shots, narration, timing maps, diagram plans, animation plans, verification reports, audio/render settings, and final render intent explicit and easy to generate, inspect, revise, and compose. The architecture needs to reduce context bloat, preserve detail across files, enable aggressive sub-agent delegation, and enforce quality gates after each diagram and scene.

Generation agents need to rely on the CLI help commands as the source of truth for available capabilities. When the CLI help is insufficient and agents must inspect the codebase or use external tools to understand or complete the workflow, those cases need to be documented in PROBLEMS.md so the CLI’s developer experience can be improved. The goal is developer tooling that reliably channels LLMs toward robust, inspectable, high-quality visual walkthrough generation.