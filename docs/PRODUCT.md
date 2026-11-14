# Product Specification

## Product Name

**Dispatch** (the name on the owner's mockup; earlier working name Drayline).
The repository stays `CGUHacks2026`.

## Track

CGU Hackathon 2026, **GeoAI track**: Port-to-Warehouse Visibility and Decision
Support. Chosen perspective: **3. Resilience, Cost, and Sustainability
Intelligence**. The Digital Twin track material in the supplied context file is
not part of this product.

## One-Sentence Description

A dispatcher's board and map for Southern California port-to-warehouse trucking
that, when a condition changes, shows which deliveries will miss their warehouse
appointment, asks the dispatcher to verify the report, and lays out the practical
responses with their cost, mileage, emissions, and who bears the burden.

---

## Problem

A dispatcher has a plan for the day: containers, trucks, routes, warehouse
appointments. Then something changes: a freeway slows, a road closes, a wildfire
or flood zone appears, a container is not ready, a truck drops out, a warehouse
loses docks. The dispatcher has to answer three questions fast:

1. Which of my deliveries does this actually affect?
2. Is the report even true? (Reports are often stale or wrong: "the road is
   actually open.")
3. What can I do, and what does each response cost, in money, miles, emissions,
   driver hours, and impact on the neighborhoods a detour runs through?

Today that is a phone, a spreadsheet, and a consumer map app. The fastest
response is usually picked by default, and its side effects are invisible.

## Target User

A drayage dispatcher at a small or mid-size trucking company working the Ports of
Los Angeles and Long Beach, at a desk with a large monitor, managing roughly
5 to 15 active container moves per shift. Secondary reader: the supervisor who
receives the dispatcher's update.

## Core User Story

As a drayage dispatcher,
I want to see which deliveries a changed condition puts at risk and compare
practical responses side by side,
so that I can choose a response I can defend, and tell my supervisor what I
decided and why.

---

## Product diagnostic (ecc:product-lens)

| Question | Answer |
|---|---|
| Who is this for? | One dispatcher, one shift, 7 fictional container moves. |
| What is the pain? | A change arrives; the dispatcher cannot see which appointments break or what a response costs others. |
| Why now? | Open road routing and public incident feeds make corridor analysis possible without a GIS license. |
| 10-star version | Live truck telemetry, real appointment systems, truck-legal routing, learned travel-time models. |
| MVP | Fixed synthetic day, real road geometry, deterministic scoring, verify-then-decide loop, decision log. |
| Anti-goal | An autopilot. The tool never changes a plan by itself, and never calls a rule-based score "AI". |
| How do we know it works? | The normal vs changed comparison shows at least two indicators moving, and the dispatcher's decision moves them back. |

---

## MVP Goal

By the end of the hackathon, a user must be able to:

1. See the normal day: 7 shipments, their trucks, routes on a map, and each
   delivery's estimated arrival against its warehouse appointment window.
2. Change a condition (preset or drawn on the map) and see which shipments
   become tight or at risk, with normal vs changed indicators side by side.
3. Verify the report: confirm it, dismiss it ("road is actually open"), or leave
   it unverified, and watch the assessment change accordingly.
4. Open an affected shipment, compare response options (keep plan, reroute,
   spare truck, truck swap, later appointment), each with reliability, cost,
   miles, estimated CO2, community exposure, driver hours, and who bears the
   burden.
5. Choose any option (not only the recommended one), get a drafted supervisor
   update, and see the decision in a log that can be undone.

## Primary Demo Flow

Revised for the Dispatch UI (ADR-007).

1. Open the app on the **Map** view: ports, warehouses, trucks and their routes
   on the normal day.
2. Open **To dispatch**, pick a truck, and compare its three route cards:
   Efficiency, Sustainability, Community, each with arrival, miles, estimated
   CO2, cost and community score from the backend.
3. Add the **SR-60 closure**. The affected trucks change status and the normal
   vs changed comparison appears.
4. Verify it: dismiss it ("road is open") and the trucks return to normal;
   restore and confirm it and they are at risk again.
5. For an affected truck, compare the responses, press **Explain this option**,
   and choose one. Override the suggestion with a reason if you prefer another.
6. Copy the drafted supervisor update. Undo is available.
7. Show **On route** as a scripted example of mid-journey problems and driver
   messages, and **Network** for warehouse capacity.

## Must-Have Features

- [ ] Synthetic dataset: 2 terminals, 6 warehouses, 9 trucks, 7 shipments, 30 sensitive places
- [ ] Real road geometry for routes and alternatives, bundled so the demo needs no network
- [ ] Normal vs changed evaluation with indicators: shipments at risk, late minutes, fleet miles, estimated CO2, estimated cost, community exposure, drivers over hours
- [ ] Disruption types: slowdown, closure, hazard area, pickup delay, truck out, dock cut
- [ ] Verification state on every disruption: unverified, confirmed, dismissed
- [ ] Response options per shipment with scores, burden statements, feasibility, one recommendation
- [ ] Dispatcher decision with override reason, supervisor update draft, decision log, undo
- [ ] Method page: assumptions, formulas, simulated vs public labels
- [ ] Responsible design, demonstrated in the UI: environment, fairness and stakeholder impact, transparency, human oversight, responsible data use

## Nice-to-Have Features

Only after every must-have works end to end.

- [ ] Live public-feed scout (CHP incidents, NWS alerts) that proposes disruptions, never applies them
- [ ] Priority weights the dispatcher can move ("what matters most today")
- [ ] Dispatch clock slider
- [ ] LLM-written plain-language briefing, clearly labeled, with the template text as fallback

## Explicitly Out of Scope

- Accounts, login, multi-user, persistence across server restarts
- Truck-legal routing (weight, height, hazmat), live GPS, real appointment systems
- Fleet-wide optimization (vehicle routing problem solver)
- Trained models of any kind; imagery analysis
- Anything from the Digital Twin track
- The slide deck itself (the team writes it; this repo supplies the demo and evidence)

---

## Success Criteria

- Primary demo flow completes without a network connection to anything but the
  map tile server
- Normal vs changed differ on at least two indicators, and the app explains how
  each is calculated
- Every simulated or estimated number is labeled as such
- No recommendation is applied without a dispatcher action
- Frontend and backend integrate against `docs/openapi.yaml`

## Hackathon Constraints

Time available: build day is 2026-11-14. Planning finished about midday.

Team size: human team plus four Claude Code agents (manager, frontend, backend, reviewer).

Required technologies: none mandated. ArcGIS is allowed, not required.

Required APIs: none. OSRM public demo server is used once, offline, to bundle routes.

Deployment deadline: none; the demo runs locally.

Presentation deadline: **not stated in the supplied GeoAI material. Assumed
about 18:00 today; internal feature freeze 16:00.** Owner to confirm.

Presentation format: 10 minutes, slide deck plus live or recorded demo.
