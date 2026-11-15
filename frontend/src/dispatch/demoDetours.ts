/** Demo-only: two visually distinct detours around a road closure, for any placement. */

export type LatLng = [number, number];

type Obstacle = { lat: number; lng: number; radius_km: number };

function havKm(a: LatLng, b: LatLng): number {
  const toRad = Math.PI / 180;
  const dLa = (b[0] - a[0]) * toRad;
  const dLo = (b[1] - a[1]) * toRad;
  const x =
    Math.sin(dLa / 2) ** 2 +
    Math.cos(a[0] * toRad) * Math.cos(b[0] * toRad) * Math.sin(dLo / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** Closest point on segment a→b to p (local equirectangular). */
function closestOnSeg(p: LatLng, a: LatLng, b: LatLng): { point: LatLng; t: number } {
  const k = Math.cos(p[0] * (Math.PI / 180));
  const m = 111.32;
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
  return {
    point: [ay / m + (t * dy) / m, ax / (k * m) + (t * dx) / (k * m)],
    t,
  };
}

/** Offset `origin` perpendicular to dirFrom→dirTo by `km` (sign picks side). */
function offsetByKm(origin: LatLng, dirFrom: LatLng, dirTo: LatLng, km: number, sign: 1 | -1): LatLng {
  const dLat = dirTo[0] - dirFrom[0];
  const dLng = dirTo[1] - dirFrom[1];
  const len = Math.hypot(dLat, dLng) || 1e-9;
  const uLat = -dLng / len;
  const uLng = dLat / len;
  const latPerKm = 1 / 111.32;
  const lngPerKm = 1 / (111.32 * Math.max(0.2, Math.cos((origin[0] * Math.PI) / 180)));
  return [origin[0] + sign * uLat * km * latPerKm, origin[1] + sign * uLng * km * lngPerKm];
}

/** Push a point radially away from the obstacle until outside clearKm. */
function clearOfObstacle(pt: LatLng, obs: Obstacle, clearKm: number): LatLng {
  const center: LatLng = [obs.lat, obs.lng];
  const d = havKm(pt, center);
  if (d >= clearKm) return pt;
  const need = clearKm - d + 0.15;
  // Prefer the existing radial direction; if coincident, nudge north.
  if (d < 1e-6) {
    const latPerKm = 1 / 111.32;
    return [pt[0] + clearKm * latPerKm, pt[1]];
  }
  return offsetByKm(pt, center, pt, need, 1);
}

function buildArc(
  leave: LatLng,
  rejoin: LatLng,
  obs: Obstacle,
  side: 1 | -1,
  bulgeKm: number,
  clearKm: number,
): LatLng[] {
  const steps = 14;
  const arc: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = leave[0] + (rejoin[0] - leave[0]) * t;
    const lng = leave[1] + (rejoin[1] - leave[1]) * t;
    const w = Math.sin(Math.PI * t);
    const base: LatLng = [lat, lng];
    const bulged = offsetByKm(base, leave, rejoin, bulgeKm * w, side);
    // Extra push away from the closure at the peak so thick map strokes stay clear.
    const fromObs: LatLng = [obs.lat, obs.lng];
    const pushed = offsetByKm(bulged, fromObs, bulged, obs.radius_km * 0.55 * w, side);
    arc.push(clearOfObstacle(pushed, obs, clearKm));
  }
  return arc;
}

type Hit = { seg: number; t: number; point: LatLng; distKm: number };

function nearestOnPath(path: LatLng[], obs: Obstacle): Hit {
  const p: LatLng = [obs.lat, obs.lng];
  let best: Hit = { seg: 0, t: 0, point: path[0], distKm: havKm(p, path[0]) };
  for (let i = 1; i < path.length; i++) {
    const { point, t } = closestOnSeg(p, path[i - 1], path[i]);
    const d = havKm(p, point);
    if (d < best.distKm) best = { seg: i - 1, t, point, distKm: d };
  }
  return best;
}

/**
 * Fastest = tighter arc on one side of the closure.
 * Impact = wider arc on the opposite side.
 * Works for a closure anywhere along the base path — neither polyline enters the circle.
 */
export function demoRerouteGeometries(
  basePath: LatLng[],
  obstacles: Obstacle[],
): { fastest: LatLng[]; impact: LatLng[] } | null {
  if (basePath.length < 2 || !obstacles.length) return null;

  // Closest obstacle to the path (supports any drop location).
  let obs = obstacles[0];
  let hit = nearestOnPath(basePath, obs);
  for (let i = 1; i < obstacles.length; i++) {
    const h = nearestOnPath(basePath, obstacles[i]);
    if (h.distKm < hit.distKm) {
      obs = obstacles[i];
      hit = h;
    }
  }

  const clearKm = Math.max(obs.radius_km * 1.35, 3.5);

  // Walk off the blocked stretch in both directions until outside clearKm.
  let startSeg = hit.seg;
  let endSeg = hit.seg;
  while (startSeg > 0 && havKm(basePath[startSeg], [obs.lat, obs.lng]) < clearKm) startSeg -= 1;
  while (endSeg < pathLastSeg(basePath) && havKm(basePath[endSeg + 1], [obs.lat, obs.lng]) < clearKm) {
    endSeg += 1;
  }

  // Leave / rejoin points: prefer path vertices just outside the clearance window.
  const leave = basePath[startSeg];
  const rejoin = basePath[Math.min(basePath.length - 1, endSeg + 1)];
  const head = basePath.slice(0, startSeg + 1);
  const tail = basePath.slice(Math.min(basePath.length - 1, endSeg + 1));

  const fastBulge = Math.max(obs.radius_km * 2.2, 6);
  const impactBulge = Math.max(obs.radius_km * 3.6, 11);

  const fastArc = buildArc(leave, rejoin, obs, 1, fastBulge, clearKm);
  const impactArc = buildArc(leave, rejoin, obs, -1, impactBulge, clearKm);

  return {
    fastest: [...head, ...fastArc.slice(1, -1), ...tail],
    impact: [...head, ...impactArc.slice(1, -1), ...tail],
  };
}

function pathLastSeg(path: LatLng[]): number {
  return Math.max(0, path.length - 2);
}
