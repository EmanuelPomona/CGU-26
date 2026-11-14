from fastapi import APIRouter

router = APIRouter()


@router.get("/feeds/candidates")
def feed_candidates() -> dict:
    """Nice-to-have (TASK-005). Until enabled, every source reports itself unavailable."""
    return {
        "sources": [
            {"name": "CHP incidents", "ok": False, "error": "not enabled"},
            {"name": "NWS alerts", "ok": False, "error": "not enabled"},
        ],
        "candidates": [],
    }
