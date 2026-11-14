// Dispatch map. Wired layers (terminals, warehouses, trucks, routes, conditions, role routes) come from the
// backend; the On route view's trucks are the scripted example and are drawn only in that view.
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import type { Board, Disruption, Network, OptionsResponse, ShipmentRow } from '../api/types';
import { BAD, BLUEPRINT, GOOD, INK, ONROUTE, PROB, R, ROLE, ROLE_ORDER, fatLbl, type RoleKey, type RouteTruck } from './data';

export type View = 'map' | 'go' | 'prob' | 'net';
export type Verdict = 'confirmed' | 'dismissed' | 'unverified' | 'delete';

const HOME = { c: [33.93, -118.03] as [number, number], z: 10 };
const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const tipRow = (a: string, b: string) => `<div class="row"><span>${a}</span><b>${b}</b></div>`;
const clock = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  return `${h % 12 || 12}:${String(Math.round(m) % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const STATUS = { on_time: ['On time', 'ok'], tight: ['Tight', 'warn'], at_risk: ['At risk', 'bad'] } as const;
const SOURCE = { simulated: 'Simulated what-if', dispatcher: 'Entered by dispatcher', public_feed: 'Public feed' } as const;
const VER = { unverified: 'Unverified report', confirmed: 'Confirmed', dismissed: 'Dismissed' } as const;

/** Route style per shipment status, in the mockup's road vocabulary (solid green, dashed, heavy red). */
const ROUTE_STYLE = {
  on_time: { color: GOOD, weight: 4, dashArray: undefined },
  tight: { color: INK, weight: 4, dashArray: '12 7' },
  at_risk: { color: BAD, weight: 6, dashArray: undefined },
} as const;

function conditionTip(d: Disruption) {
  return `<div class="tip"><div class="th">${esc(d.label)} <span class="chip ${d.verification === 'confirmed' ? 'bad' : 'soft'}">${VER[d.verification]}</span></div>${tipRow(
    'Source',
    SOURCE[d.source],
  )}${tipRow('Confidence', `${Math.round(d.confidence * 100)}%`)}${tipRow('Affects', esc(d.affected_shipment_ids.join(', ') || 'no shipment'))}<div class="mute small" style="margin-top:.3rem">Click to set your call</div></div>`;
}
function conditionPop(d: Disruption) {
  const b = (v: Verdict, label: string, on: boolean) => `<button class="${on ? 'on' : ''}" data-verdict="${v}">${label}</button>`;
  return `<div class="pop" style="min-width:16rem"><b>${esc(d.label)}</b><div class="small mute">${SOURCE[d.source]} · ${VER[d.verification]}</div><label>Your call</label><div class="seg3">${b(
    'confirmed',
    'Confirmed',
    d.verification === 'confirmed',
  )}${b('dismissed', 'Road is open', d.verification === 'dismissed')}${b('unverified', 'Unverified', d.verification === 'unverified')}</div><div style="margin-top:.6rem"><a href="#" data-verdict="delete">Remove this report</a></div></div>`;
}
function truckTip(id: string, label: string, hours: number, row: ShipmentRow | undefined) {
  if (!row) {
    return `<div class="tip"><div class="th">${esc(label)} <span class="chip soft">Spare</span></div>${tipRow('Truck', id)}${tipRow('Hours left', `${hours} h`)}</div>`;
  }
  const e = row.current;
  const [word, cls] = STATUS[e.status];
  return `<div class="tip"><div class="th">${esc(label)} <span class="chip ${cls}">${word}</span></div>${tipRow('Truck', id)}${tipRow('Container', `${row.id} · ${esc(row.cargo)}`)}${tipRow(
    'Arrival (est.)',
    `${clock(e.eta_min)}, window ${clock(e.appt_start_min)} to ${clock(e.appt_end_min)}`,
  )}${tipRow('Slack', `<span class="${e.slack_min >= 0 ? 'goodc' : 'badc'}">${e.slack_min >= 0 ? '+' : '−'}${Math.abs(e.slack_min)} min</span>`)}${tipRow('Hours left', `${hours} h`)}${
    e.needs_review ? '<div class="badge-o" style="margin-top:.3rem">Depends on an unverified report</div>' : ''
  }<div class="mute small" style="margin-top:.3rem">Click for route options</div></div>`;
}
function scriptedTip(t: RouteTruck) {
  const [fl, fc] = fatLbl(t.fat);
  return `<div class="tip"><div class="th">${t.drv} <span class="chip ${t.sit}">${t.sitT}</span></div>${tipRow('Truck', t.id)}${tipRow(
    'Driver fatigue',
    `<span style="color:${fc}">${fl} · ${t.fat}%</span>`,
  )}${tipRow('Next', esc(t.next))}<div class="mute small" style="margin-top:.3rem">Scripted example</div></div>`;
}
const tkIcon = (label: string, cls: string) => L.divIcon({ className: '', html: `<div class="tk ${cls}">${label}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] });

