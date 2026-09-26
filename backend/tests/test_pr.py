"""Open pull request (task 7): snapshot the target folder onto etch/make-it-so without touching
the user's checkout, then point at GitHub's compare page."""
import shutil
import subprocess

import pytest
from fastapi.testclient import TestClient

from etch.gitops import GitError, compare_url, current_branch, snapshot_branch
from etch.main import app

needs_git = pytest.mark.skipif(shutil.which("git") is None, reason="git not installed")


def git(cwd, *args) -> str:
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


@pytest.fixture
def repo(tmp_path):
    git(tmp_path, "init", "-q", "-b", "main")
    git(tmp_path, "config", "user.email", "t@example.com")
    git(tmp_path, "config", "user.name", "t")
    (tmp_path / "app").mkdir()
    (tmp_path / "app" / "a.py").write_text("original\n", encoding="utf-8")
    (tmp_path / "other.txt").write_text("keep\n", encoding="utf-8")
    git(tmp_path, "add", ".")
    git(tmp_path, "commit", "-qm", "init")
    return tmp_path


@pytest.mark.parametrize(
    "remote",
    ["https://github.com/SolaimanK05/etch.git", "https://github.com/SolaimanK05/etch", "git@github.com:SolaimanK05/etch.git"],
)
def test_compare_url_for_github_remotes(remote):
    assert compare_url(remote, "etch/make-it-so", "main") == (
        "https://github.com/SolaimanK05/etch/compare/main...etch/make-it-so?expand=1"
    )


def test_compare_url_is_none_for_other_hosts():
    assert compare_url("https://gitlab.com/a/b.git", "etch/make-it-so", "main") is None


@needs_git
def test_snapshot_commits_only_the_folder_and_leaves_the_checkout_alone(repo):
    (repo / "app" / "a.py").write_text("bob fixed\n", encoding="utf-8")
    (repo / "app" / "new_service.py").write_text("x = 1\n", encoding="utf-8")
    (repo / "other.txt").write_text("user edit\n", encoding="utf-8")
    status_before = git(repo, "status", "--porcelain")

    sha = snapshot_branch(repo / "app", "etch/make-it-so", "Etch: obey the drawing")

    assert git(repo, "rev-parse", "etch/make-it-so") == sha
    assert git(repo, "show", "etch/make-it-so:app/a.py") == "bob fixed"
    assert git(repo, "show", "etch/make-it-so:app/new_service.py") == "x = 1"
    assert git(repo, "show", "etch/make-it-so:other.txt") == "keep"          # outside the folder: not included
    assert git(repo, "log", "-1", "--format=%s", "etch/make-it-so") == "Etch: obey the drawing"
    assert git(repo, "rev-parse", "etch/make-it-so^") == git(repo, "rev-parse", "HEAD")
    assert current_branch(repo) == "main"                                    # never switched
    assert git(repo, "status", "--porcelain") == status_before              # checkout and index untouched


@needs_git
def test_snapshot_again_replaces_the_branch(repo):
    (repo / "app" / "a.py").write_text("v1\n", encoding="utf-8")
    snapshot_branch(repo / "app", "etch/make-it-so", "one")
    (repo / "app" / "a.py").write_text("v2\n", encoding="utf-8")
    snapshot_branch(repo / "app", "etch/make-it-so", "two")
    assert git(repo, "show", "etch/make-it-so:app/a.py") == "v2"
    assert git(repo, "rev-list", "--count", "main..etch/make-it-so") == "1"


def test_snapshot_outside_git_raises(tmp_path):
    with pytest.raises(GitError):
        snapshot_branch(tmp_path, "etch/make-it-so", "x")


@needs_git
def test_pr_endpoint_without_remote_creates_the_branch_but_does_not_push(repo):
    (repo / "app" / "a.py").write_text("bob fixed\n", encoding="utf-8")
    client = TestClient(app, raise_server_exceptions=False)
    resp = client.post("/api/pr", json={"repo_path": str(repo / "app")})
    assert resp.status_code == 200
    body = resp.json()
    assert body["branch"] == "etch/make-it-so"
    assert body["pushed"] is False
    assert body["url"] is None
    assert git(repo, "rev-parse", "etch/make-it-so") == body["commit"]
