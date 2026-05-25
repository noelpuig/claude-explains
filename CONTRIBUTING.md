# Contributing to claude-explains

## Repository Structure

This is a monorepo with two parts:
- **cli/** — The renderer CLI tool (Node.js)
- **pipeline/** — Claude Code agents and skills for video generation

## Development Setup

```bash
git clone https://github.com/noelpuig/claude-explains.git
cd claude-explains/cli
npm install
```

### System Dependencies

- **ffmpeg** — `sudo apt install ffmpeg`
- **TTS engine** — `pip install gtts` or `sudo apt install espeak-ng`

## Testing

```bash
cd cli

# Syntax check all source files
npm run check

# Generate a test scaffold and preview
node bin/claude-explains.js --template presentation --template-scenes 5 -o test/scaffold
node bin/claude-explains.js test/scaffold.html --preview 2.5 -o test/preview
node bin/claude-explains.js test/scaffold.html --storyboard 9 -o test/story

# Generate interactive review page
node bin/claude-explains.js test/scaffold.html --review -o test/review
```

Use `--preview` and `--storyboard` for fast iteration. Full renders are slow (~30-40s for a 6s video).

## Pull Request Guidelines

1. Run `npm run check` before submitting
2. Test with `--preview` or `--storyboard` if your change affects rendering
3. Keep the single-dependency philosophy: do not add npm packages
4. Components must work on dark backgrounds by default

## Architecture

See [cli/docs/architecture.md](cli/docs/architecture.md) for the source file map and module responsibilities.

## Reporting Bugs

Open an issue with:
- The HTML input (or a minimal reproduction)
- The command you ran
- Expected vs actual output
- The `--validate` output if applicable
