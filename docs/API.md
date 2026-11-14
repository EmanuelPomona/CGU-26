# API Contract

**`docs/openapi.yaml` is the single authoritative artifact.** Every path, field,
enum, nullability rule and error is defined there and nowhere else. This file is
its prose companion: what each consumer job needs, and the semantics a schema
cannot express. If the two disagree, the YAML wins and the disagreement is a
defect to report in your handoff.

Manager owns both. Changes go through `docs/AGENT_PROTOCOL.md` section 6. Never
change an implementation first and the contract afterward.

## Owners and consumers

| Side | Owner | Proof it must show |
|---|---|---|
| Provider | backend (`backend/`) | a pytest that validates every endpoint's real response against the schemas in `docs/openapi.yaml`; `scripts/contract-test.sh` passing |
| Consumer | frontend (`frontend/`) | TypeScript types **generated** from `docs/openapi.yaml` (`openapi-typescript`), never handwritten; mock fixtures typed with `satisfies` against them |

Frontend uses no field that is not in the YAML. Backend returns no field that is
not in the YAML.

## Base URL

Development: `http://localhost:$BACKEND_PORT` (frontend reads `VITE_API_BASE_URL`).

Production: none.

## Conventions

- JSON only. `Content-Type: application/json`.
- Times of day are integer minutes after local midnight (555 = 9:15 AM).
- Miles, USD, kilograms of CO2, hours for driver time.
- Route geometry is `[[lat, lng], ...]`.
- IDs are opaque strings.
- **Every mutation returns the full updated `Board`** (decisions return
  `{decision, board}`), so the client never has to refetch after a write.
- State is one shared in-memory board. There are no sessions or users.

## Errors

One shape, `Error` in the YAML: `{ "error": code, "message": text, "field"?: name }`.

| HTTP | `error` | When |
|---|---|---|
| 422 | `validation_error` | body fails the schema, a referenced id does not exist in the body (`shipment_id`, `truck_ids`, `warehouse_id`), a kind's required companion field is missing, weights all zero, or `reason` missing on an override. `field` names the offender. |
| 404 | `not_found` | id in the URL path does not exist |
| 409 | `option_infeasible` | `POST /api/decisions` names an option that is infeasible or no longer offered under current conditions |
| 500 | `internal_error` | anything unexpected; message is generic |

FastAPI's default 422 body is **not** this shape. Backend must install an
exception handler that converts it.

---

# Endpoints by consumer job

## 1. Draw the fixed world

`GET /api/network` once at load: terminals, warehouses, trucks, sensitive places.

`GET /api/method` when the Method page opens: assumptions, formulas, data
sources, what is not modeled, and how each responsible-design consideration is
met. The Method page renders this; it holds no copy of its own.

## 2. Show the board

`GET /api/board` returns everything the main screen needs in one call:

- `settings`: clock and weights
- `disruptions`: all, including dismissed, oldest first
- `pending_verification_ids`: the unverified ones, which drive the verification prompt
- `shipments`: 7 rows, fixed order. Each has three evaluations:
  - `normal`: original plan, no disruptions
  - `changed`: original plan under active disruptions
  - `current`: plan in force (decision applied) under active disruptions
  
  With no disruptions and no decisions all three are equal.
  The appointment strip draws `normal.eta_min` as the ghost tick and
  `current.eta_min` as the live tick, whisker = `eta_sigma_min`, hollow when
  `current.needs_review`.
- `indicators`: `normal`, `changed`, `decided`, plus `checks`
- `decisions`: the log

`attention` on a row: `act` when `current.status` is `at_risk`, `watch` when it
is `tight` or `needs_review` is true, otherwise `none`. The UI offers options
prominently only for `act` rows (the whiteboard rule: reroute only if the
appointment would be missed) but may open options for any row.

## 3. Change a condition and verify it

`GET /api/presets` lists the one-click what-ifs. The client POSTs a preset's
`disruption` object unchanged to `POST /api/disruptions`.

`POST /api/disruptions` creates a disruption. **It always starts `unverified`.**

`PATCH /api/disruptions/{id}` with `{verification, note?}` records what the
dispatcher found out:

| verification | Effect on every calculation |
|---|---|
| `unverified` | applied; closures and hazards block with probability = `confidence`; affected evaluations get `needs_review: true` and a flag |
| `confirmed` | applied as certain (confidence treated as 1.0); `needs_review` false |
| `dismissed` | ignored completely, but kept in `disruptions` so the log shows a report was checked and rejected |

`DELETE /api/disruptions/{id}` removes it outright. Decisions already made are
kept and re-evaluated.

A disruption is **active** when its verification is not `dismissed`.

## 4. Compare responses

`GET /api/shipments/{id}/options`. `keep` is always the first option; the others
follow sorted by `scores.overall` descending. Kinds: `keep`, `reroute` (up to 2),
`spare_truck`, `swap_truck`, `reschedule`. An option kind is omitted when it does
not apply (for example no spare truck helps). At most one option has
`suggested: true`, and it is always feasible. `rationale` explains the
suggestion in plain words and names the weights. It must not use the words "AI",
"model predicts", or "optimal": the scoring is rule-based.

Option ids are deterministic for the same conditions, so the id the client read
is the id it posts back.

## 5. Decide

`POST /api/decisions` with `{shipment_id, option_id, reason?}`. The server
recomputes the options, finds that id, applies its plan, and returns
`{decision, board}` with 201. `reason` is required when the option is not the
suggested one (human override is welcome, and recorded). Choosing `keep` is a
valid, logged decision. A second decision for the same shipment replaces the
first. A `swap_truck` decision also changes the other shipment's truck and lists
it in `also_affects`.

`supervisor_update` is plain text the dispatcher can copy. The tool never sends
anything.

