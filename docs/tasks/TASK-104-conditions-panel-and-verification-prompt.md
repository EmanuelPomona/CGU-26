---
id: TASK-104
title: SUPERSEDED by TASK-107 (Conditions panel and verification prompt)
status: BACKLOG
owner: frontend
branch: agent/frontend
priority: HIGH
round: 0
depends_on: [TASK-102, TASK-103]
blocked_on: ""
---

# TASK-104 — Conditions panel and verification prompt

## Objective

**Superseded.** The owner replaced this UI with the Dispatch mockup (ADR-007). Do not build this. See TASK-107.

Let the dispatcher change a condition (preset, or place one on the map), see the
active disruptions, and answer the verification question for each unverified
one. This is the "notify and ask" step of the team's whiteboard flow.

## Scope

- `frontend/src/components/Conditions.tsx`, `Conditions.css`
- `frontend/src/components/VerifyPrompt.tsx`, `VerifyPrompt.css`
- `frontend/src/components/DisruptionForm.tsx`

## Acceptance Criteria

- [ ] Presets from `GET /api/presets` render as plain buttons with label and description; clicking one POSTs its `disruption` body unchanged and the board, map and indicators update from the returned Board.
- [ ] "Place on map" form: kind (slowdown, closure, hazard), radius, slowdown factor (only for slowdown), confidence; then map click places it. Pickup delay, truck out and dock cut have their own small forms choosing from the network's shipments, trucks, warehouses.
- [ ] Client-side validation matches the YAML ranges and blocks the request with an inline field message; a 422 from the server shows its `message` beside the named `field`.
- [ ] Each unverified disruption raises a verification prompt, oldest first, stating the report, its source and confidence, and the shipments it affects by id, with three actions: "Confirm" (PATCH confirmed), "Dismiss, not true" (PATCH dismissed), "Leave unverified". An optional one-line note is sent with the PATCH.
- [ ] After "Dismiss", the board returns to normal values and the disruption stays in the list marked "Dismissed" with its note; it can be re-opened (PATCH unverified) or deleted.
- [ ] The active list shows kind, label, verification word, affected count, and a remove control with an accessible name; with none it shows an empty state: "No changed conditions. This is the normal day."
- [ ] "Reset to normal day" calls `POST /api/reset` after an inline confirm step (no browser `confirm()` dialog).
- [ ] While a request is in flight its control is disabled and shows progress; a failed request shows an inline error and leaves the board as it was.
- [ ] Every source value is worded for people: simulated = "Simulated what-if", dispatcher = "Entered by dispatcher", public_feed = "Public feed, unconfirmed".

## Notes

Read `docs/DESIGN_BRIEF.md`, `docs/DESIGN_CONSTRAINTS.md`, `docs/API.md` and `docs/openapi.yaml` first. Run the mandatory design skills in `docs/SKILL_ROUTING.md` before major UI. Commit after each passing step (protocol section 24).

- Copy rule: no em dashes in interface strings, no "It's not X, it's Y" (design constraints).
- The prompt must not be a blocking modal: the dispatcher can look at the map and board while deciding. It sits in the conditions region at 1440 and as a banner above the board at 768 and 390.

## Review History

| Round | Verdict | Summary |
|---|---|---|
