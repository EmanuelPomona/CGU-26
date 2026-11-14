from fastapi import APIRouter

from app import feeds
from app.engine.board import plan_in_force
from app.state import store

router = APIRouter()


@router.get("/feeds/candidates")
def feed_candidates() -> dict:
    """Candidates from public feeds near active routes. Never applied; nothing is added to the board."""
    with store.lock:  # snapshot active routes, then fetch without holding the lock
        w = store.world
        active = {s["id"]: w.routes[plan_in_force(store, s).route_id] for s in w.shipments}
    sources, items = feeds.gather()
    return {"sources": sources, "candidates": feeds.to_candidates(items, active)}
