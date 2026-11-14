# System Architecture

## Architecture Status

Accepted for the hackathon build (2026-11-14).

---

## System Overview

```
Dispatcher's browser
   │  React single-page app (Vite, TypeScript, Leaflet)
   │  JSON over HTTP, contract in docs/openapi.yaml
   ▼
FastAPI backend (Python 3, one process)
   ├── in-memory board state (settings, disruptions, decisions)
   ├── evaluation engine (pure functions, deterministic)
   ├── bundled data: backend/data/*.json (network, shipments, presets, routes)
   └── optional feed proxy ──► CHP incidents, NWS alerts (nice-to-have)

Build time only: backend/scripts/fetch_routes.py ──► OSRM public demo server
Runtime external dependency: map tiles only (CARTO / OpenStreetMap)
```

The split that matters: **the backend owns every number, the frontend owns every
pixel.** The frontend never computes an ETA, a score, or an indicator. It sends
conditions and choices, and draws what comes back. That keeps the formulas in one
tested place and makes the Method page a rendering of backend data rather than a
second copy of the model.

The sample prototype (`~/Downloads/CGU Hack/index.html`, also copied to
`docs/reference/sample-prototype.html`) is the reference implementation of the
evaluation model. The backend ports its `evalPlan`, `exposure`, `community`,
`buildOptions`, and `scoreOptions` logic to Python. It is a reference, not a
dependency: nothing imports it.

---

## Frontend

Framework: React 18 + Vite

Language: TypeScript (strict)

Map: Leaflet 1.9 used directly through a ref (no react-leaflet), basemap CARTO
Positron (light, no labels variant plus labels layer) with OSM attribution.

Styling: plain CSS with custom properties in `frontend/src/styles/tokens.css`.
No Tailwind, no component library. The palette in `docs/DESIGN_BRIEF.md` is the
token set.

State Management: React state and context. One `useBoard()` hook holds the
latest `Board` from the server; every mutation refetches the board. No client
cache library.

Authentication: none.

Tests: Vitest for pure functions (time-to-x mapping for the appointment strip,
formatters). Typecheck `tsc --noEmit`. Lint: ESLint from the Vite template.

Primary responsibilities:

- board, map, appointment strip, options label, decision log, method page
- condition controls (presets, place on map) and the verification prompt
- loading, empty, error, disabled states for every panel
- responsive layouts at 1440, 768, 390 as designed in the brief

Mock mode: with `VITE_USE_MOCK=1` the API client serves fixtures from
`frontend/src/mocks/` that match the examples in `docs/API.md`, so frontend work
never waits on the backend.

---

## Backend

Framework: FastAPI + Uvicorn

Language: Python 3.11+ (machine has 3.14; avoid version-specific syntax)

Primary responsibilities:

- serve the contract in `docs/openapi.yaml`
- evaluation engine: geometry, corridor exposure, travel time, appointment
  feasibility, cost, CO2, community exposure, driver hours
- option generation, scoring, recommendation, burden statements
- disruption lifecycle including verification
- decisions, supervisor update text, undo, reset
- validation and the single error shape

Tests: pytest. The engine is written test-first (protocol section 14): it is all
branching rules and calculation.

Engine rule: functions in `backend/app/engine/` are pure. They take the dataset,
the conditions, and a plan, and return numbers. No globals, no I/O, no clock
reads. The API layer passes state in.

---

## Database

Provider: none. State is in process memory and is rebuilt from
`backend/data/*.json` at start and on `POST /api/reset`.

Why: one user, one shift, a fictional dataset, and a demo that must start clean
every time. A database adds a failure mode and buys nothing. See ADR-002.

Primary entities: Terminal, Warehouse, Truck, Shipment, Route, SensitivePlace,
Disruption, Decision, Settings. Schema contract in `docs/DATABASE.md`.

---

## Authentication

None. Local single-user demo. No personal data: drivers are "Driver 01".

---

## External Services

### OSRM public demo server (build time only)

Purpose: real road geometry and alternatives for each terminal-warehouse pair.
`backend/scripts/fetch_routes.py` writes `backend/data/routes.json`, which is
committed. Runtime never calls OSRM.

Environment variables: none.

Failure behavior: if the fetch fails for a pair, the script writes a straight
line times 1.35 with `estimated: true`, and the UI labels that route estimated.

Limits to state in the Method page: car profile, no truck restrictions.

### Map tiles (runtime)

Purpose: basemap. Failure behavior: grey map background, overlays still draw,
the board and options are unaffected.

### CHP incident feed, NWS alerts (runtime, nice-to-have)

Purpose: propose candidate disruptions near active routes. Never applied
automatically. Failure behavior: the endpoint still answers 200 with the source
marked unavailable.

---

## Directory Structure

```text
package.json            root scripts (manager-owned; do not edit from a branch)
.env.example
backend/
  requirements.txt
  app/
    main.py             app factory, CORS, error handlers, router wiring
    models.py           pydantic models mirroring docs/openapi.yaml
    state.py            in-memory store, load and reset
    engine/             constants.py geo.py evaluate.py options.py scoring.py
    routers/            network.py board.py disruptions.py options.py decisions.py feeds.py
  data/                 network.json shipments.json presets.json routes.json
  scripts/fetch_routes.py
  tests/
frontend/
  package.json  vite.config.ts  index.html
  src/
    api/                client.ts types.ts
    mocks/              fixtures for VITE_USE_MOCK=1
    styles/             tokens.css
    components/         Board, AppointmentStrip, MapView, Conditions, Options, DecisionLog, Method
tests/                  reserved for cross-stack checks at integration
docs/
```

Ownership: `backend/**` is backend's, `frontend/**` is frontend's. Root files and
`docs/` contracts are the manager's.

---

## Model Assignment

Where the risk lives on this project: **it is judged from a projected demo**, so
the visible product (map, board, the appointment strip, three designed widths)
decides the outcome, and it is also the larger and less specified body of work.
The backend's hard part, the evaluation model, already exists as a working
JavaScript reference; porting it under tests is careful work, not open-ended
work. The integration risk is contract drift, which the contract and mock
fixtures address rather than model strength.

| Agent | Model | Effort | Why this project |
|---|---|---|---|
| manager | opus | high | contracts and integration across two agents |
| frontend-engineer | opus | high | demo-judged; novel signature element; map interaction; three designed layouts |
| backend-engineer | sonnet | high | port of a reference model under TDD; contract is fully specified |
| reviewer | sonnet | high | functional gate; visual findings are advisory |

If the backend engine tests show the port diverging from the reference in ways
sonnet cannot resolve in one round, escalate that task to opus rather than
iterating.

---

## Ports and Environment

Assigned per worktree by `scripts/bootstrap.sh`. Never hardcode 3000 or 8000:
read `FRONTEND_PORT` and `BACKEND_PORT` from `.env`. The frontend reads
`VITE_API_BASE_URL`; set `envDir: '..'` in `vite.config.ts` so Vite reads the
worktree's root `.env`.

Run commands (from the worktree root, after `scripts/bootstrap.sh`):

```bash
npm run dev:backend     # uvicorn on $BACKEND_PORT
npm run dev:frontend    # vite on $FRONTEND_PORT
npm run test            # backend pytest, then frontend vitest
```

CORS: the backend allows `http://localhost:*` and `http://127.0.0.1:*` origins.

## Deployed Preview

None. The reviewer runs both services locally from its worktree.

Preview URL (set as `PREVIEW_URL` in `.env`): empty

## Demo Data

The seed is the bundled JSON in `backend/data/`, loaded when the backend starts.
`npm run seed` calls `POST /api/reset` on a running backend to return to the
clean normal day.
