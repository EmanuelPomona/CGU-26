"""Orchestrate studio sessions: OD snap + three-way solve."""
from __future__ import annotations

import uuid
from typing import Any

from app.errors import not_found, validation
from app.studio.graph import StudioObstacle, load_graph, nearest_edge_point, nearest_node
from app.studio import state as sessions
from app.studio.tradeoffs import solve_three
from app.state import store

OBSTACLE_DEFAULTS = {
    "road_closure": {"radius_km": 2.0, "confidence": 0.8, "label": "Road closure"},
    "wildfire": {"radius_km": 5.0, "confidence": 0.6, "label": "Wildfire"},
    "flood": {"radius_km": 3.0, "confidence": 0.5, "label": "Flood"},
    "traffic": {"radius_km": 4.0, "confidence": 0.7, "label": "Traffic slowdown"},
}


def _public(session: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": session["id"],
        "truck_id": session["truck_id"],
        "origin": session["origin"],
        "destination": session["destination"],
        "baseline": session["baseline"],
        "alternatives": session["alternatives"],
        "obstacles": session["obstacles"],
    }


def _solve(session: dict[str, Any]) -> None:
    g = load_graph()
    obs = [
        StudioObstacle(
            id=o["id"],
            type=o["type"],
            lat=o["lat"],
            lng=o["lng"],
            radius_km=o["radius_km"],
            confidence=o["confidence"],
        )
        for o in session["obstacles"]
    ]
    alts = solve_three(g, session["origin"]["node_id"], session["destination"]["node_id"], obs)
    session["alternatives"] = alts
    # baseline = fastest with no obstacles at session create; keep first solve's fastest as baseline snapshot
    if session.get("baseline") is None:
        empty = solve_three(g, session["origin"]["node_id"], session["destination"]["node_id"], [])
        session["baseline"] = empty[0]


def create_session(truck_id: str, dest_lat: float, dest_lng: float) -> dict[str, Any]:
    if truck_id not in store.world.trucks:
        raise validation(f"Unknown truck_id {truck_id!r}.", "truck_id")
    truck = store.world.trucks[truck_id]
    g = load_graph()
    # Prefer dedicated truck node if present
    trk_node = g.nodes.get(f"TRK_{truck_id}")
    origin_node = trk_node or nearest_node(g, float(truck["lat"]), float(truck["lng"]), max_km=10)
    if origin_node is None:
        raise validation("Could not snap the truck to the road network.", "truck_id")
    dest_node = nearest_node(g, dest_lat, dest_lng, max_km=3)
    if dest_node is None:
        raise validation("Pick a place on the road network.", "destination")

    sid = f"S-{uuid.uuid4().hex[:8]}"
    session: dict[str, Any] = {
        "id": sid,
        "truck_id": truck_id,
        "origin": {
            "lat": origin_node.lat,
            "lng": origin_node.lng,
            "node_id": origin_node.id,
            "truck_id": truck_id,
            "label": truck.get("driver_label", truck_id),
        },
        "destination": {
            "lat": dest_node.lat,
            "lng": dest_node.lng,
            "node_id": dest_node.id,
        },
        "obstacles": [],
        "baseline": None,
        "alternatives": [],
    }
    _solve(session)
    # After first solve with no obstacles, baseline = fastest
    session["baseline"] = session["alternatives"][0]
    sessions.put(sid, session)
    return _public(session)


def get_session(sid: str) -> dict[str, Any]:
    s = sessions.get(sid)
    if not s:
        raise not_found(f"Unknown studio session {sid!r}.")
    return _public(s)


def add_obstacle(sid: str, otype: str, lat: float, lng: float) -> dict[str, Any]:
    s = sessions.get(sid)
    if not s:
        raise not_found(f"Unknown studio session {sid!r}.")
    if otype not in OBSTACLE_DEFAULTS:
        raise validation(f"Unknown obstacle type {otype!r}.", "type")
    g = load_graph()
    snap = nearest_edge_point(g, lat, lng, max_km=2)
    if snap is None:
        raise validation("Drop near the route or a road.", "lat")
    _, (slat, slng), _ = snap
    d = OBSTACLE_DEFAULTS[otype]
    oid = f"SO-{len(s['obstacles']) + 1}"
    s["obstacles"].append(
        {
            "id": oid,
            "type": otype,
            "label": d["label"],
            "lat": slat,
            "lng": slng,
            "radius_km": d["radius_km"],
            "confidence": d["confidence"],
        }
    )
    _solve(s)
    sessions.put(sid, s)
    return _public(s)


def remove_obstacle(sid: str, oid: str) -> dict[str, Any]:
    s = sessions.get(sid)
    if not s:
        raise not_found(f"Unknown studio session {sid!r}.")
    before = len(s["obstacles"])
    s["obstacles"] = [o for o in s["obstacles"] if o["id"] != oid]
    if len(s["obstacles"]) == before:
        raise not_found(f"Unknown obstacle {oid!r}.")
    _solve(s)
    sessions.put(sid, s)
    return _public(s)
