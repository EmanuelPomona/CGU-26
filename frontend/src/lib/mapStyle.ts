// Map styling. Colors mirror tokens.css (Leaflet needs literal values for SVG attributes).
import type L from 'leaflet';
import type { Disruption, SensitivePlace } from '../api/types';

export const COLORS = {
  ink: '#1b2228',
  action: '#12355b',
  ghost: '#7c848c',
  atRisk: '#b3312a',
  unverified: '#4b4fa6',
  rule: '#cfcbc0',
  panel: '#f8f6f0',
} as const;

export const SOURCE_WORD: Record<Disruption['source'], string> = {
  simulated: 'Simulated what-if',
  dispatcher: 'Entered by dispatcher',
  public_feed: 'Public feed, unconfirmed',
};

export const VERIFICATION_WORD: Record<Disruption['verification'], string> = {
  unverified: 'Unverified',
  confirmed: 'Confirmed',
  dismissed: 'Dismissed',
};

export function routeStyle(selected: boolean, estimated: boolean): L.PathOptions {
  return selected
    ? { color: COLORS.action, weight: 5, opacity: 1, dashArray: estimated ? '10 6' : undefined }
    : { color: COLORS.ghost, weight: 2.5, opacity: 0.75, dashArray: estimated ? '6 5' : undefined };
}

export function disruptionStyle(v: Disruption['verification']): L.PathOptions {
  switch (v) {
    case 'confirmed':
      return { color: COLORS.atRisk, weight: 2, fillColor: COLORS.atRisk, fillOpacity: 0.12, dashArray: undefined };
    case 'unverified':
      return { color: COLORS.unverified, weight: 2, dashArray: '6 5', fillColor: 'url(#hatch-unverified)', fillOpacity: 1 };
    case 'dismissed':
      return { color: COLORS.ghost, weight: 1, fill: false, dashArray: undefined, opacity: 0.8 };
  }
}

type Shape = 'terminal' | 'warehouse' | 'truck' | SensitivePlace['kind'];

/** Simple geometric markers: one icon system, no pictograms. */
export function iconHtml(shape: Shape): string {
  switch (shape) {
    case 'terminal':
      return `<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="1" y="1" width="12" height="12" fill="${COLORS.ink}"/></svg>`;
    case 'warehouse':
      return `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" fill="${COLORS.panel}" stroke="${COLORS.ink}" stroke-width="2.5"/></svg>`;
    case 'truck':
      return `<svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="3" fill="${COLORS.ink}"/></svg>`;
    case 'school':
      return `<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.5 L11 10.5 H1 Z" fill="${COLORS.panel}" stroke="currentColor" stroke-width="1.5"/></svg>`;
    case 'hospital':
      return `<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 1h3v3.5H11v3H7.5V11h-3V7.5H1v-3h3.5z" fill="${COLORS.panel}" stroke="currentColor" stroke-width="1.25"/></svg>`;
    case 'residential':
      return `<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.25" fill="${COLORS.panel}" stroke="currentColor" stroke-width="1.5"/></svg>`;
  }
}

/** Display-only proximity test for emphasis (the backend owns sensitive_places_near). */
export function nearRoute(p: { lat: number; lng: number }, geometry: number[][], meters: number): boolean {
  const k = Math.cos((p.lat * Math.PI) / 180) * 111320;
  const px = p.lng * k;
  const py = p.lat * 111320;
  for (let i = 1; i < geometry.length; i++) {
    const ax = geometry[i - 1][1] * k;
    const ay = geometry[i - 1][0] * 111320;
    const bx = geometry[i][1] * k;
    const by = geometry[i][0] * 111320;
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
    if (Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) <= meters) return true;
  }
  return false;
}
