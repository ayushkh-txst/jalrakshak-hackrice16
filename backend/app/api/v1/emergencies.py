from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from threading import Lock
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()


class EmergencyType(str, Enum):
    rescue = "rescue"
    medical = "medical"
    evacuation = "evacuation"


class EmergencyStatus(str, Enum):
    submitted = "submitted"
    assigned = "assigned"
    en_route = "en_route"
    resolved = "resolved"


class EmergencyCreate(BaseModel):
    citizen_id: str
    citizen_name: str
    emergency_type: EmergencyType
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_m: float | None = Field(default=None, ge=0)
    people_count: int = Field(default=1, ge=1, le=50)
    notes: str = Field(default="", max_length=500)
    risk_score: int | None = Field(default=None, ge=0, le=100)
    risk_level: str | None = None
    precipitation_next_6h_mm: float | None = None
    river_discharge_m3s: float | None = None


class EmergencyUpdate(BaseModel):
    status: EmergencyStatus
    responder_id: str | None = None
    responder_name: str | None = None


class EmergencyRecord(EmergencyCreate):
    id: str
    status: EmergencyStatus
    created_at: str
    updated_at: str | None = None
    responder_id: str | None = None
    responder_name: str | None = None


_records: list[EmergencyRecord] = []
_lock = Lock()


@router.post("", response_model=EmergencyRecord, status_code=201)
def create_emergency(payload: EmergencyCreate) -> EmergencyRecord:
    now = datetime.now(timezone.utc).isoformat()
    record = EmergencyRecord(
        **payload.model_dump(),
        id=f"SOS-{uuid4().hex[:8].upper()}",
        status=EmergencyStatus.submitted,
        created_at=now,
        updated_at=now,
    )
    with _lock:
        _records.insert(0, record)
    return record


@router.get("", response_model=list[EmergencyRecord])
def list_emergencies() -> list[EmergencyRecord]:
    with _lock:
        return list(_records)


@router.patch("/{emergency_id}", response_model=EmergencyRecord)
def update_emergency(emergency_id: str, payload: EmergencyUpdate) -> EmergencyRecord:
    with _lock:
        for index, record in enumerate(_records):
            if record.id != emergency_id:
                continue
            updated = record.model_copy(update={
                "status": payload.status,
                "responder_id": payload.responder_id if payload.responder_id is not None else record.responder_id,
                "responder_name": payload.responder_name if payload.responder_name is not None else record.responder_name,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            _records[index] = updated
            return updated
    raise HTTPException(status_code=404, detail="Emergency request not found")
