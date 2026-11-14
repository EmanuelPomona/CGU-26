import type { ObstacleType } from './obstacleCatalog';

/** While placing an obstacle, map clicks must not select a shipment / change view. */
export function allowShipmentSelect(placeType: ObstacleType | null): boolean {
  return placeType === null;
}

/** Palette only where shipment routes are drawn (Map and To dispatch), or in Route studio with a session. */
export function showObstaclePalette(
  view: 'map' | 'go' | 'prob' | 'net',
  opts?: { studioMode?: boolean; hasStudioSession?: boolean },
): boolean {
  if (opts?.studioMode) return Boolean(opts.hasStudioSession);
  return view === 'map' || view === 'go';
}
