from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "G-0ne API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://g0ne:g0ne@localhost:5432/g0ne"
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
