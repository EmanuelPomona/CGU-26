# Handoffs: agent/backend

## HANDOFF-1 — agent/backend — 2026-11-14

### Summary
TASK-001 to TASK-004 are implemented. The FastAPI backend serves every path in `docs/openapi.yaml`: seed data, the evaluation engine (ported test-first from the reference), the board, settings, reset, the disruption lifecycle with verification, options with burdens and rule-based scoring, decisions with a drafted supervisor update, and undo. Every response the tests touch is validated against `docs/openapi.yaml`. There are 136 tests and all pass. The backend makes no network calls at runtime.

**PORT: this worktree's backend runs on 8012, not 8002.** `scripts/bootstrap.sh` assigned 8002, but an unrelated, week-old uvicorn from another project is on 8002 (PID 86078, cwd `~/Documents/Claremont Housing/claremonthousing-Backend/backend`). It also answers `/api/health` with `ok`, but returns 404 on `/api/board`. I did not stop it. My local `.env` has `BACKEND_PORT=8012` and `VITE_API_BASE_URL=http://localhost:8012`. Re-running `scripts/bootstrap.sh` here would reset the port to 8002. The manager has acknowledged this.

### Tasks Completed
- **TASK-001**: all criteria met.
  - `npm run dev:backend` starts on `$BACKEND_PORT`.
  - The data files match the reference: 2 terminals, 6 warehouses, 9 trucks (T8 and T9 spare), SP-01..SP-30, C-101..C-107, and 7 presets with the fire and flood areas from the reference.
  - `fetch_routes.py` wrote 29 real OSRM routes (3 to 5 per pair, none estimated, 0.33 MB, at most 321 points each).
  - `tests/contract.py` provides `assert_matches`.
  - The error shape covers 422, 404 and 500, plus 405 with `Allow`. CORS accepts any `http://localhost:*` or `http://127.0.0.1:*` origin.
  - `/api/method` lists every constant as `simulated`, along with the data sources and all five responsible-design considerations.
- **TASK-002**: all criteria met.
  - `evaluate()` is pure and deterministic. `conditions_from()` follows the verification rules.
  - Engine tests are hand-computed (`test_geo.py`, `test_evaluate.py`).
  - On a fresh board, normal, changed and current are equal and the checks are false.
  - The `attention` rule and the four checks are implemented. The `added_miles_review` detail says the threshold is "an example ... not an operating standard".
  - Settings return 422 naming `weights` or `clock_min`. Rounding happens only at the API boundary.
- **TASK-003**: all criteria met.
  - New disruptions get ids `D-<n>` and start `unverified`, with a generated label. The 422 cases name the field.
  - `affected_shipment_ids` is computed per kind and kept after dismissal.
  - All 7 presets are accepted, and `close60` and `slow710` each affect at least one shipment.
  - P-3: after `close60` is confirmed, `shipments_at_risk`, `total_late_min` and `cost_usd` differ from normal.
  - P-4: dismissing restores normal values and keeps the disruption in the list.
  - PATCH and DELETE on an unknown id return 404. A note given in PATCH is stored. Posting the same preset twice is safe.
- **TASK-004**: all criteria met.
  - Options use the ids and kinds in the contract, with no `hold`, and are deterministic. `keep.delta` is all zeros.
  - At most one option is suggested, and it is always feasible. With every option infeasible, the rationale says to escalate. Emissions-only weights pick the feasible option with the lowest CO2.
  - Burdens and the unverified-report note are present. A test checks for the banned words across all presets and shipments.
  - Decisions return 201, 422 (`reason`), 404 or 409 as specified. A decision updates `current` and `decided`, and a swap updates both shipments.
  - A second decision for a shipment replaces the first. The supervisor update text is drafted. Undo and reset (B-4) work.
  - B-5: the demo flow runs with networking disabled (`test_demo_flow.py` blocks every socket connection).

### Preset effects (frontend and demo script)
Clock 08:00 with default weights. The seed day has 0 at_risk and 1 tight shipment (C-105, slack 14 min). Normal indicators: miles 575.7, CO2 901.5 kg, cost $2212.5.

