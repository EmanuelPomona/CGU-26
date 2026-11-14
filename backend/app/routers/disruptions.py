"""Disruption lifecycle: create (always unverified), verify, delete."""
from __future__ import annotations

from fastapi import APIRouter

from app.engine.board import affected_shipment_ids, build_board
from app.errors import not_found, validation
from app.models import DisruptionCreate, DisruptionUpdate
from app.state import store

router = APIRouter()

KIND_WORD = {"slowdown": "Slowdown", "closure": "Road closure", "hazard": "Hazard area"}


def _require(body: DisruptionCreate) -> None:
    k = body.kind
    if k in ("slowdown", "closure", "hazard") and body.area is None:
        raise validation(f"A {k} needs an area.", "area")
    if k == "slowdown" and body.slowdown_factor is None:
        raise validation("A slowdown needs slowdown_factor.", "slowdown_factor")
    if k == "pickup_delay":
        if body.shipment_id is None:
            raise validation("A pickup_delay needs shipment_id.", "shipment_id")
        if body.delay_min is None:
            raise validation("A pickup_delay needs delay_min.", "delay_min")
        if body.shipment_id not in store.world.shipments_by_id:
            raise validation(f"Unknown shipment_id {body.shipment_id!r}.", "shipment_id")
    if k == "truck_out":
        if not body.truck_ids:
            raise validation("A truck_out needs at least one truck id.", "truck_ids")
        unknown = [t for t in body.truck_ids if t not in store.world.trucks]
        if unknown:
            raise validation(f"Unknown truck id(s): {', '.join(map(repr, unknown))}.", "truck_ids")
    if k == "dock_cut":
        if body.warehouse_id is None:
            raise validation("A dock_cut needs warehouse_id.", "warehouse_id")
        if body.capacity_cut is None:
            raise validation("A dock_cut needs capacity_cut.", "capacity_cut")
        if body.warehouse_id not in store.world.warehouses:
            raise validation(f"Unknown warehouse_id {body.warehouse_id!r}.", "warehouse_id")


def _label(body: DisruptionCreate) -> str:
    k = body.kind
    if k in KIND_WORD:
        a = body.area
        extra = f" x{body.slowdown_factor:g}" if k == "slowdown" else ""
        return f"{KIND_WORD[k]}{extra} at {a.lat:.3f}, {a.lng:.3f} ({a.radius_km:g} km)"
    if k == "pickup_delay":
        return f"Pickup delay +{body.delay_min} min on {body.shipment_id}"
    if k == "truck_out":
        return f"Truck(s) {', '.join(body.truck_ids)} out of service"
    name = store.world.warehouses[body.warehouse_id]["name"]
    return f"{name} docks cut by {round(body.capacity_cut * 100)}%"


def _record(body: DisruptionCreate, ident: str) -> dict:
    k = body.kind
    area_kind = k in ("slowdown", "closure", "hazard")
    d = {
        "id": ident, "kind": k, "label": body.label or _label(body), "source": body.source,
        "verification": "unverified", "confidence": body.confidence,
        "area": body.area.model_dump() if area_kind else None,
        "slowdown_factor": body.slowdown_factor if k == "slowdown" else None,
        "shipment_id": body.shipment_id if k == "pickup_delay" else None,
        "delay_min": body.delay_min if k == "pickup_delay" else None,
        "truck_ids": list(dict.fromkeys(body.truck_ids)) if k == "truck_out" else [],
        "warehouse_id": body.warehouse_id if k == "dock_cut" else None,
        "capacity_cut": body.capacity_cut if k == "dock_cut" else None,
        "affected_shipment_ids": [],
        "note": None,
    }
    d["affected_shipment_ids"] = affected_shipment_ids(d, store.world)
    return d


def _find(ident: str) -> dict:
    for d in store.disruptions:
        if d["id"] == ident:
            return d
    raise not_found("disruption", ident)


@router.get("/disruptions")
def list_disruptions() -> dict:
    with store.lock:
        return {"disruptions": [dict(d) for d in store.disruptions]}


@router.post("/disruptions", status_code=201)
def create_disruption(body: DisruptionCreate) -> dict:
    with store.lock:
        _require(body)
        ident = f"D-{store.next_disruption}"
        store.disruptions.append(_record(body, ident))
        store.next_disruption += 1
        return build_board(store)


@router.patch("/disruptions/{disruption_id}")
def update_disruption(disruption_id: str, body: DisruptionUpdate) -> dict:
    with store.lock:
        d = _find(disruption_id)
        d["verification"] = body.verification
        if body.note is not None:
            d["note"] = body.note
        return build_board(store)


@router.delete("/disruptions/{disruption_id}")
def delete_disruption(disruption_id: str) -> dict:
    with store.lock:
        d = _find(disruption_id)
        store.disruptions.remove(d)
        return build_board(store)
