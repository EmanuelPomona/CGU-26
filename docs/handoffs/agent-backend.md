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

## HANDOFF-2 — agent/backend — 2026-11-14

### Summary
TASK-005 is done: `GET /api/feeds/candidates` now calls the live CHP incident feed and NWS California alerts, keeps items within 2 miles of each shipment's active route (the route of the plan in force), and suggests a `DisruptionCreate` for each. It never changes the board.

It is committed separately (`67dc912`) on top of HANDOFF-1 (`aa1e615`). Integration can merge `aa1e615` to take TASK-001..004 without TASK-005.

### Tasks Completed
TASK-005, all criteria met:
- **Offline.** The endpoint answers 200 well within 6 s (tests: under 6 s offline, under 1.5 s when a source hangs). Each source reports `ok: false` with an error string. All fetches share a 5 s budget, and the endpoint does not wait for a source that hangs.
- **Cache.** Results are cached for 60 s per source (test moves the cache clock forward). Tests use recorded fixtures in `backend/tests/fixtures/`. An autouse fixture in `conftest.py` blocks feed fetches in every test.
- **Suggested bodies.** Every `suggested` body is accepted unchanged by `POST /api/disruptions` (201, `unverified`), with `source: "public_feed"` and confidence at most 0.7: CHP 0.7, NWS 0.4.
- **Trust.** `trust` is `official_report` for both sources.
- **No side effects.** The board is byte-identical before and after the call (test).

### Files Changed
- `backend/app/feeds.py` (new), `backend/app/routers/feeds.py`
- `backend/tests/test_feeds.py`, `backend/tests/fixtures/{chp_sa.xml,nws_alerts.json}`
- `backend/tests/conftest.py` (blocks the network in tests), `backend/tests/test_static.py` (the stub test is now an offline test)

### Contracts
No change; this implements the existing `FeedCandidates` schema.
- CHP items become `slowdown` candidates: radius 1.5 km; factor 2.2 for hazard, fire, closure or signal types, otherwise 1.7.
- NWS items become `hazard` candidates: radius 15 km, centered on a fixed county point. The title says "region-level", because NWS gives no road-specific location.
- Candidate ids are `chp-<log id>` and `nws-<hash>`.

### Skills Used
| Skill | Stage invoked | What it actually changed |
|---|---|---|
| superpowers:verification-before-completion | after the TASK-005 commit, before this handoff | Fresh runs below; replayed schemathesis ST302 by hand to confirm it is the contracted replace-a-decision behavior |

TDD for this task: `test_feeds.py` was written and seen failing (ImportError: no `app.feeds`) before `feeds.py` existed. The TDD skill was already loaded this session; it was not re-invoked.

### Verification
```
$ cd backend && python3 -m pytest -q
142 passed in 2.25s
$ ruff check app tests scripts      -> All checks passed!
$ mypy app --ignore-missing-imports -> Success: no issues found in 23 source files

# live, real network, against the running service on 8012
$ time curl -fsS localhost:8012/api/feeds/candidates
sources: CHP incidents ok, NWS alerts ok; 8 candidates; real 1.15 s
  e.g. chp-261114LA0757 "Trfc Collision-Unkn Inj: Sr60 W / Garey Ave Onr (Baldwin Park)" 0.02 mi, near C-103, C-107
board disruptions after the call: 0

$ st run docs/openapi.yaml --url http://localhost:8012 --checks all --max-examples 20
668 generated: 3 ST202 (the documented rule rejections, as in HANDOFF-1) and 1 ST302.
  ST302: a stateful sequence posted a later decision for the same shipment, which replaced DEC-n before the DELETE.
  Replayed by hand: POST DEC-1, POST DEC-2 for the same shipment -> DELETE DEC-1 gives 404 (replaced, as contracted); DELETE DEC-2 gives 200.
```

### What Was NOT Verified
- Live feed content changes from minute to minute. The 8 candidates above are what the feeds returned at about 12:45 PM and will differ during the demo. With no venue Wi-Fi, the endpoint returns an empty list and both sources down, which the frontend must render as such.
- NWS candidates appear only when an alert's county point is within 2 miles of a route. None did during the live run. NWS parsing is covered only by the recorded fixture.
- Only the CHP XML format seen today and the recorded fixture are covered. A CHP format change would show up as `ok: false`, not as wrong data.
- Not tested in a browser.

### Known Issues
- When a source hangs, its fetch thread keeps running in the background until the socket timeout (5 s). Harmless for a single-user demo.

### Commit
`67dc912` (code). This handoff, the status update and the TASK-005 status are in the commit that follows it.

## HANDOFF-3 — agent/backend — 2026-11-14

### Summary
TASK-006 is done: every `Option` now carries `roles`, as defined in `docs/openapi.yaml` and docs/API.md section 4 (ADR-007). The code is in commit `967627b`, made after merging `main` (`0a61ee4`).

### Tasks Completed
TASK-006, all criteria met:
- **Role pool.** Only feasible `keep` and `reroute` options can win a role:
  - `efficiency`: lowest `eta_min`
  - `sustainability`: lowest `co2_kg`
  - `community`: highest `community_score` among options arriving within 30 minutes of the earliest
