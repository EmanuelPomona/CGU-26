export type SnapHit = {
  shipmentId: string;
  lat: number;
  lng: number;
  distanceKm: number;
};

type RouteInput = { shipmentId: string; latlngs: Array<[number, number]> };

const R_KM = 6371;

function havKm(a: [number, number], b: [number, number]): number {
  const toRad = Math.PI / 180;
  const dLa = (b[0] - a[0]) * toRad;
  const dLo = (b[1] - a[1]) * toRad;
  const x =
    Math.sin(dLa / 2) ** 2 +
    Math.cos(a[0] * toRad) * Math.cos(b[0] * toRad) * Math.sin(dLo / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** Closest point on segment a→b to p, in lat/lng degrees (local equirectangular). */
function closestOnSeg(p: [number, number], a: [number, number], b: [number, number]): [number, number] {
  const k = Math.cos(p[0] * (Math.PI / 180));
  const m = 111.32; // km per degree latitude
  const px = p[1] * k * m;
  const py = p[0] * m;
  const ax = a[1] * k * m;
  const ay = a[0] * m;
  const bx = b[1] * k * m;
  const by = b[0] * m;
  const dx = bx - ax;
  const dy = by - ay;
  const L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return [ay / m + (t * dy) / m, ax / (k * m) + (t * dx) / (k * m)];
}

function bestOnRoute(lat: number, lng: number, route: RouteInput): SnapHit | null {
  const p: [number, number] = [lat, lng];
  const pts = route.latlngs;
  if (pts.length === 0) return null;
  if (pts.length === 1) {
    const d = havKm(p, pts[0]);
    return { shipmentId: route.shipmentId, lat: pts[0][0], lng: pts[0][1], distanceKm: d };
  }
  let best: SnapHit | null = null;
  for (let i = 1; i < pts.length; i++) {
    const c = closestOnSeg(p, pts[i - 1], pts[i]);
    const d = havKm(p, c);
    if (!best || d < best.distanceKm) {
      best = { shipmentId: route.shipmentId, lat: c[0], lng: c[1], distanceKm: d };
    }
  }
  return best;
}

export function snapToNearestRoute(
  lat: number,
  lng: number,
  routes: RouteInput[],
  maxKm = 2,
): SnapHit | null {
  let best: SnapHit | null = null;
  for (const route of routes) {
    const hit = bestOnRoute(lat, lng, route);
    if (!hit) continue;
    if (
      !best ||
      hit.distanceKm < best.distanceKm ||
      (hit.distanceKm === best.distanceKm && hit.shipmentId < best.shipmentId)
    ) {
      best = hit;
    }
  }
  if (!best || best.distanceKm > maxKm) return null;
  return best;
}
