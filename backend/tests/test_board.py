import pytest

from tests.contract import assert_matches

SEED = ["C-101", "C-102", "C-103", "C-104", "C-105", "C-106", "C-107"]
W0 = {"reliability": 35, "cost": 20, "emissions": 20, "community": 15, "driver": 10}


def test_fresh_board_is_the_normal_day(client):
    r = client.get("/api/board")
    assert r.status_code == 200
    b = r.json()
    assert_matches("Board", b)
    assert [s["id"] for s in b["shipments"]] == SEED
    for s in b["shipments"]:
        assert s["normal"] == s["changed"] == s["current"]
        assert s["decision_id"] is None
        assert s["route"]["id"] == s["normal_route_id"] == s["current"]["route_id"]
        assert "steps" not in s["route"]
    ind = b["indicators"]
    assert ind["normal"] == ind["changed"] == ind["decided"]
    assert [c["id"] for c in ind["checks"]] == ["added_miles_review", "new_at_risk", "driver_hours", "unverified_inputs"]
    assert all(not c["triggered"] for c in ind["checks"])
    assert b["pending_verification_ids"] == [] and b["disruptions"] == [] and b["decisions"] == []
    assert b["settings"] == {"clock_min": 480, "weights": W0}


def test_seed_day_mixes_on_time_and_tight_without_at_risk(client):
    statuses = {s["current"]["status"] for s in client.get("/api/board").json()["shipments"]}
    assert "at_risk" not in statuses and "on_time" in statuses


def test_added_miles_check_says_threshold_is_an_example(client):
    chk = {c["id"]: c for c in client.get("/api/board").json()["indicators"]["checks"]}
    d = chk["added_miles_review"]["detail"]
    assert "20" in d and "example" in d and "not an operating standard" in d


@pytest.mark.parametrize("status,needs_review,expect", [
    ("at_risk", False, "act"), ("at_risk", True, "act"), ("tight", False, "watch"),
    ("on_time", True, "watch"), ("on_time", False, "none")])
def test_attention_rule(status, needs_review, expect):
    from app.engine.board import attention_of
    assert attention_of(status, needs_review) == expect


def test_rounding_at_the_boundary(client):
    s = client.get("/api/board").json()["shipments"][0]["current"]
    for k in ["eta_min", "slack_min", "late_min", "idle_min", "appt_start_min", "appt_end_min"]:
        assert isinstance(s[k], int)
    for k in ["miles", "cost_usd", "co2_kg", "driver_hours", "eta_sigma_min"]:
        assert round(s[k], 1) == s[k]
    assert round(s["on_time_probability"], 2) == s["on_time_probability"]
    assert s["community_score"] == round(s["community_score"])


def test_put_settings_changes_board(client):
    before = client.get("/api/board").json()
    w = {"reliability": 0, "cost": 0, "emissions": 100, "community": 0, "driver": 0}
    r = client.put("/api/settings", json={"clock_min": 420, "weights": w})
    assert r.status_code == 200
    b = r.json()
    assert_matches("Board", b)
    assert b["settings"] == {"clock_min": 420, "weights": w}
    assert b["shipments"][0]["current"]["eta_min"] != before["shipments"][0]["current"]["eta_min"]
    assert client.get("/api/board").json()["settings"]["clock_min"] == 420


def test_put_settings_all_zero_weights_is_422(client):
    r = client.put("/api/settings", json={"clock_min": 480, "weights": {k: 0 for k in W0}})
    assert r.status_code == 422
    assert_matches("Error", r.json())
    assert r.json()["field"] == "weights"


def test_put_settings_clock_out_of_range_is_422(client):
    r = client.put("/api/settings", json={"clock_min": 359, "weights": W0})
    assert r.status_code == 422 and r.json()["field"] == "clock_min"


def test_reset_returns_fresh_board(client):
    fresh = client.get("/api/board").json()
    client.put("/api/settings", json={"clock_min": 600, "weights": W0})
    r = client.post("/api/reset")
    assert r.status_code == 200
    assert_matches("Board", r.json())
    assert r.json() == fresh
