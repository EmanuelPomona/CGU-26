"""Drafted supervisor update. Plain text; the dispatcher reviews and sends it, the tool never does."""
from __future__ import annotations

from app.engine.options import fmt_clock, route_text

CLOSING = "Drafted by the dispatch tool. Reviewed and sent by the dispatcher."


def _action(opt, w) -> str:
    p = opt["plan"]
    k = opt["kind"]
    if k == "keep":
        return "Keep the current plan; no change."
    if k == "reroute":
        return f"Reroute {route_text(w.routes[p.route_id])}."
    if k == "reschedule":
        return f"Move the receiving appointment {p.appt_shift_min} min later."
    if k == "spare_truck":
        return f"Assign spare truck {p.truck_id}."
    other = opt["collateral"][0]["shipment_id"]
    return f"Swap trucks with {other}: this load takes {p.truck_id}, {other} takes the other truck."


def status_word(s: str) -> str:
    return {"on_time": "on time", "tight": "tight", "at_risk": "at risk"}[s]


def supervisor_update(shipment, opt, before, disruptions, reason, w) -> str:
    e = opt["ev"]
    wh = w.warehouses[shipment["warehouse_id"]]
    active = [d for d in disruptions if d["verification"] != "dismissed"]
    unverified = [d["label"] for d in active if d["verification"] == "unverified"]
    lines = [
        f"Update on container {shipment['id']} ({shipment['cargo']}), {shipment['terminal_id']} to {wh['name']}.",
        "Conditions: " + ("; ".join(f"{d['label']} ({d['verification']})" for d in active) if active
                          else "no reported disruptions in effect.") + ".",
        f"Action taken: {_action(opt, w)}",
    ]
    if e.unavailable:
        lines.append(f"New estimated arrival: unknown, no truck available (window {fmt_clock(e.appt_start_min)} to "
                     f"{fmt_clock(e.appt_end_min)}).")
    else:
        lines.append(f"New estimated arrival: {fmt_clock(e.eta_min)}, window {fmt_clock(e.appt_start_min)} to "
                     f"{fmt_clock(e.appt_end_min)} ({status_word(e.status)}, "
                     f"{round(e.on_time_probability * 100)}% on-time probability).")
    if before.unavailable:
        lines.append("Before this decision: no truck available, at risk.")
    else:
        lines.append(f"Before this decision: estimated arrival {fmt_clock(before.eta_min)}, {status_word(before.status)}.")
    d = opt["delta"]
    lines.append(f"Versus keeping the plan: {d['miles']:+.1f} mi, {d['co2_kg']:+.1f} kg CO2 (estimated), "
                 f"${d['cost_usd']:+.0f} cost (estimated).")
    if reason:
        lines.append(f"Reason: {reason}")
    lines.append("Inputs: based on unverified report(s): " + "; ".join(unverified) + "." if unverified
                 else "Inputs: no unverified reports were used.")
    lines.append(CLOSING)
    return "\n".join(lines)
