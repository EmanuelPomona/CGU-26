import { useEffect, useState } from 'react';
import { ApiError, createDecision, deleteDecision, getMethod } from '../../api/client';
import type { Board, Decision, Indicators, Method, OptionsResponse, ResponseOption, ShipmentRow } from '../../api/types';
import { clock, signed } from '../../lib/format';
import { evalFor, type View } from './ProtoMap';

type Apply = (r: () => Promise<Board>) => Promise<Board>;
const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'The request failed.');

const CHIP = { on_time: ['ok', 'ON TIME'], tight: ['tight', 'TIGHT'], at_risk: ['risk', 'AT RISK'] } as const;
function StatusChip({ s }: { s: keyof typeof CHIP }) {
  return <span className={`chip ${CHIP[s][0]}`}>{CHIP[s][1]}</span>;
}

/* ---------------- Shipments + options ---------------- */
export function ShipmentsPane(props: {
  board: Board;
  view: View;
  selectedId: string | null;
  onSelect: (id: string) => void;
  options: OptionsResponse | null;
  optionsError: string | null;
  reloadOptions: () => void;
  apply: Apply;
  setBoard: (b: Board) => void;
  onDecided: () => void;
}) {
  const { board, view, selectedId, onSelect } = props;
  const row = board.shipments.find((s) => s.id === selectedId) ?? null;
  return (
    <div className="pane">
      <div className="legend small mute">
        <span><i style={{ background: 'var(--ok)' }} />on time likely</span>
        <span><i style={{ background: 'var(--warn)' }} />tight</span>
        <span><i style={{ background: 'var(--bad)' }} />at risk</span>
      </div>
      {board.shipments.map((s) => (
        <OrderCard key={s.id} row={s} view={view} selected={s.id === selectedId} onSelect={onSelect} />
      ))}
      {row && <OptionsList {...props} row={row} />}
    </div>
  );
}

