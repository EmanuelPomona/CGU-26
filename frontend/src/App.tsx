import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getNetwork, usingMock } from './api/client';
import type { Area, Network, Route } from './api/types';
import { useBoard } from './api/useBoard';
import { Board, BoardSkeleton } from './components/Board';
import { Conditions, type PlaceDraft } from './components/Conditions';
import { IndicatorStrip } from './components/IndicatorStrip';
import { MapView } from './components/MapView';
import { Method } from './components/Method';
import { Options } from './components/Options';
import { VerifyPrompt } from './components/VerifyPrompt';
import { clock } from './lib/format';
import { stripScale } from './lib/strip';
import { useMedia } from './lib/useMedia';

type Panel = 'none' | 'cond' | 'detail';

export default function App() {
  const bs = useBoard();
  const { board } = bs;
  const [network, setNetwork] = useState<Network | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'board' | 'method'>('board');
  const [panel, setPanel] = useState<Panel>('none');
  const [placing, setPlacing] = useState<PlaceDraft | null>(null);
  const [placed, setPlaced] = useState<Area | null>(null);
  const [preview, setPreview] = useState<Route | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const narrow = useMedia('(max-width: 1180px)');
  const mobile = useMedia('(max-width: 640px)');
  const lastRowFocus = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    const load = () =>
      getNetwork()
        .then((n) => live && setNetwork(n))
        .catch(() => live && setTimeout(load, 3000));
    load();
    return () => {
      live = false;
    };
  }, []);

  // When the board comes back after an outage, the network may still be missing.
  useEffect(() => {
    if (board && !network) getNetwork().then(setNetwork).catch(() => undefined);
  }, [board, network]);

  const scale = useMemo(() => stripScale(board?.shipments ?? []), [board]);
  const selected = board?.shipments.find((s) => s.id === selectedId) ?? null;

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      setPreview(null);
      if (id) {
        lastRowFocus.current = id;
        if (narrow) setPanel('detail');
      }
    },
    [narrow],
  );

  const closePanel = useCallback(() => {
    const was = panel;
    setPanel('none');
    if (was === 'detail' && lastRowFocus.current) {
      const id = lastRowFocus.current;
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`)?.focus(),
      );
    }
  }, [panel]);

  useEffect(() => {
    if (panel === 'none') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePanel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, closePanel]);

  const startPlacing = (d: PlaceDraft | null) => {
    setPlacing(d);
    setPlaced(null);
    if (d && narrow) {
      setPanel('none');
      setMapExpanded(true);
    }
  };

  const onMapPlace = (latlng: { lat: number; lng: number }) => {
    if (!placing) return;
    setPlaced({ lat: latlng.lat, lng: latlng.lng, radius_km: placing.radius_km });
    if (narrow) setPanel('cond');
  };

  const active = board?.disruptions.filter((d) => d.verification !== 'dismissed') ?? [];
  const pending = board?.pending_verification_ids.length ?? 0;
  const scenario =
    active.length === 0
      ? 'Normal day'
      : `${active.length} changed condition${active.length === 1 ? '' : 's'}${pending ? `, ${pending} unverified` : ''}`;

  const verify = board && pending > 0 ? <VerifyPrompt board={board} apply={bs.apply} /> : null;

  return (
    <div className="shell">
      <header className="region-head">
        <h1 className="wordmark">Drayline</h1>
        <p className="head-meta">
          <span>
            Dispatch clock <strong className="mono">{board ? clock(board.settings.clock_min) : '8:00 AM'}</strong>
          </span>
          <span className={active.length ? 'head-scenario-changed' : undefined} role="status" aria-live="polite">
            {scenario}
          </span>
          {usingMock && <span>Mock data</span>}
        </p>
        <nav className="head-nav" aria-label="Views">
          <button
            type="button"
            className="btn head-narrow-only"
            aria-expanded={panel === 'cond'}
            onClick={() => setPanel(panel === 'cond' ? 'none' : 'cond')}
          >
            Conditions{active.length ? ` (${active.length})` : ''}
          </button>
          <button type="button" className="btn" aria-pressed={view === 'board'} onClick={() => setView('board')}>
            Board
          </button>
          <button type="button" className="btn" aria-pressed={view === 'method'} onClick={() => setView('method')}>
            Method
          </button>
        </nav>
      </header>

      {bs.error && board && (
        <div className="conn-banner" role="alert" style={{ gridColumn: '1 / -1' }}>
          <span>Lost connection to the server. Showing the last board received.</span>
          <button type="button" className="btn" onClick={bs.retry}>
            Retry
          </button>
        </div>
      )}

      {view === 'method' ? (
        <main className="shell-method" style={{ gridColumn: '1 / -1', gridRow: '2 / -1', overflowY: 'auto' }}>
          <Method />
        </main>
      ) : !board ? (
        <ShellFirstLoad loading={bs.loading} error={bs.error} retry={bs.retry} />
      ) : (
        <>
          <aside className="region-cond" aria-label="Conditions" data-open={panel === 'cond'}>
            <div className="panel-close">
              <h2>Conditions</h2>
              <button type="button" className="btn" onClick={closePanel}>
                Close
              </button>
            </div>
            {!narrow && verify}
            <Conditions
              board={board}
              network={network}
              apply={bs.apply}
              placing={placing}
              placed={placed}
              onPlacing={startPlacing}
            />
          </aside>

          <section className="region-ind" aria-label="Indicators">
            <IndicatorStrip indicators={board.indicators} hasDecisions={board.decisions.length > 0} />
          </section>

          <section className="region-map" aria-label="Map" data-expanded={mapExpanded}>
            <MapView
              board={board}
              network={network}
              selectedId={selectedId}
              onSelect={select}
              preview={preview}
              placing={placing ? { radius_km: placing.radius_km } : null}
              placed={placed}
              onPlace={onMapPlace}
              collapsed={mobile && !mapExpanded}
              onToggleCollapsed={mobile ? () => setMapExpanded((x) => !x) : undefined}
            />
          </section>

          <main className="region-board" aria-label="Shipments">
            {narrow && verify}
            <Board board={board} network={network} scale={scale} selectedId={selectedId} onSelect={select} />
          </main>

          <section
            className="region-detail"
            aria-label={selected ? `Responses for ${selected.id}` : 'Responses'}
            data-open={panel === 'detail'}
            role={narrow && panel === 'detail' ? 'dialog' : undefined}
            aria-modal={narrow && panel === 'detail' ? true : undefined}
          >
            <div className="panel-close">
              <h2>{selected ? `Responses for ${selected.id}` : 'Responses'}</h2>
              <button type="button" className="btn" onClick={closePanel} data-autofocus>
                Close
              </button>
            </div>
            <Options
              board={board}
              row={selected}
              scale={scale}
              apply={bs.apply}
              setBoard={bs.set}
              onPreview={setPreview}
              sheet={narrow}
              open={!narrow || panel === 'detail'}
            />
          </section>
        </>
      )}
    </div>
  );
}

function ShellFirstLoad({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: ReturnType<typeof useBoard>['error'];
  retry: () => void;
}) {
  if (loading) {
    return (
      <>
        <aside className="region-cond" aria-label="Conditions" />
        <section className="region-ind" aria-label="Indicators" />
        <section className="region-map" aria-label="Map" />
        <main className="region-board" aria-label="Shipments">
          <p className="visually-hidden" role="status">
            Loading the board.
          </p>
          <BoardSkeleton />
        </main>
        <section className="region-detail" aria-label="Responses" />
      </>
    );
  }
  return (
    <div className="shell-state" role="alert">
      <h2>The board could not be loaded</h2>
      <p>
        {error?.status === 0
          ? 'The Drayline server is not responding. Check that it is running, then retry.'
          : (error?.message ?? 'Unexpected error.')}
      </p>
      <p>
        <button type="button" className="btn btn-primary" onClick={retry}>
          Retry
        </button>
      </p>
    </div>
  );
}
