"""Orders API routes."""

from shop.services.orders import find_order, place_order


def create_order_route(user_id: int, items: list[tuple[str, float]]) -> dict:
    order = place_order(user_id, items)
    return {"status": 201, "order": order}


def get_order_route(order_id: int) -> dict:
    order = find_order(order_id)
    if order is None:
        return {"status": 404}
    return {"status": 200, "order": order}
