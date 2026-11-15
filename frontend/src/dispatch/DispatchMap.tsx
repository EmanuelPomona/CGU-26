// Dispatch map. Wired layers (terminals, warehouses, trucks, routes, conditions, role routes) come from the
// backend; the On route view's trucks are the scripted example and are drawn only in that view.
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import type { Board, Disruption, Network, OptionsResponse, ShipmentRow, StudioSession } from '../api/types';
import { demoRerouteGeometries, type LatLng as DemoLatLng } from './demoDetours';
import type { RouteKind } from './demoRoutes';
import { OBSTACLE_MIME } from './ObstaclePalette';
import { isDemoShipment, isDemoTruck } from './fleetScope';
import { obstacleIconSrc, obstacleTypeForDisruption, type ObstacleType } from './obstacleCatalog';
import { allowShipmentSelect } from './placeMode';
import { snapToNearestRoute } from './routeSnap';
import { BAD, BLUEPRINT, GOOD, INK, ONROUTE, PROB, R, ROLE, ROLE_ORDER, fatLbl, type RoleKey, type RouteTruck } from './data';
// ONROUTE kept as fallback when parent does not pass onRouteTrucks.

const DEMO_ROUTE_STYLE: Record<RouteKind, { color: string; weight: number; dashArray?: string; label: string }> = {
  fastest: { color: '#0a7a3e', weight: 6, label: 'Fastest arrival' },
  impact: { color: '#1a5f8a', weight: 6, dashArray: '12 8', label: 'Environment & community' },
};

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
  const late = t.delta < 0;
  return `<div class="tip"><div class="th">${t.drv} <span class="chip ${t.sit}">${t.sitT}</span></div>${tipRow('Truck', t.id)}${tipRow(
    'On time',
    `<span class="${late ? 'badc' : 'goodc'}">${late ? `−${Math.abs(t.delta)} min late` : `+${t.delta} min ahead`}</span>`,
  )}${tipRow(
    'Driver fatigue',
    `<span style="color:${fc}">${fl} · ${t.fat}%</span>`,
  )}${tipRow('Next', esc(t.next))}${tipRow('Load', esc(t.cargo))}</div>`;
}
const TRUCK_SRC = '/map-icons/truck.svg';
const WAREHOUSE_SRC = '/map-icons/warehouse.png';

const tkIcon = (cls: string) =>
  L.divIcon({
    className: '',
    html: `<div class="tk tk-img ${cls}"><img src="${TRUCK_SRC}" alt="" draggable="false" /></div>`,
    iconSize: [48, 30],
    iconAnchor: [24, 15],
  });

