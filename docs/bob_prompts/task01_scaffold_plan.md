# Task 01 — Repo Scaffold Plan

## Overview

Create the full working skeleton for **Etch** ("doodle-driven development"):

- `backend/` — Python 3.12 / FastAPI package with frozen Pydantic models, five stubs, fully-implemented `main.py`, and 4 passing tests.
- `frontend/` — Vite + React + TypeScript + Excalidraw 0.18.1 SPA with API client and single-page UI.
- `demo-app/` — Minimal target repo (skeleton only) with a smoke test.
- `AGENTS.md` — Root-level agent reference doc (≤ 60 lines).

No scanning, violation, contract, or Bob runner logic is implemented in this task — those are future tasks. All stubs raise `NotImplementedError`.

**Acceptance gates** (all must exit 0):
1. `backend/` — 4 pytest tests pass.
2. `demo-app/` — 1 pytest smoke test passes.
3. `frontend/` — `npm.cmd run build` succeeds.

---

## Sub-Task 1 — `backend/` scaffold

**Status:** `[ ] pending`

**Intent:** Create the Python package with its `pyproject.toml`, all source files, and tests. This locks in the frozen API contract (models.py) and the FastAPI routes (main.py).

**Expected Outcomes:**
- `backend/pyproject.toml` is valid and installable with `pip install -e ".[dev]"`.
- `etch/models.py` contains all 12 Pydantic v2 models with exact field names.
- `etch/main.py` implements all 5 routes plus the helper and error handler.
- Five stub modules raise `NotImplementedError` with correct signatures and docstrings.
- `etch/__init__.py` sets `__version__ = "0.1.0"`.
- `tests/test_api.py` has exactly 4 tests (health, scan-501, scan-400, round-trip).
- `py -3.12 -m venv .venv && .venv\Scripts\python.exe -m pip install -q -e ".[dev]" && .venv\Scripts\python.exe -m pytest -q` exits 0 with **4 passed**.

**Todo List:**
1. Create `backend/pyproject.toml` per spec (setuptools build, `etch*` package find, dev extras, pytest testpaths).
2. Create `backend/etch/__init__.py` with `__version__ = "0.1.0"`.
3. Create `backend/etch/models.py` with all 12 models (import `Any` from `typing`).
4. Create `backend/etch/scanner.py` stub — `scan_repo(repo_path: Path, root_package: str) -> ArchGraph`.
5. Create `backend/etch/violations.py` stub — `find_violations(graph: ArchGraph, drawing: Drawing) -> list[Violation]`.
6. Create `backend/etch/contracts.py` stub — `compile_contracts(drawing: Drawing, root_package: str) -> str`.
7. Create `backend/etch/bob_runner.py` stub — `build_prompt(...)` and `run_bob(...)`.
8. Create `backend/etch/skillgen.py` stub — `generate_bob_skill(...)`.
9. Create `backend/etch/main.py` with `app`, `REPO_ROOT`, `resolve_repo`, `NotImplementedError` handler, and all 5 routes.
10. Create `backend/tests/__init__.py` (empty) and `backend/tests/test_api.py` with 4 tests.
11. Run acceptance check 1: create venv, install, run pytest. Fix any failures (max one retry per error).

**Relevant Context:**
- Stub imports: each stub imports only from `etch.models`. Only `etch.main` imports the stubs.
- `main.py` routes are plain `def`, not `async def`.
- `POST /api/make-it-so` calls scan_repo → find_violations → build_prompt → run_bob **before** constructing `StreamingResponse`, so stubs cause it to 501 immediately.
- The `NotImplementedError` handler maps to HTTP 501 with `{"detail": str(exc)}`.
- `resolve_repo`: relative → resolved against `REPO_ROOT`; absolute → used as-is; non-directory → `HTTPException(400)`.
- Test 2 (`scan` with `{}`) uses default `demo-app`, which must exist as a directory for `resolve_repo` to pass — create `demo-app/` (even just the folder) before running tests, or create sub-task 3 first.
- Windows PowerShell: use `py -3.12`, `.venv\Scripts\python.exe`.

---

## Sub-Task 2 — `frontend/` scaffold

**Status:** `[ ] pending`

**Intent:** Bootstrap the Vite + React + TypeScript + Excalidraw frontend via npm commands, then add all required source files. The build must succeed cleanly.

**Expected Outcomes:**
- `frontend/package.json` has name `etch-frontend`, `"private": true`, `"type": "module"`, correct scripts, no `main`/`test` fields.
- `frontend/vite.config.ts`, `src/types.ts`, `src/api.ts`, `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/vite-env.d.ts`, `index.html` all exist with correct content.
- `npm.cmd run build` from `frontend/` exits 0 (chunk-size warnings are acceptable).
- No `tsconfig*.json` files are created.

