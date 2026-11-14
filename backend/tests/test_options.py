import re

import pytest

from tests.contract import assert_matches
from tests.helpers import add_preset, options, presets

SEED = ["C-101", "C-102", "C-103", "C-104", "C-105", "C-106", "C-107"]
ID_RE = re.compile(r"^(keep|reroute:[A-Z]+-[A-Z]+-\d+|spare:T\d|swap:C-\d+|reschedule:\d+)$")


def test_options_match_contract_keep_first_and_ids(client):
    add_preset(client, "close60", "confirmed")
    o = options(client, "C-103")
    assert_matches("OptionsResponse", o)
    assert o["shipment_id"] == "C-103"
    ids = [x["id"] for x in o["options"]]
    assert ids[0] == "keep" and o["options"][0]["kind"] == "keep"
    assert all(ID_RE.match(i) for i in ids), ids
    assert len(ids) == len(set(ids))
    assert sum(x["kind"] == "reroute" for x in o["options"]) <= 2
    assert not any(x["kind"] == "hold" for x in o["options"])
    rest = [x["scores"]["overall"] for x in o["options"][1:]]
    assert rest == sorted(rest, reverse=True)


def test_unknown_shipment_is_404(client):
    r = client.get("/api/shipments/C-999/options")
    assert r.status_code == 404 and r.json()["error"] == "not_found"


def test_options_are_deterministic(client):
    add_preset(client, "close60")
    assert options(client, "C-107") == options(client, "C-107")


def test_keep_delta_is_zero_and_delta_is_option_minus_keep(client):
    add_preset(client, "close60", "confirmed")
    o = options(client, "C-103")
    keep = o["options"][0]
    assert all(v == 0 for v in keep["delta"].values())
    for x in o["options"][1:]:
        assert x["delta"]["miles"] == pytest.approx(x["evaluation"]["miles"] - keep["evaluation"]["miles"], abs=0.11)
        assert x["delta"]["late_min"] == pytest.approx(x["evaluation"]["late_min"] - keep["evaluation"]["late_min"], abs=1)


def test_suggestion_is_single_and_feasible(client):
    for pid in presets(client):
        client.post("/api/reset")
        add_preset(client, pid)
        for sid in SEED:
            o = options(client, sid)
            sug = [x for x in o["options"] if x["suggested"]]
            assert len(sug) <= 1
            if sug:
                assert sug[0]["feasible"] and sug[0]["id"] == o["suggested_option_id"]
            else:
                assert o["suggested_option_id"] is None


def test_truck_out_offers_spare_truck(client):
    add_preset(client, "trucks35", "confirmed")
    o = options(client, "C-103")
    keep = o["options"][0]
    assert not keep["feasible"] and keep["infeasible_reason"]
    spares = [x for x in o["options"] if x["kind"] == "spare_truck"]
    assert spares and spares[0]["id"] in ("spare:T8", "spare:T9")
    assert spares[0]["feasible"]


def test_spare_committed_by_another_decision_is_not_offered(client):
    add_preset(client, "trucks35", "confirmed")
    o = options(client, "C-103")
    spare = next(x for x in o["options"] if x["kind"] == "spare_truck")
    client.post("/api/decisions", json={"shipment_id": "C-103", "option_id": spare["id"], "reason": "use the spare"})
    o2 = options(client, "C-105")
    assert spare["id"] not in [x["id"] for x in o2["options"]]


def test_swap_has_collateral(client):
    add_preset(client, "fire", "confirmed")  # C-104's driver goes over hours: a swap is offered
    assert any(x["kind"] == "swap_truck" for x in options(client, "C-104")["options"])
    for sid in SEED:
        for x in options(client, sid)["options"]:
            if x["kind"] == "swap_truck":
                assert len(x["collateral"]) == 1
                assert x["collateral"][0]["shipment_id"] == x["id"].split(":")[1]
                assert any(bu["stakeholder"] == "other_customer" for bu in x["burdens"])
            else:
                assert x["collateral"] == []


def test_reschedule_search_and_warehouse_burden(client):
    add_preset(client, "close60", "confirmed")
    o = options(client, "C-107")
    rs = [x for x in o["options"] if x["kind"] == "reschedule"]
    assert rs, [x["id"] for x in o["options"]]
    shift = int(rs[0]["id"].split(":")[1])
    assert shift % 15 == 0 and 15 <= shift <= 180
    assert rs[0]["evaluation"]["appt_shift_min"] == shift
    wb = [b["text"] for b in rs[0]["burdens"] if b["stakeholder"] == "warehouse"]
    assert wb and "booked" in wb[0] and "capacity" in wb[0] and "$75" in wb[0]


def test_reschedule_infeasible_when_warehouse_nearly_full(client):
    # IRV: capacity 18, booked 17 -> one free slot
    client.post("/api/disruptions", json={"kind": "pickup_delay", "shipment_id": "C-106", "delay_min": 240})
    rs = [x for x in options(client, "C-106")["options"] if x["kind"] == "reschedule"]
    assert rs and not rs[0]["feasible"]


def test_keep_late_has_company_burden(client):
    add_preset(client, "close60", "confirmed")
    keep = options(client, "C-103")["options"][0]
    assert keep["evaluation"]["late_min"] > 0
    assert any(b["stakeholder"] == "company" and "detention" in b["text"] for b in keep["burdens"])


def test_unverified_disruption_note(client):
    add_preset(client, "close60")
    keep = options(client, "C-103")["options"][0]
    assert "Based on an unverified report: confirm before acting." in keep["notes"]
    client.patch("/api/disruptions/D-1", json={"verification": "confirmed"})
    keep = options(client, "C-103")["options"][0]
    assert "Based on an unverified report: confirm before acting." not in keep["notes"]


def test_driver_burdens(client):
    o = options(client, "C-106")  # waits for its container on the normal day
    keep = o["options"][0]
    assert keep["evaluation"]["idle_min"] >= 20
    assert any(b["stakeholder"] == "driver" for b in keep["burdens"])


def test_banned_words_absent_everywhere(client):
    banned = ["AI", "optimal", "model predicts"]
    for pid in presets(client):
        client.post("/api/reset")
        add_preset(client, pid)
        for sid in SEED:
            o = options(client, sid)
            texts = [o["rationale"]]
            for x in o["options"]:
                texts += [x["title"], x["description"], *x["notes"], *(b["text"] for b in x["burdens"])]
            for t in texts:
                for w in banned:
                    assert w not in t, (pid, sid, t)
