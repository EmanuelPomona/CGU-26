// Dispatch: the owner's mockup (ADR-007). Map, To dispatch and Network run on the backend API; the On route
// view is a scripted example. The browser never ranks options or computes a figure.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ApiError, addStudioObstacle, createDecision, createDisruption, createStudioSession, deleteDecision, deleteDisruption,
  getNetwork, getOptions, getPresets, updateDisruption,
} from '../api/client';
import type {
  Board, Decision, Disruption, Network, OptionsResponse, Preset, ResponseOption, ShipmentRow, StudioSession,
} from '../api/types';
import { useBoard } from '../api/useBoard';
import { DispatchMap, type Verdict, type View } from './DispatchMap';
import { ObstaclePalette } from './ObstaclePalette';
import { toDisruptionCreate, type ObstacleType } from './obstacleCatalog';
import { showObstaclePalette } from './placeMode';
import { RouteStudio } from './RouteStudio';
import { BAD, GOOD, INK, OBJ, ONROUTE, PROB, ROLE, ROLE_ORDER, fatLbl, type RoleKey, type Tag } from './data';
import './dispatch.css';

const SCRIPTED_LINE = 'Scripted explanation from the rule-based score.';
const esc = (s: string) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'The request failed.');
const clock = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  return `${h % 12 || 12}:${String(Math.round(m) % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
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

/** "Explain this option": assembled only from the server's text for that option. */
function explain(o: ResponseOption, rationale: string): string[] {
  const out: string[] = [];
  if (o.suggested) out.push(rationale);
  out.push(o.description);
  out.push(o.evaluation.community_detail);
  for (const b of o.burdens) {
    const who = STAKE[b.stakeholder];
    out.push(b.text.toLowerCase().startsWith(who.toLowerCase()) ? b.text : `${who}: ${b.text}`);
  }
  out.push(...o.notes);
  out.push(...o.evaluation.flags);
  if (!o.feasible && o.infeasible_reason) out.push(o.infeasible_reason);
  return out.filter(Boolean);
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
  const [explainId, setExplainId] = useState<string | null>(null);
  const [probId, setProbId] = useState('T-11');
  const [probOpen, setProbOpen] = useState<number | null>(null);
  const [probOpt, setProbOpt] = useState<number | null>(null);
  const [sideTab, setSideTab] = useState<'chat' | 'explain'>('chat');
  const [driverMsgs, setDriverMsgs] = useState<Record<string, Msg[]>>({});
  const [legendOpen, setLegendOpen] = useState(false);
  const [placeType, setPlaceType] = useState<ObstacleType | null>(null);
  const [toastText, setToastText] = useState('');
  const [copied, setCopied] = useState(false);
  const [studioMode, setStudioMode] = useState(false);
  const [studioSession, setStudioSession] = useState<StudioSession | null>(null);
  const [studioTruckId, setStudioTruckId] = useState<string | null>(null);
  const [studioPickingDest, setStudioPickingDest] = useState(false);
  const [studioFocusAltId, setStudioFocusAltId] = useState<string | null>(null);
  const [studioBusy, setStudioBusy] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const optSeq = useRef(0);

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

  // Default selection for the demo: C-103 when present.
  useEffect(() => {
    if (board && !selectedId) setSelectedId(board.shipments.find((s) => s.id === 'C-103')?.id ?? board.shipments[0]?.id ?? null);
  }, [board, selectedId]);

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
    setExplainId(null);
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
  const clearStudio = useCallback(() => {
    setStudioSession(null);
    setStudioTruckId(null);
    setStudioPickingDest(false);
    setStudioFocusAltId(null);
    setStudioError(null);
    setStudioBusy(false);
    setPlaceType(null);
  }, []);

  const placeObstacle = async (type: ObstacleType, lat: number, lng: number) => {
    setPlaceType(null);
    if (studioMode) {
      if (!studioSession) {
        toast('Pick truck and destination first.');
        return;
      }
      setStudioBusy(true);
      setStudioError(null);
      try {
        const next = await addStudioObstacle(studioSession.id, { type, lat, lng });
        setStudioSession(next);
        setStudioFocusAltId(null);
        toast('Obstacle placed — routes updated');
      } catch (e) {
        setStudioError(msg(e));
        toast(msg(e));
      } finally {
        setStudioBusy(false);
      }
      return;
    }
    await run(() => createDisruption(toDisruptionCreate(type, lat, lng)), 'Obstacle placed');
  };

  const onStudioPickTruck = (truckId: string) => {
    if (!truckId) {
      setStudioTruckId(null);
      setStudioPickingDest(false);
      return;
    }
    setStudioSession(null);
    setStudioFocusAltId(null);
    setStudioError(null);
    setStudioTruckId(truckId);
    setStudioPickingDest(true);
  };

  const onStudioPickDestination = async (lat: number, lng: number) => {
    if (!studioTruckId) return;
    setStudioPickingDest(false);
    setStudioBusy(true);
    setStudioError(null);
    try {
      const session = await createStudioSession({ truck_id: studioTruckId, destination: { lat, lng } });
      setStudioSession(session);
      toast('Route session ready');
    } catch (e) {
      setStudioError(msg(e));
      setStudioPickingDest(true);
      toast(msg(e));
    } finally {
      setStudioBusy(false);
    }
  };

  useEffect(() => {
    if (!showObstaclePalette(view, { studioMode, hasStudioSession: Boolean(studioSession) })) setPlaceType(null);
  }, [view, studioMode, studioSession]);

  useEffect(() => {
    if (!studioMode) clearStudio();
  }, [studioMode, clearStudio]);

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
  const explainOpt = opts?.options.find((x) => x.id === explainId) ?? null;
  const t = ONROUTE.find((x) => x.id === probId)!;
  const p = PROB[probId];
  const trMsgs: Msg[] = driverMsgs[probId] ?? p.chat.map(([kind, time, text]) => ({ kind, html: esc(text), time: `${time} AM` }));
  const addDriverMsg = (m: Msg) => setDriverMsgs((all) => ({ ...all, [probId]: [...(all[probId] ?? trMsgs), m] }));
  const problems = ONROUTE.filter((x) => x.prob).length;
  const cls = `dapp ${view === 'map' || studioMode ? 'home' : 'work'} ${view === 'net' && !studioMode ? 'net' : ''}${studioMode ? ' studio' : ''}`;

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
        <div className="acts">
          <button className="btn ask" onClick={() => setExplainId(o.id)}>Explain this option</button>
        </div>
      </Acc>
    );
  };

  return (
    <div className={cls}>
      <div className="top">
        <span className="brand">Dispatch</span>
        <nav className="nav" aria-label="Views">
          <button className={view === 'map' ? 'on' : ''} onClick={() => { setStudioMode(false); setView('map'); }}>Map</button>
          <button className={view === 'go' ? 'on' : ''} onClick={() => { setStudioMode(false); setView('go'); }}>
            To dispatch<span className="n">{board?.shipments.length ?? 0}</span>
          </button>
          <button className={view === 'prob' ? 'on' : ''} onClick={() => { setStudioMode(false); setView('prob'); }}>
            On route<span className="n alert">{problems}</span>
          </button>
          <button className={view === 'net' ? 'on' : ''} onClick={() => { setStudioMode(false); setView('net'); }}>Network</button>
        </nav>
        <div className="mode-toggle" role="group" aria-label="Workspace">
          <button type="button" className={!studioMode ? 'on' : ''} onClick={() => setStudioMode(false)}>Board</button>
          <button
            type="button"
            className={studioMode ? 'on' : ''}
            onClick={() => {
              setStudioMode(true);
              setView('map');
            }}
          >
            Route studio
          </button>
        </div>
        <span className="clock">{board ? clock(board.settings.clock_min) : ''}</span>
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
          studioMode={studioMode}
          studioSession={studioSession}
          studioFocusAltId={studioFocusAltId}
          studioPickingDest={studioPickingDest}
          studioSelectedTruckId={studioTruckId}
          onSelect={select}
          onPickProb={(id) => {
            setProbId(id);
            setView('prob');
          }}
          onVerdict={verdict}
          onPlaceCancel={() => setPlaceType(null)}
          onObstaclePlaced={placeObstacle}
          onObstacleRejected={(reason) => toast(reason)}
          onStudioPickTruck={onStudioPickTruck}
          onStudioPickDestination={onStudioPickDestination}
        />
        <button id="expand" onClick={() => setView('map')}>Expand map</button>
        {showObstaclePalette(view, { studioMode, hasStudioSession: Boolean(studioSession) }) && (
          <ObstaclePalette selected={placeType} onSelect={setPlaceType} disabled={studioMode ? !studioSession : !board} />
        )}
        {studioMode && (
          <RouteStudio
            session={studioSession}
            pickingDest={studioPickingDest}
            selectedTruckId={studioTruckId}
            focusAltId={studioFocusAltId}
            busy={studioBusy}
            error={studioError}
            onFocusAlt={setStudioFocusAltId}
            onClear={clearStudio}
          />
        )}
        {view === 'map' && !studioMode && board && <CompareMenu board={board} />}
        <div className={`legend ${legendOpen ? 'open' : ''}`}>
          <button className="lt" aria-expanded={legendOpen} onClick={() => setLegendOpen((o) => !o)}>
            Legend {legendOpen ? '−' : '+'}
          </button>
          <div className="lb">
            {studioMode ? (
              <>
                <h5>Studio routes</h5>
                <div><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke="#0a7a3e" strokeWidth="4" /></svg>Fastest</div>
                <div><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke="#1a4a8a" strokeWidth="4" strokeDasharray="7 4" /></svg>Direct</div>
                <div><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke="#8a4a10" strokeWidth="4" strokeDasharray="1 4" strokeLinecap="round" /></svg>Avoid hazards</div>
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
            <div><span className="leg-tk"><img src="/map-icons/truck.png" alt="" /></span>On time</div>
            <div><span className="leg-tk warn"><img src="/map-icons/truck.png" alt="" /></span>Tight</div>
            <div><span className="leg-tk bad"><img src="/map-icons/truck.png" alt="" /></span>At risk</div>
            <div><span className="leg-tk hollow"><img src="/map-icons/truck.png" alt="" /></span>Spare</div>
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
              board?.shipments.map((s) => (
                <button key={s.id} className={s.id === selectedId ? 'on' : ''} onClick={() => select(s.id)}>
                  <span className="id">{s.id}</span>
                  <span className="nm">
                    <b>{driverOf(s)}</b>
                    <div className="sub">
                      {s.cargo} · {s.terminal_id} → {s.warehouse_id}
                      {s.priority === 'high' ? ' · priority' : ''}
                    </div>
                    <div className="sub" style={{ fontFamily: 'var(--mono)' }}>
                      <span className={`chip ${STATUS[s.current.status][1]}`}>{STATUS[s.current.status][0]}</span>{' '}
                      {s.current.slack_min >= 0 ? `+${s.current.slack_min} min spare` : `−${Math.abs(s.current.slack_min)} min late`}
                    </div>
                  </span>
                </button>
              ))}
            {view === 'prob' &&
              ONROUTE.map((x) => (
                <button key={x.id} className={x.id === probId ? 'on' : ''} onClick={() => setProbId(x.id)}>
                  <span className="id">{x.id}</span>
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
                {driverOf(row)} → {whName(row.warehouse_id)}
              </div>
              <div className="sub2">
                {row.id} · {row.cargo} · window <b>{clock(row.current.appt_start_min)} to {clock(row.current.appt_end_min)}</b> · status{' '}
                <b className={row.current.status === 'on_time' ? 'goodc' : 'badc'}>{STATUS[row.current.status][0].toLowerCase()}</b>
                {row.current.needs_review && ' · depends on an unverified report'}
              </div>
              <Compare board={board!} compact />
              {optError && (
                <div className="alert bad">
                  {optError}{' '}
                  <button className="btn sm" onClick={() => selectedId && loadOptions(selectedId)}>Retry</button>
                </div>
              )}
              {!opts && !optError && <div className="mute">Loading route options…</div>}
              {opts && (
                <>
                  {opts.suggested_option_id && (
                    <div className="alert ok">
                      <b>Suggested:</b> {opts.rationale.replace(/^Suggested:\s*/, '')}
                      <div className="src">Rule-based score from the dispatch priorities. You decide.</div>
                    </div>
                  )}
                  {decision && (
                    <div className="alert ok">
                      <b>Decided:</b> {decision.option_title} ({decision.was_suggested ? 'suggested' : `override: ${decision.reason ?? ''}`})
                      <textarea className="draft" readOnly value={decision.supervisor_update} aria-label="Drafted supervisor update" />
                      <div className="acts">
                        <button
                          className="btn sm"
                          onClick={() => {
                            void navigator.clipboard?.writeText(decision.supervisor_update).then(() => {
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            });
                          }}
                        >
                          {copied ? 'Copied' : 'Copy update'}
                        </button>
                        <button className="btn sm" disabled={busy} onClick={() => run(() => deleteDecision(decision.id), 'Decision undone')}>Undo</button>
                        <span className="mute small">The tool does not send anything.</span>
                      </div>
                    </div>
                  )}
                  {roleOpts.map(roleCard)}
                  {others.length > 0 && (
                    <>
                      <h4>Other responses</h4>
                      {others.map((o) => (
                        <Acc
                          key={o.id}
                          open={openKey === o.id}
                          sel={pickedId === o.id}
                          onToggle={() => {
                            if (o.feasible) setPickedId(o.id);
                            setOpenKey(openKey === o.id ? null : o.id);
                          }}
                          head={
                            <>
                              <span className="left">
                                <span className="at">{o.title}</span>
                                <div style={{ marginTop: '.35rem' }}>
                                  {o.suggested && <span className="chip good">Suggested</span>}{' '}
                                  {!o.feasible && <span className="chip bad">Not possible</span>}{' '}
                                  <span className={`chip ${STATUS[o.evaluation.status][1]}`}>{STATUS[o.evaluation.status][0]}</span>
                                </div>
                              </span>
                              <span className={`big ${o.evaluation.slack_min < 0 ? 'late' : ''}`}>
                                {o.evaluation.slack_min < 0 ? '−' : '+'}
                                {Math.abs(o.evaluation.slack_min)}
                                <small>{o.evaluation.slack_min < 0 ? 'min late' : 'min spare'}</small>
                              </span>
                            </>
                          }
                        >
                          <Mx
                            cells={[
                              ['Arrive', clock(o.evaluation.eta_min).replace(' ', '')],
                              ['Miles', o.evaluation.miles.toFixed(0)],
                              ['CO₂', `${o.evaluation.co2_kg.toFixed(0)} kg`],
                              ['Cost', `$${o.evaluation.cost_usd.toFixed(0)}`],
                              ['Community', o.evaluation.community_score.toFixed(0)],
                            ]}
                          />
                          <div className="more">
                            <p>{o.description}</p>
                            {!o.feasible && o.infeasible_reason && <p className="badc">{o.infeasible_reason}</p>}
                            <ul>
                              {o.burdens.map((b, i) => (
                                <li key={i}>
                                  {b.text.toLowerCase().startsWith(STAKE[b.stakeholder].toLowerCase()) ? b.text : <><b>{STAKE[b.stakeholder]}:</b> {b.text}</>}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="acts">
                            <button className="btn ask" onClick={() => setExplainId(o.id)}>Explain this option</button>
                          </div>
                        </Acc>
                      ))}
                    </>
                  )}
                  {reasonFor && (
                    <form
                      className="alert warn"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const o = opts.options.find((x) => x.id === reasonFor);
                        if (o) void decide(o, reason);
                      }}
                    >
                      <label htmlFor="reason">
                        <b>Why this instead of the suggestion?</b>
                      </label>
                      <div className="send" style={{ padding: '.5rem 0 0' }}>
                        <input id="reason" autoFocus maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!reasonError} aria-describedby={reasonError ? 'reason-err' : undefined} />
                        <button className="btn pri" type="submit" disabled={busy}>Confirm</button>
                        <button className="btn" type="button" onClick={() => setReasonFor(null)}>Cancel</button>
                      </div>
                      {reasonError && (
                        <div id="reason-err" className="badc small" role="alert">
                          {reasonError}
                        </div>
                      )}
                    </form>
                  )}
                  <div style={{ marginTop: '1.2rem', display: 'flex', gap: '.8rem' }}>
                    <button className="btn pri lg" style={{ flex: 1 }} disabled={!pickedOpt || !pickedOpt.feasible || busy} onClick={() => pickedOpt && decide(pickedOpt)}>
                      {busy ? 'Recording…' : pickedOpt ? `Dispatch ${driverOf(row)}: ${pickedOpt.title}` : 'Choose a route'}
                    </button>
                    <button className="btn lg" onClick={() => toast('Held at the yard. Nothing was changed or sent.')}>Hold</button>
                  </div>
                </>
              )}
            </section>
          )}

          {view === 'prob' && (
            <section className="view on">
              <div className="scripted">Scripted example: trucks on the road are not computed by the backend.</div>
              <div className="ttl">
                {t.drv}{' '}
                <span className={`chip ${t.sit}`} style={{ fontSize: '.9rem', marginLeft: '.4rem' }}>{t.sitT}</span>
              </div>
              <div className="sub2">
                {t.id} · {t.cargo}
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
                    sel={probOpt === i}
                    onToggle={() => {
                      setProbOpt(i);
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
                      <div className="src">Goal: {OBJ[o.obj].toLowerCase()} · scripted example</div>
                    </div>
                    <div className="acts">
                      <button
                        className={`btn ${o.rec ? 'pri' : ''}`}
                        onClick={() => {
                          toast(`Scripted: option ${i + 1} sent to ${t.drv}`);
                          addDriverMsg({ kind: 'me', html: `Plan sent: ${esc(o.t)}`, time: '9:41 AM' });
                          setSideTab('chat');
                        }}
                      >
                        Send to {t.drv}
                      </button>
                      <button
                        className="btn ask"
                        onClick={() => {
                          setProbOpt(i);
                          setSideTab('explain');
                        }}
                      >
                        Explain this option
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
                  <h4>Roads · report and set your own status</h4>
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
                          {d ? (
                            <div className="seg3" role="group" aria-label={`Your call on ${pr.label}`}>
                              {(['unverified', 'confirmed', 'dismissed'] as const).map((v) => (
                                <button key={v} className={d.verification === v ? 'on' : ''} aria-pressed={d.verification === v} onClick={() => verdict(d.id, v)}>
                                  {VER[v]}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <button className="btn sm" onClick={() => run(() => createDisruption(pr.disruption), `${pr.label} reported (unverified)`)}>
                              Report
                            </button>
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
        {view === 'go' && (
          <div className="sidepane on">
            <div className="sidehd">
              <span className="t">Explain this option</span>
            </div>
            <div className="msgs">
              {!explainOpt ? (
                <div className="m sys">Press “Explain this option” on a route card to see why it scores as it does.</div>
              ) : (
                <div className="m ai">
                  <b>{explainOpt.title}</b>
                  <ul style={{ margin: '.4rem 0', paddingLeft: '1.1rem' }}>
                    {explain(explainOpt, opts?.rationale ?? '').map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                  <div className="srcline">{SCRIPTED_LINE}</div>
                </div>
              )}
            </div>
          </div>
        )}
        {view === 'prob' && (
          <div className="sidepane on">
            <div className="sidehd">
              <button className={sideTab === 'chat' ? 'on' : ''} onClick={() => setSideTab('chat')}>Driver chat</button>
              <button className={sideTab === 'explain' ? 'on' : ''} onClick={() => setSideTab('explain')}>Explain this option</button>
            </div>
            {sideTab === 'chat' ? (
              <div className="chat on">
                <Messages msgs={trMsgs} />
                <div className="quick">
                  {p.quick.map((q) => (
                    <button key={q} onClick={() => addDriverMsg({ kind: 'me', html: esc(q), time: '9:41 AM' })}>{q}</button>
                  ))}
                </div>
                <ChatInput onSend={(x) => addDriverMsg({ kind: 'me', html: esc(x), time: '9:41 AM' })} />
              </div>
            ) : (
              <div className="chat on">
                <div className="msgs">
                  {probOpt == null || !p.opts[probOpt] ? (
                    <div className="m sys">Press “Explain this option” on an option.</div>
                  ) : (
                    <div className="m ai">
                      <b>{p.opts[probOpt].t}</b>
                      <ul style={{ margin: '.4rem 0', paddingLeft: '1.1rem' }}>
                        <li>{p.opts[probOpt].s}</li>
                        {p.opts[probOpt].why.map((w, k) => (
                          <li key={k}>{w}</li>
                        ))}
                      </ul>
                      <div className="srcline">{SCRIPTED_LINE} Scripted example.</div>
                    </div>
                  )}
                </div>
              </div>
            )}
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
