import pytest

from tests.contract import assert_inline, assert_matches, response_schema

CLOSE60 = {"kind": "closure", "label": "SR-60 full closure (simulated)", "source": "simulated",
           "confidence": 0.8, "area": {"lat": 34.0, "lng": -117.88, "radius_km": 2}}
INDICATORS = ["shipments_at_risk", "total_late_min", "fleet_miles", "co2_kg", "cost_usd"]


def presets(client):
    return {p["id"]: p["disruption"] for p in client.get("/api/presets").json()["presets"]}


def post(client, body):
    return client.post("/api/disruptions", json=body)


def test_create_starts_unverified_with_id_and_is_last(client):
    r = post(client, CLOSE60)
    assert r.status_code == 201
    b = r.json()
    assert_matches("Board", b)
    d = b["disruptions"][-1]
    assert d["id"] == "D-1" and d["verification"] == "unverified"
    assert b["pending_verification_ids"] == ["D-1"]
    r2 = post(client, {"kind": "pickup_delay", "shipment_id": "C-101", "delay_min": 30})
    assert r2.json()["disruptions"][-1]["id"] == "D-2"


def test_create_generates_label_and_nulls_foreign_fields(client):
    body = {"kind": "pickup_delay", "shipment_id": "C-103", "delay_min": 60, "slowdown_factor": 2.0,
            "area": {"lat": 34.0, "lng": -118.0, "radius_km": 2}, "truck_ids": ["T1"]}
    d = post(client, body).json()["disruptions"][-1]
    assert d["label"] and "C-103" in d["label"]
    assert d["area"] is None and d["slowdown_factor"] is None and d["truck_ids"] == []
    assert d["warehouse_id"] is None and d["capacity_cut"] is None and d["note"] is None
    assert d["source"] == "dispatcher" and d["confidence"] == 0.7


def test_ids_restart_after_reset(client):
    post(client, CLOSE60)
    client.post("/api/reset")
    assert post(client, CLOSE60).json()["disruptions"][-1]["id"] == "D-1"


@pytest.mark.parametrize("body,field", [
    ({"kind": "slowdown", "area": {"lat": 33.9, "lng": -118.2, "radius_km": 2}}, "slowdown_factor"),
    ({"kind": "slowdown", "slowdown_factor": 2}, "area"),
    ({"kind": "closure"}, "area"),
    ({"kind": "hazard"}, "area"),
    ({"kind": "pickup_delay", "shipment_id": "C-101"}, "delay_min"),
    ({"kind": "pickup_delay", "delay_min": 30}, "shipment_id"),
    ({"kind": "truck_out", "truck_ids": []}, "truck_ids"),
    ({"kind": "truck_out"}, "truck_ids"),
    ({"kind": "dock_cut", "warehouse_id": "ONT"}, "capacity_cut"),
    ({"kind": "dock_cut", "capacity_cut": 0.5}, "warehouse_id"),
])
def test_missing_companion_field_is_422(client, body, field):
    r = post(client, body)
    assert r.status_code == 422, r.text
    assert_matches("Error", r.json())
    assert r.json()["error"] == "validation_error" and r.json()["field"] == field


@pytest.mark.parametrize("body,field", [
    ({"kind": "pickup_delay", "shipment_id": "C-999", "delay_min": 30}, "shipment_id"),
    ({"kind": "dock_cut", "warehouse_id": "XXX", "capacity_cut": 0.5}, "warehouse_id"),
    ({"kind": "truck_out", "truck_ids": ["T1", "T99"]}, "truck_ids"),
])
def test_unknown_referenced_id_is_422_not_404(client, body, field):
    r = post(client, body)
    assert r.status_code == 422 and r.json()["field"] == field


@pytest.mark.parametrize("body,field", [
    ({**CLOSE60, "area": {"lat": 34.0, "lng": -117.88, "radius_km": 0.1}}, "area.radius_km"),
    ({**CLOSE60, "confidence": 0}, "confidence"),
    ({"kind": "slowdown", "slowdown_factor": 9, "area": {"lat": 33.9, "lng": -118.2, "radius_km": 2}}, "slowdown_factor"),
    ({**CLOSE60, "area": {"lat": 40.7, "lng": -74.0, "radius_km": 2}}, "area.lat"),
    ({**CLOSE60, "kind": "earthquake"}, "kind"),
    ({**CLOSE60, "label": "x" * 81}, "label"),
])
def test_out_of_range_is_422(client, body, field):
    r = post(client, body)
    assert r.status_code == 422 and r.json()["field"] == field


