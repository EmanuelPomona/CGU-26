import { describe, expect, it } from 'vitest';
import { allowShipmentSelect, showObstaclePalette } from './placeMode';

describe('placeMode helpers', () => {
  it('blocks shipment select while an obstacle chip is armed', () => {
    expect(allowShipmentSelect('flood')).toBe(false);
    expect(allowShipmentSelect(null)).toBe(true);
  });

  it('shows the palette only on Map and To dispatch', () => {
    expect(showObstaclePalette('map')).toBe(true);
    expect(showObstaclePalette('go')).toBe(true);
    expect(showObstaclePalette('prob')).toBe(false);
    expect(showObstaclePalette('net')).toBe(false);
  });

  it('shows the palette in Route studio only after a session exists', () => {
    expect(showObstaclePalette('map', { studioMode: true, hasStudioSession: false })).toBe(false);
    expect(showObstaclePalette('map', { studioMode: true, hasStudioSession: true })).toBe(true);
  });
});
