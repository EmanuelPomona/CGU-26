import L from 'leaflet';
import { useEffect, useRef } from 'react';
import {
  BAD, DISPATCH, GOOD, INK, ONROUTE, PROB, R, ROADSTYLE, ROLE, ROUTES, SCHIP, SN, TERM, WH, fatLbl,
  type DispatchTruck, type Pair, type Road, type RoadState, type Role, type RouteTruck,
} from './data';

export type View = 'map' | 'go' | 'prob' | 'net';

const HOME = { c: [33.93, -118.03] as [number, number], z: 10 };
const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const tipRow = (a: string, b: string) => `<div class="row"><span>${a}</span><b>${b}</b></div>`;
const rchip = (r: Road) => `<span class="chip ${SCHIP[r.st]}">${SN[r.st]}</span>`;
const slice = <T,>(p: T[], a: number, b: number) => p.slice(Math.floor(a * p.length), Math.ceil(b * p.length));

function roadTip(r: Road) {
  return `<div class="tip"><div class="th">${esc(r.n)} ${rchip(r)}</div><div>${esc(r.detail)}</div>${tipRow('Source', esc(r.src))}${
    r.ov ? `<div style="margin-top:.3rem"><span class="badge-o">Your override</span> ${esc(r.ov)}</div>` : ''
  }<div class="mute small" style="margin-top:.3rem">Click to override</div></div>`;
}
function roadPop(r: Road, pick: RoadState) {
  const b = (s: RoadState) => `<button class="${pick === s ? 'on' : ''}" data-pick="${s}">${SN[s]}</button>`;
  return `<div class="pop" style="min-width:15rem"><b>${esc(r.n)}</b><div class="small mute">Feed says: ${SN[r.st0]} · ${esc(r.src)}</div><label>Your call</label><div class="seg3">${b('open')}${b('slowed')}${b('closed')}</div><label>Why (shared with team)</label><input type="text" class="note" placeholder="e.g. Driver says lane is clear" value="${esc(r.note)}"><div style="margin-top:.6rem;display:flex;gap:.4rem"><button class="btn pri sm" data-apply="1">Apply override</button><button class="btn sm" data-reroute="1">Reroute trucks</button></div>${
    r.ov ? `<div style="margin-top:.5rem"><span class="badge-o">Overridden</span> <a href="#" data-clear="1">undo</a></div>` : ''
  }</div>`;
}
function truckTipWaiting(t: DispatchTruck) {
  const [fl, fc] = fatLbl(t.fat);
  return `<div class="tip"><div class="th">${esc(t.drv)} <span class="chip soft">Waiting</span></div>${tipRow('Truck', t.id)}${tipRow('Cargo', `${t.ctn} · ${esc(t.cargo)}`)}${tipRow(
    'Driver fatigue',
    `<span style="color:${fc}">${fl} · ${t.fat}%</span>`,
  )}<div class="bar" style="margin:.2rem 0 .4rem"><i style="width:${t.fat}%;background:${fc}"></i></div></div>`;
}
function truckTipRoute(t: RouteTruck) {
  const [fl, fc] = fatLbl(t.fat);
  const d = t.delta;
  return `<div class="tip"><div class="th">${esc(t.drv)} <span class="chip ${t.sit}">${t.sitT}</span></div>${tipRow('Truck', t.id)}${tipRow(
    'On time',
    `<span class="${d >= 0 ? 'goodc' : 'badc'}">${d >= 0 ? `+${d} min ahead` : `−${Math.abs(d)} min late`}</span>`,
  )}${tipRow('Driver fatigue', `<span style="color:${fc}">${fl} · ${t.fat}%</span>`)}<div class="bar" style="margin:.2rem 0 .4rem"><i style="width:${t.fat}%;background:${fc}"></i></div>${tipRow(
    'Driven today',
    `${t.driven} of 11h`,
  )}${tipRow('Next', esc(t.next))}${t.wants ? `<div class="badge-o" style="margin-top:.3rem">${esc(t.wants)}</div>` : ''}<div class="mute small" style="margin-top:.3rem">Click for details</div></div>`;
}
const tkIcon = (label: string, cls: string) =>
  L.divIcon({ className: '', html: `<div class="tk ${cls}">${label}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] });

interface Props {
  view: View;
  goId: string;
  goRole: Role;
  probId: string;
  roads: Road[];
  onRoad: (id: string, st: RoadState, note: string) => void;
  onPickGo: (id: string) => void;
  onPickProb: (id: string) => void;
  onReroute: () => void;
}

export function DispatchMap(p: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const gRoad = useRef<L.LayerGroup | null>(null);
  const gCand = useRef<L.LayerGroup | null>(null);
  const cb = useRef(p);
  useEffect(() => {
    cb.current = p;
  });

  // Create the map, static layers and trucks once.
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true }).setView(HOME.c, HOME.z);
    const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';
    L.tileLayer(`${esri}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
      attribution: 'Tiles © Esri, HERE, Garmin, OpenStreetMap contributors',
      maxZoom: 16,
    }).addTo(m);
    L.tileLayer(`${esri}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16, opacity: 0.9 }).addTo(m);
    const gBase = L.layerGroup().addTo(m);
    gRoad.current = L.layerGroup().addTo(m);
    gCand.current = L.layerGroup().addTo(m);
    const gTr = L.layerGroup().addTo(m);
    const gFix = L.layerGroup().addTo(m);

    for (const k of Object.keys(ROUTES) as Pair[]) {
      L.polyline(R(k), { color: '#b5b5b5', weight: 2, opacity: 0.8, interactive: false }).addTo(gBase);
    }
    for (const t of Object.values(TERM)) {
      L.marker(t.p, {
        icon: L.divIcon({
          className: '',
          html: '<div style="width:20px;height:20px;background:#0a0a0a;color:#fff;font:600 10px/20px IBM Plex Mono,monospace;text-align:center;border:2px solid #fff;box-shadow:0 0 0 1px #0a0a0a">P</div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      })
        .bindTooltip(`<div class="tip"><div class="th">${t.n}</div>${tipRow('Gate', 'Open 24h')}${tipRow('Containers ready', '38')}</div>`, { className: 'card-tip' })
        .addTo(gFix);
    }
    for (const w of Object.values(WH)) {
      const u = w.used / w.cap;
      const fill = u < 0.7 ? GOOD : u < 0.9 ? '#ffffff' : BAD;
      L.circleMarker(w.p, { radius: 8 + w.cap / 9, color: INK, weight: 2, fillColor: fill, fillOpacity: 1 })
        .bindTooltip(
          `<div class="tip"><div class="th">${w.n}</div>${tipRow('Capacity used', `${w.used} / ${w.cap}`)}<div class="bar" style="margin:.2rem 0 .4rem"><i style="width:${u * 100}%;background:${
            u < 0.7 ? GOOD : u < 0.9 ? INK : BAD
          }"></i></div>${tipRow('Closes', w.closes)}${w.back ? tipRow('Coming back', w.back) : ''}${tipRow('Now', w.state)}</div>`,
          { className: 'card-tip' },
        )
        .addTo(gFix);
    }

    const yard: Record<string, [number, number]> = { POLA: [33.7605, -118.2905], POLB: [33.7715, -118.2045] };
    DISPATCH.forEach((t, i) => {
      const base = yard[t.pair.split('>')[0]];
      const pos: [number, number] = [base[0] + (i % 3) * 0.0085, base[1] + (i % 3) * 0.0085 * (base[1] < -118.25 ? -1 : 1) + (i > 2 ? 0.012 : 0)];
      L.marker(pos, { icon: tkIcon(t.id.slice(2), 'hollow') })
        .bindTooltip(truckTipWaiting(t), { className: 'card-tip', direction: 'right' })
        .on('click', () => cb.current.onPickGo(t.id))
        .addTo(gTr);
    });
    ONROUTE.forEach((t) => {
      const pts = R(t.pair);
      const pos = pts[Math.floor(t.f * (pts.length - 1))];
      L.marker(pos, { icon: tkIcon(t.id.slice(2), t.sit === 'ok' ? '' : t.sit) })
        .bindTooltip(truckTipRoute(t), { className: 'card-tip', direction: 'right' })
        .on('click', () => cb.current.onPickProb(t.id))
        .addTo(gTr);
    });

    map.current = m;
    let t: number | undefined;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(() => fit(), 120);
    });
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      gRoad.current = null;
      gCand.current = null;
    };
  }, []);

  // Road segments with status styling, hover card and override popup.
  useEffect(() => {
    const g = gRoad.current;
    if (!g) return;
    g.clearLayers();
    for (const r of p.roads) {
      const pts = slice(R(r.pair), r.a, r.b);
      L.polyline(pts, r.ov ? { color: INK, weight: 16, opacity: 0.22, dashArray: '2 5', interactive: false } : { color: '#fff', weight: 11, opacity: 0.9, interactive: false }).addTo(g);
      const line = L.polyline(pts, { ...ROADSTYLE[r.st], opacity: 1, lineCap: 'butt' }).addTo(g);
      L.polyline(pts, { color: '#fff', weight: 2.5, dashArray: '6 8', opacity: r.st === 'closed' ? 1 : 0, interactive: false }).addTo(g);
      line.bindTooltip(roadTip(r), { className: 'card-tip', sticky: true });
      let pick: RoadState = r.st;
      line.bindPopup(roadPop(r, pick), { closeButton: true });
      line.on('popupopen', (e: L.PopupEvent) => {
        const root = e.popup.getElement();
        if (!root) return;
        root.onclick = (ev) => {
          const t = ev.target as HTMLElement;
          if (t.dataset.pick) {
            pick = t.dataset.pick as RoadState;
            root.querySelectorAll('[data-pick]').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.pick === pick));
          } else if (t.dataset.apply) {
            const note = (root.querySelector('input.note') as HTMLInputElement | null)?.value ?? '';
            map.current?.closePopup();
            cb.current.onRoad(r.id, pick, note);
          } else if (t.dataset.clear) {
            ev.preventDefault();
            map.current?.closePopup();
            cb.current.onRoad(r.id, r.st0, '');
          } else if (t.dataset.reroute) {
            map.current?.closePopup();
            cb.current.onReroute();
          }
        };
      });
    }
  }, [p.roads]);

  // Candidate routes for the open view, and fitting the map to them.
  function fit() {
    const m = map.current;
    const g = gCand.current;
    if (!m || !g) return;
    const { view, goId, goRole, probId } = cb.current;
    m.invalidateSize();
    g.clearLayers();
    if (view === 'go') {
      const d = DISPATCH.find((x) => x.id === goId)!;
      for (const role of ['com', 'sus', 'eff'] as Role[]) {
        const on = role === goRole;
        L.polyline(R(d.pair, role), { color: '#fff', weight: on ? 11 : 7, opacity: 0.9, interactive: false }).addTo(g);
        L.polyline(R(d.pair, role), {
          color: INK,
          weight: on ? 6 : 3,
          opacity: on ? 1 : 0.55,
          dashArray: ROLE[role].dash ?? undefined,
          lineCap: role === 'com' ? 'round' : 'butt',
          interactive: false,
        }).addTo(g);
      }
      const w = WH[d.pair.split('>')[1]];
      L.circleMarker(w.p, { radius: 18, color: INK, weight: 2, fill: false, dashArray: '3 4' }).addTo(g);
      m.fitBounds(L.latLngBounds(R(d.pair, 'eff')), { padding: [25, 25], maxZoom: 11, animate: false });
    } else if (view === 'prob') {
      const t = ONROUTE.find((x) => x.id === probId)!;
      const has = PROB[t.id].opts.length > 0;
      L.polyline(R(t.pair, 'eff'), { color: '#fff', weight: 10, opacity: 0.9, interactive: false }).addTo(g);
      L.polyline(R(t.pair, 'eff'), { color: INK, weight: 5, interactive: false }).addTo(g);
      if (has) L.polyline(R(t.pair, 'sus'), { color: INK, weight: 4, dashArray: '10 8' }).bindTooltip('Reroute option').addTo(g);
      const pts = R(t.pair);
      L.circleMarker(pts[Math.floor(t.f * (pts.length - 1))], { radius: 18, color: has ? BAD : GOOD, weight: 3, fill: false }).addTo(g);
      m.fitBounds(L.latLngBounds(R(t.pair, 'eff')), { padding: [25, 25], maxZoom: 11, animate: false });
    } else if (view === 'map') {
      m.setView(HOME.c, HOME.z);
    } else {
      m.setView(HOME.c, 9);
    }
  }

  useEffect(() => {
    const id = window.setTimeout(fit, 340);
    return () => window.clearTimeout(id);
  }, [p.view, p.goId, p.goRole, p.probId]);

  return <div id="map" ref={el} role="region" aria-label="Map of trucks, routes and roads" />;
}
