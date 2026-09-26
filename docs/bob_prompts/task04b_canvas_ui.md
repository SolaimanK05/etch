# Etch — Task 4b: the UI, built exactly to the approved design

Build the real React UI on top of the logic finished in task 4a. **The approved design is the source of truth:** `docs/DESIGN.md`, plus `docs/design/Prototype.dc.html` (canonical for markup, copy, colours and motion) and `docs/design/Empty.dc.html` (the first-run screen). Port their markup and inline styles to React/TSX and keep every value. Where DESIGN.md and the prototype disagree, the prototype wins; list those cases in your final reply.

## Scope
- **Read only:** `docs/DESIGN.md`, `docs/design/Prototype.dc.html`, `docs/design/Empty.dc.html`, `frontend/src/lib/{state,drawing,geometry}.ts`, `frontend/src/types.ts`, `frontend/src/api.ts`, `frontend/src/main.tsx`, `frontend/index.html`. Skip the other design files; their content is already in the two above.
- **Create/edit only inside `frontend/`** (the file list is below). **Do NOT modify** `src/lib/state.ts`, `drawing.ts`, `geometry.ts`, any `*.test.ts`, `types.ts`, `package.json`, `vite.config.ts` or any tsconfig. Don't install packages.
- **Styling:** plain CSS with the DESIGN.md §2 variables. No CSS framework, no icon library, no emoji. No filename may contain "token".
- **Windows PowerShell:** use `npm.cmd`. Never start `npm.cmd run dev` or any server. The maintainer checks the UI visually in a browser after you finish.

## Files
```
frontend/index.html              # Google Fonts <link> from DESIGN.md §2, <title>Etch</title>
frontend/src/main.tsx            # import "@excalidraw/excalidraw/index.css" then "./styles/theme.css"; delete src/index.css
frontend/src/styles/theme.css    # §2 variables + every global class/keyframe from the prototype <style> + Excalidraw restyle + responsive rules
frontend/src/App.tsx             # useReducer(reducer, initialState), data flow, layout
frontend/src/components/Icons.tsx     # the prototype's inline SVGs (branch, refresh, check, arrowhead markers)
frontend/src/components/TopBar.tsx
frontend/src/components/FirstRun.tsx  # Empty.dc.html (left column + decorative right SVG verbatim)
frontend/src/components/Canvas.tsx    # Excalidraw + ViolationOverlay + Toast + Seal + Legend
frontend/src/components/ViolationOverlay.tsx
frontend/src/components/Toast.tsx
frontend/src/components/Rail.tsx      # heading layers, rows, log/files region, action slot, footer
frontend/src/components/Rows.tsx
frontend/src/components/LogPanel.tsx
frontend/src/components/CountUp.tsx   # motion #15
frontend/src/lib/persist.ts      # try/catch-wrapped localStorage get/set (never throws)
frontend/src/lib/run.ts          # startRun seam (task 5 replaces its body)
frontend/src/lib/simulate.ts     # scripted run for ?simulate (demo fallback)
```

## Data flow (App.tsx)
- **Scan** (FirstRun submit, or Rescan in the top bar):
  1. Dispatch `scanStarted`, then call `api.scan({ repo_path })`. The backend auto-detects the root package.
  2. **First scan, or a changed layer set:** dispatch `scanSucceeded(graph, drawingOfGraph(graph))`, so every real import starts as a black arrow and there are 0 violations.
  3. **Rescan with the same layer ids:** dispatch `scanSucceeded(graph, state.drawing)`, so the user's edits survive.
  4. Then call `api.check` right away.
  5. On error, dispatch `scanFailed(message)`.
- **Live check:** Canvas reports drawing changes, and App dispatches `drawingChanged`. Debounce by 250ms, then call `api.check({ repo_path, root_package: graph.root_package, drawing })` and dispatch `checkSucceeded`. Drop out-of-order responses using a request counter.
- **Etch it:** call `api.etchIt(...)`, then dispatch `etchSucceeded`.
- **Make it so** (button, or `Ctrl+Enter` when enabled): if `location.search` contains `simulate`, call `simulateRun(state, dispatch)`; otherwise call `startRun(req, dispatch)`. Both return a cancel function, which **Stop** calls.
- **Clock:** while `phase === "running"`, dispatch `tick(Date.now())` every 250ms.
- **`lib/run.ts`:** `export function startRun(req: MakeItSoRequest, dispatch): () => void`. For now it dispatches `runStarted`, then `runFailed("Make it so is wired in task 5")`. Task 5 replaces the body with the SSE client.
- **`lib/simulate.ts`:** replay a script shaped like the prototype's `SCRIPT`, built from the real rows, with about 450ms between steps:
  - `read .etch/drawing.json`
  - `plan N imports, 1 rule each`
  - `explore callers of <root>.<target>` with the suffix "subagent"
  - For each distinct row: `write services/<name>.py +12` (obeys), then `edit <row.path> −1 +1`, then `run pytest -q` with "10 passed" (obeys), then `runViolations` with that row removed.
  - Finish with `rescan etch scan` "0 violations", then `runFinished(0.64, elapsed)`.
  - The log header must read **"agent mode · simulated"** in this mode, so the demo is never misleading.

