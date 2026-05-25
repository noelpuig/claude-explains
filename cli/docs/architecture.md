# Architecture

HTML/CSS/JS to video renderer with deterministic animation capture and TTS narration.
Designed as a tool for autonomous LLM agent video generation pipelines.

Single npm dependency: `puppeteer`. System deps: `ffmpeg`, `gtts` (pip).

```
bin/claude-explains.js      CLI entry point
src/cli.js             Arg parsing, help system (--help, --help-design, --help-format,
                       --help-components), orchestration for all modes
src/renderer.js        Puppeteer frame capture, storyboard, PDF, HTML bundle, validate
src/encoder.js         FFmpeg pipe (image2pipe PNG → H.264 MP4)
src/tts.js             TTS generation, overlap prevention, tts-first mode, word timestamps
src/time-controller.js Injected browser script: overrides Date, performance.now, RAF,
                       timers, seeks CSS animations, narrator sync (data-appear/highlight)
src/components.js      Auto-injected Web Components (charts, stats, timeline, etc.)
src/templates.js       HTML scaffold generator for --template mode
```

## CLI Modes

| Mode | Description |
|------|-------------|
| `(default)` | Render HTML to MP4 video |
| `--analyze --tts` | JSON with animations, TTS durations, word timestamps, overlap warnings |
| `--preview <sec>` | Single frame at given time → PNG |
| `--storyboard <n>` | N frames composited into one grid image |
| `--validate` | Pre-render lint: font sizes, contrast, images, sync timestamps |
| `--tts-first script.json` | Generate TTS audio before HTML exists, return exact timestamps |
| `--template <name>` | Scaffold ready-to-fill HTML (presentation, narrated) |
| `--pdf output.pdf` | Export scenes as static PDF pages (at animation-complete times) |
| `--html-bundle` | Self-contained HTML with all resources embedded as base64 |
