import { CASE_1 } from './storyCases';

/** Demo board shows a small fleet so one path is easy to follow. */
export const DEMO_TRUCK_IDS = ['T1', 'T2', 'T3', 'T8'] as const;
/** Case 1 (George) first, then supporting loads. */
export const DEMO_SHIPMENT_IDS = [CASE_1.shipmentId, 'C-101', 'C-103'] as const;

const truckSet = new Set<string>(DEMO_TRUCK_IDS);
const shipmentSet = new Set<string>(DEMO_SHIPMENT_IDS);

export function isDemoTruck(id: string): boolean {
  return truckSet.has(id);
}

export function isDemoShipment(id: string): boolean {
  return shipmentSet.has(id);
}

export function defaultDemoShipmentId(ids: string[]): string | null {
  if (ids.includes(CASE_1.shipmentId)) return CASE_1.shipmentId;
  return ids[0] ?? null;
}
