#!/usr/bin/env python3
"""Tiny local server for the SoCal GeoAI demo.

- Serves this folder as static files (index.html).
- GET /api/chp : proxies the public CHP statewide incident feed (it has no CORS
  headers, so a browser cannot read it directly), keeps only Southern California
  incidents, and returns JSON. Cached for 60 seconds.

Run:  python3 serve.py            (then open http://localhost:8765)
Nothing private is sent anywhere; the CHP request carries no user data.
"""
import json, re, time, threading, urllib.request
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

PORT = 8765
HERE = Path(__file__).parent
CHP_URL = "https://media.chp.ca.gov/sa_xml/sa.xml"
BBOX = (32.5, 35.2, -120.0, -114.8)  # lat min/max, lon min/max (Southern California)
_cache = {"t": 0, "data": []}
_lock = threading.Lock()


def _tag(block, name):
    m = re.search(r"<%s>\s*\"?(.*?)\"?\s*</%s>" % (name, name), block, re.S)
    return m.group(1).strip() if m else ""


def fetch_chp():
    with _lock:
        if time.time() - _cache["t"] < 60:
            return _cache["data"]
        req = urllib.request.Request(CHP_URL, headers={"User-Agent": "socal-geoai-demo/0.1"})
        xml = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "replace")
        out = []
        for m in re.finditer(r"<Log ID\s*=\s*\"([^\"]+)\">(.*?)</Log>", xml, re.S):
            body = m.group(2)
            ll = _tag(body, "LATLON")
            if ":" not in ll:
                continue
            try:
                la, lo = ll.split(":")
                lat, lon = int(la) / 1e6, -abs(int(lo)) / 1e6
            except ValueError:
                continue
            if not (BBOX[0] <= lat <= BBOX[1] and BBOX[2] <= lon <= BBOX[3]):
                continue
            out.append({
                "id": m.group(1), "time": _tag(body, "LogTime"), "type": _tag(body, "LogType"),
                "loc": _tag(body, "Location"), "desc": _tag(body, "LocationDesc"),
                "area": _tag(body, "Area"), "lat": lat, "lng": lon,
            })
        _cache.update(t=time.time(), data=out)
        return out


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(HERE), **k)

    def do_GET(self):
        if self.path.startswith("/api/chp"):
            try:
                body = json.dumps(fetch_chp()).encode()
                self.send_response(200)
            except Exception as e:  # feed down: tell the page, it falls back gracefully
                body = json.dumps({"error": str(e)}).encode()
                self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    print(f"SoCal GeoAI demo on http://localhost:{PORT}  (Ctrl-C to stop)")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