## Canvas (DESIGN.md §6)
- **Mount Excalidraw** with:
  - `initialData.appState`: `viewBackgroundColor: "transparent"` (the wrapper draws the 22px dot grid), `currentItemFontFamily: 6`, `currentItemStrokeColor: "#111111"`, `currentItemStrokeWidth: 2` and `currentItemRoughness: 1`.
  - `UIOptions`: `canvasActions` with loadScene, export, saveToActiveFile, toggleTheme, changeViewBackgroundColor and saveAsImage all `false`, and `tools: { image: false }`.
- **Build the scene** whenever the graph's layer-id set or repoPath changes (not on every rescan):
  - `api.updateScene({ elements: convertToExcalidrawElements(sceneSkeleton(graph, savedPositions), { regenerateIds: false }) })`, then `api.scrollToContent(undefined, { fitToContent: true })`.
  - `savedPositions` come from `persist.ts`, under key `etch.positions.<repoPath>`. Save box positions from `onChange`, throttled to 500ms.
- **`onChange(elements, appState)`:**
  - Compute `drawingFromElements(elements)` and report it only when its JSON changes.
  - Compute the etch-box rects (`{ layer: {x, y, width, height} }`) and the view `{ scrollX, scrollY, zoom: appState.zoom.value }`. Push them into React state with `requestAnimationFrame`, only when changed.
- **`ViolationOverlay`** is an absolutely positioned `<svg>` covering exactly the Excalidraw area, with `pointer-events: none` and a `z-index` above the canvas but below Excalidraw's UI islands.
  - It contains one `<g transform="scale(zoom) translate(scrollX scrollY)">`.
  - **Per box:** a subtitle `"<module> · N files"` (or "1 file") in Geist Mono 11, `var(--muted)`, centred 18px above the box's bottom edge.
  - **Per edge in `knownEdges(state)`** with both boxes present, use `edgeGeometry(rect[src], rect[tgt])`:
    - The visible path: `var(--violation)`, dash `7 7`, round caps, the prototype's small open arrowhead marker, and width 3.4 when hovered, else 2 (120ms transition).
    - The invisible 18px hit path uses `pointer-events: stroke`. Mouse enter and leave set the hover (`edgeKey`), and a click or tap toggles it.
    - The label pill sits at `mid`, showing "N imports" or "1 import".
    - The group's opacity is 1 while `edgeCounts[edge] > 0`, else 0, with a **240ms** transition (motion #17). Keep the group mounted.
