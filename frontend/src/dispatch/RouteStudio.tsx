import { DemoRoutePanel } from './DemoRoutePanel';
import type { RouteKind } from './demoRoutes';
import type { StoryCase } from './storyCases';
import type { StudioSession } from '../api/types';

interface Props {
  session: StudioSession | null;
  busy: boolean;
  error: string | null;
  story?: StoryCase | null;
  chosenKind: RouteKind;
  reroutePending?: boolean;
  canSubmitReroute?: boolean;
  rerouteSubmitted?: boolean;
  onChoose: (kind: RouteKind) => void;
  onSubmitReroute?: () => void;
  onClear: () => void;
  onRemoveObstacle: (obstacleId: string) => void;
  shipmentId: string | null;
}

export function RouteStudio({
  session,
  busy,
  error,
  story,
  chosenKind,
  reroutePending,
  canSubmitReroute,
  rerouteSubmitted,
  onChoose,
  onSubmitReroute,
  onClear,
  onRemoveObstacle,
  shipmentId,
}: Props) {
  const hasObstacles = Boolean(session && session.obstacles.length > 0);
  const who = story?.driverName ?? session?.truck_id ?? 'truck';
  const od = story
    ? `${story.originLabel} → ${story.destinationLabel}`
    : 'origin → destination';
  const chosenLabel =
    chosenKind === 'impact' ? 'Environment & community minimized' : 'Fastest route';

  return (
    <div className="studio-panel" aria-label="Reroute options">
      <div className="studio-head">
        <h3>{story ? `${story.driveLabel} on map` : 'On map'}</h3>
        {session && (
          <button type="button" className="btn ghost" onClick={onClear}>
            Change path
          </button>
        )}
      </div>
      {error && <p className="studio-err">{error}</p>}
      {busy && <p className="mute small">Updating routes…</p>}
      {!session && <p className="mute">Select a job in To dispatch to set the path on this board.</p>}
      {session && (
        <>
          <p className="small mute">
            {who} · {od}
          </p>
          <p className="small">
            {hasObstacles && reroutePending ? (
              <>Path blocked — preview a reroute, then Submit</>
            ) : rerouteSubmitted ? (
              <>
                Submitted: <b>{chosenLabel}</b>
              </>
            ) : (
              <>
                Showing: <b>{chosenLabel}</b>
              </>
            )}
          </p>
          {hasObstacles && (
            <ul className="studio-obs-list" aria-label="Active obstacles">
              {session.obstacles.map((o) => (
                <li key={o.id} className="studio-obs-row">
                  <span>{o.label}</span>
                  <button
                    type="button"
                    className="btn ghost studio-obs-remove"
                    disabled={busy}
                    onClick={() => onRemoveObstacle(o.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          {hasObstacles && shipmentId && (
            <>
              <p className="mute small" style={{ marginTop: '.6rem' }}>
                {reroutePending
                  ? 'Road blocked — click a card to preview, then Submit to lock it in.'
                  : rerouteSubmitted
                    ? 'Reroute submitted. George will use this path on On route.'
                    : 'Preview another option, or Submit to lock this one in.'}
              </p>
              <DemoRoutePanel
                shipmentId={shipmentId}
                chosenKind={reroutePending ? null : chosenKind}
                onChoose={onChoose}
                onSubmit={onSubmitReroute}
                canSubmit={canSubmitReroute}
                submitted={rerouteSubmitted}
                reroute
              />
            </>
          )}
          {!hasObstacles && (
            <p className="mute small">
              Drop a road closure on the path to see two reroute options (fastest arrival vs environment & community).
            </p>
          )}
        </>
      )}
    </div>
  );
}