interface Props {
  view: View;
  board: Board | null;
  network: Network | null;
  selectedId: string | null;
  focusRole: RoleKey;
  options: OptionsResponse | null;
  probId: string;
  onSelect: (shipmentId: string) => void;
  onPickProb: (id: string) => void;
  onVerdict: (disruptionId: string, v: Verdict) => void;
}

export function DispatchMap(p: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const groups = useRef<Record<string, L.LayerGroup>>({});
  const cb = useRef(p);
  useEffect(() => {
    cb.current = p;
  });

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true }).setView(HOME.c, HOME.z);
    const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';
    L.tileLayer(`${esri}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
      attribution: 'Tiles © Esri, HERE, Garmin, OpenStreetMap contributors',
      maxZoom: 16,
    }).addTo(m);
    L.tileLayer(`${esri}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16, opacity: 0.9 }).addTo(m);
    for (const k of ['routes', 'cond', 'cand', 'trucks', 'fix', 'scripted']) groups.current[k] = L.layerGroup().addTo(m);
    map.current = m;
    let t: number | undefined;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(() => fitRef.current(), 120);
    });
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      groups.current = {};
    };
  }, []);

  // Terminals and warehouses (server).
  useEffect(() => {
    const g = groups.current.fix;
    if (!g || !p.network) return;
    g.clearLayers();
    for (const t of p.network.terminals) {
      L.marker([t.lat, t.lng], {
        icon: L.divIcon({
          className: '',
          html: '<div style="width:20px;height:20px;background:#0a0a0a;color:#fff;font:600 10px/20px IBM Plex Mono,monospace;text-align:center;border:2px solid #fff;box-shadow:0 0 0 1px #0a0a0a">P</div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      })
        .bindTooltip(`<div class="tip"><div class="th">${esc(t.name)}</div></div>`, { className: 'card-tip' })
        .addTo(g);
    }
    for (const w of p.network.warehouses) {
      const u = w.capacity ? w.booked / w.capacity : 0;
      L.circleMarker([w.lat, w.lng], { radius: 8 + w.capacity / 9, color: INK, weight: 2, fillColor: u < 0.7 ? GOOD : u < 0.9 ? '#ffffff' : BAD, fillOpacity: 1 })
        .bindTooltip(
          `<div class="tip"><div class="th">${esc(w.name)}</div>${tipRow('Booked today', `${w.booked} / ${w.capacity}`)}<div class="bar" style="margin:.2rem 0 .4rem"><i style="width:${Math.min(100, u * 100)}%;background:${
            u < 0.7 ? GOOD : u < 0.9 ? INK : BAD
          }"></i></div>${tipRow('Docks', String(w.docks))}</div>`,
          { className: 'card-tip' },
        )
        .addTo(g);
    }
  }, [p.network]);

  // Shipment routes and trucks (server), in the wired views.
  useEffect(() => {
    const routes = groups.current.routes;
    const trucks = groups.current.trucks;
    if (!routes || !trucks) return;
    routes.clearLayers();
    trucks.clearLayers();
    if (!p.board || p.view === 'prob') return;
    for (const row of p.board.shipments) {
      const st = ROUTE_STYLE[row.current.status];
      L.polyline(row.route.geometry as L.LatLngTuple[], { color: '#fff', weight: st.weight + 5, opacity: 0.85, interactive: false }).addTo(routes);
      L.polyline(row.route.geometry as L.LatLngTuple[], { ...st, opacity: p.view === 'go' ? 0.35 : 0.9, lineCap: 'butt' })
        .bindTooltip(`<div class="tip"><div class="th">${row.id} → ${row.warehouse_id}</div><div>${esc(row.route.label)}</div></div>`, { className: 'card-tip', sticky: true })
        .on('click', () => cb.current.onSelect(row.id))
        .addTo(routes);
    }
    if (!p.network) return;
    for (const t of p.network.trucks) {
      const row = p.board.shipments.find((s) => s.current.truck_id === t.id);
      const cls = !row ? 'hollow' : row.current.status === 'at_risk' ? 'bad' : row.current.status === 'tight' ? 'warn' : '';
      const m = L.marker([t.lat, t.lng], { icon: tkIcon(t.id.replace(/\D/g, ''), cls) })
        .bindTooltip(truckTip(t.id, t.driver_label, t.hours_available, row), { className: 'card-tip', direction: 'right' })
        .addTo(trucks);
      if (row) m.on('click', () => cb.current.onSelect(row.id));
    }
  }, [p.board, p.network, p.view]);

  // Conditions (server): unverified dashed indigo, confirmed solid red, dismissed thin grey.
  useEffect(() => {
    const g = groups.current.cond;
    if (!g) return;
    g.clearLayers();
    if (!p.board || p.view === 'prob') return;
    for (const d of p.board.disruptions) {
      if (!d.area) continue;
      const style =
        d.verification === 'confirmed'
          ? { color: BAD, weight: 3, fillColor: BAD, fillOpacity: 0.18 }
          : d.verification === 'unverified'
            ? { color: BLUEPRINT, weight: 3, dashArray: '8 6', fillColor: BLUEPRINT, fillOpacity: 0.08 }
            : { color: '#9a9a9a', weight: 1.5, fill: false };
      const c = L.circle([d.area.lat, d.area.lng], { radius: d.area.radius_km * 1000, ...style }).addTo(g);
      c.bindTooltip(conditionTip(d), { className: 'card-tip', sticky: true });
      c.bindPopup(conditionPop(d), { closeButton: true });
      c.on('popupopen', (e: L.PopupEvent) => {
        const root = e.popup.getElement();
        if (!root) return;
        root.onclick = (ev) => {
          const v = (ev.target as HTMLElement).dataset.verdict as Verdict | undefined;
          if (!v) return;
          ev.preventDefault();
          map.current?.closePopup();
          cb.current.onVerdict(d.id, v);
        };
      });
    }
  }, [p.board, p.view]);

  // Scripted example trucks, only in the On route view.
  useEffect(() => {
    const g = groups.current.scripted;
    if (!g) return;
    g.clearLayers();
    if (p.view !== 'prob') return;
    for (const t of ONROUTE) {
      const pts = R(t.pair);
      L.marker(pts[Math.floor(t.f * (pts.length - 1))], { icon: tkIcon(t.id.slice(2), t.sit === 'ok' ? '' : t.sit) })
        .bindTooltip(scriptedTip(t), { className: 'card-tip', direction: 'right' })
        .on('click', () => cb.current.onPickProb(t.id))
        .addTo(g);
    }
  }, [p.view]);

  const fitRef = useRef(() => {});
  fitRef.current = () => {
    const m = map.current;
    const g = groups.current.cand;
    if (!m || !g) return;
    m.invalidateSize();
    g.clearLayers();
    const { view, board, selectedId, options, focusRole, probId } = cb.current;
    if (view === 'go' && board && selectedId) {
      const row = board.shipments.find((s) => s.id === selectedId);
      if (!row) return;
      const bounds = L.latLngBounds(row.route.geometry as L.LatLngTuple[]);
      if (options && options.shipment_id === selectedId) {
        for (const role of [...ROLE_ORDER].reverse()) {
          const o = options.options.find((x) => x.roles.includes(role));
          if (!o) continue;
          const on = role === focusRole;
          const st = ROLE[role];
          L.polyline(o.route.geometry as L.LatLngTuple[], { color: '#fff', weight: on ? 11 : 7, opacity: 0.9, interactive: false }).addTo(g);
          L.polyline(o.route.geometry as L.LatLngTuple[], { color: INK, weight: on ? 6 : 3, opacity: on ? 1 : 0.55, dashArray: st.dash, lineCap: st.cap, interactive: false }).addTo(g);
          bounds.extend(L.latLngBounds(o.route.geometry as L.LatLngTuple[]));
        }
      }
      const wh = cb.current.network?.warehouses.find((w) => w.id === row.warehouse_id);
      if (wh) L.circleMarker([wh.lat, wh.lng], { radius: 18, color: INK, weight: 2, fill: false, dashArray: '3 4' }).addTo(g);
      m.fitBounds(bounds, { padding: [25, 25], maxZoom: 11, animate: false });
    } else if (view === 'prob') {
      const t = ONROUTE.find((x) => x.id === probId)!;
      const has = PROB[t.id].opts.length > 0;
      L.polyline(R(t.pair, 'eff'), { color: '#fff', weight: 10, opacity: 0.9, interactive: false }).addTo(g);
      L.polyline(R(t.pair, 'eff'), { color: INK, weight: 5, interactive: false }).addTo(g);
      if (has) L.polyline(R(t.pair, 'sus'), { color: INK, weight: 4, dashArray: '10 8' }).bindTooltip('Reroute option (scripted)').addTo(g);
      const pts = R(t.pair);
      L.circleMarker(pts[Math.floor(t.f * (pts.length - 1))], { radius: 18, color: has ? BAD : GOOD, weight: 3, fill: false }).addTo(g);
      m.fitBounds(L.latLngBounds(R(t.pair, 'eff')), { padding: [25, 25], maxZoom: 11, animate: false });
    } else if (view === 'map') {
      m.setView(HOME.c, HOME.z);
    } else {
      m.setView(HOME.c, 9);
    }
  };

  useEffect(() => {
    const id = window.setTimeout(() => fitRef.current(), 340);
    return () => window.clearTimeout(id);
  }, [p.view, p.selectedId, p.focusRole, p.probId, p.options]);

  return <div id="map" ref={el} role="region" aria-label="Map of trucks, routes and road conditions" />;
}
