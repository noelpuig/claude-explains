# Components & Narrator Sync

## Available Components (auto-injected, dark-theme compatible)

| Tag | Key Attributes |
|-----|---------------|
| `<bar-chart>` | `data='[{"label":"Q1","value":300}]'` `colors` |
| `<combo-chart>` | `data='[{"label":"Q1","bar":300,"line":120}]'` `bar-color` `line-color` |
| `<scatter-chart>` | `data='[{"x":10,"y":15}]'` `color` `regression` `x-label` `y-label` |
| `<stat-grid>` | `cols="3"` |
| `<stat-box>` | `value` `label` `color` `delay` `effect` |
| `<time-line>` | `color` (container) |
| `<time-item>` | `year` `title` `delay` (text content = description) |
| `<compare-grid>` | container |
| `<compare-box>` | `type="good\|bad"` `label` `value` `delay` |
| `<quote-block>` | `cite` (text content = quote) |
| `<anim-text>` | `effect` `delay` `duration` |

## Narrator Sync Attributes

| Attribute | Effect |
|-----------|--------|
| `data-appear="14.2"` | Element hidden, fades in at t=14.2s |
| `data-appear-effect="fadeUp"` | Entrance animation: fade (default), fadeUp, fadeDown, fadeLeft, fadeRight, scaleIn, popIn, flipIn, revealDown |
| `data-highlight="14.2"` | Text highlights at t=14.2s |
| `data-highlight-effect="underline"` | Highlight animation: color (default), underline, marker, glow, box |
| `data-fade-out="18.0"` | Element fades out at t=18.0s |

### Highlight Effects
- `color` — Animated accent color shift + soft glow (default, replaces old static swap)
- `underline` — Accent line draws left-to-right under the text
- `marker` — Translucent highlighter pen sweeps across background
- `glow` — Text-shadow pulses bright then settles
- `box` — Rounded accent-tinted box grows behind text

### Appear Effects
Reuses existing component keyframes. `fade` is the default (simple opacity).
`fadeUp`, `fadeDown`, `fadeLeft`, `fadeRight`, `scaleIn`, `popIn`, `flipIn`, `revealDown`

Use `word_timestamps` from `--analyze --tts` or `--tts-first` to set exact values.
