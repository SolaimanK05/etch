"""User repository."""

from shop.db import store


def get_user(user_id: int) -> dict | None:
    return store.USERS.get(user_id)


def get_user_email(user_id: int) -> str | None:
    user = store.USERS.get(user_id)
    return user["email"] if user else None


def add_user(name: str, email: str) -> int:
    uid = store.next_id(store.USERS)
    store.USERS[uid] = {"id": uid, "name": name, "email": email}
    return uid
