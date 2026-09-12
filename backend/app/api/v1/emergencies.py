from __future__ import annotations

from datetime import datetime, timedelta, timezone
from enum import Enum
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.core.database import Base, get_db

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


class Emergency(Base):
    __tablename__ = "emergencies"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    citizen_id: Mapped[str] = mapped_column(String(128), index=True)
    citizen_name: Mapped[str] = mapped_column(String(160))
    emergency_type: Mapped[str] = mapped_column(String(32))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    people_count: Mapped[int] = mapped_column(Integer, default=1)
    notes: Mapped[str] = mapped_column(Text, default="")
    risk_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    risk_level: Mapped[str | None] = mapped_column(String(32), nullable=True)
    precipitation_next_6h_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    river_discharge_m3s: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default=EmergencyStatus.submitted.value, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    responder_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    responder_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


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
    created_at: datetime
    updated_at: datetime | None = None
    responder_id: str | None = None
    responder_name: str | None = None
    is_demo: bool = False

    model_config = ConfigDict(from_attributes=True)


DEMO_INCIDENTS = [
    {
        "id": "DEMO-1042",
        "citizen_id": "demo-meena",
        "citizen_name": "Meena Devi",
        "emergency_type": "rescue",
        "latitude": 27.7172,
        "longitude": 85.3240,
        "accuracy_m": 9.0,
        "people_count": 4,
        "notes": "Family trapped near the ground floor. Water rising around the access road.",
        "risk_score": 87,
        "risk_level": "critical",
        "precipitation_next_6h_mm": 42.8,
        "river_discharge_m3s": 183.4,
        "status": "en_route",
        "responder_id": "demo-amit",
        "responder_name": "Amit Kumar",
        "minutes_ago": 21,
    },
    {
        "id": "DEMO-1039",
        "citizen_id": "demo-bikash",
        "citizen_name": "Bikash Rai",
        "emergency_type": "medical",
        "latitude": 27.7098,
        "longitude": 85.3314,
        "accuracy_m": 14.0,
        "people_count": 1,
        "notes": "Medical assistance requested for an elderly resident unable to evacuate independently.",
        "risk_score": 71,
        "risk_level": "high",
        "precipitation_next_6h_mm": 31.2,
        "river_discharge_m3s": 158.1,
        "status": "submitted",
        "minutes_ago": 12,
    },
    {
        "id": "DEMO-1036",
        "citizen_id": "demo-community",
        "citizen_name": "Kankarbhaag Colony",
        "emergency_type": "evacuation",
        "latitude": 27.7027,
        "longitude": 85.3188,
        "accuracy_m": 22.0,
        "people_count": 12,
        "notes": "Community group needs transport to a safe zone before the lower road becomes impassable.",
        "risk_score": 64,
        "risk_level": "high",
        "precipitation_next_6h_mm": 28.7,
        "river_discharge_m3s": 145.3,
        "status": "assigned",
        "responder_id": "demo-sita",
        "responder_name": "Sita Thapa",
        "minutes_ago": 34,
    },
    {
        "id": "DEMO-1033",
        "citizen_id": "demo-gandhi",
        "citizen_name": "Gandhi Maidan Area",
        "emergency_type": "medical",
        "latitude": 27.7241,
        "longitude": 85.3126,
        "accuracy_m": 18.0,
        "people_count": 3,
        "notes": "Three residents need assisted transport; one has limited mobility.",
        "risk_score": 52,
        "risk_level": "moderate",
        "precipitation_next_6h_mm": 19.4,
        "river_discharge_m3s": 119.7,
        "status": "resolved",
        "responder_id": "demo-ramesh",
        "responder_name": "Ramesh K.",
        "minutes_ago": 68,
    },
]


def seed_demo_emergencies(db: Session) -> None:
    existing_ids = set(db.scalars(select(Emergency.id).where(Emergency.is_demo.is_(True))).all())
    now = datetime.now(timezone.utc)
    changed = False
    for item in DEMO_INCIDENTS:
        if item["id"] in existing_ids:
            continue
        minutes_ago = int(item["minutes_ago"])
        data = {key: value for key, value in item.items() if key != "minutes_ago"}
        created_at = now - timedelta(minutes=minutes_ago)
        db.add(Emergency(**data, created_at=created_at, updated_at=created_at, is_demo=True))
        changed = True
    if changed:
        db.commit()


@router.post("", response_model=EmergencyRecord, status_code=201)
def create_emergency(payload: EmergencyCreate, db: Session = Depends(get_db)) -> EmergencyRecord:
    record = Emergency(
        **payload.model_dump(mode="json"),
        id=f"SOS-{uuid4().hex[:8].upper()}",
        status=EmergencyStatus.submitted.value,
        created_at=datetime.now(timezone.utc),
        is_demo=False,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return EmergencyRecord.model_validate(record)


@router.get("", response_model=list[EmergencyRecord])
def list_emergencies(db: Session = Depends(get_db)) -> list[EmergencyRecord]:
    records = db.scalars(select(Emergency).order_by(Emergency.created_at.desc())).all()
    return [EmergencyRecord.model_validate(record) for record in records]


@router.patch("/{emergency_id}", response_model=EmergencyRecord)
def update_emergency(emergency_id: str, payload: EmergencyUpdate, db: Session = Depends(get_db)) -> EmergencyRecord:
    record = db.get(Emergency, emergency_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Emergency request not found")

    record.status = payload.status.value
    if payload.responder_id is not None:
        record.responder_id = payload.responder_id
    if payload.responder_name is not None:
        record.responder_name = payload.responder_name
    record.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(record)
    return EmergencyRecord.model_validate(record)
