import { describe, expect, it } from 'vitest';
import { demoRerouteGeometries, type LatLng } from './demoDetours';

function havKm(a: LatLng, b: LatLng): number {
  const toRad = Math.PI / 180;
  const dLa = (b[0] - a[0]) * toRad;
  const dLo = (b[1] - a[1]) * toRad;
  const x =
    Math.sin(dLa / 2) ** 2 +
    Math.cos(a[0] * toRad) * Math.cos(b[0] * toRad) * Math.sin(dLo / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** Dense path so closures can sit anywhere along it. */
function samplePath(): LatLng[] {
  const a: LatLng = [33.76, -118.21];
  const b: LatLng = [34.1, -117.72];
  const n = 24;
  const out: LatLng[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

describe('demoRerouteGeometries', () => {
  it('builds two different detours that clear the closure', () => {
    const path = samplePath();
    const mid = path[Math.floor(path.length / 2)];
    const obs = { lat: mid[0], lng: mid[1], radius_km: 3 };
    const out = demoRerouteGeometries(path, [obs]);
    expect(out).not.toBeNull();
    expect(out!.fastest).not.toEqual(out!.impact);
    for (const pt of [...out!.fastest, ...out!.impact]) {
      expect(havKm(pt, [obs.lat, obs.lng])).toBeGreaterThan(obs.radius_km * 0.95);
    }
  });

  it('clears a closure near the start, middle, or end of the path', () => {
    const path = samplePath();
    const spots = [2, Math.floor(path.length / 2), path.length - 3];
    for (const idx of spots) {
      const p = path[idx];
      const obs = { lat: p[0], lng: p[1], radius_km: 2.5 };
      const out = demoRerouteGeometries(path, [obs]);
      expect(out, `idx ${idx}`).not.toBeNull();
      expect(out!.fastest, `idx ${idx}`).not.toEqual(out!.impact);
      // Peak offset points should sit on opposite sides → different lengths / shapes.
      expect(out!.impact.length).toBeGreaterThan(4);
      for (const pt of [...out!.fastest, ...out!.impact]) {
        expect(havKm(pt, [obs.lat, obs.lng]), `idx ${idx}`).toBeGreaterThan(obs.radius_km * 0.95);
      }
    }
  });

  it('uses the obstacle closest to the path when several exist', () => {
    const path = samplePath();
    const onPath = path[10];
    const far = { lat: onPath[0] + 0.4, lng: onPath[1] + 0.4, radius_km: 2 };
    const near = { lat: onPath[0], lng: onPath[1], radius_km: 2 };
    const out = demoRerouteGeometries(path, [far, near]);
    expect(out).not.toBeNull();
    // Detour should clear the near obstacle (the one that matters).
    for (const pt of [...out!.fastest, ...out!.impact]) {
      expect(havKm(pt, [near.lat, near.lng])).toBeGreaterThan(near.radius_km * 0.95);
    }
  });
});
