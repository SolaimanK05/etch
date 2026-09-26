# Etch — Design Spec (final, approved)

**v2 (Sun 27 Sep, approved):** `docs/design/CanvasV2.html` (tabs 0–3) overrides the canvas, the landing drawing, colours and type sizes. See §6, §12 and §13; where v2 and the older files disagree, v2 wins.

**Build exactly this.** The approved source of truth is the design canvas "Etch — App Design" (claude.ai artifact). Its files are copied verbatim in `docs/design/`:

| File | What it is |
|---|---|
| `docs/design/Prototype.dc.html` | **The interactive prototype. Canonical for layout, copy, colours and every animation.** Its `<helmet><style>` and inline styles are the CSS to port; its `Component` class is the state machine to port. |
| `docs/design/Empty.dc.html` | 0 · First run screen |
| `docs/design/Main.dc.html` | 1 · Rules broken (idle) |
| `docs/design/Running.dc.html` | 2 · Bob is making it so |
| `docs/design/Etched.dc.html` | 3 · Etched |
| `docs/design/System.dc.html` | Colour, type, controls and motion reference sheet |

The `.dc.html` files use a design-tool template syntax (`<x-dc>`, `{{holes}}`, `<sc-for>`, `<sc-if>`); port the markup and styles to React/TSX, keep every value. Where this document and the prototype disagree, the prototype wins; tell the user.

Module/file names shown in the mockups (`demo_app.api`, `api/routes.py:3`, etc.) are example data. The real UI shows whatever the scan returns.

---

## 1. Concept

**"The sketch becomes law."** Warm monochrome, one black action per screen, colour only when it means something (violation, obeys, Bob working, etched). The canvas is a drawing; everything around it is exact.

## 2. Theme variables

Put these in `frontend/src/styles/theme.css`, imported once in `main.tsx`. Components reference variables, never hex codes. (Do not put "token" in any filename: the template `.gitignore` ignores `*token*`.)

```css
:root {
  /* ground + ink */
  --paper: #FBFBFA;        /* app + canvas ground */
  --surface: #FFFFFF;      /* top bar, right rail, floating panels */
  --rule: #EAEAEA;         /* every border and divider, 1px */
  --ink: #111111;          /* headings, primary button, drawn lines */
  --body: #2F3437;         /* body text (12:1) */
  --muted: #55544F;        /* secondary text (7.3:1 on paper) */
  --subtle: #6B6A65;       /* hints, placeholders, separators in text (5.2:1) */
  --faint: #B5B4AF;        /* lines, strike line, disabled borders; NEVER text */
  --code-bg: #F7F6F3;      /* inline code, kbd */
  --hover: #F2F1EE;        /* ghost button hover, active tool */
  --dot: rgba(17,17,17,0.08); /* canvas dot grid */

  /* semantic pairs: background / text */
  --violation-bg: #FDEBEC; --violation: #9F2F2D;
  --obeys-bg:     #EDF3EC; --obeys:     #346538;
  --working-bg:   #FBF3DB; --working:   #7A5200;
  --etched-bg:    #E1F3FE; --etched:    #1F6C9F;
  --row-hover-violation: #FDF7F7;

  /* type */
  --font-ui: "Geist", ui-sans-serif, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;
  --font-canvas: "Nunito", sans-serif; /* canvas labels only */

  /* shape */
  --r-code: 4px; --r-control: 6px; --r-panel: 8px; --r-pill: 9999px;
  --shadow-float: 0 1px 2px rgba(17,17,17,0.03);
  --shadow-toast: 0 2px 8px rgba(17,17,17,0.04);

  /* motion */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
}
```

Fonts: Google Fonts `family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=Nunito:wght@600;700&display=swap` (link in `index.html`). No other families. No serif. No handwriting font.

All text/background pairs above were contrast-checked (≥ 4.6:1 for text).

## 3. Typography

| Use | Font | Size / weight / tracking / line-height |
|---|---|---|
| Wordmark `etch` | Geist | 22px / 600 / -0.02em / 1, with the hand-drawn underline SVG below it (see prototype header) |
| Rail heading (h1) | Geist | 30px / 600 / -0.02em / 1.15 |
| First-run headline | Geist | 56px / 600 / -0.03em / 1.05 |
| Seal word "Etched" | Geist | 32px / 600 / -0.02em / 1 |
| Body / rail subtext | Geist | 15px / 400 / 0 / 1.55 (first-run lead: 18px / 1.6) |
| Labels, buttons | Geist | 14px / 500 (primary button 16px / 500) |
| Status pills | Geist | 12px / 500 / 0.05em / **uppercase** — the only uppercase in the app |
| Paths, `file:line`, log, counts, branch | Geist Mono | 14px (paths), 13px (log, code), 12px (meta); `font-variant-numeric: tabular-nums` on anything that counts |
| Canvas box labels | Nunito | 24px / 700 (canvas only, never in the chrome) |

