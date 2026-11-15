/** Hard-coded To-dispatch / reroute options for the demo board (higher score = better). */

export type ScoreKey = 'cost' | 'environment' | 'community';
export type RouteKind = 'fastest' | 'impact';

export type ScoreDetail = {
  score: number;
  summary: string;
  reasons: string[];
};

export type DemoRouteOption = {
  kind: RouteKind;
  id: string;
  title: string;
  subtitle: string;
  etaLabel: string;
  milesLabel: string;
  scores: Record<ScoreKey, ScoreDetail>;
};

export type DemoJobRoutes = {
  shipmentId: string;
  /** Dispatcher’s locked-in choice for the demo. */
  chosenKind: RouteKind;
  routes: [DemoRouteOption, DemoRouteOption];
  /** After an obstacle: same two choices with updated copy/scores. */
  reroutes: [DemoRouteOption, DemoRouteOption];
};

const SCORE_LABELS: Record<ScoreKey, string> = {
  cost: 'Cost',
  environment: 'Environmental impact',
  community: 'Community impact',
};

export function scoreLabel(key: ScoreKey): string {
  return SCORE_LABELS[key];
}

function opt(
  kind: RouteKind,
  id: string,
  title: string,
  subtitle: string,
  etaLabel: string,
  milesLabel: string,
  cost: ScoreDetail,
  environment: ScoreDetail,
  community: ScoreDetail,
): DemoRouteOption {
  return {
    kind,
    id,
    title,
    subtitle,
    etaLabel,
    milesLabel,
    scores: { cost, environment, community },
  };
}

/** George · POLB → Claremont (chosen: impact). */
const GEORGE: DemoJobRoutes = {
  shipmentId: 'C-102',
  chosenKind: 'impact',
  routes: [
    opt(
      'fastest',
      'C-102:fastest',
      'Fastest route',
      'I-710 → CA-60 corridor · fewest minutes',
      '68 min',
      '48 mi',
      {
        score: 62,
        summary: 'Lower drive time, but tolls and congestion raise cost.',
        reasons: [
          '3 toll segments on the I-710 / CA-60 approach',
          'Heavy midday congestion near Commerce adds detention risk',
          'Toll plaza queues can erase the few minutes this path saves',
        ],
      },
      {
        score: 48,
        summary: 'Faster path cuts through higher-emission and sensitive corridors.',
        reasons: [
          'Crosses a wildlife conservation buffer east of the 605',
          'Stop-and-go congestion increases estimated CO₂ vs the quiet corridor',
          'More freeway weaving near freight yards raises diesel idling',
        ],
      },
      {
        score: 41,
        summary: 'Passes dense schools and neighborhoods on local connectors.',
        reasons: [
          'Within 250 m of 6 schools on local street segments',
          'Cuts 5 residential neighborhoods near the 60 / Pomona approach',
          'Afternoon pickup overlaps school dismissal on two arterials',
        ],
      },
    ),
    opt(
      'impact',
      'C-102:impact',
      'Environment & community minimized',
      'Quieter inland approach · fewer sensitive places',
      '74 min',
      '51 mi',
      {
        score: 71,
        summary: 'Slightly longer, but avoids most toll plazas.',
        reasons: [
          '1 toll segment only (vs 3 on the fastest path)',
          'Steadier freeway speeds reduce fuel burn and detention risk',
          'Dock arrival still inside the Claremont window with spare minutes',
        ],
      },
      {
        score: 88,
        summary: 'Steers clear of the conservation buffer and heavy idle zones.',
        reasons: [
          'Avoids the wildlife conservation area east of the 605',
          'Lower estimated CO₂ from smoother speeds and fewer stops',
          'Less weaving near port-adjacent yards',
        ],
      },
      {
        score: 91,
        summary: 'Keeps distance from schools and residential frontage.',
        reasons: [
          '0 schools within 250 m on local segments (vs 6 on fastest)',
          'Skirts 5 neighborhoods that the fastest path crosses',
          'Uses freight-preferred arterials away from school dismissal peaks',
        ],
      },
    ),
  ],
  reroutes: [
    opt(
      'fastest',
      'C-102:reroute:fastest',
      'Reroute based on fastest arrival',
      'Clears the road closure with the fewest added minutes',
      '79 min',
      '54 mi',
      {
        score: 55,
        summary: 'Detour adds miles and another toll exposure.',
        reasons: [
          'Road closure forces an extra toll plaza on the recovery path',
          'Congestion on the bypass arterial adds uncertain wait',
          'Faster ETA still trades money for minutes around the block',
        ],
      },
      {
        score: 44,
        summary: 'Recovery corridor re-enters higher-emission zones.',
        reasons: [
          'Detour skirts the closure but re-enters a conservation fringe',
          'Extra stop-and-go near the block raises CO₂ vs the quiet corridor',
          'Idling at the closure increases local exhaust',
        ],
      },
      {
        score: 38,
        summary: 'Bypass streets cut closer to schools and homes.',
        reasons: [
          'Reroute around the block passes 4 schools within 250 m',
          'Uses residential collectors to duck the closure',
          'Afternoon traffic overlaps neighborhood pickup times',
        ],
      },
    ),
    opt(
      'impact',
      'C-102:reroute:impact',
      'Reroute based on environment & community',
      'Longer dodge that keeps sensitive places clear of the closure',
      '86 min',
      '57 mi',
      {
        score: 68,
        summary: 'Accepts minutes to avoid tolls and detention past the block.',
        reasons: [
          'Still only 1 toll segment after clearing the road closure',
          'Predictable speeds protect the Claremont appointment',
          'Lower detention risk than the fastest dodge around the block',
        ],
      },
      {
        score: 85,
        summary: 'Keeps the conservation buffer and idle zones off-path.',
        reasons: [
          'Road closure avoided without entering the wildlife conservation area',
          'CO₂ stays closer to the original quiet-corridor estimate',
          'Minimal extra idling compared with the fastest detour',
        ],
      },
      {
        score: 89,
        summary: 'Protects schools and neighborhoods while clearing the hazard.',
        reasons: [
          'Still 0 schools within 250 m on local segments past the closure',
          'Does not cut the five neighborhoods used by the fastest dodge',
          'Stays on freight-preferred streets around the road block',
        ],
      },
    ),
  ],
};

