// Mock fixture: the fictional network from docs/reference/sample-prototype.html.
// Replaced by a curl capture of GET /api/network once the backend serves it.
import type { Network, SensitivePlace } from '../api/types';

const places: Array<[SensitivePlace['kind'], number, number]> = [
  ['school', 33.787, -118.262], ['residential', 33.835, -118.253], ['school', 33.79, -118.216],
  ['school', 33.895, -118.22], ['school', 33.938, -118.244], ['residential', 33.981, -118.225],
  ['school', 33.996, -118.148], ['school', 33.965, -118.15], ['hospital', 33.94, -118.13],
  ['school', 33.98, -118.09], ['residential', 33.945, -118.07], ['hospital', 33.979, -118.03],
  ['school', 34.01, -118.11], ['school', 34.055, -117.75], ['residential', 34.015, -117.69],
  ['school', 34.065, -117.65], ['school', 34.09, -117.44], ['residential', 34.107, -117.37],
  ['school', 33.835, -117.91], ['school', 33.685, -117.81], ['hospital', 33.745, -117.867],
  ['residential', 33.788, -117.853], ['school', 33.862, -118.064], ['school', 33.889, -118.16],
  ['school', 33.93, -118.21], ['school', 33.955, -118.212], ['school', 34.106, -117.57],
  ['residential', 34.068, -117.939], ['school', 34.003, -117.81], ['residential', 33.875, -117.566],
];

const kindName = { school: 'school', hospital: 'hospital', residential: 'residential area' } as const;

export const network = {
  terminals: [
    { id: 'POLA', name: 'Port of Los Angeles', lat: 33.7395, lng: -118.278 },
    { id: 'POLB', name: 'Port of Long Beach', lat: 33.7555, lng: -118.2185 },
  ],
  warehouses: [
    { id: 'VER', name: 'Vernon DC', lat: 34.003, lng: -118.23, docks: 12, capacity: 40, booked: 31 },
    { id: 'COM', name: 'Commerce Cross-Dock', lat: 34.001, lng: -118.156, docks: 8, capacity: 24, booked: 20 },
    { id: 'SFS', name: 'Santa Fe Springs DC', lat: 33.942, lng: -118.085, docks: 10, capacity: 30, booked: 18 },
    { id: 'ONT', name: 'Ontario Fulfillment', lat: 34.03, lng: -117.59, docks: 20, capacity: 60, booked: 44 },
    { id: 'FON', name: 'Fontana Hub', lat: 34.095, lng: -117.46, docks: 16, capacity: 50, booked: 30 },
    { id: 'IRV', name: 'Irvine Distribution', lat: 33.692, lng: -117.84, docks: 6, capacity: 18, booked: 17 },
  ],
  trucks: [
    { id: 'T1', driver_label: 'George', lat: 33.77, lng: -118.2, hours_available: 9.5, spare: false },
    { id: 'T2', driver_label: 'Priya', lat: 33.75, lng: -118.29, hours_available: 8.0, spare: false },
    { id: 'T3', driver_label: 'Elena', lat: 33.79, lng: -118.28, hours_available: 10.0, spare: false },
    { id: 'T4', driver_label: 'Jamal', lat: 33.765, lng: -118.205, hours_available: 7.5, spare: false },
    { id: 'T5', driver_label: 'Sofia', lat: 33.745, lng: -118.265, hours_available: 9.0, spare: false },
    { id: 'T6', driver_label: 'Kenji', lat: 33.76, lng: -118.21, hours_available: 8.5, spare: false },
    { id: 'T7', driver_label: 'Aisha', lat: 33.775, lng: -118.225, hours_available: 10.5, spare: false },
    { id: 'T8', driver_label: 'Diego', lat: 33.78, lng: -118.27, hours_available: 9.0, spare: true },
    { id: 'T9', driver_label: 'Nora', lat: 33.83, lng: -118.22, hours_available: 9.5, spare: true },
  ],
  sensitive_places: places.map(([kind, lat, lng], i) => ({
    id: `SP-${String(i + 1).padStart(2, '0')}`,
    kind,
    name: `Simulated ${kindName[kind]}`,
    lat,
    lng,
    source: 'simulated' as const,
  })),
} satisfies Network;
