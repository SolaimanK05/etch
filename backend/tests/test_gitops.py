"""Undo: discard Bob's changes inside the target folder only (task 5)."""
import shutil
import subprocess

import pytest
from fastapi.testclient import TestClient

from etch.gitops import GitError, discard_changes
from etch.main import app

pytestmark = pytest.mark.skipif(shutil.which("git") is None, reason="git not installed")


def git(cwd, *args):
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True)


@pytest.fixture
def repo(tmp_path):
    git(tmp_path, "init", "-q")
    git(tmp_path, "config", "user.email", "t@example.com")
    git(tmp_path, "config", "user.name", "t")
    (tmp_path / "app").mkdir()
    (tmp_path / "app" / "a.py").write_text("original\n", encoding="utf-8")
    (tmp_path / "other.txt").write_text("keep\n", encoding="utf-8")
    git(tmp_path, "add", ".")
    git(tmp_path, "commit", "-qm", "init")
    return tmp_path


def test_discard_changes_restores_only_the_target_folder(repo):
    (repo / "app" / "a.py").write_text("bob edited\n", encoding="utf-8")
    (repo / "app" / "new_service.py").write_text("x = 1\n", encoding="utf-8")
    (repo / "other.txt").write_text("user edit\n", encoding="utf-8")

    discard_changes(repo / "app")

    assert (repo / "app" / "a.py").read_text(encoding="utf-8") == "original\n"
    assert not (repo / "app" / "new_service.py").exists()
    assert (repo / "other.txt").read_text(encoding="utf-8") == "user edit\n"  # outside: untouched


def test_discard_changes_outside_git_raises(tmp_path):
    with pytest.raises(GitError):
        discard_changes(tmp_path)


def test_undo_endpoint(repo):
    (repo / "app" / "a.py").write_text("bob edited\n", encoding="utf-8")
    client = TestClient(app, raise_server_exceptions=False)
    resp = client.post("/api/undo", json={"repo_path": str(repo / "app")})
    assert resp.status_code == 200
    assert resp.json() == {"undone": True}
    assert (repo / "app" / "a.py").read_text(encoding="utf-8") == "original\n"


def test_undo_endpoint_outside_git_is_400(tmp_path):
    client = TestClient(app, raise_server_exceptions=False)
    resp = client.post("/api/undo", json={"repo_path": str(tmp_path)})
    assert resp.status_code == 400
