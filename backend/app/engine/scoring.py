"""Rule-based option scoring, ported from the reference scoreOptions. Not a trained model."""
from __future__ import annotations

WEIGHT_KEYS = ["reliability", "cost", "emissions", "community", "driver"]


def norm(v: float, values) -> float:
    lo, hi = min(values), max(values)
    return 100.0 if hi - lo < 1e-6 else 100 * (1 - (v - lo) / (hi - lo))


def score_parts(ev, costs, co2s) -> dict:
    driver = 0.0 if ev.driver_hours_over > 0 else max(0.0, min(100.0, 100 - max(0.0, ev.driver_hours - 8) * 25 - ev.idle_min * 0.3))
    return {
        "reliability": 100 * ev.on_time_probability,
        "cost": norm(ev.cost_usd, costs),
        "emissions": norm(ev.co2_kg, co2s),
        "community": ev.community.score,
        "driver": driver,
    }


def overall(parts: dict, weights: dict) -> float:
    tw = sum(weights[k] for k in WEIGHT_KEYS) or 1
    return sum(weights[k] * parts[k] for k in WEIGHT_KEYS) / tw


def weights_text(weights: dict) -> str:
    return ", ".join(f"{k} {weights[k]}" for k in WEIGHT_KEYS)


def pick_suggestion(scored, weights: dict, meta) -> tuple[str | None, str]:
    """scored: [{id, feasible, score}] in generation order. Highest feasible score wins; ties keep order."""
    titles = {m["id"]: m.get("title", m["id"]) for m in meta}
    best = None
    for s in scored:
        if s["feasible"] and (best is None or s["score"] > best["score"] + 1e-9):
            best = s
    if best is None:
        return None, ("No feasible response was found: every option lacks a truck, exceeds driver hours, "
                      "or has no appointment slot. Escalate to your supervisor before acting.")
    title = titles.get(best["id"], best.get("title", best["id"]))
    return best["id"], (f"Suggested: {title}. It has the highest weighted score ({int(best['score'] + 0.5)} of 100) "
                        f"among the feasible options, using the rule-based score with your weights: "
                        f"{weights_text(weights)}. The weights move the suggestion, never the facts. "
                        f"You decide; any option can be chosen with a reason.")