- **Toast** (motion #16) is always mounted at the top centre and keyed off `state.toast.seq`:
  - Show over 200ms, hold for 1500ms, hide over 150ms.
  - If a new seq arrives while it's visible: hide, wait 170ms, then show the new one.
  - Text: `<path>` in mono, then `msg`.
- **Seal** (motion #19): shown in `etched`, bottom-left of the canvas.
  - "Etched" on top, and below it mono text: the date as `27 SEP 2026` (uppercase), then `N BOXES` from the drawn layers, then `M RULES` from the drawn arrows.
- **Legend:** as in the prototype, bottom-left, but lifted so it never overlaps Excalidraw's own bottom-left zoom/undo controls.
  - On touch devices (`@media (hover: none)`) the hint reads "Tap a red arrow or a row".
  - **Skip the prototype's Replay button;** it only exists for the mock.
- **Excalidraw restyle** in `theme.css`, scoped to `.excalidraw`:
  - `--color-primary: #111111`, `--color-primary-darker: #000`, `--color-primary-darkest: #000`, `--color-primary-light: var(--hover)`
  - `--island-bg-color: var(--surface)`, `--shadow-island: var(--shadow-float)`, `--ui-font: var(--font-ui)`
  - Islands get a `1px var(--rule)` border and radius 8.

## Rail, top bar, rows, log (DESIGN.md §4, §5, §7)

Follow the prototype markup exactly. Use `openCount`, `canEtch`, `progress`, `edgeCounts` and `knownEdges` from `lib/state.ts`.

**Heading layers** (150px block, stacked, crossfaded as in motion #2). One layer per variant:
- **idle with open rows:** "N imports break your drawing" (singular: "1 import breaks your drawing"). Subtext: "You drew a → b, c → d. These lines cross an arrow you didn't draw.", listing the drawn arrows.
- **idle with 0 rows:** "Your code obeys the drawing" / "Every import follows an arrow you drew. Etch it to make the drawing a rule."
- **running:** "Making it so", plus the mono line `m:ss · {coins or —} of 1 Bobcoin · agent mode`, plus the 2px progress bar (`scaleX(progress)`, motion #14).
- **done:** "Your code obeys the drawing" / "N imports fixed in m:ss for {CountUp coins} Bobcoin. Etch it to make the drawing a rule."
- **etched:** as in the prototype.
- **error:** "Bob stopped", with `state.error` in `var(--violation)`.

**Rows:**
- Key them `${rowsEpoch}:${row.key}`, so a rescan re-staggers them (motion #8, 40ms per row).
- Use the 4-state icon stack, path + muted `:line`, strike line, right-label stack (rule pill `source ↛ target`, queued, fixing, fixed) and code block, all exactly as in the prototype (motions #5, #6, #7).
- Hovering a row sets the hover edge; a tap toggles it. A row gets `var(--row-hover-violation)` when its edge is hovered and it isn't fixed.
- The list scrolls inside the rail if it's tall.

**Log / files region:**
- The log box is visible in running, done and error (motion #11). The header reads "Live from IBM Bob", with meta text "waiting", "agent mode" or "agent mode · simulated".
- Lines follow the prototype, with motion #10 and tone colours: muted → `--muted`, obeys → `--obeys`, violation → `--violation`.
- In `etched`, the region becomes "Written to your repo", listing `state.written` (motion #20). Notes:
  - `.importlinter` → "N contracts" (count `[importlinter:contract:` in `state.importlinter`)
  - `.github/workflows/…` → "PR check"
  - `.bob/skills/…` → "Bob skill"
  - `.etch/drawing.json` → "the sketch"

**Action slot** (92px, stacked layers, motion #3):
- **idle with rows:** Make it so + `Ctrl ↵` kbd + caption.
- **idle with 0 rows:** empty.
- **running:** Stop + caption.
- **done:** caption.
- **etched:** "Open pull request". Disabled for now, with the title "Coming in task 7".
- **error:** "Try again" (black, which runs Make it so) and "Undo changes" (ghost, disabled until task 5).

**Footer:** the Etch it button, enabled when `canEtch`, with motion #18. Its hint text:
- "Unlocks at 0 violations" when disabled
- "Make the drawing a rule" when enabled
- "Rules written to your repo." when etched, where the label becomes "Etched" in `--etched`

**Top bar:**
- The wordmark with its hand-drawn underline, then the repo (basename of `repoPath`) / branch icon + `state.branch`.
- The activity pill (motion #13) and the count pill with the rolling digit (motion #12). Support digits 0–9 and show "9+" above 9.
- Rescan, whose icon spins while `state.scanning` (motion #21).
- On the first-run screen, the right side shows only "Built with IBM Bob".

**FirstRun:**
- Port Empty.dc.html. The input starts with `state.repoPath` ("demo-app") and keeps the design's placeholder.
- The Scan button label crossfades to "Scanning…" while scanning (motion #22).
- `state.error` shows under the hint line in `--violation`.
- The app shows FirstRun while phase is `empty` or `scanning`, and the main layout otherwise.

## Responsive (not in DESIGN.md; the maintainer approved these rules)
- **1100px and wider:** the design as drawn, with a 400px rail.
- **768–1099px:** the rail is 340px, the rail h1 is 26px and the first-run headline is 44px.
- **Under 768px:**
  - The app is a column: the top bar is 52px, the canvas takes `56svh` (min 300px), and the rail fills the rest with `overflow-y: auto`.
  - The action slot and footer are `position: sticky; bottom: 0` with a `--surface` background, so Make it so / Etch it are always reachable.
  - The top bar hides the repo/branch block and the activity pill, and Rescan becomes icon-only (its `aria-label` stays "Rescan").
  - The heading block's height becomes auto (min 120px).
  - FirstRun becomes a single column: headline 36px, padding 32px 20px, the decorative right panel is hidden, and the form and steps are 100% wide.
- The app root uses `height: 100dvh` and there is **never horizontal page scroll** down to 360px.
- Hover-only styles go inside `@media (hover:hover) and (pointer:fine)`. Tap targets are at least 40px on touch.
- Reduced motion follows DESIGN.md §8.

## Acceptance checks (all must exit 0)
From `frontend/`:
1. `npm.cmd test`: 33 passed. You aren't allowed to change these tests.
2. `npm.cmd run typecheck`
3. `npm.cmd run build`

If a check fails twice with the same error, stop and report it.

## Final reply (short)
- the check results
- the file list
- every place where you deviated from the prototype or DESIGN.md, with the reason
