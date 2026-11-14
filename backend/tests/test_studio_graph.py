"""Task 1: road graph loader and nearest_node."""
from __future__ import annotations

from app.studio.graph import load_graph, nearest_node


def test_graph_meets_size_floor():
    g = load_graph()
    assert len(g.nodes) >= 40
    assert len(g.edges) >= 80


def test_nearest_node_hits_known_hub():
    g = load_graph()
    # Ontario warehouse vicinity
    n = nearest_node(g, 34.03, -117.59, max_km=3)
    assert n is not None
    assert n.id.startswith("ONT") or abs(n.lat - 34.03) < 0.05


def test_nearest_node_rejects_pacific():
    g = load_graph()
    assert nearest_node(g, 33.5, -120.5, max_km=3) is None
