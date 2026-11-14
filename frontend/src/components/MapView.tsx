// Nautical-chart map: a quiet base on which only routes, destinations, hazards and sensitive places
// carry ink. Surveyed (confirmed) is solid; reported (unverified) and estimated are dashed.
// Leaflet is created once; layers are diffed by key so selection never recreates the map.
import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import type { Area, Board, Disruption, Network, Route, SensitivePlace } from '../api/types';
import {
  COLORS, disruptionStyle, iconHtml, nearRoute, routeStyle, SOURCE_WORD, VERIFICATION_WORD,
} from '../lib/mapStyle';
import { useMedia } from '../lib/useMedia';
import './MapView.css';

interface Props {
  board: Board;
  network: Network | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  preview: Route | null;
  placing: { radius_km: number } | null;
  placed: Area | null;
  onPlace: (latlng: { lat: number; lng: number }) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

// Route geometry seen in any board or option, so the normal route can be ghosted after a reroute.
const geometryCache = new Map<string, Route>();
export function rememberRoute(r: Route) {
  geometryCache.set(r.id, r);
}

const HOME: L.LatLngBoundsExpression = [
  [33.66, -118.32],
  [34.16, -117.42],
];

export function MapView(props: Props) {
  const { board, network, selectedId, onSelect, preview, placing, placed, onPlace, collapsed, onToggleCollapsed } = props;
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const groups = useRef<Record<string, L.LayerGroup>>({});
  const routeLines = useRef(new Map<string, { line: L.Polyline; routeId: string }>());
  const [tilesFailed, setTilesFailed] = useState(false);
  const [showPlaces, setShowPlaces] = useState(true);
  const onSelectRef = useRef(onSelect);
  const onPlaceRef = useRef(onPlace);
  const placingRef = useRef(placing);
  const boardRef = useRef(board);
  const selectedRef = useRef(selectedId);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onPlaceRef.current = onPlace;
    placingRef.current = placing;
    boardRef.current = board;
    selectedRef.current = selectedId;
  });

  // Create once.
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true, preferCanvas: false });
    m.fitBounds(HOME);
    // CARTO basemaps now require an API key (tiles return a key notice), so the muted base is
    // Esri World Light Gray Canvas, which needs none.
    const attribution =
      'Tiles &copy; Esri, HERE, Garmin &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';
    const base = L.tileLayer(`${esri}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, { attribution, maxZoom: 16 });
    const labels = L.tileLayer(`${esri}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, {
      maxZoom: 16,
      pane: 'shadowPane',
      opacity: 0.8,
    });
    let errors = 0;
    base.on('tileerror', () => {
      errors += 1;
      if (errors > 4) setTilesFailed(true);
    });
    base.on('tileload', () => {
      errors = 0;
      setTilesFailed(false);
    });
    base.addTo(m);
    labels.addTo(m);
    for (const k of ['places', 'disruptions', 'routes', 'preview', 'sites', 'trucks', 'placing']) {
      groups.current[k] = L.layerGroup().addTo(m);
    }
    m.on('click', (e: L.LeafletMouseEvent) => {
      if (placingRef.current) onPlaceRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    m.getContainer().setAttribute('aria-label', 'Map of routes, warehouses and changed conditions');
    map.current = m;
    let fitted = false;
    const lines = routeLines.current;
    const ro = new ResizeObserver(() => {
      m.invalidateSize();
      if (!fitted && m.getSize().y > 40) {
        fitted = true;
        m.fitBounds(HOME);
      }
    });
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      groups.current = {};
      lines.clear();
    };
  }, []);

  // Terminals, warehouses, trucks (static world).
  useEffect(() => {
    const g = groups.current;
    if (!map.current || !network) return;
    g.sites.clearLayers();
    g.trucks.clearLayers();
    for (const t of network.terminals) {
      L.marker([t.lat, t.lng], {
        icon: L.divIcon({ className: 'mk', html: iconHtml('terminal'), iconSize: [14, 14] }),
        keyboard: false,
        title: t.name,
      })
        .bindTooltip(t.id, { permanent: true, direction: 'right', className: 'mk-label', offset: [8, 0] })
        .addTo(g.sites);
    }
    for (const w of network.warehouses) {
      L.marker([w.lat, w.lng], {
        icon: L.divIcon({ className: 'mk', html: iconHtml('warehouse'), iconSize: [16, 16] }),
        title: `${w.name}: select its shipment`,
        alt: w.name,
      })
        .bindTooltip(w.id, { permanent: true, direction: 'right', className: 'mk-label', offset: [9, 0] })
        .on('click', () => {
          const rows = boardRef.current.shipments.filter((s) => s.warehouse_id === w.id);
          if (!rows.length) return;
          const i = rows.findIndex((r) => r.id === selectedRef.current);
          onSelectRef.current(rows[(i + 1) % rows.length].id);
        })
        .addTo(g.sites);
    }
    for (const t of network.trucks) {
      L.marker([t.lat, t.lng], {
        icon: L.divIcon({ className: 'mk', html: iconHtml('truck'), iconSize: [8, 8] }),
        keyboard: false,
        title: `${t.id}, ${t.driver_label}${t.spare ? ', spare' : ''}`,
      }).addTo(g.trucks);
    }
  }, [network]);

  // Routes: diff by shipment id and route id; restyle on selection.
  useEffect(() => {
    const g = groups.current.routes;
    if (!g) return;
    const lines = routeLines.current;
    const seen = new Set<string>();
    for (const row of board.shipments) {
      rememberRoute(row.route);
      seen.add(row.id);
      const prev = lines.get(row.id);
      if (prev && prev.routeId === row.route.id) continue;
      if (prev) g.removeLayer(prev.line);
      const line = L.polyline(row.route.geometry as L.LatLngTuple[], { interactive: true, bubblingMouseEvents: false })
        .on('click', () => onSelectRef.current(row.id))
        .bindTooltip(`${row.id}: ${row.route.label}${row.route.estimated ? ' (estimated path)' : ''}`, { sticky: true });
      line.addTo(g);
      lines.set(row.id, { line, routeId: row.route.id });
    }
    for (const [id, v] of lines) {
      if (!seen.has(id)) {
        g.removeLayer(v.line);
        lines.delete(id);
      }
    }
    for (const row of board.shipments) {
      const v = lines.get(row.id)!;
      const sel = row.id === selectedId;
      v.line.setStyle(routeStyle(sel, row.route.estimated));
      if (sel) v.line.bringToFront();
    }
  }, [board, selectedId]);

  // Normal-route ghost and option preview for the selected shipment.
  useEffect(() => {
    const g = groups.current.preview;
    if (!g) return;
    g.clearLayers();
    const row = board.shipments.find((s) => s.id === selectedId);
    if (row && row.route.id !== row.normal_route_id) {
      const normal = geometryCache.get(row.normal_route_id);
      if (normal) {
        L.polyline(normal.geometry as L.LatLngTuple[], {
          color: COLORS.ghost,
          weight: 3,
          dashArray: '6 6',
          interactive: false,
        }).addTo(g);
      }
    }
    if (preview) {
      rememberRoute(preview);
      L.polyline(preview.geometry as L.LatLngTuple[], {
        color: COLORS.action,
        weight: 4,
        dashArray: '8 6',
        opacity: 0.9,
        interactive: false,
      }).addTo(g);
    }
  }, [board, selectedId, preview]);

  // Fit to the selected route.
  useEffect(() => {
    const m = map.current;
    const row = board.shipments.find((s) => s.id === selectedId);
    if (!m || !row) return;
    m.flyToBounds(L.latLngBounds(row.route.geometry as L.LatLngTuple[]), { padding: [28, 28], duration: 0.5, maxZoom: 12 });
    // Only on selection change: refitting on every board update would fight the dispatcher's panning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Disruption areas.
  useEffect(() => {
    const g = groups.current.disruptions;
    if (!g) return;
    g.clearLayers();
    for (const d of board.disruptions) {
      if (!d.area) continue;
      L.circle([d.area.lat, d.area.lng], { radius: d.area.radius_km * 1000, ...disruptionStyle(d.verification) })
        .bindPopup(popupHtml(d), { className: 'dz-popup' })
        .addTo(g);
    }
  }, [board.disruptions]);

  // Sensitive places, emphasized near the selected route.
  useEffect(() => {
    const g = groups.current.places;
    if (!g) return;
    g.clearLayers();
    if (!network || !showPlaces) return;
    const row = board.shipments.find((s) => s.id === selectedId);
    const geom = (preview ?? row?.route)?.geometry ?? null;
    for (const p of network.sensitive_places) {
      const near = geom ? nearRoute(p, geom, 250) : false;
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: `mk mk-place${near ? ' mk-near' : ''}`, html: iconHtml(p.kind), iconSize: [12, 12] }),
        keyboard: false,
        title: placeTitle(p, near),
        zIndexOffset: near ? 500 : 0,
      }).addTo(g);
    }
  }, [network, showPlaces, board, selectedId, preview]);

  // Placing mode.
  useEffect(() => {
    const m = map.current;
    const g = groups.current.placing;
    if (!m || !g) return;
    m.getContainer().classList.toggle('is-placing', !!placing);
    g.clearLayers();
    if (placing && placed) {
      L.circle([placed.lat, placed.lng], { radius: placed.radius_km * 1000, ...disruptionStyle('unverified') }).addTo(g);
    }
  }, [placing, placed]);

  useEffect(() => {
    const id = window.setTimeout(() => map.current?.invalidateSize(), 260);
    return () => window.clearTimeout(id);
  }, [collapsed]);

  return (
    <div className={`mapview${collapsed ? ' is-collapsed' : ''}`}>
      <div ref={el} className="mapview-canvas" />
      {tilesFailed && <p className="mapview-note">Basemap unavailable. Routes and conditions are still drawn.</p>}
      {placing && <p className="mapview-hint" role="status">Click the map to place it.</p>}
      {collapsed !== undefined && onToggleCollapsed && (
        <button type="button" className="btn mapview-toggle" aria-expanded={!collapsed} onClick={onToggleCollapsed}>
          {collapsed ? 'Show map' : 'Hide map'}
        </button>
      )}
      <Legend showPlaces={showPlaces} onTogglePlaces={() => setShowPlaces((x) => !x)} />
    </div>
  );
}