| Preset | Verification | Affected | Status (affected) | Suggested option per affected shipment | Indicators normal → changed |
|---|---|---|---|---|---|
| slow710 | unverified / confirmed | C-102, C-103, C-104, C-105, C-107 | no change (C-105 stays tight) | keep for all | co2 901.5→908.1; cost 2212.5→2230.3 |
| close60 | unverified | C-103, C-107 | both at_risk | C-103: reschedule:135, C-107: reroute:POLB-ONT-1 | at_risk 0→2; late 0→168; cost →2566.4 |
| close60 | confirmed | C-103, C-107 | both at_risk | C-103: reschedule:135, C-107: reroute:POLB-ONT-1 | at_risk 0→2; late 0→228; cost →2676.4 |
| fire | unverified | C-104 | at_risk | reschedule:135 | at_risk 0→1; late 0→51; cost →2330.4 |
| fire | confirmed | C-104 | at_risk (T4 over hours, keep infeasible) | spare:T8 (swap:C-101 also offered) | at_risk 0→1; late 0→111; cost →2440.4 |
| flood | unverified / confirmed | C-101 | at_risk | reschedule:135 | at_risk 0→1; late 0→46 / 121 |
| pickup103 | either | C-103 | at_risk | reschedule:105 | at_risk 0→1; late 0→83; co2 →917.8 |
| trucks35 | either | C-103, C-105 | both at_risk (no truck) | spare:T8 for each (one at a time: a committed spare is not offered again) | at_risk 0→2; late 0→360 |
| docksONT | either | C-103, C-107 | both at_risk | C-103: reschedule:30, C-107: keep | at_risk 0→2; late 0→18 |

Notes for the demo:
- `slow710` touches five routes but changes no status, because the time added inside the 4 km circle is small. `close60` is the strongest demo preset.
- For C-103 under `close60`, the options are keep, reschedule:135, reroute:POLA-ONT-1 and reroute:POLA-ONT-4. No spare is offered, because a spare does not help a road closure.

### Files Changed
- `backend/requirements.txt`, `backend/data/{network,shipments,presets,routes}.json`, `backend/scripts/fetch_routes.py`
- `backend/app/{main,errors,models,state}.py`
- `backend/app/engine/{constants,geo,evaluate,board,options,scoring,messages,method,context}.py`
- `backend/app/routers/{network,board,disruptions,options,decisions,feeds}.py`
- `backend/tests/{contract,conftest,helpers}.py`
- `backend/tests/test_{geo,static,errors,evaluate,board,disruptions,options,scoring,decisions,demo_flow}.py`
- `docs/status/agent-backend.md`, `docs/handoffs/agent-backend.md`, and the `status` field of `docs/tasks/TASK-001..004`

### Contracts
Implemented against `docs/openapi.yaml` exactly. No field was added or removed. No contract change request.

The points below interpret the contract or differ from the reference. The manager should confirm them or record them in DECISIONS.md:
1. **Exposure uses chords.** A slowdown counts only the part of each route segment inside the circle (the reference counted whole segments). This matches the normative wording "time spent inside", and it is needed because `routes.json` geometry is simplified.
2. **Swap on hours.** `swap_truck` is also offered when the current driver is over hours and the swapped truck is not, mirroring the spare-truck rule in rule 9. A swap is infeasible when it would push the partner's driver further over hours.
3. **Swap guard.** A swap is never offered with a partner shipment that already has a decision in force. A new decision on either side of a swap returns **409 `option_infeasible`** with "Undo DEC-n first". This mirrors the reference's "truck already committed" guard and prevents one truck being assigned twice.
4. **`keep` follows the plan in force.** After a decision, `keep` means the plan currently in force, not the seed plan.
5. **Infeasible scores.** Infeasible options report `scores.overall = 0` (the schema minimum; the reference used −1000).
6. **No explicit nulls in requests.** Request fields that are optional but not nullable reject an explicit JSON `null` with 422 naming the field. Omit them instead. This also applies to fields that do not belong to the kind, which are ignored only when omitted or valid.
7. **Default settings.** Clock 480; weights reliability 35, cost 20, emissions 20, community 15, driver 10. The manager added these to `docs/API.md`.
8. **405 code.** A 405 response uses `error: "not_found"`, because the Error enum has no method-not-allowed code.

