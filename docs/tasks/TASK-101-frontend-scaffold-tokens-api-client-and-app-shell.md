---
id: TASK-101
title: Frontend scaffold tokens API client and app shell
status: READY
owner: frontend
branch: agent/frontend
priority: HIGH
round: 0
depends_on: []
blocked_on: ""
---

# TASK-101 — Frontend scaffold tokens API client and app shell

## Objective

Create the Vite + React + TypeScript app, the design tokens, the generated API
types, the API client with a mock mode, and the responsive app shell with real
loading and error states, so every later task drops a component into a working
frame.

## Scope

- `frontend/package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `eslint.config.js`
- `frontend/src/main.tsx`, `App.tsx`
- `frontend/src/styles/tokens.css`, `base.css`, `shell.css`
- `frontend/src/api/schema.d.ts` (generated), `types.ts`, `client.ts`, `useBoard.ts`
- `frontend/src/mocks/*`
- `frontend/src/lib/format.ts`, `format.test.ts`

## Acceptance Criteria

- [ ] `npm run dev:frontend` (from the worktree root) serves on `$FRONTEND_PORT`; `vite.config.ts` sets `envDir: '..'`; nothing hardcodes 3000 or 8000.
- [ ] `npm --prefix frontend run gen:api` runs `openapi-typescript ../docs/openapi.yaml -o src/api/schema.d.ts`; `types.ts` only re-exports aliases of generated types. No handwritten response interface exists (acceptance F-4).
- [ ] `client.ts` exposes one typed function per operation in the YAML (`getNetwork`, `getMethod`, `getBoard`, `putSettings`, `postReset`, `getPresets`, `createDisruption`, `updateDisruption`, `deleteDisruption`, `getOptions`, `createDecision`, `deleteDecision`, `getFeedCandidates`) and throws `ApiError {status, error, message, field?}` built from the contract's `Error` body, or `{status: 0, error: "network"}` when the server is unreachable.
- [ ] With `VITE_USE_MOCK=1` the client is backed by an in-memory fake that holds four canned boards typed with `satisfies Board` (normal; `close60` unverified; `close60` confirmed; after a decision on one at-risk shipment) and moves between them on `createDisruption`, `updateDisruption`, `createDecision`, `deleteDecision`, `postReset`. Canned options for the at-risk shipment include keep, two reroutes, a spare truck and a reschedule, one infeasible.
- [ ] `tokens.css` defines every color in the brief's palette as a custom property named by role (`--canvas`, `--panel`, `--ink`, `--ink-2`, `--rule`, `--action`, `--on-time`, `--tight`, `--at-risk`, `--unverified`, `--ghost`) plus type and spacing scales; fonts Barlow Condensed, IBM Plex Sans, IBM Plex Mono load with system fallbacks.
- [ ] The shell implements the three layouts in the brief ("Layout by width") with named regions for conditions, map, indicators, board, detail. At 390px there is no horizontal scroll.
- [ ] States: while the first board request is pending the shell shows a loading state that keeps the layout stable; if it fails the shell shows what failed and a Retry button that works; stopping the backend mid-session shows the error without discarding the last good board (acceptance F-2).
- [ ] `format.ts` has `clock(min)` -> "9:15 AM" (and "+1d" past midnight), `duration(min)` -> "1h 05m", `signed(n, unit)`; Vitest covers 0, 555, 720, 1439, 1500 and negative durations.
- [ ] `npm --prefix frontend run build`, `run typecheck`, `run lint`, `run test` all pass; outputs in the handoff.

## Notes

- 2026-11-14: the shell, tokens and layout criteria here are superseded by the Dispatch mockup (ADR-007). The generated types, `client.ts` and `ApiError` remain in force and are reused by TASK-107.

Read `docs/DESIGN_BRIEF.md`, `docs/DESIGN_CONSTRAINTS.md`, `docs/API.md` and `docs/openapi.yaml` first. Run the mandatory design skills in `docs/SKILL_ROUTING.md` before major UI. Commit after each passing step (protocol section 24).

- Design skills (`ecc:frontend-design-direction`, `frontend-design:frontend-design`, `ui-ux-pro-max:ui-ux-pro-max`, `design-taste-frontend`) are invoked in this task, before the shell is styled.
- No Tailwind, no component library, no react-leaflet (architecture decision).
- To try against the live backend before integration, set `VITE_API_BASE_URL` to the backend worktree's port (see `../CGUHacks2026-Backend/.env`) and `VITE_USE_MOCK=0`.
- Mock numbers must be plausible. Start from the reference prototype's values; once the backend worktree serves `/api/board`, replace the canned boards with real responses captured by curl.

## Review History

| Round | Verdict | Summary |
|---|---|---|
