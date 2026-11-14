"""Route roles (TASK-006, ADR-007): which feasible keep/reroute option wins each role.

The server decides so the frontend never ranks anything. Unrounded engine values; ties go to
the option that appears first in the response order.
"""
from __future__ import annotations

ROLE_WINDOW_MIN = 30.0
ROLE_KINDS = ("keep", "reroute")


def assign_roles(ordered: list[dict]) -> None:
    """Set o["roles"] on every option, in place. `ordered` is the response order."""
    for o in ordered:
        o["roles"] = []
    pool = [o for o in ordered if o["feasible"] and o["kind"] in ROLE_KINDS]
    if not pool:
        return
    # min()/max() return the first of equal items, which gives "ties go to the earlier option"
    eff = min(pool, key=lambda o: o["ev"].eta_min)
    earliest = eff["ev"].eta_min
    # sustainability and community only among options arriving within 30 min of the earliest, so a
    # route that crosses a closure and arrives hours late is never shown as the green or neighborly one
    near = [o for o in pool if o["ev"].eta_min - earliest <= ROLE_WINDOW_MIN]
    sus = min(near, key=lambda o: o["ev"].co2_kg)
    com = max(near, key=lambda o: o["ev"].community.score)
    eff["roles"].append("efficiency")
    sus["roles"].append("sustainability")
    com["roles"].append("community")