### Skills Used
| Skill | Stage invoked | What it actually changed |
|---|---|---|
| ecc:backend-patterns | TASK-001 start | Layering: thin routers, a pure engine, one in-memory Store, one centralized error handler |
| ecc:contract-first | before `tests/contract.py` | Tests validate real serialized responses against `openapi.yaml`, resolving only local `#/` refs |
| ecc:error-handling | before `errors.py` | One `ApiError(status, code, message, field)`; handlers for 422 with `field`, 404, 405 and a logged generic 500 |
| ecc:fastapi-patterns | before `main.py` | `create_app()` factory, Pydantic v2 request schemas, TestClient on the factory; no `response_model` (contract tests validate instead) |
| superpowers:test-driven-development | before `geo.py` and `evaluate.py` | Each module's tests were written first and seen failing, with hand-computed expectations; later fixes also started from a failing regression test |
| ecc:security-review | before the TASK-003 router | Referenced ids are checked against the seed; string lengths are bounded; no internals leak in errors; CORS is localhost only |
| superpowers:requesting-code-review | after TASK-004 (273d7ab) | A reviewer subagent found the swap and decision-replacement bugs and several minor issues; fixed in 98af9ad |
| superpowers:systematic-debugging | before fixing the review findings | Root cause: a swap ties two plans to one decision id, and replacing a decision deleted both. Fix: never break that tie (409 plus a partner filter) |
| superpowers:verification-before-completion | immediately before this handoff was committed | Final commands re-run; see Verification |
| ecc:api-design | not invoked | The manager fully designed the API; the backend designed no new API surface |

### Verification
```
$ cd backend && python3 -m pytest -q
136 passed in 1.70s

$ ruff check app tests scripts            # ruff from a scratch venv, not a project dependency
All checks passed!
$ mypy app --ignore-missing-imports       # mypy from a scratch venv
Success: no issues found in 22 source files

$ npm run dev:backend
INFO:     Uvicorn running on http://127.0.0.1:8012 (Press CTRL+C to quit)
$ curl -fsS http://localhost:8012/api/health
{"status":"ok"}
$ curl -s -H "Origin: http://localhost:3002" -I localhost:8012/api/health | grep -i access-control
access-control-allow-origin: http://localhost:3002

$ scripts/contract-test.sh               # schemathesis not on PATH, so the script's reachability fallback runs
13 documented path(s), 0 unreachable
NOTE: this is reachability only, NOT schema conformance.

$ st run docs/openapi.yaml --url http://localhost:8012 --checks all --max-examples 30   # schemathesis 4.33.4
864 generated, 3 found 3 unique failures
  ST202 Schema-valid request rejected: 3
    truck_out with truck_ids []  -> 422 truck_ids   (documented companion rule)
    all-zero weights             -> 422 weights     (documented rule)
    override without reason      -> 422 reason      (documented rule)
```
The first schemathesis run found 19 problems: 13 missing `Allow` headers, 3 undecodable bodies answered 400 instead of 422, 1 explicit null accepted, and 2 of the expected rule rejections. All except the expected rule rejections are fixed, with regression tests (273d7ab).

### What Was NOT Verified
- **`scripts/contract-test.sh` with schemathesis does not run.** The script passes `--base-url`, which schemathesis 4.x renamed to `--url`, so with schemathesis on PATH it exits 2 ("No such option '--base-url'"). I ran schemathesis directly instead (output above). The script belongs to the manager and needs the flag updated.
- **Frontend integration.** No browser and no frontend were run against this service. CORS was checked only with curl and TestClient.
- **ruff and mypy** ran from a scratch virtualenv. They are not in `requirements.txt` and the project has no lint configuration, so another environment may report different results.
- **Route data.** It is the OSRM car profile (no truck restrictions) as of today. I did not compare it with Google or other routing, and OSRM "highway" detection is based on road names.
- **Fresh clone setup (D-1).** I did not test a fresh clone. `pip install -r backend/requirements.txt` was not run because every dependency was already importable on this machine.
- **Concurrency.** It is a single in-process lock, sized for one user and one process. Load was not tested.
- **TASK-005** (live feeds) is not started. `/api/feeds/candidates` returns the "not enabled" stub the contract requires.

### Known Issues
- Pydantic lax mode accepts numeric strings (for example `"lat": "34"`). This is more permissive than the YAML but harmless.
- A reschedule does not use up warehouse capacity for later options; free slots come only from the seed `booked` count, as the spec defines them.
- `npm run dev:backend` uses `--reload`, which is fine for the demo. Don't edit backend files while presenting.

### Commit
`bb943d8` (code). This handoff and the status update are in the commit that follows it.
