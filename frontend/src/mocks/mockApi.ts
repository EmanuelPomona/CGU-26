// In-memory fake of the backend for VITE_USE_MOCK=1. Follows docs/openapi.yaml status codes and the
// single Error shape so the UI exercises the same paths it will use against the real server.
// URL switches for state evidence: ?mock=slow (2.5 s latency), ?mock=fail (server unreachable),
// ?mock=failoptions (options endpoint returns 500).
import { ApiError, type Transport } from '../api/client';
import type { Board, Decision, DecisionCreate, Disruption, DisruptionCreate, DisruptionUpdate } from '../api/types';
import { network } from './network';
import { buildOptions } from './options';
import { affectedBy, buildBoard, routes, type MockState } from './scenarios';
import { method, presets } from './static';

const fresh = (): MockState => ({ clock_min: 480, disruptions: [], decisions: [], decidedPlans: {} });
let state = fresh();
let nextDisruption = 1;
let nextDecision = 1;

const mode = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('mock') ?? '';
const LATENCY = mode === 'slow' ? 2500 : 220;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const invalid = (field: string, message: string) => new ApiError(422, 'validation_error', message, field);

function addDisruption(body: DisruptionCreate): Disruption {
  const need: Record<string, string[]> = {
    slowdown: ['area', 'slowdown_factor'],
    closure: ['area'],
    hazard: ['area'],
    pickup_delay: ['shipment_id', 'delay_min'],
    truck_out: ['truck_ids'],
    dock_cut: ['warehouse_id', 'capacity_cut'],
  };
  for (const f of need[body.kind] ?? []) {
    const v = (body as Record<string, unknown>)[f];
    if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) {
      throw invalid(f, `${f} is required for a ${body.kind.replace('_', ' ')}.`);
    }
  }
  const d: Disruption = {
    id: `D-${nextDisruption++}`,
    kind: body.kind,
    label: body.label ?? body.kind.replace('_', ' '),
    source: body.source ?? 'dispatcher',
    verification: 'unverified',
    confidence: body.confidence ?? 0.7,
    area: body.area ?? null,
    slowdown_factor: body.kind === 'slowdown' ? (body.slowdown_factor ?? null) : null,
    shipment_id: body.kind === 'pickup_delay' ? (body.shipment_id ?? null) : null,
    delay_min: body.kind === 'pickup_delay' ? (body.delay_min ?? null) : null,
    truck_ids: body.kind === 'truck_out' ? (body.truck_ids ?? []) : [],
    warehouse_id: body.kind === 'dock_cut' ? (body.warehouse_id ?? null) : null,
    capacity_cut: body.kind === 'dock_cut' ? (body.capacity_cut ?? null) : null,
    affected_shipment_ids: [],
    note: null,
  };
  d.affected_shipment_ids = affectedBy(d);
  state.disruptions = [...state.disruptions, d];
  return d;
}

function decide(body: DecisionCreate) {
  const opts = buildOptions(state, body.shipment_id);
  if (!opts) throw invalid('shipment_id', `No shipment ${body.shipment_id}.`);
  const opt = opts.options.find((o) => o.id === body.option_id);
  if (!opt || !opt.feasible) {
    throw new ApiError(409, 'option_infeasible', 'That option is no longer offered under current conditions.');
  }
  if (!opt.suggested && (!body.reason || body.reason.trim().length < 3)) {
    throw invalid('reason', 'A reason of at least 3 characters is required when choosing an option that is not suggested.');
  }
  const before = buildBoard(state).shipments.find((s) => s.id === body.shipment_id)!.current;
  const prior = state.decisions.filter((x) => x.shipment_id !== body.shipment_id);
  const d: Decision = {
    id: `DEC-${nextDecision}`,
    seq: nextDecision++,
    shipment_id: body.shipment_id,
    option_id: opt.id,
    option_kind: opt.kind,
    option_title: opt.title,
    was_suggested: opt.suggested,
    reason: opt.suggested ? (body.reason ?? null) : body.reason!.trim(),
    decided_at_clock_min: state.clock_min,
    before,
    after: opt.evaluation,
    also_affects: [],
    supervisor_update: [
      `${body.shipment_id} (${opt.evaluation.truck_id ?? 'no truck'}): ${opt.title}.`,
      `Before: ${before.status.replace('_', ' ')}, ${before.late_min} min late (est.).`,
      `After: ${opt.evaluation.status.replace('_', ' ')}, on-time chance ${Math.round(opt.evaluation.on_time_probability * 100)}% (est.).`,
      `Change vs keeping the plan: ${opt.delta.miles >= 0 ? '+' : ''}${opt.delta.miles} mi, ${opt.delta.co2_kg >= 0 ? '+' : ''}${opt.delta.co2_kg} kg CO2, ${opt.delta.cost_usd >= 0 ? '+' : ''}$${opt.delta.cost_usd} (est.).`,
      opt.suggested ? 'This was the suggested response.' : `Chosen over the suggestion because: ${body.reason!.trim()}`,
      'All figures are estimates from simulated inputs.',
    ].join('\n'),
  };
  state.decisions = [...prior, d];
  const plans = { ...state.decidedPlans };
  plans[body.shipment_id] = { evaluation: opt.evaluation, route: opt.route ?? routes[opt.evaluation.route_id] };
  state.decidedPlans = plans;
  return d;
}

