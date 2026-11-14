"""Response options for one shipment, ported from the reference buildOptions with docs/API.md rule 9."""
from __future__ import annotations

from dataclasses import replace

from app.engine import constants as K
from app.engine.evaluate import evaluate, fmt_hm, round_half_up
from app.engine.scoring import overall, pick_suggestion, score_parts

UNVERIFIED_NOTE = "Based on an unverified report: confirm before acting."


def fmt_clock(m: float) -> str:
    m = round_half_up(m)
    d, m = divmod(m, 1440)
    h, mm = divmod(m, 60)
    return f"{h % 12 or 12}:{mm:02d} {'AM' if h < 12 else 'PM'}" + (" +1d" if d > 0 else "")


def route_text(rt) -> str:
    return f"via {rt.via} ({rt.label})" if rt.via else rt.label


def signed(x: float, digits: int, unit: str) -> str:
    v = round(x, digits)
    sign = "+" if v > 0 else "-" if v < 0 else "±"
    return f"{sign}{abs(v):.{digits}f}{unit}"


def _delta(ev, keep) -> dict:
    return {
        "late_min": round_half_up(ev.late) - round_half_up(keep.late),
        "miles": round(ev.miles - keep.miles, 1) + 0.0,
        "co2_kg": round(ev.co2_kg - keep.co2_kg, 1) + 0.0,
        "cost_usd": round(ev.cost_usd - keep.cost_usd, 1) + 0.0,
        "community_score": float(round_half_up(ev.community.score) - round_half_up(keep.community.score)),
        "on_time_probability": round(ev.on_time_probability - keep.on_time_probability, 2) + 0.0,
    }


def build_options(shipment: dict, ctx) -> dict:
    """ctx: world, conditions, clock, weights, plan_of(shipment) -> Plan in force, committed_trucks (set)."""
    w, conds, clock = ctx.world, ctx.conditions, ctx.clock
    sid = shipment["id"]
    base = ctx.plan_of(shipment)
    base_route = w.routes[base.route_id]
    wh = w.warehouses[shipment["warehouse_id"]]
    area_ids = {c.id for c in conds.items if c.kind in ("slowdown", "closure", "hazard")}

    def ev(plan, s=shipment):
        return evaluate(s, plan, conds, w, clock)

    stay = ev(base)
    opts: list[dict] = []

    def mk(oid, kind, title, desc, plan, e=None, **extra):
        e = e or ev(plan)
        o = {"id": oid, "kind": kind, "title": title, "description": desc, "plan": plan, "ev": e,
             "feasible": e.driver_hours_over <= 0 and not e.unavailable, "infeasible_reason": None,
             "collateral": [], "notes": []}
        o.update(extra)
        opts.append(o)
        return o

    mk("keep", "keep", "Keep the plan", f"Stay on {route_text(base_route)} and accept the consequences.", base, stay)

    # reroute: best two alternatives by on-time probability, then CO2
    alts = []
    for rt in w.routes_by_pair[w.pair_of(shipment)]:
        if rt.id == base.route_id:
            continue
        p = replace(base, route_id=rt.id)
        alts.append((rt, p, ev(p)))
    alts.sort(key=lambda x: (-x[2].on_time_probability, x[2].co2_kg, x[0].id))
    for rt, p, e in alts[:2]:
        o = mk(f"reroute:{rt.id}", "reroute", f"Reroute {route_text(rt)}",
               f"{signed(rt.distance_mi - base_route.distance_mi, 1, ' mi')} and "
               f"{signed(rt.base_minutes - base_route.base_minutes, 0, ' min')} base drive time versus the current route.",
               p, e)
        if any(h in area_ids for h in e.hit_disruption_ids):
            o["notes"].append("Still crosses an affected area.")

    # spare truck: not out, not assigned in the seed plan, not committed by another decision
    out = {t for c in conds.items if c.kind == "truck_out" for t in c.truck_ids}
    seed_assigned = {s["truck_id"] for s in w.shipments}
    spares = []
    for tid in w.trucks:
        if tid in out or tid in seed_assigned or tid == base.truck_id or tid in ctx.committed_trucks(sid):
            continue
        p = replace(base, truck_id=tid)
        spares.append((tid, p, ev(p)))
    spares.sort(key=lambda x: (-x[2].on_time_probability, x[2].cost_usd, x[0]))
    if spares:
        tid, p, e = spares[0]
        if stay.unavailable or stay.driver_hours_over > 0 or e.on_time_probability > stay.on_time_probability + 0.05:
            t = w.trucks[tid]
            mk(f"spare:{tid}", "spare_truck", f"Assign spare truck {tid}",
               f"{t['driver_label']}, {fmt_hm(t['hours_available'] * 60)} left on shift. No other delivery is affected.", p, e)

    # swap trucks with another shipment
    if base.truck_id and base.truck_id not in out:
        best = None
        for other in w.shipments:
            if other["id"] == sid or ctx.has_decision(other["id"]):
                continue  # never override another shipment's recorded decision
            op = ctx.plan_of(other)
            tp = op.truck_id
            if not tp or tp in out:
                continue
            mine = ev(replace(base, truck_id=tp))
            pb = ev(op, other)
            pa_plan = replace(op, truck_id=base.truck_id)
            pa = ev(pa_plan, other)
            harm = max(0.0, pa.late - pb.late) + (60 if pa.status == "at_risk" and pb.status != "at_risk" else 0)
            val = mine.on_time_probability * 100 - harm * 0.5 - (200 if mine.driver_hours_over > 0 else 0)
            if best is None or val > best[0]:
                best = (val, other, tp, mine, pb, pa, pa_plan)
        fixes_hours = best and stay.driver_hours_over > 0 and best[3].driver_hours_over <= 0
        if best and (fixes_hours or best[3].on_time_probability > stay.on_time_probability + 0.05):
            _, other, tp, mine, pb, pa, pa_plan = best
            o = mk(f"swap:{other['id']}", "swap_truck", f"Swap trucks with {other['id']}",
                   f"Use {tp} ({w.trucks[tp]['driver_label']}); {other['id']} gets {base.truck_id}.",
                   replace(base, truck_id=tp), mine,
                   collateral=[{"shipment_id": other["id"], "before": pb, "after": pa, "plan": pa_plan}])
            if pa.driver_hours_over > pb.driver_hours_over + 1e-9:
                o["feasible"] = False
                o["infeasible_reason"] = f"The swap would push {other['id']}'s driver over the shift hours limit."

    # reschedule: first shift reaching 0.85 on-time probability
    free = wh["capacity"] - wh["booked"]
    if stay.late > 0 or stay.on_time_probability < K.TIGHT_PROBABILITY:
        found = None
        for sh in range(15, 181, 15):
            if ev(replace(base, appt_shift_min=sh)).on_time_probability >= K.TIGHT_PROBABILITY:
                found = sh
                break
        sh = found or 180
        p = replace(base, appt_shift_min=sh)
        s0, e0 = shipment["appt_start_min"] + sh, shipment["appt_end_min"] + sh
        o = mk(f"reschedule:{sh}", "reschedule", f"Ask {wh['name']} for a later slot",
               f"Move the appointment +{sh} min ({fmt_clock(s0)} to {fmt_clock(e0)})." if found
               else "No slot within 3 hours makes the delivery likely on time.", p)
        if not found:
            o["feasible"], o["infeasible_reason"] = False, "No later slot within 3 hours reaches 85% on-time probability."
        if free <= 1:
            o["feasible"] = False
            o["infeasible_reason"] = f"{wh['name']} has {free} free slot(s) today ({wh['booked']} of {wh['capacity']} booked)."

    keep_ev = stay
    for o in opts:
        e = o["ev"]
        if not o["feasible"] and o["infeasible_reason"] is None:
            o["infeasible_reason"] = ("No truck is available." if e.unavailable else
                                      f"Driver would exceed the shift limit by {fmt_hm(e.driver_hours_over * 60)}.")
        if e.needs_review:
            o["notes"].append(UNVERIFIED_NOTE)
        o["burdens"] = burdens(o, e, w, wh)
        o["delta"] = _delta(e, keep_ev)

    costs = [o["ev"].cost_usd for o in opts]
    co2s = [o["ev"].co2_kg for o in opts]
    for o in opts:
        o["parts"] = score_parts(o["ev"], costs, co2s)
        o["score"] = overall(o["parts"], ctx.weights)
    suggested, rationale = pick_suggestion(opts, ctx.weights, opts)
    rest = sorted(opts[1:], key=lambda o: -(o["score"] - (0 if o["feasible"] else 1000)))
    ordered = [opts[0]] + rest
    for o in ordered:
        o["suggested"] = o["id"] == suggested
    return {"shipment_id": sid, "options": ordered, "suggested_option_id": suggested, "rationale": rationale}


