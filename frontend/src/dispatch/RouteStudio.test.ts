import { describe, expect, it } from 'vitest';
import type { StudioAlternative } from '../api/types';
import { sortStudioAlts } from './RouteStudio';

const stub = (slot: StudioAlternative['slot']): StudioAlternative => ({
  id: slot,
  slot,
  algorithm: 'x',
  label: slot,
  feasible: true,
  infeasible_reason: null,
  summary: '',
  pros: [],
  cons: [],
  metrics: { eta_min: 1, distance_km: 1, co2_kg: 1, obstacle_exposure: 0, local_street_km: 0 },
  geometry: [],
  node_ids: [],
});

describe('sortStudioAlts', () => {
  it('orders Fastest, Direct, Avoid', () => {
    const sorted = sortStudioAlts([stub('avoid'), stub('fastest'), stub('direct')]);
    expect(sorted.map((a) => a.slot)).toEqual(['fastest', 'direct', 'avoid']);
  });
});
