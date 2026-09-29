from enum import StrEnum

from pydantic import BaseModel, EmailStr, Field


# "worker" is the responder/admin role in the UI.
class UserRole(StrEnum):
    CITIZEN = "citizen"
    WORKER = "worker"


class LoginRequest(BaseModel):
    email: EmailStr
    # Upper bound keeps very long inputs from making the hasher expensive.
    password: str = Field(min_length=8, max_length=128)


class AuthUser(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: UserRole


class LoginResponse(BaseModel):
    user: AuthUser
    access_token: str
    token_type: str = "bearer"
    expires_in: int
