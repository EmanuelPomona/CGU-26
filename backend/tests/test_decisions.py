import re

from tests.contract import assert_inline, assert_matches, response_schema
from tests.helpers import add_preset, options


def decide(client, sid, oid, reason=None):
    body = {"shipment_id": sid, "option_id": oid}
    if reason is not None:
        body["reason"] = reason
    return client.post("/api/decisions", json=body)


def row(board, sid):
    return next(s for s in board["shipments"] if s["id"] == sid)


def test_suggested_option_without_reason_is_201(client):
    add_preset(client, "close60", "confirmed")
    o = options(client, "C-103")
    r = decide(client, "C-103", o["suggested_option_id"])
    assert r.status_code == 201, r.text
    res = r.json()
    assert_matches("DecisionResult", res)
    d = res["decision"]
    assert d["id"] == "DEC-1" and d["seq"] == 1 and d["was_suggested"] and d["reason"] is None
    b = res["board"]
    s = row(b, "C-103")
    assert s["decision_id"] == "DEC-1"
    sug = next(x for x in o["options"] if x["suggested"])
    assert s["current"] == sug["evaluation"]
    assert s["changed"] != s["current"] or sug["id"] == "keep"
    assert b["indicators"]["decided"] != b["indicators"]["changed"]
    assert b["decisions"][-1]["id"] == "DEC-1"


def test_override_without_reason_is_422(client):
    add_preset(client, "close60", "confirmed")
    o = options(client, "C-103")
    other = next(x for x in o["options"] if not x["suggested"] and x["feasible"])
    r = decide(client, "C-103", other["id"])
    assert r.status_code == 422 and r.json()["field"] == "reason"
    r = decide(client, "C-103", other["id"], "Customer asked us to keep the usual road")
    assert r.status_code == 201
    assert r.json()["decision"]["reason"] == "Customer asked us to keep the usual road"
    assert not r.json()["decision"]["was_suggested"]


def test_keep_is_a_valid_decision(client):
    add_preset(client, "close60", "confirmed")
    o = options(client, "C-103")
    r = decide(client, "C-103", "keep", None if o["suggested_option_id"] == "keep" else "Wait and see")
    assert r.status_code == 201
    assert r.json()["decision"]["option_kind"] == "keep"


def test_unknown_shipment_is_404_and_unknown_option_409(client):
    assert decide(client, "C-999", "keep").status_code == 404
    r = decide(client, "C-101", "reroute:NOPE-0", "because")
    assert r.status_code == 409 and r.json()["error"] == "option_infeasible"
    assert_matches("Error", r.json())


def test_infeasible_option_is_409(client):
    add_preset(client, "trucks35", "confirmed")
    r = decide(client, "C-103", "keep", "Try anyway")
    assert r.status_code == 409 and r.json()["error"] == "option_infeasible"


def test_supervisor_update_text(client):
    add_preset(client, "close60")
    o = options(client, "C-103")
    other = next(x for x in o["options"] if x["feasible"] and not x["suggested"])
    msg = decide(client, "C-103", other["id"], "Dispatcher prefers the freeway").json()["decision"]["supervisor_update"]
    lines = msg.splitlines()
    assert len(lines) >= 5
    assert "C-103" in msg and "E-commerce" in msg
    assert re.search(r"\d{1,2}:\d{2} (AM|PM)", msg)
    assert "Dispatcher prefers the freeway" in msg
    assert "unverified" in msg.lower()
    assert lines[-1] == "Drafted by the dispatch tool. Reviewed and sent by the dispatcher."
    assert "Driver 0" not in msg


def test_second_decision_replaces_first(client):
    add_preset(client, "close60", "confirmed")
    o = options(client, "C-103")
    a, b2 = o["options"][0], o["options"][1]
    decide(client, "C-103", a["id"], "first try")
    r = decide(client, "C-103", b2["id"], "second thought")
    assert r.status_code == 201, r.text
    b = r.json()["board"]
    ids = [d for d in b["decisions"] if d["shipment_id"] == "C-103"]
    assert len(ids) == 1 and ids[0]["id"] == "DEC-2" and ids[0]["seq"] == 2
    assert row(b, "C-103")["decision_id"] == "DEC-2"


def test_swap_changes_both_and_undo_restores(client):
    # confirmed fire zone pushes C-104's driver (T4, 7.5 h left) over hours; a swap fixes that
    add_preset(client, "fire", "confirmed")
    o = options(client, "C-104")
    swap = next(x for x in o["options"] if x["kind"] == "swap_truck")
    assert swap["feasible"]
    other = swap["collateral"][0]["shipment_id"]
    r = decide(client, "C-104", swap["id"], None if swap["suggested"] else "swap to stay within hours")
    assert r.status_code == 201, r.text
    d, b = r.json()["decision"], r.json()["board"]
    assert d["also_affects"] == [other]
    assert row(b, other)["decision_id"] == d["id"]
    assert row(b, "C-104")["current"]["truck_id"] == swap["evaluation"]["truck_id"]
    assert row(b, other)["current"]["truck_id"] == "T4"
    u = client.delete(f"/api/decisions/{d['id']}")
    assert u.status_code == 200
    ub = u.json()
    assert_matches("Board", ub)
    assert ub["decisions"] == []
    for s in ub["shipments"]:
        assert s["decision_id"] is None and s["current"] == s["changed"]


def test_undo_unknown_is_404(client):
    r = client.delete("/api/decisions/DEC-9")
    assert r.status_code == 404 and r.json()["error"] == "not_found"


def test_list_decisions(client):
    add_preset(client, "close60", "confirmed")
    o = options(client, "C-103")
    decide(client, "C-103", o["suggested_option_id"])
    r = client.get("/api/decisions")
    assert_inline(response_schema("/api/decisions", "get"), r.json())
    assert [d["id"] for d in r.json()["decisions"]] == ["DEC-1"]


def test_reset_after_full_flow_equals_fresh_start(client):
    fresh = client.get("/api/board").json()
    add_preset(client, "close60", "confirmed")
    o = options(client, "C-103")
    decide(client, "C-103", o["suggested_option_id"])
    client.put("/api/settings", json={"clock_min": 600, "weights": {"reliability": 1, "cost": 1, "emissions": 1,
                                                                    "community": 1, "driver": 1}})
    assert client.post("/api/reset").json() == fresh
    assert client.post("/api/disruptions", json={"kind": "closure", "area": {"lat": 34, "lng": -117.88,
                                                 "radius_km": 2}}).json()["disruptions"][0]["id"] == "D-1"
