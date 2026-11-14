# STATUS: agent/backend
Task: TASK-001, TASK-002 (implemented) -> next TASK-003
Round: 0
Last updated: 2026-11-14T12:20:00-08:00

## Skills invoked so far
- ecc:backend-patterns @ TASK-001 start -> layered design: thin routers, pure engine, one in-memory Store; one centralized error handler
- ecc:contract-first @ before contract.py -> tests validate real serialized responses against docs/openapi.yaml (local #/ refs only)
- ecc:error-handling @ before errors.py -> one ApiError(status, code, message, field); handlers for request validation (422 + field), unknown path (404 not_found), unhandled (logged, generic 500)
- ecc:fastapi-patterns @ before main.py -> create_app() factory, pydantic v2 request schemas, TestClient on the factory; no response_model (would duplicate openapi.yaml; contract tests validate instead)
- superpowers:test-driven-development @ before geo.py / evaluate.py -> tests written first and seen red (ImportError) before each module; hand-computed expectations
- ecc:api-design: NOT invoked — the API is fully designed by the manager in docs/openapi.yaml; backend designs no new API surface

## Done
- [x] seed data network/shipments/presets -> commit c3dc5c7
- [x] routes.json from OSRM: 29 routes, 0.33 MB, 0 estimated -> commit a49a2aa
- [x] geo primitives, 11 tests -> e9b8ea2
- [x] health/network/presets/method/feeds, error shape, CORS -> 7ee174b
- [x] evaluation engine, 30 tests -> c1a78b6
- [x] board/settings/reset -> 7094397 (65 tests pass)

## In progress
- [ ] TASK-003 disruptions router (next: write tests/test_disruptions.py first)

## Verified
- seed day at 08:00: 6 on_time, 1 tight (C-105, slack 14), 0 at_risk -> python print in session
- `python3 -m pytest -q` -> 65 passed
- live service on 8012 answers /api/board with 7 shipments

## Blocked on
- nothing

## Notes
- BACKEND_PORT: bootstrap assigned 8002, but 8002 is held by an unrelated week-old uvicorn
  (PID 86078, ~/Documents/Claremont Housing/...). Not killed (not ours). Local .env changed to 8012.
- Default weights not stated in contract; using reference {rel 35, cost 20, co2 20, comm 15, drv 10}
- store.plans holds {shipment_id: {"plan": Plan, "decision_id": str}} (not a bare Plan)
- exposure() counts the chord of each segment inside the circle (reference counted whole segments);
  needed because routes.json geometry is simplified.
