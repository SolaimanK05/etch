from fixpkg.db.repo import load


def get_user(user_id: int) -> str | None:
    return load(user_id)
