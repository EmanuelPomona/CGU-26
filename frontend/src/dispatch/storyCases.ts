/** Hard-coded demo cases the board is built around. */
export type StoryCase = {
  id: string;
  driveLabel: string;
  shipmentId: string;
  truckId: string;
  driverName: string;
  originLabel: string;
  destinationLabel: string;
  blurb: string;
};

export const STORY_CASES: StoryCase[] = [
  {
    id: 'case-1',
    driveLabel: 'Drive 1',
    shipmentId: 'C-102',
    truckId: 'T1',
    driverName: 'George',
    originLabel: 'Port of Long Beach',
    destinationLabel: 'Claremont',
    blurb: 'George hauls import containers from Port of Long Beach to Claremont DC.',
  },
  {
    id: 'case-2',
    driveLabel: 'Drive 2',
    shipmentId: 'C-101',
    truckId: 'T2',
    driverName: 'Priya',
    originLabel: 'Port of Los Angeles',
    destinationLabel: 'Vernon',
    blurb: 'Short port-to-Vernon move.',
  },
  {
    id: 'case-3',
    driveLabel: 'Drive 3',
    shipmentId: 'C-103',
    truckId: 'T3',
    driverName: 'Elena',
    originLabel: 'Port of Los Angeles',
    destinationLabel: 'Ontario',
    blurb: 'Inland haul to Ontario Fulfillment.',
  },
];

export const CASE_1 = STORY_CASES[0];

export function storyForShipment(shipmentId: string | null | undefined): StoryCase | null {
  if (!shipmentId) return null;
  return STORY_CASES.find((c) => c.shipmentId === shipmentId) ?? null;
}
