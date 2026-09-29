"""FastAPI entry point: builds the app, wires middleware and routers, and serves the SPA."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.api.v1.emergencies import seed_demo_emergencies
from app.core import database
from app.core.config import settings
from app.web import mount_frontend


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Runs once at startup: create/upgrade tables, then make sure the demo
    # incidents exist so the responder dashboard is never empty on a fresh deploy.
    database.initialize_database()
    with database.SessionLocal() as db:
        seed_demo_emergencies(db)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        # Interactive API docs are a dev convenience; hide them in production.
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    # Only the configured frontend origin may call the API with credentials.
    # Methods/headers are an allow-list of exactly what the frontend uses.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )

    app.include_router(api_router, prefix="/api/v1")

    # Unauthenticated liveness probe used by Render health checks.
    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    # Mounted last so API routes above always win over the static-file catch-all.
    mount_frontend(app, settings.frontend_dist)
    return app


app = create_app()