function OrderCard({ row, view, selected, onSelect }: { row: ShipmentRow; view: View; selected: boolean; onSelect: (id: string) => void }) {
  const e = evalFor(row, view);
  const approved = view === 'changed' && row.decision_id;
  return (
    <div
      className={`ord ${selected ? 'sel' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      data-row-id={row.id}
      onClick={() => onSelect(row.id)}
      onKeyDown={(k) => (k.key === 'Enter' || k.key === ' ') && (k.preventDefault(), onSelect(row.id))}
    >
      <div className="l1">
        <b>{row.id}</b> <StatusChip s={e.status} />
        {row.priority === 'high' && <span className="chip sim">priority</span>}
        {approved && <span className="chip appr">approved change</span>}
        <span className="mute" style={{ marginLeft: 'auto' }}>
          {row.terminal_id} → {row.warehouse_id}
        </span>
      </div>
      <div className="l2">
        {row.cargo} · truck {e.truck_id ?? 'none'} · window {clock(e.appt_start_min)} to {clock(e.appt_end_min)}
      </div>
      <div className="l2">
        ETA <b>{e.truck_id ? clock(e.eta_min) : 'unknown'}</b> · slack <b className={e.slack_min < 0 ? 'badc' : ''}>{signed(e.slack_min, 'min')}</b> · P(on time){' '}
        <b>{Math.round(e.on_time_probability * 100)}%</b> · CO₂ {e.co2_kg.toFixed(0)} kg · ${e.cost_usd.toFixed(0)}
      </div>
      {(e.flags.length > 0 || e.needs_review) && (
        <div className="flags">
          {e.flags.map((f) => (
            <span key={f} className="flag">{f}</span>
          ))}
          {e.needs_review && <span className="chip rev">needs review</span>}
        </div>
      )}
    </div>
  );
}

/** Coloured delta vs keeping the plan. `lowerIsBetter` decides which direction is good. */
function D({ v, d = 0, unit = '', lowerIsBetter = true }: { v: number; d?: number; unit?: string; lowerIsBetter?: boolean }) {
  if (Math.abs(v) < (d ? 0.05 : 0.5)) return <b>{(0).toFixed(d)}{unit}</b>;
  const good = lowerIsBetter ? v < 0 : v > 0;
  return <b className={good ? 'good' : 'badc'}>({signed(v, unit, d)})</b>;
}

function OptionsList(props: {
  board: Board;
  row: ShipmentRow;
  options: OptionsResponse | null;
  optionsError: string | null;
  reloadOptions: () => void;
  apply: Apply;
  setBoard: (b: Board) => void;
  onDecided: () => void;
}) {
  const { board, row, options, optionsError, reloadOptions, apply, setBoard, onDecided } = props;
  const [busy, setBusy] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const decision: Decision | undefined = board.decisions.find((d) => d.shipment_id === row.id);

  useEffect(() => {
    setReasonFor(null);
    setReason('');
    setError(null);
  }, [row.id]);

  if (optionsError) {
    return (
      <div className="small" style={{ margin: '10px 0' }}>
        <span className="err">{optionsError}</span>{' '}
        <button className="b" onClick={reloadOptions}>Retry</button>
      </div>
    );
  }
  if (!options || options.shipment_id !== row.id) return <div className="mute small" style={{ margin: '10px 0' }}>Working out options…</div>;


  const approve = async (o: ResponseOption, why?: string) => {
    if (!o.suggested && why === undefined) {
      setReasonFor(o.id);
      setReason('');
      setError(null);
      return;
    }
    if (why !== undefined && why.trim().length < 3) {
      setError('Say briefly why (at least 3 characters).');
      return;
    }
    setBusy(o.id);
    setError(null);
    try {
      const r = await createDecision({ shipment_id: row.id, option_id: o.id, ...(why !== undefined ? { reason: why.trim() } : {}) });
      setBoard(r.board);
      setReasonFor(null);
      onDecided();
    } catch (e) {
      setError(msg(e));
      if (e instanceof ApiError && e.status === 409) reloadOptions();
    } finally {
      setBusy(null);
    }
  };

  const undo = async () => {
    if (!decision) return;
    setBusy('undo');
    try {
      await apply(() => deleteDecision(decision.id));
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <h3>{row.id}: choose a response</h3>
      <div className="small mute">
        Recommendation = best weighted score under your Priorities. <b>You decide.</b> Nothing is sent until you approve.
      </div>
      {decision && (
        <div className="opt done">
          <div className="oh">
            <b>✓ Approved: {decision.option_title}</b>
            <span className="chip appr">{decision.was_suggested ? 'recommended' : 'your choice'}</span>
          </div>
          <div className="od">
            {CHIP[decision.before.status][1].toLowerCase()} before, {CHIP[decision.after.status][1].toLowerCase()} after
            {decision.reason && ` · reason: ${decision.reason}`}. The options below are recalculated from the approved plan.
          </div>
          <button className="b" disabled={busy !== null} onClick={undo}>
            {busy === 'undo' ? 'Undoing…' : 'Undo approval'}
          </button>
        </div>
      )}
      {row.attention === 'none' && !decision && <div className="small good" style={{ marginTop: 4 }}>No action needed: the arrival is inside the window.</div>}
      {options.options.map((o) => {
        const m = o.evaluation;
        const isKeep = o.kind === 'keep';
        const isAp = decision?.option_id === o.id;
        return (
          <div key={o.id} className={`opt ${o.suggested ? 'rec' : ''} ${isAp ? 'done' : ''} ${o.feasible ? '' : 'nf'}`}>
            <div className="oh">
              <b>{o.title}</b>
              {o.suggested && <span className="chip ok">Recommended</span>}
              {!o.feasible && <span className="chip risk">not feasible</span>}
              {m.needs_review && <span className="chip rev">uncertain input</span>}
              <span className="score">{Math.round(o.scores.overall)}</span>
            </div>
            <div className="od">{o.description}</div>
            <div className="grid">
              <div>
                <span>On-time odds</span>
                <b>
                  {Math.round(m.on_time_probability * 100)}% {!isKeep && `(${signed(Math.round(o.delta.on_time_probability * 100), 'pt')})`}
                </b>
              </div>
              <div>
                <span>Late (min)</span>
                <b>{m.late_min} {!isKeep && <D v={o.delta.late_min} />}</b>
              </div>
              <div>
                <span>Round-trip miles</span>
                <b>{m.miles.toFixed(0)} {!isKeep && <D v={o.delta.miles} d={1} />}</b>
              </div>
              <div>
                <span>CO₂ (est.)</span>
                <b>{m.co2_kg.toFixed(0)} kg {!isKeep && <D v={o.delta.co2_kg} d={1} />}</b>
              </div>
              <div>
                <span>Cost (est.)</span>
                <b>${m.cost_usd.toFixed(0)} {!isKeep && <D v={o.delta.cost_usd} />}</b>
              </div>
              <div>
                <span>Community</span>
                <b>{m.community_score.toFixed(0)}/100 {!isKeep && <D v={o.delta.community_score} lowerIsBetter={false} />}</b>
              </div>
            </div>
            {(o.burdens.length > 0 || !o.feasible) && (
              <div className="burden">
                <b>Who bears the impact</b>
                {o.burdens.map((b, i) => (
                  <div key={i}>{b.text}</div>
                ))}
                {!o.feasible && o.infeasible_reason && <div>{o.infeasible_reason}</div>}
                {o.notes.map((n, i) => (
                  <div key={`n${i}`}>{n}</div>
                ))}
              </div>
            )}
            <div className="optact">
              {isAp ? (
                <>
                  <button className="b" disabled={busy !== null} onClick={undo}>
                    {busy === 'undo' ? 'Undoing…' : 'Undo approval'}
                  </button>
                  <span className="good">✓ approved</span>
                </>
              ) : (
                <button className={`b ${o.suggested ? 'pri' : ''}`} disabled={!o.feasible || busy !== null} onClick={() => approve(o)}>
                  {busy === o.id ? 'Saving…' : o.suggested ? 'Approve recommendation' : 'Choose this instead'}
                </button>
              )}
              <details>
                <summary>why this score</summary>
                <div className="small mute" style={{ maxWidth: 300 }}>
                  reliability {o.scores.reliability.toFixed(0)} · cost {o.scores.cost.toFixed(0)} · CO₂ {o.scores.emissions.toFixed(0)} · community {o.scores.community.toFixed(0)} · driver {o.scores.driver.toFixed(0)}
                  <br />
                  {m.community_detail}
                  <br />
                  Weights: {Object.entries(options.weights).map(([k, v]) => `${k} ${v}`).join(', ')}
                </div>
              </details>
              {reasonFor === o.id && (
                <form
                  className="reason"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void approve(o, reason);
                  }}
                >
                  <input type="text" autoFocus aria-label="Reason for choosing this instead of the recommendation" placeholder="Why this instead of the recommendation?" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
                  <button className="b pri" type="submit" disabled={busy !== null}>Confirm</button>
                  <button className="b" type="button" onClick={() => setReasonFor(null)}>Cancel</button>
                </form>
              )}
            </div>
          </div>
        );
      })}
      {error && <div className="err">{error}</div>}
      <div className="small mute" style={{ marginTop: 4 }}>{options.rationale}</div>
      {decision && <DraftMessage text={decision.supervisor_update} />}
    </div>
  );
}

function DraftMessage({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <h3>Draft message (not sent)</h3>
      <textarea className="draft" readOnly value={text} />
      <button
        className="b"
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </>
  );
}

/* ---------------- Compare ---------------- */
const ROWS: Array<[string, keyof Indicators, number, boolean]> = [
  ['Shipments at risk', 'shipments_at_risk', 0, true],
  ['Shipments tight', 'shipments_tight', 0, true],
  ['Total lateness (min)', 'total_late_min', 0, true],
  ['Round-trip miles', 'fleet_miles', 0, true],
  ['Estimated CO₂ (kg)', 'co2_kg', 0, true],
  ['Estimated cost ($)', 'cost_usd', 0, true],
  ['Community score (avg /100)', 'community_score_avg', 1, false],
  ['Drivers over hour limit', 'drivers_over_hours', 0, true],
  ['Driver idle time (min)', 'idle_min', 0, true],
];

export function ComparePane({ board }: { board: Board }) {
  const { normal: n, changed: d0, decided: d1, checks } = board.indicators;
  const has = board.disruptions.some((d) => d.verification !== 'dismissed');
  const [copied, setCopied] = useState(false);
  const delta = (v: number, b: number, lowerIsBetter: boolean, dec: number) => {
    const diff = Number((v - b).toFixed(dec));
    if (diff === 0) return null;
    const good = lowerIsBetter ? diff < 0 : diff > 0;
    return <span className={good ? 'good' : 'badc'}> ({signed(diff, '', dec)})</span>;
  };
  const md = () =>
    '| Indicator | Normal | Disrupted (no action) | Disrupted (approved) |\n|---|---|---|---|\n' +
    ROWS.map(([label, k, dec]) => `| ${label} | ${[n, d0, d1].map((x) => x[k].toFixed(dec)).join(' | ')} |`).join('\n');
  return (
    <div className="pane">
      <h3>Same dispatcher, same data, three states</h3>
      {!has && <div className="small mute">No disruption selected yet: add one on the Scenario tab.</div>}
      <table className="cmp">
        <thead>
          <tr>
            <th />
            <th>Normal</th>
            <th>Disrupted<br />(no action)</th>
            <th>Disrupted<br />(your approvals)</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([label, k, dec, lower]) => (
            <tr key={k}>
              <td>{label}</td>
              <td>{n[k].toFixed(dec)}</td>
              <td>{d0[k].toFixed(dec)}{delta(d0[k], n[k], lower, dec)}</td>
              <td>{d1[k].toFixed(dec)}{delta(d1[k], n[k], lower, dec)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="small mute" style={{ margin: '8px 0' }}>
        Brackets show change vs. the normal day. All values are model estimates from synthetic shipments (see Method tab); they are not measured outcomes.
      </div>
      {checks.filter((c) => c.triggered).map((c) => (
        <div key={c.id} className="small" style={{ margin: '4px 0' }}>
          <b>{c.label}.</b> {c.detail}
        </div>
      ))}
      <button
        className="b"
        onClick={() => {
          void navigator.clipboard?.writeText(md()).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
      >
        {copied ? 'Copied' : 'Copy table (markdown)'}
      </button>
    </div>
  );
}

/* ---------------- Method ---------------- */
export function MethodPane() {
  const [m, setM] = useState<Method | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    setError(null);
    getMethod().then(setM).catch((e) => setError(msg(e)));
  };
  useEffect(load, []);
  if (error)
    return (
      <div className="pane">
        <span className="err">{error}</span> <button className="b" onClick={load}>Retry</button>
      </div>
    );
  if (!m) return <div className="pane mute">Loading…</div>;
  return (
    <div className="pane small">
      <h3>How the numbers are made</h3>
      <div>All scores are rule-based from the assumptions below; nothing here is a trained model.</div>
      <h3>Assumptions</h3>
      <table className="cmp">
        <tbody>
          {m.assumptions.map((a) => (
            <tr key={a.key}>
              <td>{a.label}</td>
              <td>{a.value} {a.unit}</td>
              <td><span className={`chip ${a.kind === 'public' ? 'live' : 'sim'}`}>{a.kind}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Formulas</h3>
      {m.formulas.map((f) => (
        <div key={f.id} className="item">
          <b>{f.label}</b>
          <div style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{f.expression}</div>
          <div className="mute">{f.explanation}</div>
        </div>
      ))}
      <h3>Data sources</h3>
      {m.data_sources.map((s) => (
        <div key={s.name} className="item">
          <b>{s.name}</b> <span className={`chip ${s.kind === 'public' ? 'live' : 'sim'}`}>{s.kind}</span>
          <div>Used for: {s.used_for}</div>
          <div className="mute">Limits: {s.limits}</div>
        </div>
      ))}
      <h3>Not modeled</h3>
      <ul>
        {m.not_modeled.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <h3>Responsible design</h3>
      {m.responsible_design.map((r) => (
        <div key={r.consideration}>
          <b>{r.consideration.replace('_', ' ')}:</b> {r.how}
        </div>
      ))}
    </div>
  );
}
