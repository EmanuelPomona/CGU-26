import { describe, expect, it } from 'vitest';
import { allowShipmentSelect, showObstaclePalette } from './placeMode';

describe('placeMode helpers', () => {
  it('blocks shipment select while an obstacle chip is armed', () => {
    expect(allowShipmentSelect('flood')).toBe(false);
    expect(allowShipmentSelect(null)).toBe(true);
  });

  it('shows the palette on Map and To dispatch only with an active path', () => {
    expect(showObstaclePalette('map')).toBe(false);
    expect(showObstaclePalette('go')).toBe(false);
    expect(showObstaclePalette('map', { hasActivePath: true })).toBe(true);
    expect(showObstaclePalette('go', { hasActivePath: true })).toBe(true);
    expect(showObstaclePalette('prob', { hasActivePath: true })).toBe(false);
    expect(showObstaclePalette('net', { hasActivePath: true })).toBe(false);
  });
});
