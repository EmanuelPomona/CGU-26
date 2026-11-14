---
id: TASK-106
title: SUPERSEDED by TASK-107 (Priority weights clock and feed scout)
status: BACKLOG
owner: frontend
branch: agent/frontend
priority: LOW
round: 0
depends_on: [TASK-105]
blocked_on: ""
---

# TASK-106 — Priority weights clock and feed scout

## Objective

**Superseded.** The owner replaced this UI with the Dispatch mockup (ADR-007). Do not build this. See TASK-107.

Nice-to-have controls, only after TASK-101..105 are in REVIEW: priority weights
and dispatch clock (`PUT /api/settings`), and a scout panel listing
`GET /api/feeds/candidates` with an "Add as unverified" action.

## Scope

- `frontend/src/components/Priorities.tsx`, `Scout.tsx`, and their CSS

## Acceptance Criteria

- [ ] Five weight sliders (reliability, cost, emissions, community, driver) with numeric values, the caption "Moves the suggestion, not the facts", debounced PUT, and an inline error if all are zero.
- [ ] A dispatch clock control (6:00 AM to 6:00 PM, 15-minute steps) updates the board.
- [ ] The scout lists candidates with source, trust wording ("Official report", "Automated detection") and distance to the nearest route, states plainly that a report does not prove a road is blocked or open, and adds one only on click, as unverified.
- [ ] When a source is down its row says so; with no candidates the panel shows an empty state.

## Notes

Read `docs/DESIGN_BRIEF.md`, `docs/DESIGN_CONSTRAINTS.md`, `docs/API.md` and `docs/openapi.yaml` first. Run the mandatory design skills in `docs/SKILL_ROUTING.md` before major UI. Commit after each passing step (protocol section 24).

## Review History

| Round | Verdict | Summary |
|---|---|---|
