from app.auth.interfaces import UserRecord
from app.auth.schemas import UserRole
from app.core.config import settings
from app.core.security import hash_password


class InMemoryUserRepository:
    def __init__(self) -> None:
        citizen_email = settings.demo_citizen_email.lower().strip()
        worker_email = settings.demo_worker_email.lower().strip()

        self._users = {
            citizen_email: UserRecord(
                id="citizen-demo",
                name="Demo Citizen",
                email=citizen_email,
                role=UserRole.CITIZEN,
                password_hash=hash_password(settings.demo_citizen_password.get_secret_value()),
            ),
            worker_email: UserRecord(
                id="worker-demo",
                name="Demo E-Worker",
                email=worker_email,
                role=UserRole.WORKER,
                password_hash=hash_password(settings.demo_worker_password.get_secret_value()),
            ),
        }

    def get_by_email(self, email: str) -> UserRecord | None:
        return self._users.get(email.lower().strip())
