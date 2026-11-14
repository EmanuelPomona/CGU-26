// The signature element (docs/DESIGN_BRIEF.md): the appointment window as a bracket, the estimated
// arrival as a tick with an uncertainty whisker, and the normal-day arrival left behind as a shorter
// grey ghost. Hollow tick and dashed whisker when the estimate rests on an unverified report.
import type { Evaluation } from '../api/types';
import { clock, duration } from '../lib/format';
import { hourTicks, xOf, type StripScale } from '../lib/strip';
import { useWidth } from '../lib/useWidth';
import './AppointmentStrip.css';

interface Props {
  evaluation: Evaluation;
  normal?: Evaluation;
  scale: StripScale;
  compact?: boolean;
}

const STATUS_WORD = { on_time: 'on time', tight: 'tight', at_risk: 'at risk' } as const;

export function stripLabel(e: Evaluation, normal?: Evaluation): string {
  const slack =
    e.slack_min >= 0 ? `${duration(e.slack_min)} of slack` : `${duration(-e.slack_min)} after the window closes`;
  const parts = [
    `Estimated ${clock(e.eta_min)}, plus or minus ${Math.round(e.eta_sigma_min)} minutes`,
    `window ${clock(e.appt_start_min)} to ${clock(e.appt_end_min)}`,
    slack,
    STATUS_WORD[e.status],
  ];
  if (normal && normal.eta_min !== e.eta_min) parts.push(`normal day ${clock(normal.eta_min)}`);
  if (e.needs_review) parts.push('unverified');
  return parts.join(', ');
}

export function AppointmentStrip({ evaluation: e, normal, scale, compact = false }: Props) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = compact ? 30 : 34;
  const mid = h / 2;
  const x = (m: number) => xOf(m, scale, w);
  const hollow = e.needs_review;
  const color = `var(--${e.status === 'on_time' ? 'on-time' : e.status === 'tight' ? 'tight' : 'at-risk'})`;

  const ws = x(e.appt_start_min);
  const we = x(e.appt_end_min);
  const shifted = normal && normal.appt_start_min !== e.appt_start_min;
  const ghostEta = normal && normal.eta_min !== e.eta_min ? x(normal.eta_min) : null;
  const eta = x(e.eta_min);
  const offRight = e.eta_min > scale.t1;
  const offLeft = e.eta_min < scale.t0;
  const wl = x(e.eta_min - e.eta_sigma_min);
  const wr = x(e.eta_min + e.eta_sigma_min);

  return (
    <div ref={ref} className="strip" role="img" aria-label={stripLabel(e, normal)}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        {hourTicks(scale).map((t) => (
          <line key={t} className="strip-hour" x1={x(t)} x2={x(t)} y1={h - 5} y2={h} />
        ))}
        <line className="strip-axis" x1={0} x2={w} y1={h - 0.5} y2={h - 0.5} />

        {shifted && (
          <Bracket className="strip-bracket strip-bracket-ghost" x0={x(normal.appt_start_min)} x1={x(normal.appt_end_min)} h={h} />
        )}
        <rect className="strip-window" x={ws} y={4} width={Math.max(1, we - ws)} height={h - 9} />
        <Bracket className="strip-bracket" x0={ws} x1={we} h={h} />

        {ghostEta !== null && (
          <>
            <line className="strip-travel" x1={ghostEta} x2={eta} y1={mid} y2={mid} />
            <line className="strip-ghost" x1={ghostEta} x2={ghostEta} y1={mid - 6} y2={mid + 6} />
          </>
        )}

        <g className="strip-live" style={{ transform: `translateX(${eta}px)`, color }}>
          <line
            className={hollow ? 'strip-whisker strip-whisker-dashed' : 'strip-whisker'}
            x1={wl - eta}
            x2={wr - eta}
            y1={mid}
            y2={mid}
          />
          <line className="strip-cap" x1={wl - eta} x2={wl - eta} y1={mid - 3} y2={mid + 3} />
          <line className="strip-cap" x1={wr - eta} x2={wr - eta} y1={mid - 3} y2={mid + 3} />
          <rect
            className={hollow ? 'strip-tick strip-tick-hollow' : 'strip-tick'}
            x={-2.5}
            y={3}
            width={5}
            height={h - 8}
          />
          {offRight && <path className="strip-off" d={`M -12 ${mid - 5} L -6 ${mid} L -12 ${mid + 5}`} />}
          {offLeft && <path className="strip-off" d={`M 12 ${mid - 5} L 6 ${mid} L 12 ${mid + 5}`} />}
        </g>
      </svg>
    </div>
  );
}

function Bracket({ x0, x1, h, className }: { x0: number; x1: number; h: number; className: string }) {
  const top = 2;
  const bot = h - 4;
  const serif = Math.min(5, Math.max(2, (x1 - x0) / 4));
  return (
    <path
      className={className}
      d={`M ${x0 + serif} ${top} H ${x0} V ${bot} H ${x0 + serif} M ${x1 - serif} ${top} H ${x1} V ${bot} H ${x1 - serif}`}
    />
  );
}

/** Hour labels above the strip column, on the same axis as every strip. */
export function StripAxis({ scale }: { scale: StripScale }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  let last = -Infinity;
  return (
    <div ref={ref} className="strip-axis-head" aria-hidden="true">
      {hourTicks(scale).map((t) => {
        const left = xOf(t, scale, w);
        if (left < 18 || left > w - 18 || left - last < 46) return null;
        last = left;
        return (
          <span key={t} style={{ left }}>
            {clock(t).replace(':00', '').replace(' ', ' ')}
          </span>
        );
      })}
    </div>
  );
}
