import { describe, expect, it } from 'vitest';
import { clock, duration, num, pct, signed } from './format';

// U+2212 minus sign: typographically correct beside tabular digits.
const MINUS = '−';

describe('clock', () => {
  it('formats midnight as 12:00 AM', () => expect(clock(0)).toBe('12:00 AM'));
  it('formats 555 as 9:15 AM', () => expect(clock(555)).toBe('9:15 AM'));
  it('formats noon as 12:00 PM', () => expect(clock(720)).toBe('12:00 PM'));
  it('formats 1439 as 11:59 PM', () => expect(clock(1439)).toBe('11:59 PM'));
  it('marks times past midnight with +1d', () => expect(clock(1500)).toBe('1:00 AM +1d'));
  it('rounds fractional minutes', () => expect(clock(554.6)).toBe('9:15 AM'));
});

describe('duration', () => {
  it('formats hours with zero-padded minutes', () => expect(duration(65)).toBe('1h 05m'));
  it('formats under an hour as minutes only', () => expect(duration(20)).toBe('20m'));
  it('formats zero', () => expect(duration(0)).toBe('0m'));
  it('formats negative durations with a minus sign', () => {
    expect(duration(-20)).toBe(`${MINUS}20m`);
    expect(duration(-125)).toBe(`${MINUS}2h 05m`);
  });
});

describe('signed', () => {
  it('prefixes positives with +', () => expect(signed(12, 'min')).toBe('+12 min'));
  it('prefixes negatives with a minus sign', () => expect(signed(-3.4, 'mi', 1)).toBe(`${MINUS}3.4 mi`));
  it('shows zero without a sign', () => expect(signed(0, 'kg')).toBe('0 kg'));
  it('treats values that round to zero as zero', () => expect(signed(-0.04, 'mi', 1)).toBe('0 mi'));
  it('omits the space when unit is empty', () => expect(signed(5, '')).toBe('+5'));
});

describe('num', () => {
  it('adds thousands separators', () => expect(num(1234.56, 1)).toBe('1,234.6'));
  it('pads to fixed decimals', () => expect(num(12, 1)).toBe('12.0'));
});

describe('pct', () => {
  it('renders a probability as whole percent', () => expect(pct(0.856)).toBe('86%'));
});
