---
id: TASK-105
title: Options decision log and method page
status: READY
owner: frontend
branch: agent/frontend
priority: HIGH
round: 0
depends_on: [TASK-104]
blocked_on: ""
---

# TASK-105 — Options decision log and method page

## Objective

Build the response comparison for a selected shipment (the Nutrition Facts
reference), the decision action with override reason, the supervisor update, the
decision log with undo, and the Method page.

## Scope

- `frontend/src/components/Options.tsx`, `OptionLabel.tsx`, `Options.css`
- `frontend/src/components/DecisionLog.tsx`, `SupervisorUpdate.tsx`
- `frontend/src/components/Method.tsx`, `Method.css`

## Acceptance Criteria

- [ ] Selecting a shipment loads `GET /api/shipments/{id}/options`; options reload whenever the board changes. Loading and error (with retry) states exist. A row with `attention: "none"` shows "No action needed. Arrival is inside the window." above the options rather than hiding them.
- [ ] Each option prints as the same ruled label in the same order: title, appointment strip (compact, same axis as the board), on-time chance, est. arrival and slack, miles (with delta vs keep), est. CO2 (delta), est. cost (delta), community score with `community_detail`, driver hours (and over-limit if any), then "Who bears this" listing burdens by stakeholder word, then notes. Deltas are signed and worded so worse is not shown as good.
- [ ] The suggested option is marked with the word "Suggested" and the server `rationale` is shown once above the list with the line "Rule-based score from your priorities. You decide." It has the same visual weight as other options (acceptance G-5, G-7).
- [ ] Infeasible options are shown, visibly disabled, with `infeasible_reason`; their button cannot be activated.
- [ ] "Choose this response" on the suggested option POSTs immediately; on any other option it first asks for a reason (3 to 300 characters, inline validation, 422 `reason` shown inline), then POSTs.
- [ ] While the POST is in flight all choose buttons are disabled; on 409 the panel says conditions changed and reloads options.
- [ ] After a decision: the supervisor update appears in a read-only block with a working "Copy" button (with confirmation text) and the sentence "The tool does not send anything."; the board row, strip, map route and indicator strip (decided column) update from the returned board.
- [ ] Hovering or focusing an option previews its route on the map (dashed in the action color) without changing the plan.
- [ ] The decision log lists decisions oldest first: clock time, container, option title, "suggested" or "override: <reason>", before and after status words, and an Undo control that calls DELETE and updates the board. Empty state: "No decisions yet."
- [ ] The Method page renders `GET /api/method` in full: assumptions table (label, value, unit, kind word), formulas, data sources with limits, not modeled, and the five responsible-design entries. It contains no hardcoded constants.
- [ ] At 390px options open as a full-height sheet with a sticky choose bar and a close control; focus moves into the sheet and returns to the row on close.
- [ ] Evidence for the handoff (protocol section 22): `docs/review/R-01-desktop-1440.png`, `R-02-tablet-768.png`, `R-03-mobile-390.png`, `R-NN-state-empty.png`, `-error.png`, `-loading.png`, `R-console.txt` for the primary flow, plus `R-10-normal.png` and `R-11-changed.png` for the slide deck (acceptance D-3).

## Notes

Read `docs/DESIGN_BRIEF.md`, `docs/DESIGN_CONSTRAINTS.md`, `docs/API.md` and `docs/openapi.yaml` first. Run the mandatory design skills in `docs/SKILL_ROUTING.md` before major UI. Commit after each passing step (protocol section 24).

- Run `scripts/slop-check.sh` and resolve every hit before handoff.
- Before the handoff: `superpowers:requesting-code-review`, then `superpowers:verification-before-completion`, then no more edits.
- If the backend's `agent/backend` service is running, capture the evidence against it rather than the mock, and say which in the handoff.

## Review History

| Round | Verdict | Summary |
|---|---|---|
