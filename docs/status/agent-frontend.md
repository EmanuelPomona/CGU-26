# STATUS: agent/frontend
Task: TASK-107 (TASK-102..106 superseded, ADR-007)
Round: 1
Last updated: 2026-11-14T12:40-08:00

## Skills invoked so far
- ecc:frontend-design-direction @ before shell styling (TASK-101) -> tone industrial-utilitarian dense/ruled; first screen is the tool; only motion = ETA tick sliding to new position
- frontend-design:frontend-design @ before shell styling -> token plan + layout 288 | 1fr | 640; column heads sentence-case condensed (no caps eyebrows), caps only for status word (FIDS reference); no arrow-suffixed buttons, no middle-dot meta strings; indicator strip = one ruled table not tiles
- ui-ux-pro-max:ui-ux-pro-max @ before shell styling -> targeted ux queries (focus 2px solid+offset, color-not-only, 8px gaps / 44px targets on mobile, mobile table -> 2-line rows); contrast check found brief's tight #A8690F = 4.14:1 on panel (<4.5); manager then fixed the brief on main (#985F0E), adopted
- design-taste-frontend @ anti-generic critique of the direction -> skill self-declares out of scope for dashboards (s13), applied cross-cutting checks only: no status dots, radius rule (0 rules / 2px controls), "Suggested" as bold word not pill, zero em/en dashes, skeleton loading at final widths, dark mode intentionally not built (brief = single light projected palette); stack defaults (Tailwind/Motion/icon libs) overridden by ARCHITECTURE

- superpowers:test-driven-development @ before format.ts / strip.ts -> tests written first, watched fail (module missing), then implemented; num/pct were written before tests (violation) -> tests added and proven to fail against a broken impl
- ecc:vite-patterns @ before components -> confirmed tsc -b runs before vite build; only VITE_API_BASE_URL/VITE_USE_MOCK exposed; mock as lazy chunk (no top-level await)
- ecc:react-patterns @ before components -> state lifted to App (no context), derived status in render, seq-guarded fetches, Leaflet imperative via ref
- superpowers:systematic-debugging @ 768 page overflow bug -> evidence per layer; hypothesis 1 (fixed panels) rejected by toggle; bisected to rows; root cause: absolutely positioned .visually-hidden spans with no positioned ancestor escape overflow clips; fixed at source (position: relative on regions + board grid). Commit 3862fca
- ecc:make-interfaces-feel-better @ after structure -> text-wrap balance/pretty, tabular nums on figures, 44px targets at 390, legend summary 24px; confirmed no transition:all / will-change
- vercel:react-best-practices @ after components -> no waterfalls, mock lazy chunk, no inline components, guarded && renders; no changes required (strip animates SVG <g>, accepted)
- ecc:frontend-a11y @ after components -> keyboard Select button in sheet mode (article click was mouse-only), header scenario summary as polite live region

## Done
- [x] Read protocol, routing, product, brief, constraints, architecture, API, openapi, acceptance, TASK-101..106
- [x] Brief is concrete (references, type pairing with reason, semantic palette, signature element, anti-character): not blocked on brief
- [x] `scripts/bootstrap.sh` -> ports frontend 3001 / backend 8001

- [x] Merged main (brief palette fix: --tight #985F0E 4.88/4.51, --ghost #7C848C 3.51); dropped my --tight-text workaround
- [x] TASK-101 scaffold: Vite5+React18+TS strict, generated schema.d.ts (`npm run gen:api`), types.ts aliases only, client.ts (13 ops, ApiError incl status 0 network), mock transport (?mock=slow|fail|failoptions), canned 4 boards
- [x] format.ts + strip.ts TDD (red then green): `npx vitest run` -> 36 passed (incl. mock acceptance tests P-2..P-5)
- [x] Shell (3 layouts), Board, AppointmentStrip, IndicatorStrip, MapView committed; seen in browser at 1440 (mock)

- [x] TASK-104 Conditions, DisruptionForm, VerifyPrompt (committed)
- [x] TASK-105 Options, OptionLabel, DecisionLog, SupervisorUpdate, Method (committed)
- [x] Full primary flow verified against private backend copy (agent/backend @69a7052, :8001, read-and-run, no edits) -> docs/review/F-*.png, F-console.txt (0 errors, 0 warnings)
- [x] F-2 verified by stopping and restarting the private backend (F-06, F-07)

## In progress
- [x] Owner replaced UI twice; final: Dispatch mockup port (5a5c776), wired to API in TASK-107
- [x] TASK-107 wired views on backend c30496a copy (:8001); close60 flow walked by hand; gates pass; HANDOFF-2 written
- [ ] ecc:browser-qa, superpowers:requesting-code-review, final gates, handoff, verification-before-completion

## Deviations / decisions
- Local port: .env FRONTEND_PORT=3011 (3001 held by unrelated Claremont Housing vite). Backend live at 8012 (manager).
- Basemap: CARTO now returns an "API KEY REQUIRED" image (verified curl: 200, 2 KB placeholder). Switched to Esri World Light Gray Canvas (keyless, equally muted). TASK-103 allows "or equally muted".
- Shared backend :8012 was driven by other sessions concurrently (decision + reset mid-flow); evidence captured against private copy on :8001 (manager approved).
- Python urllib cert store broken on this Mac; OSRM mock geometry fetched via curl (scratchpad), 9 routes.

## Verified

## Blocked on
- nothing. Backend serves read endpoints at :8012; disruptions/options/decisions not yet live, so those flows run on VITE_USE_MOCK=1
