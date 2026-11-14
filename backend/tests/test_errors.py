"""The single Error shape for request-body failures."""
from tests.contract import assert_matches


def test_malformed_json_is_422_in_error_shape(client):
    r = client.put("/api/settings", content=b"{not json", headers={"Content-Type": "application/json"})
    assert r.status_code == 422
    assert_matches("Error", r.json())
    assert r.json()["error"] == "validation_error" and r.json()["field"]


def test_schema_violation_names_field(client):
    r = client.put("/api/settings", json={"clock_min": 359, "weights": {"reliability": 1, "cost": 0,
                                          "emissions": 0, "community": 0, "driver": 0}})
    assert r.status_code == 422
    assert r.json()["field"] == "clock_min"




def test_undecodable_body_is_422_not_400(client):
    r = client.put("/api/settings", content=b"\xf3\x97w", headers={"Content-Type": "application/json"})
    assert r.status_code == 422
    assert_matches("Error", r.json())
    assert r.json()["error"] == "validation_error" and r.json()["field"] == "body"


def test_wrong_method_is_405_with_allow_header(client):
    r = client.request("TRACE", "/api/network")
    assert r.status_code == 405
    assert "GET" in r.headers.get("allow", "")
    assert_matches("Error", r.json())


def test_explicit_null_for_non_nullable_field_is_422(client):
    body = {"kind": "slowdown", "area": {"lat": 33.9, "lng": -118.2, "radius_km": 2}, "slowdown_factor": 2,
            "capacity_cut": None}
    r = client.post("/api/disruptions", json=body)
    assert r.status_code == 422 and r.json()["field"] == "capacity_cut"
    r = client.post("/api/decisions", json={"shipment_id": "C-101", "option_id": "keep", "reason": None})
    assert r.status_code == 422 and r.json()["field"] == "reason"


def test_allow_header_lists_every_method_on_the_path(client):
    r = client.request("TRACE", "/api/disruptions")
    assert set(r.headers["allow"].replace(" ", "").split(",")) >= {"GET", "POST"}
    r = client.request("TRACE", "/api/disruptions/D-1")
    assert set(r.headers["allow"].replace(" ", "").split(",")) >= {"PATCH", "DELETE"}
