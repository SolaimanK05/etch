"""Bob runner stub — implemented in task 5.

Builds the refactoring prompt and streams Bob agent events.
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path

from etch.models import BobEvent, Drawing, Violation


def build_prompt(
    violations: list[Violation],
    drawing: Drawing,
    root_package: str,
) -> str:
    """Build a Bob agent prompt describing the violations to fix.

    The prompt includes the drawing's intended architecture and the full list
    of import violations (file, line, code) so Bob knows exactly what to move.

    Raises:
        NotImplementedError: until task 5.
    """
    raise NotImplementedError("build_prompt: task 5")


def run_bob(
    prompt: str,
    workspace: Path,
    max_cost: float,
) -> AsyncIterator[BobEvent]:
    """Run ``bob.cmd run`` and yield one BobEvent per stdout line.

    Executes ``bob.cmd run --mode agent --format stream-json --max-cost N
    --accept-license --trust`` with *prompt* on stdin, streaming output from
    *workspace*. Each JSON line is parsed into a BobEvent and yielded.

    This is a plain ``def`` (not ``async def``) that returns an async iterator;
    the stub raises before any streaming starts.

    Raises:
        NotImplementedError: until task 5.
    """
    raise NotImplementedError("run_bob: task 5")