const whIcon = () =>
  L.divIcon({
    className: '',
    html: `<div class="wh-img"><img src="${WAREHOUSE_SRC}" alt="" draggable="false" /></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

const obstacleMarkerIcon = (type: ObstacleType, verification: string) =>
  L.divIcon({
    className: '',
    html: `<div class="obs-img ${verification}"><img src="${obstacleIconSrc(type)}" alt="" draggable="false" /></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

interface Props {
  view: View;
  board: Board | null;
  network: Network | null;
  selectedId: string | null;
  focusRole: RoleKey;
  options: OptionsResponse | null;
  probId: string;
  placeType: ObstacleType | null;
  studioSession?: StudioSession | null;
  studioFocusAltId?: string | null;
  demoRouteKind?: RouteKind;
  /** When true, keep drawing frozenPath instead of recomputed reroutes. */
  reroutePending?: boolean;
  frozenPath?: Array<[number, number]> | null;
  /** After George is dispatched, hide the busy on-route network and focus his path. */
  georgeDispatched?: boolean;
  /** On-route trucks to draw / pick (includes George after dispatch). */
  onRouteTrucks?: RouteTruck[];
  onSelect: (shipmentId: string) => void;
  onPickProb: (id: string) => void;
  onVerdict: (disruptionId: string, v: Verdict) => void;
  onPlaceCancel: () => void;
  onObstaclePlaced: (type: ObstacleType, lat: number, lng: number) => void;
  onObstacleRejected: (reason: string) => void;
  onStudioObstacleRemove?: (obstacleId: string) => void;
}

function shipmentRoutes(board: Board | null) {
  if (!board) return [];
  return board.shipments.map((row) => ({
    shipmentId: row.id,
    latlngs: row.route.geometry as Array<[number, number]>,
  }));
}

function activeTrackRoutes(
  board: Board | null,
  selectedId: string | null | undefined,
  session: StudioSession | null | undefined,
  demoRouteKind?: RouteKind | null,
): Array<{ shipmentId: string; latlngs: Array<[number, number]> }> {
  const out: Array<{ shipmentId: string; latlngs: Array<[number, number]> }> = [];
  const sid = selectedId ?? session?.truck_id ?? 'active';
  const push = (geom: Array<[number, number]> | number[][] | undefined) => {
    if (!geom?.length) return;
    out.push({
      shipmentId: sid,
      latlngs: geom.map((pt) => [pt[0], pt[1]] as [number, number]),
    });
  };

  // Always include George's job polyline so drops near the drawn road stick to it.
  if (board && selectedId) {
    const row = board.shipments.find((s) => s.id === selectedId);
    if (row?.route.geometry?.length) push(row.route.geometry);
  }
  if (session) {
    // Put the currently chosen solver path first so near-misses prefer that alignment.
    if (demoRouteKind === 'fastest') {
      push(session.alternatives.find((a) => a.slot === 'fastest')?.geometry);
      push(session.baseline?.geometry);
    } else {
      push(session.alternatives.find((a) => a.slot === 'avoid')?.geometry);
      push(session.baseline?.geometry);
      push(session.alternatives.find((a) => a.slot === 'fastest')?.geometry);
    }
    for (const alt of session.alternatives) {
      if (alt.feasible && alt.geometry?.length) push(alt.geometry);
    }
  }
  if (out.length) return out;
  const all = shipmentRoutes(board);
  const filtered = all.filter((r) => !selectedId || r.shipmentId === selectedId);
  return filtered.length ? filtered : all;
}

/** Magnet-snap onto the selected / visible track; always lands on the closest road point. */
function trySnapPlace(
  type: ObstacleType,
  lat: number,
  lng: number,
  board: Board | null,
  onPlaced: (type: ObstacleType, lat: number, lng: number) => void,
  onRejected: (reason: string) => void,
  session?: StudioSession | null,
  selectedId?: string | null,
  demoRouteKind?: RouteKind | null,
) {
  const routes = activeTrackRoutes(board, selectedId, session, demoRouteKind);
  if (!routes.length) {
    onRejected('Select a shipment path first.');
    return;
  }
  // Force onto the closest point of the active path(s).
  const hit = snapToNearestRoute(lat, lng, routes, Number.POSITIVE_INFINITY);
  if (!hit) {
    onRejected('Drop near the active route.');
    return;
  }
  onPlaced(type, hit.lat, hit.lng);
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
    for (const k of ['routes', 'cond', 'cand', 'trucks', 'fix', 'scripted', 'studio']) groups.current[k] = L.layerGroup().addTo(m);
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

  // Terminals and warehouses (always on the board).
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
      L.marker([w.lat, w.lng], { icon: whIcon() })
        .bindTooltip(
          `<div class="tip"><div class="th">${esc(w.name)}</div>${tipRow('Booked today', `${w.booked} / ${w.capacity}`)}<div class="bar" style="margin:.2rem 0 .4rem"><i style="width:${Math.min(100, u * 100)}%;background:${
            u < 0.7 ? GOOD : u < 0.9 ? INK : BAD
          }"></i></div>${tipRow('Docks', String(w.docks))}</div>`,
          { className: 'card-tip' },
        )
        .addTo(g);
    }
  }, [p.network]);

  // Active dispatch path + small truck fleet. Studio alternatives draw in the studio layer.
  useEffect(() => {
    const routes = groups.current.routes;
    const trucks = groups.current.trucks;
    if (!routes || !trucks) return;
    routes.clearLayers();
    trucks.clearLayers();
    if (!p.board || p.view === 'prob') return;
    const rows = p.board.shipments.filter((s) => isDemoShipment(s.id));
    const active = p.selectedId ? rows.find((s) => s.id === p.selectedId) : null;
    const simplified = Boolean(p.georgeDispatched);
    // Before dispatch: whole demo fleet. After George is sent: keep his path in focus.
    const georgeRow = rows.find((s) => s.id === 'C-102');
    const toDraw = simplified ? (georgeRow ? [georgeRow] : []) : rows;
    const hideBoardRoute = Boolean(p.studioSession && simplified);
    if (!hideBoardRoute) {
      for (const row of toDraw) {
        const st = ROUTE_STYLE[row.current.status];
        const on = simplified ? true : !p.selectedId || row.id === p.selectedId;
        L.polyline(row.route.geometry as L.LatLngTuple[], {
          color: '#fff',
          weight: st.weight + 5,
          opacity: on ? 0.85 : 0.25,
          interactive: false,
        }).addTo(routes);
        L.polyline(row.route.geometry as L.LatLngTuple[], {
          ...st,
          opacity: on ? (p.view === 'go' ? 0.45 : 0.95) : 0.35,
          lineCap: 'butt',
        })
          .bindTooltip(
            `<div class="tip"><div class="th">${row.id} → ${row.warehouse_id}</div><div>${esc(row.route.label)}</div></div>`,
            { className: 'card-tip', sticky: true },
          )
          .on('click', () => {
            if (!allowShipmentSelect(cb.current.placeType)) return;
            cb.current.onSelect(row.id);
          })
          .addTo(routes);
      }
    }
    if (!p.network) return;
    const fleet = p.network.trucks.filter((x) => isDemoTruck(x.id));
    const showFleet = simplified
      ? fleet.filter((t) => rows.some((s) => s.current.truck_id === t.id && (!active || s.id === active.id || s.id === 'C-102')))
      : fleet;
    for (const t of showFleet) {
      const row = rows.find((s) => s.current.truck_id === t.id);
      const sel = Boolean(row && row.id === p.selectedId);
      const cls = !row ? 'hollow' : row.current.status === 'at_risk' ? 'bad' : row.current.status === 'tight' ? 'warn' : sel ? '' : '';
      const m = L.marker([t.lat, t.lng], { icon: tkIcon(cls), zIndexOffset: sel ? 500 : 0 })
        .bindTooltip(truckTip(t.id, t.driver_label, t.hours_available, row), { className: 'card-tip', direction: 'right' })
        .addTo(trucks);
      if (row)
        m.on('click', () => {
          if (!allowShipmentSelect(cb.current.placeType)) return;
          cb.current.onSelect(row.id);
        });
    }
  }, [p.board, p.network, p.view, p.selectedId, p.studioSession, p.georgeDispatched]);

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
      const obsType = obstacleTypeForDisruption(d);
      const c = L.circle([d.area.lat, d.area.lng], {
        radius: d.area.radius_km * 1000,
        ...style,
        interactive: !obsType,
      }).addTo(g);
      const bindVerdict = (layer: L.Layer) => {
        layer.bindTooltip(conditionTip(d), { className: 'card-tip', sticky: true });
        layer.bindPopup(conditionPop(d), { closeButton: true });
        layer.on('popupopen', (e: L.PopupEvent) => {
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
      };
      if (obsType) {
        const m = L.marker([d.area.lat, d.area.lng], {
          icon: obstacleMarkerIcon(obsType, d.verification),
          zIndexOffset: 400,
        }).addTo(g);
        bindVerdict(m);
      } else {
        bindVerdict(c);
      }
    }
  }, [p.board, p.view]);

  // Chosen demo route (fastest vs impact) + studio obstacles.
  useEffect(() => {
    const g = groups.current.studio;
    if (!g) return;
    g.clearLayers();
    if (!p.studioSession) return;
    const s = p.studioSession;
    const kind: RouteKind = p.demoRouteKind ?? 'impact';
    const oLat = Number((s.origin as { lat?: number }).lat);
    const oLng = Number((s.origin as { lng?: number }).lng);
    const dLat = Number((s.destination as { lat?: number }).lat);
    const dLng = Number((s.destination as { lng?: number }).lng);
    if (Number.isFinite(oLat) && Number.isFinite(oLng)) {
      L.circleMarker([oLat, oLng], { radius: 8, color: INK, weight: 2, fillColor: GOOD, fillOpacity: 0.9 }).addTo(g);
    }
    if (Number.isFinite(dLat) && Number.isFinite(dLng)) {
      L.circleMarker([dLat, dLng], { radius: 8, color: INK, weight: 2, fillColor: BAD, fillOpacity: 0.9 }).addTo(g);
    }
    const basePath: DemoLatLng[] | null = (() => {
      if (p.frozenPath?.length) return p.frozenPath;
      if (p.board && p.selectedId) {
        const row = p.board.shipments.find((r) => r.id === p.selectedId);
        if (row?.route.geometry?.length) {
          return row.route.geometry.map((pt) => [pt[0], pt[1]] as DemoLatLng);
        }
      }
      const bl = s.baseline?.geometry ?? s.alternatives.find((a) => a.slot === 'fastest')?.geometry;
      return bl?.length ? bl.map((pt) => [pt[0], pt[1]] as DemoLatLng) : null;
    })();

    const drawLine = (latlngs: L.LatLngTuple[], style: (typeof DEMO_ROUTE_STYLE)[RouteKind], emphasis: 'primary' | 'ghost' | 'blocked') => {
      const opacity = emphasis === 'primary' ? 0.95 : emphasis === 'ghost' ? 0.35 : 0.55;
      const weight = emphasis === 'primary' ? style.weight : style.weight - 1;
      L.polyline(latlngs, { color: '#fff', weight: weight + 4, opacity: emphasis === 'ghost' ? 0.25 : 0.75, interactive: false }).addTo(g);
      L.polyline(latlngs, {
        color: emphasis === 'blocked' ? '#666' : style.color,
        weight,
        dashArray: emphasis === 'blocked' ? '4 6' : style.dashArray,
        opacity,
        lineCap: 'butt',
      })
        .bindTooltip(`<div class="tip"><div class="th">${esc(style.label)}</div></div>`, {
          className: 'card-tip',
          sticky: true,
        })
        .addTo(g);
    };

    let fitLatLngs: L.LatLngTuple[] | null = null;

    if (s.obstacles.length > 0 && basePath) {
      const detours = demoRerouteGeometries(
        basePath,
        s.obstacles.map((o) => ({ lat: o.lat, lng: o.lng, radius_km: o.radius_km })),
      );
      if (detours) {
        if (p.reroutePending) {
          // Blocked original stays faint; both candidates visible so placement is obvious.
          drawLine(basePath as L.LatLngTuple[], DEMO_ROUTE_STYLE[kind], 'blocked');
          drawLine(detours.fastest as L.LatLngTuple[], DEMO_ROUTE_STYLE.fastest, 'ghost');
          drawLine(detours.impact as L.LatLngTuple[], DEMO_ROUTE_STYLE.impact, 'ghost');
          fitLatLngs = [...detours.fastest, ...detours.impact] as L.LatLngTuple[];
        } else {
          // Emphasize the selected card; keep the other faint for comparison.
          const other: RouteKind = kind === 'fastest' ? 'impact' : 'fastest';
          drawLine(detours[other] as L.LatLngTuple[], DEMO_ROUTE_STYLE[other], 'ghost');
          drawLine(detours[kind] as L.LatLngTuple[], DEMO_ROUTE_STYLE[kind], 'primary');
          fitLatLngs = detours[kind] as L.LatLngTuple[];
        }
      }
    } else {
      // No obstacle: single chosen path.
      const st = DEMO_ROUTE_STYLE[kind];
      let latlngs: L.LatLngTuple[] | null = null;
      if (kind === 'impact' && p.board && p.selectedId) {
        const row = p.board.shipments.find((r) => r.id === p.selectedId);
        if (row?.route.geometry?.length) latlngs = row.route.geometry as L.LatLngTuple[];
      }
      if (!latlngs) {
        const fastest = s.alternatives.find((a) => a.slot === 'fastest') ?? s.baseline;
        const impact = s.alternatives.find((a) => a.slot === 'avoid') ?? fastest;
        const chosen = kind === 'fastest' ? fastest : impact;
        if (chosen?.feasible && chosen.geometry?.length) {
          latlngs = chosen.geometry.map((pt) => [pt[0], pt[1]] as L.LatLngTuple);
        }
      }
      if (latlngs?.length) {
        drawLine(latlngs, st, 'primary');
        fitLatLngs = latlngs;
      }
    }
    for (const obs of s.obstacles) {
      L.circle([obs.lat, obs.lng], {
        radius: obs.radius_km * 1000,
        color: BAD,
        weight: 2,
        fillColor: BAD,
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(g);
      const m = L.marker([obs.lat, obs.lng], {
        icon: obstacleMarkerIcon(obs.type as ObstacleType, 'confirmed'),
        zIndexOffset: 450,
      })
        .bindTooltip(
          `<div class="tip"><div class="th">${esc(obs.label)}</div><div class="mute small">Click to remove</div></div>`,
          { className: 'card-tip' },
        )
        .bindPopup(
          `<div class="pop" style="min-width:11rem"><b>${esc(obs.label)}</b><div style="margin-top:.55rem"><button type="button" data-studio-obs-remove="${esc(obs.id)}">Remove obstacle</button></div></div>`,
        )
        .addTo(g);
      m.on('popupopen', (e: L.PopupEvent) => {
        const root = e.popup.getElement();
        if (!root) return;
        root.onclick = (ev) => {
          const id = (ev.target as HTMLElement).dataset.studioObsRemove;
          if (!id) return;
          ev.preventDefault();
          map.current?.closePopup();
          cb.current.onStudioObstacleRemove?.(id);
        };
      });
    }
    const m = map.current;
    if (m && fitLatLngs?.length) {
      const bounds = L.latLngBounds(fitLatLngs);
      if (bounds.isValid()) m.fitBounds(bounds, { padding: [40, 40], maxZoom: 11, animate: false });
    }
  }, [p.studioSession, p.demoRouteKind, p.board, p.selectedId, p.reroutePending, p.frozenPath]);

  // On-route trucks: full network on the initial map; after George is dispatched, only in On route view.
  useEffect(() => {
    const g = groups.current.scripted;
    if (!g) return;
    g.clearLayers();
    const fleet = p.onRouteTrucks?.length ? p.onRouteTrucks : ONROUTE;
    const showOnMap = p.view === 'map' && !p.georgeDispatched;
    if (p.view !== 'prob' && !showOnMap) return;
    for (const t of fleet) {
      const pts = (t.path?.length ? t.path : R(t.pair)) as L.LatLngTuple[];
      if (pts.length < 2) continue;
      // Draw every in-use route before dispatch so the map looks busy.
      if (showOnMap || p.view === 'prob') {
        const isRerouted = Boolean(t.path?.length);
        L.polyline(pts, {
          color: '#fff',
          weight: 7,
          opacity: showOnMap ? 0.55 : 0.85,
          interactive: false,
        }).addTo(g);
        L.polyline(pts, {
          color: isRerouted ? (t.sitT === 'Rerouted' ? '#1a5f8a' : GOOD) : t.sit === 'ok' ? GOOD : t.sit === 'warn' ? INK : BAD,
          weight: showOnMap ? 3.5 : isRerouted ? 5.5 : 5,
          opacity: showOnMap ? 0.75 : 0.95,
          dashArray: isRerouted ? (t.short.includes('Env') ? '10 6' : undefined) : t.sit === 'ok' ? undefined : '8 6',
          lineCap: 'butt',
        })
          .bindTooltip(
            `<div class="tip"><div class="th">${esc(t.drv)} · ${esc(t.id)}</div><div>${esc(t.short)}</div><div class="mute small">${esc(t.cargo)}</div>${
              isRerouted ? '<div class="mute small">Submitted reroute</div>' : ''
            }</div>`,
            { className: 'card-tip', sticky: true },
          )
          .on('click', () => cb.current.onPickProb(t.id))
          .addTo(g);
      }
      L.marker(pts[Math.floor(t.f * (pts.length - 1))], { icon: tkIcon(t.sit === 'ok' || t.sitT === 'Rerouted' ? '' : t.sit) })
        .bindTooltip(scriptedTip(t), { className: 'card-tip', direction: 'right' })
        .on('click', () => cb.current.onPickProb(t.id))
        .addTo(g);
    }
  }, [p.view, p.georgeDispatched, p.onRouteTrucks]);

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
      const fleet = cb.current.onRouteTrucks?.length ? cb.current.onRouteTrucks : ONROUTE;
      const t = fleet.find((x) => x.id === probId) ?? fleet[0];
      if (!t) return;
      const has = (PROB[t.id]?.opts.length ?? 0) > 0;
      const main = (t.path?.length ? t.path : R(t.pair, 'eff')) as L.LatLngTuple[];
      L.polyline(main, { color: '#fff', weight: 10, opacity: 0.9, interactive: false }).addTo(g);
      L.polyline(main, {
        color: t.path?.length ? '#1a5f8a' : INK,
        weight: 5,
        dashArray: t.path?.length && t.short.includes('Env') ? '10 6' : undefined,
        interactive: false,
      }).addTo(g);
      if (has && !t.path?.length) {
        L.polyline(R(t.pair, 'sus'), { color: INK, weight: 4, dashArray: '10 8' }).bindTooltip('Faster / alternate route').addTo(g);
      }
      L.circleMarker(main[Math.floor(t.f * (main.length - 1))], { radius: 18, color: has ? BAD : GOOD, weight: 3, fill: false }).addTo(g);
      m.fitBounds(L.latLngBounds(main), { padding: [25, 25], maxZoom: 11, animate: false });
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

  // HTML5 drop of palette obstacles onto a shipment route.
  useEffect(() => {
    const node = el.current;
    const m = map.current;
    if (!node || !m) return;

    const onDragOver = (e: DragEvent) => {
      const dt = e.dataTransfer;
      if (!dt || ![...dt.types].includes(OBSTACLE_MIME)) return;
      e.preventDefault();
      dt.dropEffect = 'copy';
    };
    const onDrop = (e: DragEvent) => {
      const dt = e.dataTransfer;
      if (!dt) return;
      const type = dt.getData(OBSTACLE_MIME) as ObstacleType;
      if (!type) return;
      e.preventDefault();
      e.stopPropagation();
      const ll = m.mouseEventToLatLng(e);
      trySnapPlace(
        type,
        ll.lat,
        ll.lng,
        cb.current.board,
        cb.current.onObstaclePlaced,
        cb.current.onObstacleRejected,
        cb.current.studioSession,
        cb.current.selectedId,
        cb.current.demoRouteKind,
      );
    };
    node.addEventListener('dragover', onDragOver);
    node.addEventListener('drop', onDrop);
    return () => {
      node.removeEventListener('dragover', onDragOver);
      node.removeEventListener('drop', onDrop);
    };
  }, []);

  // Click-to-place mode + Escape cancel.
  useEffect(() => {
    const m = map.current;
    if (!m || !p.placeType) return;
    const type = p.placeType;
    const onClick = (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      trySnapPlace(
        type,
        e.latlng.lat,
        e.latlng.lng,
        cb.current.board,
        cb.current.onObstaclePlaced,
        cb.current.onObstacleRejected,
        cb.current.studioSession,
        cb.current.selectedId,
        cb.current.demoRouteKind,
      );
      cb.current.onPlaceCancel();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cb.current.onPlaceCancel();
    };
    m.getContainer().style.cursor = 'crosshair';
    m.on('click', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      m.getContainer().style.cursor = '';
      m.off('click', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [p.placeType]);

  return <div id="map" ref={el} role="region" aria-label="Map of trucks, routes and road conditions" />;
}
