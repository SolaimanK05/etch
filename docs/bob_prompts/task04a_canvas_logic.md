# Etch — Task 4a: canvas logic (pure TS) + backend auto-detect

Task 4 (the canvas UI) is split in two. **This part, 4a, is the pure logic only:** geometry for the red violation arrows, converting between the scan and Excalidraw elements, and the UI state machine (a React reducer). **No React components, no CSS.** Those come in task 4b. Also two small backend additions. All tests already exist and are the spec.

## Scope (strict)
- **Create:** `frontend/src/lib/geometry.ts`, `frontend/src/lib/drawing.ts`, `frontend/src/lib/state.ts`.
- **Edit:** `backend/etch/scanner.py`, `backend/etch/main.py`.
- **Read only** the files above, plus `frontend/src/types.ts`, `frontend/src/lib/*.test.ts`, `backend/etch/models.py`, `backend/tests/test_scanner.py` (from `test_layers_count_python_files_recursively` down) and the last two tests in `backend/tests/test_api.py`.
- **Do NOT modify** any test, `models.py`, `types.ts`, `package.json` or any other file. Don't install anything; vitest is already installed.
- **The three `lib` files must stay pure:** no React, no DOM, and **no runtime import from `@excalidraw/excalidraw`** (`import type` is fine). The tests run in plain Node.
- **Windows PowerShell:** use `npm.cmd`/`npx.cmd` and `.venv\Scripts\python.exe`. No servers, no git.

## 1. Backend

**`scanner.py`:**
- Add `detect_root_package(repo_path: Path) -> str`:
  - Consider the direct subdirectories of `repo_path` that contain `__init__.py`.
  - Skip `tests`, `test` and `docs`, any name starting with `.` or `_`, and any name that isn't a Python identifier.
  - If exactly one remains, return it. Otherwise raise `ScanError("found N top-level packages in <repo_path>, pass root_package")`, with N replaced by the count.
- In `scan_repo`, set `Layer.files` to the number of `*.py` files under the layer package directory, counted recursively.

**`main.py`:**
- Add a helper `root_of(req, repo: Path) -> str` that returns `req.root_package or detect_root_package(repo)`.
- Use it wherever a root package is needed: scan, check, contracts, etch-it and make-it-so.
- `/api/contracts` must now call `resolve_repo(req.repo_path)` when `root_package` is missing.

## 2. `frontend/src/lib/geometry.ts`
- **Exports:** `Point`, `Rect` (`x, y, width, height`), `center(r)`, `exitPoint(r, toward)` and `edgeGeometry(from, to, opts?)`.
- **`exitPoint(r, toward)`:** the point where the ray from `center(r)` toward `toward` crosses the border of `r`. Scale the direction vector by `min(halfW/|dx|, halfH/|dy|)`, ignoring zero components. It returns the centre if `toward` is the centre.
- **`edgeGeometry(from, to, opts?)`:**
  - Defaults: `bend 0.18`, `startGap 6`, `endGap 10`.
  - `start` = the exit point of `from` toward `to`'s centre, pushed `startGap` along the direction.
  - `end` = the exit point of `to` toward `from`'s centre, pulled back `endGap`.
  - `dir` = the unit vector from start to end, and `perp = (-dir.y, dir.x)`.
  - `control` = the midpoint of start and end, plus `perp × bend × |end − start|`.
  - `mid` = the quadratic point at t = 0.5, i.e. `0.25·start + 0.5·control + 0.25·end`.
  - `d = "M{sx} {sy} Q{cx} {cy} {ex} {ey}"`, with each number rounded to 1 decimal and printed without trailing `.0`.
- Returns `{ d, start, end, control, mid }`.

## 3. `frontend/src/lib/drawing.ts`
- **Constants:** `BOX_PREFIX = "etch-box-"`, `BOX_WIDTH = 220`, `BOX_HEIGHT = 96`, and `FONT_NUNITO = 6`. Comment that 6 is `FONT_FAMILY.Nunito` in @excalidraw/excalidraw 0.18.
- **`boxId(layer)`** and **`layerOfBox(id)`**, which returns `null` if the id doesn't start with the prefix.
- **`layoutLayers(graph)`:**
  - score = out-degree − in-degree over distinct dependency pairs. Sort by score descending, then id.
  - `cols = n <= 3 ? n : ceil(sqrt(n))`.
  - For index i: `col = i % cols`, `row = floor(i / cols)`, `x = 80 + col*360 + (row % 2)*180` and `y = 80 + row*220`.
- **`sceneSkeleton(graph, positions?)`** returns Excalidraw element skeletons for `convertToExcalidrawElements(skel, { regenerateIds: false })`. Type it with `import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform"`.
  - **Per layer:** `{ type: "rectangle", id: boxId(id), x, y, width: BOX_WIDTH, height: BOX_HEIGHT, strokeColor: "#111111", backgroundColor: "transparent", strokeWidth: 2, roughness: 1, label: { text: id, fontSize: 22, fontFamily: FONT_NUNITO, strokeColor: "#111111" } }`. The position comes from `positions?.[id]`, falling back to `layoutLayers`.
  - **Per dependency:** `{ type: "arrow", id: "etch-arrow-<s>-<t>", x, y, points, start: { id: boxId(s) }, end: { id: boxId(t) }, strokeColor: "#111111", strokeWidth: 2, roughness: 1, endArrowhead: "arrow" }`.
    - `x, y` is the centre of the source box. `points` are relative: `[[0,0],[dx,dy]]` to the target box centre.
    - If the reverse dependency also exists, use `[[0,0],[dx/2 + px*28, dy/2 + py*28],[dx,dy]]`, where `(px,py) = (-dy, dx)/len`.
