"""Tests for order routes."""

from shop.api.orders import create_order_route, get_order_route
from shop.notifications import outbox


def test_create_order_small():
    result = create_order_route(1, [("book", 30.0), ("pen", 5.0)])
    assert result["status"] == 201
    assert result["order"]["total"] == 35.0


def test_create_order_with_discount():
    result = create_order_route(1, [("desk", 150.0)])
    assert result["order"]["total"] == 135.0


def test_place_order_sends_email():
    result = create_order_route(1, [("book", 30.0), ("pen", 5.0)])
    order_id = result["order"]["id"]
    assert any(
        m["to"] == "ada@example.com" and m["subject"] == f"Order #{order_id} confirmed"
        for m in outbox.SENT
    )


def test_get_order_route_found():
    created = create_order_route(1, [("book", 30.0)])
    order_id = created["order"]["id"]
    result = get_order_route(order_id)
    assert result["status"] == 200
    assert result["order"]["id"] == order_id


def test_get_order_route_not_found():
    result = get_order_route(999)
    assert result["status"] == 404
