---
id: TASK-005
title: Live feed candidates
status: REVIEW
owner: backend
branch: agent/backend
priority: LOW
round: 0
depends_on: [TASK-004]
blocked_on: ""
---

# TASK-005 — Live feed candidates

## Objective

Replace the stub behind `GET /api/feeds/candidates` with real fetches of the CHP
incident feed and NWS active alerts for California, keeping only items within
2 miles of an active route, and proposing a `DisruptionCreate` for each. Only
start this when TASK-001..004 are in REVIEW.

## Scope

- `backend/app/feeds.py`, `backend/app/routers/feeds.py`
- `backend/tests/test_feeds.py`

## Acceptance Criteria

- [ ] With no network the endpoint answers 200 within 6 seconds with each source `ok: false` and an `error` string.
- [ ] Results are cached for 60 seconds; tests use recorded fixture payloads and never touch the network.
- [ ] Each candidate's `suggested` body is accepted by `POST /api/disruptions` unchanged and has `source: "public_feed"`, confidence at most 0.7.
- [ ] `trust` is `official_report` for CHP and NWS items.
- [ ] Nothing is added to the board by calling this endpoint.

## Notes

Read `docs/API.md` and `docs/openapi.yaml` first; they are the contract. Commit after each passing step (protocol section 24).

- CHP parsing reference: `docs/reference/sample-serve.py`. NWS: `https://api.weather.gov/alerts/active?area=CA` (send a User-Agent).

## Review History

| Round | Verdict | Summary |
|---|---|---|
