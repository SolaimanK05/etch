"""Skill generator stub — implemented in task 7.

Generates a Bob skill and custom mode from a Drawing.
"""
from __future__ import annotations

from etch.models import Drawing


def generate_bob_skill(drawing: Drawing, root_package: str) -> dict[str, str]:
    """Return a map of repo-relative path → file content.

    Produces a Bob skill (SKILL.md) and a custom mode (custom_modes.yaml)
    tailored to the architecture described in *drawing* for *root_package*.

    Raises:
        NotImplementedError: until task 7.
    """
    raise NotImplementedError("generate_bob_skill: task 7")
