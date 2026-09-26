"""Draw a box = new package (task 8a). Fake Bob only: no Bobcoins spent.

A NewBox is a box the user drew for a package that does not exist yet. Arrows may
start or end at it. Make it so asks Bob to create <root>/<id>/, move the code that
belongs there, and rewrite the imports. The run streams a "layers" event whenever the
set of top-level packages changes, and "done" reports boxes_missing: new boxes that
still aren't a real package (an __init__.py plus at least one module).
"""
import json
import shutil
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from etch.bob_runner import build_prompt
from etch.main import app
from etch.models import ArchGraph, Arrow, Dependency, Drawing, ImportDetail, Layer, NewBox, Violation
from etch.violations import find_violations

client = TestClient(app, raise_server_exceptions=False)

DEMO = Path(__file__).resolve().parents[2] / "demo-app"
FIXREPO = Path(__file__).parent / "fixtures" / "fixrepo"
FAKE_BOB = Path(__file__).parent / "fixtures" / "fake_bob.py"

needs_pristine_demo = pytest.mark.skipif(
    (DEMO / ".importlinter").exists(), reason="demo-app already fixed and etched"
)

INTENDED_ARROWS = [
    {"source": "api", "target": "services"},
    {"source": "services", "target": "db"},
    {"source": "services", "target": "notifications"},
]
BOX_ARROWS = [{"source": "services", "target": "pricing"}, {"source": "db", "target": "pricing"}]
PRICING = {"id": "pricing", "intent": "discount math, no I/O"}

# the demo's intended drawing plus a new pricing box that services and db may use
DRAW_BOX = {
    "layers": ["api", "services", "db", "notifications"],
    "arrows": INTENDED_ARROWS + BOX_ARROWS,
    "new_boxes": [PRICING],
}


# ---------- model ----------

def test_new_box_ids_must_be_lowercase_python_package_names():
    assert NewBox(id="pricing").intent == ""
    assert NewBox(id="_util2", intent="  keep\n it   small ").intent == "keep it small"  # one line
    for bad in ("Pricing", "9lives", "a-b", "../evil", "pricing/x", "", "class", "a" * 41):
        with pytest.raises(ValidationError):
            NewBox(id=bad)
    with pytest.raises(ValidationError):
        NewBox(id="pricing", intent="x" * 201)


def test_drawings_without_new_boxes_still_parse():
    assert Drawing(layers=["api"], arrows=[]).new_boxes == []


# ---------- violations ----------

def _imp(importer: str, imported: str) -> ImportDetail:
    return ImportDetail(importer=f"shop.{importer}", imported=f"shop.{imported}",
                        file=f"shop/{importer.replace('.', '/')}.py", line=2, code=f"import shop.{imported}")


GRAPH = ArchGraph(
    root_package="shop",
    layers=[Layer(id=i, module=f"shop.{i}", files=2) for i in ("api", "db", "pricing", "services")],
    dependencies=[
        Dependency(source="db", target="pricing", imports=[_imp("db.repo", "pricing.discounts")]),
        Dependency(source="api", target="pricing", imports=[_imp("api.routes", "pricing.discounts")]),
    ],
)


def test_a_new_box_counts_as_drawn_so_undrawn_imports_into_it_are_violations():
    drawing = Drawing(layers=["api", "db", "services"],
                      arrows=[Arrow(source="db", target="pricing")],
                      new_boxes=[NewBox(id="pricing")])
    assert [(v.source, v.target) for v in find_violations(GRAPH, drawing)] == [("api", "pricing")]


def test_without_the_new_box_those_imports_are_ignored_as_before():
    drawing = Drawing(layers=["api", "db", "services"], arrows=[])
    assert find_violations(GRAPH, drawing) == []


# ---------- prompt ----------

VIOLATION = Violation(source="db", target="services", imports=[ImportDetail(
    importer="shop.db.orders_repo", imported="shop.services.pricing", file="shop/db/orders_repo.py",
    line=4, code="from shop.services.pricing import apply_discount")])


def test_prompt_asks_bob_to_create_each_new_box_and_move_its_code():
    prompt = build_prompt([VIOLATION], Drawing(**DRAW_BOX), "shop", python="C:/venv/python.exe")
    assert "Create these new packages the architect drew:" in prompt
    assert "1. shop.pricing" in prompt and "shop/pricing/__init__.py" in prompt
    assert "What belongs there: discount math, no I/O" in prompt
    assert "Arrows: services → pricing, db → pricing" in prompt
    assert "move, don't copy" in prompt
    assert "import lines in tests/" in prompt  # moving code may touch test imports, nothing else there
    forbidden = next(line for line in prompt.splitlines() if line.startswith("Every other import between"))
    assert "pricing" in forbidden  # the new package is part of the rules from the start
    assert "shop/db/orders_repo.py:4" in prompt
    assert "C:/venv/python.exe -m pytest -q" in prompt


def test_prompt_without_violations_only_builds_boxes():
    box = Drawing(**{**DRAW_BOX, "new_boxes": [{"id": "pricing"}]})
    prompt = build_prompt([], box, "shop")
    assert "These imports break the drawing" not in prompt
    assert "What belongs there: not described; infer it from the arrows and the code" in prompt


def test_prompt_without_new_boxes_is_unchanged_in_spirit():
    prompt = build_prompt([VIOLATION], Drawing(layers=["db", "services"], arrows=[]), "shop")
    assert "Create these new packages" not in prompt
    assert "These imports break the drawing" in prompt


# ---------- live run (fake Bob) ----------

