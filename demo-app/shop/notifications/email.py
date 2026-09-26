"""Email notifications."""

from shop.notifications import outbox


def send_order_confirmation(email: str, order_id: int) -> None:
    if email:
        outbox.send(email, f"Order #{order_id} confirmed", f"Your order {order_id} is confirmed.")


def send_welcome(email: str, name: str) -> None:
    outbox.send(email, "Welcome to Shop", f"Hi {name}!")
