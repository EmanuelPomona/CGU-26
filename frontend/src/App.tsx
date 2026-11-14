// Layout and interaction follow docs/reference/sample-prototype.html (owner's direction, 2026-11-14).
// Every number still comes from the backend through the generated API client.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, createDisruption, getNetwork, getOptions, usingMock } from './api/client';
import type { Network, OptionsResponse } from './api/types';
import { useBoard } from './api/useBoard';
import { drawBody, PrioritiesPane, ScenarioPane, ScoutPane, type DrawDraft } from './components/proto/LeftPanes';
import { ProtoMap, type View } from './components/proto/ProtoMap';
import { ComparePane, MethodPane, ShipmentsPane } from './components/proto/RightPanes';
import { clock } from './lib/format';

type LeftTab = 'scn' | 'scout' | 'wts';
type RightTab = 'ord' | 'cmp' | 'notes';

export default function App() {
  const bs = useBoard();
  const { board } = bs;
  const [network, setNetwork] = useState<Network | null>(null);
  const [view, setView] = useState<View>('normal');
  const [left, setLeft] = useState<LeftTab>('scn');
  const [right, setRight] = useState<RightTab>('ord');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DrawDraft>({ kind: 'slowdown', radius_km: 3, slowdown_factor: 2.2, confidence: 0.7 });
  const [placing, setPlacing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showPlaces, setShowPlaces] = useState(true);
  const [showTrucks, setShowTrucks] = useState(true);
  const optSeq = useRef(0);

  useEffect(() => {
    let live = true;
    const load = () =>
      getNetwork()
        .then((n) => live && setNetwork(n))
        .catch(() => live && setTimeout(load, 2500));
    load();
    return () => {
      live = false;
    };
  }, []);

  // Select the first shipment once the board arrives, as the prototype does.
  useEffect(() => {
    if (board && !selectedId) setSelectedId(board.shipments[0]?.id ?? null);
  }, [board, selectedId]);

  const loadOptions = useCallback(async (id: string) => {
    const n = ++optSeq.current;
    setOptionsError(null);
    try {
      const o = await getOptions(id);
      if (n === optSeq.current) setOptions(o);
    } catch (e) {
      if (n === optSeq.current) setOptionsError(e instanceof ApiError ? e.message : 'Options could not be loaded.');
    }
  }, []);

  // Options follow the selection and every board change.
  useEffect(() => {
    if (selectedId && board) void loadOptions(selectedId);
  }, [selectedId, board, loadOptions]);

  const toDisruptionView = useCallback(() => setView('changed'), []);

  const onPlace = async (at: { lat: number; lng: number }) => {
    setPlacing(false);
    try {
      await bs.apply(() => createDisruption(drawBody(draft, at)));
      setView('changed');
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : 'Could not add the condition.');
      setTimeout(() => setToast(null), 3500);
    }
  };

  const active = board?.disruptions.filter((d) => d.verification !== 'dismissed').length ?? 0;

  return (
    <div className="app">
      <header className="top">
        <h1>SoCal Port → Warehouse · Decision Support</h1>
        <div className="seg" role="group" aria-label="Which day to show">
          <button className={view === 'normal' ? 'on' : ''} aria-pressed={view === 'normal'} onClick={() => setView('normal')}>
            Normal day
          </button>
          <button className={view === 'changed' ? 'on' : ''} aria-pressed={view === 'changed'} onClick={() => setView('changed')}>
            Disruption{active ? ` (${active})` : ''}
          </button>
        </div>
        {usingMock && <span className="mock-tag">mock data</span>}
        <span className="clock-lbl">
          Dispatch clock {board ? clock(board.settings.clock_min) : '8:00 AM'} · {view === 'changed' ? 'disruption view' : 'normal day'}
        </span>
      </header>
      <div className="banner">
        <b>Simulated data:</b> containers, trucks, capacities, costs and emissions are synthetic estimates, not measurements. A reported hazard is not proof a road is blocked: the dispatcher decides.
      </div>
      {bs.error && board && (
        <div className="conn" role="alert">
          Lost connection to the server. Showing the last board received.
          <button className="b" onClick={bs.retry}>Retry</button>
        </div>
      )}

      {!board ? (
        <div className="center-state" role={bs.loading ? 'status' : 'alert'}>
          {bs.loading ? (
            <span className="mute">Loading shipments and routes…</span>
          ) : (
            <>
              <b>The board could not be loaded.</b>
              <span className="mute">
                {bs.error?.status === 0 ? 'The server is not responding. Check that it is running, then retry.' : bs.error?.message}
              </span>
              <span>
                <button className="b pri" onClick={bs.retry}>Retry</button>
              </span>
            </>
          )}
        </div>
      ) : (
        <main className="cols">
          <aside className="side left" aria-label="Scenario and priorities">
            <div className="tabs" role="tablist">
              {([['scn', 'Scenario'], ['scout', 'Live scout'], ['wts', 'Priorities']] as const).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={left === k} className={left === k ? 'on' : ''} onClick={() => setLeft(k)}>
                  {l}
                </button>
              ))}
            </div>
            {left === 'scn' && (
              <ScenarioPane
                board={board}
                apply={bs.apply}
                onChanged={toDisruptionView}
                draft={draft}
                setDraft={setDraft}
                placing={placing}
                setPlacing={setPlacing}
                showPlaces={showPlaces}
                setShowPlaces={setShowPlaces}
                showTrucks={showTrucks}
                setShowTrucks={setShowTrucks}
              />
            )}
            {left === 'scout' && <ScoutPane apply={bs.apply} onChanged={toDisruptionView} />}
            {left === 'wts' && <PrioritiesPane board={board} apply={bs.apply} />}
          </aside>

          <div className={`mapwrap ${placing ? 'placing' : ''}`}>
            {placing && <div className="maptoast">Click the map to place the condition</div>}
            {toast && <div className="maptoast">{toast}</div>}
            <ProtoMap
              board={board}
              network={network}
              view={view}
              selectedId={selectedId}
              onSelect={setSelectedId}
              options={options}
              showPlaces={showPlaces}
              showTrucks={showTrucks}
              placing={placing}
              onPlace={onPlace}
            />
          </div>

          <aside className="side right" aria-label="Shipments and comparison">
            <div className="tabs" role="tablist">
              {([['ord', 'Shipments'], ['cmp', 'Compare'], ['notes', 'Method']] as const).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={right === k} className={right === k ? 'on' : ''} onClick={() => setRight(k)}>
                  {l}
                </button>
              ))}
            </div>
            {right === 'ord' && (
              <ShipmentsPane
                board={board}
                view={view}
                selectedId={selectedId}
                onSelect={setSelectedId}
                options={options}
                optionsError={optionsError}
                reloadOptions={() => selectedId && void loadOptions(selectedId)}
                apply={bs.apply}
                setBoard={bs.set}
                onDecided={toDisruptionView}
              />
            )}
            {right === 'cmp' && <ComparePane board={board} />}
            {right === 'notes' && <MethodPane />}
          </aside>
        </main>
      )}
    </div>
  );
}
