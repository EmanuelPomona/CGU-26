// Mock fixture: response options. Fake-server code standing in for the backend's buildOptions/scoreOptions.
import type { Burden, Evaluation, OptionsResponse, ResponseOption, Route } from '../api/types';
import { evaluation, routes, seeds, type MockState, changedEval } from './scenarios';

const WEIGHTS = { reliability: 35, cost: 20, emissions: 20, community: 15, driver: 10 };
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

interface Draft {
  id: string;
  kind: ResponseOption['kind'];
  title: string;
  description: string;
  evaluation: Evaluation;
  route: Route;
  overall: number;
  scores: Omit<ResponseOption['scores'], 'overall'>;
  burdens: Burden[];
  notes: string[];
  infeasible_reason?: string;
}

function finish(drafts: Draft[], keep: Evaluation): ResponseOption[] {
  return drafts.map((d) => ({
    id: d.id,
    kind: d.kind,
    title: d.title,
    description: d.description,
    feasible: !d.infeasible_reason,
    infeasible_reason: d.infeasible_reason ?? null,
    suggested: false,
    roles: [],
    evaluation: d.evaluation,
    delta: {
      late_min: d.evaluation.late_min - keep.late_min,
      miles: r1(d.evaluation.miles - keep.miles),
      co2_kg: r1(d.evaluation.co2_kg - keep.co2_kg),
      cost_usd: r1(d.evaluation.cost_usd - keep.cost_usd),
      community_score: r1(d.evaluation.community_score - keep.community_score),
      on_time_probability: r2(d.evaluation.on_time_probability - keep.on_time_probability),
    },
    scores: { ...d.scores, overall: d.overall },
    burdens: d.burdens,
    collateral: [],
    route: d.route,
    notes: d.notes,
  }));
}

