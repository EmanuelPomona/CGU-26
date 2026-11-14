"""Fetch road routes once from the public OSRM demo server and write data/routes.json.

This is the only code in the backend that touches the network. Runtime reads the
committed routes.json. Port of the reference prototype's osrm / parseRoute /
routeLabel / isHwy / ensureHubs / fallbackRoute.

Usage: python3 backend/scripts/fetch_routes.py
"""
from __future__ import annotations

import json
import math
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
OSRM = "https://router.project-osrm.org/route/v1/driving/"
MI = 1609.344
CIRC = 1.35
MAX_ROUTE_POINTS = 400
STEP_TOLERANCE_M = 8.0
HUBS = [
    ("Downtown LA", 34.0505, -118.2400),
    ("Pico Rivera (I-605)", 33.99, -118.09),
    ("Cerritos (SR-91)", 33.865, -118.08),
    ("Fullerton (SR-91/57)", 33.87, -117.925),
    ("El Monte (I-10)", 34.07, -118.04),
    ("Corona (SR-91 E)", 33.88, -117.57),
    ("Carson (I-405)", 33.83, -118.27),
]
try:  # macOS python.org builds ship without a CA bundle; certifi supplies one
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:  # pragma: no cover
    SSL_CTX = ssl.create_default_context()
HWY_REF = re.compile(r"^(I|SR|US|CA|HWY)[ -]?\d+", re.IGNORECASE)
HWY_NAME = re.compile(r"(freeway|fwy|expressway|highway|turnpike)", re.IGNORECASE)


def hav(a, b) -> float:
    r, t = 6371000.0, math.pi / 180
    dla, dlo = (b[0] - a[0]) * t, (b[1] - a[1]) * t
    x = math.sin(dla / 2) ** 2 + math.cos(a[0] * t) * math.cos(b[0] * t) * math.sin(dlo / 2) ** 2
    return 2 * r * math.asin(math.sqrt(x))


def is_hwy(name: str, ref: str) -> bool:
    return bool(HWY_REF.search(ref or "")) or bool(HWY_NAME.search(name or ""))


def _perp_m(p, a, b) -> float:
    k, m = math.cos(p[0] * math.pi / 180), 111320.0
    px, py, ax, ay, bx, by = p[1] * k * m, p[0] * m, a[1] * k * m, a[0] * m, b[1] * k * m, b[0] * m
    dx, dy = bx - ax, by - ay
    ln = dx * dx + dy * dy
    t = 0.0 if not ln else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / ln))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def rdp(points, tol):
    """Douglas-Peucker simplification (iterative)."""
    if len(points) <= 2:
        return list(points)
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        s, e = stack.pop()
        best, idx = -1.0, -1
        for i in range(s + 1, e):
            d = _perp_m(points[i], points[s], points[e])
            if d > best:
                best, idx = d, i
        if best > tol and idx > 0:
            keep[idx] = True
            stack.extend([(s, idx), (idx, e)])
    return [p for p, k in zip(points, keep) if k]


def simplify_to(points, max_n):
    tol = 5.0
    out = rdp(points, tol)
    while len(out) > max_n:
        tol *= 1.6
        out = rdp(points, tol)
    return out


def rnd(points):
    return [[round(p[0], 5), round(p[1], 5)] for p in points]


