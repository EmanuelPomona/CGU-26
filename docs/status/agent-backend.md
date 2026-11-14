# STATUS: agent/backend
Task: TASK-001..004 in REVIEW; HANDOFF-1 written
Round: 0
Last updated: 2026-11-14T12:35:00-08:00

## Skills invoked so far
- ecc:backend-patterns @ TASK-001 start -> layered design: thin routers, pure engine, one in-memory Store; one centralized error handler
- ecc:contract-first @ before contract.py -> tests validate real serialized responses against docs/openapi.yaml (local #/ refs only)
- ecc:error-handling @ before errors.py -> one ApiError(status, code, message, field); handlers for request validation (422 + field), unknown path (404 not_found), unhandled (logged, generic 500)
- ecc:fastapi-patterns @ before main.py -> create_app() factory, pydantic v2 request schemas, TestClient on the factory; no response_model (would duplicate openapi.yaml; contract tests validate instead)
- superpowers:test-driven-development @ before geo.py / evaluate.py -> tests written first and seen red (ImportError) before each module; hand-computed expectations
- ecc:security-review @ before TASK-003 disruptions router -> allow-list referenced ids (shipment/warehouse/trucks) against seed, bounded strings, generic 500, localhost-only CORS
- superpowers:requesting-code-review @ after TASK-004 + schemathesis fixes (HEAD 273d7ab) -> reviewer subagent dispatched on 54afc1c..273d7ab
- superpowers:systematic-debugging @ before fixing review findings -> root cause: swap couples two plans under one decision id; replacement deleted both. Fix: 409 guard + partner filter (98af9ad)
- superpowers:verification-before-completion @ immediately before committing HANDOFF-1 -> fresh: 136 passed, ruff clean, mypy clean, live 8012 board 7 rows
- ecc:api-design: NOT invoked — the API is fully designed by the manager in docs/openapi.yaml; backend designs no new API surface

## Done
- [x] seed data network/shipments/presets -> commit c3dc5c7
- [x] routes.json from OSRM: 29 routes, 0.33 MB, 0 estimated -> commit a49a2aa
- [x] geo primitives, 11 tests -> e9b8ea2
- [x] health/network/presets/method/feeds, error shape, CORS -> 7ee174b
- [x] evaluation engine, 30 tests -> c1a78b6
- [x] board/settings/reset -> 7094397 (65 tests pass)

- [x] TASK-003 disruptions -> d452dfc
- [x] TASK-004 options/scoring -> 4aca92f; decisions/supervisor update/undo -> 3184673
- [x] offline demo flow test (B-5) -> 39e6707
- [x] schemathesis findings fixed (400->422, explicit null 422, 405 Allow) -> 273d7ab

- [x] code review findings fixed (swap consistency, partner hours, whitespace, before-line) -> 98af9ad
- [x] ruff + mypy clean -> bb943d8
- [x] HANDOFF-1 written; TASK-001..004 status REVIEW

## In progress
- [ ] nothing. Next if asked: TASK-005 (BACKLOG) only after review

## Verified
- seed day at 08:00: 6 on_time, 1 tight (C-105, slack 14), 0 at_risk -> python print in session
- `python3 -m pytest -q` -> 136 passed (at bb943d8)
- schemathesis 4.33.4 (scratch venv) vs live 8012: 717 cases, only 3 ST202 left = documented semantic rules (kind companions, override reason, all-zero weights)
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
