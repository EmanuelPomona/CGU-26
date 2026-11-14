# Acceptance Criteria

What "done" means for Drayline. The reviewer gates against this file and against
the per-task criteria in `docs/tasks/`. IDs are stable; quote them in handoffs.

---

## Product

- [ ] **P-1** The primary demo flow in `docs/PRODUCT.md` completes end to end in one browser session without reloading.
- [ ] **P-2** With no disruptions, every shipment's `normal`, `changed` and `current` evaluations are identical and the indicator strip shows no difference.
- [ ] **P-3** After the `close60` preset is added and confirmed, at least two indicators differ between normal and changed, and both differences are visible without opening any panel.
- [ ] **P-4** Dismissing a disruption returns every indicator to its normal value while the disruption stays listed as dismissed.
- [ ] **P-5** After a decision on an at-risk shipment, the indicator strip shows normal, changed and decided values, and the decision is in the log with its supervisor update.

## Organizer requirements (GeoAI brief)

- [ ] **G-1** A condition can be changed in at least three different ways (geographic, pickup delay, truck or dock capacity).
- [ ] **G-2** Normal and changed scenarios are compared on at least two indicators, and the Method page states how each is calculated.
- [ ] **G-3** Environmental responsibility is demonstrated: every option shows added miles and estimated CO2.
- [ ] **G-4** Fairness and stakeholder impact is demonstrated: every option lists who bears a burden (driver, residents, warehouse, other customer), and the community score counts sensitive places near the route.
- [ ] **G-5** Human oversight is demonstrated: nothing changes a plan without a dispatcher click; a non-suggested option can be chosen with a recorded reason; a decision can be undone.
- [ ] **G-6** Transparency and responsible data: every simulated or estimated figure is labeled; unverified disruptions are visually distinct on map and board; no personal data appears.
- [ ] **G-7** The interface nowhere describes the rule-based scoring as AI, a trained model, or optimal.

## Frontend functionality (Dispatch UI, ADR-007)

- [ ] **F-1** Map, To dispatch and Network views show data from the backend API only; with the backend stopped they show an error with a retry control, not hard-coded data.
- [ ] **F-2** For each truck to dispatch, the three route cards are the server options holding the roles efficiency, sustainability and community, with server figures for arrival, miles, CO2, cost and community score.
- [ ] **F-3** A road condition can be added (preset or road-status override), then confirmed or dismissed, and the map and truck statuses change from the server's response.
- [ ] **F-4** Choosing a route or response records a decision through `POST /api/decisions`, shows the drafted supervisor update, and can be undone.
- [ ] **F-5** Types in `frontend/src/api/` are generated from `docs/openapi.yaml`.
- [ ] **F-6** The On route view is labelled "Scripted example".

## UI/UX

- [ ] **U-1** The UI is the owner's Dispatch mockup: four views, three route roles with solid, dashed and dotted lines.
- [ ] **U-2** A normal vs changed comparison of at least two indicators is visible when a condition is active.
- [ ] **U-3** No personal names; "Ask AI" wording is gone; explanations are marked scripted.

## Backend

- [ ] **B-1** Implementation matches `docs/openapi.yaml`: a pytest validates each endpoint's response against its schema, and `scripts/contract-test.sh` passes.
- [ ] **B-2** Invalid input is rejected with the documented `Error` shape, including FastAPI validation failures (422 with `field`).
- [ ] **B-3** The engine has unit tests for: each disruption kind, each verification state, driver-hours infeasibility, reschedule search, status thresholds, and determinism (same input, same output).
- [ ] **B-4** `POST /api/reset` returns a board equal to a fresh start.
- [ ] **B-5** The backend starts and serves the full demo flow with no network access.

## Integration

- [ ] **I-1** Frontend reaches backend at the configured port with no CORS errors.
- [ ] **I-2** Browser console is clean of errors during the primary flow.
- [ ] **I-3** No hardcoded 3000 or 8000 anywhere in `frontend/` or `backend/`.

## Demo

- [ ] **D-1** Runs from a clean clone via `scripts/bootstrap.sh`, `npm run dev:backend`, `npm run dev:frontend` with no other manual step.
- [ ] **D-2** `npm run seed` returns a running app to the normal day.
- [ ] **D-3** Waived by the owner (ADR-008). The team captures slide screenshots by hand.
- [ ] **D-4** A recorded fallback of the working demo exists (team task, outside the repo is acceptable).
