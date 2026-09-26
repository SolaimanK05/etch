# Etch — Task 2: scanner + violation engine

Implement `scan_repo` and `find_violations` so that the existing, already-written tests pass. The tests are the spec; this file tells you how.

## Scope (strict)
- **Edit only:** `backend/etch/scanner.py`, `backend/etch/violations.py`, `backend/etch/main.py`.
- **Read only** those three files plus `backend/etch/models.py`, `backend/tests/test_scanner.py`, `backend/tests/test_violations.py`. Don't explore anything else.
- **Do NOT modify** `backend/tests/` (including `tests/fixtures/`), `models.py`, or any frontend/demo-app file. Don't install packages: the venv at `backend/.venv` already has grimp 3.17.
- **Windows PowerShell:** call Python as `.venv\Scripts\python.exe`. No servers, no git.

## 1. `backend/etch/scanner.py`

Keep the existing `scan_repo(repo_path: Path, root_package: str) -> ArchGraph` signature. Add:

```python
class ScanError(Exception):
    """Repo or package can't be scanned (missing package, unparsable source)."""
```

`scan_repo` does the following:

1. **Check the package exists.** If `repo_path / root_package / "__init__.py"` is not a file, raise `ScanError(f"package {root_package!r} not found in {repo_path}")`.
2. **Build the graph under a module-level `threading.Lock`,** because FastAPI runs sync routes in threads and this step mutates `sys.path`:
   - Insert `str(repo_path)` at `sys.path[0]` and call `importlib.invalidate_caches()`.
   - Call `grimp.build_graph(root_package, cache_dir=None)`. `cache_dir=None` is required: rescans after Bob edits must never be stale, and grimp must not write a cache dir.
   - In a `finally` block, remove that `sys.path` entry and call `importlib.invalidate_caches()` again. Don't touch `sys.modules`.
   - Re-raise any grimp exception as `ScanError(str(exc))`.
3. **Find the layers.** Take the direct children from `graph.find_children(root_package)` and keep only the packages, meaning those where `repo_path/<child as path>/__init__.py` exists. Plain modules such as `fixpkg/util.py` are not layers. Each layer is `Layer(id=<last name segment>, module=<dotted name>)`, sorted by id.
4. **Map modules to layers.** A module belongs to a layer if it equals `layer.module` or starts with `layer.module + "."`. Modules outside every layer are ignored, whether they're the importer or the imported module.
5. **Collect dependencies:**
   - For every module in `graph.modules` that is in a layer, loop over `graph.find_modules_directly_imported_by(module)`.
   - Skip the import if the imported module is in no layer, or in the same layer as the importer.
   - For each remaining import, `graph.get_import_details(importer=m, imported=i)` returns a list of dicts with the keys `importer`, `imported`, `line_number` and `line_contents`.
   - Turn each dict into an `ImportDetail`:
     - `file`: the importer's source path relative to `repo_path`, POSIX style. Use `<parts>/__init__.py` if the module is a package directory, else `<parts[:-1]>/<last>.py`.
     - `line`: `line_number`.
     - `code`: `line_contents.strip()`.
6. **Aggregate** the imports into one `Dependency(source, target, imports)` per (source layer id, target layer id) pair. Sort the imports by `(file, line)` and the dependencies by `(source, target)`.
7. **Return** `ArchGraph(root_package=..., layers=..., dependencies=...)`.

## 2. `backend/etch/violations.py`

`find_violations(graph, drawing)`:
1. `drawn = set(drawing.layers)` and `allowed = {(a.source, a.target) for a in drawing.arrows}`.
2. A dependency is a violation only when **both** its source and target are in `drawn` and `(source, target)` is **not** in `allowed`. Dependencies that touch an undrawn box are ignored, and direction matters.
3. Return `Violation(source, target, imports)` with the dependency's imports unchanged, sorted by `(source, target)`.
4. The function is pure: no I/O, and it only imports from `etch.models`.

## 3. `backend/etch/main.py`

Import `ScanError` from `etch.scanner` and add an exception handler that maps it to **400** with `{"detail": str(exc)}`, next to the existing `NotImplementedError` → 501 handler. Change nothing else.

## Acceptance check

From `backend/`, run `.venv\Scripts\python.exe -m pytest -q`. It must exit 0 with **18 passed**. The one httpx deprecation warning is expected.

If a test fails, fix your implementation, never the test. If the same failure repeats twice, stop and report it.

## Final reply (short)
- the pytest summary line
- one line per edited file
- any deviation from this spec, with the reason
