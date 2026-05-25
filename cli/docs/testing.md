# Testing & Environment

## Slow Machine Notes
This dev machine (WSL2) is slow. Puppeteer needs `protocolTimeout: 180000` and page load
timeout of 60000ms. Always use `--no-sandbox` and `--disable-dev-shm-usage` Chrome flags.

## Test Commands

```bash
# Syntax check all source files
node --check src/cli.js && node --check src/renderer.js && node --check src/tts.js && node --check src/components.js && node --check src/templates.js

# Generate template scaffold
node bin/claude-explains.js --template presentation --template-scenes 8 -o test/scaffold

# TTS-first workflow (audio before HTML)
node bin/claude-explains.js --tts-first test/tts_script.json

# Analyze timing + TTS durations
node bin/claude-explains.js test/demo.html --analyze --tts

# Validate before rendering
node bin/claude-explains.js test/demo.html --validate

# Preview single frame
node bin/claude-explains.js test/demo.html --preview 2.5 -o test/preview

# Storyboard (all scenes in one image)
node bin/claude-explains.js test/demo.html --storyboard 9 -o test/story

# Full render with TTS
node bin/claude-explains.js test/demo.html -o test/output.mp4 --fps 30 --tts

# PDF export
node bin/claude-explains.js test/demo.html --pdf test/output.pdf

# Self-contained HTML bundle
node bin/claude-explains.js test/demo.html --html-bundle -o test/bundled

# Extract frames for manual verification
ffmpeg -i test/output.mp4 -vf "select='eq(n\,0)+eq(n\,30)+eq(n\,60)'" -vsync vfr test/frames/f_%03d.png
```
