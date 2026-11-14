---
id: TASK-004
title: Options scoring decisions and supervisor update
status: REVIEW
owner: backend
branch: agent/backend
priority: HIGH
round: 0
depends_on: [TASK-003]
blocked_on: ""
---

# TASK-004 — Options scoring decisions and supervisor update

## Objective

Implement `GET /api/shipments/{id}/options`, `GET/POST /api/decisions`, and
`DELETE /api/decisions/{id}`: option generation, burden statements, rule-based
scoring, the single suggestion with its rationale, applying a chosen plan, the
drafted supervisor update, and undo.

## Scope

- `backend/app/engine/options.py`, `backend/app/engine/scoring.py`, `backend/app/engine/messages.py`
- `backend/app/routers/options.py`, `backend/app/routers/decisions.py`
- `backend/tests/test_options.py`, `test_scoring.py`, `test_decisions.py`

## Acceptance Criteria

- [ ] Options follow reference `buildOptions` with the differences in `docs/API.md` rule 9: `keep` first; up to 2 `reroute`; `spare_truck` when a spare helps or the truck is out or hours are over; `swap_truck` with `collateral` for the other shipment; `reschedule` searching +15..+180 by 15. No `hold` option. Ids exactly `keep`, `reroute:<route_id>`, `spare:<truck_id>`, `swap:<shipment_id>`, `reschedule:<minutes>`.
- [ ] Calling the endpoint twice under the same conditions returns identical ids, order and numbers.
- [ ] `delta` is option minus `keep`; `keep.delta` is all zeros.
- [ ] Scores follow reference `scoreOptions`; an infeasible option is never `suggested`; at most one option is suggested; when every option is infeasible `suggested_option_id` is null and `rationale` says no feasible response was found and the dispatcher should escalate.
- [ ] Changing weights to `{reliability:0,cost:0,emissions:100,community:0,driver:0}` makes the suggested option the feasible one with the lowest `co2_kg`.
- [ ] Burdens: local-street miles or sensitive places produce a `residents` burden; idle >= 20 min or hours over produce `driver`; `reschedule` produces `warehouse` (mentions booked/capacity and the $75 fee); `swap_truck` produces `other_customer`; `keep` with lateness produces `company` (detention). An option crossing an unverified disruption carries the note "Based on an unverified report: confirm before acting."
- [ ] `rationale` and every title, description, burden and note are free of the strings "AI", "optimal", "model predicts" (test asserts this over all presets and shipments).
- [ ] `POST /api/decisions`: suggested option without `reason` returns 201; non-suggested option without `reason` returns 422 naming `reason`; unknown `shipment_id` 404; unknown or infeasible `option_id` 409 `option_infeasible`. Response passes `assert_matches("DecisionResult", ...)`.
- [ ] After a decision, `board.shipments[i].current` reflects the chosen plan, `decision_id` is set, `indicators.decided` differs from `indicators.changed`, and `changed` is untouched. A `swap` decision changes both shipments and fills `also_affects`.
- [ ] A second decision for the same shipment replaces the first (one entry per shipment in force; the log keeps `seq` increasing).
- [ ] `supervisor_update` is multi-line plain text containing the container id, cargo, the action taken, new ETA and window as clock times (e.g. "9:45 AM"), the reason when given, whether inputs were unverified, and the closing line "Drafted by the dispatch tool. Reviewed and sent by the dispatcher." It names no person.
- [ ] `DELETE /api/decisions/{id}` restores the original plan(s); `POST /api/reset` clears everything (acceptance B-4: board equals a fresh start).
- [ ] The full demo flow runs with networking disabled (acceptance B-5); `scripts/contract-test.sh` output is pasted in the handoff.

## Notes

Read `docs/API.md` and `docs/openapi.yaml` first; they are the contract. Commit after each passing step (protocol section 24).

- Invoke `superpowers:test-driven-development` first; then `superpowers:requesting-code-review` and `superpowers:verification-before-completion` before the handoff.
- A truck already committed by another shipment's decision is not offered as a spare.
- Handoff must list the actual affected shipments and suggested option for each preset; the frontend and the demo script use that table.

## Review History

| Round | Verdict | Summary |
|---|---|---|
