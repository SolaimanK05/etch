"""User service."""

from shop.db import users_repo
from shop.notifications.email import send_welcome


def register_user(name: str, email: str) -> int:
    user_id = users_repo.add_user(name, email)
    send_welcome(email, name)
    return user_id


def get_profile(user_id: int) -> dict | None:
    return users_repo.get_user(user_id)
