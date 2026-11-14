"""Three distinct graph solvers for Route studio."""
from __future__ import annotations

import heapq
from dataclasses import dataclass, field

from app.studio.graph import (
    RoadGraph,
    StudioObstacle,
    edge_obstacle_fraction,
    hav_m,
    path_geometry,
)

# Penalties from the plan
PENALTY = {
    "traffic": 0.35,
    "wildfire": 2.0,
    "flood": 2.0,
    "road_closure": 5.0,
}


@dataclass
class PathResult:
    node_ids: list[str]
    edge_ids: list[str]
    travel_s: float
    length_m: float
    geometry: list[list[float]]
    feasible: bool
    algorithm: str
    reason: str | None = None
    local_street_m: float = 0.0
    exposure: float = 0.0


def _blocked(g: RoadGraph, e, obstacles: list[StudioObstacle], hard_only: bool) -> bool:
    for o in obstacles:
        frac = edge_obstacle_fraction(g, e, o)
        if hard_only:
            if o.type in ("road_closure", "wildfire", "flood") and o.confidence >= 0.8 and frac >= 0.999:
                return True
        else:
            if o.type == "road_closure" and frac > 0.5:
                return True
    return False


def _edge_penalty(g: RoadGraph, e, obstacles: list[StudioObstacle], scale: float = 1.0) -> float:
    pen = 0.0
    for o in obstacles:
        frac = edge_obstacle_fraction(g, e, o)
        if frac <= 0:
            continue
        mult = PENALTY.get(o.type, 1.0) * scale
        if o.type == "road_closure" and frac > 0.5:
            return 1e12  # impassable for avoid solver
        pen += mult * e.travel_s * frac
    return pen


def _exposure(g: RoadGraph, edge_ids: list[str], obstacles: list[StudioObstacle]) -> float:
    if not edge_ids or not obstacles:
        return 0.0
    by_id = {e.id: e for e in g.edges}
    total = 0.0
    hit = 0.0
    for eid in edge_ids:
        e = by_id[eid]
        total += e.length_m
        frac = max((edge_obstacle_fraction(g, e, o) for o in obstacles), default=0.0)
        hit += e.length_m * frac
    return 0.0 if total <= 0 else min(1.0, hit / total)


def _reconstruct(prev: dict, prev_e: dict, dst: str) -> tuple[list[str], list[str]]:
    nodes: list[str] = []
    edges: list[str] = []
    cur: str | None = dst
    while cur is not None:
        nodes.append(cur)
        eid = prev_e.get(cur)
        if eid:
            edges.append(eid)
        cur = prev.get(cur)
    nodes.reverse()
    edges.reverse()
    return nodes, edges


def _finish(
    g: RoadGraph,
    algorithm: str,
    node_ids: list[str],
    edge_ids: list[str],
    obstacles: list[StudioObstacle],
    feasible: bool,
    reason: str | None = None,
) -> PathResult:
    by_id = {e.id: e for e in g.edges}
    travel = sum(by_id[e].travel_s for e in edge_ids)
    length = sum(by_id[e].length_m for e in edge_ids)
    local = sum(by_id[e].length_m for e in edge_ids if not by_id[e].hwy)
    return PathResult(
        node_ids=node_ids,
        edge_ids=edge_ids,
        travel_s=travel,
        length_m=length,
        geometry=path_geometry(g, node_ids) if node_ids else [],
        feasible=feasible,
        algorithm=algorithm,
        reason=reason,
        local_street_m=local,
        exposure=_exposure(g, edge_ids, obstacles),
    )


