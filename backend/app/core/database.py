from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def _build_engine(url: str):
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, pool_pre_ping=True, connect_args=connect_args)


engine = _build_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
active_database_url = settings.database_url


def initialize_database() -> str:
    """Create tables and return the active database URL.

    In development only, fall back to a persistent local SQLite file when the
    configured Postgres service is unavailable. Production never falls back.
    """
    global engine, SessionLocal, active_database_url

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        Base.metadata.create_all(bind=engine)
        return active_database_url
    except SQLAlchemyError:
        if settings.environment == "production":
            raise

        fallback_url = "sqlite:///./jalrakshak-dev.db"
        engine.dispose()
        engine = _build_engine(fallback_url)
        SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
        active_database_url = fallback_url
        Base.metadata.create_all(bind=engine)
        print("WARNING: Postgres unavailable; using persistent development SQLite database.")
        return active_database_url


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
