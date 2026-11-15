// Dispatch: the owner's mockup (ADR-007). Map, To dispatch and Network run on the backend API; the On route
// view is a scripted example. The browser never ranks options or computes a figure.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ApiError, addStudioObstacle, createDecision, createStudioSession, deleteDecision, deleteDisruption,
  deleteStudioObstacle, getNetwork, getOptions, getPresets, updateDisruption,
} from '../api/client';
import type {
  Board, Decision, Disruption, Network, OptionsResponse, Preset, ResponseOption, ShipmentRow, StudioSession,
} from '../api/types';
import { useBoard } from '../api/useBoard';
import { DispatchMap, type Verdict, type View } from './DispatchMap';
import { ObstaclePalette } from './ObstaclePalette';
import { type ObstacleType } from './obstacleCatalog';
import { showObstaclePalette } from './placeMode';
import { DemoRoutePanel } from './DemoRoutePanel';
import { demoJobFor, type RouteKind } from './demoRoutes';
import { defaultDemoShipmentId, isDemoShipment } from './fleetScope';
import { RouteStudio } from './RouteStudio';
import { storyForShipment } from './storyCases';
import { cargoStatusChip, cargoStatusFor, cargoStatusLabel } from './cargoStatus';
import { demoRerouteGeometries } from './demoDetours';
import {
  BAD, GOOD, GEORGE_ONROUTE, INK, OBJ, ONROUTE, PROB, ROLE, ROLE_ORDER, fatLbl, type RoleKey, type RouteTruck, type Tag,
} from './data';
import './dispatch.css';

