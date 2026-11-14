# Handoffs: agent/frontend

HANDOFF-1 (the ruled board UI for TASK-101 to TASK-105) was drafted but never committed: the owner
replaced that UI before review (ADR-007). Its code is in git history up to `97e161f`.

## HANDOFF-2 — agent/frontend — 2026-11-14

### Summary
TASK-107: the owner's Dispatch UI (`frontend/src/dispatch/`) now runs its **Map, To dispatch and
Network views on the backend API**; the **On route view is a scripted example** and says so. Look,
layout, type and palette are the owner's mockup. The browser ranks nothing and computes no figure:
every number shown in the wired views comes from `/api/board`, `/api/network`,
`/api/shipments/{id}/options` or a decision response.

| View | Source |
|---|---|
| Map | wired: terminals, warehouses, trucks (`/api/network`); routes and road reports (`/api/board`); comparison box from `board.indicators` |
| To dispatch | wired: one entry per `board.shipments` row; route cards and responses from `/api/shipments/{id}/options`; decisions via `/api/decisions` |
| Network | wired: warehouses (`/api/network`), road reports (`/api/presets` + `/api/disruptions`) |
| On route | **scripted example** (fatigue, driver chat, options): labelled "Scripted example", not computed by the backend |

### Tasks Completed
TASK-107, criterion by criterion:
- **Data source.** Wired views read `/api/network`, `/api/board`, `/api/shipments/{id}/options`. The
  mockup's `DISPATCH`, `WH`, `TERM`, `ROLE` metrics are deleted; `routes.json` remains only for the
  scripted On route trucks. Backend stopped: a stated error with Retry, no fallback data; Retry
  recovers (walked through).
- **To dispatch.** One entry per shipment: container id, `driver_label`, cargo, terminal to
  warehouse, status word and slack from `current`. Three role cards, each the option whose `roles`
  holds that role, with server ETA, miles, CO2, cost, community score, `community_detail`, burdens,
  flags, and the server `delta` vs keeping the plan. When one option holds several roles, its card
  is titled with all of them ("Efficiency · Community") and the other role's card reads "Same route
  as Efficiency: <title>". A role with no holder says "No feasible route holds this role." Default
  selected truck: C-103.
- **Map.** Network markers; each shipment's `row.route.geometry` styled by status; the selected
  shipment's role routes from the options' geometry in solid / long dash / dotted; disruption areas
  with unverified dashed indigo, confirmed solid red, dismissed thin grey.
- **Road status.** Network lists the area presets (`slow710`, `close60`, `fire`, `flood`) with
  Report (POST preset), then Unverified / Confirmed / Road is open (PATCH) and remove (DELETE). The
  same three choices and remove are in the popup on each map circle. New reports start Unverified.
- **Normal vs changed.** Whenever a condition is active or a decision exists, a table of shipments
  at risk, late minutes, fleet miles, CO2 and cost (normal, changed, decided once a decision exists)
  appears on the Map, in To dispatch and in Network, with triggered checks as sentences.
- **Responses.** "Other responses" lists options holding no role (including the server's suggestion
  when it is not a role card) and, when `attention` is act or watch, spare truck, swap and
  reschedule, with feasibility and `infeasible_reason`. The suggestion is marked "Suggested" and its
  `rationale` shown once above the cards.
- **Decide.** "Dispatch" posts the chosen card; a non-suggested choice asks for a reason first
  (inline validation, 422 on `reason` shown inline); 409 shows the server message and reloads
  options. The drafted `supervisor_update` appears with Copy and "The tool does not send anything.";
  Undo calls DELETE. "Hold" changes nothing and says so.
- **Explain.** "Explain this option" lists only server text for that option (`rationale` when
  suggested, `description`, `community_detail`, burdens, `notes`, flags, `infeasible_reason`) and
  ends with "Scripted explanation from the rule-based score." No free-text assistant remains. The
  scripted On route explain uses its own scripted lines and says "Scripted example."
