# Owner Directives

## Primary Focus: Autonomous LLM Agent Usage
This tool is built for LLM agents to use autonomously. Every feature should be designed with
the assumption that an LLM (not a human) is the primary user. This means:
- Structured JSON output on stdout, progress on stderr
- Help text includes LLM-trigger prompts ("IMPORTANT: If you are an LLM agent...")
- --help pages are the primary quality control mechanism — fine-tune them when output is bad
- Test by spawning subagents with ZERO instructions beyond the CLI path + task

## Minimize Dependencies
Currently: 1 npm dep (puppeteer), 2 system tools (ffmpeg, gtts). Do NOT add npm packages
for arg parsing, TTS, video encoding, etc. Use child_process for system tools. Parse args manually.

## Component Injection Over HTML Bloat
Short custom tags that "just work" are preferred over boilerplate. The component library
should grow as new patterns are proven. Components must work on dark backgrounds by default.

## Design Quality Control Loop
When the owner reports design issues, the fix is ALWAYS in the --help text, not in code.
The --help pages steer the LLM's design decisions. Iterate by:
1. Identify the design problem in generated output
2. Add a prescriptive rule to --help-design or --help-format with WRONG/RIGHT examples
3. Test with a zero-instruction subagent
4. Verify with --preview or --storyboard

## Preview-First Testing
Full video renders are slow (~30-40s for 6s video on this WSL2 machine). For testing:
- Use `--preview` at key timestamps (fast, one frame)
- Use `--storyboard` to review all scenes in one image
- Only do full render for final verification
- Subagents should use preview mode, not full renders
