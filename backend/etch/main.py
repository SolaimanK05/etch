"""FastAPI application for Etch."""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from etch.bob_runner import build_prompt, run_bob
from etch.contracts import compile_contracts
from etch.models import (
    ArchGraph,
    CheckRequest,
    CheckResponse,
    ContractsResponse,
    MakeItSoRequest,
    ScanRequest,
)
from etch.scanner import scan_repo
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


@app.exception_handler(NotImplementedError)
def not_implemented_handler(request: Request, exc: NotImplementedError) -> JSONResponse:
    return JSONResponse(status_code=501, content={"detail": str(exc)})


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.post("/api/scan")
def scan(req: ScanRequest) -> ArchGraph:
    return scan_repo(resolve_repo(req.repo_path), req.root_package)


@app.post("/api/check")
def check(req: CheckRequest) -> CheckResponse:
    graph = scan_repo(resolve_repo(req.repo_path), req.root_package)
    return CheckResponse(violations=find_violations(graph, req.drawing))


@app.post("/api/contracts")
def contracts(req: CheckRequest) -> ContractsResponse:
    return ContractsResponse(importlinter=compile_contracts(req.drawing, req.root_package))


@app.post("/api/make-it-so")
def make_it_so(req: MakeItSoRequest) -> StreamingResponse:
    graph = scan_repo(resolve_repo(req.repo_path), req.root_package)
    violations = find_violations(graph, req.drawing)
    prompt = build_prompt(violations, req.drawing, req.root_package)
    event_iter = run_bob(prompt, resolve_repo(req.repo_path), req.max_cost)

    async def stream():
        async for event in event_iter:
            yield f"data: {event.model_dump_json()}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
