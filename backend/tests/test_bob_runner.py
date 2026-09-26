"""Bob runner unit tests (task 5). Uses tests/fixtures/fake_bob.py: no Bobcoins spent."""
import json
import sys
from pathlib import Path

from etch.bob_runner import bob_command, build_prompt, parse_event, run_bob, stop_current
from etch.models import Arrow, BobEvent, Drawing, ImportDetail, Violation

FAKE_BOB = Path(__file__).parent / "fixtures" / "fake_bob.py"

DRAWING = Drawing(
    layers=["api", "services", "db", "notifications"],
    arrows=[
        Arrow(source="api", target="services"),
        Arrow(source="services", target="db"),
        Arrow(source="services", target="notifications"),
    ],
)

VIOLATIONS = [
    Violation(source="api", target="db", imports=[ImportDetail(
        importer="shop.api.orders", imported="shop.db.orders_repo", file="shop/api/orders.py",
        line=3, code="from shop.db.orders_repo import get_order")]),
    Violation(source="db", target="services", imports=[ImportDetail(
        importer="shop.db.orders_repo", imported="shop.services.pricing", file="shop/db/orders_repo.py",
        line=4, code="from shop.services.pricing import apply_discount")]),
]


def use_fake_bob(monkeypatch, mode: str = "fix") -> None:
    monkeypatch.setenv("ETCH_BOB_CMD", json.dumps([sys.executable, str(FAKE_BOB)]))
    monkeypatch.setenv("FAKE_BOB_MODE", mode)


def test_build_prompt_states_the_rules_every_violation_and_how_to_verify():
    prompt = build_prompt(VIOLATIONS, DRAWING, "shop", python="C:/venv/python.exe")
    for arrow in ("api → services", "services → db", "services → notifications"):
        assert arrow in prompt
    assert "shop/api/orders.py:3" in prompt
    assert "from shop.db.orders_repo import get_order" in prompt
    assert "shop/db/orders_repo.py:4" in prompt
    assert "C:/venv/python.exe -m pytest -q" in prompt
    lowered = prompt.lower()
    assert "do not modify" in lowered and "tests/" in prompt
    assert ".importlinter" in prompt  # never hand-edit the etched contracts
    assert "public" in lowered        # keep public entry points' behaviour


def test_parse_event_handles_json_text_and_blank_lines():
    assert parse_event('{"type": "result", "stats": {"session_costs": 0.2}}') == BobEvent(
        type="result", data={"type": "result", "stats": {"session_costs": 0.2}}
    )
    assert parse_event("Loading Bob Shell...") == BobEvent(type="log", data={"text": "Loading Bob Shell..."})
    assert parse_event("   ") is None


def test_bob_command_uses_etch_bob_cmd_override(monkeypatch):
    monkeypatch.setenv("ETCH_BOB_CMD", json.dumps(["python", "fake.py"]))
    assert bob_command(0.5) == [
        "python", "fake.py", "run", "--mode", "agent", "--format", "stream-json",
        "--max-cost", "0.5", "--accept-license", "--trust",
    ]


def test_run_bob_feeds_prompt_on_stdin_and_streams_events(tmp_path, monkeypatch):
    use_fake_bob(monkeypatch)
    events = list(run_bob("PROMPT-123", tmp_path, 0.5))
    assert [e.type for e in events] == [
        "message", "tool_use", "tool_result", "tool_use", "tool_result",
        "tool_use", "tool_result", "result",
    ]
    assert events[-1].data["stats"]["session_costs"] == 0.12
    assert (tmp_path / ".fake_bob_prompt.txt").read_text(encoding="utf-8") == "PROMPT-123"
    assert "--max-cost\n0.5" in (tmp_path / ".fake_bob_args.txt").read_text(encoding="utf-8")


def test_run_bob_reports_a_failed_process_as_an_error_event(tmp_path, monkeypatch):
    use_fake_bob(monkeypatch, "fail")
    events = list(run_bob("P", tmp_path, 1.0))
    assert events[-1].type == "error"
    assert "exit code 1" in events[-1].data["message"]
    assert "authentication failed" in events[-1].data["message"]  # stderr tail is surfaced


def test_stop_current_is_false_when_nothing_runs():
    assert stop_current() is False
