// Mock fixtures: presets and the Method page content. Values copied from docs/API.md.
import type { Method, PresetList } from '../api/types';

export const presets = {
  presets: [
    { id: 'slow710', label: 'I-710 crash slowdown', description: 'Traffic at 2.6x travel time within 4 km of Long Beach Blvd.', disruption: { kind: 'slowdown', label: 'I-710 crash slowdown', source: 'simulated', confidence: 0.9, area: { lat: 33.91, lng: -118.204, radius_km: 4 }, slowdown_factor: 2.6 } },
    { id: 'close60', label: 'Road closure (SR-60)', description: 'Full closure of SR-60 near Diamond Bar, 2 km.', disruption: { kind: 'closure', label: 'SR-60 full closure', source: 'simulated', confidence: 0.8, area: { lat: 34.0, lng: -117.88, radius_km: 2 } } },
    { id: 'fire', label: 'Wildfire zone', description: 'Hazard area near Fontana and Ontario, 7 km.', disruption: { kind: 'hazard', label: 'Wildfire zone near Fontana', source: 'simulated', confidence: 0.6, area: { lat: 34.13, lng: -117.5, radius_km: 7 } } },
    { id: 'flood', label: 'Flooding near Vernon', description: 'Hazard area along the LA River, 2.5 km.', disruption: { kind: 'hazard', label: 'Flooding along the LA River near Vernon', source: 'simulated', confidence: 0.5, area: { lat: 34.0, lng: -118.22, radius_km: 2.5 } } },
    { id: 'pickup103', label: 'Pickup delay on C-103', description: 'Terminal hold adds 120 min before pickup.', disruption: { kind: 'pickup_delay', label: 'Terminal hold on C-103', source: 'simulated', confidence: 1, shipment_id: 'C-103', delay_min: 120 } },
    { id: 'trucks35', label: 'Trucks T3 and T5 out', description: 'Two trucks out of service.', disruption: { kind: 'truck_out', label: 'Trucks T3 and T5 out of service', source: 'simulated', confidence: 1, truck_ids: ['T3', 'T5'] } },
    { id: 'docksONT', label: 'Ontario docks at half capacity', description: 'Half of the receiving docks at ONT are down.', disruption: { kind: 'dock_cut', label: 'Ontario docks at 50%', source: 'simulated', confidence: 1, warehouse_id: 'ONT', capacity_cut: 0.5 } },
  ],
} satisfies PresetList;

export const method = {
  assumptions: [
    { key: 'gate', label: 'Terminal gate time', value: 40, unit: 'min', kind: 'simulated', note: 'From pickup to leaving the terminal.' },
    { key: 'unload', label: 'Unload time', value: 45, unit: 'min', kind: 'simulated', note: 'At the warehouse dock.' },
    { key: 'block_penalty', label: 'Closure or hazard penalty', value: 150, unit: 'min', kind: 'simulated', note: 'Added in proportion to how likely the report is true.' },
    { key: 'no_truck_late', label: 'Lateness with no truck', value: 180, unit: 'min', kind: 'simulated', note: 'Used when a plan has no available truck.' },
    { key: 'detention', label: 'Detention charge', value: 1.2, unit: 'USD per late min', kind: 'simulated', note: '' },
    { key: 'mile_cost', label: 'Running cost', value: 2.1, unit: 'USD per mile', kind: 'simulated', note: '' },
    { key: 'driver_cost', label: 'Driver cost', value: 38, unit: 'USD per hour', kind: 'simulated', note: '' },
    { key: 'co2_loaded', label: 'CO2, loaded', value: 1.75, unit: 'kg per mile', kind: 'simulated', note: '' },
    { key: 'co2_empty', label: 'CO2, empty', value: 1.3, unit: 'kg per mile', kind: 'simulated', note: '' },
    { key: 'co2_idle', label: 'CO2, idling', value: 0.136, unit: 'kg per min', kind: 'simulated', note: '' },
    { key: 'deadhead_mph', label: 'Deadhead speed', value: 28, unit: 'mph', kind: 'simulated', note: '' },
    { key: 'resched_fee', label: 'Reschedule fee', value: 75, unit: 'USD', kind: 'simulated', note: '' },
    { key: 'sensitive_radius', label: 'Sensitive place radius', value: 250, unit: 'm', kind: 'simulated', note: '' },
  ],
  formulas: [
    { id: 'eta', label: 'Estimated arrival', expression: 'depart + drive x traffic + P(blocked) x 150 + dock queue', explanation: 'Depart is pickup plus 40 min gate time.' },
    { id: 'status', label: 'Status', expression: 'at risk if P(on time) < 0.5; tight if < 0.85 or slack < 15 min', explanation: 'P(on time) mixes the blocked and unblocked cases with a normal distribution.' },
    { id: 'community', label: 'Community score', expression: '100 - min(30, 1.5 x local mi) - min(50, weighted sensitive places)', explanation: 'Night trips (8 PM to 6 AM) weigh 1.5 times.' },
  ],
  data_sources: [
    { name: 'OpenStreetMap via OSRM demo server', kind: 'public', used_for: 'Road geometry and free-flow drive times', limits: 'Car profile; no truck height, weight or hazmat rules. Fetched once, bundled.' },
    { name: 'Synthetic dispatch day', kind: 'simulated', used_for: 'Terminals, warehouses, trucks, shipments, appointments', limits: 'Fictional; no real company or person.' },
  ],
  not_modeled: ['Truck-legal routing', 'Live GPS', 'Real appointment systems', 'Fleet-wide optimization'],
  responsible_design: [
    { consideration: 'environment', how: 'Every option shows added miles and estimated CO2.' },
    { consideration: 'fairness', how: 'Every option lists who bears the burden, and the map shows sensitive places near the route.' },
    { consideration: 'transparency', how: 'Every figure is labeled simulated, estimated or public; this page lists every constant.' },
    { consideration: 'human_oversight', how: 'Nothing changes a plan without a dispatcher click; any option can be chosen with a reason; every decision can be undone.' },
    { consideration: 'responsible_data', how: 'Drivers are pseudonyms; no personal data is stored.' },
  ],
} satisfies Method;
