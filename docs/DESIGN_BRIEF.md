# Design Brief

**Superseded direction.** The owner replaced the first brief's design (ruled
board, appointment strip) with their own mockup. See ADR-007. The earlier brief
is in git history (`git show 0ec5ef9:docs/DESIGN_BRIEF.md`).

## The design

The design is the owner's `dispatcher-ui.html` mockup, as ported to React on
`agent/frontend` at `5a5c776` (`frontend/src/dispatch/`). Frontend preserves its
layout, type, color and interaction. This brief only records what must change
and what must not.

## Target audience

A drayage dispatcher at a desk, and judges watching a projected demo.

## Primary interface job

Show, for each truck, the route choices and what each costs in time, emissions
and community impact, and let the dispatcher choose.

## Reference point

The owner's mockup. Its four views (Map, To dispatch, On route, Network) and its
three route roles (Efficiency, Sustainability, Community) are the product's
structure.

## Signature element

The three route roles drawn as three line styles on the map (solid, long dash,
dotted) and as three matching cards per truck. Keep the line-style encoding: it
distinguishes routes without relying on color.

## Required changes to the mockup

- Wired views show server data only (ADR-007). No number in Map, To dispatch or
  Network is computed or invented in the browser.
- Drivers appear as the server's `driver_label` ("Driver 01"). The scripted On
  route view uses the same style ("Driver 11"), no personal names.
- "Ask AI" becomes "Explain this option". Its answers are assembled from server
  text (`rationale`, `community_detail`, `burdens`, `notes`) and carry the line
  "Scripted explanation from the rule-based score." Nothing in the interface says
  AI, trained model or optimal.
- The MOCKUP badge is removed from wired views. The On route view carries a
  visible "Scripted example" label.
- A normal vs changed comparison of at least two indicators is visible whenever
  a road condition is active (organizer requirement).
- Unverified road reports are visually distinct from confirmed ones.

## Must not change

Layout, navigation, typography and palette of the mockup, except where a
required change above forces it.

## Justified exceptions

Any pattern in `docs/DESIGN_CONSTRAINTS.md` that the owner's mockup uses is
accepted as the owner's taste decision; visual findings are advisory.
