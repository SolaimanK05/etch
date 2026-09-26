"""Git operations for Etch — discard Bob's changes in a target folder."""
from __future__ import annotations

import os
import re
import subprocess
import tempfile
from pathlib import Path


class GitError(Exception):
    """Raised when a git operation fails."""


def _git(cwd: str, *args: str, timeout: int = 30, env: dict | None = None) -> str:
    """Run `git -C cwd <args>`, return stdout stripped. Raise GitError on failure."""
    result = subprocess.run(
        ["git", "-C", cwd, *args],
        capture_output=True,
        text=True,
        timeout=timeout,
        env=env,
    )
    if result.returncode != 0:
        raise GitError(result.stderr.strip() or result.stdout.strip())
    return result.stdout.strip()


def discard_changes(path: Path) -> None:
    """Discard all uncommitted changes inside *path* using git.

    1. Verifies *path* is inside a git work tree.
    2. Restores tracked files to HEAD.
    3. Removes untracked files.

    The pathspec ``.`` limits both operations to *path* only.
    Raises :exc:`GitError` on any failure.
    """
    def run(*args: str) -> None:
        result = subprocess.run(
            ["git", "-C", str(path), *args],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise GitError(result.stderr.strip() or result.stdout.strip())

    # Check we are inside a git repo
    check = subprocess.run(
        ["git", "-C", str(path), "rev-parse", "--is-inside-work-tree"],
        capture_output=True,
        text=True,
    )
    if check.returncode != 0:
        raise GitError(check.stderr.strip() or "not inside a git work tree")

    run("restore", "--source=HEAD", "--staged", "--worktree", "--", ".")
    run("clean", "-fd", "--", ".")


def current_branch(path: Path) -> str:
    """Return the current branch name of the repo containing *path*."""
    return _git(str(path), "rev-parse", "--abbrev-ref", "HEAD")


def compare_url(remote_url: str, branch: str, base: str) -> str | None:
    """Return a GitHub compare URL, or None if the remote is not on GitHub."""
    # Match https://github.com/owner/repo(.git) or git@github.com:owner/repo(.git)
    m = re.match(
        r"^(?:https://github\.com/|git@github\.com:)([^/]+/[^/]+?)(?:\.git)?$",
        remote_url,
    )
    if m is None:
        return None
    slug = m.group(1)
    return f"https://github.com/{slug}/compare/{base}...{branch}?expand=1"


def snapshot_branch(path: Path, branch: str, message: str) -> str:
    """Commit the current state of *path* onto *branch* without touching the checkout.

    Uses a temporary index file so the working tree and real index are untouched.
    Returns the sha of the new commit.
    Raises GitError if *path* is not in a git repo or any step fails.
    """
    # Find the repo root
    try:
        repo_root = _git(str(path), "rev-parse", "--show-toplevel")
    except GitError:
        raise GitError(f"Not a git repository: {path}")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".index") as tf:
        idx_path = tf.name

    try:
        env = {**os.environ, "GIT_INDEX_FILE": idx_path}

        def git_idx(*args: str, timeout: int = 30) -> str:
            return _git(repo_root, *args, timeout=timeout, env=env)

        # Start from HEAD state
        git_idx("read-tree", "HEAD")

        # Add only the target folder (path is absolute)
        git_idx("add", "-A", "--", str(path))

        # Write the tree
        tree = git_idx("write-tree")

        # Create the commit on top of HEAD
        sha = git_idx("commit-tree", tree, "-p", "HEAD", "-m", message)

        # Point the branch at the new commit
        git_idx("update-ref", f"refs/heads/{branch}", sha)

        return sha
    finally:
        try:
            os.unlink(idx_path)
        except OSError:
            pass


def push_branch(path: Path, branch: str) -> bool:
    """Push *branch* to origin. Returns False if there is no origin remote."""
    try:
        _git(str(path), "remote", "get-url", "origin")
    except GitError:
        return False
    try:
        _git(str(path), "push", "-f", "origin", branch, timeout=120)
        return True
    except GitError:
        return False


def origin_url(path: Path) -> str | None:
    """Return the URL of the origin remote, or None if not set."""
    try:
        return _git(str(path), "remote", "get-url", "origin")
    except GitError:
        return None
