import type { ObstacleType } from './obstacleCatalog';

/** While placing an obstacle, map clicks must not select a shipment / change view. */
export function allowShipmentSelect(placeType: ObstacleType | null): boolean {
  return placeType === null;
}

/** Palette on Map / To dispatch once a dispatch path (studio session) is active. */
export function showObstaclePalette(
  view: 'map' | 'go' | 'prob' | 'net',
  opts?: { hasActivePath?: boolean },
): boolean {
  if (view !== 'map' && view !== 'go') return false;
  return Boolean(opts?.hasActivePath);
}
