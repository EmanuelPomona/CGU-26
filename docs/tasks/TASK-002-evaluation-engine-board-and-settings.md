---
id: TASK-002
title: Evaluation engine board and settings
status: REVIEW
owner: backend
branch: agent/backend
priority: HIGH
round: 0
depends_on: [TASK-001]
blocked_on: ""
---

# TASK-002 — Evaluation engine board and settings

## Objective

Port the evaluation model to pure Python functions, test-first, and serve
`GET /api/board` and `PUT /api/settings` from it. The model is specified in
`docs/API.md` under "Evaluation model (normative)"; the reference functions are
`hav`, `distPtSeg`, `exposure`, `recvExposure`, `community`, `trafficMult`,
`Phi`, `evalPlan`, `summarize`.

## Scope

- `backend/app/engine/constants.py`, `geo.py`, `evaluate.py`
- `backend/app/routers/board.py`
- `backend/tests/test_geo.py`, `test_evaluate.py`, `test_board.py`

## Acceptance Criteria

- [ ] `evaluate.evaluate(shipment, plan, conditions, data, clock_min) -> Evaluation` is pure: no globals, no I/O, no clock reads; calling it twice with the same arguments returns equal results.
- [ ] `evaluate.conditions_from(disruptions) -> Conditions` ignores `dismissed`, treats `confirmed` closures and hazards as confidence 1.0, and keeps `unverified` at their stated confidence.
- [ ] Tests (written before the code) cover, with hand-computed expected values: haversine and point-to-segment distance; traffic multiplier at 7:30 vs 12:00; a slowdown touching a route adds (time inside) x (factor - 1) and one not touching adds nothing; a confirmed closure on the route makes status `at_risk`; the same closure dismissed gives an evaluation equal to normal; unverified sets `needs_review` true and adds a flag, confirmed does not; `pickup_delay` moves pickup only when the truck would otherwise arrive before the new ready time; `truck_out` on the assigned truck gives late 180, probability 0.05, `truck_id` null; `dock_cut` 0.5 adds 45 minutes; driver hours over the limit sets `driver_hours_over` > 0; status thresholds at probability 0.5 and 0.85 and slack 15.
- [ ] `GET /api/board` on a fresh store: 7 shipments in seed order, `normal == changed == current` for each, `indicators.normal == changed == decided`, all checks `triggered: false`, `pending_verification_ids` empty, and the response passes `assert_matches("Board", ...)`.
- [ ] `attention` follows the rule in `docs/API.md` section 2.
- [ ] The four checks are computed as specified, and `added_miles_review.detail` states that 20 miles is an example threshold, not an operating standard.
- [ ] `PUT /api/settings` with all-zero weights returns 422 naming `weights`; with `clock_min` 359 returns 422 naming `clock_min`; a valid body changes `board.settings` and the evaluations.
- [ ] Rounding at the API boundary follows `docs/API.md`; the engine itself keeps full precision.
- [ ] `python3 -m pytest -q` passes; output in the handoff.

## Notes

Read `docs/API.md` and `docs/openapi.yaml` first; they are the contract. Commit after each passing step (protocol section 24).

- Invoke `superpowers:test-driven-development` before writing engine code.
- Produces for later tasks: `Plan(truck_id, route_id, appt_shift_min)`, `Conditions`, `evaluate(...)`, `summarize(evaluations) -> Indicators`, `build_board(store) -> Board`.
- Expect the seed day to contain a mix of `on_time` and `tight` rows and no `at_risk` rows at clock 480. If the port yields `at_risk` on the normal day, that is a porting error or a route-data difference: debug it (`superpowers:systematic-debugging`), do not tune constants. If real routes make it unavoidable, raise a CONTRACT CHANGE REQUEST proposing new appointment windows.
- Local-street miles and the community score need the per-step `highway` flag stored in `routes.json`.

## Review History

| Round | Verdict | Summary |
|---|---|---|
