# Acceptance Criteria

What "done" means for Drayline. The reviewer gates against this file and against
the per-task criteria in `docs/tasks/`. IDs are stable; quote them in handoffs.

---

## Product

- [ ] **P-1** The primary demo flow in `docs/PRODUCT.md` (steps 1 to 7) completes end to end in one browser session without reloading.
- [ ] **P-2** With no disruptions, every shipment's `normal`, `changed` and `current` evaluations are identical and the indicator strip shows no difference.
- [ ] **P-3** After the `close60` preset is added and confirmed, at least two indicators differ between normal and changed, and both differences are visible without opening any panel.
- [ ] **P-4** Dismissing a disruption returns every indicator to its normal value while the disruption stays listed as dismissed.
- [ ] **P-5** After a decision on an at-risk shipment, the indicator strip shows normal, changed and decided values, and the decision is in the log with its supervisor update.

## Organizer requirements (GeoAI brief)

- [ ] **G-1** A condition can be changed in at least three different ways (geographic, pickup delay, truck or dock capacity).
- [ ] **G-2** Normal and changed scenarios are compared on at least two indicators, and the Method page states how each is calculated.
- [ ] **G-3** Environmental responsibility is demonstrated: every option shows added miles and estimated CO2.
- [ ] **G-4** Fairness and stakeholder impact is demonstrated: every option lists who bears a burden (driver, residents, warehouse, other customer), and the map shows sensitive places near the selected route.
- [ ] **G-5** Human oversight is demonstrated: nothing changes a plan without a dispatcher click; a non-suggested option can be chosen with a recorded reason; a decision can be undone.
- [ ] **G-6** Transparency and responsible data: every simulated or estimated figure is labeled; unverified disruptions are visually distinct on map and board; no personal data appears.
- [ ] **G-7** The interface nowhere describes the rule-based scoring as AI, a trained model, or optimal.

## Frontend functionality

- [ ] **F-1** Every interface state in protocol section 8 is present where relevant: board loading, board error with retry, no disruptions (empty), options loading, options error, decision submitting (disabled), validation error on override reason.
- [ ] **F-2** With the backend stopped, the app shows an error state with a retry control, not a blank page, and recovers when the backend returns.
- [ ] **F-3** Selecting a shipment on the board highlights its route on the map and selecting a route's marker selects the row.
- [ ] **F-4** Types in `frontend/src/api/` are generated from `docs/openapi.yaml`; no handwritten response interfaces.

## UI/UX

- [ ] **U-1** The appointment strip from `docs/DESIGN_BRIEF.md` is present on every board row and every option: bracket for the window, live tick, ghost tick for the normal ETA, whisker for uncertainty, hollow tick when unverified.
- [ ] **U-2** The implementation is recognizable as its reference points: a ruled board with fixed columns (not cards), option facts as a ruled label, a muted basemap where only routes, hazards and destinations carry color.
- [ ] **U-3** No unjustified pattern from `docs/DESIGN_CONSTRAINTS.md`; `scripts/slop-check.sh` hits are removed or justified in the brief.
- [ ] **U-4** At 1440px the 7-row board fits beside the map without scrolling. At 390px the board is the first content, options open as a full-height sheet, and no horizontal scroll exists.
- [ ] **U-5** Status is never conveyed by color alone; each status has a word.

## Backend

- [ ] **B-1** Implementation matches `docs/openapi.yaml`: a pytest validates each endpoint's response against its schema, and `scripts/contract-test.sh` passes.
- [ ] **B-2** Invalid input is rejected with the documented `Error` shape, including FastAPI validation failures (422 with `field`).
- [ ] **B-3** The engine has unit tests for: reverse cases of each disruption kind, each verification state, driver-hours infeasibility, reschedule search, status thresholds, and determinism (same input, same output).
- [ ] **B-4** `POST /api/reset` returns a board equal to a fresh start.
- [ ] **B-5** The backend starts and serves the full demo flow with no network access.

## Integration

- [ ] **I-1** Frontend reaches backend at the configured port with no CORS errors.
- [ ] **I-2** Browser console is clean of errors during the primary flow.
- [ ] **I-3** No hardcoded 3000 or 8000 anywhere in `frontend/` or `backend/`.

## Demo

- [ ] **D-1** Runs from a clean clone via `scripts/bootstrap.sh`, `npm run dev:backend`, `npm run dev:frontend` with no other manual step.
- [ ] **D-2** `npm run seed` returns a running app to the normal day.
- [ ] **D-3** Screenshots of the normal and changed scenarios exist in `docs/review/` for the slide deck.
- [ ] **D-4** A recorded fallback of the working demo exists (team task, outside the repo is acceptable).
