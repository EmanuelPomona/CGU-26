---
id: TASK-001
title: Backend scaffold seed data and static endpoints
status: READY
owner: backend
branch: agent/backend
priority: HIGH
round: 0
depends_on: []
blocked_on: ""
---

# TASK-001 — Backend scaffold seed data and static endpoints

## Objective

Stand up the FastAPI service with its bundled data and every endpoint that needs
no evaluation engine: `GET /api/health`, `GET /api/network`, `GET /api/presets`,
`GET /api/method`, `POST /api/reset` (returns a Board; until TASK-002 lands it
may be built from a stub evaluator, see Notes), and `GET /api/feeds/candidates`
returning `{"sources":[{"name":"CHP incidents","ok":false,"error":"not enabled"},
{"name":"NWS alerts","ok":false,"error":"not enabled"}],"candidates":[]}`.
Install the single error shape and CORS.

## Scope

- `backend/requirements.txt` (fastapi, uvicorn, pydantic, pytest, httpx, pyyaml, jsonschema)
- `backend/app/main.py`, `backend/app/models.py`, `backend/app/state.py`
- `backend/app/routers/network.py`, `backend/app/routers/feeds.py`
- `backend/data/network.json`, `shipments.json`, `presets.json`, `routes.json`
- `backend/scripts/fetch_routes.py`
- `backend/tests/conftest.py`, `backend/tests/test_static.py`, `backend/tests/contract.py`

## Acceptance Criteria

- [ ] `npm run dev:backend` starts the service on `$BACKEND_PORT` from `.env`; no port is hardcoded.
- [ ] `backend/data/network.json` holds 2 terminals, 6 warehouses, 9 trucks (T8, T9 `spare: true`), 30 sensitive places with ids `SP-01`..`SP-30`, values copied from the reference `TERM`, `WH`, `TRUCKS`, `RECV_SIM`; `shipments.json` holds `C-101`..`C-107` from `ORDERS`; `presets.json` holds the 7 presets in `docs/API.md` with the fire and flood coordinates from the reference (34.13,-117.5,7 km and 34.0,-118.22,2.5 km).
- [ ] `python3 backend/scripts/fetch_routes.py` writes `backend/data/routes.json` with, for each of the 7 terminal-warehouse pairs, route `-0` plus OSRM alternatives and up to 3 via-hub detours (reference `ensureHubs`, `HUBS`, dedupe by geometry similarity > 0.88), each with `steps`. A failed pair gets a straight-line x1.35 route with `estimated: true`. The file is committed; geometry is simplified to at most about 400 points per route so the file stays under 2 MB.
- [ ] `backend/tests/contract.py` exposes `assert_matches(schema_name: str, payload)` which validates a payload against `components.schemas[schema_name]` of `docs/openapi.yaml` (resolve `$ref`s; jsonschema Draft 2020-12). Tests for every endpoint in this task call it on the real response.
- [ ] A malformed JSON body or schema violation on any endpoint returns 422 with `{"error":"validation_error","message":...,"field":...}`; an unknown path id returns 404 `not_found`; an unhandled exception returns 500 `internal_error` with a generic message and no stack trace.
- [ ] A request with `Origin: http://localhost:3010` receives `Access-Control-Allow-Origin` for that origin.
- [ ] `GET /api/method` returns every constant listed under "Constants" in `docs/API.md` as an `Assumption` with `kind: simulated`, at least the data sources OSRM (public; car profile, no truck restrictions), sensitive places (simulated), shipments/trucks/warehouses (simulated), and all five `responsible_design` considerations.
- [ ] `cd backend && python3 -m pytest -q` passes; output pasted in the handoff.

## Notes

Read `docs/API.md` and `docs/openapi.yaml` first; they are the contract. Commit after each passing step (protocol section 24).

- Reference data and logic: `docs/reference/sample-prototype.html`. Schema of stored data: `docs/DATABASE.md`.
- `state.py` produces: `class Store` with `network`, `shipments`, `routes` (dict by id and by pair), `presets`, `settings`, `disruptions: list`, `plans: dict[shipment_id, Plan]`, `decisions: list`, and `reset()`. One module-level `store`. Later tasks rely on these names.
- OSRM endpoint and parsing are in the reference (`osrm`, `parseRoute`, `routeLabel`, `isHwy`). The script is the only code that touches the network; tests must not.
- If system `pip` refuses to install (PEP 668), create `backend/.venv`, and say so in the handoff; do not change `package.json` (manager-owned), request it instead.
- Machine has Python 3.14 with fastapi already importable.

## Review History

| Round | Verdict | Summary |
|---|---|---|
