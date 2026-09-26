"""FastAPI application for Etch."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from etch.bob_runner import build_prompt, run_bob, stop_current
from etch.contracts import compile_contracts
from etch.gitops import GitError, discard_changes
from etch.models import (
    ArchGraph,
    CheckRequest,
    CheckResponse,
    ContractsResponse,
    EtchItResponse,
    MakeItSoRequest,
    ScanRequest,
)
from etch.scanner import ScanError, detect_root_package, scan_repo
from etch.violations import find_violations

app = FastAPI(title="Etch", version="0.1.0")

REPO_ROOT = Path(__file__).resolve().parents[2]


def resolve_repo(repo_path: str) -> Path:
    """Resolve *repo_path* to an absolute directory path.

    An absolute path is used as-is; a relative path is resolved against
    REPO_ROOT. Raises HTTP 400 if the result is not an existing directory.
    """
    p = Path(repo_path)
    if not p.is_absolute():
        p = REPO_ROOT / p
    if not p.is_dir():
        raise HTTPException(status_code=400, detail=f"Not a directory: {repo_path}")
    return p


def root_of(req: ScanRequest, repo: Path) -> str:
    """Return req.root_package, or auto-detect it from the repo directory."""
    return req.root_package or detect_root_package(repo)


@app.exception_handler(NotImplementedError)
def not_implemented_handler(request: Request, exc: NotImplementedError) -> JSONResponse:
    return JSONResponse(status_code=501, content={"detail": str(exc)})


@app.exception_handler(ScanError)
def scan_error_handler(request: Request, exc: ScanError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.post("/api/scan")
def scan(req: ScanRequest) -> ArchGraph:
    repo = resolve_repo(req.repo_path)
    return scan_repo(repo, root_of(req, repo))


@app.post("/api/check")
def check(req: CheckRequest) -> CheckResponse:
    repo = resolve_repo(req.repo_path)
    graph = scan_repo(repo, root_of(req, repo))
    return CheckResponse(violations=find_violations(graph, req.drawing))


@app.post("/api/contracts")
def contracts(req: CheckRequest) -> ContractsResponse:
    repo = resolve_repo(req.repo_path)
    return ContractsResponse(importlinter=compile_contracts(req.drawing, root_of(req, repo)))


@app.post("/api/etch-it")
def etch_it(req: CheckRequest) -> EtchItResponse:
    repo = resolve_repo(req.repo_path)
    text = compile_contracts(req.drawing, root_of(req, repo))
    (repo / ".importlinter").write_text(text, encoding="utf-8", newline="\n")
    return EtchItResponse(written=[".importlinter"], importlinter=text)


def make_it_so_stream(repo: Path, root: str, drawing, max_cost: float):
    """Synchronous generator that runs Bob and yields SSE data lines.

    Stream protocol (one JSON object per ``data:`` line):
      {"kind": "violations", "violations": [...]}
      {"kind": "bob", "event": {...}}
      {"kind": "tests", "ok": bool, "summary": "..."}
      {"kind": "done", "coins": ..., "duration_ms": ..., "violations_left": ...}
      {"kind": "error", "message": "..."}
    """
    def sse(obj: dict) -> str:
        return f"data: {json.dumps(obj)}\n\n"

    # 1. Initial scan
    try:
        graph = scan_repo(repo, root)
    except ScanError as exc:
        yield sse({"kind": "error", "message": str(exc)})
        return

    violations = find_violations(graph, drawing)
    if not violations:
        yield sse({"kind": "error", "message": "nothing to fix: the code already obeys the drawing"})
        return

    # 2. Emit initial violations
    last_violations_json = json.dumps([v.model_dump() for v in violations])
    yield sse({"kind": "violations", "violations": [v.model_dump() for v in violations]})

    # 3. Run Bob
    prompt = build_prompt(violations, drawing, root)
    result_event = None

    for ev in run_bob(prompt, repo, max_cost):
        if ev.type == "error":
            yield sse({"kind": "error", "message": ev.data.get("message", "unknown error")})
            return

        yield sse({"kind": "bob", "event": ev.model_dump()})

        if ev.type == "result":
            result_event = ev

        # After every tool_result: rescan
        if ev.type == "tool_result":
            try:
                new_graph = scan_repo(repo, root)
                new_violations = find_violations(new_graph, drawing)
                new_json = json.dumps([v.model_dump() for v in new_violations])
                if new_json != last_violations_json:
                    last_violations_json = new_json
                    yield sse({"kind": "violations", "violations": [v.model_dump() for v in new_violations]})
            except ScanError:
                pass  # file may be half-edited; skip

    # 4. No result event seen
    if result_event is None:
        yield sse({"kind": "error", "message": "Bob stopped before finishing"})
        return

    # 5. Final rescan
    try:
        final_graph = scan_repo(repo, root)
        final_violations = find_violations(final_graph, drawing)
        final_json = json.dumps([v.model_dump() for v in final_violations])
        if final_json != last_violations_json:
            yield sse({"kind": "violations", "violations": [v.model_dump() for v in final_violations]})
        violations_left = sum(len(v.imports) for v in final_violations)
    except ScanError as exc:
        # Never report success on code Etch can no longer scan (e.g. a syntax error Bob left behind)
        yield sse({"kind": "error", "message": f"Etch could not rescan after Bob's changes: {exc}"})
        return

    # 6. Run the repo's tests
    test_result = subprocess.run(
        [sys.executable, "-m", "pytest", "-q"],
        cwd=repo,
        capture_output=True,
        text=True,
        timeout=300,
    )
    stdout_lines = [l for l in test_result.stdout.splitlines() if l.strip()]
    summary_raw = stdout_lines[-1] if stdout_lines else ""
    # Remove trailing timing like " in 0.05s"
    import re
    summary = re.sub(r"\s+in\s+[\d.]+s$", "", summary_raw)
    yield sse({"kind": "tests", "ok": test_result.returncode == 0, "summary": summary})

    # 7. Done
    stats = result_event.data.get("stats", {})
    coins = stats.get("session_costs", 0)
    duration_ms = stats.get("duration_ms", 0)
    yield sse({"kind": "done", "coins": coins, "duration_ms": duration_ms, "violations_left": violations_left})


@app.post("/api/make-it-so")
def make_it_so(req: MakeItSoRequest) -> StreamingResponse:
    repo = resolve_repo(req.repo_path)
    root = root_of(req, repo)
    return StreamingResponse(
        make_it_so_stream(repo, root, req.drawing, req.max_cost),
        media_type="text/event-stream",
    )


@app.post("/api/stop")
def stop():
    return {"stopped": stop_current()}


@app.post("/api/undo")
def undo(req: ScanRequest):
    try:
        discard_changes(resolve_repo(req.repo_path))
    except GitError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"undone": True}
