// Mock fixture builder. This is fake-server code: it stands in for the backend engine so the
// UI can be built before the backend exists. The app itself never computes any of these numbers.
// Numbers follow the rules in docs/API.md loosely and are plausible, not authoritative.
import type {
  Board, Check, Decision, Disruption, Evaluation, Indicators, Route, ShipmentRow,
} from '../api/types';
import geometry from './routeGeometry.json';

type Geo = Record<string, { distance_mi: number; base_minutes: number; geometry: number[][]; refs: string[] }>;
const GEO = geometry as Geo;

const prettyRef = (r: string) => r.replace(/^CA /, 'SR-').replace(/^I /, 'I-').replace(/^US (\d+).*/, 'US-$1');

const VIA: Record<string, string | null> = {
  'R-POLA-ONT-I10': 'El Monte (I-10)',
  'R-POLA-ONT-SR91': 'Corona (SR-91)',
};

export const routes: Record<string, Route> = Object.fromEntries(
  Object.entries(GEO).map(([id, g]) => [
    id,
    {
      id,
      label: g.refs.map(prettyRef).join(' → ') || 'local streets',
      via: VIA[id] ?? null,
      distance_mi: g.distance_mi,
      base_minutes: g.base_minutes,
      estimated: false,
      geometry: g.geometry,
    } satisfies Route,
  ]),
);

interface Seed {
  id: string;
  cargo: string;
  priority: 'normal' | 'high';
  terminal_id: string;
  warehouse_id: string;
  truck: string;
  ready: number;
  start: number;
  end: number;
  route: string;
  eta: number;
  prob: number;
  community: number;
  local: number;
  near: number;
}

export const seeds: Seed[] = [
  { id: 'C-101', cargo: 'Retail goods', priority: 'normal', terminal_id: 'POLA', warehouse_id: 'VER', truck: 'T2', ready: 480, start: 555, end: 590, route: 'R-POLA-VER', eta: 563, prob: 0.94, community: 91, local: 1.2, near: 1 },
  { id: 'C-102', cargo: 'Perishable (cold chain)', priority: 'high', terminal_id: 'POLB', warehouse_id: 'COM', truck: 'T1', ready: 480, start: 550, end: 595, route: 'R-POLB-COM', eta: 564, prob: 0.95, community: 88, local: 1.8, near: 1 },
  { id: 'C-103', cargo: 'E-commerce', priority: 'normal', terminal_id: 'POLA', warehouse_id: 'ONT', truck: 'T3', ready: 510, start: 620, end: 665, route: 'R-POLA-ONT', eta: 646, prob: 0.81, community: 86, local: 2.1, near: 1 },
  { id: 'C-104', cargo: 'Furniture', priority: 'normal', terminal_id: 'POLB', warehouse_id: 'FON', truck: 'T4', ready: 540, start: 665, end: 710, route: 'R-POLB-FON', eta: 677, prob: 0.92, community: 84, local: 2.4, near: 2 },
  { id: 'C-105', cargo: 'Medical supplies', priority: 'high', terminal_id: 'POLA', warehouse_id: 'SFS', truck: 'T5', ready: 480, start: 545, end: 580, route: 'R-POLA-SFS', eta: 569, prob: 0.78, community: 79, local: 2.9, near: 3 },
  { id: 'C-106', cargo: 'Electronics', priority: 'normal', terminal_id: 'POLB', warehouse_id: 'IRV', truck: 'T6', ready: 600, start: 670, end: 715, route: 'R-POLB-IRV', eta: 689, prob: 0.93, community: 90, local: 1.4, near: 1 },
  { id: 'C-107', cargo: 'Apparel', priority: 'normal', terminal_id: 'POLB', warehouse_id: 'ONT', truck: 'T7', ready: 480, start: 610, end: 650, route: 'R-POLB-ONT', eta: 619, prob: 0.9, community: 87, local: 1.9, near: 1 },
];

const HOURS: Record<string, number> = { T1: 9.5, T2: 8, T3: 10, T4: 7.5, T5: 9, T6: 8.5, T7: 10.5, T8: 9, T9: 9.5 };
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface EvalInput {
  seed: Seed;
  route?: string;
  truck?: string | null;
  eta?: number;
  prob?: number;
  shift?: number;
  extraIdle?: number;
  blockMin?: number;
  flags?: string[];
  review?: boolean;
  hits?: string[];
  community?: number;
  local?: number;
  near?: number;
  extraCost?: number;
}

