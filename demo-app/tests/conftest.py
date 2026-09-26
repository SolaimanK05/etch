"""Shared fixtures for shop tests."""

import pytest

from shop.db import store
from shop.notifications import outbox


@pytest.fixture(autouse=True)
def reset_state():
    store.reset()
    outbox.reset()
