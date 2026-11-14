import type { DisruptionCreate } from '../api/types';

export type ObstacleType = 'road_closure' | 'wildfire' | 'flood' | 'traffic';

export type ObstacleDef = {
  type: ObstacleType;
  label: string;
  kind: 'closure' | 'hazard' | 'slowdown';
  /** Public URL for the map / palette symbol. */
  icon: string;
};

export const OBSTACLES: readonly ObstacleDef[] = [
  { type: 'road_closure', label: 'Road closure', kind: 'closure', icon: '/map-icons/obstacle-road_closure.png' },
  { type: 'wildfire', label: 'Wildfire', kind: 'hazard', icon: '/map-icons/obstacle-wildfire.png' },
  { type: 'flood', label: 'Flood', kind: 'hazard', icon: '/map-icons/obstacle-flood.png' },
  { type: 'traffic', label: 'Traffic', kind: 'slowdown', icon: '/map-icons/obstacle-traffic.png' },
] as const;

export function obstacleIconSrc(type: ObstacleType): string {
  return OBSTACLES.find((o) => o.type === type)!.icon;
}

/** Best-effort map from a board disruption back to a palette symbol. */
export function obstacleTypeForDisruption(d: { kind: string; label: string }): ObstacleType | null {
  if (d.kind === 'closure') return 'road_closure';
  if (d.kind === 'slowdown') return 'traffic';
  if (d.kind === 'hazard') {
    const l = d.label.toLowerCase();
    if (l.includes('flood')) return 'flood';
    if (l.includes('fire') || l.includes('wild')) return 'wildfire';
    return 'wildfire';
  }
  return null;
}

const DEFAULTS: Record<
  ObstacleType,
  { kind: ObstacleDef['kind']; label: string; confidence: number; radius_km: number; slowdown_factor?: number }
> = {
  road_closure: { kind: 'closure', label: 'Road closure', confidence: 0.8, radius_km: 2 },
  wildfire: { kind: 'hazard', label: 'Wildfire', confidence: 0.6, radius_km: 5 },
  flood: { kind: 'hazard', label: 'Flood', confidence: 0.5, radius_km: 3 },
  traffic: { kind: 'slowdown', label: 'Traffic slowdown', confidence: 0.7, radius_km: 4, slowdown_factor: 2.2 },
};

export function toDisruptionCreate(type: ObstacleType, lat: number, lng: number): DisruptionCreate {
  const d = DEFAULTS[type];
  const body: DisruptionCreate = {
    kind: d.kind,
    label: d.label,
    source: 'dispatcher',
    confidence: d.confidence,
    area: { lat, lng, radius_km: d.radius_km },
  };
  if (d.slowdown_factor !== undefined) body.slowdown_factor = d.slowdown_factor;
  return body;
}
