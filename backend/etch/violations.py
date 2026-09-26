"""Violations stub — implemented in task 2.

Compares a real ArchGraph against a user Drawing to find forbidden imports.
"""
from __future__ import annotations

from etch.models import ArchGraph, Drawing, Violation


def find_violations(graph: ArchGraph, drawing: Drawing) -> list[Violation]:
    """Return every Dependency that has no matching Arrow in *drawing*.

    A Dependency from layer A to layer B is a violation when the drawing
    contains no Arrow(source=A, target=B).

    Raises:
        NotImplementedError: until task 2.
    """
    raise NotImplementedError("find_violations: task 2")
