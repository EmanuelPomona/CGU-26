# Interactive Reroute Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start from a clean map of trucks only, let the dispatcher pick a truck origin and a destination, then after each obstacle is placed recompute **three** uniquely algorithm-backed reroutes and show explicit tradeoffs for each.

**Architecture:** Add a **Route studio** mode on the Map view. The frontend draws trucks, the chosen OD pair, obstacles, and up to three alternative polylines; the backend owns a small SoCal road graph and three pure graph solvers. Placing an obstacle calls `POST /api/studio/reroute`, which returns three alternatives with metrics and tradeoff copy. Numbers never move to the browser (same split as `docs/ARCHITECTURE.md`).

**Tech Stack:** FastAPI + in-memory / bundled `road_graph.json`, Python graph solvers (stdlib heapq), React + Leaflet, existing obstacle palette (`ObstacleType`).

**Spec:** this document, section [Feature spec](#feature-spec).

## Feature spec

### User story

As a dispatcher, I want to start with trucks on a blank map, choose where a truck is going, drop obstacles on the way, and immediately see three different reroutes with clear tradeoffs so I can defend which path I pick.

### Interaction flow

1. **Blank slate (default in Route studio)**  
   - Map shows **trucks only** (and basemap).  
   - No shipment polylines, no condition circles, no Day-vs-changed panel noise required.  
   - Obstacle palette is **disabled** until an origin and destination exist.

2. **Choose origin**  
   - Click a truck marker → origin = that truck’s lat/lng (and `truck_id`).  
   - Visual: selected truck highlighted; toast or chip: “Origin: T3 · Driver 03”.

3. **Choose destination**  
   - Click the map (or a warehouse marker) → destination lat/lng.  
   - Snap destination to nearest graph node within **3 km**; if none, reject: “Pick a place on the road network.”  
   - On success, backend returns the **baseline** path (Fastest / Dijkstra with no obstacles) and the map draws that single polyline.

4. **Add obstacles**  
   - Palette enables. Drag/click-place obstacles (same four types as today).  
   - Obstacles **do not** need to snap to an existing shipment route; they snap to the **active studio path or the road graph** (nearest edge within **2 km**, else “Drop near the route or a road.”).  
   - Each successful place **recomputes** three alternatives against the full obstacle set.

5. **Three reroutes (always unique)**  
   After every obstacle add (and on first baseline), the UI shows three cards + three map layers:

| Slot | Display name | Algorithm | Edge cost | What makes it unique |
|---|---|---|---|---|
| A | **Fastest** | Dijkstra | `travel_s` | Classic shortest path on expected drive time |
| B | **Direct** | A* | `length_m`, heuristic = haversine × 1.0 | Geographic pull to the destination; prefers shorter road distance, not time |
| C | **Avoid hazards** | Obstacle-penalized Dijkstra | `travel_s + Σ penalties` for edges whose geometry intersects an obstacle buffer | Soft avoidance: buffers scale by type (closure/hazard hard-ish, traffic milder) |

   Exact penalty constants (meters / seconds) are pinned in Task 2 tests.

6. **Tradeoffs (required copy per alternative)**  
   Each alternative returns:
   - `algorithm`, `label`, `summary` (one sentence), `pros[]`, `cons[]` (2 bullets each max),  
   - metrics: `eta_min`, `distance_km`, `co2_kg` (est.), `obstacle_exposure` (0–1), `local_street_km`,  
   - `geometry` polyline, `node_ids`.  
   Tradeoff text is **server-authored** from the metrics (templates), not free-form LLM.

7. **Out of scope**  
   - Replacing the existing shipment board / appointment engine.  
   - Live OSRM at runtime (build graph offline).  
   - Editing obstacle radius after place.  
   - More than one concurrent studio OD pair.

## Global Constraints

- Backend owns all pathfinding and tradeoff text; frontend only renders.
- Three algorithms must remain **structurally different** (Dijkstra time vs A* distance vs penalized Dijkstra) — do not fake three styles of the same path.
- If two solvers return geometries with Jaccard similarity of sampled points **> 0.92**, the server must diversify: for slot C raise penalty ×1.5 and re-solve once; if still tied, mark slot C `feasible: false` with reason `no_distinct_avoidance_path`.
- Obstacle types stay `road_closure | wildfire | flood | traffic` with existing icons.
- Contract change: new OpenAPI paths under `/api/studio/*`; follow `docs/AGENT_PROTOCOL.md` section 6 (manager-owned contract) — this plan proposes the shapes below for the implementer to land with the OpenAPI update in the same PR as the backend task.
- Deterministic: same graph + OD + obstacles → same three results (stable sort by `label` then `eta_min`).

## Review Focus

- Blank studio shows trucks and no shipment routes even when `Board.shipments` has geometry.
- Destination farther than 3 km from every graph node → no path, clear error, obstacles stay disabled.
- Closure covering the only corridor → Avoid-hazards may be infeasible or much longer; Fastest/Direct may still cross with high `obstacle_exposure`.
- Adding a second obstacle recomputes all three (not incremental patch of one).
- A* and Dijkstra-time on an empty map can share a corridor; diversity rule must still leave the user with distinguishable cards (geometry or metrics differ, or an honest infeasible Avoid slot).

---

## File map

| File | Responsibility |
|---|---|
| `backend/data/road_graph.json` | Nodes + directed edges for SoCal corridors (bundled) |
| `backend/app/studio/graph.py` | Load graph, nearest-node, edge–obstacle intersection |
| `backend/app/studio/algorithms.py` | Dijkstra, A*, penalized Dijkstra |
| `backend/app/studio/tradeoffs.py` | Metrics + pros/cons templates |
| `backend/app/studio/service.py` | Orchestrate baseline + 3-way solve |
| `backend/app/routers/studio.py` | HTTP: session OD + obstacles + reroute |
| `backend/app/main.py` | Mount studio router |
| `docs/openapi.yaml` + `docs/API.md` | Contract for `/api/studio/*` |
| `frontend/src/dispatch/RouteStudio.tsx` | Mode chrome: origin/destination chips, alternative cards |
| `frontend/src/dispatch/DispatchMap.tsx` | Studio layers: trucks-only, OD, obstacles, 3 routes |
| `frontend/src/dispatch/DispatchApp.tsx` | Toggle Route studio vs board map |
| `frontend/src/api/client.ts` | Typed studio calls |
| `backend/tests/test_studio_*.py` | Graph + algorithm + API tests |
| `frontend/src/dispatch/routeStudio.test.ts` | Pure UI helpers if any |

---

### Proposed API (normative for this plan)

```
POST /api/studio/session
  { truck_id, destination: { lat, lng } }
  → StudioSession { id, origin, destination, baseline: StudioAlternative, alternatives: StudioAlternative[3], obstacles: [] }

POST /api/studio/session/{id}/obstacles
  { type: ObstacleType, lat, lng }   // server snaps
  → StudioSession  // alternatives recomputed

DELETE /api/studio/session/{id}/obstacles/{obstacle_id}
  → StudioSession

GET /api/studio/session/{id}
  → StudioSession
```

`StudioAlternative`: `{ id, slot: "fastest"|"direct"|"avoid", algorithm, label, feasible, infeasible_reason?, summary, pros, cons, metrics, geometry, node_ids }`

---

### Task 1: Bundled road graph

**Files:**
- Create: `backend/data/road_graph.json`
- Create: `backend/scripts/build_road_graph.py` (optional helper; committed output is the graph)
- Test: `backend/tests/test_studio_graph.py`

**Interfaces:**
- Produces JSON:
  - `nodes: [{ id, lat, lng, kind?: "hub"|"port"|"warehouse"|"junction" }]`
  - `edges: [{ id, u, v, length_m, travel_s, hwy: bool }]` directed; include reverse edges where roads are two-way
- Minimum coverage: POLA/POLB, Vernon, Commerce, SFS, Ontario, Fontana, Irvine + I-710 / I-110 / I-405 / SR-91 / I-10 / SR-60 corridors (≥ 40 nodes, ≥ 80 directed edges)
- `load_graph() -> RoadGraph` with `nearest_node(lat, lng, max_km=3) -> Node | None`

- [ ] **Step 1: Write failing tests** for `nearest_node` hitting a known hub and rejecting a point in the Pacific.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd backend && python3 -m pytest tests/test_studio_graph.py -q`

- [ ] **Step 3: Commit graph JSON + loader**

- [ ] **Step 4: Tests PASS; commit**

```bash
git add backend/data/road_graph.json backend/app/studio/graph.py backend/tests/test_studio_graph.py
git commit -m "feat: bundle SoCal road graph for route studio"
```

---

### Task 2: Three graph solvers + tradeoffs

**Files:**
- Create: `backend/app/studio/algorithms.py`
- Create: `backend/app/studio/tradeoffs.py`
- Test: `backend/tests/test_studio_algorithms.py`

**Interfaces:**
- `dijkstra_time(g, src, dst, obstacles) -> PathResult`
- `astar_distance(g, src, dst, obstacles) -> PathResult`  
  - g-score = sum `length_m`; h = haversine meters to dst; hard-block edges that **fully** lie inside a closure/hazard circle with confidence ≥ 0.8 (optional soft otherwise — pin in test)
- `dijkstra_avoid(g, src, dst, obstacles) -> PathResult`  
  - edge cost = `travel_s + penalty`  
  - penalties if edge intersects buffer: traffic `+0.35 * travel_s`, wildfire/flood `+2.0 * travel_s`, road_closure `+5.0 * travel_s` (or impassable if intersection length > 50% of edge)
- `PathResult`: `{ node_ids, edge_ids, travel_s, length_m, geometry, feasible, reason? }`
- `build_alternative(slot, result, obstacles, baseline) -> StudioAlternative` fills pros/cons from templates:
  - Fastest pros always mention time; cons mention exposure if `obstacle_exposure > 0.15`
  - Direct pros mention shorter km; cons mention possibly slower ETA
  - Avoid pros mention lower exposure; cons mention extra minutes vs Fastest

- [ ] **Step 1: Failing tests**
  - Empty obstacles: Fastest and Direct both feasible; paths may share nodes but algorithm field differs.
  - Closure on the unique cheapest time edge: Avoid’s `obstacle_exposure` **strictly less** than Fastest’s, or Avoid infeasible with `no_distinct_avoidance_path`.
  - Unreachable dst: all three `feasible: false`.

- [ ] **Step 2: Implement solvers + templates**

- [ ] **Step 3: Tests PASS; commit**

```bash
git commit -m "feat: Dijkstra, A*, and avoid solvers for studio reroutes"
```

---

### Task 3: Studio API + OpenAPI

**Files:**
- Create: `backend/app/routers/studio.py`, `backend/app/studio/service.py`, `backend/app/studio/state.py`
- Modify: `backend/app/main.py`, `docs/openapi.yaml`, `docs/API.md`
- Test: `backend/tests/test_studio_api.py`

**Interfaces:**
- In-memory sessions keyed by id (UUID), TTL not required for MVP.
- `POST /obstacles` snaps with `snap_to_graph_edge` (2 km); stores obstacle; calls `service.solve(session)`.
- `solve` always returns **exactly three** alternative objects (infeasible allowed).

- [ ] **Step 1: Contract entries in openapi.yaml** for schemas above

- [ ] **Step 2: Failing API tests** (create session from truck T3 → Ontario warehouse coords; add closure; assert 3 alternatives and tradeoff fields non-empty)

- [ ] **Step 3: Implement router + service**

- [ ] **Step 4: `pytest` + regenerate frontend types `npm --prefix frontend run gen:api`**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: studio session API with three-way reroute"
```

---

### Task 4: Frontend Route studio mode

**Files:**
- Create: `frontend/src/dispatch/RouteStudio.tsx`
- Modify: `DispatchApp.tsx`, `DispatchMap.tsx`, `dispatch.css`, `api/client.ts`
- Test: optional vitest for tradeoff card sorting helper

**Interfaces / UX:**
- Header control or map chip: **Board** | **Route studio**
- Studio map props: `studioMode`, `session`, `onPickTruck`, `onPickDestination`, `onObstacle…`
- When `studioMode`: hide shipment route polylines and board disruptions; show trucks + session layers only
- Right or bottom sheet: three alternative cards (Fastest / Direct / Avoid) with pros/cons and “Show on map” focus (bold that polyline)
- Obstacle palette enabled iff `session.origin && session.destination`

- [ ] **Step 1: Wire mode toggle + trucks-only rendering**

- [ ] **Step 2: OD picking + baseline draw**

- [ ] **Step 3: Obstacle place → POST → redraw three routes + cards**

- [ ] **Step 4: Manual demo**
  1. Route studio → click truck near ports → click Ontario area.  
  2. One baseline line.  
  3. Drop Road closure on the line → three cards with different algorithms and tradeoff bullets.  
  4. Drop Traffic → cards update again.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: route studio UI for OD pick and three reroutes"
```

---

### Task 5: Polish + verification

- [ ] Legend entries for the three route styles (solid / dash / dot)
- [ ] Escape cancels destination picking; Clear session button resets to trucks-only
- [ ] `npm --prefix frontend run test` and `cd backend && pytest -q` green
- [ ] Commit only if polish landed

---

## Self-review

- Spec coverage: blank trucks map, OD select, obstacles, three distinct algorithms, tradeoffs, recompute-on-add — Tasks 1–4.
- Diversity rule and snap thresholds pinned in Global Constraints / Review Focus and Task 2–3 tests.
- Does not replace the existing Dispatch board; it is an additive mode.

## Notes for the product owner

- The three algorithms are intentional teaching/demo hooks for GeoAI judges: **Dijkstra (time)**, **A\* (distance)**, **penalized Dijkstra (hazard avoidance)** — each with honest tradeoffs, not three skins of one path.
- Graph is bundled for reliability offline; quality depends on corridor coverage in `road_graph.json`.