const JOB_C101: DemoJobRoutes = {
  shipmentId: 'C-101',
  chosenKind: 'fastest',
  routes: [
    opt(
      'fastest',
      'C-101:fastest',
      'Fastest route',
      'Port of LA → Vernon · direct',
      '42 min',
      '18 mi',
      {
        score: 78,
        summary: 'Short haul; limited toll exposure.',
        reasons: ['1 light toll segment', 'Low congestion mid-morning', 'Tight dock turn keeps cost down'],
      },
      {
        score: 58,
        summary: 'Industrial corridor with higher diesel density.',
        reasons: ['Passes freight yards with elevated idling', 'No conservation buffer, but denser exhaust', 'Short miles still concentrate emissions near the port'],
      },
      {
        score: 52,
        summary: 'Some school and neighborhood proximity.',
        reasons: ['2 schools within 250 m', '3 neighborhood frontages on the last mile', 'Morning overlap with local traffic'],
      },
    ),
    opt(
      'impact',
      'C-101:impact',
      'Environment & community minimized',
      'Slightly longer approach away from schools',
      '47 min',
      '20 mi',
      {
        score: 74,
        summary: 'A few extra minutes, still low toll cost.',
        reasons: ['No added tolls vs fastest', 'Steady speeds protect detention risk', 'Still inside the Vernon window'],
      },
      {
        score: 82,
        summary: 'Avoids the densest idle pockets.',
        reasons: ['Skirts the heaviest yard idling zone', 'Lower estimated CO₂ on smoother arterials', 'Less stop-and-go near the port'],
      },
      {
        score: 86,
        summary: 'Keeps clear of school frontage.',
        reasons: ['0 schools within 250 m', 'Avoids 3 neighborhood cuts on the last mile', 'Uses industrial frontage streets'],
      },
    ),
  ],
  reroutes: [
    opt(
      'fastest',
      'C-101:reroute:fastest',
      'Reroute based on fastest arrival',
      'Quick dodge around the road closure',
      '51 min',
      '22 mi',
      {
        score: 70,
        summary: 'Short detour with minor cost bump.',
        reasons: ['Same toll count', 'Brief arterial queue', 'Still a short haul'],
      },
      {
        score: 54,
        summary: 'Detour re-enters denser exhaust streets.',
        reasons: ['Bypass near yard idle pockets', 'Extra CO₂ from stops', 'Industrial density stays high'],
      },
      {
        score: 49,
        summary: 'Bypass nearer to homes.',
        reasons: ['1 school within 250 m on the dodge', '2 neighborhood segments', 'Local street cut-through'],
      },
    ),
    opt(
      'impact',
      'C-101:reroute:impact',
      'Reroute based on environment & community',
      'Quiet dodge that stays off school streets',
      '55 min',
      '23 mi',
      {
        score: 72,
        summary: 'Accepts minutes to keep costs stable.',
        reasons: ['No new tolls', 'Predictable arrival', 'Low detention risk'],
      },
      {
        score: 80,
        summary: 'Keeps idle pockets off-path.',
        reasons: ['Avoids yard idle zone on the dodge', 'Lower CO₂ than fastest detour', 'Smoother speeds'],
      },
      {
        score: 84,
        summary: 'Protects school and neighborhood frontage.',
        reasons: ['0 schools within 250 m', 'Skirts residential cut-throughs', 'Industrial frontage only'],
      },
    ),
  ],
};

