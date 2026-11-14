import { describe, expect, it } from 'vitest';
import { snapToNearestRoute } from './routeSnap';

const route = {
  shipmentId: 'C-103',
  latlngs: [
    [34.0, -118.0],
    [34.0, -117.9],
  ] as Array<[number, number]>,
};

describe('snapToNearestRoute', () => {
  it('snaps to the closest point on the segment', () => {
    const hit = snapToNearestRoute(34.01, -117.95, [route]);
    expect(hit?.shipmentId).toBe('C-103');
    expect(hit!.distanceKm).toBeLessThan(2);
    expect(hit!.lat).toBeCloseTo(34.0, 3);
    expect(hit!.lng).toBeCloseTo(-117.95, 3);
  });

  it('returns null when farther than 2 km', () => {
    expect(snapToNearestRoute(35.0, -117.95, [route])).toBeNull();
  });
});