@pytest.fixture
def demo_copy(tmp_path, monkeypatch):
    repo = tmp_path / "demo"
    shutil.copytree(DEMO, repo, ignore=shutil.ignore_patterns("__pycache__", ".pytest_cache", ".importlinter"))
    monkeypatch.setenv("ETCH_BOB_CMD", json.dumps([sys.executable, str(FAKE_BOB)]))
    monkeypatch.setenv("FAKE_BOB_MODE", "box")
    return repo


def stream(body: dict) -> list[dict]:
    resp = client.post("/api/make-it-so", json=body)
    assert resp.status_code == 200, resp.text
    return [json.loads(line[len("data: "):]) for line in resp.text.splitlines() if line.startswith("data: ")]


@needs_pristine_demo
def test_make_it_so_builds_the_box_and_streams_the_new_layer(demo_copy):
    events = stream({"repo_path": str(demo_copy), "drawing": DRAW_BOX})
    kinds = [e["kind"] for e in events]

    assert kinds[0] == "violations"
    layer_events = [e for e in events if e["kind"] == "layers"]
    assert len(layer_events) == 1, "one layers event: the package set changed once"
    ids = [layer["id"] for layer in layer_events[0]["layers"]]
    assert ids == ["api", "db", "notifications", "pricing", "services"]
    assert next(layer for layer in layer_events[0]["layers"] if layer["id"] == "pricing")["files"] == 2
    assert kinds.index("layers") < kinds.index("tests")

    done = events[-1]
    assert done == {"kind": "done", "coins": 0.21, "duration_ms": 2345, "violations_left": 3, "boxes_missing": []}

    prompt = (demo_copy / ".fake_bob_prompt.txt").read_text(encoding="utf-8")
    assert "shop/pricing/__init__.py" in prompt


@needs_pristine_demo
def test_make_it_so_reports_a_box_bob_did_not_build(demo_copy, monkeypatch):
    monkeypatch.setenv("FAKE_BOB_MODE", "nobox")
    events = stream({"repo_path": str(demo_copy), "drawing": DRAW_BOX})
    assert not any(e["kind"] == "layers" for e in events)
    assert events[-1]["kind"] == "done"
    assert events[-1]["boxes_missing"] == ["pricing"]


@needs_pristine_demo
def test_code_in_the_new_packages_init_counts_as_built(demo_copy, monkeypatch):
    # first live run: Bob put apply_discount straight into shop/pricing/__init__.py
    monkeypatch.setenv("FAKE_BOB_MODE", "boxinit")
    events = stream({"repo_path": str(demo_copy), "drawing": DRAW_BOX})
    layers = next(e for e in events if e["kind"] == "layers")["layers"]
    assert next(layer for layer in layers if layer["id"] == "pricing")["files"] == 1
    assert events[-1]["kind"] == "done"
    assert events[-1]["boxes_missing"] == []


@needs_pristine_demo
def test_an_empty_new_package_is_still_missing(demo_copy, monkeypatch):
    monkeypatch.setenv("FAKE_BOB_MODE", "emptybox")
    events = stream({"repo_path": str(demo_copy), "drawing": DRAW_BOX})
    assert events[-1]["kind"] == "done"
    assert events[-1]["boxes_missing"] == ["pricing"]

def test_a_pending_box_alone_is_work_for_bob(demo_copy):
    # every real import is drawn, so there are no violations, only the box to build
    allow_all = INTENDED_ARROWS + BOX_ARROWS + [
        {"source": "api", "target": "db"},
        {"source": "api", "target": "notifications"},
        {"source": "db", "target": "services"},
        {"source": "notifications", "target": "db"},
    ]
    events = stream({"repo_path": str(demo_copy), "drawing": {**DRAW_BOX, "arrows": allow_all}})
    assert events[0] == {"kind": "violations", "violations": []}
    assert (demo_copy / ".fake_bob_prompt.txt").exists()  # Bob was started
    assert events[-1]["kind"] == "done"
    assert events[-1]["boxes_missing"] == []
    assert events[-1]["violations_left"] == 0


def test_a_new_box_that_already_exists_is_not_work(demo_copy):
    allow_all = INTENDED_ARROWS + [
        {"source": "api", "target": "db"},
        {"source": "api", "target": "notifications"},
        {"source": "db", "target": "services"},
        {"source": "notifications", "target": "db"},
    ]
    drawing = {"layers": ["api", "services", "notifications"], "arrows": allow_all, "new_boxes": [{"id": "db"}]}
    events = stream({"repo_path": str(demo_copy), "drawing": drawing})
    assert [e["kind"] for e in events] == ["error"]
    assert "already obeys" in events[0]["message"]
    assert not (demo_copy / ".fake_bob_prompt.txt").exists()


def test_make_it_so_rejects_an_unsafe_box_name_before_bob_starts(demo_copy):
    bad = {**DRAW_BOX, "new_boxes": [{"id": "../evil"}]}
    resp = client.post("/api/make-it-so", json={"repo_path": str(demo_copy), "drawing": bad})
    assert resp.status_code == 422
    assert not (demo_copy / ".fake_bob_prompt.txt").exists()


# ---------- Etch it ----------

def test_etch_it_refuses_while_a_drawn_box_is_not_built(tmp_path):
    repo = tmp_path / "fix"
    shutil.copytree(FIXREPO, repo)
    drawing = {"layers": ["api", "services"], "arrows": [{"source": "api", "target": "cache"}],
               "new_boxes": [{"id": "cache"}]}
    resp = client.post("/api/etch-it", json={"repo_path": str(repo), "root_package": "fixpkg", "drawing": drawing})
    assert resp.status_code == 400
    assert "cache" in resp.json()["detail"]
    assert not (repo / ".importlinter").exists()
