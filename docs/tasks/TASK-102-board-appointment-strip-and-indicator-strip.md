---
id: TASK-102
title: Board appointment strip and indicator strip
status: READY
owner: frontend
branch: agent/frontend
priority: HIGH
round: 0
depends_on: [TASK-101]
blocked_on: ""
---

# TASK-102 — Board appointment strip and indicator strip

## Objective

Build the shipment board (the departures-board reference), the appointment strip
(the signature element), and the indicator strip comparing normal, changed and
decided.

## Scope

- `frontend/src/components/Board.tsx`, `Board.css`
- `frontend/src/components/AppointmentStrip.tsx`, `AppointmentStrip.css`
- `frontend/src/components/IndicatorStrip.tsx`, `IndicatorStrip.css`
- `frontend/src/lib/strip.ts`, `strip.test.ts`

## Acceptance Criteria

- [ ] The board is a ruled table, one row per shipment in server order, fixed columns: container id, cargo, terminal to warehouse, truck and driver label, appointment window, estimated arrival ("est." prefixed), the strip, status word. No cards. High-priority shipments are marked with a word, not only color.
- [ ] Status shows as the words "On time", "Tight", "At risk" in the status color; rows with `attention: "act"` are distinguishable without color (weight or marker); rows with `current.needs_review` show "Unverified" in the unverified color.
- [ ] `strip.ts` exports `stripScale(rows) -> {t0, t1}` (one shared time axis for the whole board, padded 30 min beyond the earliest window start/ETA and latest window end/ETA, rounded to the half hour) and `xOf(min, scale, width)`; Vitest covers a row far later than the others, an ETA before the window, and identical min/max.
- [ ] The strip draws: axis with hour ticks, the window as a bracket from `appt_start_min` to `appt_end_min`, the live tick at `current.eta_min` in the status color with a whisker of plus/minus `eta_sigma_min`, and a ghost tick at `normal.eta_min` whenever it differs from the live one. With `needs_review` the tick is hollow and the whisker dashed. A shifted appointment shows the original bracket as a ghost. (Acceptance U-1.)
- [ ] The strip has a text alternative: `aria-label` such as "Estimated 10:42 AM, window 10:20 to 11:05 AM, 23 minutes of slack, unverified".
- [ ] The indicator strip is one ruled row of figures, not tiles: shipments at risk, late minutes, fleet miles, est. CO2 kg, est. cost, community score, drivers over hours. Each shows the normal value; when changed differs it shows changed with a signed delta; when a decision exists it shows decided too. Triggered checks appear as plain sentences beneath it using `check.detail`.
- [ ] Clicking or pressing Enter on a row selects it (visible selected state, `aria-selected`), and the selection is exposed through a prop/callback so the map and options can follow.
- [ ] States: loading rows keep column widths; hover and focus-visible styles exist; with no disruptions the indicator strip reads as the normal day with no deltas.
- [ ] At 1440px all 7 rows are visible beside the map without scrolling (U-4). At 390px each row is two lines with the strip on the second and no horizontal scroll.

## Notes

Read `docs/DESIGN_BRIEF.md`, `docs/DESIGN_CONSTRAINTS.md`, `docs/API.md` and `docs/openapi.yaml` first. Run the mandatory design skills in `docs/SKILL_ROUTING.md` before major UI. Commit after each passing step (protocol section 24).

- The strip is SVG, sized by its container (ResizeObserver or viewBox), so it reprints unchanged inside each option in TASK-105. Export it as `<AppointmentStrip evaluation normal? scale compact? />`.
- All numbers come from the Board; the frontend computes nothing but pixel positions and formatting.

## Review History

| Round | Verdict | Summary |
|---|---|---|
