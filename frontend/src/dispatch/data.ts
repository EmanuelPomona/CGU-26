// Hard-coded demo data from the owner-supplied dispatcher-ui.html mockup (all names fictional).
// Route geometry comes from mock-routes.js, converted to routes.json.
import routesJson from './routes.json';

export type Pair = keyof typeof routesJson;
export type Role = 'eff' | 'sus' | 'com';
export interface RouteData {
  role: Role;
  pts: [number, number][];
  mi: number;
  min: number;
  local: number;
  roads: string[];
}
export const ROUTES = routesJson as unknown as Record<Pair, RouteData[]>;
export const R = (pair: Pair, role: Role = 'eff') => ROUTES[pair].find((r) => r.role === role)!.pts;

export const NOW = 9 * 60 + 40;
export const GOOD = '#12924a';
export const BAD = '#d4312c';
export const INK = '#0a0a0a';

export type Sev = 'ok' | 'warn' | 'bad';
/** [label, text, severity]; label is the small caps word shown before the text. */
export type Tag = [string, string, Sev];

export const TERM = {
  POLA: { n: 'Port of Los Angeles', p: [33.7395, -118.278] as [number, number] },
  POLB: { n: 'Port of Long Beach', p: [33.7555, -118.2185] as [number, number] },
};

export interface Warehouse {
  n: string;
  p: [number, number];
  used: number;
  cap: number;
  closes: string;
  back: string;
  state: string;
  c: Sev;
}
export const WH: Record<string, Warehouse> = {
  VER: { n: 'Vernon DC', p: [34.003, -118.23], used: 31, cap: 40, closes: '6:00 PM', back: 'Docks 5–6 reopen 1:30 PM', state: 'Busy', c: 'warn' },
  COM: { n: 'Commerce Cross-Dock', p: [34.001, -118.156], used: 20, cap: 24, closes: '5:00 PM', back: '', state: 'Open', c: 'ok' },
  SFS: { n: 'Santa Fe Springs DC', p: [33.942, -118.085], used: 18, cap: 30, closes: '7:00 PM', back: '', state: 'Open', c: 'ok' },
  ONT: { n: 'Ontario Fulfillment', p: [34.03, -117.59], used: 44, cap: 60, closes: '8:00 PM', back: 'Dock 12 back 11:00 AM', state: 'Open', c: 'ok' },
  FON: { n: 'Fontana Hub', p: [34.095, -117.46], used: 30, cap: 50, closes: '6:00 PM', back: '', state: 'Open', c: 'ok' },
  IRV: { n: 'Irvine Distribution', p: [33.692, -117.84], used: 17, cap: 18, closes: '4:00 PM', back: 'Full today; tomorrow 6 AM', state: 'Full', c: 'bad' },
};

export const ROLE: Record<Role, { n: string; dash: string | null; comm: number; sch: number; schLocal: number; goal: string }> = {
  eff: { n: 'Efficiency', dash: null, comm: 74, sch: 6, schLocal: 2, goal: 'Arrive soonest. The quickest road route that still meets the delivery window.' },
  sus: { n: 'Sustainability', dash: '12 9', comm: 83, sch: 4, schLocal: 1, goal: 'Least CO₂. Lowest estimated emissions (miles × 1.75 kg, plus stop-and-go).' },
  com: { n: 'Community', dash: '1 9', comm: 94, sch: 1, schLocal: 0, goal: 'Least disruption to neighbors. Fewest schools, hospitals and homes within 250 m on local streets, among routes within 30 min of the fastest.' },
};

export interface DispatchTruck {
  id: string;
  drv: string;
  pair: Pair;
  ctn: string;
  cargo: string;
  slack: number;
  fat: number;
  pri?: boolean;
}
export const DISPATCH: DispatchTruck[] = [
  { id: 'T-21', drv: 'Marcus Reyes', pair: 'POLA>ONT', ctn: 'C-4471', cargo: 'E-commerce', slack: 36, fat: 22 },
  { id: 'T-22', drv: 'Priya Nair', pair: 'POLB>FON', ctn: 'C-4472', cargo: 'Furniture', slack: 24, fat: 35 },
  { id: 'T-23', drv: 'Tomás Alvarez', pair: 'POLA>VER', ctn: 'C-4473', cargo: 'Perishable', slack: 12, fat: 48, pri: true },
  { id: 'T-24', drv: 'Hannah Brooks', pair: 'POLB>IRV', ctn: 'C-4474', cargo: 'Electronics', slack: 30, fat: 28 },
  { id: 'T-25', drv: 'Darnell Price', pair: 'POLB>COM', ctn: 'C-4475', cargo: 'Medical supplies', slack: 18, fat: 41, pri: true },
];

