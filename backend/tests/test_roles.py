"""TASK-006: route roles on options. Written before app/engine/roles.py."""
from types import SimpleNamespace as NS

from tests.contract import assert_matches
from tests.helpers import add_preset, options, presets

SEED = ["C-101", "C-102", "C-103", "C-104", "C-105", "C-106", "C-107"]


def opt(oid, kind="reroute", eta=600.0, co2=100.0, comm=90.0, feasible=True):
    return {"id": oid, "kind": kind, "feasible": feasible,
            "ev": NS(eta_min=eta, co2_kg=co2, community=NS(score=comm))}


def roles_of(opts):
    from app.engine.roles import assign_roles
    assign_roles(opts)
    return {o["id"]: o["roles"] for o in opts}


def test_three_different_winners():
    r = roles_of([opt("keep", "keep", eta=600, co2=120, comm=80),
                  opt("reroute:a", eta=610, co2=100, comm=85),
                  opt("reroute:b", eta=620, co2=130, comm=95)])
    assert r == {"keep": ["efficiency"], "reroute:a": ["sustainability"], "reroute:b": ["community"]}


def test_one_option_wins_all_three():
    r = roles_of([opt("keep", "keep", eta=600, co2=100, comm=95),
                  opt("reroute:a", eta=610, co2=110, comm=90)])
    assert r == {"keep": ["efficiency", "sustainability", "community"], "reroute:a": []}


def test_community_candidate_beyond_30_minutes_is_excluded():
    r = roles_of([opt("keep", "keep", eta=600, co2=100, comm=70),
                  opt("reroute:a", eta=631, co2=110, comm=99),   # best community but 31 min later
                  opt("reroute:b", eta=630, co2=120, comm=80)])  # exactly 30 min: eligible
    assert r["reroute:a"] == [] and r["reroute:b"] == ["community"]


def test_keep_infeasible_roles_go_to_feasible_reroutes():
    r = roles_of([opt("keep", "keep", eta=500, co2=50, comm=100, feasible=False),
                  opt("reroute:a", eta=610, co2=100, comm=85),
                  opt("spare:T8", "spare_truck", eta=400, co2=10, comm=100)])
    assert r == {"keep": [], "reroute:a": ["efficiency", "sustainability", "community"], "spare:T8": []}


def test_all_infeasible_gives_no_roles():
    r = roles_of([opt("keep", "keep", feasible=False), opt("reroute:a", feasible=False),
                  opt("reschedule:30", "reschedule")])
    assert all(v == [] for v in r.values())


def test_ties_go_to_the_option_that_appears_first():
    r = roles_of([opt("keep", "keep", eta=600, co2=100, comm=90),
                  opt("reroute:a", eta=600, co2=100, comm=90)])
    assert r == {"keep": ["efficiency", "sustainability", "community"], "reroute:a": []}


def test_unrounded_values_decide():
    r = roles_of([opt("keep", "keep", eta=600.4, co2=100.04, comm=90.4),
                  opt("reroute:a", eta=600.3, co2=100.03, comm=90.45)])
    assert r == {"keep": [], "reroute:a": ["efficiency", "sustainability", "community"]}


def _check_roles(o):
    held = {}
    for x in o["options"]:
        if x["kind"] not in ("keep", "reroute") or not x["feasible"]:
            assert x["roles"] == [], x["id"]
        for role in x["roles"]:
            assert role not in held
            held[role] = x["id"]
    any_feasible = any(x["feasible"] and x["kind"] in ("keep", "reroute") for x in o["options"])
    assert set(held) == ({"efficiency", "sustainability", "community"} if any_feasible else set())


def test_every_options_response_matches_contract_and_role_rules(client):
    for sid in SEED:
        o = options(client, sid)
        assert_matches("OptionsResponse", o)
        _check_roles(o)
        assert options(client, sid) == o
    for pid in presets(client):
        client.post("/api/reset")
        add_preset(client, pid, "confirmed")
        for sid in SEED:
            o = options(client, sid)
            assert_matches("OptionsResponse", o)
            _check_roles(o)


def test_truck_out_keep_has_no_roles(client):
    add_preset(client, "trucks35", "confirmed")
    o = options(client, "C-103")
    assert o["options"][0]["id"] == "keep" and o["options"][0]["roles"] == []
    _check_roles(o)


def test_sustainability_candidate_beyond_30_minutes_is_excluded():
    r = roles_of([opt("keep", "keep", eta=750, co2=90, comm=80),        # cleanest, but 2.5 h late
                  opt("reroute:a", eta=600, co2=120, comm=85),
                  opt("reroute:b", eta=630, co2=110, comm=70)])      # exactly 30 min: eligible
    assert r == {"keep": [], "reroute:a": ["efficiency", "community"], "reroute:b": ["sustainability"]}


def test_close60_never_gives_sustainability_to_route_through_closure(client):
    add_preset(client, "close60", "confirmed")
    for sid in ("C-103", "C-107"):
        o = options(client, sid)
        pool = [x for x in o["options"] if x["feasible"] and x["kind"] in ("keep", "reroute")]
        earliest = min(x["evaluation"]["eta_min"] for x in pool)
        sus = next(x for x in o["options"] if "sustainability" in x["roles"])
        assert "D-1" not in sus["evaluation"]["hit_disruption_ids"], (sid, sus["id"])
        assert sus["evaluation"]["eta_min"] - earliest <= 30, (sid, sus["id"])
        assert sus["evaluation"]["status"] != "at_risk", (sid, sus["id"])