export function evaluation(i: EvalInput): Evaluation {
  const s = i.seed;
  const route = routes[i.route ?? s.route];
  const truck = i.truck === undefined ? s.truck : i.truck;
  const eta = i.eta ?? s.eta;
  const shift = i.shift ?? 0;
  const start = s.start + shift;
  const end = s.end + shift;
  const prob = i.prob ?? s.prob;
  const slack = end - eta;
  const drive = route.base_minutes * 1.25;
  const idle = 8 + (i.extraIdle ?? 0);
  const miles = 3 + route.distance_mi * 2;
  const hours = (6 + idle + 40 + drive + (i.blockMin ?? 0) + 45 + 0.9 * route.base_minutes) / 60;
  const late = Math.max(0, eta - end);
  const status: Evaluation['status'] = prob < 0.5 ? 'at_risk' : prob < 0.85 || slack < 15 ? 'tight' : 'on_time';
  const community = i.community ?? s.community;
  const local = i.local ?? s.local;
  const near = i.near ?? s.near;
  return {
    status,
    truck_id: truck,
    route_id: route.id,
    appt_shift_min: shift,
    eta_min: eta,
    eta_sigma_min: r1(6 + 0.12 * drive),
    appt_start_min: start,
    appt_end_min: end,
    slack_min: slack,
    late_min: late,
    on_time_probability: Math.round(prob * 100) / 100,
    miles: r1(miles),
    cost_usd: r1(miles * 2.1 + hours * 38 + late * 1.2 + (i.extraCost ?? 0)),
    co2_kg: r1(3 * 1.3 + route.distance_mi * 1.75 + route.distance_mi * 1.3 + idle * 0.136),
    community_score: community,
    community_detail:
      near > 0
        ? `${local} mi on local streets; ${near} sensitive place${near === 1 ? '' : 's'} within 250 m.`
        : `${local} mi on local streets; no sensitive places within 250 m.`,
    local_street_miles: local,
    sensitive_places_near: near,
    driver_hours: r1(hours),
    driver_hours_over: r1(Math.max(0, hours - (truck ? HOURS[truck] : 0))),
    idle_min: idle,
    flags: i.flags ?? [],
    needs_review: i.review ?? false,
    hit_disruption_ids: i.hits ?? [],
  };
}

function indicators(evals: Evaluation[]): Indicators {
  const sum = (f: (e: Evaluation) => number) => evals.reduce((a, e) => a + f(e), 0);
  return {
    shipments_at_risk: evals.filter((e) => e.status === 'at_risk').length,
    shipments_tight: evals.filter((e) => e.status === 'tight').length,
    total_late_min: sum((e) => e.late_min),
    fleet_miles: r1(sum((e) => e.miles)),
    co2_kg: r1(sum((e) => e.co2_kg)),
    cost_usd: r1(sum((e) => e.cost_usd)),
    community_score_avg: r1(sum((e) => e.community_score) / evals.length),
    drivers_over_hours: evals.filter((e) => e.driver_hours_over > 0).length,
    idle_min: sum((e) => e.idle_min),
  };
}

export interface MockState {
  clock_min: number;
  disruptions: Disruption[];
  decisions: Decision[];
  /** shipment id -> evaluation of the plan chosen by its decision, under current conditions */
  decidedPlans: Record<string, { evaluation: Evaluation; route: Route }>;
}

