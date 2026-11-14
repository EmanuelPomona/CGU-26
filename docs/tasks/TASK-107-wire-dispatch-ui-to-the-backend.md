---
id: TASK-107
title: Wire the Dispatch UI to the backend
status: READY
owner: frontend
branch: agent/frontend
priority: HIGH
round: 0
depends_on: [TASK-101]
blocked_on: ""
---

# TASK-107 — Wire the Dispatch UI to the backend

## Objective

Keep the owner's Dispatch UI exactly as it looks (`frontend/src/dispatch/`), and
replace the hard-coded data behind its Map, To dispatch and Network views with
the backend API, using the existing generated types and `client.ts`. The On
route view stays scripted. Relabel "Ask AI" and remove personal names. Decisions
behind this task: ADR-007, ADR-008, and the rewritten `docs/DESIGN_BRIEF.md`.
Merge `main` first.

## Scope

- `frontend/src/dispatch/**`
- `frontend/src/api/schema.d.ts` (regenerate only), `frontend/src/api/useBoard.ts`
- `frontend/src/mocks/**` (update fixtures for `roles`, or delete if unused)

## Acceptance Criteria

- [ ] **Data source.** Map, To dispatch and Network read `GET /api/network`, `GET /api/board` and `GET /api/shipments/{id}/options`. `DISPATCH`, `WH`, `TERM`, `ROLE` metrics and `routes.json` are no longer used by these views. With the backend stopped they show an error with a Retry control, not fallback data (F-1).
- [ ] **To dispatch.** One entry per `board.shipments` row: container id, cargo, terminal to warehouse, `driver_label` of its truck, status word and slack from `current`. Selecting one loads its options and shows three route cards, one per role, each being the option whose `roles` contains that role, with server values for estimated arrival, miles, CO2, cost, community score, `community_detail` and burdens. When one option holds several roles the cards say so rather than inventing a difference (F-2).
- [ ] **Map.** Terminals, warehouses and trucks from the network; each shipment's route from `row.route.geometry`; the selected truck's three role routes from the options' `route.geometry`, keeping the mockup's solid / long-dash / dotted line styles. Disruption areas are drawn, unverified ones visibly different from confirmed ones.
- [ ] **Road status.** The mockup's road-status override control maps to the API: adding a condition posts a preset from `GET /api/presets` (at least `close60`, `slow710`, `flood`); "road is open" sends PATCH `dismissed`; "confirmed closed" sends PATCH `confirmed`; removing sends DELETE. Each new condition is shown as unverified until the dispatcher answers (F-3).
- [ ] **Normal vs changed.** Whenever a condition is active, a comparison of at least shipments at risk, late minutes, fleet miles and estimated CO2 (normal, changed, and decided once a decision exists) is visible on the Map or To dispatch view, from `board.indicators`, with triggered checks shown as sentences (U-2).
- [ ] **Responses.** When a shipment's `attention` is `act` or `watch`, its non-route options (spare truck, swap, reschedule) are listed with the route options, feasibility and `infeasible_reason` shown, and the server's suggestion marked "Suggested" with its `rationale`.
- [ ] **Decide.** Choosing a card calls `POST /api/decisions`. A non-suggested choice asks for a short reason first and shows a 422 on `reason` inline. A 409 shows the server message and reloads the options. Afterwards the drafted `supervisor_update` is shown with a Copy button, and Undo calls DELETE (F-4).
- [ ] **Explain.** "Ask AI" and "Ask AI about this" are renamed "Explain this option". The answer is assembled only from server text for that option (`rationale` when suggested, `description`, `community_detail`, `burdens`, `notes`, flags) and ends with "Scripted explanation from the rule-based score." No free-text chat with invented answers remains in wired views. The strings "AI", "optimal" and "model predicts" do not appear anywhere in the UI (U-3, G-7).
- [ ] **Names.** No personal names anywhere. Wired views use `driver_label`. The scripted On route data and chat use "Driver 11" to "Driver 14" (U-3, G-6).
- [ ] **Labels.** The MOCKUP badge is gone from wired views. The On route view shows a visible "Scripted example" label (F-6). Simulated what-if conditions are worded as simulated.
- [ ] **Network.** Warehouses show name, booked and capacity from the server. Fields the server does not provide (closing time, dock notes) are removed, not invented.
- [ ] **Requests.** Optional request fields are omitted, never sent as null. No port is hardcoded; `VITE_API_BASE_URL` is used.
- [ ] `npm --prefix frontend run gen:api`, `run typecheck` and `run build` pass. No new unit tests, screenshots or console log are required (owner decision, ADR-008); say so under "What Was NOT Verified" in the handoff.
- [ ] The handoff is rewritten for this UI (append HANDOFF-2), stating exactly which views are wired, which are scripted, the backend commit and port used, and that the close60 flow in `docs/PRODUCT.md` was walked through by hand.

## Notes

- The backend adds `Option.roles` in TASK-006. Until its commit is announced, build against a fixture that includes `roles`; then regenerate types and run against the backend copy on your port.
- The frontend never ranks options or computes a figure. If the UI needs a value the API lacks, raise a CONTRACT CHANGE REQUEST in the handoff rather than computing or hard-coding it.
- The mockup clock is 9:40 AM; if you want that, call `PUT /api/settings` with `clock_min: 580` and the default weights at load. Otherwise leave the server default.
- Commit in small steps: data layer, To dispatch, Map, road status, decisions, explain and labels each as their own commit.

## Review History

| Round | Verdict | Summary |
|---|---|---|
