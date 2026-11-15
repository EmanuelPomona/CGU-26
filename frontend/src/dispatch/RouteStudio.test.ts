import { describe, expect, it } from 'vitest';
import { demoJobFor, routeByKind } from './demoRoutes';

describe('demo routes for George', () => {
  it('defaults to environment & community minimized', () => {
    const job = demoJobFor('C-102');
    expect(job?.chosenKind).toBe('impact');
    const impact = routeByKind(job!, 'impact', false);
    expect(impact.scores.community.score).toBeGreaterThan(routeByKind(job!, 'fastest', false).scores.community.score);
    expect(impact.scores.environment.reasons.length).toBeGreaterThan(0);
  });

  it('offers the same two kinds after an obstacle', () => {
    const job = demoJobFor('C-102')!;
    expect(job.reroutes.map((r) => r.kind)).toEqual(['fastest', 'impact']);
  });
});
