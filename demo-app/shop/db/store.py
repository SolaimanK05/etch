"""In-memory data store for the shop."""

USERS: dict[int, dict] = {}
ORDERS: dict[int, dict] = {}


def reset() -> None:
    USERS.clear()
    ORDERS.clear()
    USERS.update(
        {
            1: {"id": 1, "name": "Ada", "email": "ada@example.com"},
            2: {"id": 2, "name": "Grace", "email": "grace@example.com"},
        }
    )


def next_id(table: dict) -> int:
    return max(table, default=0) + 1


reset()
