# Etch — Task 1: repo scaffold (backend/, frontend/, demo-app/) + AGENTS.md

Etch = "doodle-driven development". A user draws package boxes and arrows on an Excalidraw canvas; the backend scans a Python repo's real imports (grimp), reports every import that breaks the drawing (file:line), compiles the drawing into import-linter contracts, and runs Bob Shell to refactor the code.

THIS TASK IS ONLY THE SCAFFOLD: a working skeleton, frozen interfaces and stubs. Do NOT implement scanning, violation logic, contract compiling, the Bob runner or canvas sync. Later tasks do that.

Rules:
- Everything you need is in this prompt file (docs/bob_prompts/task01_scaffold.md). Do not read or explore any other existing repo files (README.md, CLAUDE.md, the rest of docs/, spike/). Do not modify .gitignore, .bobignore, README.md, CLAUDE.md or docs/. Do not run git.
- Do NOT create or edit any tsconfig*.json. The maintainer adds them.
- No file or folder name may contain: token, secret, password, credential, apikey, config.json, config.yaml.
- Windows. Your terminal is PowerShell with script execution disabled, so always use `npm.cmd` / `npx.cmd` (never `npm`/`npx`), and call Python as `.venv\Scripts\python.exe` (never Activate.ps1). Create venvs with `py -3.12`.
- Never start long-running servers (uvicorn, `npm.cmd run dev`).
- Work efficiently: no narration between steps, and don't re-read files you just wrote.

## 1. backend/ (Python 3.12, FastAPI)

```
backend/
  pyproject.toml
  etch/
    __init__.py        # __version__ = "0.1.0"
    models.py          # implement fully
    main.py            # implement fully
    scanner.py         # stub (task 2)
    violations.py      # stub (task 2)
    contracts.py       # stub (task 3)
    bob_runner.py      # stub (task 5)
    skillgen.py        # stub (task 7)
  tests/
    test_api.py
```

**pyproject.toml:** project `etch-backend` 0.1.0, requires-python `>=3.12`. Dependencies: `fastapi`, `uvicorn[standard]`, `pydantic>=2`, `grimp>=3.5`, `import-linter>=2`. Optional dependencies: `dev = ["pytest", "httpx"]`. Build system: setuptools (`setuptools>=69`, `setuptools.build_meta`). Add `[tool.setuptools.packages.find] include = ["etch*"]` and `[tool.pytest.ini_options] testpaths = ["tests"]`.

**etch/models.py:** pydantic v2. These are the frozen API contract, so use exactly these names and fields:

```python
class ImportDetail(BaseModel):
    importer: str        # dotted module, e.g. "shop.api.routes"
    imported: str        # dotted module, e.g. "shop.db.repository"
    file: str            # importer's file, repo-relative POSIX path, e.g. "shop/api/routes.py"
    line: int            # 1-based
    code: str            # source line, stripped

class Layer(BaseModel):
    id: str              # direct child package name of root_package, e.g. "api"
    module: str          # e.g. "shop.api"

class Dependency(BaseModel):     # real imports between two layers, aggregated
    source: str          # Layer.id
    target: str          # Layer.id
    imports: list[ImportDetail]

class ArchGraph(BaseModel):
    root_package: str
    layers: list[Layer]
    dependencies: list[Dependency]

class Arrow(BaseModel):          # a drawn arrow = an ALLOWED dependency
    source: str          # Layer.id
    target: str          # Layer.id

class Drawing(BaseModel):
    layers: list[str]    # Layer ids drawn as boxes
    arrows: list[Arrow]

class Violation(BaseModel):      # a real Dependency with no matching Arrow
    source: str
    target: str
    imports: list[ImportDetail]

class ScanRequest(BaseModel):
    repo_path: str = "demo-app"  # relative paths resolve against the repo root
    root_package: str = "shop"

class CheckRequest(ScanRequest):
    drawing: Drawing

class CheckResponse(BaseModel):
    violations: list[Violation]

class ContractsResponse(BaseModel):
    importlinter: str    # full text of a .importlinter file

class MakeItSoRequest(CheckRequest):
    max_cost: float = 1.0

class BobEvent(BaseModel):       # one line of `bob run --format stream-json`
    type: str            # "message" | "tool_use" | "tool_result" | "result" | "error"
    data: dict[str, Any]
```

