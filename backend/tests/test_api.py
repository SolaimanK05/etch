"""Backend API tests."""
from pathlib import Path

from fastapi.testclient import TestClient

from etch.main import app
from etch.models import Arrow, CheckRequest, Drawing

client = TestClient(app, raise_server_exceptions=False)

FIXREPO = Path(__file__).parent / "fixtures" / "fixrepo"


def test_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "version": "0.1.0"}


def test_scan_default_repo_returns_demo_app_layers():
    # default repo_path="demo-app", root_package="shop"
    resp = client.post("/api/scan", json={})
    assert resp.status_code == 200
    assert [layer["id"] for layer in resp.json()["layers"]] == [
        "api", "db", "notifications", "services",
    ]


def test_scan_missing_package_returns_400():
    resp = client.post("/api/scan", json={"repo_path": "demo-app", "root_package": "nopkg"})
    assert resp.status_code == 400


def test_check_fixture_repo_reports_api_to_db():
    resp = client.post(
        "/api/check",
        json={
            "repo_path": str(FIXREPO),
            "root_package": "fixpkg",
            "drawing": {
                "layers": ["api", "services", "db", "notifications"],
                "arrows": [
                    {"source": "api", "target": "services"},
                    {"source": "services", "target": "db"},
                ],
            },
        },
    )
    assert resp.status_code == 200
    violations = resp.json()["violations"]
    assert [(v["source"], v["target"]) for v in violations] == [("api", "db")]
    assert [(i["file"], i["line"]) for i in violations[0]["imports"]] == [
        ("fixpkg/api/admin.py", 2),
        ("fixpkg/api/routes.py", 2),
    ]


def test_contracts_still_501_until_task_3():
    resp = client.post("/api/contracts", json={"drawing": {"layers": [], "arrows": []}})
    assert resp.status_code == 501


def test_scan_missing_repo_returns_400():
    resp = client.post("/api/scan", json={"repo_path": "does-not-exist"})
    assert resp.status_code == 400


def test_check_request_round_trip():
    req = CheckRequest(
        repo_path="demo-app",
        root_package="shop",
        drawing=Drawing(
            layers=["api", "services", "db"],
            arrows=[Arrow(source="api", target="services")],
        ),
    )
    serialised = req.model_dump_json()
    restored = CheckRequest.model_validate_json(serialised)
    assert restored == req
