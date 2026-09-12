from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.emergencies import router as emergencies_router
from app.api.v1.safety import router as safety_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(safety_router, prefix="/safety", tags=["safety"])
api_router.include_router(emergencies_router, prefix="/emergencies", tags=["emergencies"])
