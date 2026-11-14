// One ruled table row of figures, normal against changed against decided. Not stat tiles:
// each column is a comparison with a formula on the Method page (brief, Justified exceptions).
import type { Check, IndicatorSet, Indicators } from '../api/types';
import { num, signed } from '../lib/format';
import './IndicatorStrip.css';

type Key = keyof Indicators;

const COLUMNS: Array<{ key: Key; label: string; unit: string; decimals: number; better: 'lower' | 'higher'; money?: boolean }> = [
  { key: 'shipments_at_risk', label: 'At risk', unit: '', decimals: 0, better: 'lower' },
  { key: 'total_late_min', label: 'Late', unit: 'min', decimals: 0, better: 'lower' },
  { key: 'fleet_miles', label: 'Miles', unit: 'mi', decimals: 1, better: 'lower' },
  { key: 'co2_kg', label: 'CO2 kg est.', unit: 'kg', decimals: 0, better: 'lower' },
  { key: 'cost_usd', label: 'Cost est.', unit: '', decimals: 0, better: 'lower', money: true },
  { key: 'community_score_avg', label: 'Community', unit: '', decimals: 0, better: 'higher' },
  { key: 'drivers_over_hours', label: 'Over hours', unit: '', decimals: 0, better: 'lower' },
];

const same = (a: Indicators, b: Indicators) => COLUMNS.every((c) => a[c.key] === b[c.key]);

interface Props {
  indicators: IndicatorSet;
  hasDecisions: boolean;
}

export function IndicatorStrip({ indicators, hasDecisions }: Props) {
  const changed = !same(indicators.normal, indicators.changed);
  const rows: Array<{ id: string; label: string; values: Indicators }> = [
    { id: 'normal', label: 'Normal', values: indicators.normal },
  ];
  if (changed) rows.push({ id: 'changed', label: 'Changed', values: indicators.changed });
  if (hasDecisions) rows.push({ id: 'decided', label: 'Decided', values: indicators.decided });
  const triggered = indicators.checks.filter((c) => c.triggered);

  return (
    <div className="ind">
      <table className="ind-table">
        <caption className="visually-hidden">Indicators: normal day, changed conditions, after decisions</caption>
        <thead>
          <tr>
            <th scope="col" className="ind-rowhead">
              <span className="visually-hidden">Scenario</span>
            </th>
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} data-row={r.id}>
              <th scope="row" className="ind-rowhead">
                {r.label}
              </th>
              {COLUMNS.map((c) => {
                const v = r.values[c.key];
                const base = indicators.normal[c.key];
                const d = v - base;
                const worse = c.better === 'lower' ? d > 0 : d < 0;
                const shown = Number(Math.abs(d).toFixed(c.decimals)) !== 0;
                return (
                  <td key={c.key}>
                    <span className="ind-fig">{c.money ? `$${num(v, 0)}` : num(v, c.decimals)}</span>
                    {r.id !== 'normal' && shown && (
                      <span className={`ind-delta ${worse ? 'ind-worse' : 'ind-better'}`}>
                        {c.money ? signed(d, '', 0).replace(/^([+−])/, '$1$') : signed(d, c.unit, c.decimals)}
                        <span className="visually-hidden">{worse ? ', worse than normal' : ', better than normal'}</span>
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {!changed && !hasDecisions && <p className="ind-note">Normal day. No changed conditions, so there is nothing to compare yet.</p>}
      {triggered.length > 0 && (
        <ul className="ind-checks" aria-label="Checks">
          {triggered.map((c: Check) => (
            <li key={c.id} data-check={c.id}>
              <strong>{c.label}.</strong> {c.detail}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
