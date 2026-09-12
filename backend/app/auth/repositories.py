import os

from app.auth.interfaces import UserRecord
from app.auth.schemas import UserRole
from app.core.security import hash_password


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required development environment variable: {name}")
    return value


class InMemoryUserRepository:
    def __init__(self) -> None:
        citizen_email = _required_env("G0NE_DEMO_CITIZEN_EMAIL").lower().strip()
        worker_email = _required_env("G0NE_DEMO_WORKER_EMAIL").lower().strip()

        self._users = {
            citizen_email: UserRecord(
                id="citizen-demo",
                name="Demo Citizen",
                email=citizen_email,
                role=UserRole.CITIZEN,
                password_hash=hash_password(_required_env("G0NE_DEMO_CITIZEN_PASS")),
            ),
            worker_email: UserRecord(
                id="worker-demo",
                name="Demo E-Worker",
                email=worker_email,
                role=UserRole.WORKER,
                password_hash=hash_password(_required_env("G0NE_DEMO_WORKER_PASS")),
            ),
        }

    def get_by_email(self, email: str) -> UserRecord | None:
        return self._users.get(email.lower().strip())
