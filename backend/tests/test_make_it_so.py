"""POST /api/make-it-so orchestration (task 5), driven by the fake Bob: no Bobcoins spent.

Stream protocol (Server-Sent Events, one JSON object per `data:` line):
  {"kind": "violations", "violations": [...]}   at start, then whenever a rescan changes them
  {"kind": "bob", "event": {"type": ..., "data": {...}}}   every Bob stream-json event, verbatim
  {"kind": "tests", "ok": bool, "summary": "10 passed"}    after Bob finishes, Etch runs pytest itself
  {"kind": "done", "coins": 0.12, "duration_ms": 1234, "violations_left": 3}
  {"kind": "error", "message": "..."}
"""
import json
import shutil
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from etch.main import app

client = TestClient(app, raise_server_exceptions=False)

DEMO = Path(__file__).resolve().parents[2] / "demo-app"
FAKE_BOB = Path(__file__).parent / "fixtures" / "fake_bob.py"

# These runs need the demo's 4 planted violations. On a branch where the demo has been
# fixed and etched (e.g. etch/make-it-so), there is nothing for Bob to fix: skip them.
needs_pristine_demo = pytest.mark.skipif(
    (DEMO / ".importlinter").exists(), reason="demo-app already fixed and etched"
)

INTENDED = {
    "layers": ["api", "services", "db", "notifications"],
    "arrows": [
        {"source": "api", "target": "services"},
        {"source": "services", "target": "db"},
        {"source": "services", "target": "notifications"},
    ],
}


@pytest.fixture
def demo_copy(tmp_path, monkeypatch):
    repo = tmp_path / "demo"
    shutil.copytree(DEMO, repo, ignore=shutil.ignore_patterns("__pycache__", ".pytest_cache", ".importlinter"))
    monkeypatch.setenv("ETCH_BOB_CMD", json.dumps([sys.executable, str(FAKE_BOB)]))
    monkeypatch.setenv("FAKE_BOB_MODE", "fix")
    return repo


def stream(body: dict) -> list[dict]:
    resp = client.post("/api/make-it-so", json=body)
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("text/event-stream")
    return [json.loads(line[len("data: "):]) for line in resp.text.splitlines() if line.startswith("data: ")]


@needs_pristine_demo
def test_make_it_so_streams_bob_rescans_tests_and_cost(demo_copy):
    events = stream({"repo_path": str(demo_copy), "drawing": INTENDED, "max_cost": 0.5})
    kinds = [e["kind"] for e in events]

    assert events[0] == {"kind": "violations", "violations": events[0]["violations"]}
    assert sum(len(v["imports"]) for v in events[0]["violations"]) == 4

    bob = [e["event"] for e in events if e["kind"] == "bob"]
    assert [b["type"] for b in bob] == [
        "message", "tool_use", "tool_result", "tool_use", "tool_result", "tool_use", "tool_result", "result",
    ]

    # fake Bob fixed api/orders.py -> a rescan after that tool_result reports 3 left
    rescans = [e for e in events[1:] if e["kind"] == "violations"]
    assert rescans, "expected a rescan after Bob edited a file"
    assert sum(len(v["imports"]) for v in rescans[-1]["violations"]) == 3
    assert kinds.index("violations", 1) < kinds.index("tests")

    tests = next(e for e in events if e["kind"] == "tests")
    assert tests["ok"] is True
    assert tests["summary"].startswith("10 passed")

    assert events[-1] == {"kind": "done", "coins": 0.12, "duration_ms": 1234, "violations_left": 3}

    prompt = (demo_copy / ".fake_bob_prompt.txt").read_text(encoding="utf-8")
    assert "shop/api/orders.py:3" in prompt and "shop/notifications/email.py:4" in prompt
    assert "--max-cost\n0.5" in (demo_copy / ".fake_bob_args.txt").read_text(encoding="utf-8")


@needs_pristine_demo
def test_make_it_so_reports_bob_failure(demo_copy, monkeypatch):
    monkeypatch.setenv("FAKE_BOB_MODE", "fail")
    events = stream({"repo_path": str(demo_copy), "drawing": INTENDED})
    assert events[-1]["kind"] == "error"
    assert "exit code 1" in events[-1]["message"]
    assert not any(e["kind"] == "done" for e in events)


def test_make_it_so_does_nothing_when_the_code_already_obeys(demo_copy):
    allow_all = {
        "layers": INTENDED["layers"],
        "arrows": INTENDED["arrows"] + [
            {"source": "api", "target": "db"},
            {"source": "api", "target": "notifications"},
            {"source": "db", "target": "services"},
            {"source": "notifications", "target": "db"},
        ],
    }
    events = stream({"repo_path": str(demo_copy), "drawing": allow_all})
    assert [e["kind"] for e in events] == ["error"]
    assert "already obeys" in events[0]["message"]
    assert not (demo_copy / ".fake_bob_prompt.txt").exists()  # Bob never started: 0 coins


def test_stop_is_harmless_when_idle():
    resp = client.post("/api/stop")
    assert resp.status_code == 200
    assert resp.json() == {"stopped": False}
