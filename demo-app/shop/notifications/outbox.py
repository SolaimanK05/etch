"""Outgoing message outbox."""

SENT: list[dict] = []


def send(to: str, subject: str, body: str) -> None:
    SENT.append({"to": to, "subject": subject, "body": body})


def reset() -> None:
    SENT.clear()
