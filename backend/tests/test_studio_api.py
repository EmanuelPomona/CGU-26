"""Task 3: studio session HTTP API."""
from __future__ import annotations


def test_create_session_and_three_alternatives(client):
    r = client.post(
        "/api/studio/session",
        json={"truck_id": "T3", "destination": {"lat": 34.03, "lng": -117.59}},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["truck_id"] == "T3"
    assert len(body["alternatives"]) == 3
    slots = {a["slot"] for a in body["alternatives"]}
    assert slots == {"fastest", "direct", "avoid"}
    for a in body["alternatives"]:
        assert a["summary"]
        assert a["pros"] and a["cons"]
        assert "metrics" in a
    assert body["baseline"]["slot"] == "fastest"


def test_add_closure_recomputes(client):
    s = client.post(
        "/api/studio/session",
        json={"truck_id": "T3", "destination": {"lat": 34.03, "lng": -117.59}},
    ).json()
    # Drop near a mid-corridor node
    r = client.post(
        f"/api/studio/session/{s['id']}/obstacles",
        json={"type": "road_closure", "lat": 34.0, "lng": -117.88},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["obstacles"]) == 1
    assert len(body["alternatives"]) == 3
    assert all(a["pros"] and a["cons"] for a in body["alternatives"])


def test_destination_in_ocean_rejected(client):
    r = client.post(
        "/api/studio/session",
        json={"truck_id": "T3", "destination": {"lat": 33.5, "lng": -120.5}},
    )
    assert r.status_code == 422