function route(method_: string, path: string, body: unknown): unknown {
  let m: RegExpMatchArray | null;
  if (method_ === 'GET' && path === '/api/network') return network;
  if (method_ === 'GET' && path === '/api/method') return method;
  if (method_ === 'GET' && path === '/api/presets') return presets;
  if (method_ === 'GET' && path === '/api/board') return buildBoard(state);
  if (method_ === 'POST' && path === '/api/reset') {
    state = fresh();
    return buildBoard(state);
  }
  if (method_ === 'PUT' && path === '/api/settings') {
    state.clock_min = (body as Board['settings']).clock_min;
    return buildBoard(state);
  }
  if (method_ === 'POST' && path === '/api/disruptions') {
    addDisruption(body as DisruptionCreate);
    return buildBoard(state);
  }
  if ((m = path.match(/^\/api\/disruptions\/([^/]+)$/))) {
    const id = decodeURIComponent(m[1]);
    const d = state.disruptions.find((x) => x.id === id);
    if (!d) throw new ApiError(404, 'not_found', `No disruption ${id}.`);
    if (method_ === 'PATCH') {
      const u = body as DisruptionUpdate;
      state.disruptions = state.disruptions.map((x) =>
        x.id === id ? { ...x, verification: u.verification, note: u.note ?? x.note } : x,
      );
    } else if (method_ === 'DELETE') {
      state.disruptions = state.disruptions.filter((x) => x.id !== id);
    }
    return buildBoard(state);
  }
  if ((m = path.match(/^\/api\/shipments\/([^/]+)\/options$/))) {
    if (mode === 'failoptions') throw new ApiError(500, 'internal_error', 'Options could not be computed.');
    const opts = buildOptions(state, decodeURIComponent(m[1]));
    if (!opts) throw new ApiError(404, 'not_found', 'No such shipment.');
    return opts;
  }
  if (method_ === 'POST' && path === '/api/decisions') {
    const decision = decide(body as DecisionCreate);
    return { decision, board: buildBoard(state) };
  }
  if ((m = path.match(/^\/api\/decisions\/([^/]+)$/)) && method_ === 'DELETE') {
    const id = decodeURIComponent(m[1]);
    const d = state.decisions.find((x) => x.id === id);
    if (!d) throw new ApiError(404, 'not_found', `No decision ${id}.`);
    state.decisions = state.decisions.filter((x) => x.id !== id);
    const plans = { ...state.decidedPlans };
    delete plans[d.shipment_id];
    state.decidedPlans = plans;
    return buildBoard(state);
  }
  if (method_ === 'GET' && path === '/api/feeds/candidates') {
    return { sources: [{ name: 'CHP incidents', ok: false, error: 'Mock mode: no network.' }], candidates: [] };
  }
  throw new ApiError(404, 'not_found', `Mock has no route for ${method_} ${path}.`);
}

export const mockTransport: Transport = async (method_, path, body) => {
  await wait(LATENCY);
  if (mode === 'fail') throw new ApiError(0, 'network', 'The server could not be reached.');
  // Deep copy so the UI can never mutate mock state by reference.
  return structuredClone(route(method_, path, body));
};

// The four canned boards named in TASK-101, for tests and screenshots.
function cannedBoards() {
  const saved = state;
  state = fresh();
  const normal = buildBoard(state);
  const closure = presets.presets.find((p) => p.id === 'close60')!.disruption;
  const d = addDisruption(closure);
  const close60Unverified = buildBoard(state);
  state.disruptions = state.disruptions.map((x) => (x.id === d.id ? { ...x, verification: 'confirmed' } : x));
  const close60Confirmed = buildBoard(state);
  decide({ shipment_id: 'C-103', option_id: 'reroute:R-POLA-ONT-I10' });
  const afterDecision = buildBoard(state);
  state = saved;
  nextDisruption = 1;
  nextDecision = 1;
  return { normal, close60Unverified, close60Confirmed, afterDecision } satisfies Record<string, Board>;
}
export const canned = cannedBoards();