`DELETE /api/decisions/{id}` undoes it (and the other side of a swap).

## 6. Settings and reset

`PUT /api/settings` replaces clock and weights. Defaults after start and reset:
clock 480 (8:00 AM), weights reliability 35, cost 20, emissions 20, community 15,
driver 10 (the reference prototype's values). `POST /api/reset` returns to the
clean normal day.

## 7. Feed candidates (nice-to-have)

`GET /api/feeds/candidates` always answers 200. With no network it returns
`candidates: []` and each source with `ok: false`. The client may POST a
candidate's `suggested` body to `/api/disruptions`; nothing is applied otherwise.

---

# Evaluation model (normative)

The backend ports the reference in `docs/reference/sample-prototype.html`
(functions `exposure`, `recvExposure`, `community`, `trafficMult`, `evalPlan`,
`summarize`, `buildOptions`, `scoreOptions`, `draftMsg`). Where this section and
the reference differ, this section wins. All values are **simulated assumptions**
and must be served by `/api/method` with `kind: simulated`.

Constants: gate time 40 min; unload 45 min; closure/hazard penalty 150 min;
no-truck lateness 180 min; detention $1.20 per late minute; $2.10 per mile;
driver $38 per hour; CO2 1.75 kg/mi loaded, 1.30 kg/mi empty, 0.136 kg per idle
minute; congestion adds 30% CO2 on congested miles; deadhead speed 28 mph;
straight-line circuity 1.35; reschedule fee $75; sensitive-place radius 250 m.

Rules, in order:

1. **Truck.** Unavailable when the plan has no truck or the truck is in an
   active `truck_out`. Then: late = 180, on-time probability 0.05, flag
   "No truck available", infeasible.
2. **Pickup.** Deadhead miles = haversine(truck, terminal) x 1.35 at 28 mph.
   Ready time = seed ready + active `pickup_delay`. Pickup = max(arrival at
   terminal, ready). Depart = pickup + 40.
3. **Drive time.** Route base minutes x traffic multiplier at departure
   (two Gaussian peaks at 7:30 and 17:00, reference `trafficMult`, scale 1).
   For each active `slowdown` whose circle touches the route: add (time spent
   inside) x (factor - 1). For active `closure` and `hazard` touching the route:
   blocked probability = max over them of effective confidence (1.0 if
   confirmed).
4. **Arrival.** ETA = depart + drive + blocked probability x 150 + dock queue
   (90 x active `dock_cut` fraction at that warehouse). Sigma = 6 + 0.12 x drive
   minutes. On-time probability mixes the unblocked and blocked cases with the
   normal CDF exactly as the reference does.
5. **Status.** `at_risk` when on-time probability < 0.5; `tight` when < 0.85 or
   slack < 15 min; else `on_time`.
6. **Driver.** Hours = deadhead + wait + gate + drive + block + queue + unload +
   return (0.9 x base). Over = hours - `hours_available`, floored at 0. Over > 0
   makes an option infeasible.
7. **Cost, CO2.** As the reference `evalPlan`.
8. **Community score.** As the reference `community`: 100 minus local-street
   miles x 1.5 (cap 30) minus weighted sensitive places within 250 m (cap 50),
   night multiplier 1.5 between 20:00 and 06:00.
9. **Options.** As the reference `buildOptions`, except: no `hold` option; ids as
   in the YAML; `reschedule` searches +15 to +180 in 15-minute steps for the
   first shift reaching on-time probability 0.85 and is infeasible when the
   warehouse has at most 1 free slot.
10. **Scores.** As the reference `scoreOptions`. Infeasible options are never
    suggested.
11. **Checks.** `added_miles_review`: decided fleet miles exceed normal by more
    than 20 (an example threshold from the organizer workshop, not an operating
    standard; say so in `detail`). `new_at_risk`: changed at-risk count exceeds
    normal. `driver_hours`: any driver over hours in decided. `unverified_inputs`:
    any unverified disruption is active.

Rounding at the API boundary: `*_min` integers are rounded half up; miles, cost,
CO2, hours to 1 decimal; probabilities to 2 decimals; scores to whole numbers.

## Presets (served by `/api/presets`, all `source: simulated`)

| id | kind | values |
|---|---|---|
| `slow710` | slowdown | I-710 crash, 33.91, -118.204, 4 km, factor 2.6, confidence 0.9 |
| `close60` | closure | SR-60 full closure, 34.0, -117.88, 2 km, confidence 0.8 |
| `fire` | hazard | wildfire zone near Fontana, take center/radius from the reference, confidence 0.6 |
| `flood` | hazard | flooding near Vernon / LA River, from the reference, confidence 0.5 |
| `pickup103` | pickup_delay | C-103, 120 min |
| `trucks35` | truck_out | T3, T5 |
| `docksONT` | dock_cut | ONT, 0.5 |

Confidence values below 1 are deliberate: they make the verification step
change the numbers.

---

# Example (illustrative, not a second source of truth)

```http
POST /api/disruptions
{ "kind": "closure", "label": "SR-60 full closure", "source": "simulated",
  "confidence": 0.8, "area": { "lat": 34.0, "lng": -117.88, "radius_km": 2 } }

201 -> Board, in which:
  disruptions[-1] = { "id": "D-1", "kind": "closure", "verification": "unverified",
                      "affected_shipment_ids": ["C-103", "C-107"], ... }
  pending_verification_ids = ["D-1"]
  shipments[2].current = { "status": "at_risk", "needs_review": true, ... }

PATCH /api/disruptions/D-1   { "verification": "dismissed", "note": "Caltrans says open" }
200 -> Board with shipments[2].current equal to shipments[2].normal
```

The affected ids above are an illustration; the real ones come from the engine.
