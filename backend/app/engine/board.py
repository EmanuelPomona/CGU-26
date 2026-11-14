"""Assemble the Board payload from the store's state. Pure apart from reading the passed store."""
from __future__ import annotations

from app.engine import constants as K
from app.engine.evaluate import Conditions, conditions_from, evaluate, original_plan, round_half_up, summarize
from app.engine.geo import exposure


def attention_of(status: str, needs_review: bool) -> str:
    if status == "at_risk":
        return "act"
    if status == "tight" or needs_review:
        return "watch"
    return "none"


def affected_shipment_ids(d: dict, world) -> list[str]:
    """Shipments whose ORIGINAL plan this disruption touches, independent of its verification."""
    out = []
    for s in world.shipments:
        k = d["kind"]
        if k in ("slowdown", "closure", "hazard"):
            a = d["area"]
            hit = exposure(world.routes[world.original_route_id(s)], a["lat"], a["lng"], a["radius_km"]).hit
        elif k == "pickup_delay":
            hit = d["shipment_id"] == s["id"]
        elif k == "truck_out":
            hit = s["truck_id"] in d["truck_ids"]
        else:
            hit = d["warehouse_id"] == s["warehouse_id"]
        if hit:
            out.append(s["id"])
    return out


def plan_in_force(store, shipment):
    entry = store.plans.get(shipment["id"])
    return entry["plan"] if entry else original_plan(shipment, store.world)


def evaluate_all(store, conditions=None, decided=True):
    w = store.world
    conds = conditions_from(store.disruptions) if conditions is None else conditions
    clock = store.settings["clock_min"]
    return [evaluate(s, plan_in_force(store, s) if decided else original_plan(s, w), conds, w, clock)
            for s in w.shipments]


def checks(normal: dict, changed: dict, decided: dict, any_unverified: bool, n_unverified: int) -> list[dict]:
    added = decided["fleet_miles"] - normal["fleet_miles"]
    thr = K.ADDED_MILES_REVIEW_MI
    return [
        {"id": "added_miles_review", "label": "Added miles need review",
         "triggered": added > thr,
         "detail": (f"Flags when decided fleet miles exceed the normal day by more than {thr:.0f} mi. "
                    f"{thr:.0f} mi is an example threshold from the organizer workshop, not an operating standard. "
                    f"Observed: {added:+.1f} mi.")},
        {"id": "new_at_risk", "label": "New shipments at risk",
         "triggered": changed["shipments_at_risk"] > normal["shipments_at_risk"],
         "detail": (f"Flags when the changed plan has more at-risk shipments than the normal day. "
                    f"Observed: {normal['shipments_at_risk']} normal, {changed['shipments_at_risk']} changed.")},
        {"id": "driver_hours", "label": "Driver over hours",
         "triggered": decided["drivers_over_hours"] > 0,
         "detail": (f"Flags when any driver would exceed remaining shift hours under the decided plans. "
                    f"Observed: {decided['drivers_over_hours']} driver(s) over.")},
        {"id": "unverified_inputs", "label": "Unverified reports in use",
         "triggered": any_unverified,
         "detail": (f"Flags when any active disruption has not been confirmed or dismissed. "
                    f"Observed: {n_unverified} unverified.")},
    ]


def build_board(store) -> dict:
    w = store.world
    conds = conditions_from(store.disruptions)
    normal = evaluate_all(store, Conditions(), decided=False)
    changed = evaluate_all(store, conds, decided=False)
    current = evaluate_all(store, conds, decided=True)
    rows = []
    for s, n, c, cur in zip(w.shipments, normal, changed, current):
        entry = store.plans.get(s["id"])
        rows.append({
            "id": s["id"], "cargo": s["cargo"], "priority": s["priority"],
            "terminal_id": s["terminal_id"], "warehouse_id": s["warehouse_id"],
            "ready_min": round_half_up(cur.ready_min),
            "normal": n.public(), "changed": c.public(), "current": cur.public(),
            "route": w.routes[cur.route_id].public(),
            "normal_route_id": w.original_route_id(s),
            "attention": attention_of(cur.status, cur.needs_review),
            "decision_id": entry["decision_id"] if entry else None,
        })
    pending = [d["id"] for d in store.disruptions if d["verification"] == "unverified"]
    ind_n, ind_c, ind_d = summarize(normal), summarize(changed), summarize(current)
    return {
        "settings": {"clock_min": store.settings["clock_min"], "weights": dict(store.settings["weights"])},
        "disruptions": [dict(d) for d in store.disruptions],
        "shipments": rows,
        "indicators": {"normal": ind_n, "changed": ind_c, "decided": ind_d,
                       "checks": checks(ind_n, ind_c, ind_d, bool(pending), len(pending))},
        "decisions": [dict(d) for d in store.decisions],
        "pending_verification_ids": pending,
    }
