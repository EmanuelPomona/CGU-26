// Shared styling constants, plus the SCRIPTED example data behind the On route view only (ADR-007).
// Map, To dispatch and Network read the backend; nothing here feeds them a number.
import routesJson from './routes.json';

export const GOOD = '#12924a';
export const BAD = '#d4312c';
export const INK = '#0a0a0a';
export const BLUEPRINT = '#4b4fa6';

export type RoleKey = 'efficiency' | 'sustainability' | 'community';
/** The signature element: three route roles, three line styles (solid, long dash, dotted). */
export const ROLE: Record<RoleKey, { n: string; cls: string; dash: string | undefined; cap: 'round' | 'butt' }> = {
  efficiency: { n: 'Efficiency', cls: 'eff', dash: undefined, cap: 'butt' },
  sustainability: { n: 'Sustainability', cls: 'sus', dash: '12 9', cap: 'butt' },
  community: { n: 'Community', cls: 'com', dash: '1 9', cap: 'round' },
};
export const ROLE_ORDER: RoleKey[] = ['efficiency', 'sustainability', 'community'];

export type Sev = 'ok' | 'warn' | 'bad';
/** [label, text, severity]; label is the small caps word shown before the text. */
export type Tag = [string, string, Sev];

/* ---------------- scripted example: trucks on the road ---------------- */
type Pair = keyof typeof routesJson;
interface RouteData {
  role: 'eff' | 'sus' | 'com';
  pts: [number, number][];
}
const ROUTES = routesJson as unknown as Record<Pair, RouteData[]>;
export const R = (pair: Pair, role: 'eff' | 'sus' | 'com' = 'eff') => ROUTES[pair].find((r) => r.role === role)!.pts;

export const fatLbl = (p: number): [string, string] => (p < 40 ? ['Low', GOOD] : p < 70 ? ['Moderate', INK] : ['High', BAD]);

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
  { id: 'T-11', drv: 'Driver 11', pair: 'POLB>ONT', f: 0.4, sit: 'bad', sitT: 'Decide', delta: -22, fat: 58, driven: '5h 40m', next: 'Rest stop (Industry Hills) in 4 mi', prob: true, short: 'SR-60 closed ahead', cargo: 'C-4401 · Apparel → Ontario Fulfillment' },
  { id: 'T-12', drv: 'Driver 12', pair: 'POLB>FON', f: 0.36, sit: 'warn', sitT: 'Slowed', delta: -14, fat: 82, driven: '9h 10m', next: 'Mandatory break due in 1h 50m', prob: true, short: 'I-605 slowdown', cargo: 'C-4402 · Furniture → Fontana Hub' },
  { id: 'T-13', drv: 'Driver 13', pair: 'POLB>SFS', f: 0.55, sit: 'ok', sitT: 'On track', delta: 12, fat: 30, driven: '3h 05m', next: 'Arrives 10:25 AM', prob: false, short: 'On schedule', cargo: 'C-4403 · Retail → Santa Fe Springs DC' },
  { id: 'T-14', drv: 'Driver 14', pair: 'POLA>VER', f: 0.9, sit: 'bad', sitT: 'Held', delta: -35, fat: 63, driven: '6h 30m', next: 'Vernon gate: ~50 min dock queue', prob: true, wants: 'Wants to end shift after this job', short: 'Vernon dock queue', cargo: 'C-4455 · Perishable → Vernon DC' },
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
      { t: 'Rest 20 min, then I-10; ask Ontario for +30 min', obj: 'drv', s: 'Driver 11 stops at Industry Hills first; Ontario moves the appointment.', eta: '+35 min', mi: '+4 mi', co2: '+9 kg', cost: '+$31', comm: '88', drv: 'Fatigue 52% (rested)', rec: true,
        why: ['Driver 11 has driven 5h 40m and asked for a restroom: fatigue 58% → 52%.', 'Ontario is 44/60 booked, so a later slot exists.'], tags: [['Partner', 'Ontario must approve +30 min', 'warn']] },
    ],
    chat: [
      ['them', '9:12', 'Passing Carson, all good. Loaded and moving.'],
      ['me', '9:14', 'Copy. Watch SR-60, Caltrans shows a closure ahead.'],
      ['them', '9:31', 'Is there a restroom stop before Pomona? Been driving 3 hours.'],
      ['me', '9:32', 'Yes: Industry Hills truck stop, exit in 4 mi, restrooms and fuel. Take 10 min.'],
      ['them', '9:34', 'Thanks. SR-60 looks blocked up ahead, what now?'],
      ['sys', '9:35', 'Closure flagged (official source). Waiting on dispatcher.'],
    ],
    quick: ['Send restroom stops', 'Approve 15 min break', 'Confirm reroute'],
  },
  'T-12': {
    head: 'I-605 North slowed to ~18 mph', src: 'CHP, unverified', sev: 'warn',
    opts: [
      { t: 'Stay on I-605, ask Fontana for +20 min', obj: 'sus', s: 'No extra miles; arrival uncertain until the collision clears.', eta: '+20 min', mi: '0 mi', co2: '+5 kg', cost: '+$18', comm: '92', drv: 'Fatigue 85% (near limit)',
        why: ['Lowest extra CO₂ (no added miles).', 'Driver 12 is at 85% fatigue with ~1h 50m left.'], tags: [['Time', 'Arrival uncertain', 'warn'], ['Traffic', 'CHP report unverified', 'warn']] },
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
        why: ['Idling adds about 7 kg CO₂.', 'Driver 14 has 1h 20m left and wants to go home: this uses most of it.'], tags: [['Time', 'Driver idles 50 min', 'warn']] },
      { t: 'Redirect to Commerce Cross-Dock (9 mi)', obj: 'eff', s: 'Open docks; needs customer approval.', eta: '+18 min', mi: '+9 mi', co2: '+16 kg', cost: '+$30', comm: '78', drv: 'Home sooner',
        why: ['Fastest way to drop the container.', 'Adds local streets near Bell Gardens (community 78).'], tags: [['Schools', '2 schools on local streets', 'bad'], ['Partner', 'Customer must approve', 'warn']] },
      { t: 'Reschedule to 1:30 PM, release the driver', obj: 'drv', s: 'Matches the driver’s request; truck returns for tomorrow.', eta: 'Next slot', mi: '0 mi', co2: '−4 kg', cost: '+$20', comm: '96', drv: 'Ends shift now', rec: true,
        why: ['Driver 14 asked to finish after this job.', 'Vernon docks reopen at 1:30 PM. Container needs a powered yard spot.'], tags: [['Cold chain', 'Needs a powered yard spot', 'warn']] },
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
