from fastapi import APIRouter

from app.engine.context import Ctx
from app.engine.options import build_options, public_option
from app.errors import not_found
from app.state import store

router = APIRouter()


def options_payload(shipment_id: str) -> tuple[dict, dict]:
    s = store.world.shipments_by_id.get(shipment_id)
    if s is None:
        raise not_found("shipment", shipment_id)
    ctx = Ctx(store)
    res = build_options(s, ctx)
    return res, {
        "shipment_id": shipment_id, "weights": ctx.weights,
        "options": [public_option(o, store.world) for o in res["options"]],
        "suggested_option_id": res["suggested_option_id"], "rationale": res["rationale"],
    }


@router.get("/shipments/{shipment_id}/options")
def get_options(shipment_id: str) -> dict:
    with store.lock:
        return options_payload(shipment_id)[1]
