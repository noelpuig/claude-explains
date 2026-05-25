# claude-explains

Single repo containing both the CLI tool source code and the Claude-powered video generation pipeline.

- **cli/** — CLI tool source code. Has its own CLAUDE.md with development standards, `.claude/` files for CLI development workflows.
- **pipeline/** — Video generation pipeline. Has its own CLAUDE.md with generation rules, `.claude/` agents and skills for creating videos.

Work from inside the directory that matches your task. Each has its own agents, skills, and instructions.

This root CLAUDE.md should stay minimal. Add detail to the relevant subdirectory CLAUDE.md instead.

## Context Files

| Path | Read when... |
|------|-------------|
| [cli/CLAUDE.md](cli/CLAUDE.md) | Developing the CLI tool, modifying source in cli/src/ |
| [cli/docs/architecture.md](cli/docs/architecture.md) | Touching any CLI source file, adding modes, understanding module connections |
| [cli/docs/design-decisions.md](cli/docs/design-decisions.md) | Modifying time control, narrator sync, TTS, components, browser launch |
| [cli/docs/components.md](cli/docs/components.md) | Adding/modifying components, working with narrator sync attributes |
| [cli/docs/directives.md](cli/docs/directives.md) | Making product decisions, choosing between approaches |
| [pipeline/CLAUDE.md](pipeline/CLAUDE.md) | Creating videos, working with agents/skills, modifying the generation workflow |
| [pipeline/briefings/](pipeline/briefings/) | Understanding rules that sub-agents follow during generation |
