from dataclasses import dataclass
from typing import Protocol

from app.auth.schemas import UserRole


# Internal user shape. Holds the password hash, so it is never returned by the API
# (AuthUser in schemas.py is the public projection).
@dataclass(frozen=True)
class UserRecord:
    id: str
    name: str
    email: str
    role: UserRole
    password_hash: str
    is_active: bool = True


# Structural interface so AuthService can swap the in-memory store for a database later.
class UserRepository(Protocol):
    def get_by_email(self, email: str) -> UserRecord | None: ...
