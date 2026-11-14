import type { ObstacleType } from './obstacleCatalog';

/** While placing an obstacle, map clicks must not select a shipment / change view. */
export function allowShipmentSelect(placeType: ObstacleType | null): boolean {
  return placeType === null;
}

/** Palette only where shipment routes are drawn (Map and To dispatch). */
export function showObstaclePalette(view: 'map' | 'go' | 'prob' | 'net'): boolean {
  return view === 'map' || view === 'go';
}
