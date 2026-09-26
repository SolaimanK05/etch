"""The demo-app's planted violations, as Etch sees them (task 6).

Intended architecture: api -> services, services -> db, services -> notifications.
These checks only apply to the pristine demo. Once "Etch it" has written
demo-app/.importlinter (i.e. the demo has been fixed and etched), they skip.
Reset for a rehearsal: git checkout -- demo-app && del demo-app\\.importlinter
"""
from pathlib import Path

import pytest

from etch.models import Arrow, Drawing
from etch.scanner import scan_repo
from etch.violations import find_violations

DEMO = Path(__file__).resolve().parents[2] / "demo-app"

pytestmark = pytest.mark.skipif(
    (DEMO / ".importlinter").exists(), reason="demo-app already fixed and etched"
)

INTENDED = Drawing(
    layers=["api", "services", "db", "notifications"],
    arrows=[
        Arrow(source="api", target="services"),
        Arrow(source="services", target="db"),
        Arrow(source="services", target="notifications"),
    ],
)


def test_demo_app_real_dependencies():
    graph = scan_repo(DEMO, "shop")
    assert [(d.source, d.target) for d in graph.dependencies] == [
        ("api", "db"),
        ("api", "notifications"),
        ("api", "services"),
        ("db", "services"),
        ("notifications", "db"),
        ("services", "db"),
        ("services", "notifications"),
    ]


def test_demo_app_has_exactly_four_planted_violations():
    violations = find_violations(scan_repo(DEMO, "shop"), INTENDED)
    assert [(v.source, v.target, [i.file for i in v.imports]) for v in violations] == [
        ("api", "db", ["shop/api/orders.py"]),
        ("api", "notifications", ["shop/api/users.py"]),
        ("db", "services", ["shop/db/orders_repo.py"]),
        ("notifications", "db", ["shop/notifications/email.py"]),
    ]
