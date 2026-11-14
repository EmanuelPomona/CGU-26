import { describe, expect, it } from 'vitest';
import { toDisruptionCreate } from './obstacleCatalog';

describe('toDisruptionCreate', () => {
  it('maps traffic to slowdown with factor 2.2', () => {
    const body = toDisruptionCreate('traffic', 34.0, -117.88);
    expect(body).toMatchObject({
      kind: 'slowdown',
      label: 'Traffic slowdown',
      source: 'dispatcher',
      confidence: 0.7,
      slowdown_factor: 2.2,
      area: { lat: 34.0, lng: -117.88, radius_km: 4 },
    });
  });

  it('maps road_closure without slowdown_factor', () => {
    const body = toDisruptionCreate('road_closure', 34.0, -117.88);
    expect(body.kind).toBe('closure');
    expect(body.slowdown_factor).toBeUndefined();
    expect(body.area?.radius_km).toBe(2);
  });

  it('maps wildfire and flood as distinct hazard labels', () => {
    expect(toDisruptionCreate('wildfire', 1, 2).label).toBe('Wildfire');
    expect(toDisruptionCreate('flood', 1, 2).label).toBe('Flood');
    expect(toDisruptionCreate('wildfire', 1, 2).area?.radius_km).toBe(5);
    expect(toDisruptionCreate('flood', 1, 2).area?.radius_km).toBe(3);
  });
});
