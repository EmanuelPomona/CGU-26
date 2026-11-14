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