## 4. Layout (1440 × 900 reference, fluid)

- **Top bar** 56px, `--surface`, bottom `1px var(--rule)`. Left: wordmark · 1×20px divider · `repo` / branch (mono, branch icon). Right: activity pill (128px wide, hidden when idle) · violation-count pill · `Rescan` ghost button.
- **Canvas** fills the remaining width. `--paper` with a 22px dot grid (`radial-gradient(var(--dot) 1px, transparent 1px)`). Floating: tool bar top-centre (Excalidraw's own UI restyled), legend bottom-left ("you allowed" / "code does it anyway" + "Hover a red arrow or a row"), zoom and Replay bottom-right. White panels, `1px var(--rule)`, radius 8.
- **Right rail** fixed 400px, `--surface`, left `1px var(--rule)`. Top to bottom, the regions **never change position between phases** (this is what makes the flow feel continuous):
  1. Heading block: fixed 150px tall, 32px top margin, 28px side padding.
  2. Violation rows (list, 12px outer padding, 16px row padding).
  3. Flexible region (flex-grow): Bob's live log, or in `etched` the written-files list.
  4. Action slot: fixed 92px tall.
  5. Footer: `Etch it` button + hint, top border.
- Hierarchy comes from size, weight and space. Rows are separated by 1px rules, never cards. One black button visible per phase.

## 5. Components

- **Primary button**: `--ink` background, white text, 46px tall, radius 6, no shadow; hover `#2B2B2B`.
- **Ghost button**: white, `1px var(--rule)`, radius 6, 32–36px; hover `--hover`.
- **Disabled**: `--paper` background, `--faint` text, `--rule` border.
- **Every button**: `transform: scale(0.97)` on `:active`, `transition: transform 160ms var(--ease-out)`. Hover styles only inside `@media (hover:hover) and (pointer:fine)`.
- **Status pill**: height 24, radius 9999, 11px uppercase, 6px dot in the text colour.
- **kbd**: mono 11px, `1px` border, radius 4. "Make it so" shows `Ctrl ↵` (dark variant on the black button).
- **Violation row**: status icon slot (18px) · path in mono 13/500 with `:line` in `--muted` · right label (140px slot) · the offending import line below in a `--code-bg` code block, ellipsis on overflow.
- **Icons**: inline stroke SVG (2–2.2 stroke, round caps), as in the prototype. No icon library, no emoji.

## 6. Canvas (v2: native Etch canvas, see `docs/design/CanvasV2.html`)

Excalidraw is the drawing engine only. **None of its own UI is visible**; everything around the drawing is Etch's.

- **Hidden** (CSS on `.excalidraw`, since 0.18 has no props for these): main menu (hamburger), toolbar, "To move canvas…" hint, Library button and sidebar, style panel shown on selection, zoom/undo footer, help button, welcome screen, mobile bottom bar, right-click context menu.
- **Etch toolbar**, floating top-centre: white panel, `1px var(--rule)`, radius 8, padding 4, gap 2. Buttons 36×36, radius 6, icon 19px stroke 2, `--muted`; active and hover `--hover` background + `--ink` icon; press `scale(0.97)`. Key letter bottom-right, mono 9px `--subtle`. Tooltip below on hover: ink background, white 13px, `<kbd>` mono 12px `#CFCDC7`. Tools, with dividers after Pan and Pen: **Select V · Pan H · Box R · Arrow A · Note T · Pen P · Eraser E** (Excalidraw types `selection`, `hand`, `rectangle`, `arrow`, `text`, `freedraw`, `eraser`). Tooltips: "Select V", "Pan H · or hold Space", "Box R", "Arrow A · box to box = rule", "Note T", "Pen P", "Eraser E". Any other Excalidraw tool reached by a shortcut (D, O, L, K, I, F…) switches straight back to Select.
- **Bottom-left: legend** (panel style above, 13px `--muted`): "you allowed" · "code does it anyway" · dashed mini box "new box" · hint "Anything else is a note" in `--subtle`.
- **Bottom-right: two panels** of 30px buttons: [Undo, Redo] and [Zoom out, `100%` (mono 13, tabular, click = reset to 100%), Zoom in, divider, Fit]. Undo/redo send Ctrl+Z / Ctrl+Shift+Z keydown events to the `.excalidraw` element (verified to work; there is no API). Zoom steps ×1.1 / ÷1.1 around the canvas centre, clamped 0.1–30; Fit = `scrollToContent(…fitToViewport, 0.85)`.
- **Clean shapes, no wobble**: every element roughness 0. Code boxes: white fill (`#FFFFFF`, solid), stroke `#111111` 1.5, corner radius 10 (`roundness {type: 3, value: 10}`), label Nunito 24/700. Etch arrows: stroke 1.5, smooth curve (`roundness {type: 2}`), open arrowhead. User defaults (`currentItem*`): stroke `#111111`, width 1.5, roughness 0, solid white fill, round corners, round arrows, Nunito 20.
- Background transparent over our dot grid.
- **User-drawn boxes and arrows are the rules** (Excalidraw elements the user edits).
- **Red violation arrows are NOT Excalidraw elements.** They are computed from the scan and drawn on an **SVG overlay** positioned exactly above the Excalidraw canvas, so they cannot be erased and can use CSS transitions. Keep it in sync with Excalidraw's `onScrollChange(scrollX, scrollY, zoom)`: the overlay `<g>` gets `transform: scale(zoom) translate(scrollX, scrollY)` so scene coordinates line up. Arrow endpoints come from the source/target box element bounds.
- Violation arrow: `--violation`, width 2, `stroke-dasharray: 7 7`, round caps, small open arrowhead; a slight quadratic curve. Label pill on the arrow: `--violation-bg` / `--violation`, "2 imports" / "1 import".
- Each red arrow also has an invisible 18px-wide hit path (`pointer-events: stroke`) for hover. The overlay itself is `pointer-events: none`.
- Box subtitle under each label: mono 12px `--muted`, e.g. `demo_app.api · 4 files` (live file count).
- A **new box** (§12) is drawn dashed (`strokeStyle: "dashed"`, fill `--paper`) with a **NEW** tag (HTML, overlay layer) straddling its top-right corner: height 24, pill, 12px uppercase 500, `--hover` background, `--muted` text, `1px dashed var(--muted)` border. When Bob has built it the box turns into a normal code box and the tag becomes **CREATED** (`--obeys-bg` / `--obeys`, solid transparent border, 240ms colour crossfade), then fades out after 4 s.

## 7. The flow — state machine (port from `Prototype.dc.html`)

Phases: `empty` → `scanning` → `idle` → `running` → `done` → `etched` (+ `error`).

| Phase | Heading | Activity pill | Count pill | Log region | Action slot | Footer `Etch it` |
|---|---|---|---|---|---|---|
| `empty` | First-run screen (`Empty.dc.html`) | – | – | – | – | – |
| `idle` | "N imports break your drawing" + "You drew … These lines skip the services layer." | hidden | red, N violations | hidden | **Make it so** (black) + caption | disabled, "Unlocks at 0 violations" |
| `running` | "Making it so" + `m:ss · agent mode` + amber coin chip "max **1** Bobcoin" (§13) + 2px progress bar | "Bob is working" (amber, pulsing dot) | counts down | visible, streaming | `Stop` ghost + "Changes land on etch/make-it-so, never on main." | disabled |
| `done` | "Your code obeys the drawing" + "3 imports fixed in m:ss for" + amber coin chip counting up to the real cost (§13) | amber Bobcoin pill (§13) | green, 0 violations | visible (final) | caption "All clear on etch/make-it-so…" | **black, enabled**, "Make the drawing a rule" |
| `etched` | "Etched" + "Every pull request is now checked against this drawing. No AI in that check, no cost." | "Etched" (blue) | green, 0 | replaced by "Written to your repo" file list | **Open pull request** (black) | "Etched" in `--etched`, disabled |

Row status per violation: `open` (red dot + red rule pill, e.g. `api ↛ db`) → `queued` (grey ring, "queued") → `fixing` (pulsing amber dot, "fixing") → `fixed` (green check disc, "fixed", strike-through, path and code line turn `--muted`; never fade text with opacity).
Branch label: `main` in idle, `etch/make-it-so` from `running` on.

### Wiring the real Bob run (backend SSE → UI)

The prototype fakes this timeline; the real app drives the same state from `bob run --format stream-json` (see CLAUDE.md "Bob Shell facts"):

- On start: all rows `queued`, the first open row `fixing`.
- Each `tool_use` event → one log line. Verb map: `read_file`→`read`, `update_todo_list`→`plan`, subagent tools→`explore` (suffix "subagent"), `write_file`→`write` (suffix `+N` lines, green), `apply_diff`→`edit` (suffix `−a +b`), `execute_command`→`run` (suffix from the tool_result: "18 passed" in green, failures in `--violation`). Timestamp = seconds since start, `00:SS`.
- After each file-changing tool_result, the backend re-runs the scan (cheap, no AI) and emits the current violation list. Rows no longer in it become `fixed`; the next open row becomes `fixing`. This drives the count pill, the red arrows, the toast and the services file count.
- Final `result` event: `stats.session_costs` → the Bobcoin figure (count up to it); `duration_ms` → final clock; then one last rescan → phase `done` if 0 violations, else back to `idle` with the remaining rows and an inline error line.
- Bobcoin cost is only known at the end: during `running`, show `—` for coins and let it count up when `result` arrives. The progress bar tracks `fixed / total` rows.

## 8. Motion (exact values; this is the spec)

Global: only `transform` and `opacity` (plus colour/filter for crossfades) animate. Ease = `var(--ease-out)` unless stated. Transitions, not keyframes, for anything that can be retriggered; keyframes only for one-shot mount animations.

| # | Moment | Implementation |
|---|---|---|
| 1 | Button press | `scale(0.97)` on `:active`, 160ms ease-out |
| 2 | Rail heading changes phase | 4 stacked layers in the fixed 150px block; the active one `opacity:1; filter:blur(0)`, others `opacity:0; filter:blur(2px)`; `transition: opacity 200ms ease, filter 200ms ease` |
| 3 | Action slot changes phase | same stacked-layer crossfade (200ms); hidden layers get `pointer-events:none` |
| 4 | Rows persist across phases | the same three rows stay mounted from `idle` to `etched`; they change in place (no remount) |
| 5 | Row icon state | 4 stacked icons; active `opacity:1; scale(1)`, others `opacity:0; scale(0.9)`; 150ms (opacity ease, transform ease-out) |
| 6 | Row right label | 4 stacked labels, 200ms opacity/blur crossfade |
| 7 | Row fixed | strike line `scaleX(0→1)`, `transform-origin:left`, 200ms ease-out; path and code colour → `--muted` 180ms. Row never collapses |
| 8 | Rows enter after a scan / rescan | keyframe `translateY(6px)+opacity 0 → none`, 200ms ease-out, stagger 40ms per row |
| 9 | Row ↔ arrow hover | hovering a row or its arrow: arrow `stroke-width 2 → 3.4` (120ms ease), matching open rows background `--row-hover-violation` (120ms) |
| 10 | Log line arrives | keyframe `translateY(4px)+opacity 0 → none`, 150ms ease-out, no stagger; list anchored to the bottom (`justify-content:flex-end`), keep the last 11 lines |
| 11 | Log region appears | `opacity 0→1` + `translateY(8px→0)`, 200ms |
| 12 | Count pill | colour/background transition 200ms (red → green at 0); the digit is a 0–9 vertical strip in a 14px-tall `overflow:hidden` window, `translateY(-n × 14px)`, 280ms ease-out; label switches "violations"/"violation" |
| 13 | Activity pill | 144px container fades 200ms; "Bob is working" / "Etched" layers crossfade with blur(2px) 200ms; amber dot `pulse` 1.4s ease-in-out infinite |
| 14 | Progress bar | `transform: scaleX(fixed/total)`, origin left, 300ms ease-out (never animate width) |
| 15 | Bobcoin number | counts up to the final value (≈50ms ticks, 30% easing per tick), tabular numerals |
| 16 | Fix toast (canvas, top centre) | always mounted; show: `opacity 1, translate(-50%, 0)` over 200ms; hide: `opacity 0, translate(-50%, -8px)` over 150ms; shows for 1500ms; a new toast while one is visible = hide, wait 170ms, show the new text |
| 17 | Red arrow healed | arrow group `opacity → 0`, 240ms ease (the one slow moment) |
| 18 | `Etch it` enables | background/colour/border transition 200ms (grey → black). No pulse, no glow |
| 19 | Etched seal lands | `rotate(-4deg) scale(0.96→1)` + opacity, 260ms ease-out, once, no bounce |
| 20 | Written-files list | rows mount with #8's keyframe, delays 60/100/140/180ms |
| 21 | Rescan | refresh icon spins `360deg` per 700ms linear while the request is pending; stops on response; then #8 |
| 22 | First-run Scan | Scan button label crossfades to "Scanning…" (blur 2px, 200ms); then boxes appear with #8 (40ms stagger), arrows after them |

**Never animate:** Excalidraw drawing, tool selection, zoom, pan, keyboard shortcuts.
**Reduced motion** (`prefers-reduced-motion: reduce`): mount keyframes become opacity-only fades; `spin` and `pulse` stop; colour and opacity transitions stay.

## 9. Copy (use verbatim)

- First run: "Draw the architecture. Bob makes the code obey." · "Etch sketches your Python repo as boxes and arrows. Erase an arrow and every import that crosses it turns red." · label "Repository folder" · button "Scan" · "Read-only. Nothing changes until you press Make it so." · steps: "Draw — Keep the arrows you allow. Erase the ones you don't." / "Make it so — IBM Bob refactors every import that breaks the drawing, then reruns your tests." / "Etch it — The drawing becomes import-linter contracts, a Bob skill and a pull-request check." · top bar right: "Built with IBM Bob".
- Idle caption under Make it so: "IBM Bob refactors on a new branch, reruns your tests, then Etch rescans."
- Toast: "`<path>` now goes through services" (adapt the layer name to the rule).
- Legend: "you allowed" · "code does it anyway" · "new box" · "Anything else is a note".
- Log header: "Live from IBM Bob".
- Etched files list title: "Written to your repo"; rows `.importlinter` (N contracts), `.github/workflows/etch.yml` (PR check), `.bob/skills/etch-architecture/` (Bob skill), `.etch/drawing.json` (the sketch).

## 10. States still to build (same system)

- `scanning`: rows area shows 3 skeleton rows (`--code-bg` bars) until the scan returns.
- `error` (Bob failed or tests failed): heading "Bob stopped", the failing log line in `--violation`, action slot = "Try again" (black) + "Undo changes" (ghost). Rows keep their last status.
- 0 violations on first scan: heading "Your code obeys the drawing", `Etch it` enabled directly.

## 11. Banned

Serif fonts, handwriting fonts, Inter/Roboto/system-ui, gradients (except the dot grid), heavy shadows, cards around rows, emoji, icon libraries, uppercase outside pills, bounce/spring on anything, animating width/height/top/left, animation on high-frequency canvas actions.

## 12. New box: draw a box = new package (v2, task 8)

- **What counts:** a rectangle the user drew (not a scanned code box) whose label's first line is a lowercase Python package name (`^[a-z_][a-z0-9_]*$`, max 40, not a keyword, not an existing package) **and** that has at least one arrow to a code box. The label's remaining lines are the **intent**, folded to one line. First such box per name wins. Anything else stays a note.
- **Rules:** its arrows are rules like any other; the box counts as drawn, so undrawn imports into it become violations once it exists.
- **Rail:** a new-box row sits above the violation rows: dashed-square icon (18px slot), name in mono 14/500, right label "new package" in `--muted` (running: "building…" in `--working`; built: "created" in `--obeys`), and the intent in the code block (Geist 14, not mono) or "no description" in `--subtle`. When built, the code block shows `shop/pricing/ · N files` in mono.
- **Heading** (`idle` with boxes): "N imports, M new box(es)" (only boxes: "M new box(es) to build"); subtext "IBM Bob fixes the imports and builds the box you drew, then reruns your tests." Make it so is enabled whenever imports **or** boxes are pending; Etch it stays disabled until every drawn box is built.
- **Run:** the backend streams a `layers` event when the set of packages changes; the dashed box is then replaced by a real code box in place (same position and size, arrows kept) and its tag becomes CREATED. If a box is still missing at the end the run is an error: "Bob didn't create the pricing package".

## 13. Bobcoin highlight (v2)

Live runs learn the cost only from Bob's final `result` event, so never invent a running number.
- **Running:** amber chip in the rail meta line: coin icon + "max **1** Bobcoin". Chip = height 28, pill, `--working-bg`, mono 14/500 `--working`, numbers 600 `#5C3D00`, 16px coin icon (two concentric circles, stroke 2.2).
- **Done:** the same chip inline after "…fixed in m:ss for", popping in (`opacity 0→1, scale 0.9→1`, 420ms ease-out) and counting up to `stats.session_costs`.
- **Top bar:** from `done` on (through `etched`, until the next scan) an amber pill "◎ 0.61 BOBCOIN" (height 26, 12px uppercase, `--working-bg` / `--working`, 13px coin icon) sits left of the count pill.
