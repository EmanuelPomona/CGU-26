# Architectural Decisions

This document records decisions that affect multiple parts of the system.

---

# Decision Template

## ADR-000 — Decision Name

Date:

Status:

Proposed / Accepted / Rejected / Superseded

### Context

What decision needed to be made?

### Decision

What was chosen?

### Reasoning

Why?

### Alternatives Considered

Option:

Why rejected:

### Consequences

What does this decision affect?

---

# Accepted Decisions

Deciders for all entries below: manager, on the owner's instruction to finish
planning without further questions. The owner can overturn any of them; a
reversal is a new ADR that supersedes the old one.

## ADR-001 — Build for the GeoAI track, perspective 3

Date: 2026-11-14

Status: Accepted

### Context

The supplied context file defaults to the Digital Twin track but calls that a
working assumption. Everything else supplied (organizer brief, workshop deck,
both whiteboard photos, the sample prototype) is GeoAI.

### Decision

We build a GeoAI port-to-warehouse decision-support tool under perspective 3,
Resilience, Cost, and Sustainability Intelligence.

### Alternatives Considered

Option: Digital Twin (personality file and judge). Why rejected: none of its kit
files were supplied, and the team's own whiteboard is headed GeoAI.

Option: GeoAI perspective 2 (capacity coordination). Why rejected: the
whiteboard scores responses on sustainability, efficiency and community impact,
which is perspective 3. Truck and dock capacity still appear as conditions.

### Consequences

Presentation is 10 minutes. Two responsible-design considerations are mandatory,
one of them fairness or environment; we demonstrate five.

## ADR-002 — Backend owns every number; state lives in memory

Date: 2026-11-14

Status: Accepted

### Context

The sample prototype computes everything in the browser in one file. We have
separate frontend and backend agents and need a boundary both can build against
in parallel.

### Decision

A FastAPI backend owns the dataset, the evaluation model, options, scoring and
decisions, and holds one board in process memory. The frontend only draws server
responses. No database.

### Alternatives Considered

Option: keep the engine in the browser and make the backend a feed proxy. Why
rejected: leaves the backend agent with almost nothing, puts the untested maths
in UI code, and makes the Method page a second copy of the model.

Option: SQLite or Postgres. Why rejected: one user, fictional data, and a demo
that must start clean; persistence adds a failure mode and no value.

### Consequences

Formulas are unit-tested in one place. Every interaction is a network round trip
(local, a few milliseconds). Restarting the backend resets the board, which is
the desired demo behavior.

## ADR-003 — Road routes are fetched once and committed

Date: 2026-11-14

Status: Accepted

### Context

The sample calls the public OSRM demo server from the browser at load. Conference
Wi-Fi during a judged demo is not dependable, and that server is rate limited.

### Decision

A script fetches route candidates from OSRM once and writes
`backend/data/routes.json`, which is committed. Runtime never calls a routing
service.

### Alternatives Considered

Option: live routing at runtime. Why rejected: a network failure would break the
core flow on stage.

Option: hand-drawn straight-line routes. Why rejected: the corridor exposure
analysis (which roads, which neighborhoods) is the geospatial substance of the
entry and needs real geometry.

### Consequences

Drawing a disruption cannot produce a brand-new route; responses choose among
pre-fetched candidates. The Method page must say routes use a car profile with no
truck restrictions. Map tiles remain the only runtime network need.

## ADR-004 — Every disruption is verified by the dispatcher before it is trusted

Date: 2026-11-14

Status: Accepted

### Context

The team's whiteboard has a "notify and ask" step: the dispatcher may know the
road is actually open. The organizer brief warns that a detected feature does not
prove a road is blocked.

### Decision

Every disruption starts `unverified`. Unverified reports are applied with their
confidence and mark results as needing review; `confirmed` applies them as
certain; `dismissed` removes them from every calculation but keeps them listed.

### Alternatives Considered

Option: apply reports immediately as facts. Why rejected: it is the failure the
brief describes, and removes the human-oversight demonstration.

Option: ignore reports until confirmed. Why rejected: hides a possibly real risk
from the board while the dispatcher is still checking.

### Consequences

The verification state is part of the API contract and of the visual language
(solid vs dashed). It is the product's main difference from the sample.

## ADR-005 — Scoring is rule-based and is never labeled AI

Date: 2026-11-14

Status: Accepted

### Context

The track is called GeoAI, and the organizer workshop states that a rule-based
approach should not be described as a trained AI model. Our suggestion comes from
a weighted score.

### Decision

The suggestion is described as a rule-based score from the dispatcher's
priorities. Interface copy and API text never say "AI", "optimal" or "model
predicts"; a backend test enforces this. An LLM-written briefing is a
nice-to-have only and would be labeled as such.

### Alternatives Considered

Option: add an LLM call to justify the "AI" label. Why rejected: adds a network
and credential dependency to the core flow and invites overclaiming; the brief
accepts a geospatial decision-support tool without AI.

### Consequences

The pitch must present this honestly as geospatial analysis plus transparent
rules. If the team wants an AI component for judging, it is an additive task.

## ADR-006 — OpenAPI is the single contract; frontend types are generated

Date: 2026-11-14

Status: Accepted

### Context

Two agents build in parallel in separate worktrees and meet only at integration.

### Decision

`docs/openapi.yaml` is the only definition of request and response shapes.
Frontend generates its types from it and types its mocks against them; backend
validates real responses against it in tests. Every mutation returns the full
Board.

### Alternatives Considered

Option: handwritten TypeScript interfaces and pydantic models kept in step by
care. Why rejected: that is how field drift happens when nobody can ask anybody.

### Consequences

A contract change is one file plus a regeneration. Returning the whole Board on
each write costs payload size (seven routes of geometry) and saves client logic.
