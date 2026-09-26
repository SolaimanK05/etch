"""Email notifications."""

from shop.notifications import outbox
from shop.db.users_repo import get_user_email


def send_order_confirmation(user_id: int, order_id: int) -> None:
    email = get_user_email(user_id)
    if email:
        outbox.send(email, f"Order #{order_id} confirmed", f"Your order {order_id} is confirmed.")


def send_welcome(email: str, name: str) -> None:
    outbox.send(email, "Welcome to Shop", f"Hi {name}!")
