"""Tests for user routes."""

from shop.api.users import get_user_route, signup_route
from shop.notifications import outbox


def test_signup_returns_201_with_user_id():
    result = signup_route("Linus", "linus@example.com")
    assert result["status"] == 201
    assert result["user_id"] == 3


def test_signup_sends_welcome_email():
    signup_route("Linus", "linus@example.com")
    assert any(
        m["to"] == "linus@example.com" and m["subject"] == "Welcome to Shop"
        for m in outbox.SENT
    )


def test_get_user_route_found():
    signup_route("Linus", "linus@example.com")
    result = get_user_route(3)
    assert result["status"] == 200
    assert result["user"]["name"] == "Linus"


def test_get_user_route_not_found():
    result = get_user_route(999)
    assert result["status"] == 404
