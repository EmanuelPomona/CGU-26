"""Evaluation model (docs/API.md, 'Evaluation model (normative)'). Written before app/engine/evaluate.py."""
import pytest

from app.engine import evaluate as E
from app.engine.geo import hav, traffic_mult
from app.state import World, store

# ---- a tiny synthetic world: one straight 10-minute highway route, truck parked at the terminal ----
A, B = (34.0, -118.0), (34.0, -117.9)
D = hav(A, B)


def make_world(hours=10.0, ready=480, appt=(600, 660)):
    network = {
        "terminals": [{"id": "X", "name": "X", "lat": A[0], "lng": A[1]}],
        "warehouses": [{"id": "Y", "name": "Y", "lat": B[0], "lng": B[1], "docks": 4, "capacity": 10, "booked": 5}],
        "trucks": [{"id": "T1", "driver_label": "Driver 01", "lat": A[0], "lng": A[1], "hours_available": hours, "spare": False},
                   {"id": "T2", "driver_label": "Driver 02", "lat": A[0], "lng": A[1], "hours_available": hours, "spare": True}],
        "sensitive_places": [],
    }
    ship = {"id": "S1", "terminal_id": "X", "warehouse_id": "Y", "truck_id": "T1", "ready_min": ready,
            "appt_start_min": appt[0], "appt_end_min": appt[1], "cargo": "Test", "priority": "normal"}
    route = {"id": "X-Y-0", "pair": "X>Y", "label": "I-1", "via": None, "distance_mi": D / 1609.344,
             "base_minutes": 10.0, "estimated": False, "geometry": [list(A), list(B)],
             "steps": [{"geometry": [list(A), list(B)], "distance_m": D, "duration_s": 600.0, "highway": True}]}
    return World(network, [ship], [route]), ship


def dis(kind, verification="unverified", confidence=0.8, **kw):
    base = {"id": kw.pop("id", "D-1"), "kind": kind, "label": kw.pop("label", kind), "source": "simulated",
            "verification": verification, "confidence": confidence, "area": None, "slowdown_factor": None,
            "shipment_id": None, "delay_min": None, "truck_ids": [], "warehouse_id": None, "capacity_cut": None,
            "affected_shipment_ids": [], "note": None}
    base.update(kw)
    return base


PLAN = E.Plan("T1", "X-Y-0", 0)
NONE = E.conditions_from([])


def ev(world, ship, conds=NONE, plan=PLAN, clock=480):
    return E.evaluate(ship, plan, conds, world, clock)


# ---- baseline arithmetic ----

def test_baseline_eta_is_depart_plus_traffic_scaled_drive():
    w, s = make_world()
    r = ev(w, s)
    depart = 480 + 40  # truck at terminal, container ready at 480
    drive = 10.0 * traffic_mult(depart)
    assert r.eta_min == pytest.approx(depart + drive)
    assert r.sigma == pytest.approx(6 + 0.12 * drive)
    assert r.slack == pytest.approx(660 - (depart + drive))
    assert r.late == 0 and r.status == "on_time" and not r.needs_review and r.flags == ()


def test_traffic_multiplier_at_0730_vs_1200_changes_drive_time():
    w, s = make_world(ready=0, appt=(1000, 1100))
    # depart = clock + 40: 410 -> 450 (7:30) and 680 -> 720 (12:00)
    assert ev(w, s, clock=410).drive_min == pytest.approx(10 * 1.40)
    assert ev(w, s, clock=680).drive_min == pytest.approx(10 * 1.05, abs=1e-3)


def test_evaluate_is_deterministic_and_pure():
    w, s = make_world()
    c = E.conditions_from([dis("slowdown", area={"lat": 34.0, "lng": -117.95, "radius_km": 1}, slowdown_factor=2)])
    assert ev(w, s, c) == ev(w, s, c)


# ---- slowdown ----

