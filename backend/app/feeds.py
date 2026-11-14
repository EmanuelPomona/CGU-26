"""Live public-feed scout (TASK-005): CHP incidents and NWS alerts near active routes.

Proposes disruptions; never applies them. Each source fails independently and is reported in
`sources`. Results are cached for 60 seconds. Ported from the reference scout() / serve.py.
"""
from __future__ import annotations

import concurrent.futures as cf
import hashlib
import json
import re
import ssl
import threading
import time
import urllib.request

from app.engine.geo import RouteData, dist_pt_line

CHP_URL = "https://media.chp.ca.gov/sa_xml/sa.xml"
NWS_URL = "https://api.weather.gov/alerts/active?area=CA"
USER_AGENT = "drayline-hackathon-demo/1.0 (dispatch decision support; no user data)"
BUDGET_S = 5.0          # total wait for all sources, keeps the endpoint under 6 s
CACHE_S = 60.0
MAX_BYTES = 10_000_000  # outbound payload cap
NEAR_MI = 2.0
MAX_CONFIDENCE = 0.7
BBOX = (32.5, 35.2, -120.0, -114.8)  # Southern California, inside the Area schema bounds
CHP_TYPES = re.compile(r"collision|hazard|fire|closure|sig|debris|animal", re.IGNORECASE)
CHP_SEVERE = re.compile(r"hazard|fire|closure|sig", re.IGNORECASE)
NWS_EVENTS = re.compile(r"flood|red flag|fire|wind|fog|smoke|dust|storm|debris|tsunami", re.IGNORECASE)
COUNTY = {"Los Angeles": (34.05, -118.25), "Orange": (33.72, -117.85), "San Bernardino": (34.10, -117.30),
          "Riverside": (33.90, -117.40), "Ventura": (34.28, -119.0)}


def _ssl_ctx():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:  # pragma: no cover
        return ssl.create_default_context()


def _http_get(url: str, timeout: float) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout, context=_ssl_ctx()) as r:
        body = r.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError("payload too large")
    return body.decode("utf-8", "replace")


FETCH = _http_get      # replaced in tests with recorded payloads
now = time.monotonic   # replaced in tests to move the cache clock

_cache: dict[str, tuple[float, list]] = {}
_lock = threading.Lock()


def clear_cache() -> None:
    with _lock:
        _cache.clear()


def _tag(block: str, name: str) -> str:
    m = re.search(rf"<{name}>\s*\"?(.*?)\"?\s*</{name}>", block, re.DOTALL)
    return m.group(1).strip() if m else ""


def parse_chp(xml: str) -> list[dict]:
    if "<Log" not in xml:
        raise ValueError("unexpected CHP payload")
    out = []
    for m in re.finditer(r"<Log ID\s*=\s*\"([^\"]+)\">(.*?)</Log>", xml, re.DOTALL):
        body = m.group(2)
        ll = _tag(body, "LATLON")
        if ":" not in ll:
            continue
        try:
            la, lo = ll.split(":")
            lat, lng = int(la) / 1e6, -abs(int(lo)) / 1e6
        except ValueError:
            continue
        typ = re.sub(r"^\d+-", "", _tag(body, "LogType"))
        if not CHP_TYPES.search(typ):
            continue
        loc = _tag(body, "Location") or _tag(body, "LocationDesc")
        out.append({"id": f"chp-{m.group(1)}", "title": f"{typ}: {loc} ({_tag(body, 'Area')})",
                    "source_name": "CHP incidents", "lat": lat, "lng": lng, "kind": "slowdown",
                    "radius_km": 1.5, "factor": 2.2 if CHP_SEVERE.search(typ) else 1.7, "confidence": 0.7})
    return out


def parse_nws(text: str) -> list[dict]:
    data = json.loads(text)
    out = []
    for f in data.get("features", []):
        p = f.get("properties", {})
        event = p.get("event", "")
        if not NWS_EVENTS.search(event):
            continue
        area = p.get("areaDesc", "")
        county = next((c for c in COUNTY if c in area), None)
        if not county:
            continue
        lat, lng = COUNTY[county]
        ident = hashlib.sha1(str(f.get("id", event + area)).encode()).hexdigest()[:10]
        out.append({"id": f"nws-{ident}", "title": f"{event} ({county} County area, region-level)",
                    "source_name": "NWS alerts", "lat": lat, "lng": lng, "kind": "hazard",
                    "radius_km": 15.0, "factor": None, "confidence": 0.4})
    return out


SOURCES = [("CHP incidents", lambda: CHP_URL, parse_chp), ("NWS alerts", lambda: NWS_URL, parse_nws)]


def _load(name, url_fn, parse):
    with _lock:
        hit = _cache.get(name)
        if hit and now() - hit[0] < CACHE_S:
            return hit[1]
    items = parse(FETCH(url_fn(), BUDGET_S))
    with _lock:
        _cache[name] = (now(), items)
    return items


def _err(e: BaseException) -> str:
    msg = str(e).strip().splitlines()[0][:120] if str(e).strip() else ""
    return f"unavailable ({type(e).__name__}{': ' + msg if msg else ''})"


def gather() -> tuple[list[dict], list[dict]]:
    """Fetch every source within BUDGET_S. Returns (sources, raw items)."""
    pool = cf.ThreadPoolExecutor(max_workers=len(SOURCES))
    futs = {name: pool.submit(_load, name, u, p) for name, u, p in SOURCES}
    cf.wait(futs.values(), timeout=BUDGET_S)
    pool.shutdown(wait=False, cancel_futures=True)  # never block on a hanging source
    sources, items = [], []
    for name, fut in futs.items():
        if not fut.done():
            sources.append({"name": name, "ok": False, "error": f"timed out after {BUDGET_S:g} s"})
            continue
        exc = fut.exception()
        if exc is not None:
            sources.append({"name": name, "ok": False, "error": _err(exc)})
            continue
        sources.append({"name": name, "ok": True, "error": None})
        items.extend(fut.result())
    return sources, items


def to_candidates(items: list[dict], active_routes: dict[str, RouteData]) -> list[dict]:
    """Keep items inside Southern California and within NEAR_MI of an active route."""
    out = []
    for it in items:
        lat, lng = it["lat"], it["lng"]
        if not (BBOX[0] <= lat <= BBOX[1] and BBOX[2] <= lng <= BBOX[3]):
            continue
        near, best = [], float("inf")
        for sid, route in active_routes.items():
            mi = dist_pt_line((lat, lng), route.geometry) / 1609.344
            best = min(best, mi)
            if mi <= NEAR_MI:
                near.append(sid)
        if not near:
            continue
        suggested = {"kind": it["kind"], "label": (it["title"][:72] + " (live)")[:80], "source": "public_feed",
                     "confidence": min(MAX_CONFIDENCE, it["confidence"]),
                     "area": {"lat": round(lat, 5), "lng": round(lng, 5), "radius_km": it["radius_km"]}}
        if it["kind"] == "slowdown":
            suggested["slowdown_factor"] = it["factor"]
        out.append({"id": it["id"], "title": it["title"], "source_name": it["source_name"],
                    "trust": "official_report", "lat": lat, "lng": lng,
                    "distance_to_route_mi": round(best, 2), "near_shipment_ids": near, "suggested": suggested})
    out.sort(key=lambda c: (-len(c["near_shipment_ids"]), c["distance_to_route_mi"], c["id"]))
    return out
