from fastapi import APIRouter

from app.engine.board import build_board
from app.errors import validation
from app.models import Settings
from app.state import store

router = APIRouter()


@router.get("/board")
def get_board() -> dict:
    with store.lock:
        return build_board(store)


@router.put("/settings")
def put_settings(body: Settings) -> dict:
    w = body.weights.model_dump()
    if not any(w.values()):
        raise validation("At least one weight must be above zero.", "weights")
    with store.lock:
        store.settings = {"clock_min": body.clock_min, "weights": w}
        return build_board(store)


@router.post("/reset")
def reset() -> dict:
    with store.lock:
        store.reset()
        return build_board(store)
