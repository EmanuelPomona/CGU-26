// Map in the prototype's style: routes colored by status, selected route thicker, option routes dashed.
// Leaflet is created once; layer groups are redrawn from props.
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import type { Board, Network, OptionsResponse, ShipmentRow } from '../../api/types';
import { clock } from '../../lib/format';

export type View = 'normal' | 'changed';

interface Props {
  board: Board;
  network: Network | null;
  view: View;
  selectedId: string | null;
  onSelect: (id: string) => void;
  options: OptionsResponse | null;
  showPlaces: boolean;
  showTrucks: boolean;
  placing: boolean;
  onPlace: (latlng: { lat: number; lng: number }) => void;
}

export const STATUS_COLOR = { on_time: '#2a9d5c', tight: '#e9a100', at_risk: '#d64545' } as const;
const KIND_COLOR: Record<string, string> = { slowdown: '#e67e22', closure: '#d64545', hazard: '#b5311f' };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const evalFor = (row: ShipmentRow, view: View) => (view === 'normal' ? row.normal : row.current);

export function ProtoMap(p: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const g = useRef<Record<string, L.LayerGroup>>({});
  const cb = useRef(p);
  useEffect(() => {
    cb.current = p;
  });

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true }).setView([33.93, -118.0], 9);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(m);
    for (const k of ['recv', 'dis', 'routes', 'alts', 'fix', 'trucks']) g.current[k] = L.layerGroup().addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => {
      if (cb.current.placing) cb.current.onPlace({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      g.current = {};
    };
  }, []);

  // Terminals and warehouses.
  useEffect(() => {
    const fix = g.current.fix;
    if (!fix || !p.network) return;
    fix.clearLayers();
    for (const t of p.network.terminals) {
      L.marker([t.lat, t.lng], {
        icon: L.divIcon({ className: '', html: '<div class="tkicon" style="font-size:20px">⚓</div>', iconSize: [20, 20], iconAnchor: [10, 10] }),
      })
        .bindTooltip(`${esc(t.name)} (approx. gate)`, { className: 'lbl' })
        .addTo(fix);
    }
    for (const w of p.network.warehouses) {
      const u = w.capacity ? w.booked / w.capacity : 0;
      const col = u < 0.7 ? '#2a9d5c' : u < 0.9 ? '#e9a100' : '#d64545';
      const appts = p.board.shipments
        .filter((s) => s.warehouse_id === w.id)
        .map((s) => `${s.id}: ${clock(s.current.appt_start_min)} to ${clock(s.current.appt_end_min)}`)
        .join('<br>');
      L.circleMarker([w.lat, w.lng], { radius: 7 + Math.sqrt(w.capacity), color: '#0f2742', weight: 2, fillColor: col, fillOpacity: 0.75 })
        .bindPopup(
          `<b>${esc(w.name)}</b> <i>(simulated)</i><br>Docks: ${w.docks}<br>Daily capacity: ${w.capacity} containers<br>Booked: ${w.booked} (${Math.round(u * 100)}%)<br><b>Our appointments</b><br>${appts || 'none today'}`,
        )
        .bindTooltip(esc(w.name), { className: 'lbl' })
        .addTo(fix);
    }
  }, [p.network, p.board]);

  // Trucks.
  useEffect(() => {
    const tr = g.current.trucks;
    if (!tr || !p.network) return;
    tr.clearLayers();
    if (!p.showTrucks) return;
    const out = new Set(
      p.view === 'changed'
        ? p.board.disruptions.filter((d) => d.verification !== 'dismissed' && d.kind === 'truck_out').flatMap((d) => d.truck_ids)
        : [],
    );
    for (const t of p.network.trucks) {
      const isOut = out.has(t.id);
      const as = p.board.shipments.find((s) => evalFor(s, p.view).truck_id === t.id);
      L.marker([t.lat, t.lng], {
        icon: L.divIcon({ className: '', html: `<div class="tkicon" style="opacity:${isOut ? 0.35 : 1}">${isOut ? '🚫' : '🚚'}</div>`, iconSize: [16, 16], iconAnchor: [8, 8] }),
      })
        .bindTooltip(`${t.id} · ${esc(t.driver_label)}<br>${isOut ? 'UNAVAILABLE' : as ? `assigned ${as.id}` : 'spare'} · ${t.hours_available}h left`)
        .addTo(tr);
    }
  }, [p.network, p.board, p.view, p.showTrucks]);

  // Sensitive places.
  useEffect(() => {
    const rv = g.current.recv;
    if (!rv || !p.network) return;
    rv.clearLayers();
    if (!p.showPlaces) return;
    for (const s of p.network.sensitive_places) {
      L.circleMarker([s.lat, s.lng], { radius: 3.5, color: '#6a4fb3', weight: 1, fillColor: '#9b86d9', fillOpacity: 0.7 })
        .bindTooltip(`${esc(s.name)} (${s.source === 'public' ? 'OpenStreetMap' : 'simulated'})`)
        .addTo(rv);
    }
  }, [p.network, p.showPlaces]);

  // Disruption areas (only in the disruption view).
  useEffect(() => {
    const ds = g.current.dis;
    if (!ds) return;
    ds.clearLayers();
    if (p.view !== 'changed') return;
    for (const d of p.board.disruptions) {
      if (!d.area || d.verification === 'dismissed') continue;
      const c = KIND_COLOR[d.kind] ?? '#d64545';
      L.circle([d.area.lat, d.area.lng], {
        radius: d.area.radius_km * 1000,
        color: c,
        weight: 2,
        fillColor: c,
        fillOpacity: 0.15,
        dashArray: d.verification === 'unverified' ? '6 5' : undefined,
      })
        .bindTooltip(
          `${esc(d.label)}<br>${d.kind === 'slowdown' && d.slowdown_factor ? `slowdown ×${d.slowdown_factor.toFixed(1)} · ` : ''}confidence ${Math.round(d.confidence * 100)}% · ${d.verification === 'confirmed' ? 'CONFIRMED' : 'NEEDS REVIEW'}`,
          { sticky: true },
        )
        .addTo(ds);
    }
  }, [p.board, p.view]);

  // Routes, colored by status in the current view.
  useEffect(() => {
    const rt = g.current.routes;
    if (!rt) return;
    rt.clearLayers();
    for (const row of p.board.shipments) {
      const e = evalFor(row, p.view);
      const sel = row.id === p.selectedId;
      const geom = row.route.geometry;
      const pl = L.polyline(geom as L.LatLngTuple[], {
        color: STATUS_COLOR[e.status],
        weight: sel ? 6 : 3.5,
        opacity: sel ? 0.95 : 0.6,
        bubblingMouseEvents: false,
      }).addTo(rt);
      pl.bindTooltip(`${row.id} → ${row.warehouse_id}<br>${esc(row.route.label)}`, { sticky: true });
      pl.on('click', (ev: L.LeafletMouseEvent) =>
        cb.current.placing ? cb.current.onPlace({ lat: ev.latlng.lat, lng: ev.latlng.lng }) : cb.current.onSelect(row.id),
      );
      if (sel) pl.bringToFront();
    }
  }, [p.board, p.view, p.selectedId]);

  // Alternative routes offered for the selected shipment.
  useEffect(() => {
    const al = g.current.alts;
    if (!al) return;
    al.clearLayers();
    const row = p.board.shipments.find((s) => s.id === p.selectedId);
    if (!row || !p.options || p.options.shipment_id !== row.id) return;
    const seen = new Set<string>([row.route.id]);
    for (const o of p.options.options) {
      if (seen.has(o.route.id)) continue;
      seen.add(o.route.id);
      L.polyline(o.route.geometry as L.LatLngTuple[], { color: '#0b5cab', weight: 3.5, dashArray: '3 8', opacity: 0.9, interactive: false }).addTo(al);
    }
  }, [p.board, p.selectedId, p.options]);

  // Zoom to the selected shipment's route.
  useEffect(() => {
    const row = p.board.shipments.find((s) => s.id === p.selectedId);
    if (map.current && row) map.current.fitBounds(L.latLngBounds(row.route.geometry as L.LatLngTuple[]), { padding: [30, 30], maxZoom: 12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.selectedId]);

  return <div ref={el} role="region" aria-label="Map of routes, warehouses and conditions" />;
}
