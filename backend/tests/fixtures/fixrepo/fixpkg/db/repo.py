import os

_ROWS = {1: "ada"}


def load(user_id: int) -> str | None:
    return _ROWS.get(user_id) or os.environ.get("FIXPKG_DEFAULT")


def delete(user_id: int) -> None:
    _ROWS.pop(user_id, None)
