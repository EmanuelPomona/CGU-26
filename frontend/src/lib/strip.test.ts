import { describe, expect, it } from 'vitest';
import { hourTicks, stripScale, xOf } from './strip';

const ev = (eta: number, start: number, end: number) => ({ eta_min: eta, appt_start_min: start, appt_end_min: end });
const row = (eta: number, start: number, end: number) => ({ normal: ev(eta, start, end), current: ev(eta, start, end) });

describe('stripScale', () => {
  it('pads 30 min beyond the extremes and rounds outward to the half hour', () => {
    // earliest 545 (window start), latest 600 (eta) -> 515..630 -> floor 510, ceil 630
    expect(stripScale([row(560, 545, 580), row(600, 550, 595)])).toEqual({ t0: 510, t1: 630 });
  });

  it('stretches to include a row far later than the others', () => {
    const s = stripScale([row(560, 545, 580), row(900, 610, 650)]);
    expect(s.t0).toBe(510);
    expect(s.t1).toBe(930); // 900 + 30
  });

  it('includes an ETA that lands before its window', () => {
    const s = stripScale([row(500, 545, 580)]);
    expect(s.t0).toBe(450); // 500 - 30
    expect(s.t1).toBe(630); // 580 + 30 = 610 -> 630
  });

  it('includes the normal-day ETA when it differs from the current one', () => {
    const r = { normal: ev(560, 545, 580), current: ev(700, 545, 580) };
    expect(stripScale([r]).t1).toBe(750); // 700 + 30 = 730 -> 750
  });

  it('still returns a non-empty span when every value is identical', () => {
    const s = stripScale([row(600, 600, 600)]);
    expect(s).toEqual({ t0: 570, t1: 630 });
  });

  it('falls back to a default day span with no rows', () => {
    expect(stripScale([])).toEqual({ t0: 480, t1: 780 });
  });
});

describe('xOf', () => {
  const scale = { t0: 500, t1: 700 };
  it('maps t0 to 0 and t1 to the width', () => {
    expect(xOf(500, scale, 400)).toBe(0);
    expect(xOf(700, scale, 400)).toBe(400);
  });
  it('maps linearly in between', () => expect(xOf(600, scale, 400)).toBe(200));
  it('clamps values outside the span to the edges', () => {
    expect(xOf(450, scale, 400)).toBe(0);
    expect(xOf(800, scale, 400)).toBe(400);
  });
});

describe('hourTicks', () => {
  it('lists whole hours inside the span', () => expect(hourTicks({ t0: 510, t1: 690 })).toEqual([540, 600, 660]));
  it('includes an hour that sits exactly on an edge', () => expect(hourTicks({ t0: 540, t1: 600 })).toEqual([540, 600]));
});
