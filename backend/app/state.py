"""In-memory store, rebuilt from backend/data/*.json at start and on reset (ADR-002)."""
from __future__ import annotations

import copy
import json
import threading
from pathlib import Path

from app.engine.constants import DEFAULT_CLOCK_MIN, DEFAULT_WEIGHTS
from app.engine.geo import prepare_route

DATA = Path(__file__).resolve().parent.parent / "data"


def _load(name: str):
    return json.loads((DATA / f"{name}.json").read_text())


class World:
    """Immutable fixed data the engine reads."""

    def __init__(self, network: dict, shipments: list[dict], routes: list[dict]):
        self.network = network
        self.terminals = {t["id"]: t for t in network["terminals"]}
        self.warehouses = {w["id"]: w for w in network["warehouses"]}
        self.trucks = {t["id"]: t for t in network["trucks"]}
        self.places = network["sensitive_places"]
        self.shipments = shipments
        self.shipments_by_id = {s["id"]: s for s in shipments}
        self.routes = {r["id"]: prepare_route(r) for r in routes}
        self.routes_by_pair: dict[str, list] = {}
        for r in self.routes.values():
            self.routes_by_pair.setdefault(r.pair, []).append(r)
        for lst in self.routes_by_pair.values():
            lst.sort(key=lambda r: int(r.id.rsplit("-", 1)[1]))

    def pair_of(self, shipment: dict) -> str:
        return f"{shipment['terminal_id']}>{shipment['warehouse_id']}"

    def original_route_id(self, shipment: dict) -> str:
        return self.routes_by_pair[self.pair_of(shipment)][0].id


class Store:
    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.network = _load("network")
        self.shipments = _load("shipments")
        self.presets = _load("presets")
        self.world = World(self.network, self.shipments, _load("routes")["routes"])
        self.routes = self.world.routes
        self.routes_by_pair = self.world.routes_by_pair
        self.reset()

    def reset(self) -> None:
        with self.lock:
            self.settings = {"clock_min": DEFAULT_CLOCK_MIN, "weights": dict(DEFAULT_WEIGHTS)}
            self.disruptions: list[dict] = []
            self.plans: dict = {}  # shipment_id -> Plan in force when a decision exists
            self.decisions: list[dict] = []
            self.next_disruption = 1
            self.next_decision = 1

    def snapshot_settings(self) -> dict:
        return copy.deepcopy(self.settings)


store = Store()
