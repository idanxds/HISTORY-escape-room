# Understanding Artificial Intelligence — three presentations

One script, delivered three ways.

| # | Format | Where it lives |
|---|--------|----------------|
| 1 | **Coded website** (interactive deck) | [`index.html`](index.html) — served at the repo root |
| 2 | **Gamma AI deck** | https://gamma.app/docs/duowyjpqop7mtq4 |
| 3 | **PowerPoint** (`.pptx`) | [`presentations/powerpoint/`](presentations/powerpoint/) |

## 1. Coded website

`index.html` is a single self-contained file — no build step, no CDN, no dependencies.
Open it in any browser or serve it with GitHub Pages.

- 6 slides: title, the four content slides, and an interactive quiz
- **← / →** or swipe to navigate, **N** toggles the full speaker script, **F** for fullscreen
- The quiz scores answers live and reveals the correct option either way
- Deep-links per slide (`index.html#3`), responsive down to phone width

## 2. Gamma

Generated through Gamma's AI with the full script preserved, 16:9, Nebulae theme,
AI-generated abstract imagery. Seven cards: four content slides, two quiz cards, answer key.
Edit it further in the Gamma editor; exports to PPTX/PDF from there.

## 3. PowerPoint

`presentations/powerpoint/Understanding-Artificial-Intelligence.pptx` — 8 slides, matching
dark theme, **speaker script in the notes field of every slide** so presenter view works.

Regenerate it with:

```bash
cd presentations/powerpoint
npm install pptxgenjs     # only if it isn't already available
node build-deck.js
```

## Archived

The earlier Hebrew history escape-room page has been moved to
[`archive/escape-room.html`](archive/escape-room.html). It is kept intact but is no longer
the page this repository serves — the root `index.html` is now the AI presentation.
