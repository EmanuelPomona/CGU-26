"""Apply the dispatcher's chosen option, draft the supervisor update, undo."""
from __future__ import annotations

from fastapi import APIRouter

from app.engine.board import build_board, plan_in_force
from app.engine.context import Ctx
from app.engine.evaluate import evaluate
from app.engine.messages import supervisor_update
from app.engine.options import build_options
from app.errors import ApiError, not_found, validation
from app.models import DecisionCreate
from app.state import store

router = APIRouter()


def _remove_decision(dec_id: str) -> None:
    """Drop a decision from the log and restore every plan it set (both sides of a swap)."""
    store.decisions = [d for d in store.decisions if d["id"] != dec_id]
    for sid in [sid for sid, e in store.plans.items() if e["decision_id"] == dec_id]:
        del store.plans[sid]


@router.get("/decisions")
def list_decisions() -> dict:
    with store.lock:
        return {"decisions": [dict(d) for d in store.decisions]}


@router.post("/decisions", status_code=201)
def create_decision(body: DecisionCreate) -> dict:
    with store.lock:
        w = store.world
        s = w.shipments_by_id.get(body.shipment_id)
        if s is None:
            raise not_found("shipment", body.shipment_id)
        ctx = Ctx(store)
        res = build_options(s, ctx)
        opt = next((o for o in res["options"] if o["id"] == body.option_id), None)
        if opt is None:
            raise ApiError(409, "option_infeasible",
                           f"Option {body.option_id!r} is not offered for {s['id']} under current conditions.")
        if not opt["feasible"]:
            raise ApiError(409, "option_infeasible", f"Option {body.option_id!r} is not feasible: {opt['infeasible_reason']}")
        was_suggested = opt["id"] == res["suggested_option_id"]
        reason = (body.reason or "").strip() or None
        if not was_suggested and not reason:
            raise validation("A reason is required when choosing an option other than the suggested one.", "reason")

        for sid in [s["id"]] + [c["shipment_id"] for c in opt["collateral"]]:
            entry = store.plans.get(sid)
            if not entry:
                continue
            old = next(d for d in store.decisions if d["id"] == entry["decision_id"])
            if old["also_affects"] or sid != s["id"]:
                raise ApiError(409, "option_infeasible",
                               f"{sid} is part of decision {old['id']} ({old['option_title']}). "
                               f"Undo {old['id']} first.")

        before = evaluate(s, plan_in_force(store, s), ctx.conditions, w, ctx.clock)
        dec_id = f"DEC-{store.next_decision}"
        seq = store.next_decision
        store.next_decision += 1
        # one decision in force per shipment: a plain earlier decision for this shipment is replaced
        if s["id"] in store.plans:
            _remove_decision(store.plans[s["id"]]["decision_id"])
        store.plans[s["id"]] = {"plan": opt["plan"], "decision_id": dec_id}
        for c in opt["collateral"]:
            store.plans[c["shipment_id"]] = {"plan": c["plan"], "decision_id": dec_id}
        decision = {
            "id": dec_id, "seq": seq, "shipment_id": s["id"], "option_id": opt["id"], "option_kind": opt["kind"],
            "option_title": opt["title"], "was_suggested": was_suggested, "reason": reason,
            "decided_at_clock_min": int(ctx.clock), "before": before.public(), "after": opt["ev"].public(),
            "also_affects": [c["shipment_id"] for c in opt["collateral"]],
            "supervisor_update": supervisor_update(s, opt, before, store.disruptions, reason, w),
        }
        store.decisions.append(decision)
        return {"decision": dict(decision), "board": build_board(store)}


@router.delete("/decisions/{decision_id}")
def delete_decision(decision_id: str) -> dict:
    with store.lock:
        if not any(d["id"] == decision_id for d in store.decisions):
            raise not_found("decision", decision_id)
        _remove_decision(decision_id)
        return build_board(store)
