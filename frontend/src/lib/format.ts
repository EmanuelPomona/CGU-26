// Display formatters. Pure: the backend owns every number; these only print them.

const MINUS = '−';

/** Minutes after local midnight -> "9:15 AM", with "+1d" once past midnight. */
export function clock(min: number): string {
  const m = Math.round(min);
  const day = Math.floor(m / 1440);
  const inDay = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(inDay / 60);
  const mm = String(inDay % 60).padStart(2, '0');
  const text = `${h % 12 || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
  return day > 0 ? `${text} +${day}d` : text;
}

/** Duration in minutes -> "1h 05m" or "20m"; negatives get a minus sign. */
export function duration(min: number): string {
  const m = Math.round(min);
  const abs = Math.abs(m);
  const sign = m < 0 ? MINUS : '';
  if (abs < 60) return `${sign}${abs}m`;
  return `${sign}${Math.floor(abs / 60)}h ${String(abs % 60).padStart(2, '0')}m`;
}

/** Signed delta: "+12 min", "-3.4 mi" (true minus), "0 kg". */
export function signed(n: number, unit: string, decimals = 0): string {
  const fixed = Math.abs(n).toFixed(decimals);
  const isZero = Number(fixed) === 0;
  const sign = isZero ? '' : n > 0 ? '+' : MINUS;
  return `${sign}${isZero ? '0' : fixed}${unit ? ` ${unit}` : ''}`;
}

/** Fixed decimals with thousands separators: 1234.5 -> "1,234.5". */
export function num(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}
