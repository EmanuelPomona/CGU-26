import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import {
  demoJobFor,
  scoreLabel,
  type DemoRouteOption,
  type RouteKind,
  type ScoreKey,
} from './demoRoutes';

const SCORE_KEYS: ScoreKey[] = ['cost', 'environment', 'community'];

export function DemoRoutePanel(props: {
  shipmentId: string;
  chosenKind: RouteKind | null;
  onChoose: (kind: RouteKind) => void;
  reroute?: boolean;
  /** Reroute: show Submit after a card is selected. */
  onSubmit?: () => void;
  canSubmit?: boolean;
  submitted?: boolean;
}) {
  const job = demoJobFor(props.shipmentId);
  const [openScore, setOpenScore] = useState<{ routeId: string; key: ScoreKey } | null>(null);
  if (!job) return null;
  const list = props.reroute ? job.reroutes : job.routes;

  return (
    <div className="demo-routes" aria-label={props.reroute ? 'Reroute options' : 'Route options'}>
      {!props.reroute && (
        <p className="demo-routes-lead mute small">
          Two roads for this job. Scores are out of 100 (higher is better). Click a score for why.
        </p>
      )}
      {props.reroute && (
        <p className="demo-routes-lead mute small">
          Click a reroute to preview it, then Submit to send George that way. Scores are out of 100.
        </p>
      )}
      <div className="demo-route-list">
        {list.map((route) => (
          <RouteCard
            key={route.id}
            route={route}
            selected={props.chosenKind === route.kind}
            openScore={openScore?.routeId === route.id ? openScore.key : null}
            onToggleScore={(key) =>
              setOpenScore((cur) =>
                cur?.routeId === route.id && cur.key === key ? null : { routeId: route.id, key },
              )
            }
            onChoose={() => props.onChoose(route.kind)}
            chooseLabel={props.reroute ? 'Preview on map' : 'Show on map'}
            selectedLabel={props.reroute ? (props.submitted ? 'Submitted' : 'Preview') : 'On map'}
          />
        ))}
      </div>
      {props.reroute && props.onSubmit && (
        <div className="acts" style={{ marginTop: '.75rem' }}>
          <button
            type="button"
            className="btn pri lg"
            style={{ width: '100%' }}
            disabled={!props.canSubmit}
            onClick={props.onSubmit}
          >
            {props.submitted ? 'Reroute submitted' : 'Submit reroute'}
          </button>
        </div>
      )}
    </div>
  );
}

function RouteCard(props: {
  route: DemoRouteOption;
  selected: boolean;
  openScore: ScoreKey | null;
  onToggleScore: (key: ScoreKey) => void;
  onChoose: () => void;
  chooseLabel: string;
  selectedLabel?: string;
}) {
  const { route, selected, openScore, onToggleScore, onChoose, chooseLabel, selectedLabel = 'On map' } = props;
  const detail = openScore ? route.scores[openScore] : null;

  const pick = () => onChoose();
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick();
    }
  };
  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <article
      className={`demo-route-card${selected ? ' selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={pick}
      onKeyDown={onKey}
    >
      <header className="demo-route-head">
        <div>
          <strong>{route.title}</strong>
          {selected && <span className="chip good">{selectedLabel}</span>}
          <p className="mute small">{route.subtitle}</p>
        </div>
        <div className="demo-route-meta">
          <span>{route.etaLabel}</span>
          <span>{route.milesLabel}</span>
        </div>
      </header>
      <div className="demo-score-row" role="group" aria-label="Scores out of 100" onClick={stop}>
        {SCORE_KEYS.map((key) => {
          const s = route.scores[key];
          const on = openScore === key;
          return (
            <button
              key={key}
              type="button"
              className={`demo-score${on ? ' on' : ''}`}
              aria-expanded={on}
              onClick={() => onToggleScore(key)}
            >
              <span className="demo-score-label">{scoreLabel(key)}</span>
              <b>{s.score}</b>
              <span className="demo-score-hint">/100</span>
            </button>
          );
        })}
      </div>
      {detail && openScore && (
        <div
          className="demo-score-detail"
          role="region"
          aria-label={`${scoreLabel(openScore)} detail`}
          onClick={stop}
        >
          <p>
            <b>
              {scoreLabel(openScore)} · {detail.score}/100.
            </b>{' '}
            {detail.summary}
          </p>
          <ul>
            {detail.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="acts" onClick={stop}>
        <button type="button" className={`btn${selected ? ' pri' : ' ask'}`} onClick={pick}>
          {selected ? 'Showing on map' : chooseLabel}
        </button>
      </div>
    </article>
  );
}
