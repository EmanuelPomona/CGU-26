"""Geometry primitives. Pure functions; ported from the reference prototype."""
from __future__ import annotations

import math
from dataclasses import dataclass

EARTH_R = 6371000.0
M_PER_DEG = 111320.0


def hav(a, b) -> float:
    """Great-circle distance in metres between (lat, lng) points."""
    t = math.pi / 180
    dla, dlo = (b[0] - a[0]) * t, (b[1] - a[1]) * t
    x = math.sin(dla / 2) ** 2 + math.cos(a[0] * t) * math.cos(b[0] * t) * math.sin(dlo / 2) ** 2
    return 2 * EARTH_R * math.asin(math.sqrt(x))


def _xy(p, k):
    return p[1] * k * M_PER_DEG, p[0] * M_PER_DEG


def dist_pt_seg(p, a, b) -> float:
    """Metres from p to segment ab, equirectangular around p's latitude."""
    k = math.cos(p[0] * math.pi / 180)
    px, py = _xy(p, k)
    ax, ay = _xy(a, k)
    bx, by = _xy(b, k)
    dx, dy = bx - ax, by - ay
    ln = dx * dx + dy * dy
    t = ((px - ax) * dx + (py - ay) * dy) / ln if ln else 0.0
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def dist_pt_line(p, coords) -> float:
    return min(dist_pt_seg(p, coords[i - 1], coords[i]) for i in range(1, len(coords)))


def phi(z: float) -> float:
    """Standard normal CDF (Abramowitz-Stegun 26.2.17, as the reference)."""
    t = 1 / (1 + 0.2316419 * abs(z))
    d = 0.3989423 * math.exp(-z * z / 2)
    p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    return 1 - p if z > 0 else p


def traffic_mult(minute: float, scale: float = 1.0) -> float:
    """Time-of-day travel-time multiplier: Gaussian peaks at 7:30 and 17:00."""
    h = (minute % 1440) / 60

    def pk(x, c, w):
        return math.exp(-(((x - c) / w) ** 2))

    return 1 + (0.05 + 0.35 * max(pk(h, 7.5, 1.3), pk(h, 17, 1.5))) * scale


def bbox_of(coords):
    lats = [c[0] for c in coords]
    lngs = [c[1] for c in coords]
    return (min(lats), min(lngs), max(lats), max(lngs))


def in_box(lat, lng, bb, pad_m=0.0) -> bool:
    pl = pad_m / M_PER_DEG
    pg = pad_m / (M_PER_DEG * math.cos(lat * math.pi / 180))
    return bb[0] - pl <= lat <= bb[2] + pl and bb[1] - pg <= lng <= bb[3] + pg


@dataclass(frozen=True)
class Step:
    geometry: tuple
    distance_m: float
    duration_s: float
    highway: bool
    bbox: tuple
    scale: float  # road metres per straight-line metre within this step


@dataclass(frozen=True)
class RouteData:
    id: str
    pair: str
    label: str
    via: str | None
    distance_mi: float
    base_minutes: float
    estimated: bool
    geometry: tuple
    steps: tuple
    bbox: tuple
    local_miles: float

    def public(self) -> dict:
        return {
            "id": self.id, "label": self.label, "via": self.via,
            "distance_mi": round(self.distance_mi, 1), "base_minutes": round(self.base_minutes, 1),
            "estimated": self.estimated, "geometry": [list(p) for p in self.geometry],
        }


def prepare_route(r: dict) -> RouteData:
    steps = []
    for s in r["steps"]:
        g = tuple(tuple(p) for p in s["geometry"])
        straight = sum(hav(g[i - 1], g[i]) for i in range(1, len(g)))
        steps.append(Step(g, float(s["distance_m"]), float(s["duration_s"]), bool(s["highway"]),
                          bbox_of(g), float(s["distance_m"]) / max(1.0, straight)))
    geom = tuple(tuple(p) for p in r["geometry"])
    local_m = sum(s.distance_m for s in steps if not s.highway)
    return RouteData(r["id"], r["pair"], r["label"], r.get("via"), float(r["distance_mi"]),
                     float(r["base_minutes"]), bool(r["estimated"]), geom, tuple(steps),
                     bbox_of(geom), local_m / 1609.344)


@dataclass(frozen=True)
class Exposure:
    meters: float
    seconds: float
    hit: bool


def _chord_fraction(c, r_m, a, b) -> float:
    """Fraction of segment ab lying inside the circle (centre c, radius r_m), planar around c."""
    k = math.cos(c[0] * math.pi / 180)
    cx, cy = _xy(c, k)
    ax, ay = _xy(a, k)
    bx, by = _xy(b, k)
    dx, dy = bx - ax, by - ay
    fx, fy = ax - cx, ay - cy
    qa = dx * dx + dy * dy
    if qa == 0:
        return 0.0
    qb = 2 * (fx * dx + fy * dy)
    qc = fx * fx + fy * fy - r_m * r_m
    disc = qb * qb - 4 * qa * qc
    if disc <= 0:
        return 0.0
    sq = math.sqrt(disc)
    t1, t2 = (-qb - sq) / (2 * qa), (-qb + sq) / (2 * qa)
    return max(0.0, min(1.0, t2) - max(0.0, t1))


def exposure(route: RouteData, lat: float, lng: float, radius_km: float) -> Exposure:
    """Road metres and drive seconds of the route inside a circle, and whether it touches it.

    Refinement over the reference: counts the chord of each segment inside the circle rather
    than the whole segment, so simplified geometry does not inflate the time inside.
    """
    c = (lat, lng)
    r_m = radius_km * 1000
    meters = seconds = 0.0
    hit = False
    for st in route.steps:
        if not in_box(lat, lng, st.bbox, r_m):
            continue
        g = st.geometry
        for i in range(1, len(g)):
            if dist_pt_seg(c, g[i - 1], g[i]) > r_m:
                continue
            hit = True
            seg = hav(g[i - 1], g[i]) * st.scale * _chord_fraction(c, r_m, g[i - 1], g[i])
            meters += seg
            if st.distance_m > 0:
                seconds += st.duration_s * seg / st.distance_m
    return Exposure(meters, seconds, hit)


def places_near(route: RouteData, places, radius_m: float):
    """Sensitive places within radius_m of the route, with the highway flag of the nearest step."""
    out = []
    for p in places:
        if not in_box(p["lat"], p["lng"], route.bbox, radius_m + 50):
            continue
        best, hw = math.inf, False
        for st in route.steps:
            if not in_box(p["lat"], p["lng"], st.bbox, radius_m + 50):
                continue
            d = dist_pt_line((p["lat"], p["lng"]), st.geometry) if len(st.geometry) > 1 else math.inf
            if d < best:
                best, hw = d, st.highway
        if best <= radius_m:
            out.append((p, best, hw))
    return out
