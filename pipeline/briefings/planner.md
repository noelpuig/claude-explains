# Planner Briefing

You create the design brief and content plan BEFORE any implementation begins. Every design decision made here propagates to every sub-agent. Get it right — changing the palette or structure mid-project means redoing all work.

## Color Palette: The #1 Rule

**Dark mode backgrounds have ZERO saturation.** Not "low saturation." Not "barely visible blue." Zero.

The LLM failure mode is choosing "dark blue" (#1a1a2e, #0f1729, #161b2e) or "dark purple" (#1e1028, #1a1030) as the background because it "looks professional." It does not. It looks like a default Bootstrap dark theme from 2018. The correct dark mode background is a near-black neutral gray.

### Correct backgrounds
| Role | Hex range | HSL |
|------|-----------|-----|
| Main canvas | #0d0d0d – #141414 | hsl(0, 0%, 5–8%) |
| Surface/panel | #1a1a1a – #222222 | hsl(0, 0%, 10–13%) |
| Border/divider | #2a2a2a – #333333 | hsl(0, 0%, 16–20%) |

### Banned backgrounds (auto-reject)
Any hex where converting to HSL yields S > 0%:
- Dark blues: #0f1729, #1a1a2e, #161b2e, #0d1117
- Dark purples: #1e1028, #1a1030, #1c1030
- Dark teals: #0d1f1f, #0a1a1a
- Dark greens: #0d1a0d, #0a1a0f
- Any `background-color` with `hsl(H, S%, L%)` where S > 0
- Any `background` with `rgb` or hex that decodes to S > 0

The only color in the entire video is the accent color, and it appears ONLY on highlighted elements — never as a background, never as a large fill, never as a container color.

## Animation Opportunity Analysis

After planning the chapter/scene structure, review every scene with fresh eyes and
ask: **"Is this scene describing a process, interaction, or transformation where
showing the motion would teach more than showing the finished picture?"**

Read `pipeline/examples/canvas-animation.md` for the pattern and implementation
rules. Read `pipeline/examples/canvas-animation-reference.html` for a complete
working example — a scene that could have been a simple "here's an annotation
rectangle" but instead shows a cursor dragging to create the selection, typing
feedback character by character, and clicking a button with hover/press states.
That level of craft is what makes the difference between a slide deck and a
visual walkthrough.

### The creative question for each scene

For every scene in your plan, consider:
- Is someone DOING something? (interacting with a UI, running a command, configuring a system)
- Is something MOVING? (data flowing, requests propagating, deployments rolling out)
- Is something being BUILT? (code written, config assembled, infrastructure provisioned)
- Does an ACTION cause a visible REACTION? (click → processing → result)
- Does something TRANSFORM? (source → compiled, raw → processed, query → result)

If yes to any of these, write a `canvas_animations` entry in the design brief
with: the scene ID, what the animation shows, why it's better than static SVG,
and the phase-by-phase timeline of visual events.

If no — if the scene is about spatial relationships, architecture layout, or
comparison — SVG with data-appear/highlight and viewport zoom is the right tool.

Do not force canvas animation where a diagram with reveal-and-zoom is the natural
fit. The goal is to identify the scenes where animation genuinely adds meaning,
not to hit a quota.

## Content Plan

### References folder — the factual foundation

The `references/` folder in the project directory is the **single source of factual truth**.
Before planning, read EVERY file in `references/`. These may include:
- Source files (code, configs, specs) being explained
- Research markdown with notes, summaries, or prior research
- Files containing external links to documentation, papers, or references
- Paths pointing to other resources on the system

The content plan, chapter decomposition, and diagram specs must all be grounded
in what `references/` contains. If the references are insufficient for a chapter
or concept, note it in the watchlist as a gap that the user should fill.

Do NOT invent technical details, processes, or terminology not present in the
references. If something needs explaining but isn't covered, add a watchlist
item: "Chapter X references [concept] but no source material exists in
references/ — flag for user."

### Chapter decomposition

Read the source material in `references/` twice before planning. On the first read, identify the concept hierarchy:
1. What are the top-level ideas? (these become chapters)
2. What are the supporting concepts within each? (these become scenes)
3. What needs a visual diagram vs. what can be explained with text overlays?

### Pacing by depth

**Brief**: 1 diagram per concept. 3-5 scenes per chapter. No exercises, no recaps. Cut to the point.

**Standard**: 1-2 diagrams per concept. 5-8 scenes per chapter. Include one worked example per chapter if the source material has them. Brief recap at chapter boundaries.

**Deep**: Multiple diagrams per concept (overview → detail → example). 8-12 scenes per chapter. Full worked examples. Recap scenes after every 2-3 chapters. Cognitive pause scenes ("Let's step back and see the big picture"). Summary diagrams that reference all prior diagrams.

### Diagram planning

Every diagram in the design brief must specify:
- What it shows (not vaguely — list the specific elements)
- Why it exists (what concept it teaches that text alone can't)
- How many labels (must be ≤ 15; if more, split into multiple diagrams)
- Which elements will be highlighted during narration (the scene author needs this)

## Watchlist

The watchlist is your most valuable output after the palette. It's a list of things that WILL go wrong with this specific video if nobody is watching.

Think about:
1. **Topic-specific traps**: Does the topic have similar-sounding terms? Complex nested hierarchies? Concepts that look simple but have subtle distinctions?
2. **Visual traps**: Will the diagrams be too dense? Are there more than 15 things to label? Does the topic require showing code (which easily becomes too small to read)?
3. **Pacing traps**: Are some chapters much harder than others? Will the agent rush the hard parts? Are there natural "rest points" the narration should hit?
4. **Continuity traps**: Do later chapters reference concepts from early ones? Do diagram elements need to stay consistent across chapters?

Write each watchlist item as: what will go wrong, why, and what to do instead. Be specific to THIS topic.

## Output checklist

Before reporting done, verify:
- [ ] All files in `references/` have been read and their content is reflected in the plan
- [ ] `plan/design-brief.json` exists with all required fields
- [ ] `plan/outline.json` exists with chapter/scene structure
- [ ] Background colors are pure gray (S=0 in HSL)
- [ ] Accent color is appropriate for the topic
- [ ] accent_dim is the accent hex + "40"
- [ ] Every chapter in the plan has a clear single-concept focus
- [ ] Diagram count is realistic (not too many, not too few)
- [ ] Animation opportunity pass completed — every scene was considered
- [ ] Each `canvas_animations` entry has: scene, what, why, phases, reference
- [ ] Watchlist has ≥ 5 items specific to this topic
- [ ] Estimated duration matches the user's requested depth
