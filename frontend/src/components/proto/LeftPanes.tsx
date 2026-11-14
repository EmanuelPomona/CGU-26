import { useEffect, useRef, useState } from 'react';
import {
  ApiError, createDisruption, deleteDisruption, getFeedCandidates, getPresets, postReset, putSettings, updateDisruption,
} from '../../api/client';
import type { Board, DisruptionCreate, FeedCandidates, Preset, Weights } from '../../api/types';
import { clock } from '../../lib/format';

type Apply = (r: () => Promise<Board>) => Promise<Board>;
const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'The request failed.');

export interface DrawDraft {
  kind: 'slowdown' | 'closure' | 'hazard';
  radius_km: number;
  slowdown_factor: number;
  confidence: number;
}

const SOURCE: Record<string, { cls: string; text: string }> = {
  simulated: { cls: 'sim', text: 'SIMULATED' },
  dispatcher: { cls: 'sim', text: 'ENTERED BY DISPATCHER' },
  public_feed: { cls: 'live', text: 'LIVE · PUBLIC FEED' },
};

/* ---------------- Scenario ---------------- */
export function ScenarioPane(props: {
  board: Board;
  apply: Apply;
  onChanged: () => void;
  draft: DrawDraft;
  setDraft: (d: DrawDraft) => void;
  placing: boolean;
  setPlacing: (on: boolean) => void;
  showPlaces: boolean;
  setShowPlaces: (v: boolean) => void;
  showTrucks: boolean;
  setShowTrucks: (v: boolean) => void;
}) {
  const { board, apply, onChanged, draft, setDraft, placing, setPlacing } = props;
  const [presets, setPresets] = useState<Preset[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clockMin, setClockMin] = useState(board.settings.clock_min);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    getPresets()
      .then((r) => setPresets(r.presets))
      .catch((e) => setError(msg(e)));
  }, []);
  useEffect(() => setClockMin(board.settings.clock_min), [board.settings.clock_min]);

  const run = async (key: string, req: () => Promise<Board>, changed = false) => {
    setBusy(key);
    setError(null);
    try {
      await apply(req);
      if (changed) onChanged();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(null);
    }
  };

  const setClock = (v: number) => {
    setClockMin(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => void run('clock', () => putSettings({ clock_min: v, weights: board.settings.weights })),
      350,
    );
  };

  return (
    <div className="pane">
      <h3>Dispatch clock</h3>
      <label className="row">
        <span className="k">Time now</span>
        <input type="range" min={360} max={1080} step={15} value={clockMin} onChange={(e) => setClock(Number(e.target.value))} />
        <span className="val">{clock(clockMin)}</span>
      </label>

      <h3>Change a condition (what-if)</h3>
      <div className="presets">
        {presets.map((p) => (
          <button key={p.id} className="b" data-preset={p.id} disabled={busy !== null} title={p.description} onClick={() => run(p.id, () => createDisruption(p.disruption), true)}>
            {busy === p.id ? 'Adding…' : p.label}
          </button>
        ))}
        <button className="b" disabled={busy !== null} onClick={() => run('clear', postReset)}>
          {busy === 'clear' ? 'Clearing…' : 'Clear all'}
        </button>
      </div>

      <h3>Or draw your own on the map</h3>
      <label className="row">
        <span className="k">Type</span>
        <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as DrawDraft['kind'] })}>
          <option value="slowdown">Traffic slowdown / crash</option>
          <option value="closure">Road closure</option>
          <option value="hazard">Hazard area (fire / flood)</option>
        </select>
      </label>
      <label className="row">
        <span className="k">Radius</span>
        <input type="range" min={0.5} max={12} step={0.5} value={draft.radius_km} onChange={(e) => setDraft({ ...draft, radius_km: Number(e.target.value) })} />
        <span className="val">{draft.radius_km.toFixed(1)} km</span>
      </label>
      {draft.kind === 'slowdown' && (
        <label className="row">
          <span className="k">Slowdown ×</span>
          <input type="range" min={1.2} max={4} step={0.1} value={draft.slowdown_factor} onChange={(e) => setDraft({ ...draft, slowdown_factor: Number(e.target.value) })} />
          <span className="val">×{draft.slowdown_factor.toFixed(1)}</span>
        </label>
      )}
      <label className="row">
        <span className="k">Confidence</span>
        <input type="range" min={0.2} max={1} step={0.05} value={draft.confidence} onChange={(e) => setDraft({ ...draft, confidence: Number(e.target.value) })} />
        <span className="val">{Math.round(draft.confidence * 100)}%</span>
      </label>
      <button className={`b pri ${placing ? 'on-place' : ''}`} onClick={() => setPlacing(!placing)}>
        {placing ? 'Click the map… (cancel)' : 'Click map to place'}
      </button>

      <h3>Active disruptions</h3>
      {board.disruptions.length === 0 ? (
        <div className="small mute">None. Use “Normal day” vs “Disruption” to compare.</div>
      ) : (
        board.disruptions.map((d) => {
          const src = SOURCE[d.source];
          return (
            <div key={d.id} className={`dis ${d.verification === 'dismissed' ? 'dismissed' : ''}`}>
              <div>
                <b>{d.label}</b>
                <br />
                <span className={`chip ${src.cls}`}>{src.text}</span>{' '}
                {d.verification === 'unverified' && <span className="chip rev">needs review</span>}
                {d.verification === 'confirmed' && <span className="chip ok">confirmed</span>}
                {d.verification === 'dismissed' && <span className="chip">dismissed</span>}
                <div className="small mute">
                  confidence {Math.round(d.confidence * 100)}% · affects {d.affected_shipment_ids.join(', ') || 'no shipment'}
                </div>
                <div className="acts">
                  {d.verification !== 'confirmed' && (
                    <button className="b" disabled={busy !== null} onClick={() => run(`c${d.id}`, () => updateDisruption(d.id, { verification: 'confirmed' }))}>
                      Confirm
                    </button>
                  )}
                  {d.verification !== 'dismissed' && (
                    <button className="b" disabled={busy !== null} onClick={() => run(`d${d.id}`, () => updateDisruption(d.id, { verification: 'dismissed' }))}>
                      Dismiss (not true)
                    </button>
                  )}
                  {d.verification === 'dismissed' && (
                    <button className="b" disabled={busy !== null} onClick={() => run(`u${d.id}`, () => updateDisruption(d.id, { verification: 'unverified' }))}>
                      Undo
                    </button>
                  )}
                </div>
              </div>
              <button className="x" aria-label={`Remove ${d.label}`} title="Remove" disabled={busy !== null} onClick={() => run(`x${d.id}`, () => deleteDisruption(d.id))}>
                ×
              </button>
            </div>
          );
        })
      )}
      {error && <div className="err">{error}</div>}

      <h3>Map layers</h3>
      <label className="row">
        <input type="checkbox" checked={props.showPlaces} onChange={(e) => props.setShowPlaces(e.target.checked)} /> Sensitive places (schools, hospitals, homes)
      </label>
      <label className="row">
        <input type="checkbox" checked={props.showTrucks} onChange={(e) => props.setShowTrucks(e.target.checked)} /> Trucks
      </label>
    </div>
  );
}

