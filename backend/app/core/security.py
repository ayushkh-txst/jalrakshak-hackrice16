"""Password hashing and JWT issuing. Token verification lives in api/v1/hazards.signed_reporter."""
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.core.config import settings

# pwdlib's recommended hasher (Argon2) — salted and deliberately slow to resist brute force.
_password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _password_hash.verify(password, password_hash)


def create_access_token(*, subject: str, role: str) -> tuple[str, int]:
    """Return a signed, short-lived token plus its lifetime in seconds.

    `sub` is the user ID and `role` drives authorization on every endpoint,
    so both are signed and never read from request bodies.
    """
    expires_in = settings.access_token_minutes * 60
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_in