def test_slowdown_covering_route_adds_time_inside_times_factor_minus_one():
    w, s = make_world()
    base = ev(w, s)
    c = E.conditions_from([dis("slowdown", "confirmed", area={"lat": 34.0, "lng": -117.95, "radius_km": 15}, slowdown_factor=2.0)])
    r = ev(w, s, c)
    # whole 600 s route inside, factor 2 -> +10 min
    assert r.eta_min - base.eta_min == pytest.approx(10.0, rel=1e-6)
    assert r.hit_disruption_ids == ("D-1",)


def test_slowdown_not_touching_route_adds_nothing():
    w, s = make_world()
    c = E.conditions_from([dis("slowdown", area={"lat": 34.3, "lng": -117.95, "radius_km": 2}, slowdown_factor=3.0)])
    r = ev(w, s, c)
    assert r == ev(w, s) or (r.eta_min == ev(w, s).eta_min and r.hit_disruption_ids == ())


# ---- closures and verification ----

CLOSE = {"lat": 34.0, "lng": -117.95, "radius_km": 2}


def test_confirmed_closure_on_route_is_at_risk():
    w, s = make_world()
    r = ev(w, s, E.conditions_from([dis("closure", "confirmed", 0.8, area=CLOSE)]))
    assert r.blocked_p == 1.0
    assert r.status == "at_risk"
    assert not r.needs_review
    assert r.flags == ()


def test_dismissed_closure_equals_normal():
    w, s = make_world()
    assert ev(w, s, E.conditions_from([dis("closure", "dismissed", 0.8, area=CLOSE)])) == ev(w, s)


def test_unverified_closure_uses_confidence_and_needs_review():
    w, s = make_world()
    r = ev(w, s, E.conditions_from([dis("closure", "unverified", 0.8, area=CLOSE, label="Road shut")]))
    assert r.blocked_p == pytest.approx(0.8)
    assert r.needs_review
    assert any("unverified" in f.lower() for f in r.flags)


def test_on_time_probability_mixes_blocked_and_unblocked_cases():
    from app.engine.geo import phi
    w, s = make_world()
    base = ev(w, s)
    r = ev(w, s, E.conditions_from([dis("closure", "unverified", 0.5, area=CLOSE)]))
    slack0 = 660 - base.eta_min
    expect = 0.5 * phi(slack0 / base.sigma) + 0.5 * phi((slack0 - 150) / base.sigma)
    assert r.on_time_probability == pytest.approx(expect)
    assert r.eta_min == pytest.approx(base.eta_min + 0.5 * 150)


def test_conditions_from_treats_confirmed_as_certain_and_ignores_dismissed():
    c = E.conditions_from([
        dis("closure", "confirmed", 0.3, id="D-1", area=CLOSE),
        dis("hazard", "unverified", 0.6, id="D-2", area=CLOSE),
        dis("closure", "dismissed", 0.9, id="D-3", area=CLOSE),
    ])
    got = {x.id: (x.p, x.unverified) for x in c.items}
    assert got == {"D-1": (1.0, False), "D-2": (0.6, True)}


def test_two_overlapping_closures_never_exceed_certainty():
    w, s = make_world()
    c = E.conditions_from([dis("closure", "confirmed", area=CLOSE, id="D-1"), dis("closure", "confirmed", area=CLOSE, id="D-2")])
    r = ev(w, s, c)
    assert r.blocked_p == 1.0 and 0 <= r.on_time_probability <= 1


def test_hazard_covering_destination_flags_it():
    w, s = make_world()
    r = ev(w, s, E.conditions_from([dis("hazard", "confirmed", area={"lat": B[0], "lng": B[1], "radius_km": 1})]))
    assert "Destination inside affected area" in r.flags


# ---- pickup delay ----

def test_pickup_delay_moves_pickup_when_truck_would_arrive_before_new_ready():
    w, s = make_world()  # truck at terminal at 480, ready 480
    r = ev(w, s, E.conditions_from([dis("pickup_delay", "confirmed", shipment_id="S1", delay_min=60)]))
    assert r.pickup_min == pytest.approx(540)
    assert r.wait_min == pytest.approx(60)
    assert r.ready_min == 540


