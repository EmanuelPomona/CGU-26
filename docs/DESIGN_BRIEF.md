# Design Brief

The design problem for Drayline. Frontend reads this with
`docs/DESIGN_CONSTRAINTS.md` before any UI work.

---

## Target audience

A drayage dispatcher at a desk, mid-shift, large monitor, phone ringing. They
already have a plan and are interrupted by a change. They are not exploring; they
are triaging. They read rows and times far more than they read prose, and they
distrust software that sounds surer than it is. Judges see the same screen
projected, from the back of a room, for about four minutes of a ten-minute talk.

## Primary interface job

Make it effortless to see **where each delivery's estimated arrival sits relative
to its warehouse appointment window**, before a change, after it, and under each
possible response.

## Reference points

1. **An airport departures board (split-flap / FIDS).** Borrow: one row per
   movement, fixed columns, status as a single word at the row's end, times in
   tabular figures, the whole board scannable top to bottom in two seconds. The
   shipment list is a board, not a stack of cards.
2. **The FDA Nutrition Facts label.** Borrow: a fixed order of quantities, heavy
   and light rules instead of boxes, bold figure right-aligned beside a plain
   label, no adjectives. Every response option is printed as the same label
   (on-time chance, cost, miles, CO2, community exposure, driver hours) so two
   options are compared by reading across, not by decoding two layouts.
3. **A NOAA nautical chart.** Borrow: a quiet, desaturated base where land and
   road are barely tinted, and only the things you navigate by (routes, hazards,
   destinations) carry ink. Surveyed features are drawn solid; unsurveyed or
   reported ones are drawn dashed. That solid-vs-dashed convention is the whole
   visual language for confirmed vs unverified here.

## Desired character

- **Plainspoken.** Labels are nouns and numbers. Consequence: no marketing copy,
  no "smart", "AI-powered", or "insights" anywhere in the interface.
- **Legible at distance.** Consequence: status is readable from row position,
  word, and color together; the smallest text on the board is 13px; times and
  IDs are monospaced.
- **Honest about certainty.** Consequence: every estimated figure carries "est."
  and every simulated one a "simulated" tag; unverified disruptions are dashed
  and hatched on the map and marked in the board.
- **Deferential.** Consequence: the recommendation is one option marked
  "Suggested", in the same visual weight as the others. The primary button says
  what the dispatcher is doing ("Choose this response"), never "Apply AI plan".
- **Dense but ruled.** Consequence: tight rows separated by hairlines, generous
  alignment, almost no containers.

## Anti-character

Never a SaaS analytics dashboard: no KPI tiles in a row, no donut or gauge
charts, no rounded shadowed cards on a pale grey page. Never "mission control":
no dark neon, no glowing map, no sci-fi type. Never a consumer navigation app:
no cartoon truck emoji, no cheerful turn-by-turn tone. The sample prototype
(`index.html`) is the thing to move away from visually: blue-header admin panel,
emoji icons, pill chips in five colors.

## Typography

Display face: **Barlow Condensed** (600, 700), for the product name, column
heads, status words, option titles, indicator figures.

Text face: **IBM Plex Sans** (400, 500, 600) for body and labels;
**IBM Plex Mono** (400, 500) for container IDs, clock times, and every number in
a table or label.

Why these, for this product: Barlow was drawn from California's highway signs
and license plates, which is exactly the visual world these trucks drive through,
and its condensed cut fits the long column heads a board needs. Plex Mono gives
container IDs and times the stamped, tabular look of a shipping manifest and
keeps digits column-aligned so a late time is visible as a shape. Load from
Google Fonts with system fallbacks; the app must stay legible if fonts fail.

## Palette

| Role | Color | Why |
|---|---|---|
| canvas | `#EFEDE6` | manifest paper; keeps the muted map from floating on white |
| panel surface | `#F8F6F0` | one step lighter, for the board and option label |
| primary text / heavy rules | `#1B2228` | ink |
| secondary text | `#5C6670` | units, column heads, captions |
| hairline rules | `#CFCBC0` | row separators; replaces card borders |
| action / selected | `#12355B` | buttons, the selected shipment, its route on the map |
| on time | `#1F6F4A` | freeway-sign green; arrival inside the window |
| tight | `#985F0E` | amber; inside the window with little slack (4.88:1 on panel, 4.51:1 on canvas) |
| at risk / error | `#B3312A` | signal red; arrival outside the window, and form errors |
| unverified / needs review | `#4B4FA6` | the only cool accent; reserved for "a human has not confirmed this" |
| baseline ghost | `#7C848C` | the normal-day ETA and route, shown behind the changed one (3.51:1 on panel, meets 3:1 for meaningful graphics); the ghost tick is also drawn shorter than the live tick so it does not rely on color |

Every color has a semantic role. Status color always appears with a status word
and never as the only signal. Check contrast: status text on `#F8F6F0` must
reach 4.5:1.

## Information density

Dense. Seven shipments, each with eight facts, must fit on a 1440px screen
beside the map without scrolling, because triage is comparison and scrolling
breaks comparison.

## Content hierarchy

1. The board: which shipments are tight or at risk, and by how much.
2. The change: what is different from the normal day (indicator strip, map).
3. The verification question, when a disruption is unverified.
4. The options for the selected shipment.
5. Decision log and method.

## Signature element

**The appointment strip.** Each shipment row carries a horizontal time axis.
The warehouse appointment window is a bracket `[ ]` on it. The estimated arrival
is a tick with a whisker showing its uncertainty. When a condition changes, the
normal-day tick stays behind as a grey ghost and the new tick moves, so lateness
is seen as a displacement past the bracket rather than read as a number. Every
response option reprints the same strip, so choosing a response is literally
choosing where the tick lands. An unverified disruption draws the tick hollow
and the whisker dashed.

This cannot be pasted onto another product: it is the dispatch problem (arrival
versus appointment, under uncertainty) drawn directly.

## Layout by width

- **1440**: three columns. Left: conditions (presets, active disruptions,
  verification). Center: map, with the indicator strip above it. Right: board on
  top, options or log beneath. Board never scrolls for 7 rows.
- **768**: map on top (about 40% of the height), board beneath full width,
  conditions and options as panels that open over the lower half.
- **390**: designed for a dispatcher walking the yard. Board first, each row two
  lines with the strip on the second. Map collapses to a strip that expands on
  tap. Options open as a full-height sheet with a sticky "Choose this response"
  bar. Controls reachable by thumb.

## Justified exceptions

| Pattern | Why it belongs in this product |
|---|---|
| Elevation shadow on the mobile options sheet and map popovers | they are literally above the plane |
| Diagonal hatch fill on unverified hazard areas | cartographic convention for uncertain extent; it carries meaning |
| A row of indicator figures above the map | not stat tiles: each is a normal vs changed vs decided comparison with a stated formula, laid out as one ruled table row, not cards |