def test_affected_ids_per_kind(client):
    p = presets(client)
    b = post(client, p["pickup103"]).json()
    assert b["disruptions"][-1]["affected_shipment_ids"] == ["C-103"]
    b = post(client, p["trucks35"]).json()
    assert b["disruptions"][-1]["affected_shipment_ids"] == ["C-103", "C-105"]
    b = post(client, p["docksONT"]).json()
    assert b["disruptions"][-1]["affected_shipment_ids"] == ["C-103", "C-107"]


def test_every_preset_is_accepted_and_area_presets_hit_routes(client):
    for pid, body in presets(client).items():
        client.post("/api/reset")
        r = post(client, body)
        assert r.status_code == 201, (pid, r.text)
        assert_matches("Board", r.json())
        if pid in ("close60", "slow710"):
            assert r.json()["disruptions"][-1]["affected_shipment_ids"], pid


def test_close60_confirmed_moves_two_indicators_and_dismiss_restores(client):
    b = post(client, presets(client)["close60"]).json()
    did = b["disruptions"][-1]["id"]
    r = client.patch(f"/api/disruptions/{did}", json={"verification": "confirmed"})
    assert r.status_code == 200
    b = r.json()
    assert_matches("Board", b)
    n, c = b["indicators"]["normal"], b["indicators"]["changed"]
    assert sum(n[k] != c[k] for k in INDICATORS) >= 2, (n, c)
    assert b["pending_verification_ids"] == []
    assert not any(s["current"]["needs_review"] for s in b["shipments"])

    b = client.patch(f"/api/disruptions/{did}", json={"verification": "dismissed", "note": "Caltrans says open"}).json()
    assert b["indicators"]["changed"] == b["indicators"]["normal"]
    d = b["disruptions"][-1]
    assert d["verification"] == "dismissed" and d["note"] == "Caltrans says open"
    assert d["affected_shipment_ids"]
    for s in b["shipments"]:
        assert s["changed"] == s["normal"] == s["current"]


def test_unverified_closure_marks_affected_rows_for_review(client):
    b = post(client, presets(client)["close60"]).json()
    affected = set(b["disruptions"][-1]["affected_shipment_ids"])
    for s in b["shipments"]:
        assert s["current"]["needs_review"] == (s["id"] in affected)
        if s["id"] in affected:
            assert s["attention"] in ("watch", "act")
            assert "D-1" in s["current"]["hit_disruption_ids"]
    chk = {c["id"]: c for c in b["indicators"]["checks"]}
    assert chk["unverified_inputs"]["triggered"]


def test_patch_and_delete_unknown_id_is_404(client):
    r = client.patch("/api/disruptions/D-42", json={"verification": "confirmed"})
    assert r.status_code == 404 and r.json()["error"] == "not_found"
    r = client.delete("/api/disruptions/D-42")
    assert r.status_code == 404 and r.json()["error"] == "not_found"


def test_patch_rejects_bad_verification(client):
    post(client, CLOSE60)
    r = client.patch("/api/disruptions/D-1", json={"verification": "maybe"})
    assert r.status_code == 422 and r.json()["field"] == "verification"


def test_delete_removes_disruption(client):
    post(client, CLOSE60)
    r = client.delete("/api/disruptions/D-1")
    assert r.status_code == 200
    b = r.json()
    assert_matches("Board", b)
    assert b["disruptions"] == [] and b["indicators"]["changed"] == b["indicators"]["normal"]


def test_same_preset_twice_creates_two_and_caps_block_probability(client):
    p = presets(client)["close60"]
    post(client, p)
    b = post(client, p).json()
    assert [d["id"] for d in b["disruptions"]] == ["D-1", "D-2"]
    client.patch("/api/disruptions/D-1", json={"verification": "confirmed"})
    b = client.patch("/api/disruptions/D-2", json={"verification": "confirmed"}).json()
    for s in b["shipments"]:
        assert 0 <= s["current"]["on_time_probability"] <= 1


def test_list_disruptions(client):
    post(client, CLOSE60)
    r = client.get("/api/disruptions")
    assert r.status_code == 200
    assert_inline(response_schema("/api/disruptions", "get"), r.json())
    assert [d["id"] for d in r.json()["disruptions"]] == ["D-1"]
