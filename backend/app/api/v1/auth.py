from fastapi import APIRouter, HTTPException, status

from app.auth.repositories import InMemoryUserRepository
from app.auth.schemas import LoginRequest, LoginResponse
from app.auth.service import AuthService, InvalidCredentialsError

router = APIRouter()
# Demo accounts live in memory and are rebuilt from settings on every start.
_users = InMemoryUserRepository()
_auth = AuthService(_users)


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    try:
        return _auth.login(email=payload.email, password=payload.password)
    except InvalidCredentialsError as exc:
        # Same message for unknown email and wrong password, so the endpoint
        # can't be used to discover which accounts exist.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from exc
