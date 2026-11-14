// React port of the owner-supplied dispatcher-ui.html mockup.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DispatchMap, type View } from './DispatchMap';
import {
  DISPATCH, GOOD, INK, BAD, NOW, OBJ, ONROUTE, PROB, ROADS0, ROLE, SN, WH,
  clock, fatLbl, mets, summaryTags, winEnd,
  type Road, type RoadState, type Role, type Tag,
} from './data';
import './dispatch.css';

type MsgKind = 'me' | 'them' | 'ai' | 'sys';
interface Msg {
  kind: MsgKind;
  html: string;
  time?: string;
  src?: string;
}
const esc = (s: string) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

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
function Issues({ tags }: { tags: Tag[] }) {
  const w = tags.filter((t) => t[2] !== 'ok');
  return w.length ? (
    <Tags tags={w} />
  ) : (
    <div className="flags">
      <span className="tag ok">
        <i>All clear</i>
      </span>
    </div>
  );
}
const sg = (v: string) => (/^\+/.test(v) ? 'badc' : /^[−-]/.test(v) ? 'goodc' : '');
const cm = (n: number) => (n >= 90 ? 'goodc' : n < 80 ? 'badc' : '');
function Mx({ a, b, c, d, e, signed }: { a: string; b: string; c: string; d: string; e: string | number; signed?: boolean }) {
  const cell = (label: string, v: string, cls: string) => (
    <div>
      <span>{label}</span>
      <b className={cls}>{v}</b>
    </div>
  );
  return (
    <div className="mx">
      {cell('Arrive', a, signed ? sg(a) : '')}
      {cell('Miles', b, signed ? sg(b) : '')}
      {cell('CO₂', c, signed ? sg(c) : '')}
      {cell('Cost', d, signed ? sg(d) : '')}
      {cell('Community', String(e), cm(Number(e)))}
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
function SendBox({ placeholder, onSend }: { placeholder: string; onSend: (t: string) => void }) {
  const [v, setV] = useState('');
  const go = () => {
    if (v.trim()) onSend(v);
    setV('');
  };
  return (
    <div className="send">
      <input placeholder={placeholder} aria-label={placeholder} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
      <button className="btn pri" onClick={go}>
        Send
      </button>
    </div>
  );
}

/* ---------- canned assistant answers (mock) ---------- */
function routeAnswer(q: string, dId: string, role: Role): [string, string] {
  const d = DISPATCH.find((x) => x.id === dId)!;
  q = q.toLowerCase();
  const m = mets(d, role);
  const tags = summaryTags(d, role);
  const base = mets(d, 'eff');
  const rn = ROLE[role].n.toLowerCase();
  if (/why|chosen|pick|decid|how/.test(q))
    return [
      `${ROLE[role].goal} For ${d.drv}: ${m.mi.toFixed(0)} mi, ${m.min} min of driving (${m.min - base.min >= 0 ? '+' : ''}${m.min - base.min} min vs. fastest), ${m.co2.toFixed(0)} kg CO₂ (est.), ${m.local.toFixed(1)} mi on local streets.`,
      'OSM roads, Caltrans/CHP live, CO₂ estimate',
    ];
  if (/school|hospital|neighbo|communit|resident|home/.test(q))
    return [`The ${rn} route passes ${m.sch} school zone${m.sch === 1 ? '' : 's'} within 250 m (${m.schLocal} on local streets) and ${m.local.toFixed(1)} mi of local streets. Names are hidden in this mockup.`, 'OpenStreetMap places (simulated)'];
  if (/rain|weather|wet|storm|fog/.test(q)) return [`${tags[0][1]}.`, 'National Weather Service forecast'];
  if (/later|leave|depart|earlier|wait/.test(q))
    return [
      `Peak traffic eases after about 9:30 AM. Leaving 20 min later saves roughly 4 min of driving and still arrives ${winEnd(d) - (NOW + 35 + 20 + m.min) >= 0 ? 'inside' : 'outside'} the window (${clock(winEnd(d))}).`,
      'time-of-day traffic estimate',
    ];
  if (/traffic|incident|accident|crash|slow|closure|closed/.test(q)) return [`${tags[2][1]}. Your overrides on the map apply here too.`, 'Caltrans / CHP (live)'];
  if (/co2|green|emission|carbon/.test(q)) return [`Estimated ${m.co2.toFixed(0)} kg CO₂ (${m.mi.toFixed(0)} mi × 1.75 kg/mi). A rough estimate, not a measurement.`, 'CO₂ estimate'];
  return [`(Mock) I would answer “${esc(q)}” from road data, live incidents and weather for the ${rn} route.`, 'mock'];
}

function optionAnswer(q: string, probId: string, opt: number | null): [string, string] {
  const p = PROB[probId];
  const o = opt != null ? p.opts[opt] : null;
  q = q.toLowerCase();
  if (!o) return ['(Mock) Press “Ask AI about this” on an option first and I will answer from that option’s numbers and sources.', 'mock'];
  if (/why|picked|chosen|decid/.test(q)) return [`Option ${opt! + 1} optimizes <b>${OBJ[o.obj].toLowerCase()}</b>. ${esc(o.s)} ${esc(o.why.join(' '))}`, `${esc(p.src)}, estimates`];
  if (/school|neighbo|communit|resident/.test(q)) {
    const k = o.tags.find((x) => x[0] === 'Schools');
    return [`${esc(k ? k[1] : 'No school exposure listed')}. Community score ${o.comm}/100.`, 'OpenStreetMap places (simulated)'];
  }
  if (/rain|weather|wet/.test(q)) {
    const r = o.tags.find((x) => x[0] === 'Rain' || x[0] === 'Weather');
    return [r ? `${esc(r[1])}.` : 'No weather impact expected on this option.', 'National Weather Service forecast'];
  }
  if (/refus|won.?t|decline/.test(q)) return ['The driver can decline any option; nothing is final until they confirm in chat. The other two options remain available.', 'mock'];
  if (/co2|emission|green/.test(q)) return [`Estimated change in CO₂: ${esc(o.co2)} (estimate, not measured).`, 'CO₂ estimate'];
  return [`(Mock) I would answer “${esc(q)}” from the option’s data and live feeds.`, 'mock'];
}

/* ---------- app ---------- */
export default function DispatchApp() {
  const [view, setView] = useState<View>('map');
  const [goId, setGoId] = useState('T-21');
  const [goRole, setGoRole] = useState<Role>('eff');
  const [goOpen, setGoOpen] = useState<Role | null>('eff');
  const [probId, setProbId] = useState('T-11');
  const [probOpt, setProbOpt] = useState<number | null>(null);
  const [probOpen, setProbOpen] = useState<number | null>(null);
  const [roads, setRoads] = useState<Road[]>(ROADS0);
  const [legendOpen, setLegendOpen] = useState(false);
  const [toastText, setToastText] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const [aiCtx, setAiCtx] = useState<Role | null>(null);
  const [aiMsgs, setAiMsgs] = useState<Msg[]>([{ kind: 'ai', html: 'Three routes for each truck, and all three arrive in time for T-21. Open one, or press <b>Ask AI</b> to question it.' }]);
  const [sideTab, setSideTab] = useState<'chat' | 'ai'>('chat');
  const [driverMsgs, setDriverMsgs] = useState<Record<string, Msg[]>>({});
  const [dAiMsgs, setDAiMsgs] = useState<Msg[]>([]);

  const toast = (t: string) => {
    setToastText(t);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastText(''), 2400);
  };

  const d = DISPATCH.find((x) => x.id === goId)!;
  const t = ONROUTE.find((x) => x.id === probId)!;
  const p = PROB[probId];
  const problems = ONROUTE.filter((x) => x.prob).length;

  // Driver chat history: seeded from the mockup's transcript the first time a truck is opened.
  const trMsgs: Msg[] = driverMsgs[probId] ?? p.chat.map(([kind, time, text]) => ({ kind, html: esc(text), time: `${time} AM` }));
  const addDriverMsg = (m: Msg) => setDriverMsgs((all) => ({ ...all, [probId]: [...(all[probId] ?? trMsgs), m] }));

  useEffect(() => {
    setDAiMsgs([{ kind: 'ai', html: p.opts.length ? 'Ask about any option: why it was picked, schools, rain, traffic or CO₂.' : `Ask about ${t.drv.split(' ')[0]}’s current route.` }]);
    setProbOpt(null);
    setProbOpen(null);
  }, [probId, p.opts.length, t.drv]);

  const pickGo = (id: string) => {
    setGoId(id);
    setGoRole('eff');
    setGoOpen('eff');
    setAiCtx(null);
    setView('go');
  };
  const pickProb = (id: string) => {
    setProbId(id);
    setView('prob');
  };

  const setRoad = (id: string, st: RoadState, note: string) => {
    setRoads((rs) =>
      rs.map((r) => (r.id === id ? { ...r, st, note, ov: st === r.st0 && !note ? '' : `now ${SN[st]}${note ? ` · “${note}”` : ''} · 9:41 AM` } : r)),
    );
  };

  const aiSend = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setAiMsgs((m) => [...m, { kind: 'me', html: esc(q) }]);
    window.setTimeout(() => {
      if (aiCtx) {
        const [a, s] = routeAnswer(q, goId, aiCtx);
        setAiMsgs((m) => [...m, { kind: 'ai', html: a, src: s }]);
      } else {
        setAiMsgs((m) => [...m, { kind: 'ai', html: `(Mock) I would re-run the three routes with “${esc(q)}” and show new numbers. Tip: press “Ask AI” on a route to question it directly.` }]);
      }
    }, 600);
  };
  const askAbout = (role: Role) => {
    setAiCtx(role);
    setGoRole(role);
    setGoOpen(role);
    setAiMsgs((m) => [...m, { kind: 'sys', html: `Asking about the ${ROLE[role].n.toLowerCase()} route` }]);
    window.setTimeout(() => document.getElementById('aiIn')?.focus(), 0);
  };
  const dSend = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setDAiMsgs((m) => [...m, { kind: 'me', html: esc(q) }]);
    window.setTimeout(() => {
      const [a, s] = optionAnswer(q, probId, probOpt);
      setDAiMsgs((m) => [...m, { kind: 'ai', html: a, src: s }]);
    }, 600);
  };

  const [fl, fc] = fatLbl(d.fat);
  const base = mets(d, 'eff');
  const cls = `dapp ${view === 'map' ? 'home' : 'work'} ${view === 'net' ? 'net' : ''}`;

  return (
    <div className={cls}>
      <div className="top">
        <span className="brand">Dispatch</span>
        <span className="mock">MOCKUP</span>
        <nav className="nav" aria-label="Views">
          <button className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>Map</button>
          <button className={view === 'go' ? 'on' : ''} onClick={() => setView('go')}>
            To dispatch<span className="n">{DISPATCH.length}</span>
          </button>
          <button className={view === 'prob' ? 'on' : ''} onClick={() => setView('prob')}>
            On route<span className="n alert">{problems}</span>
          </button>
          <button className={view === 'net' ? 'on' : ''} onClick={() => setView('net')}>Network</button>
        </nav>
        <span className="clock">SAT {clock(NOW)}</span>
      </div>

      <div id="mapwrap">
        <DispatchMap
          view={view}
          goId={goId}
          goRole={goRole}
          probId={probId}
          roads={roads}
          onRoad={(id, st, note) => {
            setRoad(id, st, note);
            toast('Override applied (mock): trucks on this road would be re-checked');
          }}
          onPickGo={pickGo}
          onPickProb={pickProb}
          onReroute={() => {
            toast('Mock: would open reroute options for trucks on this road');
            setView('prob');
          }}
        />
        <button id="expand" onClick={() => setView('map')}>Expand map</button>
        <div className={`legend ${legendOpen ? 'open' : ''}`}>
          <button className="lt" aria-expanded={legendOpen} onClick={() => setLegendOpen((o) => !o)}>
            Legend {legendOpen ? '−' : '+'}
          </button>
          <div className="lb">
            <h5>Roads</h5>
            <div><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke={GOOD} strokeWidth="4" /></svg>Open</div>
            <div><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke={BAD} strokeWidth="4" strokeDasharray="7 4" /></svg>Slowed</div>
            <div><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke={BAD} strokeWidth="7" /><line x1="0" y1="4" x2="30" y2="4" stroke="#fff" strokeWidth="2" strokeDasharray="4 4" /></svg>Closed</div>
            <h5>Routes</h5>
            <div><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke={INK} strokeWidth="3" /></svg>Efficiency</div>
            <div><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke={INK} strokeWidth="3" strokeDasharray="6 4" /></svg>Sustainability</div>
            <div><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke={INK} strokeWidth="3" strokeDasharray="1 4" strokeLinecap="round" /></svg>Community</div>
            <h5>Trucks</h5>
            <div><svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="#fff" stroke={GOOD} strokeWidth="3" /></svg>On track</div>
            <div><svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="#fff" stroke={BAD} strokeWidth="3" /></svg>Slowed</div>
            <div><svg width="16" height="16"><circle cx="8" cy="8" r="7" fill={BAD} /></svg>Needs decision</div>
            <div><svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="#fff" stroke="#555" strokeWidth="2" strokeDasharray="3 2" /></svg>Waiting</div>
          </div>
        </div>
      </div>

      <div id="work">
        <div className="col list">
          <div className="pick">
            {view === 'go' &&
              DISPATCH.map((x) => (
                <button key={x.id} className={x.id === goId ? 'on' : ''} onClick={() => pickGo(x.id)}>
                  <span className="id">{x.id}</span>
                  <span className="nm">
                    <b>{x.drv}</b>
                    <div className="sub">
                      {WH[x.pair.split('>')[1]].n}
                      {x.pri ? ' · priority' : ''}
                    </div>
                    <div className="sub" style={{ fontFamily: 'var(--mono)' }}>by {clock(winEnd(x))}</div>
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
          {view === 'go' && (
            <section className="view on">
              <div className="ttl">
                {d.drv} → {WH[d.pair.split('>')[1]].n}
              </div>
              <div className="sub2">
                {d.id} · {d.ctn} {d.cargo} · arrive by <b>{clock(winEnd(d))}</b> · fatigue <b style={{ color: fc }}>{fl.toLowerCase()}</b>
              </div>
              {(['eff', 'sus', 'com'] as Role[]).map((role) => {
                const m = mets(d, role);
                const eta = NOW + 35 + m.min;
                const sl = winEnd(d) - eta;
                const late = sl < 0;
                const df = (a: number, b: number, u: string, n = 0) => {
                  const x = a - b;
                  return Math.abs(x) < 0.05 ? 'same' : `${x > 0 ? '+' : '−'}${Math.abs(x).toFixed(n)}${u}`;
                };
                return (
                  <Acc
                    key={role}
                    open={goOpen === role}
                    sel={goRole === role}
                    onToggle={() => {
                      setGoRole(role);
                      setGoOpen(goOpen === role ? null : role);
                    }}
                    head={
                      <>
                        <span className={`sw ${role}`} />
                        <span className="left">
                          <span className="at">{ROLE[role].n}</span>
                          <div className="am">
                            {clock(eta)} · {m.mi.toFixed(0)} mi · {m.co2.toFixed(0)} kg CO₂
                          </div>
                        </span>
                        <span className={`big ${late ? 'late' : ''}`}>
                          {late ? '−' : '+'}
                          {Math.abs(Math.round(sl))}
                          <small>{late ? 'min late' : 'min spare'}</small>
                        </span>
                      </>
                    }
                  >
                    <Mx a={clock(eta).replace(' ', '')} b={m.mi.toFixed(0)} c={`${m.co2.toFixed(0)} kg`} d={`$${m.cost.toFixed(0)}`} e={m.comm} />
                    <Issues tags={summaryTags(d, role)} />
                    <div className="more">
                      <p>{ROLE[role].goal}</p>
                      <p className="mute small">{m.roads}</p>
                      <table>
                        <thead>
                          <tr><th>Factor</th><th>This</th><th>Fastest</th><th>Diff</th></tr>
                        </thead>
                        <tbody>
                          <tr><td>Drive time</td><td>{m.min} min</td><td>{base.min} min</td><td>{df(m.min, base.min, ' min')}</td></tr>
                          <tr><td>Miles</td><td>{m.mi.toFixed(0)}</td><td>{base.mi.toFixed(0)}</td><td>{df(m.mi, base.mi, ' mi')}</td></tr>
                          <tr><td>CO₂ (est.)</td><td>{m.co2.toFixed(0)} kg</td><td>{base.co2.toFixed(0)} kg</td><td>{df(m.co2, base.co2, ' kg')}</td></tr>
                          <tr><td>Local-street miles</td><td>{m.local.toFixed(1)}</td><td>{base.local.toFixed(1)}</td><td>{df(m.local, base.local, ' mi', 1)}</td></tr>
                          <tr><td>School zones (250 m)</td><td>{m.sch}</td><td>{base.sch}</td><td>{df(m.sch, base.sch, '')}</td></tr>
                        </tbody>
                      </table>
                      <div className="src">Roads: OpenStreetMap · Incidents: live · Traffic, CO₂: estimates · Rain: NWS</div>
                    </div>
                    <div className="acts">
                      <button className="btn ask" onClick={() => askAbout(role)}>Ask AI about this route</button>
                    </div>
                  </Acc>
                );
              })}
              <div style={{ marginTop: '1.2rem', display: 'flex', gap: '.8rem' }}>
                <button className="btn pri lg" style={{ flex: 1 }} onClick={() => toast(`Mock: ${d.drv} dispatched on the ${ROLE[goRole].n.toLowerCase()} route`)}>
                  Dispatch {d.drv.split(' ')[0]} on the {ROLE[goRole].n.toLowerCase()} route
                </button>
                <button className="btn lg" onClick={() => toast(`Mock: ${d.drv.split(' ')[0]} held at the yard`)}>Hold</button>
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
                            <span className="chip">{OBJ[o.obj]}</span>
                            {o.rec && (
                              <>
                                {' '}
                                <span className="chip good">Suggested</span>
                              </>
                            )}
                          </div>
                        </span>
                        <span className={`big ${/^\+/.test(o.eta) ? 'neg' : ''}`}>
                          {o.eta.replace(' min', '')}
                          <small>{/min/.test(o.eta) ? 'min added' : 'when'}</small>
                        </span>
                      </>
                    }
                  >
                    <Mx a={o.eta} b={o.mi} c={o.co2} d={o.cost} e={o.comm} signed />
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
                      <div className="src">
                        Goal: {OBJ[o.obj].toLowerCase()} · estimates · {p.src}
                      </div>
                    </div>
                    <div className="acts">
                      <button
                        className={`btn ${o.rec ? 'pri' : ''}`}
                        onClick={() => {
                          toast(`Mock: option ${i + 1} sent to ${t.drv}`);
                          addDriverMsg({ kind: 'me', html: `Plan sent: ${esc(o.t)}`, time: '9:41 AM' });
                          setSideTab('chat');
                        }}
                      >
                        Send to {t.drv.split(' ')[0]}
                      </button>
                      <button
                        className="btn ask"
                        onClick={() => {
                          setProbOpt(i);
                          setSideTab('ai');
                          window.setTimeout(() => document.getElementById('dAiIn')?.focus(), 0);
                        }}
                      >
                        Ask AI about this
                      </button>
                    </div>
                  </Acc>
                ))
              )}
            </section>
          )}

          {view === 'net' && (
            <section className="view on">
              <div className="two">
                <div>
                  <h4>Warehouses</h4>
                  {Object.values(WH).map((w) => {
                    const u = w.used / w.cap;
                    return (
                      <div key={w.n} className="row1">
                        <div className="nm">
                          <b>{w.n}</b>
                          <div className="sub">
                            {w.used}/{w.cap} slots · closes {w.closes}
                            {w.back ? ` · ${w.back}` : ''}
                          </div>
                          <div className="bar" style={{ marginTop: '.4rem' }}>
                            <i style={{ width: `${u * 100}%`, background: u < 0.7 ? GOOD : u < 0.9 ? INK : BAD }} />
                          </div>
                        </div>
                        <span className={`chip ${w.c}`}>{w.state}</span>
                      </div>
                    );
                  })}
                </div>
                <div>
                  <h4>Roads · set your own status</h4>
                  {roads.map((r) => (
                    <div key={r.id} className="row1">
                      <div className="nm">
                        <b>{r.n}</b>
                        <div className="sub">
                          {r.detail} · {r.src}
                        </div>
                        {r.ov && (
                          <div style={{ marginTop: '.2rem' }}>
                            <span className="badge-o">Override</span>{' '}
                            <a
                              href="#"
                              className="small"
                              onClick={(e) => {
                                e.preventDefault();
                                setRoad(r.id, r.st0, '');
                              }}
                            >
                              undo
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="seg3" role="group" aria-label={`Status of ${r.n}`}>
                        {(['open', 'slowed', 'closed'] as RoadState[]).map((s) => (
                          <button
                            key={s}
                            className={r.st === s ? 'on' : ''}
                            aria-pressed={r.st === s}
                            onClick={() => {
                              setRoad(r.id, s, '');
                              toast(`${SN[s]}: override applied (mock)`);
                            }}
                          >
                            {SN[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
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
              <span className="t">Assistant</span>
            </div>
            <Messages msgs={aiMsgs} />
            {aiCtx && (
              <div className="ctx on">
                Asking about: {ROLE[aiCtx].n} route, {d.drv}
                <a onClick={() => setAiCtx(null)} role="button" tabIndex={0}>clear</a>
              </div>
            )}
            <div className="quick">
              {(aiCtx ? ['Why was this route picked?', 'Which schools does it pass?', 'Will rain slow it down?', 'Leave 20 min later?'] : ['Make it greener', 'Avoid school zones', 'Need it 30 min faster']).map((q) => (
                <button key={q} onClick={() => aiSend(q)}>{q}</button>
              ))}
            </div>
            <div className="send">
              <AiInput id="aiIn" placeholder="Ask about a route or request a change" onSend={aiSend} />
            </div>
          </div>
        )}
        {view === 'prob' && (
          <div className="sidepane on">
            <div className="sidehd">
              <button className={sideTab === 'chat' ? 'on' : ''} onClick={() => setSideTab('chat')}>Driver chat</button>
              <button className={sideTab === 'ai' ? 'on' : ''} onClick={() => setSideTab('ai')}>Ask AI</button>
            </div>
            {sideTab === 'chat' ? (
              <div className="chat on">
                <Messages msgs={trMsgs} />
                <div className="quick">
                  {p.quick.map((q) => (
                    <button key={q} onClick={() => addDriverMsg({ kind: 'me', html: esc(q), time: '9:41 AM' })}>{q}</button>
                  ))}
                </div>
                <SendBox placeholder="Message the driver" onSend={(x) => addDriverMsg({ kind: 'me', html: esc(x.trim()), time: '9:41 AM' })} />
              </div>
            ) : (
              <div className="chat on">
                <Messages msgs={dAiMsgs} />
                {probOpt != null && p.opts[probOpt] && (
                  <div className="ctx on">
                    Asking about option {probOpt + 1}: {p.opts[probOpt].t}
                    <a onClick={() => setProbOpt(null)} role="button" tabIndex={0}>clear</a>
                  </div>
                )}
                <div className="quick">
                  {['Why was this picked?', 'Which schools?', 'Will rain slow it down?', 'What if the driver refuses?'].map((q) => (
                    <button key={q} onClick={() => dSend(q)}>{q}</button>
                  ))}
                </div>
                <div className="send">
                  <AiInput id="dAiIn" placeholder="e.g. Which schools does option 2 pass?" onSend={dSend} />
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

function AiInput({ id, placeholder, onSend }: { id: string; placeholder: string; onSend: (t: string) => void }) {
  const [v, setV] = useState('');
  const go = () => {
    onSend(v);
    setV('');
  };
  return (
    <>
      <input id={id} placeholder={placeholder} aria-label={placeholder} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
      <button className="btn pri" onClick={go}>Send</button>
    </>
  );
}
