"""Backend API tests."""
from fastapi.testclient import TestClient

from etch.main import app
from etch.models import Arrow, CheckRequest, Drawing

client = TestClient(app, raise_server_exceptions=False)


def test_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "version": "0.1.0"}


def test_scan_default_repo_returns_501():
    # default repo_path="demo-app" must resolve to an existing directory
    # (resolve_repo succeeds) but scan_repo is a stub → 501
    resp = client.post("/api/scan", json={})
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
