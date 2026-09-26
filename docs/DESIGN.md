# Etch — Design Direction

**Concept: "the sketch becomes law."** The canvas is loose and hand-drawn (Excalidraw's own rough style). Everything around it is precise and engineered, like an instrument panel holding a sheet of drafting paper. That contrast between hand-drawn and exact is the brand.

```
Direction: Technical / instrument around a drafting sheet. Loose sketch in the middle, exact chrome around it, because Etch turns a doodle into an enforced rule.
Palette:   paper #F5F6F8 · panel #FFFFFF · ink #16181D · ink-muted #5B616E · hairline #E3E5EA · accent "etch blue" #1F3FD6
           semantic: violation #C8321E · obeys #11734F · working (Bob running) #9A4A06
Type:      Geist (UI) 13/14/16/20/28 px, weights 400/500/600 · Geist Mono only for file:line, module paths, Bob log, counts
Layout:    top bar 52px · canvas fills the rest · right rail 380px (violations → Make it so → Bob live log → Etch it). Hierarchy by size/weight/space; hairlines, not cards.
Motion:    arrow colour red→green 300ms ease-out when a violation is fixed; list rows strike through then collapse 200ms; Bob log lines fade in 120ms. Nothing bounces; no motion on hover beyond colour.
```

Contrast checked: every text colour ≥ 4.9:1 on paper and panel (accent 7.1:1). Dark theme values below all ≥ 6.5:1 on #121418.

## Theme variables (put in `frontend/src/styles/theme.css`)
Do NOT name any file with "token" in it; the template .gitignore ignores `*token*`.

```css
:root {
  --paper: #F5F6F8;   --panel: #FFFFFF;  --ink: #16181D;  --ink-muted: #5B616E;
  --hairline: #E3E5EA; --accent: #1F3FD6; --accent-ink: #FFFFFF;
  --violation: #C8321E; --obeys: #11734F; --working: #9A4A06;
  --font-ui: "Geist", ui-sans-serif, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;
  --r-sm: 4px; --r-md: 8px;
  --shadow-float: 0 1px 2px rgb(22 24 29 / .06), 0 8px 24px rgb(22 24 29 / .08);
  --space: 4px; /* use multiples */
}
[data-theme="dark"] {
  --paper: #121418; --panel: #1A1D23; --ink: #ECEDEF; --ink-muted: #9AA0AC;
  --hairline: #2A2E36; --accent: #7C93FF; --accent-ink: #0B0D12;
  --violation: #FF7A66; --obeys: #4CC38A; --working: #F0A04B;
}
```
Fonts: `npm i geist` (Vercel's package) or load Geist + Geist Mono from Google Fonts.

## Signature moments (what makes it feel like ours)
1. **Red-ink markup**: violations are drawn on the canvas as red, rough, dashed Excalidraw arrows, like a reviewer marking up paper. Counter chip in the top bar: `3 violations` in --violation.
2. **Make it so**: the only filled --accent button on the screen. While Bob runs, the rail shows a live mono log of Bob's steps (todo items, files edited, commands) with a --working pulse dot and a running Bobcoin counter.
3. **Heal**: as rescan clears each violation, its red arrow turns --obeys green and redraws; the counter ticks down to `0 violations`.
4. **Etch it (the seal)**: clicking Etch it stamps a small engraved seal on the canvas corner: `ETCHED · 2026-09-27 · 4 rules`, and the rail lists the generated files (.importlinter, SKILL.md, workflow).
5. **Wordmark**: lowercase `etch` in Geist 600 with a single hand-drawn underline stroke (SVG). No mascot, no gradient.

## Banned for this app
Purple/blue gradients, three-card feature rows, emoji icons, uppercase labels everywhere, one radius + shadow on every block, Inter/Roboto/system-ui. Excalidraw's hand font appears only on the canvas, never in the chrome.

## States to design
Empty (no repo scanned: "Point Etch at a Python repo" + path input + Scan) · scanning skeleton · 0 violations ("Your code obeys the drawing") · Bob running · Bob failed (show error + "Undo with Bob rollback") · etched.
