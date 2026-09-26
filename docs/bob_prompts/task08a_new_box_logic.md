# Etch — Task 8a: "draw a box = new package" (logic + backend)

A user can now draw a **new box** on the canvas: a rectangle whose label is the name of a package that doesn't exist yet (plus an optional line saying what belongs there), connected by arrows to the real boxes. **Make it so** asks IBM Bob to create that package, move the code that belongs there, and rewrite the imports. While Bob works, Etch notices the new package appearing and turns the drawn box into a real code box in place.

This task is the logic, the backend and the minimum wiring. The visual design (dashed box, NEW/CREATED tag, rail row, heading copy) is task 8b. **The tests already exist and are the spec.**

## Scope (strict)

- **Backend, edit:** `backend/etch/violations.py`, `backend/etch/bob_runner.py` (`build_prompt` only), `backend/etch/main.py` (`make_it_so_stream` and `etch_it` only).
- **Frontend, edit:** `frontend/src/lib/drawing.ts`, `frontend/src/lib/state.ts`, `frontend/src/lib/run.ts`, `frontend/src/lib/simulate.ts`, `frontend/src/components/Canvas.tsx` (the layer-change effect only), `frontend/src/components/Rail.tsx` (two lines, see below).
- **Read only:** `backend/etch/models.py` (`NewBox` and `Drawing.new_boxes` already exist and validate names), `frontend/src/types.ts` (`NewBox`, `Drawing.new_boxes`), `backend/tests/test_new_boxes.py`, `backend/tests/test_make_it_so.py`, `backend/tests/fixtures/fake_bob.py`, `frontend/src/lib/drawing.test.ts`, `frontend/src/lib/state.test.ts`.
- **Do NOT modify** tests, fixtures, `models.py`, `types.ts`, `docs/` or any other file. Don't install anything.
- **Never run the real `bob` command.** The tests use a fake Bob.
- **Windows PowerShell:** use `.venv\Scripts\python.exe` and `npm.cmd`. No servers.

## Backend

### `violations.py`
A new box counts as drawn: `drawn = set(drawing.layers) | {b.id for b in drawing.new_boxes}`. Nothing else changes. Update the docstring.

### `bob_runner.build_prompt(violations, drawing, root_package, python=sys.executable)`
Same prompt as today, with the changes below.

- The forbidden sentence lists the layers and then the new box ids: `drawn = ", ".join(drawing.layers + [b.id for b in drawing.new_boxes])`.

- **Only when `drawing.new_boxes` is non-empty**, add this block after that sentence, separated by a blank line. Number the boxes 1, 2, …:
  ```
  Create these new packages the architect drew:
  1. {root}.{id}  (create {root}/{id}/__init__.py)
     What belongs there: {intent, or "not described; infer it from the arrows and the code" when empty}
     Arrows: {every drawn arrow touching id, as "s → t", comma-separated, in drawing order; "none" if there are none}
  Move the code that belongs there out of the existing packages (move, don't copy), then update every import of it, including import lines in tests/. Leave no module behind that only re-exports the moved code.
  ```

- **Only when `violations` is non-empty**, keep the existing "These imports break the drawing. Fix every one of them:" block. With no violations it is left out completely.

- In the "How to fix" list:
  - The "Do not modify" bullet becomes: `Do not modify tests/ (except import lines that point at code you moved), .importlinter, .etch/ or anything outside {root}/. Do not install packages. Do not run git.`
  - The last bullet becomes: `Stop when every listed import is gone{", every new package exists with the code that belongs there" if new boxes} and the tests pass. Reply with one line saying what you moved.`

### `main.py`

**`make_it_so_stream`**
- Add a helper `built(graph, box_id) -> bool`. It is true when some layer has `id == box_id` and `files >= 2`, meaning an `__init__.py` plus at least one module.

- **After the first scan:**
  - Compute `pending = [b for b in drawing.new_boxes if not built(graph, b.id)]`.
  - Compute the violations as today.
  - If there are no violations **and** `pending` is empty, return the existing "nothing to fix" error, and Bob never starts.
  - Otherwise **always** emit the first `{"kind": "violations", ...}`, even when the list is empty.
- **Prompt:** build it with `build_prompt(violations, drawing.model_copy(update={"new_boxes": pending}), root)`.
- **Layer tracking:**
  - Remember the sorted layer ids from the first scan.
  - After every rescan, both mid-run and final, compare the sorted layer ids. If they changed, emit `{"kind": "layers", "layers": [l.model_dump() for l in new_graph.layers]}` **before** that rescan's `violations` event, and remember the new ids.
- **Done event:** add `"boxes_missing": [b.id for b in pending if not built(final_graph, b.id)]` as the last key. Every other field stays as it is.

**`etch_it`**
- Right after `resolve_repo`, if `req.drawing.new_boxes` is non-empty, raise `HTTPException(400, detail=f"Make it so first: {', '.join(ids)} not built yet")`.
- Nothing may be written before this check.

## Frontend

### `drawing.ts`

**`isPackageName(name)`**
- `export function isPackageName(name: string): boolean`.
- True when `/^[a-z_][a-z0-9_]*$/` matches, `length <= 40`, and the name is not a Python keyword: `and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield`.

**`SceneElementLike`**
- Add `customData?: Record<string, unknown> | null` and `version?: number`.
- Let the bindings carry extra fields: `{ elementId: string; [k: string]: unknown } | null`.

**New boxes.** Write one private helper, used by all three functions below, that finds them in scene order:
1. **Code boxes** are live (not deleted) rectangles whose id passes `layerOfBox`.
2. **Candidates** are the other live rectangles.
   - A candidate's label is the first live `text` element with `containerId === rect.id`.
   - Use `raw = originalText ?? text ?? ""` and split it on `"\n"`.
   - **name** = the first line, trimmed.
   - **intent** = the other lines joined with `" "`, with whitespace runs collapsed, trimmed.
