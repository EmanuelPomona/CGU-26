"""Task 2: Dijkstra / A* / avoid solvers and tradeoff builders."""
from __future__ import annotations

from app.studio.algorithms import astar_distance, dijkstra_avoid, dijkstra_time
from app.studio.graph import StudioObstacle, load_graph, nearest_node
from app.studio.tradeoffs import build_alternative, solve_three


def test_empty_obstacles_fastest_and_direct_feasible():
    g = load_graph()
    src = nearest_node(g, 33.7395, -118.278, max_km=5)  # POLA
    dst = nearest_node(g, 34.03, -117.59, max_km=5)  # ONT
    assert src is not None and dst is not None
    a = dijkstra_time(g, src.id, dst.id, [])
    b = astar_distance(g, src.id, dst.id, [])
    assert a.feasible and b.feasible
    assert a.algorithm == "dijkstra_time"
    assert b.algorithm == "astar_distance"


def test_closure_makes_avoid_less_exposed_or_infeasible():
    g = load_graph()
    src = nearest_node(g, 33.7555, -118.2185, max_km=5)
    dst = nearest_node(g, 34.03, -117.59, max_km=5)
    assert src is not None and dst is not None
    # Place a large closure on the mid-corridor hub J_60W
    hub = g.nodes["J_60W"]
    obs = [
        StudioObstacle(
            id="O1", type="road_closure", lat=hub.lat, lng=hub.lng, radius_km=8.0, confidence=0.9
        )
    ]
    alts = solve_three(g, src.id, dst.id, obs)
    assert len(alts) == 3
    by = {a["slot"]: a for a in alts}
    assert by["fastest"]["algorithm"] == "dijkstra_time"
    assert by["direct"]["algorithm"] == "astar_distance"
    assert by["avoid"]["algorithm"] == "dijkstra_avoid"
    # With obstacles, all three stay present; Avoid is kept even when the graph is thin.
    assert set(by) == {"fastest", "direct", "avoid"}
    if by["avoid"]["feasible"] and by["fastest"]["feasible"]:
        assert by["avoid"]["metrics"]["obstacle_exposure"] <= by["fastest"]["metrics"]["obstacle_exposure"] + 1e-9


def test_unreachable_all_infeasible():
    g = load_graph()
    src = next(iter(g.nodes))
    alts = solve_three(g, src, "__missing__", [])
    assert len(alts) == 3
    assert all(not a["feasible"] for a in alts)


def test_build_alternative_has_tradeoff_copy():
    g = load_graph()
    src = nearest_node(g, 33.7395, -118.278, max_km=5)
    dst = nearest_node(g, 34.03, -117.59, max_km=5)
    assert src is not None and dst is not None
    r = dijkstra_time(g, src.id, dst.id, [])
    alt = build_alternative("fastest", r, [], None)
    assert alt["label"] == "Fastest"
    assert alt["summary"]
    assert 1 <= len(alt["pros"]) <= 2
    assert 1 <= len(alt["cons"]) <= 2