- **`drawingOfGraph(graph)`:** all layer ids sorted, plus one arrow per dependency in the backend's order. This is the initial drawing, so the first scan has 0 violations until the user erases arrows.
- **`drawingFromElements(elements)`:**
  - Its input is a minimal type `SceneElementLike { id; type; isDeleted?; startBinding?: {elementId}|null; endBinding?: {elementId}|null }`.
  - `layers` = the non-deleted etch boxes, sorted.
  - `arrows` = non-deleted `type === "arrow"` elements whose start and end bindings both point at live etch boxes, excluding self-arrows, deduplicated and sorted by `(source, target)`.

## 4. `frontend/src/lib/state.ts`: the UI state machine

Export these types: `Phase` (`"empty"|"scanning"|"idle"|"running"|"done"|"etched"|"error"`), `RowStatus` (`"open"|"queued"|"fixing"|"fixed"`), `Row`, `LogLine`, `Toast`, `State` and `Action`.

- **`Row`:** `{ key: "file:line", source, target, file, path, line, code, status }`, where `path` is `file` without the `<root>/` prefix.
- **`LogLine`:** `{ t, verb, detail, suf, tone: "muted"|"obeys"|"violation" }`.
- **`Toast`:** `{ path, msg, seq }`.
- **`State`:** `phase, scanning, repoPath, graph: ArchGraph|null, drawing: Drawing, rows: Row[], rowsEpoch, hover: string|null, branch, log: LogLine[], startedAt: number|null, elapsedMs, coins: number|null, toast: Toast|null, written: string[], importlinter, error: string|null`.

Also export `initialState` (phase `"empty"`, `repoPath "demo-app"`, `branch "main"`, `rowsEpoch 0`, `elapsedMs 0`, and empty values everywhere else), `edgeKey(s, t) = "s>t"`, `rowsFromViolations(violations, root)`, `reducer(state, action)`, and the selectors `openCount`, `canEtch`, `progress`, `edgeCounts` (non-fixed rows per edge) and `knownEdges` (every edge that has any row, in row order, kept after it's fixed so the arrow can fade out).

**Actions and rules.** `state.test.ts` has the exact expectations:
- **`scanStarted {repoPath}`:** sets `scanning: true` and `error: null`. The phase becomes `"scanning"` only if there's no graph yet; otherwise it stays unchanged.
- **`scanSucceeded {graph, drawing}`:** phase `"idle"`, `scanning: false`, `rowsEpoch + 1`, `branch "main"`. Clear rows, log, coins, written and error.
- **`scanFailed {error}`:** `scanning: false` and the error is set. The phase becomes `"empty"` if there's no graph; otherwise it stays unchanged.
- **`drawingChanged {drawing}`:** stores the drawing only.
- **`checkSucceeded {violations}`:**
  - Ignored in `running`.
  - In `idle`/`error`, rows = `rowsFromViolations(...)` and the phase becomes `"idle"`.
  - In `done`/`etched`, it only reopens to `idle` if the violations aren't empty.
- **`hover {edge}`.**
- **`etchSucceeded {written, importlinter}`:** phase `"etched"`.
- **`runStarted {now}`:** phase `"running"`, `branch "etch/make-it-so"`, every non-fixed row becomes `"queued"` and the first becomes `"fixing"`. Clear the log, set `coins: null`, `startedAt: now` and `elapsedMs: 0`.
- **`runLog {line}`:** appends the line and keeps the last 11.
- **`runViolations {violations}`:**
  - Rows whose key is no longer present become `"fixed"`.
  - If nothing is `"fixing"`, the first `"queued"` row becomes `"fixing"`.
  - For newly fixed rows, set a toast with `seq + 1`. Its `path` is the first newly fixed row's path. Its `msg` is `"now goes through <X>"`, where X is the first drawn layer with arrows `source→X` and `X→target`, or `"no longer crosses the drawing"` if there's none.
- **`runFinished {coins, durationMs}`:**
  - Sets coins, `elapsedMs = durationMs` and `startedAt: null`.
  - If 0 rows are open, the phase becomes `"done"`.
  - Otherwise the phase becomes `"error"` with the error `"N imports still break the drawing"` (singular: `"1 import still breaks the drawing"`), and non-fixed rows go back to `"open"`.
- **`runFailed {error}`:** phase `"error"`, non-fixed rows back to `"open"`, `startedAt: null`.
- **`tick {now}`:** `elapsedMs = now − startedAt` only while running.
- **`reset`:** returns `initialState`.
- **Selectors:** `canEtch` is `phase === "done"`, or phase `"idle"` with a graph and 0 open rows. `progress` = fixed / total rows, or 0 when there are none.

## Acceptance checks (all must exit 0)
1. From `backend/`: `.venv\Scripts\python.exe -m pytest -q`. Expect **34 passed**.
2. From `frontend/`: `npm.cmd test`. Expect **33 passed**.
3. From `frontend/`: `npm.cmd run typecheck`, then `npm.cmd run build`.

If a test fails, fix your code, never the test. If the same failure repeats twice, stop and report it.

## Final reply (short)
- the three check results
- one line per file
- any deviation from this spec, with the reason
