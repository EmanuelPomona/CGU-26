"""Adapter from the store to the pure option builder."""
from __future__ import annotations

from dataclasses import dataclass

from app.engine.board import plan_in_force
from app.engine.evaluate import conditions_from


@dataclass
class Ctx:
    store: object

    def __post_init__(self):
        self.world = self.store.world
        self.conditions = conditions_from(self.store.disruptions)
        self.clock = self.store.settings["clock_min"]
        self.weights = dict(self.store.settings["weights"])

    def plan_of(self, shipment):
        return plan_in_force(self.store, shipment)

    def has_decision(self, shipment_id: str) -> bool:
        return shipment_id in self.store.plans

    def committed_trucks(self, shipment_id: str) -> set:
        return {e["plan"].truck_id for sid, e in self.store.plans.items() if sid != shipment_id and e["plan"].truck_id}
