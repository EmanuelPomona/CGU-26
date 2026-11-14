"""Request bodies, mirroring docs/openapi.yaml. Responses are plain dicts validated by contract tests."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Weights(BaseModel):
    reliability: int = Field(ge=0, le=100)
    cost: int = Field(ge=0, le=100)
    emissions: int = Field(ge=0, le=100)
    community: int = Field(ge=0, le=100)
    driver: int = Field(ge=0, le=100)


class Settings(BaseModel):
    clock_min: int = Field(ge=360, le=1080)
    weights: Weights


class Area(BaseModel):
    lat: float = Field(ge=32.0, le=36.0)
    lng: float = Field(ge=-121.0, le=-114.0)
    radius_km: float = Field(ge=0.5, le=15)


DisruptionKind = Literal["slowdown", "closure", "hazard", "pickup_delay", "truck_out", "dock_cut"]


class DisruptionCreate(BaseModel):
    kind: DisruptionKind
    label: str | None = Field(default=None, max_length=80)
    source: Literal["simulated", "dispatcher", "public_feed"] = "dispatcher"
    confidence: float = Field(default=0.7, ge=0.1, le=1)
    area: Area | None = None
    slowdown_factor: float | None = Field(default=None, ge=1.2, le=4)
    shipment_id: str | None = None
    delay_min: int | None = Field(default=None, ge=15, le=480)
    truck_ids: list[str] | None = Field(default=None, max_length=9)
    warehouse_id: str | None = None
    capacity_cut: float | None = Field(default=None, ge=0.1, le=1)


class DisruptionUpdate(BaseModel):
    verification: Literal["unverified", "confirmed", "dismissed"]
    note: str | None = Field(default=None, max_length=200)


class DecisionCreate(BaseModel):
    shipment_id: str
    option_id: str
    reason: str | None = Field(default=None, min_length=3, max_length=300)
