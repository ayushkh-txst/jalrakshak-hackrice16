from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "G-0ne API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://g0ne:g0ne@localhost:5432/g0ne"
    frontend_origin: str = "http://localhost:5173"
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    # Optional; keys stay on the backend. Alerts/contacts do not require AI.
    openai_api_key: SecretStr = SecretStr("")
    dispatch_ai_model: str = ""

    # Development-only demo accounts. Loaded from .env.
    # Use example.com so Pydantic EmailStr accepts the addresses during validation.
    demo_citizen_email: str = "citizen@example.com"
    demo_citizen_password: SecretStr = SecretStr("CitizenDemo2026!")
    demo_worker_email: str = "worker@example.com"
    demo_worker_password: SecretStr = SecretStr("WorkerDemo2026!")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
