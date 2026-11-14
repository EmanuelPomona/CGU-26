# Data Design

## Provider

None. In-process memory, rebuilt from committed JSON at start and on
`POST /api/reset` (ADR-002). This file is the schema contract for that data:
backend may not add an entity or field the frontend would consume without the
contract change procedure.

## Seed files (`backend/data/`, committed)

| File | Contents | Origin |
|---|---|---|
| `network.json` | terminals, warehouses, trucks, sensitive places | copied from the reference prototype's `TERM`, `WH`, `TRUCKS`, `RECV_SIM`; all fictional |
| `shipments.json` | 7 container moves with their original truck | reference `ORDERS` |
| `presets.json` | the 7 presets in `docs/API.md` | reference presets, confidence adjusted |
| `routes.json` | route candidates per terminal-warehouse pair with step detail | generated once by `backend/scripts/fetch_routes.py` from OSRM |

---

# Entities

Field names below are the stored names. Where an entity is served by the API its
public shape is the schema of the same name in `docs/openapi.yaml`.

## Terminal, Warehouse, Truck, SensitivePlace

Exactly the API schemas. IDs: terminals `POLA`, `POLB`; warehouses `VER`, `COM`,
`SFS`, `ONT`, `FON`, `IRV`; trucks `T1`..`T9` (`T8`, `T9` spare); sensitive
places `SP-01`..`SP-30`.

## Shipment (seed)

| Field | Type | Required | Notes |
|---|---|---|---|
| id | string | yes | `C-101`..`C-107` |
| terminal_id | string | yes | |
| warehouse_id | string | yes | |
| truck_id | string | yes | original assignment |
| ready_min | int | yes | container ready for pickup |
| appt_start_min | int | yes | receiving window |
| appt_end_min | int | yes | |
| cargo | string | yes | |
| priority | `normal` \| `high` | yes | |

## Route (seed, internal detail beyond the API schema)

| Field | Type | Required | Notes |
|---|---|---|---|
| id | string | yes | `<terminal>-<warehouse>-<n>`, n = 0 is the original route |
| pair | string | yes | `<terminal>><warehouse>` |
| label, via, distance_mi, base_minutes, estimated, geometry | | yes | as API `Route` |
| steps | array | yes | internal only: `{geometry, distance_m, duration_s, highway: bool}` per road segment, used for exposure and local-street miles. Never served. |

At least 2 candidates per pair where OSRM returns alternatives, up to 5
including via-hub detours (hub list from the reference `HUBS`).

## Disruption, Decision, Settings (runtime)

Exactly the API schemas. IDs are `D-<n>` and `DEC-<n>`, counters reset on reset.

## Plan (runtime, internal)

One per shipment: `{truck_id, route_id, appt_shift_min}`. The original plan is
the seed truck, route `-0`, shift 0. A decision replaces the plan; undo restores
the original.

---

# Relationships

```text
Terminal ──┐
           ├── Route (many per terminal-warehouse pair)
Warehouse ─┘
Shipment ── belongs to → Terminal, Warehouse
Shipment ── has one → Plan ── uses → Truck, Route
Disruption ── affects (computed) → Shipment
Decision ── replaces Plan of → Shipment (and of one other Shipment on a swap)
```

No personal data is stored. Drivers are labels.
