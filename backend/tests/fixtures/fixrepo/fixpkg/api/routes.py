from fixpkg.services.users import get_user
from fixpkg.db import repo


def user_route(user_id: int) -> dict:
    return {"name": get_user(user_id), "raw": repo.load(user_id)}
