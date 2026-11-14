import { describe, expect, it } from 'vitest';
import { canned, mockTransport } from './mockApi';
import type { Board, Indicators } from '../api/types';

const differing = (a: Indicators, b: Indicators) =>
  (Object.keys(a) as (keyof Indicators)[]).filter((k) => a[k] !== b[k]);

describe('mock boards follow the acceptance rules', () => {
  it('P-2: normal day has identical normal, changed and current evaluations', () => {
    for (const r of canned.normal.shipments) {
      expect(r.changed).toEqual(r.normal);
      expect(r.current).toEqual(r.normal);
    }
    expect(differing(canned.normal.indicators.normal, canned.normal.indicators.changed)).toEqual([]);
    expect(canned.normal.indicators.normal.shipments_at_risk).toBe(0);
  });

  it('close60 affects the Ontario shipments and marks them for review while unverified', () => {
    const d = canned.close60Unverified.disruptions[0];
    expect(d.verification).toBe('unverified');
    expect(d.affected_shipment_ids).toEqual(expect.arrayContaining(['C-103', 'C-107']));
    const c103 = canned.close60Unverified.shipments.find((s) => s.id === 'C-103')!;
    expect(c103.current.status).toBe('at_risk');
    expect(c103.current.needs_review).toBe(true);
    expect(canned.close60Unverified.pending_verification_ids).toEqual([d.id]);
  });

  it('P-3: confirmed close60 moves at least two indicators', () => {
    const i = canned.close60Confirmed.indicators;
    expect(differing(i.normal, i.changed).length).toBeGreaterThanOrEqual(2);
    expect(canned.close60Confirmed.shipments.every((s) => !s.current.needs_review)).toBe(true);
  });

  it('P-5: after a decision the decided column differs from changed and the log has it', () => {
    const b = canned.afterDecision;
    expect(b.decisions).toHaveLength(1);
    expect(b.decisions[0].supervisor_update.length).toBeGreaterThan(20);
    expect(b.indicators.decided.shipments_at_risk).toBeLessThan(b.indicators.changed.shipments_at_risk);
  });
});

describe('mock transport', () => {
  it('P-4: dismissing returns indicators to normal and keeps the disruption listed', async () => {
    await mockTransport('POST', '/api/reset');
    const presets = (await mockTransport('GET', '/api/presets')) as { presets: { id: string; disruption: unknown }[] };
    const body = presets.presets.find((p) => p.id === 'close60')!.disruption;
    const b1 = (await mockTransport('POST', '/api/disruptions', body)) as Board;
    const id = b1.disruptions[0].id;
    const b2 = (await mockTransport('PATCH', `/api/disruptions/${id}`, { verification: 'dismissed', note: 'Caltrans says open' })) as Board;
    expect(b2.disruptions[0].verification).toBe('dismissed');
    expect(b2.indicators.changed).toEqual(b2.indicators.normal);
  });

  it('rejects an override without a reason with a 422 naming the field', async () => {
    await mockTransport('POST', '/api/reset');
    await mockTransport('POST', '/api/disruptions', { kind: 'closure', label: 'x', confidence: 1, area: { lat: 34.0, lng: -117.88, radius_km: 2 } });
    await expect(
      mockTransport('POST', '/api/decisions', { shipment_id: 'C-103', option_id: 'reroute:R-POLA-ONT-SR91' }),
    ).rejects.toMatchObject({ status: 422, field: 'reason' });
  });

  it('rejects an infeasible option with 409', async () => {
    await expect(
      mockTransport('POST', '/api/decisions', { shipment_id: 'C-103', option_id: 'spare:T8', reason: 'test' }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
