"""Bundled SoCal road graph: load, nearest node/edge, obstacle geometry helpers."""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "data" / "road_graph.json"
R_M = 6371000.0


@dataclass(frozen=True)
class Node:
    id: str
    lat: float
    lng: float
    kind: str = "junction"


@dataclass(frozen=True)
class Edge:
    id: str
    u: str
    v: str
    length_m: float
    travel_s: float
    hwy: bool


@dataclass
class RoadGraph:
    nodes: dict[str, Node]
    edges: list[Edge]
    out: dict[str, list[Edge]] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.out:
            adj: dict[str, list[Edge]] = {nid: [] for nid in self.nodes}
            for e in self.edges:
                adj.setdefault(e.u, []).append(e)
            self.out = adj


@dataclass(frozen=True)
class StudioObstacle:
    id: str
    type: str  # road_closure | wildfire | flood | traffic
    lat: float
    lng: float
    radius_km: float
    confidence: float = 0.7


def hav_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    la1, lo1 = a
    la2, lo2 = b
    p = math.pi / 180
    dla = (la2 - la1) * p
    dlo = (lo2 - lo1) * p
    x = math.sin(dla / 2) ** 2 + math.cos(la1 * p) * math.cos(la2 * p) * math.sin(dlo / 2) ** 2
    return 2 * R_M * math.asin(min(1.0, math.sqrt(x)))


def _closest_on_seg(
    p: tuple[float, float], a: tuple[float, float], b: tuple[float, float]
) -> tuple[tuple[float, float], float]:
    """Return (closest point, distance_m) from p to segment a→b."""
    k = math.cos(p[0] * math.pi / 180)
    m = 111320.0
    px, py = p[1] * k * m, p[0] * m
    ax, ay = a[1] * k * m, a[0] * m
    bx, by = b[1] * k * m, b[0] * m
    dx, dy = bx - ax, by - ay
    L = dx * dx + dy * dy
    t = 0.0 if L == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L))
    cx, cy = ax + t * dx, ay + t * dy
    return (cy / m, cx / (k * m)), math.hypot(px - cx, py - cy)


@lru_cache(maxsize=1)
def load_graph() -> RoadGraph:
    raw = json.loads(DATA.read_text())
    nodes = {
        n["id"]: Node(id=n["id"], lat=float(n["lat"]), lng=float(n["lng"]), kind=n.get("kind", "junction"))
        for n in raw["nodes"]
    }
    edges = [
        Edge(
            id=e["id"],
            u=e["u"],
            v=e["v"],
            length_m=float(e["length_m"]),
            travel_s=float(e["travel_s"]),
            hwy=bool(e["hwy"]),
        )
        for e in raw["edges"]
    ]
    return RoadGraph(nodes=nodes, edges=edges)


def nearest_node(g: RoadGraph, lat: float, lng: float, max_km: float = 3.0) -> Node | None:
    best: Node | None = None
    best_d = max_km * 1000.0
    p = (lat, lng)
    for n in g.nodes.values():
        d = hav_m(p, (n.lat, n.lng))
        if d <= best_d:
            best_d = d
            best = n
    return best


def nearest_edge_point(
    g: RoadGraph, lat: float, lng: float, max_km: float = 2.0
) -> tuple[Edge, tuple[float, float], float] | None:
    """Nearest point on any edge; returns (edge, snapped_latlng, dist_m)."""
    best: tuple[Edge, tuple[float, float], float] | None = None
    limit = max_km * 1000.0
    p = (lat, lng)
    for e in g.edges:
        a = g.nodes[e.u]
        b = g.nodes[e.v]
        c, d = _closest_on_seg(p, (a.lat, a.lng), (b.lat, b.lng))
        if d <= limit and (best is None or d < best[2]):
            best = (e, c, d)
    return best


def edge_endpoints(g: RoadGraph, e: Edge) -> tuple[tuple[float, float], tuple[float, float]]:
    u, v = g.nodes[e.u], g.nodes[e.v]
    return (u.lat, u.lng), (v.lat, v.lng)


def edge_obstacle_fraction(g: RoadGraph, e: Edge, obs: StudioObstacle) -> float:
    """Approx fraction of edge length inside obstacle circle (0..1)."""
    a, b = edge_endpoints(g, e)
    # sample 8 points along the edge
    hits = 0
    samples = 8
    for i in range(samples + 1):
        t = i / samples
        lat = a[0] + t * (b[0] - a[0])
        lng = a[1] + t * (b[1] - a[1])
        if hav_m((lat, lng), (obs.lat, obs.lng)) <= obs.radius_km * 1000.0:
            hits += 1
    return hits / (samples + 1)


def path_geometry(g: RoadGraph, node_ids: list[str]) -> list[list[float]]:
    return [[g.nodes[nid].lat, g.nodes[nid].lng] for nid in node_ids]