def burdens(o, e, w, wh) -> list[dict]:
    out = []
    c = e.community
    if c.near_local > 0 or c.local_miles > 3:
        out.append({"stakeholder": "residents",
                    "text": f"Residents and schools: {c.near_local} sensitive place(s) within 250 m on local streets; "
                            f"{c.local_miles:.1f} mi of local streets."})
    if e.driver_hours_over > 0:
        out.append({"stakeholder": "driver",
                    "text": f"Driver: {w.trucks[o['plan'].truck_id]['driver_label']} would exceed the shift limit by "
                            f"{fmt_hm(e.driver_hours_over * 60)}."})
    elif e.idle_min >= K.IDLE_BURDEN_MIN:
        out.append({"stakeholder": "driver", "text": f"Driver: {round_half_up(e.idle_min)} min of idle waiting."})
    if o["kind"] == "reschedule":
        out.append({"stakeholder": "warehouse",
                    "text": f"Warehouse: {wh['name']} is asked to move a dock slot ({wh['booked']} booked of "
                            f"{wh['capacity']} capacity today); we pay a ${K.RESCHEDULE_FEE_USD:.0f} change fee."})
    for col in o["collateral"]:
        b, a = col["before"], col["after"]
        change = f" (now {a.status.replace('_', ' ')})" if a.status != b.status else ""
        out.append({"stakeholder": "other_customer",
                    "text": f"Other customer: {col['shipment_id']} slack {signed(b.slack, 0, ' min')} to "
                            f"{signed(a.slack, 0, ' min')}{change}."})
    if o["kind"] == "keep" and e.late > 0:
        out.append({"stakeholder": "company",
                    "text": f"Company: {round_half_up(e.late)} min late; possible detention charges."})
    return out


def public_option(o, w) -> dict:
    return {
        "id": o["id"], "kind": o["kind"], "title": o["title"], "description": o["description"],
        "feasible": o["feasible"], "infeasible_reason": o["infeasible_reason"], "suggested": o["suggested"],
        "evaluation": o["ev"].public(), "delta": o["delta"],
        "scores": {**{k: float(round_half_up(max(0.0, min(100.0, v)))) for k, v in o["parts"].items()},
                   "overall": float(round_half_up(max(0.0, min(100.0, o["score"])))) if o["feasible"] else 0.0},
        "burdens": o["burdens"],
        "collateral": [{"shipment_id": c["shipment_id"], "before": c["before"].public(), "after": c["after"].public()}
                       for c in o["collateral"]],
        "route": w.routes[o["plan"].route_id].public(),
        "notes": o["notes"],
    }
