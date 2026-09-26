"""User service."""

from shop.db import users_repo


def register_user(name: str, email: str) -> int:
    return users_repo.add_user(name, email)


def get_profile(user_id: int) -> dict | None:
    return users_repo.get_user(user_id)
