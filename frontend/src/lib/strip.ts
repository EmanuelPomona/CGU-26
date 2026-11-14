// Pixel geometry for the appointment strip. No domain math: every time comes from the Board.

export interface StripScale {
  t0: number;
  t1: number;
}

interface StripEval {
  eta_min: number;
  appt_start_min: number;
  appt_end_min: number;
}

interface StripRow {
  normal: StripEval;
  current: StripEval;
}

const PAD = 30;
const HALF_HOUR = 30;
const DEFAULT: StripScale = { t0: 480, t1: 780 };

/** One shared time axis for the whole board, padded and rounded outward to the half hour. */
export function stripScale(rows: StripRow[]): StripScale {
  if (rows.length === 0) return { ...DEFAULT };
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of rows) {
    for (const e of [r.normal, r.current]) {
      lo = Math.min(lo, e.eta_min, e.appt_start_min);
      hi = Math.max(hi, e.eta_min, e.appt_end_min);
    }
  }
  return {
    t0: Math.floor((lo - PAD) / HALF_HOUR) * HALF_HOUR,
    t1: Math.ceil((hi + PAD) / HALF_HOUR) * HALF_HOUR,
  };
}

/** Minutes -> x in [0, width], clamped to the strip edges. */
export function xOf(min: number, scale: StripScale, width: number): number {
  const span = scale.t1 - scale.t0 || 1;
  const x = ((min - scale.t0) / span) * width;
  return Math.max(0, Math.min(width, x));
}

/** Whole hours inside the span, inclusive of edges. */
export function hourTicks(scale: StripScale): number[] {
  const out: number[] = [];
  for (let h = Math.ceil(scale.t0 / 60) * 60; h <= scale.t1; h += 60) out.push(h);
  return out;
}
