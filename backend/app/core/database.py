"""SQLAlchemy engine/session setup plus a lightweight startup migration."""
from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def _build_engine(url: str):
    # SQLite connections are thread-bound by default; FastAPI serves sync routes from
    # a thread pool, so that check is disabled. pool_pre_ping drops dead Postgres connections.
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, pool_pre_ping=True, connect_args=connect_args)


engine = _build_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
active_database_url = settings.database_url

# Columns added to `emergencies` after the table first shipped. create_all() never alters
# existing tables, so _ensure_emergency_navigation_columns() adds any that are missing.
_NAVIGATION_COLUMNS = {
    "responder_latitude": "FLOAT",
    "responder_longitude": "FLOAT",
    "recommended_route": "JSON",
    "responder_eta_seconds": "INTEGER",
    "responder_distance_m": "FLOAT",
    "eta_updated_at": "TIMESTAMP",
    "route_updated_at": "TIMESTAMP",
    "navigation_status": "VARCHAR(32)",
    "reroute_reason": "TEXT",
    "acknowledged_at": "TIMESTAMP",
    "assigned_at": "TIMESTAMP",
    "en_route_at": "TIMESTAMP",
    "on_scene_at": "TIMESTAMP",
    "resolved_at": "TIMESTAMP",
    "location_updated_at": "TIMESTAMP",
}


def _ensure_emergency_navigation_columns() -> None:
    """Add navigation/reporting columns without inventing historical timestamps."""
    table_names = set(inspect(engine).get_table_names())
    if "emergencies" not in table_names:
        return
    existing = {column["name"] for column in inspect(engine).get_columns("emergencies")}
    missing = [(name, sql_type) for name, sql_type in _NAVIGATION_COLUMNS.items() if name not in existing]
    if not missing:
        return
    with engine.begin() as connection:
        for name, sql_type in missing:
            if sql_type == "TIMESTAMP" and engine.dialect.name == "postgresql":
                sql_type = "TIMESTAMP WITH TIME ZONE"
            # Safe to interpolate: names and types come from the constant above, never user input.
            connection.execute(text(f"ALTER TABLE emergencies ADD COLUMN {name} {sql_type}"))


def initialize_database() -> str:
    """Create tables and return the active database URL.

    In development only, fall back to a persistent local SQLite file when the
    configured Postgres service is unavailable. Production never falls back.
    """
    # Rebinds module globals so later imports of SessionLocal see the fallback engine.
    global engine, SessionLocal, active_database_url

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        Base.metadata.create_all(bind=engine)
        _ensure_emergency_navigation_columns()
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
        _ensure_emergency_navigation_columns()
        print("WARNING: Postgres unavailable; using persistent development SQLite database.")
        return active_database_url


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: one session per request, always closed afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
