# Drag-and-drop route obstacles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a dispatcher drag one of four obstacle chips onto a shipment route on the map so the app creates a real disruption at that drop point and the board updates.

**Architecture:** Frontend-only UX on top of the existing `POST /api/disruptions` contract. A palette of four obstacle types lives beside the map; HTML5 drag-and-drop (with a click-then-place fallback for accessibility) converts a drop into lat/lng, snaps to the nearest loaded route geometry, and posts a `DisruptionCreate` body. No backend or OpenAPI change is required for the MVP.

**Tech Stack:** React 18, Leaflet 1.9, Vite, existing `createDisruption` client, FastAPI board already in place.

**Spec:** this document, section [Feature spec](#feature-spec) (also aligns with `docs/PRODUCT.md` disruption flow and `docs/openapi.yaml` `DisruptionCreate`).

## Feature spec

### User story

As a dispatcher on the **Map** view, I want a short list of obstacles I can drag onto a particular truck route so that I can what-if a condition at that place without typing coordinates.

### Obstacle set (palette)

| Palette label | API `kind` | Defaults on drop |
|---|---|---|
| Road closure | `closure` | `area.radius_km: 2`, `confidence: 0.8`, `label: "Road closure"` |
| Wildfire | `hazard` | `area.radius_km: 5`, `confidence: 0.6`, `label: "Wildfire"` |
| Flood | `hazard` | `area.radius_km: 3`, `confidence: 0.5`, `label: "Flood"` |
| Traffic | `slowdown` | `area.radius_km: 4`, `slowdown_factor: 2.2`, `confidence: 0.7`, `label: "Traffic slowdown"` |

> **Naming note:** the request said “food”; this plan uses **Flood**, which already exists in the product (`flood` preset / hazard). Confirm if a different meaning was intended.

All creates use `source: "dispatcher"` and start `unverified` (server rule). Existing verify / dismiss / delete UI keeps working.

### Interaction

1. Palette is visible whenever the map view is showing routes (Map / To dispatch map panel — not required on Network-only chrome).
2. Drag a chip onto the map. On drop:
   - Convert pointer to lat/lng via Leaflet.
   - Find the nearest point on any currently drawn **shipment route** polyline (from `board.shipments[*].current.route` or the layer the map already draws). If the nearest distance is **> 2 km**, reject the drop with a short inline message: “Drop on a route.”
   - Snap the disruption center to that nearest route point (so the obstacle sits on the route, not off in empty map space).
3. Call `createDisruption(...)`; on success, board refresh already redraws the condition circle and affected shipments.
4. Keyboard / no-drag fallback: click a palette chip (selected state), then click the map once to place (same snap rules). Escape cancels place mode.
5. Out of scope for this plan: resizing radius after place, custom labels, drawing free polygons, live-feed scout changes, new disruption kinds.

## Global Constraints

- Do not add new OpenAPI kinds; map the four chips onto `closure` / `hazard` / `slowdown` only.
- Reuse `createDisruption` from `frontend/src/api/client.ts`; do not invent a parallel mock-only write path when `VITE_USE_MOCK=0`.
- Keep visual language inside `frontend/src/dispatch/dispatch.css` / existing Dispatch tokens (`docs/DESIGN_CONSTRAINTS.md`); no new card-heavy chrome in the map hero.
- Disruption still starts `unverified`; do not auto-confirm on drop.
- Snap threshold: **2 km**; radius / factor defaults are the table above (exact values).

## Review Focus

- Drop far from every route → no API call, “Drop on a route.” shown.
- Two routes nearly equidistant → nearest wins; ties break by smaller haversine distance, then shipment id ascending.
- Wildfire and Flood both post `kind: "hazard"` but different `label` and `radius_km`.
- Place-mode click after selecting Traffic includes `slowdown_factor: 2.2`; Road closure must not send `slowdown_factor`.
- Drag cancelled (Escape / dragend outside map) leaves board unchanged.

---

## File map

| File | Responsibility |
|---|---|
| `frontend/src/dispatch/obstacleCatalog.ts` | Palette definitions + `toDisruptionCreate(type, lat, lng)` |
| `frontend/src/dispatch/routeSnap.ts` | Pure geometry: nearest point on polylines, distance km |
| `frontend/src/dispatch/ObstaclePalette.tsx` | Draggable chips + selected place-mode UI |
| `frontend/src/dispatch/DispatchMap.tsx` | Drop / place handlers, latlng conversion, snap, callback |
| `frontend/src/dispatch/DispatchApp.tsx` | Wire palette → `createDisruption`, error toast |
| `frontend/src/dispatch/dispatch.css` | Palette and chip styles |
| `frontend/src/dispatch/routeSnap.test.ts` | Snap and reject-distance tests |
| `frontend/src/dispatch/obstacleCatalog.test.ts` | Body shape per obstacle type |

---

### Task 1: Obstacle catalog and create payloads

**Files:**
- Create: `frontend/src/dispatch/obstacleCatalog.ts`
- Test: `frontend/src/dispatch/obstacleCatalog.test.ts`

**Interfaces:**
- Consumes: `DisruptionCreate` from `frontend/src/api/types.ts`
- Produces:
  - `export type ObstacleType = 'road_closure' | 'wildfire' | 'flood' | 'traffic'`
  - `export type ObstacleDef = { type: ObstacleType; label: string; kind: 'closure' | 'hazard' | 'slowdown' }`
  - `export const OBSTACLES: readonly ObstacleDef[]` — four entries in table order
  - `export function toDisruptionCreate(type: ObstacleType, lat: number, lng: number): DisruptionCreate`

- [ ] **Step 1: Write the failing tests**

```ts
it('maps traffic to slowdown with factor 2.2', () => {
  const body = toDisruptionCreate('traffic', 34.0, -117.88);
  expect(body).toMatchObject({
    kind: 'slowdown',
    label: 'Traffic slowdown',
    source: 'dispatcher',
    confidence: 0.7,
    slowdown_factor: 2.2,
    area: { lat: 34.0, lng: -117.88, radius_km: 4 },
  });
});

it('maps road_closure without slowdown_factor', () => {
  const body = toDisruptionCreate('road_closure', 34.0, -117.88);
  expect(body.kind).toBe('closure');
  expect(body.slowdown_factor).toBeUndefined();
  expect(body.area?.radius_km).toBe(2);
});

it('maps wildfire and flood as distinct hazard labels', () => {
  expect(toDisruptionCreate('wildfire', 1, 2).label).toBe('Wildfire');
  expect(toDisruptionCreate('flood', 1, 2).label).toBe('Flood');
  expect(toDisruptionCreate('wildfire', 1, 2).area?.radius_km).toBe(5);
  expect(toDisruptionCreate('flood', 1, 2).area?.radius_km).toBe(3);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm --prefix frontend run test -- src/dispatch/obstacleCatalog.test.ts`
Expected: FAIL (module missing)

- [ ] **Step 3: Implement `obstacleCatalog.ts`**

Exact defaults from the Feature spec table. `OBSTACLES` order: road closure, wildfire, flood, traffic.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/dispatch/obstacleCatalog.ts frontend/src/dispatch/obstacleCatalog.test.ts
git commit -m "feat: catalog drag-drop obstacle create payloads"
```

---

### Task 2: Snap drop point to nearest route

**Files:**
- Create: `frontend/src/dispatch/routeSnap.ts`
- Test: `frontend/src/dispatch/routeSnap.test.ts`

**Interfaces:**
- Consumes: route shapes as `Array<{ shipmentId: string; latlngs: Array<[number, number]> }>` (lat, lng)
- Produces:
  - `export type SnapHit = { shipmentId: string; lat: number; lng: number; distanceKm: number }`
  - `export function snapToNearestRoute(lat: number, lng: number, routes: Array<{ shipmentId: string; latlngs: Array<[number, number]> }>, maxKm?: number): SnapHit | null`
  - Default `maxKm = 2`

- [ ] **Step 1: Write the failing tests**

```ts
const route = {
  shipmentId: 'C-103',
  latlngs: [[34.0, -118.0], [34.0, -117.9]] as Array<[number, number]>,
};

it('snaps to the closest point on the segment', () => {
  const hit = snapToNearestRoute(34.01, -117.95, [route]);
  expect(hit?.shipmentId).toBe('C-103');
  expect(hit!.distanceKm).toBeLessThan(2);
  expect(hit!.lat).toBeCloseTo(34.0, 3);
  expect(hit!.lng).toBeCloseTo(-117.95, 3);
});

it('returns null when farther than 2 km', () => {
  expect(snapToNearestRoute(35.0, -117.95, [route])).toBeNull();
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm --prefix frontend run test -- src/dispatch/routeSnap.test.ts`

- [ ] **Step 3: Implement haversine + point-to-segment snap in `routeSnap.ts`**

Prefer the existing distance helpers pattern from the sample prototype if useful; keep the module dependency-free (no Leaflet import).

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/dispatch/routeSnap.ts frontend/src/dispatch/routeSnap.test.ts
git commit -m "feat: snap obstacle drops to nearest shipment route"
```

---

### Task 3: Obstacle palette UI

**Files:**
- Create: `frontend/src/dispatch/ObstaclePalette.tsx`
- Modify: `frontend/src/dispatch/dispatch.css` (palette block only)

**Interfaces:**
- Consumes: `OBSTACLES`, `ObstacleType` from Task 1
- Produces:
  - `export function ObstaclePalette(props: { selected: ObstacleType | null; onSelect: (t: ObstacleType | null) => void; disabled?: boolean }): JSX.Element`
  - Each chip: `draggable`, `data-obstacle-type={type}`, `aria-grabbed` / selected styling when `selected === type`
  - On dragstart: `dataTransfer.setData('application/x-dispatch-obstacle', type)` and `effectAllowed = 'copy'`
  - Click toggles place-mode selection (second click on same chip clears)

- [ ] **Step 1: Add palette markup + CSS** — four chips, labels exactly: “Road closure”, “Wildfire”, “Flood”, “Traffic”. Compact strip suitable for the left rail or under the map toolbar; no card chrome.

- [ ] **Step 2: Manual check in Story-less Vite** — render via temporary import in `DispatchApp` if needed; chips visible, selectable, draggable.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/dispatch/ObstaclePalette.tsx frontend/src/dispatch/dispatch.css
git commit -m "feat: add obstacle palette chips for map drag-drop"
```

---

### Task 4: Map drop / place wiring

**Files:**
- Modify: `frontend/src/dispatch/DispatchMap.tsx`
- Modify: `frontend/src/dispatch/DispatchApp.tsx`

**Interfaces:**
- Consumes: `snapToNearestRoute`, `toDisruptionCreate`, `ObstaclePalette`, `createDisruption`
- Produces (map props additions):
  - `placeType: ObstacleType | null`
  - `onPlaceCancel: () => void`
  - `onObstacleDrop: (type: ObstacleType, lat: number, lng: number) => void` — App snaps? **No:** Map snaps using current route layers, then calls `onObstaclePlaced(body: DisruptionCreate) | onObstacleRejected(reason: string)`
  - Prefer: Map calls `onObstaclePlaced(type, snappedLat, snappedLng)` after successful snap; App builds body + posts.

Concrete App handler:

```ts
async function placeObstacle(type: ObstacleType, lat: number, lng: number) {
  await createDisruption(toDisruptionCreate(type, lat, lng));
  // useBoard already refreshes from returned Board if wired that way; otherwise setBoard from response
}
```

Map behavior:
- Listen for `dragover` / `drop` on the map container (preventDefault on dragover).
- Read `application/x-dispatch-obstacle`.
- `map.mouseEventToLatLng` / container point → latlng.
- Build `routes` from the same shipment polylines currently drawn for the Map view.
- If `snapToNearestRoute` returns null → `onObstacleRejected('Drop on a route.')`.
- If place-mode (`placeType` set): next map click places once, then `onPlaceCancel()`.
- Escape key clears place-mode.

- [ ] **Step 1: Wire palette into `DispatchApp` next to the map panel; pass handlers.**

- [ ] **Step 2: Implement drop + click-place on `DispatchMap`.**

- [ ] **Step 3: Manual demo path**
  1. Open http://localhost:3000 Map view with backend on 8000.
  2. Drag **Traffic** onto C-103’s route → board shows a slowdown circle; shipment may go tight/at-risk.
  3. Drag **Road closure** onto empty ocean → message “Drop on a route.”; no new disruption.
  4. Click **Flood**, click a route → hazard appears; verify popup still works.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/dispatch/DispatchMap.tsx frontend/src/dispatch/DispatchApp.tsx
git commit -m "feat: drop palette obstacles onto shipment routes"
```

---

### Task 5: Smoke polish

**Files:**
- Modify only if Task 4 left sharp edges: `dispatch.css`, error banner copy in `DispatchApp.tsx`

- [ ] **Step 1: Confirm mock mode** — with `VITE_USE_MOCK=1`, drop still works if mock `POST /api/disruptions` exists; if not, document that live backend is required for this feature (do not expand mock unless already supporting create).

- [ ] **Step 2: Run frontend unit tests**

Run: `npm --prefix frontend run test`
Expected: PASS including new catalog/snap tests

- [ ] **Step 3: Commit only if there were polish edits**

---

## Out of scope / follow-ups

- Editing radius after placement
- Obstacle subtypes beyond the four chips
- Snapping to Network graph edges instead of shipment routes
- Touch-specific drag affordances beyond HTML5 + click-to-place
- Contract changes (not needed for MVP)

## Self-review

- Spec coverage: palette, four types, drag + click-place, snap-to-route, API create, reject far drops — Tasks 1–4.
- Types: `ObstacleType` / `toDisruptionCreate` / `snapToNearestRoute` names consistent across tasks.
- Review Focus cases pinned in Task 1 tests (hazard labels, slowdown factor) and Task 2 tests (far drop); UI reject message verified in Task 4 manual path.