def dijkstra_time(
    g: RoadGraph, src: str, dst: str, obstacles: list[StudioObstacle]
) -> PathResult:
    if src not in g.nodes or dst not in g.nodes:
        return _finish(g, "dijkstra_time", [], [], obstacles, False, "unreachable")
    dist: dict[str, float] = {src: 0.0}
    prev: dict[str, str | None] = {src: None}
    prev_e: dict[str, str] = {}
    pq: list[tuple[float, str]] = [(0.0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == dst:
            break
        if d > dist.get(u, 1e18):
            continue
        for e in g.out.get(u, []):
            if _blocked(g, e, obstacles, hard_only=True):
                continue
            nd = d + e.travel_s
            if nd < dist.get(e.v, 1e18):
                dist[e.v] = nd
                prev[e.v] = u
                prev_e[e.v] = e.id
                heapq.heappush(pq, (nd, e.v))
    if dst not in dist:
        return _finish(g, "dijkstra_time", [], [], obstacles, False, "unreachable")
    nodes, edges = _reconstruct(prev, prev_e, dst)
    return _finish(g, "dijkstra_time", nodes, edges, obstacles, True)


def astar_distance(
    g: RoadGraph, src: str, dst: str, obstacles: list[StudioObstacle]
) -> PathResult:
    if src not in g.nodes or dst not in g.nodes:
        return _finish(g, "astar_distance", [], [], obstacles, False, "unreachable")
    goal = g.nodes[dst]
    gscore: dict[str, float] = {src: 0.0}
    prev: dict[str, str | None] = {src: None}
    prev_e: dict[str, str] = {}
    h0 = hav_m((g.nodes[src].lat, g.nodes[src].lng), (goal.lat, goal.lng))
    pq: list[tuple[float, str]] = [(h0, src)]
    closed: set[str] = set()
    while pq:
        _, u = heapq.heappop(pq)
        if u in closed:
            continue
        if u == dst:
            break
        closed.add(u)
        for e in g.out.get(u, []):
            if _blocked(g, e, obstacles, hard_only=True):
                continue
            ng = gscore[u] + e.length_m
            if ng < gscore.get(e.v, 1e18):
                gscore[e.v] = ng
                prev[e.v] = u
                prev_e[e.v] = e.id
                h = hav_m((g.nodes[e.v].lat, g.nodes[e.v].lng), (goal.lat, goal.lng))
                heapq.heappush(pq, (ng + h, e.v))
    if dst not in gscore:
        return _finish(g, "astar_distance", [], [], obstacles, False, "unreachable")
    nodes, edges = _reconstruct(prev, prev_e, dst)
    return _finish(g, "astar_distance", nodes, edges, obstacles, True)


def dijkstra_avoid(
    g: RoadGraph,
    src: str,
    dst: str,
    obstacles: list[StudioObstacle],
    penalty_scale: float = 1.0,
) -> PathResult:
    if src not in g.nodes or dst not in g.nodes:
        return _finish(g, "dijkstra_avoid", [], [], obstacles, False, "unreachable")
    dist: dict[str, float] = {src: 0.0}
    prev: dict[str, str | None] = {src: None}
    prev_e: dict[str, str] = {}
    pq: list[tuple[float, str]] = [(0.0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == dst:
            break
        if d > dist.get(u, 1e18):
            continue
        for e in g.out.get(u, []):
            pen = _edge_penalty(g, e, obstacles, scale=penalty_scale)
            if pen >= 1e12:
                continue
            nd = d + e.travel_s + pen
            if nd < dist.get(e.v, 1e18):
                dist[e.v] = nd
                prev[e.v] = u
                prev_e[e.v] = e.id
                heapq.heappush(pq, (nd, e.v))
    if dst not in dist:
        return _finish(g, "dijkstra_avoid", [], [], obstacles, False, "unreachable")
    nodes, edges = _reconstruct(prev, prev_e, dst)
    return _finish(g, "dijkstra_avoid", nodes, edges, obstacles, True)


def geometry_jaccard(a: list[list[float]], b: list[list[float]], buckets: int = 40) -> float:
    def sig(geom: list[list[float]]) -> set[str]:
        if not geom:
            return set()
        s: set[str] = set()
        step = max(1, len(geom) // buckets)
        for i in range(0, len(geom), step):
            lat, lng = geom[i]
            s.add(f"{lat * 50:.0f},{lng * 50:.0f}")
        return s

    sa, sb = sig(a), sig(b)
    if not sa and not sb:
        return 1.0
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)