export interface RouteTruck {
  id: string;
  drv: string;
  pair: Pair;
  f: number;
  sit: Sev;
  sitT: string;
  delta: number;
  fat: number;
  driven: string;
  next: string;
  prob: boolean;
  wants?: string;
  short: string;
  cargo: string;
}
export const ONROUTE: RouteTruck[] = [
  { id: 'T-11', drv: 'Luis Ortega', pair: 'POLB>ONT', f: 0.4, sit: 'bad', sitT: 'Decide', delta: -22, fat: 58, driven: '5h 40m', next: 'Rest stop (Industry Hills) in 4 mi', prob: true, short: 'SR-60 closed ahead', cargo: 'C-4401 · Apparel → Ontario Fulfillment' },
  { id: 'T-12', drv: 'Sam Okafor', pair: 'POLB>FON', f: 0.36, sit: 'warn', sitT: 'Slowed', delta: -14, fat: 82, driven: '9h 10m', next: 'Mandatory break due in 1h 50m', prob: true, short: 'I-605 slowdown', cargo: 'C-4402 · Furniture → Fontana Hub' },
  { id: 'T-13', drv: 'Wei Zhang', pair: 'POLB>SFS', f: 0.55, sit: 'ok', sitT: 'On track', delta: 12, fat: 30, driven: '3h 05m', next: 'Arrives 10:25 AM', prob: false, short: 'On schedule', cargo: 'C-4403 · Retail → Santa Fe Springs DC' },
  { id: 'T-14', drv: 'Rosa Delgado', pair: 'POLA>VER', f: 0.9, sit: 'bad', sitT: 'Held', delta: -35, fat: 63, driven: '6h 30m', next: 'Vernon gate: ~50 min dock queue', prob: true, wants: 'Wants to end shift after this job', short: 'Vernon dock queue', cargo: 'C-4455 · Perishable → Vernon DC' },
];

export const OBJ: Record<string, string> = { eff: 'Efficiency', com: 'Community', sus: 'Sustainability', drv: 'Driver wellbeing', cus: 'Keeps commitment' };