def test_pickup_delay_has_no_effect_when_truck_arrives_after_new_ready():
    w, s = make_world(ready=300)  # ready long before the truck can arrive at clock 480
    base = ev(w, s)
    r = ev(w, s, E.conditions_from([dis("pickup_delay", "confirmed", shipment_id="S1", delay_min=60)]))
    assert r.pickup_min == base.pickup_min == pytest.approx(480)
    assert r.eta_min == base.eta_min


def test_pickup_delay_for_another_shipment_is_ignored():
    w, s = make_world()
    assert ev(w, s, E.conditions_from([dis("pickup_delay", "confirmed", shipment_id="ZZ", delay_min=60)])) == ev(w, s)


# ---- truck out ----

def test_truck_out_on_assigned_truck():
    w, s = make_world()
    r = ev(w, s, E.conditions_from([dis("truck_out", "confirmed", truck_ids=["T1"])]))
    assert r.truck_id is None
    assert r.late == 180 and r.on_time_probability == 0.05
    assert r.status == "at_risk"
    assert "No truck available" in r.flags
    assert r.unavailable


def test_truck_out_on_other_truck_has_no_effect():
    w, s = make_world()
    assert ev(w, s, E.conditions_from([dis("truck_out", "confirmed", truck_ids=["T2"])])) == ev(w, s)


def test_plan_without_truck_is_unavailable():
    w, s = make_world()
    r = ev(w, s, plan=E.Plan(None, "X-Y-0", 0))
    assert r.unavailable and r.truck_id is None and r.late == 180


# ---- dock cut ----

def test_dock_cut_half_adds_45_minutes():
    w, s = make_world()
    base = ev(w, s)
    r = ev(w, s, E.conditions_from([dis("dock_cut", "confirmed", warehouse_id="Y", capacity_cut=0.5)]))
    assert r.eta_min - base.eta_min == pytest.approx(45)
    assert r.idle_min - base.idle_min == pytest.approx(45)


# ---- driver hours ----

def test_driver_hours_over_limit():
    w, s = make_world(hours=0.5)
    r = ev(w, s)
    assert r.driver_hours_over > 0
    assert any(f.startswith("Driver hours exceed limit") for f in r.flags)


def test_driver_hours_within_limit_is_zero_over():
    w, s = make_world(hours=10)
    r = ev(w, s)
    # deadhead 0 + wait 0 + gate 40 + drive + unload 45 + return 9 min
    assert r.driver_hours == pytest.approx((40 + r.drive_min + 45 + 9) / 60)
    assert r.driver_hours_over == 0


# ---- appointment shift ----

def test_appointment_shift_moves_window_and_adds_fee():
    w, s = make_world()
    base = ev(w, s)
    r = ev(w, s, plan=E.Plan("T1", "X-Y-0", 30))
    assert (r.appt_start_min, r.appt_end_min) == (630, 690)
    assert r.cost_usd - base.cost_usd == pytest.approx(75)


# ---- status thresholds ----

@pytest.mark.parametrize("p,slack,expect", [
    (0.49, 100, "at_risk"),
    (0.50, 100, "tight"),
    (0.84, 100, "tight"),
    (0.85, 100, "on_time"),
    (0.99, 14.9, "tight"),
    (0.99, 15, "on_time"),
])
def test_status_thresholds(p, slack, expect):
    assert E.status_of(p, slack) == expect


# ---- the real seed day ----

def test_seed_day_has_no_at_risk_rows_at_0800():
    w = store.world
    rows = [E.evaluate(s, E.original_plan(s, w), NONE, w, 480) for s in w.shipments]
    statuses = [r.status for r in rows]
    assert "at_risk" not in statuses, statuses


def test_summarize_counts_and_sums():
    w = store.world
    rows = [E.evaluate(s, E.original_plan(s, w), NONE, w, 480) for s in w.shipments]
    ind = E.summarize(rows)
    assert ind["shipments_at_risk"] == 0
    assert ind["fleet_miles"] == pytest.approx(round(sum(r.miles for r in rows), 1))
    assert ind["co2_kg"] == pytest.approx(round(sum(r.co2_kg for r in rows), 1))
    assert ind["drivers_over_hours"] == sum(1 for r in rows if r.driver_hours_over > 0)
