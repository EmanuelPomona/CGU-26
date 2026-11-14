---
id: TASK-003
title: Disruption lifecycle and verification
status: READY
owner: backend
branch: agent/backend
priority: HIGH
round: 0
depends_on: [TASK-002]
blocked_on: ""
---

# TASK-003 — Disruption lifecycle and verification

## Objective

Implement `GET/POST /api/disruptions`, `PATCH` and `DELETE
/api/disruptions/{id}` with per-kind validation, verification states, and the
computed `affected_shipment_ids`.

## Scope

- `backend/app/routers/disruptions.py`
- `backend/tests/test_disruptions.py`

## Acceptance Criteria

- [ ] Every created disruption has `verification: "unverified"`, id `D-<n>` counting from 1 after reset, a generated `label` when none is given, and appears last in `board.disruptions`; response is 201 and passes `assert_matches("Board", ...)`.
- [ ] Missing companion field for the kind returns 422 naming it: slowdown without `slowdown_factor`, closure without `area`, pickup_delay without `delay_min`, truck_out with empty `truck_ids`, dock_cut without `capacity_cut`.
- [ ] Unknown `shipment_id`, `warehouse_id` or any unknown truck id in the body returns 422 naming the field (not 404).
- [ ] Out-of-range values return 422: `radius_km` 0.1, `confidence` 0, `slowdown_factor` 9, area far outside Southern California.
- [ ] `affected_shipment_ids` lists shipments whose original plan the disruption touches: route crossing the circle; the delayed shipment; shipments assigned an out truck; shipments bound for the cut warehouse. It is still populated after dismissal.
- [ ] Each of the 7 presets, POSTed unchanged, is accepted. `close60` and `slow710` each affect at least one shipment (if not, report it as a CONTRACT CHANGE REQUEST with proposed coordinates rather than editing the preset silently).
- [ ] After `close60` then PATCH `confirmed`: at least two of `shipments_at_risk`, `total_late_min`, `fleet_miles`, `co2_kg`, `cost_usd` differ between `indicators.normal` and `indicators.changed` (acceptance P-3). After PATCH `dismissed`: `indicators.changed == indicators.normal` and the disruption is still listed (P-4).
- [ ] PATCH and DELETE on an unknown id return 404 `not_found`. PATCH stores `note`.
- [ ] Posting the same preset twice creates two disruptions and does not crash or double-count a closure's block probability beyond 1.

## Notes

Read `docs/API.md` and `docs/openapi.yaml` first; they are the contract. Commit after each passing step (protocol section 24).

- Consumes `conditions_from`, `build_board`, `store` from TASK-001/002.
- Fields that do not belong to the kind are ignored on input and null (or `[]` for `truck_ids`) on output.

## Review History

| Round | Verdict | Summary |
|---|---|---|
