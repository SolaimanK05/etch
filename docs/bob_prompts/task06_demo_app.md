# Etch — Task 6: demo-app with planted layering violations

Build the small in-memory "shop" app in `demo-app/` that Etch demos on. Its intended architecture is **api → services, services → db, services → notifications**. Exactly 4 imports must break that; they are planted on purpose so Etch can find them and Bob can later fix them.

## Scope (strict)
- **Create/edit only under `demo-app/`.** Keep the existing layer `__init__.py` files, `pyproject.toml` and `tests/test_smoke.py`.
- **Read only** `backend/tests/test_demo_app.py` (the acceptance test) and the existing `demo-app/` files. Don't explore anything else.
- **Do not modify anything outside `demo-app/`.** Don't install anything.
- **Realism rule:** no comments or docstrings in `demo-app/` may mention layers, architecture, violations, "planted", Etch or Bob. Write it like ordinary code. Keep module docstrings to one neutral line.
- **Windows PowerShell:** use `..\backend\.venv\Scripts\python.exe` from `demo-app/`. No servers, no git.

## Modules

Use Python 3.12 type hints. **Don't add** any `shop.*` import beyond those listed. The four imports marked ⚠ are the planted violations; write them exactly as shown.

**`shop/db/store.py`**
- `USERS: dict[int, dict] = {}` and `ORDERS: dict[int, dict] = {}`.
- `reset() -> None` clears both and seeds `USERS` with `{1: {"id": 1, "name": "Ada", "email": "ada@example.com"}, 2: {"id": 2, "name": "Grace", "email": "grace@example.com"}}`.
- `next_id(table: dict) -> int` returns `max(table, default=0) + 1`.
- Call `reset()` at module import.

**`shop/db/users_repo.py`**
- Imports: `from shop.db import store`.
- `get_user(user_id) -> dict | None`
- `get_user_email(user_id) -> str | None`
- `add_user(name, email) -> int`

**`shop/db/orders_repo.py`**
- Imports: `from shop.db import store` and ⚠ `from shop.services.pricing import apply_discount`.
- `save_order(user_id: int, items: list[tuple[str, float]]) -> int` stores `{"id", "user_id", "items", "total"}`, where `total = apply_discount(sum of prices)`.
- `get_order(order_id) -> dict | None`

**`shop/services/pricing.py`**
- No `shop` imports.
- `apply_discount(subtotal: float) -> float` takes 10% off when `subtotal >= 100` and returns `round(x, 2)`.

**`shop/services/orders.py`**
- Imports: `from shop.db import orders_repo` and `from shop.notifications.email import send_order_confirmation`.
- `place_order(user_id, items) -> dict` saves the order, calls `send_order_confirmation(user_id, order_id)` and returns the stored order.
- `find_order(order_id) -> dict | None`

**`shop/services/users.py`**
- Imports: `from shop.db import users_repo`.
- `register_user(name, email) -> int`
- `get_profile(user_id) -> dict | None`

**`shop/notifications/outbox.py`**
- No `shop` imports.
- `SENT: list[dict] = []`
- `send(to: str, subject: str, body: str) -> None` appends `{"to", "subject", "body"}`.
- `reset() -> None` clears `SENT`.

**`shop/notifications/email.py`**
- Imports: `from shop.notifications import outbox` and ⚠ `from shop.db.users_repo import get_user_email`.
- `send_order_confirmation(user_id: int, order_id: int) -> None` looks up the email and sends the subject `f"Order #{order_id} confirmed"`.
- `send_welcome(email: str, name: str) -> None` sends the subject `"Welcome to Shop"` with body `f"Hi {name}!"`.

**`shop/api/orders.py`**
- Imports: ⚠ `from shop.db.orders_repo import get_order` and `from shop.services.orders import place_order`.
- `create_order_route(user_id: int, items: list[tuple[str, float]]) -> dict` returns `{"status": 201, "order": order}`.
- `get_order_route(order_id: int) -> dict` uses `get_order` and returns `{"status": 200, "order": order}`, or `{"status": 404}` if the order is missing.

**`shop/api/users.py`**
- Imports: `from shop.services.users import get_profile, register_user`.
- `signup_route(name: str, email: str) -> dict`:
  - registers the user
  - then does ⚠ a **function-local** `from shop.notifications.email import send_welcome` and calls `send_welcome(email, name)`
  - returns `{"status": 201, "user_id": user_id}`
- `get_user_route(user_id: int) -> dict` returns `{"status": 200, "user": profile}`, or `{"status": 404}`.

## Tests (`demo-app/tests/`)

Tests may import **only** `shop.api.orders`, `shop.api.users`, `shop.db.store` and `shop.notifications.outbox`. A later refactor must be able to move code between the other modules without breaking the tests.

- **`conftest.py`:** an autouse fixture that calls `store.reset()` and `outbox.reset()`.
- **`test_orders.py`:**
  - For user 1, items `[("book", 30.0), ("pen", 5.0)]` give status 201 and total `35.0`.
  - `[("desk", 150.0)]` gives total `135.0`.
  - Placing an order sends an email to `ada@example.com` with subject `Order #<id> confirmed`.
  - `get_order_route` returns 200 for an existing order and 404 for id 999.
- **`test_users.py`:**
  - `signup_route("Linus", "linus@example.com")` returns 201 with `user_id == 3` and sends a "Welcome to Shop" email to linus.
  - `get_user_route(3)` after signup returns 200 with name Linus; id 999 returns 404.

## Acceptance checks (both must exit 0)
1. From `demo-app/`: `..\backend\.venv\Scripts\python.exe -m pytest -q`. At least 9 tests must pass.
2. From `backend/`: `.venv\Scripts\python.exe -m pytest -q`. Expect **28 passed**. This includes `tests/test_demo_app.py`, which checks the exact dependency pairs and the 4 violations.

If a check fails, fix `demo-app/`, never the backend tests. If the same failure repeats twice, stop and report it.

## Final reply (short)
- both pytest summary lines
- the created file list
- any deviation from this spec, with the reason
