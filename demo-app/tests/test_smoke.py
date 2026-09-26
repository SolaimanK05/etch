"""Smoke tests: verify all shop layer packages are importable."""
import importlib


def test_layers_importable():
    for module in (
        "shop.api",
        "shop.services",
        "shop.db",
        "shop.notifications",
    ):
        importlib.import_module(module)