/** Body sent when the dispatcher clicks the map in placing mode. Optional fields are omitted, never null. */
export function drawBody(d: DrawDraft, at: { lat: number; lng: number }): DisruptionCreate {
  const names = { slowdown: 'Traffic slowdown', closure: 'Road closure', hazard: 'Hazard area' };
  return {
    kind: d.kind,
    label: `${names[d.kind]} (drawn by dispatcher)`,
    source: 'dispatcher',
    confidence: Math.round(d.confidence * 100) / 100,
    area: { lat: at.lat, lng: at.lng, radius_km: d.radius_km },
    ...(d.kind === 'slowdown' ? { slowdown_factor: Math.round(d.slowdown_factor * 10) / 10 } : {}),
  };
}

/* ---------------- Live scout ---------------- */
export function ScoutPane({ apply, onChanged }: { apply: Apply; onChanged: () => void }) {
  const [data, setData] = useState<FeedCandidates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);

  const scan = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getFeedCandidates());
    } catch (e) {
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pane">
      <h3>Disruption scout (rule-based)</h3>
      <div className="small mute">
        Pulls live public feeds, keeps what is near an active route, labels how trustworthy each item is, and lets you add it to the scenario. It never changes a plan by itself.
      </div>
      <div style={{ margin: '8px 0' }}>
        <button className="b pri" disabled={loading} onClick={scan}>
          {loading ? 'Scanning…' : 'Scan now'}
        </button>
      </div>
      {error && <div className="err">{error}</div>}
      {data && (
        <>
          <div className="small mute" style={{ margin: '6px 0' }}>
            {data.sources.map((s) => (
              <div key={s.name}>
                {s.name}: {s.ok ? 'ok' : `unavailable${s.error ? ` (${s.error})` : ''}`}
              </div>
            ))}
          </div>
          {data.candidates.length === 0 && <div className="small mute">No reports near active routes right now.</div>}
          {data.candidates.map((c) => (
            <div key={c.id} className="item">
              <b>{c.title}</b>
              <div className="small mute">
                {c.source_name} · <span className={`chip ${c.trust === 'official_report' ? 'live' : 'rev'}`}>{c.trust === 'official_report' ? 'official report' : 'automated detection'}</span> · {c.distance_to_route_mi.toFixed(1)} mi from route
                {c.near_shipment_ids.length > 0 && ` · near ${c.near_shipment_ids.join(', ')}`}
              </div>
              <div className="small mute">A report does not prove a road is blocked or open: you decide.</div>
              <button
                className="b"
                style={{ marginTop: 4 }}
                disabled={added.includes(c.id)}
                onClick={async () => {
                  try {
                    await apply(() => createDisruption(c.suggested));
                    setAdded((a) => [...a, c.id]);
                    onChanged();
                  } catch (e) {
                    setError(msg(e));
                  }
                }}
              >
                {added.includes(c.id) ? 'Added (needs review)' : 'Add to scenario'}
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ---------------- Priorities ---------------- */
const WEIGHT_LABEL: Record<keyof Weights, string> = {
  reliability: 'On-time reliability',
  cost: 'Cost',
  emissions: 'Emissions (CO₂)',
  community: 'Community impact',
  driver: 'Driver wellbeing',
};

export function PrioritiesPane({ board, apply }: { board: Board; apply: Apply }) {
  const [w, setW] = useState<Weights>(board.settings.weights);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => setW(board.settings.weights), [board.settings.weights]);

  const change = (k: keyof Weights, v: number) => {
    const next = { ...w, [k]: v };
    setW(next);
    window.clearTimeout(timer.current);
    if (Object.values(next).every((x) => x === 0)) {
      setError('At least one priority must be above zero.');
      return;
    }
    setError(null);
    timer.current = window.setTimeout(() => {
      apply(() => putSettings({ clock_min: board.settings.clock_min, weights: next })).catch((e) => setError(msg(e)));
    }, 400);
  };

  return (
    <div className="pane">
      <h3>What matters most today?</h3>
      <div className="small mute">Moves the recommendation, not the facts. The fastest option is not always ranked first.</div>
      {(Object.keys(WEIGHT_LABEL) as (keyof Weights)[]).map((k) => (
        <label key={k} className="row">
          <span className="k">{WEIGHT_LABEL[k]}</span>
          <input type="range" min={0} max={100} step={5} value={w[k]} onChange={(e) => change(k, Number(e.target.value))} />
          <span className="val">{w[k]}</span>
        </label>
      ))}
      {error && <div className="err">{error}</div>}
      <h3>Responsible design in this tool</h3>
      <div className="small">
        <b>Environment:</b> every option shows extra miles and estimated CO₂.
        <br />
        <b>Fairness / stakeholders:</b> each option lists who bears the cost: residents (local-street miles, schools nearby), the driver (hours, idling), the partner warehouse, another customer.
        <br />
        <b>Transparency:</b> scores, formulas and assumptions are one click away.
        <br />
        <b>Human oversight:</b> nothing is sent or changed until the dispatcher approves; any option can be chosen over the recommendation.
        <br />
        <b>Responsible data use:</b> drivers are “Driver 01”, no personal data; each item is tagged simulated / official / needs review.
      </div>
    </div>
  );
}
