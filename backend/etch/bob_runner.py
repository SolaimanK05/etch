"""Bob runner — task 5.

Builds the refactoring prompt and streams Bob agent events.
"""
from __future__ import annotations

import json
import os
import platform
import shutil
import subprocess
import sys
import threading
from collections import deque
from collections.abc import Iterator
from pathlib import Path

from etch.models import BobEvent, Drawing, Violation

# Module-level concurrency guard
_lock = threading.Lock()
_current: subprocess.Popen | None = None


def bob_command(max_cost: float) -> list[str]:
    """Return the command list for running Bob Shell."""
    raw = os.environ.get("ETCH_BOB_CMD")
    if raw:
        base = json.loads(raw)
    else:
        base = [shutil.which("bob") or "bob"]
    return base + [
        "run", "--mode", "agent", "--format", "stream-json",
        "--max-cost", f"{max_cost:g}", "--accept-license", "--trust",
    ]


def parse_event(line: str) -> BobEvent | None:
    """Parse one stdout line from Bob into a BobEvent, or None for blank lines."""
    if not line.strip():
        return None
    try:
        obj = json.loads(line)
        if isinstance(obj, dict):
            return BobEvent(type=obj.get("type", "unknown"), data=obj)
    except json.JSONDecodeError:
        pass
    return BobEvent(type="log", data={"text": line.strip()})


def run_bob(
    prompt: str,
    workspace: Path,
    max_cost: float,
) -> Iterator[BobEvent]:
    """Run Bob Shell and yield one BobEvent per stdout line.

    This is a synchronous generator. Only one run is allowed at a time.
    """
    global _current

    with _lock:
        if _current is not None:
            yield BobEvent(type="error", data={"message": "a Make it so run is already in progress"})
            return

    try:
        proc = subprocess.Popen(
            bob_command(max_cost),
            cwd=workspace,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except FileNotFoundError:
        yield BobEvent(type="error", data={"message": "Bob Shell not found: install it and set BOB_API_KEY"})
        return

    with _lock:
        _current = proc

    # Drain stderr in a daemon thread to prevent deadlock
    stderr_lines: deque[str] = deque(maxlen=20)

    def drain_stderr() -> None:
        assert proc.stderr is not None
        for raw in proc.stderr:
            stderr_lines.append(raw.decode("utf-8", errors="replace").rstrip())

    stderr_thread = threading.Thread(target=drain_stderr, daemon=True)
    stderr_thread.start()

    try:
        # Write prompt to stdin and close it
        assert proc.stdin is not None
        proc.stdin.write(prompt.encode("utf-8"))
        proc.stdin.close()

        # Stream stdout line by line
        seen_result = False
        assert proc.stdout is not None
        for raw_line in proc.stdout:
            line = raw_line.decode("utf-8", errors="replace").rstrip("\n\r")
            event = parse_event(line)
            if event is None:
                continue
            if event.type == "result":
                seen_result = True
            yield event

        proc.wait()
        stderr_thread.join()

        rc = proc.returncode
        if rc != 0 and not seen_result:
            tail = " ".join(stderr_lines)
            yield BobEvent(
                type="error",
                data={"message": f"Bob exited with exit code {rc}: {tail}"},
            )
    finally:
        # If the consumer stopped early (Bob's own error event, Stop, client gone),
        # never leave a headless Bob running and spending coins in the background.
        if proc.poll() is None:
            _kill_tree(proc)
        with _lock:
            _current = None


def _kill_tree(proc: subprocess.Popen) -> None:
    """Kill proc and its children (bob.CMD starts a child node process on Windows)."""
    if platform.system() == "Windows":
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(proc.pid)], capture_output=True)
    else:
        proc.kill()


def stop_current() -> bool:
    """Kill the running Bob process. Returns False if nothing is running."""
    with _lock:
        proc = _current
    if proc is None:
        return False
    _kill_tree(proc)
    return True


def build_prompt(
    violations: list[Violation],
    drawing: Drawing,
    root_package: str,
    python: str = sys.executable,
) -> str:
    """Build the Bob agent prompt describing the violations to fix."""
    arrows_lines = "\n".join(f"- {a.source} → {a.target}" for a in drawing.arrows)
    # The forbidden-imports sentence lists real layers AND new box ids
    drawn = ", ".join(drawing.layers + [b.id for b in drawing.new_boxes])

    violation_blocks = []
    n = 1
    for v in violations:
        for imp in v.imports:
            violation_blocks.append(
                f"{n}. {imp.file}:{imp.line}  ({v.source} ↛ {v.target})\n   {imp.code}"
            )
            n += 1
    violations_text = "\n".join(violation_blocks)

    # New-boxes block (only when there are new boxes)
    new_boxes_block = ""
    if drawing.new_boxes:
        lines = ["Create these new packages the architect drew:"]
        # Build a set of arrow pairs for lookup, preserving drawing order
        for i, box in enumerate(drawing.new_boxes, start=1):
            box_arrows = [
                f"{a.source} → {a.target}"
                for a in drawing.arrows
                if a.source == box.id or a.target == box.id
            ]
            arrows_str = ", ".join(box_arrows) if box_arrows else "none"
            intent_str = box.intent if box.intent else "not described; infer it from the arrows and the code"
            lines.append(
                f"{i}. {root_package}.{box.id}  (create {root_package}/{box.id}/__init__.py)\n"
                f"   What belongs there: {intent_str}\n"
                f"   Arrows: {arrows_str}"
            )
        lines.append(
            "Move the code that belongs there out of the existing packages (move, don't copy), "
            "then update every import of it, including import lines in tests/. "
            "Leave no module behind that only re-exports the moved code."
        )
        new_boxes_block = "\n".join(lines)

    # Violations block (only when there are violations)
    violations_block = ""
    if violations:
        violations_block = (
            f"These imports break the drawing. Fix every one of them:\n"
            f"{violations_text}"
        )

    # Build "stop when" suffix
    new_boxes_suffix = ", every new package exists with the code that belongs there" if drawing.new_boxes else ""
    stop_line = f"Stop when every listed import is gone{new_boxes_suffix} and the tests pass. Reply with one line saying what you moved."

    # Assemble the prompt
    parts = [
        f"You are refactoring the Python package `{root_package}` in this workspace so that its imports obey an architecture drawing.",
        "",
        "Allowed dependencies between its top-level packages (an arrow means \"may import\"):",
        arrows_lines,
        f"Every other import between {drawn} is forbidden. Going through an allowed package is fine (if a → b and b → c are drawn, a may call b which calls c).",
    ]
    if new_boxes_block:
        parts.append("")
        parts.append(new_boxes_block)
    if violations_block:
        parts.append("")
        parts.append(violations_block)
    parts.extend([
        "",
        "How to fix:",
        "- Route each call through a package the drawing allows: add or reuse a function in an allowed package, or pass the data in as an argument. Moving the import inside a function or using importlib does not count; Etch scans those too.",
        "- Keep every public function's name, signature and behaviour exactly as they are. The tests call them.",
        f"- Do not modify tests/ (except import lines that point at code you moved), .importlinter, .etch/ or anything outside {root_package}/. Do not install packages. Do not run git.",
        f"- When your edits are done, run: {python} -m pytest -q",
        "  It must pass. If it fails, fix the code (never the tests) and run it again.",
        f"- {stop_line}",
    ])
    return "\n".join(parts)
