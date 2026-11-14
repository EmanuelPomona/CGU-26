---
id: TASK-006
title: Route roles on options
status: REVIEW
owner: backend
branch: agent/backend
priority: HIGH
round: 0
depends_on: [TASK-004]
blocked_on: ""
---

# TASK-006 — Route roles on options

## Objective

Add the `roles` array to every `Option` returned by
`GET /api/shipments/{id}/options`, as now defined in `docs/openapi.yaml`
(`Option.roles`) and `docs/API.md` section 4. Merge `main` first to get the
updated contract.

## Scope

- `backend/app/engine/options.py` (or a new `backend/app/engine/roles.py`)
- `backend/app/models.py`
- `backend/tests/test_roles.py`

## Acceptance Criteria

- [ ] Among the feasible `keep` and `reroute` options of a shipment: `efficiency` goes to the lowest `eta_min`; `sustainability` to the lowest `co2_kg` and `community` to the highest `community_score`, each among options whose `eta_min` is within 30 minutes of the lowest (sustainability window added 2026-11-14 after backend found the lowest-CO2 route crossing a confirmed closure). Ties go to the option that appears first.
- [ ] Each of the three roles is held by exactly one option whenever at least one feasible keep or reroute option exists; one option may hold two or three roles.
- [ ] `spare_truck`, `swap_truck`, `reschedule` and every infeasible option have `roles: []`. When no keep or reroute option is feasible, every option has `roles: []`.
- [ ] Roles are computed from unrounded engine values and are identical on repeated calls.
- [ ] Tests written first cover: three different winners; one option winning all three; a community candidate excluded by the 30-minute rule; `keep` infeasible (truck out); all infeasible.
- [ ] Every options response for all 7 shipments under no disruption and under each preset passes `assert_matches("OptionsResponse", ...)`.
- [ ] Full pytest passes; output and the commit hash in the handoff (append HANDOFF-3).

## Notes

- Small, isolated change. Invoke `superpowers:test-driven-development` first.
- Tell the manager the commit hash when done; the frontend's TASK-107 consumes it.
- For the handoff, list for each shipment on the normal day which option holds each role, so the demo can pick a truck where the three differ.

## Review History

| Round | Verdict | Summary |
|---|---|---|