**Stubs.** Each stub file gets a module docstring, a fully type-hinted signature, a docstring describing the future behaviour (use the text below), and the body `raise NotImplementedError("<function name>: task N")`.
- `scanner.py`: `def scan_repo(repo_path: Path, root_package: str) -> ArchGraph`. Builds a grimp graph of root_package. Layers are its direct child packages. It aggregates direct imports between different layers, with file:line.
- `violations.py`: `def find_violations(graph: ArchGraph, drawing: Drawing) -> list[Violation]`. Returns every Dependency with no Arrow of the same source and target.
- `contracts.py`: `def compile_contracts(drawing: Drawing, root_package: str) -> str`. Returns .importlinter text with one `forbidden` contract per ordered pair of drawn layers that has no arrow.
- `bob_runner.py`:
  - `def build_prompt(violations: list[Violation], drawing: Drawing, root_package: str) -> str`
  - `def run_bob(prompt: str, workspace: Path, max_cost: float) -> AsyncIterator[BobEvent]`. It runs `bob.cmd run --mode agent --format stream-json --max-cost N --accept-license --trust` with the prompt on stdin, and yields one BobEvent per stdout line. `run_bob` is a plain `def` (not `async def`) that returns an async iterator, so the stub raises before any streaming starts.
- `skillgen.py`: `def generate_bob_skill(drawing: Drawing, root_package: str) -> dict[str, str]`. Returns a map of repo-relative path to file content (a Bob skill plus a custom mode).

**Etch's own layering (it dogfoods itself):**
- `etch.models` imports nothing from `etch`.
- The five stub modules import only `etch.models`.
- Only `etch.main` imports the stub modules.

**etch/main.py:**
- `app = FastAPI(title="Etch", version="0.1.0")`. No CORS; the frontend uses the Vite proxy.
- `REPO_ROOT = Path(__file__).resolve().parents[2]`.
- `resolve_repo(repo_path: str) -> Path`: an absolute path is used as is, and a relative path is resolved against REPO_ROOT. Raise `HTTPException(400)` if the result is not a directory.
- An exception handler maps `NotImplementedError` to status 501 with `{"detail": str(exc)}`.
- Routes. Use plain `def`, not `async def`.
  - `GET /api/health` returns `{"status": "ok", "version": "0.1.0"}`.
  - `POST /api/scan` takes ScanRequest and returns ArchGraph from `scan_repo(resolve_repo(...), root_package)`.
  - `POST /api/check` takes CheckRequest and returns `CheckResponse(violations=find_violations(scan_repo(...), req.drawing))`.
  - `POST /api/contracts` takes CheckRequest and returns `ContractsResponse(importlinter=compile_contracts(req.drawing, req.root_package))`.
  - `POST /api/make-it-so` takes MakeItSoRequest and returns `StreamingResponse(media_type="text/event-stream")`. Call scan_repo, then find_violations, then build_prompt, then run_bob, all BEFORE constructing the response, so the stubs produce a 501. Wrap the event iterator so each event is sent as `data: <BobEvent JSON>\n\n`.

**tests/test_api.py** (FastAPI TestClient), exactly 4 tests:
1. The health check returns 200 with the body above.
2. `POST /api/scan` with body `{}` returns 501. The default `demo-app` must resolve, so this also tests resolve_repo.
3. `POST /api/scan` with `{"repo_path": "does-not-exist"}` returns 400.
4. A CheckRequest with one arrow round-trips through `model_dump_json()` and `model_validate_json()` unchanged.

## 2. frontend/ (Vite + React + TypeScript + Excalidraw)

Create it with commands, not by hand-writing package.json versions:
- `npm.cmd init -y`, then set `name` to "etch-frontend", `"private": true`, `"type": "module"`, and these scripts: `dev` = `vite`, `build` = `vite build`, `preview` = `vite preview`. Delete the `main` and `test` fields.
- `npm.cmd install --no-audit --no-fund --loglevel=error react react-dom @excalidraw/excalidraw@0.18.1`
- `npm.cmd install -D --no-audit --no-fund --loglevel=error vite @vitejs/plugin-react typescript @types/react @types/react-dom`