const esc = (s: string) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'The request failed.');
const clock = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  return `${h % 12 || 12}:${String(Math.round(m) % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const clockDate = (d: Date) => {
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const STATUS = { on_time: ['On time', 'ok'], tight: ['Tight', 'warn'], at_risk: ['At risk', 'bad'] } as const;
const STAKE = { driver: 'Driver', residents: 'Residents', warehouse: 'Warehouse', other_customer: 'Other customer', company: 'Company' } as const;
const SOURCE = { simulated: 'Simulated what-if', dispatcher: 'Entered by dispatcher', public_feed: 'Public feed' } as const;
const VER = { unverified: 'Unverified', confirmed: 'Confirmed', dismissed: 'Road is open' } as const;
const signed = (n: number, unit = '', d = 0) => {
  const r = Number(Math.abs(n).toFixed(d));
  return r === 0 ? 'same' : `${n > 0 ? '+' : '−'}${r.toFixed(d)}${unit}`;
};

/* ---------- small pieces ---------- */
function Tags({ tags }: { tags: Tag[] }) {
  return (
    <div className="flags">
      {tags.map((t, i) => (
        <span key={i} className={`tag ${t[2]}`}>
          <i>{t[0]}</i>
          {t[1]}
        </span>
      ))}
    </div>
  );
}
function Acc({ open, sel, onToggle, head, children }: { open: boolean; sel: boolean; onToggle: () => void; head: ReactNode; children: ReactNode }) {
  return (
    <div className={`acc ${sel ? 'sel' : ''} ${open ? 'open' : ''}`}>
      <button className="acc-h" aria-expanded={open} onClick={onToggle}>
        {head}
        <span className="chev" aria-hidden="true">▾</span>
      </button>
      {open && <div className="acc-b">{children}</div>}
    </div>
  );
}
function Mx({ cells }: { cells: Array<[string, string, string?]> }) {
  return (
    <div className="mx">
      {cells.map(([label, v, cls]) => (
        <div key={label}>
          <span>{label}</span>
          <b className={cls}>{v}</b>
        </div>
      ))}
    </div>
  );
}
interface Msg {
  kind: 'me' | 'them' | 'ai' | 'sys';
  html: string;
  time?: string;
  src?: string;
}
function Messages({ msgs }: { msgs: Msg[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 1e5;
  }, [msgs]);
  return (
    <div className="msgs" ref={ref} aria-live="polite">
      {msgs.map((m, i) => (
        <div key={i} className={`m ${m.kind}`}>
          <span dangerouslySetInnerHTML={{ __html: m.html }} />
          {m.src && <div className="srcline">Sources: {m.src}</div>}
          {m.time && <small>{m.time}</small>}
        </div>
      ))}
    </div>
  );
}

/** Normal vs changed vs decided, from board.indicators only. */
function Compare({ board, compact }: { board: Board; compact?: boolean }) {
  const active = board.disruptions.some((d) => d.verification !== 'dismissed');
  if (!active && board.decisions.length === 0) return null;
  const { normal: n, changed: c, decided: dd, checks } = board.indicators;
  const hasDec = board.decisions.length > 0;
  const rows: Array<[string, number, number, number, number]> = [
    ['Shipments at risk', n.shipments_at_risk, c.shipments_at_risk, dd.shipments_at_risk, 0],
    ['Late minutes', n.total_late_min, c.total_late_min, dd.total_late_min, 0],
    ['Fleet miles', n.fleet_miles, c.fleet_miles, dd.fleet_miles, 0],
    ['CO₂ kg (est.)', n.co2_kg, c.co2_kg, dd.co2_kg, 0],
    ['Cost $ (est.)', n.cost_usd, c.cost_usd, dd.cost_usd, 0],
  ];
  return (
    <div className={`cmpbox ${compact ? 'compact' : ''}`}>
      <h4>Normal day vs changed</h4>
      <table>
        <thead>
          <tr>
            <th />
            <th>Normal</th>
            <th>Changed</th>
            {hasDec && <th>Decided</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b, d, dec]) => (
            <tr key={label}>
              <td>{label}</td>
              <td>{a.toFixed(dec)}</td>
              <td className={b > a ? 'badc' : b < a ? 'goodc' : ''}>{b.toFixed(dec)}</td>
              {hasDec && <td className={d > a ? 'badc' : d < a ? 'goodc' : ''}>{d.toFixed(dec)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {checks
        .filter((k) => k.triggered)
        .map((k) => (
          <p key={k.id} className="small">
            <b>{k.label}.</b> {k.detail}
          </p>
        ))}
      <div className="src">All figures: rule-based estimates from simulated inputs.</div>
    </div>
  );
}

/** Map-only: compare panel stays tucked behind a button until opened. */
function CompareMenu({ board }: { board: Board }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const active = board.disruptions.some((d) => d.verification !== 'dismissed');
  const hasDec = board.decisions.length > 0;
  const riskDelta = board.indicators.changed.shipments_at_risk - board.indicators.normal.shipments_at_risk;
  const show = active || hasDec;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!show) setOpen(false);
  }, [show]);

  if (!show) return null;

  return (
    <div className={`cmpmenu${open ? ' open' : ''}`} ref={root}>
      <button
        type="button"
        className={`cmpmenu-btn${riskDelta > 0 ? ' alert' : ''}`}
        aria-expanded={open}
        aria-controls="cmpmenu-panel"
        onClick={() => setOpen((o) => !o)}
      >
        Day vs changed
        {riskDelta > 0 && <span className="cmpmenu-badge">+{riskDelta} at risk</span>}
        <span className="cmpmenu-chev" aria-hidden="true">
          {open ? '▾' : '▴'}
        </span>
      </button>
      {open && (
        <div id="cmpmenu-panel" className="cmpmenu-panel" role="region" aria-label="Normal day versus changed">
          <Compare board={board} />
        </div>
      )}
    </div>
  );
}

/* ---------- app ---------- */
export default function DispatchApp() {
  const bs = useBoard();
  const { board } = bs;
  const [network, setNetwork] = useState<Network | null>(null);
  const [netError, setNetError] = useState<string | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [view, setView] = useState<View>('map');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [optError, setOptError] = useState<string | null>(null);
  const [focusRole, setFocusRole] = useState<RoleKey>('efficiency');
  const [openKey, setOpenKey] = useState<string | null>('efficiency');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [probId, setProbId] = useState('T-11');
  const [probOpen, setProbOpen] = useState<number | null>(null);
  const [driverMsgs, setDriverMsgs] = useState<Record<string, Msg[]>>({});
  const [georgeDispatched, setGeorgeDispatched] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [legendOpen, setLegendOpen] = useState(false);
  const [placeType, setPlaceType] = useState<ObstacleType | null>(null);
  const [toastText, setToastText] = useState('');
  const [copied, setCopied] = useState(false);
  const [studioSession, setStudioSession] = useState<StudioSession | null>(null);
  const [studioFocusAltId, setStudioFocusAltId] = useState<string | null>(null);
  const [studioBusy, setStudioBusy] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);
  const [chosenByShipment, setChosenByShipment] = useState<Record<string, RouteKind>>({});
  const [reroutePending, setReroutePending] = useState(false);
  const [frozenPath, setFrozenPath] = useState<Array<[number, number]> | null>(null);
  const [rerouteSubmitted, setRerouteSubmitted] = useState(false);
  const [georgeSubmittedPath, setGeorgeSubmittedPath] = useState<Array<[number, number]> | null>(null);
  const [georgeSubmittedKind, setGeorgeSubmittedKind] = useState<RouteKind | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const optSeq = useRef(0);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const georgeWindowEnd = new Date(now.getTime() + 90 * 60_000);
  const georgeWindowLabel = `${clockDate(now)} to ${clockDate(georgeWindowEnd)}`;

  const toast = useCallback((t: string) => {
    setToastText(t);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastText(''), 2600);
  }, []);

  const loadStatic = useCallback(() => {
    setNetError(null);
    getNetwork().then(setNetwork).catch((e) => setNetError(msg(e)));
    getPresets().then((r) => setPresets(r.presets)).catch((e) => setNetError(msg(e)));
  }, []);
  useEffect(loadStatic, [loadStatic]);

  // Default to Case 1 (George · POLB → Claremont) on the map.
  useEffect(() => {
    if (!board || selectedId) return;
    const demo = board.shipments
      .filter((s) => isDemoShipment(s.id) && !(georgeDispatched && s.id === 'C-102'))
      .map((s) => s.id);
    const id = defaultDemoShipmentId(demo);
    if (id) {
      setSelectedId(id);
      setView('map');
    }
  }, [board, selectedId, georgeDispatched]);

  // On To dispatch, don't keep a selection that already left for On route.
  useEffect(() => {
    if (view !== 'go' || !georgeDispatched || selectedId !== 'C-102') return;
    const next = board?.shipments.find((s) => isDemoShipment(s.id) && s.id !== 'C-102');
    setSelectedId(next?.id ?? null);
  }, [view, georgeDispatched, selectedId, board]);

  const loadOptions = useCallback(async (id: string) => {
    const n = ++optSeq.current;
    setOptError(null);
    try {
      const o = await getOptions(id);
      if (n === optSeq.current) setOptions(o);
    } catch (e) {
      if (n === optSeq.current) setOptError(msg(e));
    }
  }, []);
  useEffect(() => {
    if (board && selectedId) void loadOptions(selectedId);
  }, [board, selectedId, loadOptions]);

  const select = (id: string) => {
    setSelectedId(id);
    setFocusRole('efficiency');
    setOpenKey('efficiency');
    setPickedId(null);
    setReasonFor(null);
    setView('go');
  };

  const run = async (req: () => Promise<Board>, ok?: string) => {
    try {
      await bs.apply(req);
      if (ok) toast(ok);
    } catch (e) {
      toast(msg(e));
    }
  };
  const verdict = (id: string, v: Verdict) => {
    if (v === 'delete') return run(() => deleteDisruption(id), 'Report removed');
    return run(() => updateDisruption(id, { verification: v }), v === 'dismissed' ? 'Marked open: figures back to normal' : v === 'confirmed' ? 'Confirmed' : 'Back to unverified');
  };
  // To dispatch sets the path: truck → warehouse becomes the board session for obstacles / reroutes.
  const pathKey = (() => {
    const row = board?.shipments.find((s) => s.id === selectedId);
    if (!row?.current.truck_id || !network) return null;
    const wh = network.warehouses.find((w) => w.id === row.warehouse_id);
    if (!wh) return null;
    return `${row.id}|${row.current.truck_id}|${wh.id}|${wh.lat}|${wh.lng}`;
  })();

  useEffect(() => {
    if (!pathKey) {
      setStudioSession(null);
      setStudioFocusAltId(null);
      setStudioError(null);
      setStudioBusy(false);
      return;
    }
    const [, truckId, , latS, lngS] = pathKey.split('|');
    const lat = Number(latS);
    const lng = Number(lngS);
    let cancelled = false;
    setStudioBusy(true);
    setStudioError(null);
    setStudioFocusAltId(null);
    setStudioSession(null);
    setReroutePending(false);
    setFrozenPath(null);
    void createStudioSession({ truck_id: truckId, destination: { lat, lng } })
      .then((session) => {
        if (!cancelled) setStudioSession(session);
      })
      .catch((e) => {
        if (!cancelled) {
          setStudioSession(null);
          setStudioError(msg(e));
        }
      })
      .finally(() => {
        if (!cancelled) setStudioBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pathKey]);

  const placeObstacle = async (type: ObstacleType, lat: number, lng: number) => {
    setPlaceType(null);
    if (!studioSession) {
      toast('Select a shipment in To dispatch first.');
      return;
    }
    const kindNow: RouteKind =
      (selectedId && chosenByShipment[selectedId]) || demoJobFor(selectedId)?.chosenKind || 'impact';
    let keep = frozenPath;
    if (!keep?.length) {
      if (kindNow === 'impact' && selectedId && board) {
        const row = board.shipments.find((s) => s.id === selectedId);
        if (row?.route.geometry?.length) {
          keep = row.route.geometry.map((pt) => [pt[0], pt[1]] as [number, number]);
        }
      }
      if (!keep?.length) {
        const alt =
          kindNow === 'fastest'
            ? studioSession.alternatives.find((a) => a.slot === 'fastest') ?? studioSession.baseline
            : studioSession.alternatives.find((a) => a.slot === 'avoid') ?? studioSession.baseline;
        if (alt?.geometry?.length) {
          keep = alt.geometry.map((pt) => [pt[0], pt[1]] as [number, number]);
        } else if (studioSession.baseline?.geometry?.length) {
          keep = studioSession.baseline.geometry.map((pt) => [pt[0], pt[1]] as [number, number]);
        }
      }
    }
    setStudioBusy(true);
    setStudioError(null);
    setView('map');
    try {
      const next = await addStudioObstacle(studioSession.id, { type, lat, lng });
      setStudioSession(next);
      setStudioFocusAltId(null);
      // Do not auto-switch the drawn path — wait for an explicit reroute choice.
      if (keep?.length) setFrozenPath(keep);
      setReroutePending(true);
      setRerouteSubmitted(false);
      toast(
        type === 'road_closure'
          ? 'Road closure on path — preview a reroute, then Submit'
          : 'Obstacle placed — preview a reroute, then Submit',
      );
    } catch (e) {
      setStudioError(msg(e));
      toast(msg(e));
    } finally {
      setStudioBusy(false);
    }
  };

  const removeObstacle = async (obstacleId: string) => {
    if (!studioSession) return;
    setStudioBusy(true);
    setStudioError(null);
    try {
      const next = await deleteStudioObstacle(studioSession.id, obstacleId);
      setStudioSession(next);
      setStudioFocusAltId(null);
      if (next.obstacles.length === 0) {
        setReroutePending(false);
        setFrozenPath(null);
        toast('Obstacle removed');
      } else {
        setReroutePending(true);
        toast('Obstacle removed — still choose a reroute if needed');
      }
    } catch (e) {
      setStudioError(msg(e));
      toast(msg(e));
    } finally {
      setStudioBusy(false);
    }
  };

  useEffect(() => {
    if (!showObstaclePalette(view, { hasActivePath: Boolean(studioSession) })) setPlaceType(null);
  }, [view, studioSession]);

  const decide = async (o: ResponseOption, why?: string) => {
    if (!selectedId) return;
    if (!o.suggested && why === undefined) {
      setReasonFor(o.id);
      setReason('');
      setReasonError(null);
      return;
    }
    if (why !== undefined && why.trim().length < 3) {
      setReasonError('Give a short reason (at least 3 characters).');
      return;
    }
    setBusy(true);
    try {
      const r = await createDecision({ shipment_id: selectedId, option_id: o.id, ...(why !== undefined ? { reason: why.trim() } : {}) });
      bs.set(r.board);
      setReasonFor(null);
      setPickedId(null);
      toast(`Decision recorded: ${o.title}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.field === 'reason') {
        setReasonFor(o.id);
        setReasonError(e.message);
      } else {
        toast(msg(e));
        if (e instanceof ApiError && e.status === 409) void loadOptions(selectedId);
      }
    } finally {
      setBusy(false);
    }
  };

  /* ---------- derived ---------- */
  const row: ShipmentRow | null = board?.shipments.find((s) => s.id === selectedId) ?? null;
  const opts = options && options.shipment_id === selectedId ? options : null;
  const driverOf = (r: ShipmentRow) => (r.current.truck_id ? (network?.trucks.find((t) => t.id === r.current.truck_id)?.driver_label ?? r.current.truck_id) : 'No truck');
  const whName = (id: string) => network?.warehouses.find((w) => w.id === id)?.name ?? id;
  const decision: Decision | undefined = board?.decisions.find((d) => d.shipment_id === selectedId);
  const roleOpts = ROLE_ORDER.map((role) => ({ role, o: opts?.options.find((x) => x.roles.includes(role)) ?? null }));
  const pickedOpt = opts?.options.find((x) => x.id === pickedId) ?? roleOpts.find((x) => x.role === focusRole)?.o ?? null;
  // Everything that is not a role card: routes holding no role, and (when the row needs attention) the
  // non-route responses. The server's suggestion is always shown, whatever it is.
  const needsAttention = row?.attention === 'act' || row?.attention === 'watch';
  const others =
    opts?.options.filter((x) => x.roles.length === 0 && (x.suggested || x.kind === 'keep' || x.kind === 'reroute' || needsAttention)) ?? [];
  const georgeOnRoute: RouteTruck = {
    ...GEORGE_ONROUTE,
    next: `Claremont window ${georgeWindowLabel}`,
    sitT: georgeSubmittedPath ? 'Rerouted' : 'En route',
    short: georgeSubmittedPath
      ? georgeSubmittedKind === 'impact'
        ? 'Env & community detour → Claremont'
        : 'Fastest detour → Claremont'
      : 'Port of Long Beach → Claremont',
    path: georgeSubmittedPath ?? undefined,
  };
  const onRouteTrucks: RouteTruck[] = georgeDispatched ? [georgeOnRoute, ...ONROUTE] : ONROUTE;
  const t = onRouteTrucks.find((x) => x.id === probId) ?? onRouteTrucks[0]!;
  const p = PROB[t.id] ?? PROB[GEORGE_ONROUTE.id];
  const trMsgs: Msg[] =
    driverMsgs[t.id] ??
    p.chat.map(([kind, time, text]) => ({
      kind,
      html: esc(
        t.id === GEORGE_ONROUTE.id && text.includes('window')
          ? `Rolling. Window is ${georgeWindowLabel}.`
          : text,
      ),
      time: time === 'now' ? clockDate(now) : `${time} AM`,
    }));
  const addDriverMsg = (m: Msg) => setDriverMsgs((all) => ({ ...all, [t.id]: [...(all[t.id] ?? trMsgs), m] }));
  const onRouteCount = onRouteTrucks.length;
  const onRouteAlerts = onRouteTrucks.filter((x) => x.prob || x.delta < 0).length;
  const demoShipments =
    board?.shipments.filter(
      (s) => isDemoShipment(s.id) && !(georgeDispatched && s.id === 'C-102'),
    ) ?? [];
  const activeStory = storyForShipment(selectedId);
  const activeJob = demoJobFor(selectedId);
  const chosenKind: RouteKind =
    (selectedId && chosenByShipment[selectedId]) || activeJob?.chosenKind || 'impact';
  const setChosenKind = (kind: RouteKind) => {
    if (!selectedId) return;
    setChosenByShipment((prev) => ({ ...prev, [selectedId]: kind }));
    if (reroutePending || (studioSession?.obstacles.length ?? 0) > 0) {
      setReroutePending(false);
      setRerouteSubmitted(false);
      // Keep frozenPath as the blocked base so detours stay anchored to where the obstacle sits.
      toast(
        kind === 'impact'
          ? 'Preview: environment & community detour'
          : 'Preview: fastest arrival detour',
      );
      return;
    }
    toast(
      kind === 'impact'
        ? 'Map: environment & community minimized'
        : 'Map: fastest route',
    );
  };
  const submitReroute = () => {
    if (!studioSession?.obstacles.length) return;
    const kind =
      (selectedId && chosenByShipment[selectedId]) ||
      activeJob?.chosenKind ||
      chosenKind;
    const base =
      frozenPath ??
      (selectedId && board
        ? board.shipments
            .find((s) => s.id === selectedId)
            ?.route.geometry?.map((pt) => [pt[0], pt[1]] as [number, number])
        : null);
    if (!base?.length) {
      toast('No path to reroute.');
      return;
    }
    const detours = demoRerouteGeometries(
      base,
      studioSession.obstacles.map((o) => ({ lat: o.lat, lng: o.lng, radius_km: o.radius_km })),
    );
    if (!detours) {
      toast('Could not build detour.');
      return;
    }
    const geom = detours[kind];
    setGeorgeSubmittedPath(geom);
    setGeorgeSubmittedKind(kind);
    setRerouteSubmitted(true);
    setReroutePending(false);
    setGeorgeDispatched(true);
    setProbId(GEORGE_ONROUTE.id);
    if (selectedId) setChosenByShipment((prev) => ({ ...prev, [selectedId]: kind }));
    toast(
      kind === 'impact'
        ? 'Reroute submitted: environment & community'
        : 'Reroute submitted: fastest arrival',
    );
    setView('prob');
  };
  const cls = `dapp ${view === 'map' ? 'home' : 'work'} ${view === 'net' ? 'net' : ''}${studioSession ? ' studio' : ''}`;
  const routeHeadline = (s: ShipmentRow) => {
    const story = storyForShipment(s.id);
    if (story) return `${story.originLabel} → ${story.destinationLabel}`;
    return `${s.terminal_id} → ${whName(s.warehouse_id)}`;
  };
  const driverHeadline = (s: ShipmentRow) => {
    const story = storyForShipment(s.id);
    return story ? story.driverName : driverOf(s);
  };
  const chosenLabel =
    chosenKind === 'impact' ? 'Environment & community minimized' : 'Fastest route';

  const roleCard = ({ role, o }: { role: RoleKey; o: ResponseOption | null }, idx: number) => {
    const st = ROLE[role];
    const firstHolder = o ? roleOpts.findIndex((x) => x.o?.id === o.id) : -1;
    const sameAs = o && firstHolder !== idx ? ROLE[roleOpts[firstHolder].role].n : null;
    if (!o) {
      return (
        <div key={role} className="acc">
          <div className="acc-h" style={{ cursor: 'default' }}>
            <span className={`sw ${st.cls}`} />
            <span className="left">
              <span className="at">{st.n}</span>
              <div className="am">No feasible route holds this role.</div>
            </span>
          </div>
        </div>
      );
    }
    if (sameAs) {
      return (
        <div key={role} className={`acc ${focusRole === role ? 'sel' : ''}`}>
          <button className="acc-h" onClick={() => setFocusRole(role)}>
            <span className={`sw ${st.cls}`} />
            <span className="left">
              <span className="at">{st.n}</span>
              <div className="am">Same route as {sameAs}: {o.title}</div>
            </span>
          </button>
        </div>
      );
    }
    const e = o.evaluation;
    const late = e.slack_min < 0;
    const holds = o.roles.map((r) => ROLE[r as RoleKey].n);
    const isKeep = o.kind === 'keep';
    return (
      <Acc
        key={role}
        open={openKey === role}
        sel={focusRole === role}
        onToggle={() => {
          setFocusRole(role);
          setPickedId(o.id);
          setOpenKey(openKey === role ? null : role);
        }}
        head={
          <>
            <span className={`sw ${st.cls}`} />
            <span className="left">
              <span className="at">{holds.join(' · ')}</span>
              <div className="am">
                {clock(e.eta_min)} · {e.miles.toFixed(0)} mi · {e.co2_kg.toFixed(0)} kg CO₂
              </div>
              <div style={{ marginTop: '.35rem' }}>
                <span className="chip soft">{o.title}</span> {o.suggested && <span className="chip good">Suggested</span>}{' '}
                <span className={`chip ${STATUS[e.status][1]}`}>{STATUS[e.status][0]}</span>
              </div>
            </span>
            <span className={`big ${late ? 'late' : ''}`}>
              {late ? '−' : '+'}
              {Math.abs(e.slack_min)}
              <small>{late ? 'min late' : 'min spare'}</small>
            </span>
          </>
        }
      >
        <Mx
          cells={[
            ['Arrive', clock(e.eta_min).replace(' ', '')],
            ['Miles', e.miles.toFixed(0)],
            ['CO₂', `${e.co2_kg.toFixed(0)} kg`],
            ['Cost', `$${e.cost_usd.toFixed(0)}`],
            ['Community', e.community_score.toFixed(0), e.community_score >= 90 ? 'goodc' : e.community_score < 80 ? 'badc' : ''],
          ]}
        />
        {(e.flags.length > 0 || e.needs_review) && (
          <Tags tags={[...e.flags.map((f): Tag => ['Note', f, 'warn']), ...(e.needs_review ? [['Report', 'Depends on an unverified report', 'warn'] as Tag] : [])]} />
        )}
        <div className="more">
          <p>{o.description}</p>
          <p className="mute small">{o.route.label}{o.route.estimated ? ' (estimated path)' : ''}</p>
          <p className="small">{e.community_detail}</p>
          {o.burdens.length > 0 && (
            <ul>
              {o.burdens.map((b, i) => (
                <li key={i}>
                  {b.text.toLowerCase().startsWith(STAKE[b.stakeholder].toLowerCase()) ? b.text : <><b>{STAKE[b.stakeholder]}:</b> {b.text}</>}
                </li>
              ))}
            </ul>
          )}
          {!isKeep && (
            <table>
              <thead>
                <tr>
                  <th>Versus keeping the plan</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>On-time chance</td><td>{signed(Math.round(o.delta.on_time_probability * 100), ' pts')}</td></tr>
                <tr><td>Late minutes</td><td>{signed(o.delta.late_min, ' min')}</td></tr>
                <tr><td>Miles</td><td>{signed(o.delta.miles, ' mi', 1)}</td></tr>
                <tr><td>CO₂ (est.)</td><td>{signed(o.delta.co2_kg, ' kg', 1)}</td></tr>
                <tr><td>Cost (est.)</td><td>{signed(o.delta.cost_usd, ' $')}</td></tr>
                <tr><td>Community score</td><td>{signed(o.delta.community_score)}</td></tr>
              </tbody>
            </table>
          )}
          <div className="src">Roads: OpenStreetMap · figures: rule-based estimates from simulated inputs</div>
        </div>
      </Acc>
    );
  };

  return (
    <div className={cls}>
      <div className="top">
        <span className="brand">Dispatch.AI</span>
        <nav className="nav" aria-label="Views">
          <button className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>Map</button>
          <button className={view === 'go' ? 'on' : ''} onClick={() => setView('go')}>
            To dispatch<span className="n">{demoShipments.length}</span>
          </button>
          <button className={view === 'prob' ? 'on' : ''} onClick={() => setView('prob')}>
            On route<span className={`n${onRouteAlerts > 0 ? ' alert' : ''}`}>{onRouteCount}</span>
          </button>
          <button className={view === 'net' ? 'on' : ''} onClick={() => setView('net')}>Network</button>
        </nav>
        <span className="clock">{clockDate(now)}</span>
      </div>

      <div id="mapwrap">
        <DispatchMap
          view={view}
          board={board}
          network={network}
          selectedId={selectedId}
          focusRole={focusRole}
          options={opts}
          probId={probId}
          placeType={placeType}
          studioSession={studioSession}
          studioFocusAltId={studioFocusAltId}
          demoRouteKind={chosenKind}
          reroutePending={reroutePending}
          frozenPath={frozenPath}
          georgeDispatched={georgeDispatched}
          onRouteTrucks={onRouteTrucks}
          onSelect={select}
          onPickProb={(id) => {
            setProbId(id);
            setView('prob');
          }}
          onVerdict={verdict}
          onPlaceCancel={() => setPlaceType(null)}
          onObstaclePlaced={placeObstacle}
          onObstacleRejected={(reason) => toast(reason)}
          onStudioObstacleRemove={removeObstacle}
        />
        <button id="expand" onClick={() => setView('map')}>Expand map</button>
        {showObstaclePalette(view, { hasActivePath: Boolean(studioSession) }) && (
          <ObstaclePalette selected={placeType} onSelect={setPlaceType} disabled={!studioSession} />
        )}
        {view === 'map' && activeStory && (
          <div className="story-banner" role="status" title={activeStory.blurb}>
            <span className="story-case">{activeStory.driveLabel}</span>
            <strong>{activeStory.driverName}</strong>
            <span className="story-sep" aria-hidden="true">
              ·
            </span>
            <span className="story-route">
              {activeStory.originLabel} → {activeStory.destinationLabel}
            </span>
            <span className="story-sep" aria-hidden="true">
              ·
            </span>
            <span className="story-route">{reroutePending ? 'Blocked — choose a reroute' : chosenLabel}</span>
          </div>
        )}
        {view === 'map' && studioSession && (
          <RouteStudio
            session={studioSession}
            busy={studioBusy}
            error={studioError}
            story={activeStory}
            chosenKind={chosenKind}
            reroutePending={reroutePending}
            canSubmitReroute={
              Boolean(studioSession?.obstacles.length) &&
              !reroutePending &&
              !rerouteSubmitted &&
              Boolean(selectedId && chosenByShipment[selectedId])
            }
            rerouteSubmitted={rerouteSubmitted}
            shipmentId={selectedId}
            onChoose={setChosenKind}
            onSubmitReroute={submitReroute}
            onClear={() => setView('go')}
            onRemoveObstacle={removeObstacle}
          />
        )}
        {view === 'map' && board && <CompareMenu board={board} />}
        <div className={`legend ${legendOpen ? 'open' : ''}`}>
          <button className="lt" aria-expanded={legendOpen} onClick={() => setLegendOpen((o) => !o)}>
            Legend {legendOpen ? '−' : '+'}
          </button>
          <div className="lb">
            {studioSession ? (
              <>
                <h5>Reroute paths</h5>
                <div><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke="#0a7a3e" strokeWidth="5" /></svg>Fastest (solid green)</div>
                <div><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke="#1a5f8a" strokeWidth="5" strokeDasharray="10 6" /></svg>Env & community (dashed blue)</div>
              </>
            ) : (
              <>
            <h5>Shipment routes</h5>
            <div><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke={GOOD} strokeWidth="4" /></svg>On time</div>
            <div><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke={INK} strokeWidth="4" strokeDasharray="7 4" /></svg>Tight</div>
            <div><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke={BAD} strokeWidth="6" /></svg>At risk</div>
              </>
            )}
            <h5>Road reports</h5>
            <div><svg width="30" height="14"><circle cx="15" cy="7" r="6" fill="#4b4fa615" stroke="#4b4fa6" strokeWidth="2" strokeDasharray="4 3" /></svg>Unverified</div>
            <div><svg width="30" height="14"><circle cx="15" cy="7" r="6" fill="#d4312c30" stroke={BAD} strokeWidth="2" /></svg>Confirmed</div>
            <h5>Route roles</h5>
            <div><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke={INK} strokeWidth="3" /></svg>Efficiency</div>
            <div><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke={INK} strokeWidth="3" strokeDasharray="6 4" /></svg>Sustainability</div>
            <div><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke={INK} strokeWidth="3" strokeDasharray="1 4" strokeLinecap="round" /></svg>Community</div>
            <h5>Places</h5>
            <div><span className="leg-wh"><img src="/map-icons/warehouse.png" alt="" /></span>Warehouse</div>
            <h5>Trucks</h5>
            <div><span className="leg-tk"><img src="/map-icons/truck.svg" alt="" /></span>On time</div>
            <div><span className="leg-tk warn"><img src="/map-icons/truck.svg" alt="" /></span>Tight</div>
            <div><span className="leg-tk bad"><img src="/map-icons/truck.svg" alt="" /></span>At risk</div>
            <div><span className="leg-tk hollow"><img src="/map-icons/truck.svg" alt="" /></span>Spare</div>
          </div>
        </div>
      </div>

      {!board && view !== 'prob' && (
        <div className="loadstate" role={bs.loading ? 'status' : 'alert'}>
          {bs.loading ? (
            'Loading the board…'
          ) : (
            <>
              <b>The board could not be loaded.</b>
              <span>{bs.error?.status === 0 ? 'The server is not responding. Check that it is running, then retry.' : bs.error?.message}</span>
              <button className="btn pri" onClick={() => { bs.retry(); loadStatic(); }}>Retry</button>
            </>
          )}
        </div>
      )}
      {bs.error && board && (
        <div className="connbar" role="alert">
          Lost connection to the server. Showing the last board received.{' '}
          <button className="btn sm" onClick={bs.retry}>Retry</button>
        </div>
      )}

      <div id="work">
        <div className="col list">
          <div className="pick">
            {view === 'go' &&
              demoShipments.map((s) => {
                const story = storyForShipment(s.id);
                const cargoSt = cargoStatusFor(s.id);
                return (
                <button key={s.id} className={s.id === selectedId ? 'on' : ''} onClick={() => select(s.id)}>
                  <span className="id">{story?.driveLabel ?? s.id}</span>
                  <span className="nm">
                    <b>{driverHeadline(s)}</b>
                    <div className="sub">
                      {s.cargo} · {routeHeadline(s)}
                      {s.priority === 'high' ? ' · priority' : ''}
                    </div>
                    <div className="sub" style={{ fontFamily: 'var(--mono)' }}>
                      <span className={`chip ${cargoStatusChip(cargoSt)}`}>Cargo {cargoStatusLabel(cargoSt)}</span>{' '}
                      <span className={`chip ${STATUS[s.current.status][1]}`}>{STATUS[s.current.status][0]}</span>{' '}
                      {s.current.slack_min >= 0 ? `+${s.current.slack_min} min spare` : `−${Math.abs(s.current.slack_min)} min late`}
                    </div>
                  </span>
                </button>
                );
              })}
            {view === 'prob' &&
              onRouteTrucks.map((x) => (
                <button key={x.id} className={x.id === t.id ? 'on' : ''} onClick={() => setProbId(x.id)}>
                  <span className="id">{x.id === GEORGE_ONROUTE.id ? 'Drive 1' : x.id}</span>
                  <span className="nm">
                    <b>{x.drv}</b>
                    <div className="sub">{x.short}</div>
                    <div className="sub" style={{ fontFamily: 'var(--mono)' }}>{x.delta < 0 ? `−${Math.abs(x.delta)} min late` : `+${x.delta} min ahead`}</div>
                  </span>
                </button>
              ))}
          </div>
        </div>

        <div className="col center">
          {view === 'go' && row && (
            <section className="view on">
              <div className="ttl">
                {activeStory
                  ? `${activeStory.driveLabel}: ${activeStory.driverName} · ${activeStory.originLabel} → ${activeStory.destinationLabel}`
                  : `${driverOf(row)} → ${whName(row.warehouse_id)}`}
              </div>
              <div className="sub2">
                {row.cargo}{' '}
                <span className={`chip ${cargoStatusChip(cargoStatusFor(row.id))}`}>
                  Cargo {cargoStatusLabel(cargoStatusFor(row.id))}
                </span>
                {' · window '}
                <b>
                  {row.id === 'C-102'
                    ? georgeWindowLabel
                    : `${clock(row.current.appt_start_min)} to ${clock(row.current.appt_end_min)}`}
                </b>
                {' · on map: '}
                <b>{chosenLabel}</b>
                {activeJob?.chosenKind === 'impact' && chosenKind === 'impact' && activeStory && (
                  <> · <span className="chip good">Dispatcher chose env & community</span></>
                )}
              </div>
              {selectedId && activeJob && (
                <DemoRoutePanel
                  shipmentId={selectedId}
                  chosenKind={chosenKind}
                  onChoose={setChosenKind}
                />
              )}
              <div style={{ marginTop: '1.2rem', display: 'flex', gap: '.8rem' }}>
                <button
                  className="btn pri lg"
                  style={{ flex: 1 }}
                  onClick={() => {
                    if (row.id === 'C-102') {
                      setGeorgeDispatched(true);
                      setProbId(GEORGE_ONROUTE.id);
                    }
                    toast(`Dispatch ${driverHeadline(row)} on ${chosenLabel.toLowerCase()}`);
                    setView('map');
                  }}
                >
                  Dispatch {driverHeadline(row)}
                </button>
                <button className="btn lg" onClick={() => toast('Held at the yard. Nothing was changed or sent.')}>
                  Hold
                </button>
              </div>
            </section>
          )}

          {view === 'prob' && (
            <section className="view on">
              <div className="ttl">
                {t.drv}{' '}
                <span className={`chip ${t.sit}`} style={{ fontSize: '.9rem', marginLeft: '.4rem' }}>{t.sitT}</span>
              </div>
              <div className="sub2">
                {t.id === GEORGE_ONROUTE.id ? 'Drive 1' : t.id} · {t.cargo}
                {t.id === GEORGE_ONROUTE.id && (
                  <>
                    {' · window '}
                    <b>{georgeWindowLabel}</b>
                    {georgeSubmittedKind && (
                      <>
                        {' · '}
                        <b>
                          {georgeSubmittedKind === 'impact'
                            ? 'Env & community detour'
                            : 'Fastest detour'}
                        </b>
                      </>
                    )}
                  </>
                )}
                {t.wants && (
                  <>
                    {' · '}
                    <b>{t.wants}</b>
                  </>
                )}
              </div>
              <div className="stats">
                <div>
                  <span>On time</span>
                  <b className={t.delta >= 0 ? 'goodc' : 'badc'}>{t.delta >= 0 ? `+${t.delta} min` : `−${Math.abs(t.delta)} min`}</b>
                </div>
                <div>
                  <span>Fatigue</span>
                  <b style={{ color: fatLbl(t.fat)[1] }}>
                    {fatLbl(t.fat)[0]} {t.fat}%
                  </b>
                  <div className="bar" style={{ marginTop: '.5rem' }}>
                    <i style={{ width: `${t.fat}%`, background: fatLbl(t.fat)[1] }} />
                  </div>
                </div>
                <div>
                  <span>Driven today</span>
                  <b>{t.driven}</b>
                </div>
              </div>
              <div className={`alert ${p.sev}`}>
                <b>{p.head}</b> <span className="mute small">· {p.src}</span>
              </div>
              {p.opts.length === 0 ? (
                <div className="mute" style={{ marginTop: '.5rem' }}>No action needed.</div>
              ) : (
                p.opts.map((o, i) => (
                  <Acc
                    key={i}
                    open={probOpen === i}
                    sel={probOpen === i}
                    onToggle={() => {
                      setProbOpen(probOpen === i ? null : i);
                    }}
                    head={
                      <>
                        <span className="left">
                          <span className="at">
                            {i + 1}. {o.t}
                          </span>
                          <div style={{ marginTop: '.4rem' }}>
                            <span className="chip">{OBJ[o.obj]}</span> {o.rec && <span className="chip good">Suggested</span>}
                          </div>
                        </span>
                        <span className={`big ${/^\+/.test(o.eta) ? 'neg' : ''}`}>
                          {o.eta.replace(' min', '')}
                          <small>{/min/.test(o.eta) ? 'min added' : 'when'}</small>
                        </span>
                      </>
                    }
                  >
                    <Mx cells={[['Arrive', o.eta], ['Miles', o.mi], ['CO₂', o.co2], ['Cost', o.cost], ['Community', o.comm]]} />
                    <Tags tags={o.tags} />
                    <div className="more">
                      <p>
                        {o.s} <span className="mute">{o.drv}.</span>
                      </p>
                      <ul>
                        {o.why.map((w, k) => (
                          <li key={k}>{w}</li>
                        ))}
                      </ul>
                      <div className="src">Goal: {OBJ[o.obj].toLowerCase()}</div>
                    </div>
                    <div className="acts">
                      <button
                        className={`btn ${o.rec ? 'pri' : ''}`}
                        onClick={() => {
                          toast(`Plan sent to ${t.drv}`);
                          addDriverMsg({ kind: 'me', html: `Plan sent: ${esc(o.t)}`, time: '9:41 AM' });
                        }}
                      >
                        Send to {t.drv}
                      </button>
                    </div>
                  </Acc>
                ))
              )}
            </section>
          )}

          {view === 'net' && (
            <section className="view on">
              {netError && (
                <div className="alert bad">
                  {netError} <button className="btn sm" onClick={loadStatic}>Retry</button>
                </div>
              )}
              {board && <Compare board={board} compact />}
              <div className="two">
                <div>
                  <h4>Warehouses</h4>
                  {network?.warehouses.map((w) => {
                    const u = w.capacity ? w.booked / w.capacity : 0;
                    return (
                      <div key={w.id} className="row1">
                        <div className="nm">
                          <b>{w.name}</b>
                          <div className="sub">
                            {w.booked}/{w.capacity} slots booked today · {w.docks} docks
                          </div>
                          <div className="bar" style={{ marginTop: '.4rem' }}>
                            <i style={{ width: `${Math.min(100, u * 100)}%`, background: u < 0.7 ? GOOD : u < 0.9 ? INK : BAD }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div>
                  <h4>Roads · set your own status</h4>
                  {presets
                    .filter((pr) => ['slowdown', 'closure', 'hazard'].includes(pr.disruption.kind))
                    .map((pr) => {
                      const d: Disruption | undefined = board?.disruptions.find((x) => x.label === (pr.disruption.label ?? ''));
                      return (
                        <div key={pr.id} className="row1">
                          <div className="nm">
                            <b>{pr.label}</b>
                            <div className="sub">
                              {pr.description} · {SOURCE[pr.disruption.source ?? 'simulated']}
                            </div>
                            {d && (
                              <div style={{ marginTop: '.3rem' }}>
                                <span className={`chip ${d.verification === 'confirmed' ? 'bad' : d.verification === 'unverified' ? 'soft' : 'ok'}`}>{VER[d.verification]}</span>{' '}
                                <span className="small mute">affects {d.affected_shipment_ids.join(', ') || 'no shipment'}</span>{' '}
                                <a href="#" className="small" onClick={(e) => { e.preventDefault(); void verdict(d.id, 'delete'); }}>remove</a>
                              </div>
                            )}
                          </div>
                          {d && (
                            <div className="seg3" role="group" aria-label={`Your call on ${pr.label}`}>
                              {(['unverified', 'confirmed', 'dismissed'] as const).map((v) => (
                                <button key={v} className={d.verification === v ? 'on' : ''} aria-pressed={d.verification === v} onClick={() => verdict(d.id, v)}>
                                  {VER[v]}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      <aside id="side">
        {view === 'prob' && (
          <div className="sidepane on">
            <div className="sidehd">
              <span className="t">Driver chat</span>
            </div>
            <div className="chat on">
              <Messages msgs={trMsgs} />
              <div className="quick">
                {p.quick.map((q) => (
                  <button key={q} onClick={() => addDriverMsg({ kind: 'me', html: esc(q), time: '9:41 AM' })}>{q}</button>
                ))}
              </div>
              <ChatInput onSend={(x) => addDriverMsg({ kind: 'me', html: esc(x), time: '9:41 AM' })} />
            </div>
          </div>
        )}
      </aside>

      <div className={`toast ${toastText ? 'on' : ''}`} role="status">{toastText}</div>
    </div>
  );
}

function ChatInput({ onSend }: { onSend: (t: string) => void }) {
  const [v, setV] = useState('');
  const go = () => {
    if (v.trim()) onSend(v.trim());
    setV('');
  };
  return (
    <div className="send">
      <input placeholder="Message the driver" aria-label="Message the driver" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
      <button className="btn pri" onClick={go}>Send</button>
    </div>
  );
}