export function buildOptions(state: MockState, shipmentId: string): OptionsResponse | null {
  const seed = seeds.find((s) => s.id === shipmentId);
  if (!seed) return null;
  const active = state.disruptions.filter((d) => d.verification !== 'dismissed');
  const keepEval = changedEval(seed, active);
  const keep: Draft = {
    id: 'keep',
    kind: 'keep',
    title: 'Keep the plan',
    description: `${seed.truck} drives ${routes[seed.route].label} as planned.`,
    evaluation: keepEval,
    route: routes[seed.route],
    overall: 0,
    scores: { reliability: 0, cost: 100, emissions: 100, community: 90, driver: 100 },
    burdens:
      keepEval.late_min > 0
        ? [
            { stakeholder: 'warehouse', text: `Receives the container about ${keepEval.late_min} min after its window closes.` },
            { stakeholder: 'company', text: `Detention charges of about $${Math.round(keepEval.late_min * 1.2)} (est.).` },
          ]
        : [],
    notes: keepEval.flags,
  };

  const drafts: Draft[] = [keep];
  const blocked = keepEval.hit_disruption_ids.length > 0 && keepEval.status !== 'on_time';

  if (blocked && seed.id === 'C-103') {
    const i10 = routes['R-POLA-ONT-I10'];
    const sr91 = routes['R-POLA-ONT-SR91'];
    drafts.push(
      {
        id: `reroute:${i10.id}`,
        kind: 'reroute',
        title: 'Reroute via El Monte (I-10)',
        description: `Same truck, north around the closure on ${i10.label}.`,
        evaluation: evaluation({ seed, route: i10.id, eta: 650, prob: 0.84, community: 83, local: 1.6, near: 1 }),
        route: i10,
        overall: 78,
        scores: { reliability: 84, cost: 70, emissions: 72, community: 85, driver: 74 },
        burdens: [{ stakeholder: 'driver', text: 'About 20 more minutes behind the wheel.' }],
        notes: ['Stays on freeways except the last 1.6 mi.'],
      },
      {
        id: `reroute:${sr91.id}`,
        kind: 'reroute',
        title: 'Reroute via Corona (SR-91)',
        description: `Same truck, south around the closure on ${sr91.label}.`,
        evaluation: evaluation({ seed, route: sr91.id, eta: 655, prob: 0.76, community: 64, local: 3.4, near: 4 }),
        route: sr91,
        overall: 66,
        scores: { reliability: 76, cost: 68, emissions: 69, community: 52, driver: 71 },
        burdens: [
          { stakeholder: 'residents', text: '3.4 mi on local streets in Corona, passing 4 sensitive places (3 schools).' },
          { stakeholder: 'driver', text: 'About 25 more minutes behind the wheel.' },
        ],
        notes: ['School zones on the local segment between 7:30 and 8:30 AM and 2:30 and 3:30 PM.'],
      },
      {
        id: 'spare:T8',
        kind: 'spare_truck',
        title: 'Send spare truck T8 via I-10',
        description: 'Diego takes the container on the I-10 detour; T3 is released.',
        evaluation: evaluation({ seed, truck: 'T8', route: i10.id, eta: 646, prob: 0.86, community: 83, local: 1.6, near: 1, extraIdle: 25 }),
        route: i10,
        overall: 0,
        scores: { reliability: 86, cost: 58, emissions: 66, community: 85, driver: 20 },
        burdens: [{ stakeholder: 'driver', text: 'Diego would end the shift over the hours limit.' }],
        notes: [],
        infeasible_reason: 'Diego has 9.0 h left; this run needs about 9.4 h.',
      },
    );
  }

  if (blocked || keepEval.status === 'at_risk') {
    const shift = Math.max(15, Math.ceil((keepEval.eta_min + 20 - seed.end) / 15) * 15);
    const late = shift > 180 ? null : shift;
    if (late !== null) {
      drafts.push({
        id: `reschedule:${late}`,
        kind: 'reschedule',
        title: `Move the appointment ${late} min later`,
        description: `Ask ${seed.warehouse_id} for a window starting ${late} min later; keep the plan otherwise.`,
        evaluation: evaluation({
          seed,
          eta: keepEval.eta_min,
          shift: late,
          prob: 0.88,
          blockMin: keepEval.eta_min - seed.eta,
          extraCost: 75,
          review: keepEval.needs_review,
          hits: keepEval.hit_disruption_ids,
          flags: keepEval.needs_review ? ['Depends on an unverified report'] : [],
        }),
        route: routes[seed.route],
        overall: 61,
        scores: { reliability: 88, cost: 74, emissions: 96, community: 90, driver: 55 },
        burdens: [
          { stakeholder: 'warehouse', text: `Gives up a later slot; ${seed.warehouse_id} has few free today.` },
          { stakeholder: 'other_customer', text: 'The later slot may push another delivery.' },
          { stakeholder: 'company', text: 'Reschedule fee of $75 (simulated).' },
        ],
        notes: ['Driver waits at the closure or the yard; idle time adds CO2.'],
      });
    }
  }

  const [k, ...rest] = drafts;
  rest.sort((a, b) => b.overall - a.overall);
  const options = finish([k, ...rest], keepEval);
  assignRoles(options);
  const feasible = options.filter((o) => o.feasible && o.id !== 'keep');
  const suggested = feasible.length
    ? feasible.reduce((a, b) => (b.scores.overall > a.scores.overall ? b : a))
    : options[0];
  suggested.suggested = true;

  const rationale =
    suggested.id === 'keep'
      ? 'Keeping the plan scores highest: the arrival is inside the window and no response improves it enough to justify extra miles or cost.'
      : `${suggested.title} has the highest weighted score (${suggested.scores.overall} of 100) under your priorities: reliability 35, cost 20, emissions 20, community 15, driver 10. It raises the on-time chance to ${Math.round(suggested.evaluation.on_time_probability * 100)}%.`;

  return { shipment_id: seed.id, weights: WEIGHTS, options, suggested_option_id: suggested.id, rationale };
}

/** Fake-server copy of the contract rule for Option.roles (docs/openapi.yaml). */
function assignRoles(options: ResponseOption[]) {
  const pool = options.filter((o) => o.feasible && (o.kind === 'keep' || o.kind === 'reroute'));
  if (!pool.length) return;
  const best = (cands: ResponseOption[], better: (a: ResponseOption, b: ResponseOption) => boolean) =>
    cands.reduce((a, b) => (better(b, a) ? b : a));
  best(pool, (a, b) => a.evaluation.eta_min < b.evaluation.eta_min).roles.push('efficiency');
  const earliest = Math.min(...pool.map((o) => o.evaluation.eta_min));
  const near = pool.filter((o) => o.evaluation.eta_min <= earliest + 30);
  best(near, (a, b) => a.evaluation.co2_kg < b.evaluation.co2_kg).roles.push('sustainability');
  best(near, (a, b) => a.evaluation.community_score > b.evaluation.community_score).roles.push('community');
}