Files:
- `index.html`: title "Etch", `<div id="root">`, and a module script for `/src/main.tsx`.
- `vite.config.ts`:
  - the react plugin
  - `server: { port: 5173, strictPort: true, proxy: { "/api": "http://127.0.0.1:8000" } }`
  - `define: { "process.env.IS_PREACT": JSON.stringify("false") }`. Excalidraw 0.18 needs this under Vite, and the value is "false" because we use React.
- `src/vite-env.d.ts`: `/// <reference types="vite/client" />`
- `src/types.ts`: TypeScript interfaces that mirror models.py one-to-one, with the same snake_case field names. BobEvent.data is `Record<string, unknown>`.
- `src/api.ts`:
  - `const BASE = "/api"` and a generic `post<T>(path, body)`. On a non-ok response it throws `Error(\`${status}: ${detail}\`)`, taking `detail` from the JSON body.
  - Exports: `health(): Promise<{ status: string; version: string }>`, `scan(req: ScanRequest): Promise<ArchGraph>`, `check(req: CheckRequest): Promise<CheckResponse>`, `contracts(req: CheckRequest): Promise<ContractsResponse>`. The make-it-so SSE client is task 5.
- `src/main.tsx`: createRoot plus StrictMode. Import `@excalidraw/excalidraw/index.css`, then `./index.css`.
- `src/index.css`: html, body and #root get margin 0 and height 100%, with a system font stack.
- `src/App.tsx` is a full-viewport flex row:
  - **Left:** a div with flex 1 and height 100vh, containing `<Excalidraw excalidrawAPI={(api) => (apiRef.current = api)} />`. `apiRef` is `useRef<ExcalidrawImperativeAPI | null>(null)`, with the type imported from `@excalidraw/excalidraw/types`.
  - **Right:** an `<aside>` 360px wide with a left border, 16px padding and overflow auto. It contains:
    - h1 "Etch", with the subtitle "doodle-driven development"
    - a backend status line, "backend: ok v0.1.0" or "backend: offline", from `health()` on mount
    - inputs repo_path (default "demo-app") and root_package (default "shop")
    - a "Scan" button that calls `scan()`. Show the result as pretty JSON in a `<pre>`, or show the error message in red. A 501 message is expected at this stage.

## 3. demo-app/ (target repo, skeleton only; task 6 adds modules and planted violations)

```
demo-app/
  pyproject.toml       # only [tool.pytest.ini_options] pythonpath = ["."], testpaths = ["tests"]
  shop/__init__.py     # docstring: demo shop app scanned by Etch
  shop/api/__init__.py
  shop/services/__init__.py
  shop/db/__init__.py
  shop/notifications/__init__.py
  tests/test_smoke.py  # importlib-imports shop.api, shop.services, shop.db, shop.notifications
```
Each layer's `__init__.py` holds only a one-line docstring stating its role, with no imports.

## 4. AGENTS.md (repo root, at most 60 lines)

Include:
- a one-paragraph description of Etch
- the folder map
- the frozen models, with a note that any change must be mirrored in `frontend/src/types.ts`
- the backend layering rule from section 1
- the Windows command rules (`npm.cmd`, `.venv\Scripts\python.exe`)
- how to run each part:
  - from backend/: `.venv\Scripts\python.exe -m uvicorn etch.main:app --reload --port 8000`
  - from frontend/: `npm.cmd run dev`
  - from backend/: `.venv\Scripts\python.exe -m pytest -q`
  - from demo-app/: `..\backend\.venv\Scripts\python.exe -m pytest -q`
- these rules: never touch tsconfig*.json, no secret-like filenames, never start servers inside agent tasks

## Acceptance checks (run all; each must exit 0)

1. From `backend/`:
   - `py -3.12 -m venv .venv`
   - `.venv\Scripts\python.exe -m pip install -q -e ".[dev]"`
   - `.venv\Scripts\python.exe -m pytest -q`. Expect 4 passed.
2. From `demo-app/`: `..\backend\.venv\Scripts\python.exe -m pytest -q`. Expect 1 passed.
3. From `frontend/`: `npm.cmd run build`. Chunk-size warnings are fine.

If a check fails, make the smallest fix. If the same error happens twice, stop and report it instead of looping.

## Final reply

Keep it short:
- the created file tree (excluding node_modules, .venv and dist)
- the pass/fail result of each check
- any deviation from this spec, with the reason
