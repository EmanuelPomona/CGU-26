"""Method page content: every constant, formula, source and limit. Rendered by the frontend as-is."""
from __future__ import annotations

from app.engine import constants as K


def method_payload() -> dict:
    return {
        "assumptions": [
            {"key": k, "label": label, "value": float(v), "unit": unit, "kind": "simulated", "note": note}
            for k, label, v, unit, note in K.ASSUMPTIONS
        ],
        "formulas": [
            {"id": "pickup", "label": "Pickup time",
             "expression": "pickup = max(clock + deadhead_min, ready + pickup_delay); depart = pickup + 40",
             "explanation": "Deadhead is the straight-line distance from the truck to the terminal x 1.35, driven at 28 mph. The truck waits if the container is not ready."},
            {"id": "drive", "label": "Drive time",
             "expression": "drive = base_minutes x traffic(depart) + sum over slowdowns(time inside x (factor - 1))",
             "explanation": "Traffic is a time-of-day curve with peaks of about x1.40 at 7:30 AM and 5:00 PM. A slowdown only adds time on the part of the route inside its circle."},
            {"id": "eta", "label": "Estimated arrival",
             "expression": "eta = depart + drive + p_blocked x 150 + 90 x dock_cut",
             "explanation": "p_blocked is the highest confidence among closures and hazards touching the route (1.0 once confirmed). A dock cut adds a queue at the warehouse."},
            {"id": "on_time", "label": "On-time probability",
             "expression": "P = (1 - p_blocked) x Phi(slack / sigma) + p_blocked x Phi((slack - 150) / sigma); sigma = 6 + 0.12 x drive",
             "explanation": "Normal-curve chance that the truck arrives before the window closes, mixing the blocked and unblocked cases."},
            {"id": "status", "label": "Status",
             "expression": "at_risk if P < 0.5; tight if P < 0.85 or slack < 15 min; else on_time",
             "explanation": "A word, not only a color, is shown for every status."},
            {"id": "driver_hours", "label": "Driver hours",
             "expression": "hours = deadhead + wait + 40 + drive + block + queue + 45 + 0.9 x base_minutes",
             "explanation": "Hours beyond the driver's remaining shift make an option infeasible."},
            {"id": "cost", "label": "Estimated cost",
             "expression": "cost = miles x $2.10 + hours x $38 + late_min x $1.20 + $75 if rescheduled",
             "explanation": "Miles are deadhead + loaded + empty return (same as loaded)."},
            {"id": "co2", "label": "Estimated CO2",
             "expression": "co2 = empty_mi x 1.30 + loaded_mi x 1.75 + congested_mi x 1.75 x 0.30 + idle_min x 0.136",
             "explanation": "Congested miles are 25% of the route in peak traffic plus the miles inside a slowdown."},
            {"id": "community", "label": "Community score",
             "expression": "100 - min(30, local_mi x 1.5) - min(50, weighted sensitive places within 250 m); x1.5 at night",
             "explanation": "Sensitive places weigh school 6, hospital 8, homes 3 on local streets and 1 / 1.5 / 0.5 beside highways. Night is 8:00 PM to 6:00 AM. Road type comes from OSRM road names."},
            {"id": "suggestion", "label": "Suggested option",
             "expression": "overall = sum(weight x part) / sum(weights); infeasible options are never suggested",
             "explanation": "Parts: reliability = 100 x P; cost and emissions scaled 0-100 across this shipment's options; community score; driver score. A rule-based weighted score; the dispatcher decides."},
        ],
        "data_sources": [
            {"name": "OSRM public demo server (OpenStreetMap)", "kind": "public",
             "used_for": "Road geometry, distances and free-flow drive times for each port-to-warehouse route and alternative, fetched once and bundled.",
             "limits": "Car profile, no truck restrictions (weight, height, hazmat); free-flow times, no live traffic."},
            {"name": "Sensitive places", "kind": "simulated",
             "used_for": "Schools, hospitals and residential areas near routes for the community score.",
             "limits": "30 invented locations, not real facilities."},
            {"name": "Shipments, trucks, warehouses and appointments", "kind": "simulated",
             "used_for": "The dispatcher's day: 7 container moves, 9 trucks, 7 warehouses, 2 terminals.",
             "limits": "Fictional operations; drivers are labels, not people."},
            {"name": "Disruption presets", "kind": "simulated",
             "used_for": "One-click what-if conditions for the demo.",
             "limits": "Invented events; locations chosen to cross demo routes."},
        ],
        "not_modeled": [
            "Truck-legal routing (weight, height, hazmat restrictions)",
            "Live traffic and live truck positions",
            "Real appointment and terminal systems",
            "Road-level damage: a hazard area does not prove a road is blocked or passable",
            "Fleet-wide re-planning; options change one shipment (or two on a truck swap)",
            "Trained or learned models: every number is a stated rule",
        ],
        "responsible_design": [
            {"consideration": "environment",
             "how": "Every option shows its added miles and estimated CO2, and the board compares fleet CO2 for the normal, changed and decided plans."},
            {"consideration": "fairness",
             "how": "Every option lists who bears the burden: driver, residents near local streets, the warehouse, another customer, or the company. The community score counts sensitive places near the route."},
            {"consideration": "transparency",
             "how": "This page lists every constant and formula; every figure is labeled simulated, estimated or public; the suggestion's rationale names the weights it used."},
            {"consideration": "human_oversight",
             "how": "Nothing changes a plan without a dispatcher's click. Reports start unverified and can be confirmed or dismissed; any option can be chosen with a recorded reason; every decision can be undone."},
            {"consideration": "responsible_data",
             "how": "No personal data: drivers are labels such as Driver 01. Unverified reports are marked and their results flagged for review. Public road data is used once and bundled."},
        ],
    }
