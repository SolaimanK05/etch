"""Pricing calculations for orders."""


def apply_discount(subtotal: float) -> float:
    if subtotal >= 100:
        subtotal = subtotal * 0.9
    return round(subtotal, 2)
