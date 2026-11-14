"""TASK-005: live feed candidates. Recorded fixtures only; the network is never touched."""
import time
from pathlib import Path

import pytest

from app import feeds
from tests.contract import assert_matches

FIX = Path(__file__).parent / "fixtures"
CHP = (FIX / "chp_sa.xml").read_text()
NWS = (FIX / "nws_alerts.json").read_text()


def recorded(url, timeout):
    if "chp" in url:
        return CHP
    if "weather.gov" in url:
        return NWS
    raise AssertionError(url)


@pytest.fixture
def feed(monkeypatch):
    calls = []

    def fake(url, timeout):
        calls.append(url)
        return recorded(url, timeout)
    monkeypatch.setattr(feeds, "FETCH", fake)
    feeds.clear_cache()
    yield calls
    feeds.clear_cache()


def get(client):
    r = client.get("/api/feeds/candidates")
    assert r.status_code == 200
    assert_matches("FeedCandidates", r.json())
    return r.json()


def test_candidates_near_routes_only(client, feed):
    j = get(client)
    assert {s["name"]: s["ok"] for s in j["sources"]} == {"CHP incidents": True, "NWS alerts": True}
    ids = [c["id"] for c in j["candidates"]]
    assert "chp-260114LA0001" in ids               # on I-110, on C-101's route
    assert "chp-260114LA0002" not in ids           # Newhall, far from every route
    assert "chp-260114LA0003" not in ids           # outside Southern California
    assert "chp-260114LA0004" not in ids           # not a road incident type
    c = next(c for c in j["candidates"] if c["id"] == "chp-260114LA0001")
    assert c["distance_to_route_mi"] <= 2 and "C-101" in c["near_shipment_ids"]
    assert c["trust"] == "official_report" and c["source_name"] == "CHP incidents"
    for c in j["candidates"]:
        assert c["distance_to_route_mi"] <= 2
        assert c["trust"] == "official_report"


def test_suggested_body_is_postable_unchanged_and_endpoint_adds_nothing(client, feed):
    before = client.get("/api/board").json()
    j = get(client)
    assert j["candidates"]
    assert client.get("/api/board").json() == before
    for c in j["candidates"]:
        s = c["suggested"]
        assert s["source"] == "public_feed" and s["confidence"] <= 0.7
        r = client.post("/api/disruptions", json=s)
        assert r.status_code == 201, r.text
        assert r.json()["disruptions"][-1]["verification"] == "unverified"


def test_results_are_cached_for_60_seconds(client, feed, monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(feeds, "now", lambda: now[0])
    get(client)
    n = len(feed)
    get(client)
    assert len(feed) == n
    now[0] += 61
    get(client)
    assert len(feed) == 2 * n


def test_no_network_answers_200_with_sources_down(client, monkeypatch):
    def down(url, timeout):
        raise OSError("network unreachable")
    monkeypatch.setattr(feeds, "FETCH", down)
    feeds.clear_cache()
    t = time.monotonic()
    j = get(client)
    assert time.monotonic() - t < 6
    assert j["candidates"] == []
    assert all(not s["ok"] and s["error"] for s in j["sources"])
    feeds.clear_cache()


def test_hanging_source_is_cut_off_within_budget(client, monkeypatch):
    def hang(url, timeout):
        time.sleep(3)
        return recorded(url, timeout)
    monkeypatch.setattr(feeds, "FETCH", hang)
    monkeypatch.setattr(feeds, "BUDGET_S", 0.5)
    feeds.clear_cache()
    t = time.monotonic()
    j = get(client)
    assert time.monotonic() - t < 1.5
    assert all(not s["ok"] and "timed out" in s["error"] for s in j["sources"])
    feeds.clear_cache()


def test_malformed_payload_reports_source_error(client, monkeypatch):
    monkeypatch.setattr(feeds, "FETCH", lambda url, timeout: "not xml or json {")
    feeds.clear_cache()
    j = get(client)
    nws = next(s for s in j["sources"] if s["name"] == "NWS alerts")
    assert not nws["ok"] and nws["error"]
    feeds.clear_cache()