function haversineKm(a: number[], b: number[]): number {
  const t = Math.PI / 180;
  const dLa = (b[0] - a[0]) * t;
  const dLo = (b[1] - a[1]) * t;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dLo / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

/** Which seed shipments a disruption touches (mock geometry: any route vertex inside the circle). */
export function affectedBy(d: Pick<Disruption, 'kind' | 'area' | 'shipment_id' | 'truck_ids' | 'warehouse_id'>): string[] {
  return seeds
    .filter((s) => {
      switch (d.kind) {
        case 'slowdown':
        case 'closure':
        case 'hazard': {
          const a = d.area;
          if (!a) return false;
          return routes[s.route].geometry.some((p) => haversineKm(p, [a.lat, a.lng]) <= a.radius_km);
        }
        case 'pickup_delay':
          return d.shipment_id === s.id;
        case 'truck_out':
          return d.truck_ids.includes(s.truck);
        case 'dock_cut':
          return d.warehouse_id === s.warehouse_id;
      }
    })
    .map((s) => s.id);
}

/** Original plan under every active disruption. */
export function changedEval(seed: Seed, active: Disruption[]): Evaluation {
  const hits = active.filter((d) => d.affected_shipment_ids.includes(seed.id));
  if (hits.length === 0) return evaluation({ seed });
  let eta = seed.eta;
  let prob = seed.prob;
  let blockMin = 0;
  let truck: string | null = seed.truck;
  const flags: string[] = [];
  for (const d of hits) {
    const p = d.verification === 'confirmed' ? 1 : d.confidence;
    switch (d.kind) {
      case 'closure':
      case 'hazard': {
        const add = Math.round(150 * p);
        eta += add;
        blockMin += add;
        prob *= 1 - p;
        flags.push(`Route crosses ${d.label}`);
        break;
      }
      case 'slowdown': {
        const add = Math.round(((d.slowdown_factor ?? 2) - 1) * 14);
        eta += add;
        prob = Math.max(0.05, prob - add / 60);
        flags.push(`Slowed by ${d.label}`);
        break;
      }
      case 'pickup_delay':
        eta += d.delay_min ?? 0;
        prob = Math.max(0.02, prob - (d.delay_min ?? 0) / 80);
        flags.push(`Pickup delayed ${d.delay_min} min`);
        break;
      case 'dock_cut': {
        const add = Math.round(90 * (d.capacity_cut ?? 0));
        eta += add;
        prob = Math.max(0.05, prob - add / 70);
        flags.push(`Dock queue at ${seed.warehouse_id}`);
        break;
      }
      case 'truck_out':
        truck = null;
        eta = seed.end + 180;
        prob = 0.05;
        flags.push('No truck available');
        break;
    }
  }
  const review = hits.some((d) => d.verification === 'unverified');
  if (review) flags.push('Depends on an unverified report');
  return evaluation({
    seed,
    eta,
    truck,
    prob: Math.round(prob * 100) / 100,
    blockMin,
    flags,
    review,
    hits: hits.map((d) => d.id),
  });
}

export function buildBoard(state: MockState): Board {
  const active = state.disruptions.filter((d) => d.verification !== 'dismissed');
  const rows: ShipmentRow[] = seeds.map((seed) => {
    const normal = evaluation({ seed });
    const changed = changedEval(seed, active);
    const decided = state.decidedPlans[seed.id];
    const current = decided?.evaluation ?? changed;
    const attention: ShipmentRow['attention'] =
      current.status === 'at_risk' ? 'act' : current.status === 'tight' || current.needs_review ? 'watch' : 'none';
    return {
      id: seed.id,
      cargo: seed.cargo,
      priority: seed.priority,
      terminal_id: seed.terminal_id,
      warehouse_id: seed.warehouse_id,
      ready_min: seed.ready,
      normal,
      changed,
      current,
      route: decided?.route ?? routes[seed.route],
      normal_route_id: seed.route,
      attention,
      decision_id: state.decisions.find((x) => x.shipment_id === seed.id)?.id ?? null,
    };
  });
  const ind = {
    normal: indicators(rows.map((r) => r.normal)),
    changed: indicators(rows.map((r) => r.changed)),
    decided: indicators(rows.map((r) => r.current)),
  };
  const unverified = active.filter((d) => d.verification === 'unverified');
  const addedMiles = r1(ind.decided.fleet_miles - ind.normal.fleet_miles);
  const checks: Check[] = [
    {
      id: 'added_miles_review',
      label: 'Added miles review',
      triggered: addedMiles > 20,
      detail: `Decided fleet miles are ${addedMiles} above the normal day; review above 20 mi (an example threshold from the organizer workshop, not an operating standard).`,
    },
    {
      id: 'new_at_risk',
      label: 'New shipments at risk',
      triggered: ind.changed.shipments_at_risk > ind.normal.shipments_at_risk,
      detail: `${ind.changed.shipments_at_risk} shipments at risk under changed conditions against ${ind.normal.shipments_at_risk} on the normal day.`,
    },
    {
      id: 'driver_hours',
      label: 'Driver hours',
      triggered: ind.decided.drivers_over_hours > 0,
      detail: `${ind.decided.drivers_over_hours} drivers over their remaining shift hours in the decided plan.`,
    },
    {
      id: 'unverified_inputs',
      label: 'Unverified inputs',
      triggered: unverified.length > 0,
      detail: `${unverified.length} active report${unverified.length === 1 ? ' has' : 's have'} not been confirmed by a dispatcher; affected figures are marked.`,
    },
  ];
  return {
    settings: {
      clock_min: state.clock_min,
      weights: { reliability: 35, cost: 20, emissions: 20, community: 15, driver: 10 },
    },
    disruptions: state.disruptions,
    shipments: rows,
    indicators: { ...ind, checks },
    decisions: state.decisions,
    pending_verification_ids: unverified.map((d) => d.id),
  } satisfies Board;
}
