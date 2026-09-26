"""Git operations for Etch — discard Bob's changes in a target folder."""
from __future__ import annotations

import subprocess
from pathlib import Path


class GitError(Exception):
    """Raised when a git operation fails."""


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