3. A candidate **qualifies** when all of these hold:
   - `isPackageName(name)` is true.
   - The name is not a live code box's layer.
   - No earlier candidate already took the name.
   - At least one live arrow has one binding on the rect and the other on a live code box.

**`drawingFromElements(elements)`**
- Returns `{ layers, arrows, new_boxes }`.
- `layers` is the same as today.
- **Arrows:**
  - Both endpoints must map to a name, either a code box's layer or a qualifying new box's name.
  - No self-arrows.
  - Deduplicated and sorted by `(source, target)`.
- `new_boxes` = `[{ id: name, intent }]` in scene order.

**`notesFromElements(elements)`**
- Also skip text contained in a qualifying new box.
- An arrow label becomes `{text, source, target}` when both endpoints map to names. This now includes new boxes.
- A live code box with a non-empty `customData.etchIntent` string adds `{ text: \`${layer}: ${intent}\`, source: null, target: null }` at the box's own position in scene order.
- Everything else stays as it is.

**`boxSkeleton(layer, rect: {x, y, width, height})`**
- Returns the rectangle skeleton `sceneSkeleton` builds today, with the same fields and label.
- `sceneSkeleton` must now use it, so `sceneSkeleton` output stays identical.

**`adoptionPlan(elements, layerIds): Adoption[]`**
- `export interface Adoption { name: string; rectId: string; textId: string | null; intent: string; arrowIds: string[] }`.
- One entry per qualifying new box whose name is in `layerIds`, in scene order.
- `arrowIds` = ids of live arrows with either binding on the rect, in scene order.

**`rebindForAdoption<T extends SceneElementLike>(elements: readonly T[], plan: Adoption[]): T[]`**
- Returns a new array in the same order and never mutates the input.
- Each plan's rect and text become `{...el, isDeleted: true, version: (el.version ?? 1) + 1}`.
- An arrow bound to a plan rect gets that binding copied with `elementId: boxId(name)`. Keep the binding's other fields and bump `version` the same way.
- Every other element is returned as the same object.

### `state.ts`
- **`initialState.drawing`:** `{ layers: [], arrows: [], new_boxes: [] }`.
- **Selectors:** export `newBoxCount(state)`, which is `state.drawing.new_boxes.length`, and `workCount(state)`, which is `openCount + newBoxCount`.
- **`canEtch`:** additionally requires `newBoxCount(state) === 0`.
- **New action `{ type: "runLayers"; layers: Layer[] }`:** replaces `graph.layers` and keeps the rest of the graph. It does nothing when there is no graph.
- **`runFinished`:** gets an optional `boxesMissing?: string[]`.
  - With open rows, keep today's behaviour and message.
  - Otherwise, if `boxesMissing` is non-empty, go to `error` with `` `Bob didn't create the ${names.join(", ")} package${n > 1 ? "s" : ""}` ``. Keep coins and duration like the rows-left error.
  - Otherwise go to `done` as today.

### `run.ts`
- Handle a `layers` event by dispatching `{ type: "runLayers", layers }`.
- On `done`, pass `boxesMissing: event.boxes_missing ?? []`.

### `simulate.ts` (free rehearsals must show the box being built)
- If `state.drawing.new_boxes` is non-empty, schedule a `write` step for each box, after the explore step and before the per-row steps. Each step has `detail: \`${root}/${id}/__init__.py\``, `suf: "+1"` and `tone: "obeys"`.
- At that step's time, dispatch `runLayers` with `graph.layers` plus `{ id, module: \`${root}.${id}\`, files: 2 }` for every box.
- **The plan line:** its detail counts boxes too, e.g. `"4 imports, 1 new box"`.
- **The final `runFinished`:** passes `boxesMissing: []`.

### `Canvas.tsx`: adopt instead of rebuild
The effect that rebuilds the scene when the graph's layer set changes has one new case. If the repo path is the same and every scanned layer is either a live code box or covered by an adoption, adopt instead of rebuilding:

```ts
const scene = api.getSceneElementsIncludingDeleted();
const plan = adoptionPlan(scene, layerIds);
// covered = every layer id is a live etch box or a plan name
if (sameRepo && covered) {
  if (plan.length) {
    const rebound = rebindForAdoption(scene, plan);
    const created = convertToExcalidrawElements(
      plan.map((p) => boxSkeleton(p.name, rectOf(p.rectId))), { regenerateIds: false });
    // on each created rectangle: boundElements += p.arrowIds as {id, type: "arrow"};
    // customData = { etchIntent: p.intent } when p.intent
    api.updateScene({ elements: [...rebound, ...createdWithArrows] });
  }
  lastGraphKeyRef.current = layerKey;
  return;
}
// else: rebuild exactly as today
```

`rectOf` takes x, y, width and height from the drawn rect, so the box keeps its position and size. The normal `onChange` flow then reports the new drawing: the box is in `layers` and `new_boxes` is empty.

### `Rail.tsx`
Change only the two CTA layer conditions:
- `ctaIdle` uses `workCount(state) > 0` instead of `open > 0`.
- `ctaIdleEmpty` uses `workCount(state) === 0`.

## Acceptance checks (all must exit 0)
1. From `backend/`: `.venv\Scripts\python.exe -m pytest -q`. Expect **78 passed** with no failures.
2. From `frontend/`: `npm.cmd test` (**58 passed**), then `npm.cmd run typecheck`, then `npm.cmd run build`.

If a test fails, fix your code, never the test. If the same failure repeats twice, stop and report it.

## Final reply (short)
- the check results
- one line per file
- any deviation from this spec, with the reason
