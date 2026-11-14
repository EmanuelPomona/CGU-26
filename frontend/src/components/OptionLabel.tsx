// One response option printed as a ruled label in a fixed order (reference: the FDA Nutrition Facts
// label), so two options are compared by reading across, not by decoding two layouts.
import type { ReactNode } from 'react';
import type { Burden, ResponseOption } from '../api/types';
import { clock, duration, num, pct, signed } from '../lib/format';
import type { StripScale } from '../lib/strip';
import { AppointmentStrip } from './AppointmentStrip';
import { STATUS_WORD } from './Board';

const STAKEHOLDER: Record<Burden['stakeholder'], string> = {
  driver: 'Driver',
  residents: 'Residents',
  warehouse: 'Warehouse',
  other_customer: 'Other customer',
  company: 'Company',
};

/** A delta against keep, signed, colored and worded by whether it is worse. */
function Delta({ value, unit, decimals = 0, better, money }: { value: number; unit: string; decimals?: number; better: 'lower' | 'higher'; money?: boolean }) {
  if (Number(Math.abs(value).toFixed(decimals)) === 0) return <span className="ol-delta">same as keeping the plan</span>;
  const worse = better === 'lower' ? value > 0 : value < 0;
  const text = money ? signed(value, '', decimals).replace(/^([+−])/, '$1$') : signed(value, unit, decimals);
  return (
    <span className={`ol-delta ${worse ? 'ol-worse' : 'ol-better'}`}>
      {text} vs keep, {worse ? 'worse' : 'better'}
    </span>
  );
}

function Fact({ label, value, sub, heavy }: { label: string; value: ReactNode; sub?: ReactNode; heavy?: boolean }) {
  return (
    <div className={`ol-fact${heavy ? ' ol-fact-heavy' : ''}`}>
      <dt>{label}</dt>
      <dd>
        <span className="ol-value">{value}</span>
        {sub && <span className="ol-sub">{sub}</span>}
      </dd>
    </div>
  );
}

interface Props {
  option: ResponseOption;
  normal: ResponseOption['evaluation'];
  scale: StripScale;
  isKeep: boolean;
  action?: ReactNode;
  picked?: boolean;
  onPick?: () => void;
  onPreview: (o: ResponseOption | null) => void;
}

export function OptionLabel({ option: o, normal, scale, isKeep, action, picked, onPick, onPreview }: Props) {
  const e = o.evaluation;
  const d = o.delta;
  return (
    <article
      className="ol"
      data-option={o.id}
      data-feasible={o.feasible}
      data-picked={picked || undefined}
      aria-labelledby={`ol-${o.id}`}
      onMouseEnter={() => onPreview(o)}
      onMouseLeave={() => onPreview(null)}
      onFocus={() => onPreview(o)}
      onBlur={(ev) => {
        if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) onPreview(null);
      }}
      onClick={onPick}
    >
      <header className="ol-head">
        <h3 id={`ol-${o.id}`}>{o.title}</h3>
        {o.suggested && <span className="ol-suggested">Suggested</span>}
      </header>
      <p className="ol-desc">{o.description}</p>

      <div className="ol-strip">
        <AppointmentStrip evaluation={e} normal={normal} scale={scale} compact />
      </div>

      <dl className="ol-facts">
        <Fact
          heavy
          label="On-time chance"
          value={<span className={`ol-status-${e.status}`}>{pct(e.on_time_probability)}</span>}
          sub={
            <>
              <span className={`ol-status-word ol-status-${e.status}`}>{STATUS_WORD[e.status]}</span>
              {e.needs_review && <span className="ol-unverified"> Unverified</span>}
              {!isKeep && d.on_time_probability !== 0 && (
                <span className={`ol-delta ${d.on_time_probability < 0 ? 'ol-worse' : 'ol-better'}`}>
                  {signed(Math.round(d.on_time_probability * 100), 'pts')} vs keep
                </span>
              )}
            </>
          }
        />
        <Fact
          label="Est. arrival"
          value={<span className="mono">{clock(e.eta_min)}</span>}
          sub={
            <>
              {e.slack_min >= 0 ? `${duration(e.slack_min)} before window closes` : `${duration(-e.slack_min)} late`}
              {e.appt_shift_min > 0 && `; window moved ${e.appt_shift_min} min later`}
            </>
          }
        />
        <Fact label="Miles" value={<span className="mono">{num(e.miles, 1)}</span>} sub={!isKeep && <Delta value={d.miles} unit="mi" decimals={1} better="lower" />} />
        <Fact label="Est. CO2" value={<span className="mono">{num(e.co2_kg, 0)} kg</span>} sub={!isKeep && <Delta value={d.co2_kg} unit="kg" decimals={0} better="lower" />} />
        <Fact label="Est. cost" value={<span className="mono">${num(e.cost_usd, 0)}</span>} sub={!isKeep && <Delta value={d.cost_usd} unit="" decimals={0} better="lower" money />} />
        <Fact
          label="Community score"
          value={<span className="mono">{num(e.community_score, 0)}</span>}
          sub={
            <>
              {e.community_detail}
              {!isKeep && <Delta value={d.community_score} unit="pts" decimals={0} better="higher" />}
            </>
          }
        />
        <Fact
          label="Driver hours"
          value={<span className="mono">{num(e.driver_hours, 1)} h</span>}
          sub={e.driver_hours_over > 0 ? <span className="ol-worse">{num(e.driver_hours_over, 1)} h over the limit</span> : 'within remaining hours'}
        />
      </dl>

      <div className="ol-burden">
        <h4>Who bears this</h4>
        {o.burdens.length === 0 ? (
          <p className="ol-none">No added burden beyond the plan.</p>
        ) : (
          <ul>
            {o.burdens.map((b, i) => (
              <li key={i}>
                <strong>{STAKEHOLDER[b.stakeholder]}.</strong> {b.text}
              </li>
            ))}
          </ul>
        )}
        {o.collateral.length > 0 && (
          <p className="ol-collateral">Also changes {o.collateral.map((c) => c.shipment_id).join(', ')}.</p>
        )}
      </div>

      {(o.notes.length > 0 || e.flags.length > 0) && (
        <ul className="ol-notes">
          {[...o.notes, ...e.flags.filter((f) => !o.notes.includes(f))].map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}

      {!o.feasible && (
        <p className="ol-infeasible">
          <strong>Not possible.</strong> {o.infeasible_reason}
        </p>
      )}
      {action}
    </article>
  );
}
