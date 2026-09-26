"""Order service."""

from shop.db import orders_repo
from shop.notifications.email import send_order_confirmation


def place_order(user_id: int, items: list[tuple[str, float]]) -> dict:
    order_id = orders_repo.save_order(user_id, items)
    send_order_confirmation(user_id, order_id)
    return orders_repo.get_order(order_id)


def find_order(order_id: int) -> dict | None:
    return orders_repo.get_order(order_id)
