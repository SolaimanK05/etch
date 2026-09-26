"""Scanner stub — implemented in task 2.

Builds a grimp graph of root_package inside the given repo.
Layers are the direct child packages of root_package.
Aggregates direct imports between different layers, recording file and line.
"""
from __future__ import annotations

from pathlib import Path

from etch.models import ArchGraph


def scan_repo(repo_path: Path, root_package: str) -> ArchGraph:
    """Build an ArchGraph by scanning *root_package* inside *repo_path*.

    Uses grimp to resolve all imports. Layers are the direct child packages of
    *root_package*. Each cross-layer import is recorded as an ImportDetail
    (file path, 1-based line number, stripped source line).

    Raises:
        NotImplementedError: until task 2.
    """
    raise NotImplementedError("scan_repo: task 2")