export interface ProbOption {
  t: string;
  obj: keyof typeof OBJ;
  s: string;
  eta: string;
  mi: string;
  co2: string;
  cost: string;
  comm: string;
  drv: string;
  rec?: boolean;
  why: string[];
  tags: Tag[];
}
export type ChatLine = ['me' | 'them' | 'sys', string, string];
export interface Problem {
  head: string;
  src: string;
  sev: Sev;
  opts: ProbOption[];
  chat: ChatLine[];
  quick: string[];
}
export const PROB: Record<string, Problem> = {
  'T-11': {
    head: 'SR-60 East closed ahead', src: 'Caltrans, until 4:00 PM', sev: 'bad',
    opts: [
      { t: 'Reroute via I-10 East', obj: 'eff', s: 'Stays on freeways; passes 3 school zones near Pomona exits.', eta: '+9 min', mi: '+4 mi', co2: '+7 kg', cost: '+$14', comm: '88', drv: 'Fatigue 61%',
        why: ['Lowest added time of the routes that avoid the closed SR-60.', 'No incidents reported on I-10 right now (Caltrans live).'], tags: [['Rain', 'Light rain near Pomona', 'warn'], ['Schools', '3 school zones', 'warn']] },
      { t: 'Reroute via SR-91 / SR-57', obj: 'com', s: 'Longer, but avoids all local streets.', eta: '+14 min', mi: '+6 mi', co2: '+10 kg', cost: '+$22', comm: '93', drv: 'Fatigue 63%',
        why: ['Best community score: all freeway, no local streets.', 'Versus option 1: 5 more minutes, 3 fewer school zones.'], tags: [['Traffic', 'SR-57 busy (38 mph)', 'warn']] },
      { t: 'Rest 20 min, then I-10; ask Ontario for +30 min', obj: 'drv', s: 'Luis stops at Industry Hills first; Ontario moves the appointment.', eta: '+35 min', mi: '+4 mi', co2: '+9 kg', cost: '+$31', comm: '88', drv: 'Fatigue 52% (rested)', rec: true,
        why: ['Luis has driven 5h 40m and asked for a restroom: fatigue 58% → 52%.', 'Ontario is 44/60 booked, so a later slot exists.'], tags: [['Partner', 'Ontario must approve +30 min', 'warn']] },
    ],
    chat: [
      ['them', '9:12', 'Passing Carson, all good. Loaded and moving.'],
      ['me', '9:14', 'Copy. Watch SR-60, Caltrans shows a closure ahead.'],
      ['them', '9:31', 'Is there a restroom stop before Pomona? Been driving 3 hours.'],
      ['me', '9:32', 'Yes: Industry Hills truck stop, exit in 4 mi, restrooms and fuel. Take 10 min.'],
      ['them', '9:34', 'Thanks. SR-60 looks blocked up ahead, what now?'],
      ['sys', '9:35', 'Assistant flagged the closure (official source). Waiting on dispatcher.'],
    ],
    quick: ['Send restroom stops', 'Approve 15 min break', 'Confirm reroute'],
  },
  'T-12': {
    head: 'I-605 North slowed to ~18 mph', src: 'CHP, unverified', sev: 'warn',
    opts: [
      { t: 'Stay on I-605, ask Fontana for +20 min', obj: 'sus', s: 'No extra miles; arrival uncertain until the collision clears.', eta: '+20 min', mi: '0 mi', co2: '+5 kg', cost: '+$18', comm: '92', drv: 'Fatigue 85% (near limit)',
        why: ['Lowest extra CO₂ (no added miles).', 'Sam is at 85% fatigue with ~1h 50m left.'], tags: [['Time', 'Arrival uncertain', 'warn'], ['Traffic', 'CHP report unverified', 'warn']] },
      { t: 'Detour via I-105 → I-5', obj: 'eff', s: 'Faster, but uses local connector streets near 2 schools.', eta: '+6 min', mi: '+5 mi', co2: '+8 kg', cost: '+$16', comm: '71', drv: 'Fatigue 84%',
        why: ['Smallest delay.', 'Community score 71/100; pushes the driver closer to the legal limit.'], tags: [['Schools', '2 schools on local streets', 'bad']] },
      { t: 'Take the mandatory break now (30 min)', obj: 'drv', s: 'Whittier truck stop. Resets the driver’s clock; arrives after the slowdown clears.', eta: '+30 min', mi: '+1 mi', co2: '+3 kg', cost: '+$28', comm: '94', drv: 'Fatigue 40% (rested)', rec: true,
        why: ['The break is due within 1h 50m anyway.', 'Fatigue 82% → 40%. Fontana has room for a +30 min slot.'], tags: [['Partner', 'Fontana must move slot', 'warn']] },
    ],
    chat: [
      ['them', '9:28', 'Traffic building on 605, crawling.'],
      ['me', '9:29', 'How are your hours?'],
      ['them', '9:30', 'About 1h 50 left on my clock.'],
      ['me', '9:31', 'Understood, evaluating options. Stay put, I will send a plan.'],
    ],
    quick: ['Approve break now', 'Send restroom stops', 'Ask for ETA'],
  },
  'T-13': {
    head: 'On schedule, no issues', src: 'Live GPS', sev: 'ok', opts: [],
    chat: [
      ['them', '9:20', 'Heading to Santa Fe Springs, all clear.'],
      ['me', '9:21', 'Copy, thanks.'],
    ],
    quick: ['Send restroom stops'],
  },
  'T-14': {
    head: 'Vernon dock queue ~50 min', src: 'Warehouse report; docks 5–6 down until 1:30 PM', sev: 'warn',
    opts: [
      { t: 'Wait in the queue', obj: 'cus', s: 'Keeps the customer’s slot and the cold chain intact.', eta: '+50 min', mi: '0 mi', co2: '+7 kg', cost: '+$42', comm: '95', drv: 'Idle 50 min',
        why: ['Idling adds about 7 kg CO₂.', 'Rosa has 1h 20m left and wants to go home: this uses most of it.'], tags: [['Time', 'Driver idles 50 min', 'warn']] },
      { t: 'Redirect to Commerce Cross-Dock (9 mi)', obj: 'eff', s: 'Open docks; needs customer approval.', eta: '+18 min', mi: '+9 mi', co2: '+16 kg', cost: '+$30', comm: '78', drv: 'Home sooner',
        why: ['Fastest way to drop the container.', 'Adds local streets near Bell Gardens (community 78).'], tags: [['Schools', '2 schools on local streets', 'bad'], ['Partner', 'Customer must approve', 'warn']] },
      { t: 'Reschedule to 1:30 PM, release the driver', obj: 'drv', s: 'Matches Rosa’s request; truck returns for tomorrow.', eta: 'Next slot', mi: '0 mi', co2: '−4 kg', cost: '+$20', comm: '96', drv: 'Ends shift now', rec: true,
        why: ['Rosa asked to finish after this job.', 'Vernon docks reopen at 1:30 PM. Container needs a powered yard spot.'], tags: [['Cold chain', 'Needs a powered yard spot', 'warn']] },
    ],
    chat: [
      ['them', '9:05', 'At Vernon gate, 6 trucks ahead of me.'],
      ['me', '9:12', 'Warehouse says about 50 min.'],
      ['them', '9:14', 'Copy. I’ll go home after this, no more jobs today please.'],
      ['me', '9:15', 'Noted. I will mark you done after this delivery.'],
      ['sys', '9:16', 'Driver preference saved: end shift after C-4455 (1h 20m of hours left).'],
    ],
    quick: ['Mark driver done after this job', 'Send restroom stops', 'Approve option 3'],
  },
};

