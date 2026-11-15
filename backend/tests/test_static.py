from fastapi.testclient import TestClient

from app.main import create_app
from tests.contract import assert_inline, assert_matches, response_schema


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}
    assert_inline(response_schema("/api/health", "get"), r.json())


def test_network_matches_contract_and_seed(client):
    r = client.get("/api/network")
    assert r.status_code == 200
    n = r.json()
    assert_matches("Network", n)
    assert [t["id"] for t in n["terminals"]] == ["POLA", "POLB"]
    assert [w["id"] for w in n["warehouses"]] == ["VER", "COM", "SFS", "CLM", "ONT", "FON", "IRV"]
    assert [t["id"] for t in n["trucks"]] == [f"T{i}" for i in range(1, 10)]
    assert [t["id"] for t in n["trucks"] if t["spare"]] == ["T8", "T9"]
    assert next(t for t in n["trucks"] if t["id"] == "T1")["driver_label"] == "George"
    assert [p["id"] for p in n["sensitive_places"]] == [f"SP-{i:02d}" for i in range(1, 31)]
    ont = next(w for w in n["warehouses"] if w["id"] == "ONT")
    assert (ont["docks"], ont["capacity"], ont["booked"]) == (20, 60, 44)
    clm = next(w for w in n["warehouses"] if w["id"] == "CLM")
    assert clm["name"] == "Claremont DC"


def test_presets_are_the_seven_from_the_contract(client):
    r = client.get("/api/presets")
    assert r.status_code == 200
    assert_inline(response_schema("/api/presets", "get"), r.json())
    p = {x["id"]: x["disruption"] for x in r.json()["presets"]}
    assert list(p) == ["slow710", "close60", "fire", "flood", "pickup103", "trucks35", "docksONT"]
    assert p["fire"]["area"] == {"lat": 34.13, "lng": -117.5, "radius_km": 7}
    assert p["flood"]["area"] == {"lat": 34.0, "lng": -118.22, "radius_km": 2.5}
    assert p["close60"]["confidence"] == 0.8 and p["slow710"]["slowdown_factor"] == 2.6
    assert all(d["source"] == "simulated" for d in p.values())


def test_method_lists_every_constant_as_simulated(client):
    r = client.get("/api/method")
    assert r.status_code == 200
    m = r.json()
    assert_matches("Method", m)
    keys = {a["key"] for a in m["assumptions"]}
    for k in ["gate_min", "unload_min", "block_penalty_min", "no_truck_late_min", "detention_usd_per_min",
              "usd_per_mile", "driver_usd_per_hour", "co2_loaded", "co2_empty", "co2_idle",
              "congestion_co2_extra", "deadhead_mph", "circuity", "reschedule_fee_usd", "sensitive_radius_m"]:
        assert k in keys
    assert all(a["kind"] == "simulated" for a in m["assumptions"])
    names = " ".join(d["name"] + d["limits"] for d in m["data_sources"])
    assert "OSRM" in names and "no truck restrictions" in names
    assert {c["consideration"] for c in m["responsible_design"]} == {
        "environment", "fairness", "transparency", "human_oversight", "responsible_data"}


def test_feed_candidates_offline_reports_sources_down(client):
    r = client.get("/api/feeds/candidates")
    assert r.status_code == 200
    assert_matches("FeedCandidates", r.json())
    assert r.json()["candidates"] == []
    assert [(s["name"], s["ok"]) for s in r.json()["sources"]] == [("CHP incidents", False), ("NWS alerts", False)]


def test_unknown_path_is_404_not_found(client):
    r = client.get("/api/nope")
    assert r.status_code == 404
    assert_matches("Error", r.json())
    assert r.json()["error"] == "not_found"


def test_unhandled_exception_is_generic_500():
    app = create_app()

    @app.get("/api/_boom")
    def boom():
        raise RuntimeError("secret internal detail")

    with TestClient(app, raise_server_exceptions=False) as c:
        r = c.get("/api/_boom")
    assert r.status_code == 500
    assert r.json() == {"error": "internal_error", "message": "An unexpected error occurred."}
    assert "secret" not in r.text and "Traceback" not in r.text


def test_cors_allows_local_frontend(client):
    r = client.get("/api/health", headers={"Origin": "http://localhost:3010"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3010"
    pre = client.options("/api/board", headers={"Origin": "http://127.0.0.1:3002",
                                                "Access-Control-Request-Method": "PUT"})
    assert pre.headers.get("access-control-allow-origin") == "http://127.0.0.1:3002"


def test_cors_rejects_foreign_origin(client):
    r = client.get("/api/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in r.headers