function Legend({ showPlaces, onTogglePlaces }: { showPlaces: boolean; onTogglePlaces: () => void }) {
  const wide = useMedia('(min-width: 1181px)');
  return (
    <details className="legend" open={wide || undefined} key={wide ? 'wide' : 'narrow'}>
      <summary>Legend</summary>
      <ul>
        <li>
          <svg width="26" height="8" aria-hidden="true"><line x1="0" x2="26" y1="4" y2="4" stroke={COLORS.action} strokeWidth="4" /></svg>
          Selected route
        </li>
        <li>
          <svg width="26" height="8" aria-hidden="true"><line x1="0" x2="26" y1="4" y2="4" stroke={COLORS.ghost} strokeWidth="3" strokeDasharray="5 4" /></svg>
          Dashed: normal route, or estimated path
        </li>
        <li>
          <svg width="26" height="14" aria-hidden="true"><circle cx="13" cy="7" r="6" fill="rgb(179 49 42 / 0.12)" stroke={COLORS.atRisk} strokeWidth="2" /></svg>
          Solid circle: confirmed
        </li>
        <li>
          <svg width="26" height="14" aria-hidden="true"><circle cx="13" cy="7" r="6" fill="url(#hatch-unverified)" stroke={COLORS.unverified} strokeWidth="2" strokeDasharray="3 2" /></svg>
          Dashed, hatched: unverified report
        </li>
        <li>
          <span className="legend-shapes" dangerouslySetInnerHTML={{ __html: iconHtml('school') + iconHtml('hospital') + iconHtml('residential') }} />
          School, hospital, homes
        </li>
      </ul>
      <label className="legend-toggle">
        <input type="checkbox" checked={showPlaces} onChange={onTogglePlaces} /> Sensitive places
      </label>
      {/* Global pattern referenced by Leaflet paths via fill="url(#hatch-unverified)". */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <pattern id="hatch-unverified" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
            <rect width="7" height="7" fill="rgb(75 79 166 / 0.06)" />
            <line x1="0" y1="0" x2="0" y2="7" stroke={COLORS.unverified} strokeWidth="1.5" strokeOpacity="0.45" />
          </pattern>
        </defs>
      </svg>
    </details>
  );
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function popupHtml(d: Disruption): string {
  return `<strong>${esc(d.label)}</strong><br>${SOURCE_WORD[d.source]}<br>${VERIFICATION_WORD[d.verification]}, confidence ${Math.round(d.confidence * 100)}%`;
}

function placeTitle(p: SensitivePlace, near: boolean): string {
  return `${p.name}${p.source === 'simulated' ? ' (simulated)' : ''}${near ? ', within 250 m of the selected route' : ''}`;
}
