# AGENTS.md

## What is Etch?

Etch ("doodle-driven development") lets a user draw package boxes and arrows on
an Excalidraw canvas. The backend scans a Python repo's real imports (grimp),
reports every import that breaks the drawing (file:line), compiles the drawing
into import-linter contracts, and runs a Bob Shell agent to refactor the code.

## Folder Map

    backend/etch/models.py     FROZEN API contract — mirror changes in frontend/src/types.ts
    backend/etch/main.py       FastAPI app and routes
    backend/etch/scanner.py    stub (task 2)
    backend/etch/violations.py stub (task 2)
    backend/etch/contracts.py  stub (task 3)
    backend/etch/bob_runner.py stub (task 5)
    backend/etch/skillgen.py   stub (task 7)
    frontend/src/types.ts      mirrors models.py one-to-one
    frontend/src/api.ts        typed fetch wrappers
    demo-app/shop/             root package: api, services, db, notifications

## Frozen Models

`backend/etch/models.py` is the API contract. Any field or class change must be
mirrored in `frontend/src/types.ts`. Do not rename fields.

## Backend Layering Rule

- `etch.models` imports nothing from `etch`.
- The five stub modules import only from `etch.models`.
- Only `etch.main` imports the stub modules.

## Windows Command Rules

- Use `npm.cmd` (never `npm`) and `npx.cmd` (never `npx`).
- Call Python as `.venv\Scripts\python.exe` (never `Activate.ps1`).
- Create virtual environments with `py -3.12 -m venv .venv`.

## How to Run

From `backend/`:   `.venv\Scripts\python.exe -m uvicorn etch.main:app --reload --port 8000`
From `frontend/`:  `npm.cmd run dev`  (typecheck: `npm.cmd run typecheck`)
From `backend/`:   `.venv\Scripts\python.exe -m pytest -q`
From `demo-app/`:  `..\backend\.venv\Scripts\python.exe -m pytest -q`

## Rules for Agent Tasks

- Never touch `tsconfig*.json` — the maintainer adds them.
- No file or folder name may contain: token, secret, password, credential,
  apikey, config.json, config.yaml.
- Never start long-running servers (uvicorn, `npm.cmd run dev`) inside agent tasks.