- **Values and ties.** Roles are computed from unrounded engine values. A tie goes to the option that appears first in the response (keep first, then by score).
- **Coverage.** Each role is held exactly once whenever the pool is not empty. `spare_truck`, `swap_truck`, `reschedule` and every infeasible option get `[]`. When the pool is empty (for example `trucks35` for C-103 or C-105), every option gets `[]`.
- **Tests.** `test_roles.py` was written first and seen failing (9 failures: no `app.engine.roles`, no `roles` key). It covers:
  - three different winners
  - one option winning all three roles
  - the 30-minute exclusion (31 min excluded, exactly 30 min eligible)
  - `keep` infeasible
  - all options infeasible
  - ties
  - unrounded values deciding the winner
  - `assert_matches("OptionsResponse")` plus the role rules for all 7 shipments, on the normal day and under every preset (confirmed)
  - identical results on a repeated call

### Normal-day role holders (08:00, default weights)
| Shipment | Truck | Efficiency | Sustainability | Community | Different winners |
|---|---|---|---|---|---|
| C-101 | T2 | keep (9:21, 69.7 kg, 92) | keep | keep | 1 |
| C-102 | T1 | keep (9:23, 64.3 kg, 93) | keep | keep | 1 |
| C-103 | T3 | keep (10:33, 193.0 kg, 95) | **reroute:POLA-ONT-2** (10:38, 189.6 kg, 88) | keep | 2 |
| C-104 | T4 | keep (11:11, 204.0 kg, 90) | keep | **reroute:POLB-FON-1** (11:16, 218.1 kg, 90*) | 2 |
| C-105 | T5 | keep (9:26, 84.0 kg, 95) | keep | keep | 1 |
| C-106 | T6 | keep (11:27, 117.9 kg, 92) | keep | keep | 1 |
| C-107 | T7 | keep (10:10, 168.6 kg, 93) | keep | **reroute:POLB-ONT-1** (10:12, 174.1 kg, 94) | 2 |

\* C-104: both options show community 90 after rounding, but the reroute wins on the unrounded value. A viewer may find that confusing; C-107 shows the difference clearly (93 vs 94).

**No shipment has three different winners, on the normal day, under any preset (unverified or confirmed), or at any clock from 6:00 AM to 6:00 PM in 30-minute steps.** I searched all of them. The cause is in the data, not a bug: the pool holds only `keep` plus the 2 reroutes that rule 9 offers, and on the bundled OSRM routes the earliest route is also the lowest-CO2 or best-community one. I did not tune data or constants. For the demo, use **C-103** (keep is efficiency and community, reroute POLA-ONT-2 is sustainability) or **C-107** (keep is efficiency and sustainability, reroute POLB-ONT-1 is community). If three distinct cards are required, the manager could widen the role pool to every bundled route alternative for the pair (3 to 5 per pair). That would need a contract change; ask and I'll check whether it produces three different winners.

### Files Changed
- `backend/app/engine/roles.py` (new), `backend/app/engine/options.py` (calls `assign_roles` after ordering and serializes `roles`), `backend/tests/test_roles.py` (new)

### Contracts
Implements `Option.roles` exactly as written on main. No other change.

### Skills Used
| Skill | Stage invoked | What it actually changed |
|---|---|---|
| superpowers:verification-before-completion | after `967627b`, before this handoff | Fresh pytest, ruff, mypy and live-service check below |

TDD: the tests were written and seen failing first, following the TDD skill loaded earlier in this session. It was not re-invoked.

### Verification
```
$ cd backend && python3 -m pytest -q
151 passed in 2.83s
$ ruff check app tests scripts       -> All checks passed!
$ mypy app --ignore-missing-imports  -> Success: no issues found in 24 source files
$ curl -fsS localhost:8012/api/shipments/C-103/options   # live service, auto-reloaded
[('keep', ['efficiency', 'community']), ('reroute:POLA-ONT-2', ['sustainability']), ('reroute:POLA-ONT-1', [])]
```

### What Was NOT Verified
- Not checked against the new Dispatch frontend (TASK-107) or in a browser.
- schemathesis was not re-run for this change. The roles field is checked by `assert_matches` on every options response in the tests.

### Known Issues
- No three-way split exists in the current data (see above).

### Commit
`967627b` (code). This handoff and the TASK-006 status are in the commit that follows it.

### HANDOFF-3 addendum — sustainability window (2026-11-14)
**Change.** Merged `main` (`844532c`). Per the updated `Option.roles` description, `sustainability` is now chosen only among options arriving within 30 minutes of the earliest, the same window as `community`. Commit `c30496a`. I did not touch the role pool, the constants or the data.

**Tests.** Two tests were added and seen failing before the change:
- A unit case where the cleanest option arrives 2.5 h late and is excluded, while an option at exactly 30 min stays eligible.
- The close60-confirmed case: for C-103 and C-107, the sustainability holder does not cross D-1, is within 30 min of the earliest, and is not at risk.

**Verification.**
```
$ cd backend && python3 -m pytest -q    -> 153 passed in 2.82s
$ ruff check app tests scripts          -> All checks passed!
$ mypy app --ignore-missing-imports     -> Success: no issues found in 24 source files
```

**Roles under close60 confirmed** (live service on 8012; efficiency / sustainability / community):

| Shipment | Roles |
|---|---|
| C-101, C-102, C-105, C-106 | keep holds all three |
| C-103 | reroute:POLA-ONT-1 (10:41, 207.0 kg, community 92, on time) holds all three; before this change, sustainability went to POLA-ONT-2 at 1:08 PM, at risk |
| C-104 | keep / keep / reroute:POLB-FON-1 |
| C-107 | reroute:POLB-ONT-1 (10:12, 174.1 kg, community 94, on time) holds all three; before this change, sustainability went to keep at 12:40 PM, at risk |

**Normal-day roles are unchanged.** Every option that won sustainability before was already within 30 minutes of the earliest. C-103 and C-107 remain the two-card demo trucks.
