"""Violations engine — implemented in task 2.

Compares a real ArchGraph against a user Drawing to find forbidden imports.
"""
from __future__ import annotations

from etch.models import ArchGraph, Drawing, Violation


def find_violations(graph: ArchGraph, drawing: Drawing) -> list[Violation]:
    """Return every Dependency that has no matching Arrow in *drawing*.

    A Dependency from layer A to layer B is a violation when both A and B are
    drawn boxes and the drawing contains no Arrow(source=A, target=B).
    Dependencies touching an undrawn box are ignored.
    """
    drawn = set(drawing.layers)
    allowed = {(a.source, a.target) for a in drawing.arrows}

    violations: list[Violation] = []
    for dep in graph.dependencies:
        if dep.source in drawn and dep.target in drawn:
            if (dep.source, dep.target) not in allowed:
                violations.append(
                    Violation(source=dep.source, target=dep.target, imports=dep.imports)
                )

    violations.sort(key=lambda v: (v.source, v.target))
    return violations