**Todo List:**
1. In `frontend/`, run `npm.cmd init -y` (creates baseline package.json).
2. Edit `package.json`: set name, private, type, scripts (`dev`/`build`/`preview`); remove `main` and `test` fields.
3. Run `npm.cmd install --no-audit --no-fund --loglevel=error react react-dom @excalidraw/excalidraw@0.18.1`.
4. Run `npm.cmd install -D --no-audit --no-fund --loglevel=error vite @vitejs/plugin-react typescript @types/react @types/react-dom`.
5. Create `index.html` (title "Etch", `<div id="root">`, module script for `/src/main.tsx`).
6. Create `vite.config.ts` (react plugin, server proxy, `process.env.IS_PREACT` define).
7. Create `src/vite-env.d.ts`.
8. Create `src/types.ts` mirroring all models from `models.py` (snake_case, `BobEvent.data: Record<string, unknown>`).
9. Create `src/api.ts` (`BASE`, generic `post<T>`, `health`, `scan`, `check`, `contracts` exports).
10. Create `src/main.tsx` (createRoot, StrictMode, import Excalidraw CSS and `./index.css`).
11. Create `src/index.css` (margin 0, height 100% on html/body/#root, system font stack).
12. Create `src/App.tsx` (flex row: Excalidraw pane + aside panel with health, inputs, Scan button).
13. Run acceptance check 3: `npm.cmd run build`. Fix any failures (max one retry per error).

**Relevant Context:**
- No `tsconfig*.json` — the maintainer adds them.
- Excalidraw 0.18 needs `define: { "process.env.IS_PREACT": JSON.stringify("false") }` in vite.config.ts.
- `ExcalidrawImperativeAPI` is imported from `@excalidraw/excalidraw/types`.
- Frontend proxy: `/api` → `http://127.0.0.1:8000` (no CORS needed on backend).
- `src/App.tsx`: left pane `flex: 1`, height `100vh`; aside `360px` wide with left border, 16px padding, overflow auto.

---

## Sub-Task 3 — `demo-app/` scaffold

**Status:** `[ ] pending`

**Intent:** Create the minimal target repository that Etch will scan. The smoke test confirms all four package layers are importable. This also unblocks backend test 2 (resolve_repo needs `demo-app/` to exist as a directory).

**Expected Outcomes:**
- `demo-app/pyproject.toml` exists (pytest config only).
- `demo-app/shop/__init__.py` and four layer `__init__.py` files each contain only a one-line docstring.
- `demo-app/tests/test_smoke.py` imports all four layers and passes.
- `..\backend\.venv\Scripts\python.exe -m pytest -q` from `demo-app/` exits 0 with **1 passed**.

**Todo List:**
1. Create `demo-app/pyproject.toml` with only `[tool.pytest.ini_options]` (`pythonpath = ["."]`, `testpaths = ["tests"]`).
2. Create `demo-app/shop/__init__.py` (docstring: "demo shop app scanned by Etch").
3. Create `demo-app/shop/api/__init__.py`, `shop/services/__init__.py`, `shop/db/__init__.py`, `shop/notifications/__init__.py` — each with a one-line docstring stating its role, no imports.
4. Create `demo-app/tests/__init__.py` (empty) and `demo-app/tests/test_smoke.py` (importlib-imports all four layers).
5. Run acceptance check 2: `..\backend\.venv\Scripts\python.exe -m pytest -q` from `demo-app/`. Fix any failures.

**Relevant Context:**
- `demo-app/` must exist **before** the backend venv tests run (test 2 uses it as the default `repo_path`). Sub-task 3 should be created early — at minimum the `demo-app/` directory must exist before sub-task 1's acceptance check.
- The backend venv from sub-task 1 is reused here (`backend/.venv`).
- No code logic — only `__init__.py` files with docstrings.

---

## Sub-Task 4 — `AGENTS.md`

**Status:** `[ ] pending`

**Intent:** Write the root-level agent reference document so any AI agent working on this repo has a single source of truth.

**Expected Outcomes:**
- `AGENTS.md` exists at repo root, ≤ 60 lines.
- Contains: Etch description, folder map, frozen models note, backend layering rule, Windows command rules, run instructions for all four commands, and the three "never" rules.

**Todo List:**
1. Write `AGENTS.md` to repo root with all required sections, staying within 60 lines.

**Relevant Context:**
- Run commands (verbatim from spec):
  - `backend/`: `.venv\Scripts\python.exe -m uvicorn etch.main:app --reload --port 8000`
  - `frontend/`: `npm.cmd run dev`
  - `backend/`: `.venv\Scripts\python.exe -m pytest -q`
  - `demo-app/`: `..\backend\.venv\Scripts\python.exe -m pytest -q`
- Frozen models note: any change to `models.py` must be mirrored in `frontend/src/types.ts`.
- Three "never" rules: never touch `tsconfig*.json`, no secret-like filenames, never start servers inside agent tasks.

---

## Execution Order

Sub-tasks can be implemented in this order:
1. **Sub-Task 3** (demo-app skeleton) — create the `demo-app/` directory first so backend tests can resolve it.
2. **Sub-Task 1** (backend) — depends on `demo-app/` existing.
3. **Sub-Task 2** (frontend) — independent, can follow backend.
4. **Sub-Task 4** (AGENTS.md) — independent, can be done any time.
