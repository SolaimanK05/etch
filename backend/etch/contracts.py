"""Contracts stub — implemented in task 3.

Compiles a Drawing into import-linter contract configuration.
"""
from __future__ import annotations

from etch.models import Drawing


def compile_contracts(drawing: Drawing, root_package: str) -> str:
    """Return the text of a .importlinter file derived from *drawing*.

    Produces one ``forbidden`` contract per ordered pair of drawn layers that
    has no Arrow. Layers with an Arrow between them are explicitly allowed.

    Raises:
        NotImplementedError: until task 3.
    """
    raise NotImplementedError("compile_contracts: task 3")
