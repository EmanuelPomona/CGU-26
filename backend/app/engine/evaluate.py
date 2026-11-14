"""The evaluation model (docs/API.md 'Evaluation model (normative)'), ported from the reference evalPlan.

Pure: every function takes its inputs and returns values. No globals, no I/O, no clock reads.
Full precision here; rounding happens only in `public()` at the API boundary.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from app.engine import constants as K
from app.engine.geo import exposure, hav, phi, places_near, traffic_mult


@dataclass(frozen=True)
class Plan:
    truck_id: str | None
    route_id: str
    appt_shift_min: int = 0


@dataclass(frozen=True)
class Cond:
    """One active disruption, with its effective probability of being true."""
    id: str
    kind: str
    label: str
    p: float
    unverified: bool
    lat: float | None = None
    lng: float | None = None
    radius_km: float | None = None
    factor: float | None = None
    shipment_id: str | None = None
    delay_min: int | None = None
    truck_ids: tuple = ()
    warehouse_id: str | None = None
    capacity_cut: float | None = None


@dataclass(frozen=True)
class Conditions:
    items: tuple = ()


def conditions_from(disruptions) -> Conditions:
    """Active disruptions only: dismissed ones are ignored; confirmed ones count as certain."""
    out = []
    for d in disruptions:
        if d["verification"] == "dismissed":
            continue
        confirmed = d["verification"] == "confirmed"
        a = d.get("area") or {}
        out.append(Cond(
            id=d["id"], kind=d["kind"], label=d["label"],
            p=1.0 if confirmed else float(d["confidence"]), unverified=not confirmed,
            lat=a.get("lat"), lng=a.get("lng"), radius_km=a.get("radius_km"),
            factor=d.get("slowdown_factor"), shipment_id=d.get("shipment_id"), delay_min=d.get("delay_min"),
            truck_ids=tuple(d.get("truck_ids") or ()), warehouse_id=d.get("warehouse_id"),
            capacity_cut=d.get("capacity_cut"),
        ))
    return Conditions(tuple(out))


def original_plan(shipment: dict, world) -> Plan:
    return Plan(shipment["truck_id"], world.original_route_id(shipment), 0)


def status_of(p_on_time: float, slack: float) -> str:
    if p_on_time < K.AT_RISK_PROBABILITY:
        return "at_risk"
    if p_on_time < K.TIGHT_PROBABILITY or slack < K.TIGHT_SLACK_MIN:
        return "tight"
    return "on_time"


def fmt_hm(minutes: float) -> str:
    m = round(abs(minutes))
    return f"{m // 60}h {m % 60:02d}m"


@dataclass(frozen=True)
class Community:
    score: float
    local_miles: float
    near_local: int
    near_highway: int
    night: bool
    detail: str


def community(route, depart_min: float, places) -> Community:
    t = depart_min % 1440
    night = t >= 1200 or t < 360
    nm = K.NIGHT_MULTIPLIER if night else 1.0
    local_mi = route.local_miles
    a = min(K.LOCAL_PENALTY_CAP, local_mi * K.LOCAL_MILE_PENALTY * nm)
    b, nl, nh = 0.0, 0, 0
    for p, _d, hw in places_near(route, places, K.SENSITIVE_RADIUS_M):
        if hw:
            b += K.W_HWY.get(p["kind"], 1.0)
            nh += 1
        else:
            b += K.W_LOCAL.get(p["kind"], 3.0) * nm
            nl += 1
    b = min(K.PLACES_PENALTY_CAP, b)
    score = max(0.0, min(100.0, 100 - a - b))
    detail = (f"{local_mi:.1f} mi on local streets (-{a:.0f}); {nl} sensitive place(s) within 250 m on local "
              f"streets, {nh} beside highways (-{b:.0f})" + ("; night-time x1.5" if night else ""))
    return Community(score, local_mi, nl, nh, night, detail)


@dataclass(frozen=True)
class Evaluation:
    shipment_id: str
    plan: Plan
    truck_id: str | None
    route_id: str
    unavailable: bool
    ready_min: float
    pickup_min: float
    wait_min: float
    depart_min: float
    drive_min: float
    blocked_p: float
    eta_min: float
    sigma: float
    appt_start_min: int
    appt_end_min: int
    slack: float
    late: float
    on_time_probability: float
    status: str
    miles: float
    loaded_miles: float
    co2_kg: float
    cost_usd: float
    community: Community
    driver_hours: float
    driver_hours_over: float
    idle_min: float
    flags: tuple
    needs_review: bool
    hit_disruption_ids: tuple
    unverified_labels: tuple = field(default=())

    def public(self) -> dict:
        return {
            "status": self.status,
            "truck_id": self.truck_id,
            "route_id": self.route_id,
            "appt_shift_min": int(self.plan.appt_shift_min),
            "eta_min": round_half_up(self.eta_min),
            "eta_sigma_min": round(self.sigma, 1),
            "appt_start_min": int(self.appt_start_min),
            "appt_end_min": int(self.appt_end_min),
            "slack_min": round_half_up(self.slack),
            "late_min": round_half_up(self.late),
            "on_time_probability": round(self.on_time_probability, 2),
            "miles": round(self.miles, 1),
            "cost_usd": round(self.cost_usd, 1),
            "co2_kg": round(self.co2_kg, 1),
            "community_score": float(round_half_up(self.community.score)),
            "community_detail": self.community.detail,
            "local_street_miles": round(self.community.local_miles, 1),
            "sensitive_places_near": self.community.near_local,
            "driver_hours": round(self.driver_hours, 1),
            "driver_hours_over": round(max(0.0, self.driver_hours_over), 1),
            "idle_min": round_half_up(self.idle_min),
            "flags": list(self.flags),
            "needs_review": self.needs_review,
            "hit_disruption_ids": list(self.hit_disruption_ids),
        }


def round_half_up(x: float) -> int:
    return math.floor(x + 0.5)


def evaluate(shipment: dict, plan: Plan, conditions: Conditions, world, clock_min: float) -> Evaluation:
    sid = shipment["id"]
    wh = world.warehouses[shipment["warehouse_id"]]
    term = world.terminals[shipment["terminal_id"]]
    route = world.routes[plan.route_id]
    flags: list[str] = []
    hits: list[str] = []
    unverified: list[str] = []

    def touch(c: Cond):
        if c.id not in hits:
            hits.append(c.id)
        if c.unverified and c.label not in unverified:
            unverified.append(c.label)

    # 1. truck
    trucks_out = set()
    for c in conditions.items:
        if c.kind == "truck_out":
            trucks_out.update(c.truck_ids)
            if plan.truck_id in c.truck_ids:
                touch(c)
    unavailable = plan.truck_id is None or plan.truck_id in trucks_out
    truck = None if unavailable else world.trucks[plan.truck_id]

    # 2. pickup
    if truck:
        dh_m = hav((truck["lat"], truck["lng"]), (term["lat"], term["lng"])) * K.CIRCUITY
    else:
        dh_m = 0.0
    dh_min = dh_m / (K.DEADHEAD_MPH * K.MI) * 60
    delay = 0
    for c in conditions.items:
        if c.kind == "pickup_delay" and c.shipment_id == sid:
            delay += c.delay_min or 0
            touch(c)
    ready = shipment["ready_min"] + delay
    at_term = clock_min + dh_min
    pickup = max(at_term, ready)
    wait = pickup - at_term
    depart = pickup + K.GATE_MIN

    # 3. drive time and area disruptions
    mult = traffic_mult(depart)
    drive = route.base_minutes * mult
    cong_mi = (0.25 if mult > 1.2 else 0.0) * route.distance_mi
    blocked_p = 0.0
    for c in conditions.items:
        if c.kind not in ("slowdown", "closure", "hazard"):
            continue
        ex = exposure(route, c.lat, c.lng, c.radius_km)
        if not ex.hit:
            continue
        touch(c)
        if c.kind == "slowdown":
            drive += ex.seconds / 60 * ((c.factor or 1.0) - 1)
            cong_mi += ex.meters / K.MI
        else:
            blocked_p = max(blocked_p, min(1.0, c.p))
        if (c.kind == "hazard" and hav((c.lat, c.lng), (wh["lat"], wh["lng"])) <= c.radius_km * 1000
                and "Destination inside affected area" not in flags):
            flags.append("Destination inside affected area")

    # 4. arrival
    block_min = blocked_p * K.BLOCK_PENALTY_MIN
    cut = 0.0
    for c in conditions.items:
        if c.kind == "dock_cut" and c.warehouse_id == shipment["warehouse_id"]:
            cut = max(cut, c.capacity_cut or 0.0)
            touch(c)
    dock_q = cut * K.DOCK_QUEUE_MIN_PER_CUT
    shift = plan.appt_shift_min or 0
    appt_s, appt_e = shipment["appt_start_min"] + shift, shipment["appt_end_min"] + shift
    loaded_mi = route.distance_mi
    dh_mi = dh_m / K.MI
    ret_mi = loaded_mi
    ret_min = route.base_minutes * K.RETURN_TIME_FACTOR

    eta = depart + drive + block_min + dock_q
    slack0 = appt_e - (eta - block_min)
    slack = appt_e - eta
    late = max(0.0, -slack)
    sigma = K.SIGMA_BASE_MIN + K.SIGMA_PER_DRIVE_MIN * drive
    if unavailable:
        late = K.NO_TRUCK_LATE_MIN
        slack = -late
        p_on = 0.05
        flags.append("No truck available")
        eta = appt_e + late
    else:
        p_on = (1 - blocked_p) * phi(slack0 / sigma) + blocked_p * phi((slack0 - K.BLOCK_PENALTY_MIN) / sigma)

    # 6. driver
    idle = wait + dock_q
    hours = 0.0 if unavailable else (dh_min + wait + K.GATE_MIN + drive + block_min + dock_q + K.UNLOAD_MIN + ret_min) / 60
    over = (hours - truck["hours_available"]) if truck else 0.0
    if over > 0:
        flags.append(f"Driver hours exceed limit by {fmt_hm(over * 60)}")
    if idle >= K.IDLE_BURDEN_MIN:
        flags.append(f"Driver idles {round_half_up(idle)} min")
    for label in unverified:
        flags.append(f"Unverified report: {label}. Needs review.")

    # 7. cost, CO2
    co2 = (dh_mi * K.CO2_EMPTY_KG_PER_MI + loaded_mi * K.CO2_LOADED_KG_PER_MI
           + cong_mi * K.CO2_LOADED_KG_PER_MI * K.CONGESTION_CO2_EXTRA
           + ret_mi * K.CO2_EMPTY_KG_PER_MI + idle * K.CO2_IDLE_KG_PER_MIN)
    cost = ((dh_mi + loaded_mi + ret_mi) * K.USD_PER_MILE + hours * K.DRIVER_USD_PER_HOUR
            + late * K.DETENTION_USD_PER_MIN + (K.RESCHEDULE_FEE_USD if shift else 0.0))

    # 8. community
    comm = community(route, depart, world.places)

    return Evaluation(
        shipment_id=sid, plan=plan, truck_id=None if unavailable else plan.truck_id, route_id=plan.route_id,
        unavailable=unavailable, ready_min=ready, pickup_min=pickup, wait_min=wait, depart_min=depart,
        drive_min=drive, blocked_p=blocked_p, eta_min=eta, sigma=sigma, appt_start_min=appt_s,
        appt_end_min=appt_e, slack=slack, late=late, on_time_probability=max(0.0, min(1.0, p_on)),
        status=status_of(p_on, slack), miles=dh_mi + loaded_mi + ret_mi, loaded_miles=loaded_mi,
        co2_kg=co2, cost_usd=cost, community=comm, driver_hours=hours, driver_hours_over=max(0.0, over),
        idle_min=idle, flags=tuple(flags), needs_review=bool(unverified), hit_disruption_ids=tuple(hits),
        unverified_labels=tuple(unverified),
    )


def summarize(evals) -> dict:
    """Indicators over a list of evaluations, rounded for the API."""
    n = len(evals) or 1
    return {
        "shipments_at_risk": sum(1 for e in evals if e.status == "at_risk"),
        "shipments_tight": sum(1 for e in evals if e.status == "tight"),
        "total_late_min": round_half_up(sum(e.late for e in evals)),
        "fleet_miles": round(sum(e.miles for e in evals), 1),
        "co2_kg": round(sum(e.co2_kg for e in evals), 1),
        "cost_usd": round(sum(e.cost_usd for e in evals), 1),
        "community_score_avg": round(sum(e.community.score for e in evals) / n, 1),
        "drivers_over_hours": sum(1 for e in evals if e.driver_hours_over > 0),
        "idle_min": round_half_up(sum(e.idle_min for e in evals)),
    }
