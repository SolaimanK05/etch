"""Stand-in for `bob run --format stream-json` (task 5 tests). Costs no Bobcoins.

Run with cwd = the workspace. Reads the prompt from stdin, records it and the
argv to .fake_bob_prompt.txt / .fake_bob_args.txt, then emits stream-json lines.

FAKE_BOB_MODE=fix  (default): reroutes shop/api/orders.py through services
                              (fixes 1 of the demo-app's 4 violations), like Bob would.
FAKE_BOB_MODE=box           : builds the drawn `pricing` box: creates shop/pricing/, moves
                              shop/services/pricing.py into it and fixes db's import
                              (the db -> services violation disappears).
FAKE_BOB_MODE=nobox         : like `box` but only touches db (never creates the package).
FAKE_BOB_MODE=boxinit       : like `box`, but the code goes into shop/pricing/__init__.py
                              (what the real Bob did in the first live new-box run).
FAKE_BOB_MODE=emptybox      : creates shop/pricing/ with only a docstring and moves nothing.
FAKE_BOB_MODE=fail          : prints one message, complains on stderr, exits 1.
"""
import json
import os
import sys
from pathlib import Path


def emit(obj: dict) -> None:
    print(json.dumps(obj), flush=True)


def main() -> int:
    prompt = sys.stdin.read()
    Path(".fake_bob_prompt.txt").write_text(prompt, encoding="utf-8")
    Path(".fake_bob_args.txt").write_text("\n".join(sys.argv[1:]), encoding="utf-8")

    if os.environ.get("FAKE_BOB_MODE", "fix") == "fail":
        emit({"type": "message", "role": "assistant", "content": "Starting"})
        print("fake bob: authentication failed", file=sys.stderr, flush=True)
        return 1

    mode = os.environ.get("FAKE_BOB_MODE", "fix")
    if mode in ("box", "nobox", "boxinit", "emptybox"):
        emit({"type": "message", "role": "assistant", "content": "Creating the pricing package."})
        repo_file = Path("shop/db/orders_repo.py")
        if mode in ("boxinit", "emptybox"):
            # what the real Bob did in the first live run: the code lives in __init__.py
            pkg = Path("shop/pricing")
            emit({"type": "tool_use", "tool_name": "write_file", "tool_id": "b1", "parameters": {"path": "shop/pricing/__init__.py"}})
            pkg.mkdir(exist_ok=True)
            old = Path("shop/services/pricing.py")
            if mode == "boxinit":
                (pkg / "__init__.py").write_text(old.read_text(encoding="utf-8"), encoding="utf-8")
                old.unlink()
                new_import = "from shop.pricing import apply_discount"
            else:  # an empty package: the box exists but nothing was moved into it
                (pkg / "__init__.py").write_text('"""Pricing."""\n', encoding="utf-8")
                new_import = "from shop.services.pricing import apply_discount"
            emit({"type": "tool_result", "tool_id": "b1", "status": "success", "output": "created"})
        elif mode == "box":
            pkg = Path("shop/pricing")
            emit({"type": "tool_use", "tool_name": "write_to_file", "tool_id": "b1", "parameters": {"path": "shop/pricing/__init__.py"}})
            pkg.mkdir(exist_ok=True)
            (pkg / "__init__.py").write_text('"""Pricing: discount math, no I/O."""\n', encoding="utf-8")
            old = Path("shop/services/pricing.py")
            (pkg / "discounts.py").write_text(old.read_text(encoding="utf-8"), encoding="utf-8")
            old.unlink()
            emit({"type": "tool_result", "tool_id": "b1", "status": "success", "output": "created"})
            new_import = "from shop.pricing.discounts import apply_discount"
        else:
            new_import = "from shop.services import pricing as _p\napply_discount = _p.apply_discount"
        emit({"type": "tool_use", "tool_name": "apply_diff", "tool_id": "b2", "parameters": {"path": repo_file.as_posix()}})
        text = repo_file.read_text(encoding="utf-8")
        repo_file.write_text(text.replace("from shop.services.pricing import apply_discount", new_import), encoding="utf-8")
        emit({"type": "tool_result", "tool_id": "b2", "status": "success", "output": "applied"})
        emit({"type": "result", "status": "success", "stats": {"task_id": "fake", "duration_ms": 2345, "session_costs": 0.21, "max_cost": 1, "tool_calls": 2}})
        return 0
    target = Path("shop/api/orders.py")
    emit({"type": "message", "role": "assistant", "content": "Rerouting api through services."})
    emit({"type": "tool_use", "tool_name": "read_file", "tool_id": "t1", "parameters": {"path": str(target.as_posix())}})
    emit({"type": "tool_result", "tool_id": "t1", "status": "success", "output": "..."})
    emit({"type": "tool_use", "tool_name": "apply_diff", "tool_id": "t2", "parameters": {"path": str(target.as_posix())}})
    if target.exists():
        text = target.read_text(encoding="utf-8")
        text = text.replace(
            "from shop.db.orders_repo import get_order",
            "from shop.services.orders import find_order as get_order",
        )
        target.write_text(text, encoding="utf-8")
    emit({"type": "tool_result", "tool_id": "t2", "status": "success", "output": "applied"})
    emit({"type": "tool_use", "tool_name": "execute_command", "tool_id": "t3", "parameters": {"command": "python -m pytest -q"}})
    emit({"type": "tool_result", "tool_id": "t3", "status": "success", "output": "..........\n10 passed in 0.05s"})
    emit({"type": "result", "status": "success", "stats": {"task_id": "fake", "duration_ms": 1234, "session_costs": 0.12, "max_cost": 1, "tool_calls": 3}})
    return 0


if __name__ == "__main__":
    sys.exit(main())
