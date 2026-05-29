![claude-explains](/.github/assets/banner.png)

**Claude generates fully animated explanation, presentation, and infographic videos from start to finish.**

Give Claude a topic. It writes the script, designs every scene, adds voiceover, and delivers a finished video. No video editing. No design skills. No manual work.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

---

## How It Works

1. You describe the video you want
2. Claude writes, designs, narrates, and renders it
3. You get an MP4

The entire process runs inside [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Just tell Claude what to make:

> *"Make a 60-second explainer video about how black holes form."*

Claude handles the script, the scene design, the voiceover, the animation timing, and the final render. It even reviews its own storyboard and fixes issues before delivering the video to you.

### Advanced Example

The more detail you give, the better the result. Here's a real-world example creating a promotional video for this repo:

> *"/goal Follow all rules in context strictly, create a promotional video about this repo, claude-explains that we can put in the README- the target will be general people visiting the repo for the first time. It must feature the same ASCII title as the banner with the exact same unicode characters, font, and colors. Here is how the title is built: [Pasted text #1 +33 lines] with the colors colors: background: #0d1117, tagline: #94a3b8 and gradient: linear-gradient(to right, #8bdeda 0%, #43add0 25%, #998ee0 50%, #e17dc2 75%, #ef9393 100%). The rest of the animation must be really dynamic, include complex canvas animations, and get content from the original README. Use examples, like having an animation typing a prompt that smoothly slides to one side so the main space can show the black hole animation to represent the AI creating the result right after the prompt. Or for another example, use an animation showing how the annotations work to tell the user they have easy manual control over the results. Use manual verification every 5 frames with batches of 2 subagents at a time scanning 10 images each."*

https://github.com/user-attachments/assets/f743ad30-5b9e-4679-9e4b-40a5e75f6893

This result was done using Claude Opus 4.6, it took about 20 minutes with 10 minutes being TTS & video rendering. Only minor issues were found with the banner title being unaligned.

## What You Can Create

| Type | Description |
|------|-------------|
| Explainer videos | Break down any topic with animated visuals and narration |
| Presentations | Narrated slide decks that play as videos, not static files |
| Infographics | Data stories with animated charts, stats, and timelines |
| Educational content | Lessons where visuals appear as the narrator introduces them |
| Video essays | Long-form narrated content with visual emphasis and pacing |

For example:

- Point it at your project and get a video tour of the codebase
- Make onboarding videos without writing another 40-page wiki
- Turn lecture notes into video lessons students replay before exams
- Ship sprint demos without screen recording and video editing
- Create product demos without a video production team

## What Makes It Different

Existing AI video tools give you a short summary over static slides. claude-explains builds actual animated scenes — diagrams that stay on screen and transform as the narrator walks through them, with no limit on how long or detailed the video can be.

**Diagrams that persist and transform.** Complex visuals stay on screen while being explained. They zoom into regions, highlight active parts, spawn arrows, and shift colors as the narration progresses. The viewer never loses context — no slides flashing in and out.

**No duration limit.** 30-second explainers, 10-minute walkthroughs, hour-long courses with chapters. The multi-agent pipeline breaks long content into chapters, delegates scenes to specialized sub-agents, and maintains consistent quality from the first scene to the last.

**Actually goes deep.** Dense material gets decomposed into step-by-step visual sequences with deliberate pacing — pauses after hard concepts, re-explanations of earlier ideas, breathing room where it matters. Not a surface-level summary. A real walkthrough that tracks with how people learn.

**Visuals sync to the voice.** When the narrator says a key word, it highlights on screen at that exact frame. When a new concept is introduced, the graphic appears at the moment it's mentioned. Nothing sits static while a voice talks over it.

**Full control over the result.** Specify visual style, pacing, diagram behavior, theme, explanation depth. Review the storyboard, annotate problems in the browser, paste feedback back to Claude — it fixes the exact issues you flagged until you approve.

![Interactive review mode — draw annotation boxes on problems and type feedback](/.github/assets/annotations.png)

**Built-in design intelligence.** Claude follows a design guide that enforces color contrast, readable text sizes, layout variety between scenes, and consistent theming. No rainbow color schemes, no tiny unreadable text, no walls of bullet points.

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **ffmpeg** — video encoding and audio processing
- **Voice engine** (one of): `gtts`, `espeak-ng`, or `supertonic`

### Install

```bash
# System dependencies
sudo apt install ffmpeg
pip install gtts                    # or: sudo apt install espeak-ng, pip install supertonic

# Clone and install
git clone https://github.com/noelpuig/claude-explains.git
cd claude-explains/cli
npm install
```

### Make Your First Video

Open Claude Code inside the repo and ask:

> *"Create a 45-second presentation about the water cycle. Use claude-explains to render it."*

Claude takes it from there.

### Long-Form Videos (5+ minutes)

For longer videos, launch Claude Code from `pipeline/` — that's where the agents and skills live:

```bash
cd pipeline
claude
# Then use /make-video or: claude --agent orchestrator
```

The pipeline breaks the video into chapters, delegates scenes to sub-agents, verifies every diagram, and optionally pauses for your review before rendering. Projects are created in `pipeline/projects/<name>/` with separate directories for plans, diagrams, scenes, timing, and output.

### Interactive Review

Before the final render, generate a review page to visually inspect the animation:

```bash
node cli/bin/claude-explains.js animation.html --review -o review
# Open review_review.html in your browser
```

**Controls:** Space = play/pause, A = annotate mode, S = subtitles, C = copy feedback

Draw boxes on any problems, type comments, and copy all annotations as a structured prompt. Paste it back to Claude and it fixes the exact issues you flagged.

### Output Formats

| Format | Description |
|--------|-------------|
| MP4 video | Default — the finished video with narration |
| Review HTML | Interactive preview with annotation tools |
| PDF | Static slide deck export |
| HTML bundle | Self-contained file you can share or host |
| Storyboard | Overview grid of all scenes in one image |

---

## Technical Reference

*For developers, contributors, and advanced users.*

### Repository Structure

```
claude-explains/
├── cli/                   CLI tool source (the renderer)
│   ├── bin/claude-explains.js
│   ├── src/               Renderer, encoder, TTS, components, time control
│   └── docs/              Architecture, design decisions, component API
└── pipeline/              Claude Code agents and skills for video generation
    ├── .claude/agents/    Orchestrator, scene-author, diagram-author, etc.
    ├── .claude/skills/    /make-video, /verify-diagram, /make-chapter
    └── briefings/         Rules that sub-agents read from disk
```

### How the Renderer Works

1. Claude writes an HTML file with scenes, animations, and narration cues
2. Speech audio is generated and word-level timestamps are measured
3. A headless browser captures each frame with deterministic time control — all browser timing APIs are overridden so animations render frame-perfectly regardless of system speed
4. Frames are piped through ffmpeg into the final MP4 with synced audio

### CLI Reference

```
claude-explains <input.html> [options]
```

**Modes**

| Flag | Description |
|------|-------------|
| *(default)* | Render to MP4 |
| `--analyze --tts` | JSON: animation info, TTS durations, word timestamps, overlap warnings |
| `--preview <sec>` | Single frame at given time (PNG) |
| `--storyboard <n>` | N frames composited into one grid |
| `--validate` | Lint: font sizes, contrast, images, sync timestamps |
| `--review` | Interactive HTML with play controls, annotation tools, TTS subtitles |
| `--tts-first <script.json>` | Generate audio before HTML, return exact timestamps |
| `--template <name>` | Scaffold HTML (`presentation`, `narrated`) |
| `--pdf <output.pdf>` | Static PDF export |
| `--html-bundle` | Self-contained HTML with embedded resources |

**Render Options**

| Flag | Default | Description |
|------|---------|-------------|
| `-o, --output` | `output.mp4` | Output file |
| `--width` | `1920` | Width in pixels |
| `--height` | `1080` | Height in pixels |
| `--fps` | `30` | Frames per second |
| `-d, --duration` | auto | Duration in seconds |
| `--no-components` | | Disable component library |

**Voice Options**

| Flag | Default | Description |
|------|---------|-------------|
| `--tts` | | Enable voiceover |
| `--tts-engine` | `auto` | `auto` or `supertonic` |
| `--tts-voice` | `en` | Language code or voice ID (M1-M5, F1-F5) |
| `--tts-model` | `supertonic-3` | Supertonic model variant |
| `--tts-quality` | `normal` | `fast` / `normal` / `high` / `ultra` |
| `--tts-speed` | `1.05` | Speech speed multiplier |

### LLM Agent Integration

Structured JSON on stdout, progress on stderr. Built-in help pages (`--help-design`, `--help-format`, `--help-components`) encode visual design rules that steer Claude's output quality.

**Agent workflow:**

```
1. claude-explains --help-design          # Design rules
2. claude-explains --help-format          # HTML structure
3. claude-explains --help-components      # Available components
4. Write HTML with TTS cues
5. claude-explains input.html --analyze --tts    # Timing data
6. Update HTML with exact timestamps
7. claude-explains input.html --validate         # Lint
8. claude-explains input.html --review -o review # Interactive preview
9. claude-explains input.html -o out.mp4 --tts   # Final render
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)