export type RoadState = 'open' | 'slowed' | 'closed';
export interface Road {
  id: string;
  n: string;
  pair: Pair;
  a: number;
  b: number;
  st: RoadState;
  st0: RoadState;
  detail: string;
  src: string;
  ov: string;
  note: string;
}
const road = (r: Omit<Road, 'st0' | 'ov' | 'note'>): Road => ({ ...r, st0: r.st, ov: '', note: '' });
export const ROADS0: Road[] = [
  road({ id: 'r710', n: 'I-710 N · Long Beach → Compton', pair: 'POLB>COM', a: 0.05, b: 0.5, st: 'slowed', detail: 'Collision near Del Amo · 17 mph', src: 'CHP · 9:42 AM' }),
  road({ id: 'r60', n: 'SR-60 E · Industry → Pomona', pair: 'POLB>ONT', a: 0.62, b: 0.8, st: 'closed', detail: 'Full closure until 4:00 PM', src: 'Caltrans · 9:22 AM' }),
  road({ id: 'r110', n: 'I-110 N · Harbor Fwy', pair: 'POLA>VER', a: 0.12, b: 0.75, st: 'open', detail: 'Normal flow · 58 mph', src: 'Caltrans · 9:35 AM' }),
  road({ id: 'r605', n: 'I-605 N · Pico Rivera', pair: 'POLB>FON', a: 0.42, b: 0.6, st: 'slowed', detail: 'Heavy volume · 31 mph', src: 'Caltrans · 9:30 AM' }),
  road({ id: 'r10', n: 'I-10 E · Pomona → Fontana', pair: 'POLA>FON', a: 0.74, b: 0.95, st: 'open', detail: 'Normal flow · 62 mph', src: 'Caltrans · 9:35 AM' }),
];
export const SN: Record<RoadState, string> = { open: 'Open', slowed: 'Slowed', closed: 'Closed' };
export const SCHIP: Record<RoadState, Sev> = { open: 'ok', slowed: 'warn', closed: 'bad' };
export const ROADSTYLE: Record<RoadState, { color: string; weight: number; dashArray: string | undefined }> = {
  open: { color: GOOD, weight: 5, dashArray: undefined },
  slowed: { color: BAD, weight: 5, dashArray: '12 7' },
  closed: { color: BAD, weight: 8, dashArray: undefined },
};

/* ---------- helpers ---------- */
export const clock = (m: number) => {
  m = Math.round(m);
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${h % 12 || 12}:${String(mm).padStart(2, '0')}${h < 12 ? ' AM' : ' PM'}`;
};
export const fatLbl = (p: number): [string, string] => (p < 40 ? ['Low', GOOD] : p < 70 ? ['Moderate', INK] : ['High', BAD]);

export interface Mets {
  min: number;
  mi: number;
  co2: number;
  cost: number;
  local: number;
  comm: number;
  sch: number;
  schLocal: number;
  roadsArr: string[];
  roads: string;
}
export const mets = (d: DispatchTruck, role: Role): Mets => {
  const r = ROUTES[d.pair].find((x) => x.role === role)!;
  return {
    min: r.min,
    mi: r.mi,
    co2: r.mi * 1.75,
    cost: r.mi * 2.1 + r.min * 0.63,
    local: r.local,
    comm: ROLE[role].comm,
    sch: ROLE[role].sch,
    schLocal: ROLE[role].schLocal,
    roadsArr: r.roads,
    roads: r.roads.join(' → ') || 'local streets',
  };
};
export const winEnd = (d: DispatchTruck) => NOW + 35 + mets(d, 'eff').min + d.slack;
export function summaryTags(d: DispatchTruck, role: Role): Tag[] {
  const m = mets(d, role);
  const roads = m.roadsArr.join(' ');
  const dest = d.pair.split('>')[1];
  const inland = ['ONT', 'FON'].includes(dest) && role !== 'com';
  return [
    inland ? ['Rain', 'Light rain near Pomona', 'warn'] : ['Weather', 'No rain', 'ok'],
    ['Schools', `${m.sch} school zone${m.sch === 1 ? '' : 's'}`, m.sch >= 5 ? 'warn' : 'ok'],
    /I-605/.test(roads) ? ['Traffic', 'I-605 slowed', 'warn'] : /I-710/.test(roads) ? ['Traffic', 'I-710 collision', 'warn'] : ['Traffic', 'No incidents', 'ok'],
    ['Homes', `${m.local.toFixed(1)} mi local streets`, m.local > 3 ? 'warn' : 'ok'],
  ];
}
