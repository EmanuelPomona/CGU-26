"""Route studio: OD session and obstacle-triggered three-way reroute."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.models import NoExplicitNull
from app.studio import service

router = APIRouter(tags=["studio"])


class LatLng(NoExplicitNull):
    lat: float = Field(ge=32.0, le=36.0)
    lng: float = Field(ge=-121.0, le=-114.0)


class StudioSessionCreate(NoExplicitNull):
    truck_id: str
    destination: LatLng


class StudioObstacleCreate(NoExplicitNull):
    type: str
    lat: float = Field(ge=32.0, le=36.0)
    lng: float = Field(ge=-121.0, le=-114.0)


@router.post("/studio/session")
def create_session(body: StudioSessionCreate):
    return service.create_session(body.truck_id, body.destination.lat, body.destination.lng)


@router.get("/studio/session/{sid}")
def get_session(sid: str):
    return service.get_session(sid)


@router.post("/studio/session/{sid}/obstacles")
def add_obstacle(sid: str, body: StudioObstacleCreate):
    return service.add_obstacle(sid, body.type, body.lat, body.lng)


@router.delete("/studio/session/{sid}/obstacles/{oid}")
def delete_obstacle(sid: str, oid: str):
    return service.remove_obstacle(sid, oid)
