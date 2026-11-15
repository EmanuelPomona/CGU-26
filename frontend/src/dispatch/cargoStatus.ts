/** Demo cargo readiness for To dispatch (UI label only). */

export type CargoStatus = 'prepared' | 'ready' | 'missing';

const LABEL: Record<CargoStatus, string> = {
  prepared: 'Prepared',
  ready: 'Ready',
  missing: 'Missing',
};

const CHIP: Record<CargoStatus, string> = {
  prepared: 'warn',
  ready: 'good',
  missing: 'bad',
};

/** Hard-coded per demo load so the board shows variety. */
const BY_SHIPMENT: Record<string, CargoStatus> = {
  'C-102': 'ready',
  'C-101': 'prepared',
  'C-103': 'missing',
};

export function cargoStatusFor(shipmentId: string | null | undefined): CargoStatus {
  if (!shipmentId) return 'prepared';
  return BY_SHIPMENT[shipmentId] ?? 'prepared';
}

export function cargoStatusLabel(status: CargoStatus): string {
  return LABEL[status];
}

export function cargoStatusChip(status: CargoStatus): string {
  return CHIP[status];
}
