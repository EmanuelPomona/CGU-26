from fastapi import APIRouter

from app.engine.method import method_payload
from app.state import store

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/network")
def network() -> dict:
    return store.network


@router.get("/presets")
def presets() -> dict:
    return {"presets": store.presets}


@router.get("/method")
def method() -> dict:
    return method_payload()
