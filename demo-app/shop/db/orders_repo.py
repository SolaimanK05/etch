"""Order repository."""

from shop.db import store


def save_order(user_id: int, items: list[tuple[str, float]], total: float) -> int:
    oid = store.next_id(store.ORDERS)
    store.ORDERS[oid] = {"id": oid, "user_id": user_id, "items": items, "total": total}
    return oid


def get_order(order_id: int) -> dict | None:
    return store.ORDERS.get(order_id)
