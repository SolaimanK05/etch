"""Order service."""

from shop.db import orders_repo, users_repo
from shop.notifications.email import send_order_confirmation
from shop.services.pricing import apply_discount


def place_order(user_id: int, items: list[tuple[str, float]]) -> dict:
    total = apply_discount(sum(price for _, price in items))
    order_id = orders_repo.save_order(user_id, items, total)
    email = users_repo.get_user_email(user_id)
    send_order_confirmation(email, order_id)
    return orders_repo.get_order(order_id)


def find_order(order_id: int) -> dict | None:
    return orders_repo.get_order(order_id)
