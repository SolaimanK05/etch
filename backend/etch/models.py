"""Frozen Pydantic v2 models — the API contract for Etch.

Any change here must be mirrored in frontend/src/types.ts.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ImportDetail(BaseModel):
    importer: str        # dotted module, e.g. "shop.api.routes"
    imported: str        # dotted module, e.g. "shop.db.repository"
    file: str            # importer's file, repo-relative POSIX path, e.g. "shop/api/routes.py"
    line: int            # 1-based
    code: str            # source line, stripped


class Layer(BaseModel):
    id: str              # direct child package name of root_package, e.g. "api"
    module: str          # e.g. "shop.api"
    files: int = 0       # number of .py files in the layer package (recursive)


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
    root_package: str | None = None  # None = auto-detect the single top-level package


class CheckRequest(ScanRequest):
    drawing: Drawing


class CheckResponse(BaseModel):
    violations: list[Violation]


class ContractsResponse(BaseModel):
    importlinter: str    # full text of a .importlinter file


class Note(BaseModel):           # free text on the canvas: annotation, not a rule
    text: str
    source: str | None = None    # set when the text is a label on a drawn arrow
    target: str | None = None


class EtchItRequest(CheckRequest):
    notes: list[Note] = []


class PrRequest(ScanRequest):
    message: str = "Etch: make the code obey the drawing"


class PrResponse(BaseModel):
    branch: str                  # always "etch/make-it-so"
    commit: str                  # sha of the snapshot commit
    pushed: bool                 # False when there is no origin remote or the push failed
    url: str | None = None       # GitHub compare URL to open the pull request


class EtchItResponse(BaseModel):
    written: list[str]   # repo-relative POSIX paths written, e.g. [".importlinter"]
    importlinter: str    # text written to .importlinter


class MakeItSoRequest(CheckRequest):
    max_cost: float = 1.0


class BobEvent(BaseModel):       # one line of `bob run --format stream-json`
    type: str            # "message" | "tool_use" | "tool_result" | "result" | "error"
    data: dict[str, Any]