const JOB_C103: DemoJobRoutes = {
  shipmentId: 'C-103',
  chosenKind: 'fastest',
  routes: [
    opt(
      'fastest',
      'C-103:fastest',
      'Fastest route',
      'Port of LA → Ontario · time-first',
      '72 min',
      '52 mi',
      {
        score: 60,
        summary: 'Time wins; tolls and congestion bite.',
        reasons: ['2 toll segments', 'CA-60 congestion risk', 'Faster ETA with higher fuel burn'],
      },
      {
        score: 50,
        summary: 'Higher emission corridor inland.',
        reasons: ['Near a conservation fringe eastbound', 'Congestion raises CO₂', 'More weaving on the 60'],
      },
      {
        score: 45,
        summary: 'More exposure to schools and neighborhoods.',
        reasons: ['4 schools within 250 m', '3 neighborhoods on connectors', 'School dismissal overlap'],
      },
    ),
    opt(
      'impact',
      'C-103:impact',
      'Environment & community minimized',
      'Quieter inland routing to Ontario',
      '80 min',
      '55 mi',
      {
        score: 69,
        summary: 'Trades minutes for fewer tolls.',
        reasons: ['1 toll segment', 'Steadier speeds', 'Still inside the Ontario window'],
      },
      {
        score: 84,
        summary: 'Avoids the conservation fringe.',
        reasons: ['Stays clear of the conservation buffer', 'Lower CO₂ estimate', 'Less weaving'],
      },
      {
        score: 87,
        summary: 'Fewer schools and neighborhood cuts.',
        reasons: ['1 school within 250 m', 'Avoids 3 neighborhood connectors', 'Freight-preferred approach'],
      },
    ),
  ],
  reroutes: [
    opt(
      'fastest',
      'C-103:reroute:fastest',
      'Reroute based on fastest arrival',
      'Time-first dodge around the road closure',
      '84 min',
      '58 mi',
      {
        score: 52,
        summary: 'Detour adds cost pressure.',
        reasons: ['Extra toll exposure', 'Congested bypass', 'Fuel burn up'],
      },
      {
        score: 46,
        summary: 'Recovery path is emission-heavy.',
        reasons: ['Re-enters conservation fringe', 'Higher CO₂ on stop-and-go', 'More weaving'],
      },
      {
        score: 40,
        summary: 'Closer to schools on the dodge.',
        reasons: ['3 schools within 250 m', 'Neighborhood cut-through', 'Dismissal-hour overlap'],
      },
    ),
    opt(
      'impact',
      'C-103:reroute:impact',
      'Reroute based on environment & community',
      'Longer clear path past the road closure',
      '91 min',
      '61 mi',
      {
        score: 66,
        summary: 'Minutes traded for calmer cost profile.',
        reasons: ['Avoids the extra toll', 'Predictable inland speeds', 'Appointment still workable'],
      },
      {
        score: 82,
        summary: 'Keeps conservation and idle zones clear.',
        reasons: ['No conservation fringe', 'Lower CO₂ than fastest dodge', 'Smoother corridor'],
      },
      {
        score: 85,
        summary: 'Protects community frontage.',
        reasons: ['1 school within 250 m', 'No neighborhood cut-through', 'Freight-preferred streets'],
      },
    ),
  ],
};

const BY_SHIPMENT: Record<string, DemoJobRoutes> = {
  [GEORGE.shipmentId]: GEORGE,
  [JOB_C101.shipmentId]: JOB_C101,
  [JOB_C103.shipmentId]: JOB_C103,
};

export function demoJobFor(shipmentId: string | null | undefined): DemoJobRoutes | null {
  if (!shipmentId) return null;
  return BY_SHIPMENT[shipmentId] ?? null;
}

export function routeByKind(job: DemoJobRoutes, kind: RouteKind, reroute: boolean): DemoRouteOption {
  const list = reroute ? job.reroutes : job.routes;
  return list.find((r) => r.kind === kind) ?? list[0];
}
