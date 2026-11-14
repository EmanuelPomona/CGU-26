import type { StudioAlternative, StudioSession } from '../api/types';

const SLOT_ORDER = ['fastest', 'direct', 'avoid'] as const;

export function sortStudioAlts(alts: StudioAlternative[]): StudioAlternative[] {
  const rank = Object.fromEntries(SLOT_ORDER.map((s, i) => [s, i]));
  return [...alts].sort((a, b) => (rank[a.slot] ?? 9) - (rank[b.slot] ?? 9));
}

interface Props {
  session: StudioSession | null;
  pickingDest: boolean;
  selectedTruckId: string | null;
  focusAltId: string | null;
  busy: boolean;
  error: string | null;
  onFocusAlt: (id: string | null) => void;
  onClear: () => void;
}

export function RouteStudio({
  session,
  pickingDest,
  selectedTruckId,
  focusAltId,
  busy,
  error,
  onFocusAlt,
  onClear,
}: Props) {
  const alts = session ? sortStudioAlts(session.alternatives) : [];

  return (
    <div className="studio-panel" aria-label="Route studio">
      <div className="studio-head">
        <h3>Route studio</h3>
        {(session || selectedTruckId) && (
          <button type="button" className="btn ghost" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {error && <p className="studio-err">{error}</p>}
      {busy && <p className="mute small">Computing routes…</p>}
      {!session && !selectedTruckId && (
        <p className="mute">Click a truck on the map, then click a destination.</p>
      )}
      {selectedTruckId && !session && (
        <p className="mute">
          Truck <b>{selectedTruckId}</b> selected.
          {pickingDest ? ' Click the map for a destination.' : ''}
        </p>
      )}
      {session && (
        <>
          <p className="small mute">
            {session.truck_id} → destination · {session.obstacles.length} obstacle
            {session.obstacles.length === 1 ? '' : 's'}
          </p>
          <div className="studio-alts">
            {alts.map((a) => (
              <AltCard
                key={a.id}
                alt={a}
                focused={focusAltId === a.id}
                onFocus={() => onFocusAlt(focusAltId === a.id ? null : a.id)}
              />
            ))}
          </div>
          <p className="small mute studio-legend">
            Map: solid = Fastest · dash = Direct · dotted = Avoid hazards
          </p>
        </>
      )}
    </div>
  );
}

function AltCard({
  alt,
  focused,
  onFocus,
}: {
  alt: StudioAlternative;
  focused: boolean;
  onFocus: () => void;
}) {
  const m = alt.metrics;
  return (
    <article className={`studio-alt ${focused ? 'focus' : ''} ${alt.feasible ? '' : 'infeas'}`}>
      <header>
        <strong>{alt.label}</strong>
        <span className="chip soft">{alt.algorithm}</span>
      </header>
      <p className="small">{alt.summary}</p>
      {!alt.feasible && alt.infeasible_reason && (
        <p className="small studio-err">{alt.infeasible_reason}</p>
      )}
      {alt.feasible && (
        <div className="mx studio-mx">
          <div>
            <span>ETA</span>
            <b>{Math.round(m.eta_min)} min</b>
          </div>
          <div>
            <span>Miles</span>
            <b>{m.distance_km.toFixed(1)}</b>
          </div>
          <div>
            <span>CO₂</span>
            <b>{m.co2_kg.toFixed(0)} kg</b>
          </div>
          <div>
            <span>Exposure</span>
            <b>{(m.obstacle_exposure * 100).toFixed(0)}%</b>
          </div>
        </div>
      )}
      {alt.pros.length > 0 && (
        <ul className="studio-pros">
          {alt.pros.map((t, i) => (
            <li key={`p${i}`}>{t}</li>
          ))}
        </ul>
      )}
      {alt.cons.length > 0 && (
        <ul className="studio-cons">
          {alt.cons.map((t, i) => (
            <li key={`c${i}`}>{t}</li>
          ))}
        </ul>
      )}
      <button type="button" className="btn ask" onClick={onFocus} disabled={!alt.feasible}>
        {focused ? 'Hide highlight' : 'Show on map'}
      </button>
    </article>
  );
}