def sig(geom):
    step = max(1, len(geom) // 60)
    return {(int(geom[i][0] * 50), int(geom[i][1] * 50)) for i in range(0, len(geom), step)}


def jac(a, b):
    inter = len(a & b)
    return inter / ((len(a) + len(b) - inter) or 1)


def route_label(steps) -> str:
    acc: dict[str, float] = {}
    for s in steps:
        if not s["highway"]:
            continue
        ref = ((s["_ref"] or s["_name"]).split(";")[0] or "")
        ref = re.sub(r"^(I|SR|US|CA)\s+", r"\1-", ref).strip()
        if not ref:
            continue
        acc[ref] = acc.get(ref, 0) + s["distance_m"]
    roads = [k for k, v in acc.items() if v > 2000]
    return " → ".join(roads[:4]) if roads else "local streets"


def osrm(coords, alternatives: bool):
    path = ";".join(f"{c[1]:.5f},{c[0]:.5f}" for c in coords)
    url = f"{OSRM}{path}?overview=full&geometries=geojson&steps=true&alternatives={'true' if alternatives else 'false'}"
    req = urllib.request.Request(url, headers={"User-Agent": "drayline-hackathon/1.0"})
    with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as r:
        j = json.load(r)
    if j.get("code") != "Ok":
        raise RuntimeError(j.get("code"))
    return [parse_route(r) for r in j["routes"]]


def parse_route(r):
    steps = []
    for leg in r["legs"]:
        for s in leg["steps"]:
            c = s.get("geometry", {}).get("coordinates", [])
            if len(c) < 2:
                continue
            pts = [[p[1], p[0]] for p in c]
            steps.append({
                "geometry": rnd(rdp(pts, STEP_TOLERANCE_M)),
                "distance_m": round(s["distance"], 1),
                "duration_s": round(s["duration"], 1),
                "highway": is_hwy(s.get("name", ""), s.get("ref", "")),
                "_name": s.get("name", ""),
                "_ref": s.get("ref", ""),
            })
    geom = [[p[1], p[0]] for p in r["geometry"]["coordinates"]]
    return {
        "distance_m": r["distance"], "duration_s": r["duration"], "steps": steps,
        "geometry_full": geom, "label": route_label(steps), "via": None, "estimated": False,
        "sig": sig(geom),
    }


def fallback(a, b):
    d = hav(a, b) * CIRC
    t = d / (55 * MI / 3600)
    geom = [list(a), list(b)]
    return {
        "distance_m": d, "duration_s": t,
        "steps": [{"geometry": rnd(geom), "distance_m": round(d, 1), "duration_s": round(t, 1),
                   "highway": True, "_name": "", "_ref": ""}],
        "geometry_full": geom, "label": "estimated straight line x1.35", "via": None,
        "estimated": True, "sig": sig(geom),
    }


def main() -> int:
    net = json.loads((DATA / "network.json").read_text())
    ships = json.loads((DATA / "shipments.json").read_text())
    term = {t["id"]: (t["lat"], t["lng"]) for t in net["terminals"]}
    wh = {w["id"]: (w["lat"], w["lng"]) for w in net["warehouses"]}
    pairs = []
    for s in ships:
        p = (s["terminal_id"], s["warehouse_id"])
        if p not in pairs:
            pairs.append(p)
    out = []
    failed = 0
    for t, w in pairs:
        a, b = term[t], wh[w]
        try:
            cands = osrm([a, b], True)
        except (urllib.error.URLError, RuntimeError, TimeoutError, KeyError, ValueError) as e:
            print(f"pair {t}>{w}: OSRM failed ({e}); using straight-line estimate", file=sys.stderr)
            cands = [fallback(a, b)]
            failed += 1
        else:
            direct = hav(a, b)
            hubs = sorted(
                ((h, hav(a, h[1:]) + hav(h[1:], b)) for h in HUBS),
                key=lambda x: x[1],
            )
            hubs = [h for h, v in hubs if v <= 1.45 * direct and v - direct > 3000][:3]
            for h in hubs:
                time.sleep(0.4)
                try:
                    r = osrm([a, h[1:], b], False)[0]
                except (urllib.error.URLError, RuntimeError, TimeoutError, KeyError, ValueError) as e:
                    print(f"pair {t}>{w} via {h[0]}: failed ({e})", file=sys.stderr)
                    continue
                r["via"] = h[0]
                if not any(jac(c["sig"], r["sig"]) > 0.88 for c in cands):
                    cands.append(r)
        for n, c in enumerate(cands[:5]):
            out.append({
                "id": f"{t}-{w}-{n}",
                "pair": f"{t}>{w}",
                "label": c["label"],
                "via": c["via"],
                "distance_mi": round(c["distance_m"] / MI, 3),
                "base_minutes": round(c["duration_s"] / 60, 3),
                "estimated": c["estimated"],
                "geometry": rnd(simplify_to(c["geometry_full"], MAX_ROUTE_POINTS)),
                "steps": [{k: v for k, v in s.items() if not k.startswith("_")} for s in c["steps"]],
            })
        print(f"pair {t}>{w}: {min(len(cands), 5)} route(s)")
        time.sleep(0.4)
    (DATA / "routes.json").write_text(json.dumps({"routes": out}, separators=(",", ":")))
    size = (DATA / "routes.json").stat().st_size
    print(f"wrote {len(out)} routes, {size/1e6:.2f} MB, {failed} pair(s) estimated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
