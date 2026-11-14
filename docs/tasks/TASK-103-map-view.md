---
id: TASK-103
title: Map view
status: READY
owner: frontend
branch: agent/frontend
priority: HIGH
round: 0
depends_on: [TASK-101]
blocked_on: ""
---

# TASK-103 — Map view

## Objective

Build the Leaflet map in the nautical-chart manner: a quiet base on which only
routes, destinations, hazards and sensitive places carry ink, kept in sync with
board selection.

## Scope

- `frontend/src/components/MapView.tsx`, `MapView.css`
- `frontend/src/lib/mapStyle.ts`

## Acceptance Criteria

- [ ] Basemap is CARTO Positron (or equally muted) with correct attribution; if tiles fail, overlays still render on the canvas color and the rest of the app is unaffected.
- [ ] Terminals, warehouses and trucks are drawn as simple geometric SVG markers with text labels, one icon system, no emoji (design constraints 6).
- [ ] Every shipment's current route is drawn thin in the ghost color; the selected shipment's route is drawn in the action color on top, and when its `route.id` differs from `normal_route_id` the normal route stays as a dashed ghost. A route with `estimated: true` is dashed and labeled "estimated path".
- [ ] Disruptions with an `area` are circles: confirmed = solid outline in the at-risk color with light fill; unverified = dashed outline in the unverified color with diagonal hatch fill; dismissed = thin grey outline, no fill. Each has a popover with label, source, verification and confidence as a percentage.
- [ ] Sensitive places are small markers distinguished by shape (school, hospital, residential) with a legend; those within 250 m of the selected route are emphasized. A "Sensitive places" toggle hides them.
- [ ] Selecting a row on the board fits the map to that route; clicking a route or its warehouse marker selects that shipment (acceptance F-3).
- [ ] A legend explains solid vs dashed (confirmed vs unverified/estimated) in words.
- [ ] The map accepts a `placing` mode prop: when on, the cursor changes, a hint reads "Click the map to place it", and a click reports `{lat, lng}` to the parent (used by TASK-104) and does nothing else.
- [ ] Map controls are keyboard reachable; the map container has an accessible name; at 390px the map is a collapsed strip that expands on tap.
- [ ] Leaflet is created once and updated by diffing layers; changing selection does not recreate the map (no flicker, verified by eye and by a single `L.map` call).

## Notes

Read `docs/DESIGN_BRIEF.md`, `docs/DESIGN_CONSTRAINTS.md`, `docs/API.md` and `docs/openapi.yaml` first. Run the mandatory design skills in `docs/SKILL_ROUTING.md` before major UI. Commit after each passing step (protocol section 24).

- Leaflet directly through a ref. Geometry arrives as `[lat, lng][]`, ready for `L.polyline`.
- Hatch fill: an SVG `<pattern>` injected into Leaflet's overlay pane.
- Can be built in parallel with TASK-102; both only depend on TASK-101.

## Review History

| Round | Verdict | Summary |
|---|---|---|