- **Names and labels.** No personal names: wired views use `driver_label`; scripted trucks are
  "Driver 11" to "Driver 14". MOCKUP badge removed. `grep` over `src/dispatch`, `main.tsx`,
  `index.html` for AI, optimal, model predicts, MOCKUP and the mockup's names: no matches.
- **Network.** Warehouses show name, booked/capacity and docks from the server; closing times and
  dock notes removed.
- **Requests.** Optional fields omitted (reason only on overrides). `VITE_API_BASE_URL` only.

### Files Changed
`frontend/src/dispatch/{DispatchApp.tsx, DispatchMap.tsx, data.ts, dispatch.css}`,
`frontend/src/api/schema.d.ts` (regenerated), `frontend/src/mocks/options.ts` (`roles` per the
contract rule), `docs/status/agent-frontend.md`, this file.

### Contracts
Consumes `Option.roles` (TASK-006). No CONTRACT CHANGE REQUEST. One observation for the manager:
the server's `rationale` already begins with "Suggested:", and burden texts often begin with their
stakeholder; the UI strips the duplicate prefix rather than asking for a change.

### Skills Used
| Skill | Stage invoked | What it actually changed |
|---|---|---|
| superpowers:verification-before-completion | last step before this handoff | gates rerun after the final edit; claims below limited to what was run |

Earlier skills in this session (design pass, TDD, debugging, code review) applied to the superseded
UI and are not claimed for TASK-107. `superpowers:requesting-code-review` was **not** run on the
TASK-107 diff (see below).

### Verification
Run against a read-and-run copy of `agent/backend` @ `c30496a` (exported with `git archive` into the
session scratchpad, no edits) on port 8001; frontend on 3011 (local `.env`).

```
npm --prefix frontend run gen:api    -> no diff in schema.d.ts
npm --prefix frontend run typecheck  -> exit 0
npm --prefix frontend run build      -> built, 371 kB JS
npx eslint src                       -> 0 errors, 0 warnings
npx vitest run                       -> 29 passed (existing tests; none added, ADR-008)
```

close60 flow from `docs/PRODUCT.md`, walked through by hand in the browser: reset, To dispatch
shows C-103 with Efficiency·Community and Sustainability cards; Network, Report SR-60 closure
(Unverified, comparison shows 0 to 2 at risk); Road is open (back to normal, comparison hidden);
Confirmed (2 at risk, check sentence shown); To dispatch C-103 at risk, Dispatch on a non-suggested
route asks for a reason, empty reason rejected inline, reason given, decision recorded, supervisor
update drafted, C-103 On time, Decided column shown; Undo returns C-103 to At risk; Map shows routes
by status, the confirmed closure and the comparison. Backend stopped: error with Retry; restarted:
Retry recovers.

### What Was NOT Verified
- **No new unit tests, saved screenshots or console log** (owner decision, ADR-008). The walk-through
  above is the only runtime evidence; under protocol section 10 the expected verdict is BLOCKED.
- **No code review of the TASK-107 diff** (`superpowers:requesting-code-review` not run for it).
- **Narrow widths** (768, 390): the owner's mockup is a desktop layout and was not adapted.
- The 409 "Undo DEC-n first" swap path and the `swap_truck` collateral display were not produced by
  the scenarios walked.
- The map-circle popup controls were exercised in the previous build of this view, not re-clicked
  after wiring; the Network controls (same handler) were.
- Copy to clipboard not exercised (headless).
- Accessibility not rechecked for the new views beyond keyboard-operable buttons and labelled inputs.

### Known Issues
- The On route view is a script: its trucks, fatigue and chat do not come from the backend.
- The map's "Expand map" button sits under the tile attribution in the small map box (as in the
  owner's mockup).
- `docs/review/F-*` screenshots show the superseded board UI.

### Commit
`agent/frontend` HEAD at handoff (see `git log`), backend tested: `c30496a`.
