"""Users API routes."""

from shop.services.users import get_profile, register_user


def signup_route(name: str, email: str) -> dict:
    user_id = register_user(name, email)
    from shop.notifications.email import send_welcome
    send_welcome(email, name)
    return {"status": 201, "user_id": user_id}


def get_user_route(user_id: int) -> dict:
    profile = get_profile(user_id)
    if profile is None:
        return {"status": 404}
    return {"status": 200, "user": profile}
