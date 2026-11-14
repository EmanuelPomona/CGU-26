"""Metrics and tradeoff copy for studio alternatives."""
from __future__ import annotations

from app.studio.algorithms import (
    PathResult,
    astar_distance,
    dijkstra_avoid,
    dijkstra_time,
    geometry_jaccard,
)
from app.studio.graph import RoadGraph, StudioObstacle

CO2_PER_MI = 1.75  # kg/mi loaded estimate (aligned with product model)


def _metrics(r: PathResult) -> dict:
    miles = r.length_m / 1609.344
    return {
        "eta_min": round(r.travel_s / 60.0, 1),
        "distance_km": round(r.length_m / 1000.0, 2),
        "co2_kg": round(miles * CO2_PER_MI, 1),
        "obstacle_exposure": round(r.exposure, 3),
        "local_street_km": round(r.local_street_m / 1000.0, 2),
    }


def build_alternative(
    slot: str,
    result: PathResult,
    obstacles: list[StudioObstacle],
    baseline: PathResult | None,
) -> dict:
    labels = {"fastest": "Fastest", "direct": "Direct", "avoid": "Avoid hazards"}
    label = labels[slot]
    m = _metrics(result) if result.feasible else {
        "eta_min": 0.0,
        "distance_km": 0.0,
        "co2_kg": 0.0,
        "obstacle_exposure": 0.0,
        "local_street_km": 0.0,
    }
    if not result.feasible:
        return {
            "id": f"{slot}:{result.algorithm}",
            "slot": slot,
            "algorithm": result.algorithm,
            "label": label,
            "feasible": False,
            "infeasible_reason": result.reason or "unreachable",
            "summary": f"{label} could not find a path on the road graph.",
            "pros": ["Does not invent a route when none exists."],
            "cons": ["Unavailable for this origin, destination, and obstacles."],
            "metrics": m,
            "geometry": [],
            "node_ids": [],
        }

    pros: list[str] = []
    cons: list[str] = []
    if slot == "fastest":
        pros.append(f"Lowest expected drive time among solvers (~{m['eta_min']} min).")
        pros.append("Uses classic Dijkstra on travel time.")
        if m["obstacle_exposure"] > 0.15:
            cons.append(f"Crosses obstacle zones (exposure {m['obstacle_exposure']:.0%}).")
        else:
            cons.append("May ignore longer but safer corridors.")
        if baseline and baseline.feasible and result.length_m > baseline.length_m * 1.05:
            cons.append("Not the shortest road distance.")
        else:
            cons.append("Optimizes time, not community or emissions.")
    elif slot == "direct":
        pros.append(f"Shortest road distance via A* (~{m['distance_km']} km).")
        pros.append("Geographic heuristic pulls toward the destination.")
        if baseline and baseline.feasible and result.travel_s > baseline.travel_s * 1.05:
            cons.append(f"Slower ETA than Fastest (+{(result.travel_s - baseline.travel_s)/60:.0f} min).")
        else:
            cons.append("Distance-optimal path can still hit congestion.")
        if m["obstacle_exposure"] > 0.15:
            cons.append(f"Still exposed to obstacles ({m['obstacle_exposure']:.0%}).")
        else:
            cons.append("Does not explicitly penalize hazard buffers.")
    else:
        pros.append("Penalizes edges that intersect obstacle buffers.")
        if baseline and baseline.feasible:
            delta = (result.travel_s - baseline.travel_s) / 60.0
            if m["obstacle_exposure"] + 1e-9 < _metrics(baseline)["obstacle_exposure"]:
                pros.append(f"Lower obstacle exposure than Fastest ({m['obstacle_exposure']:.0%}).")
            else:
                pros.append("Searches for a safer corridor when one exists.")
            cons.append(f"Usually slower than Fastest (+{max(0, delta):.0f} min)." if delta > 0.5 else "May still share corridors when the network is thin.")
        else:
            pros.append("Balances time against hazard proximity.")
            cons.append("Can add miles when avoiding closures.")
        cons.append("Soft penalties — extreme closures may still force long detours.")

    pros = pros[:2]
    cons = cons[:2]
    summary = {
        "fastest": f"Dijkstra on travel time · {m['eta_min']} min · {m['distance_km']} km.",
        "direct": f"A* on road distance · {m['distance_km']} km · {m['eta_min']} min.",
        "avoid": f"Obstacle-penalized Dijkstra · exposure {m['obstacle_exposure']:.0%} · {m['eta_min']} min.",
    }[slot]

    return {
        "id": f"{slot}:{result.algorithm}",
        "slot": slot,
        "algorithm": result.algorithm,
        "label": label,
        "feasible": True,
        "infeasible_reason": None,
        "summary": summary,
        "pros": pros,
        "cons": cons,
        "metrics": m,
        "geometry": result.geometry,
        "node_ids": result.node_ids,
    }


def solve_three(
    g: RoadGraph, src: str, dst: str, obstacles: list[StudioObstacle]
) -> list[dict]:
    fastest = dijkstra_time(g, src, dst, obstacles)
    direct = astar_distance(g, src, dst, obstacles)
    avoid = dijkstra_avoid(g, src, dst, obstacles, penalty_scale=1.0)

    if (
        fastest.feasible
        and avoid.feasible
        and geometry_jaccard(fastest.geometry, avoid.geometry) > 0.92
    ):
        avoid2 = dijkstra_avoid(g, src, dst, obstacles, penalty_scale=1.5)
        if avoid2.feasible and geometry_jaccard(fastest.geometry, avoid2.geometry) <= 0.92:
            avoid = avoid2
        else:
            avoid = PathResult(
                node_ids=[],
                edge_ids=[],
                travel_s=0.0,
                length_m=0.0,
                geometry=[],
                feasible=False,
                algorithm="dijkstra_avoid",
                reason="no_distinct_avoidance_path",
            )

    baseline = fastest
    alts = [
        build_alternative("fastest", fastest, obstacles, baseline),
        build_alternative("direct", direct, obstacles, baseline),
        build_alternative("avoid", avoid, obstacles, baseline),
    ]
    return alts
