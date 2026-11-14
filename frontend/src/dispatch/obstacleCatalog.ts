import type { DisruptionCreate } from '../api/types';

export type ObstacleType = 'road_closure' | 'wildfire' | 'flood' | 'traffic';

export type ObstacleDef = {
  type: ObstacleType;
  label: string;
  kind: 'closure' | 'hazard' | 'slowdown';
};

export const OBSTACLES: readonly ObstacleDef[] = [
  { type: 'road_closure', label: 'Road closure', kind: 'closure' },
  { type: 'wildfire', label: 'Wildfire', kind: 'hazard' },
  { type: 'flood', label: 'Flood', kind: 'hazard' },
  { type: 'traffic', label: 'Traffic', kind: 'slowdown' },
] as const;

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
