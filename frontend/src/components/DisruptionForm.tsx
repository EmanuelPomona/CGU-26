// Forms for a dispatcher-entered condition. Ranges mirror docs/openapi.yaml; the server's 422 is
// shown beside the field it names.
import { useState, type FormEvent, type ReactNode } from 'react';
import type { Area, Board, DisruptionCreate, Network } from '../api/types';
import type { PlaceDraft } from './Conditions';

type ServerError = { message: string; field?: string } | null;

const AREA_KINDS = [
  { value: 'closure', label: 'Closure' },
  { value: 'slowdown', label: 'Slowdown' },
  { value: 'hazard', label: 'Hazard area' },
] as const;

function inRange(v: number, lo: number, hi: number) {
  return Number.isFinite(v) && v >= lo && v <= hi;
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <span className="field-error" id={`${id}-err`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

const describedBy = (id: string, err?: string | null) => (err ? `${id}-err` : undefined);

/** Where the server rejected a field this form does not show, report it in the form's own words. */
function leftover(server: ServerError, fields: string[]) {
  if (!server) return null;
  return server.field && fields.includes(server.field) ? null : server.message;
}

export function DisruptionForm({
  placing,
  placed,
  onPlacing,
  onSubmit,
  busy,
  disabled,
  serverError,
}: {
  placing: PlaceDraft | null;
  placed: Area | null;
  onPlacing: (d: PlaceDraft | null) => void;
  onSubmit: (body: DisruptionCreate) => Promise<boolean>;
  busy: boolean;
  disabled: boolean;
  serverError: ServerError;
}) {
  const [kind, setKind] = useState<PlaceDraft['kind']>('closure');
  const [label, setLabel] = useState('');
  const [radius, setRadius] = useState('2');
  const [factor, setFactor] = useState('2');
  const [confidence, setConfidence] = useState('70');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!inRange(Number(radius), 0.5, 15)) e.radius_km = 'Radius must be 0.5 to 15 km.';
    if (kind === 'slowdown' && !inRange(Number(factor), 1.2, 4)) e.slowdown_factor = 'Factor must be 1.2 to 4.';
    if (!inRange(Number(confidence), 10, 100)) e.confidence = 'Confidence must be 10 to 100%.';
    if (label.length > 80) e.label = 'Keep the label to 80 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const draft = (): PlaceDraft => ({
    kind,
    label: label.trim() || `${AREA_KINDS.find((k) => k.value === kind)!.label} (entered)`,
    radius_km: Number(radius),
    slowdown_factor: Number(factor),
    confidence: Number(confidence) / 100,
  });

  const start = (e: FormEvent) => {
    e.preventDefault();
    if (validate()) onPlacing(draft());
  };

  const add = async () => {
    if (!placing || !placed || !validate()) return;
    const d = draft();
    const body: DisruptionCreate = {
      kind: d.kind,
      label: d.label,
      source: 'dispatcher',
      confidence: d.confidence,
      area: { lat: placed.lat, lng: placed.lng, radius_km: d.radius_km },
      ...(d.kind === 'slowdown' ? { slowdown_factor: d.slowdown_factor } : {}),
    };
    if (await onSubmit(body)) {
      onPlacing(null);
      setLabel('');
    }
  };

  const err = (f: string) => errors[f] ?? (serverError?.field === f || serverError?.field === `area.${f}` ? serverError.message : null);

  return (
    <form className="cond-form" onSubmit={start} noValidate>
      <div className="form-row">
        <Field id="pl-kind" label="Kind">
          <select id="pl-kind" value={kind} onChange={(e) => setKind(e.target.value as PlaceDraft['kind'])}>
            {AREA_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="pl-radius" label="Radius, km" error={err('radius_km')}>
          <input
            id="pl-radius"
            inputMode="decimal"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            aria-invalid={!!err('radius_km')}
            aria-describedby={describedBy('pl-radius', err('radius_km'))}
          />
        </Field>
      </div>
      <div className="form-row">
        {kind === 'slowdown' && (
          <Field id="pl-factor" label="Travel time x" error={err('slowdown_factor')}>
            <input
              id="pl-factor"
              inputMode="decimal"
              value={factor}
              onChange={(e) => setFactor(e.target.value)}
              aria-invalid={!!err('slowdown_factor')}
              aria-describedby={describedBy('pl-factor', err('slowdown_factor'))}
            />
          </Field>
        )}
        <Field id="pl-conf" label="Confidence, %" error={err('confidence')}>
          <input
            id="pl-conf"
            inputMode="numeric"
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
            aria-invalid={!!err('confidence')}
            aria-describedby={describedBy('pl-conf', err('confidence'))}
          />
        </Field>
      </div>
      <Field id="pl-label" label="Label (optional)" error={err('label')}>
        <input id="pl-label" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Crash on SR-91 at Euclid" />
      </Field>
      {!placing ? (
        <button type="submit" className="btn" disabled={disabled}>
          Place on map
        </button>
      ) : (
        <div className="form-actions">
          <p className="form-hint">{placed ? 'Placed. Add it, or click the map again to move it.' : 'Click the map to place it.'}</p>
          <button type="button" className="btn btn-primary" disabled={!placed || busy || disabled} onClick={add}>
            {busy ? 'Adding…' : 'Add as unverified'}
          </button>
          <button type="button" className="btn" onClick={() => onPlacing(null)}>
            Cancel
          </button>
        </div>
      )}
      {leftover(serverError, ['radius_km', 'area.radius_km', 'slowdown_factor', 'confidence', 'label']) && (
        <p className="inline-error" role="alert">
          {leftover(serverError, ['radius_km', 'area.radius_km', 'slowdown_factor', 'confidence', 'label'])}
        </p>
      )}
    </form>
  );
}

type OtherKind = 'pickup_delay' | 'truck_out' | 'dock_cut';

export function OtherChangeForm({
  network,
  board,
  onSubmit,
  busy,
  disabled,
  serverError,
}: {
  network: Network | null;
  board: Board;
  onSubmit: (body: DisruptionCreate) => Promise<boolean>;
  busy: boolean;
  disabled: boolean;
  serverError: ServerError;
}) {
  const [kind, setKind] = useState<OtherKind>('pickup_delay');
  const [shipment, setShipment] = useState(board.shipments[0]?.id ?? '');
  const [delay, setDelay] = useState('60');
  const [trucks, setTrucks] = useState<string[]>([]);
  const [warehouse, setWarehouse] = useState(network?.warehouses[0]?.id ?? '');
  const [cut, setCut] = useState('50');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    let body: DisruptionCreate;
    if (kind === 'pickup_delay') {
      if (!inRange(Number(delay), 15, 480) || !Number.isInteger(Number(delay))) er.delay_min = 'Delay must be a whole number from 15 to 480 min.';
      if (!shipment) er.shipment_id = 'Choose a shipment.';
      body = { kind, source: 'dispatcher', confidence: 1, shipment_id: shipment, delay_min: Number(delay), label: `Pickup delay on ${shipment}` };
    } else if (kind === 'truck_out') {
      if (trucks.length === 0) er.truck_ids = 'Choose at least one truck.';
      body = { kind, source: 'dispatcher', confidence: 1, truck_ids: trucks, label: `${trucks.join(' and ')} out of service` };
    } else {
      const w = warehouse || network?.warehouses[0]?.id || '';
      if (!w) er.warehouse_id = 'Choose a warehouse.';
      if (!inRange(Number(cut), 10, 100)) er.capacity_cut = 'Docks lost must be 10 to 100%.';
      body = { kind, source: 'dispatcher', confidence: 1, warehouse_id: w, capacity_cut: Number(cut) / 100, label: `${w} docks cut ${cut}%` };
    }
    setErrors(er);
    if (Object.keys(er).length) return;
    await onSubmit(body);
  };

  const err = (f: string) => errors[f] ?? (serverError?.field === f ? serverError.message : null);

  return (
    <form className="cond-form" onSubmit={submit} noValidate>
      <Field id="oc-kind" label="Change">
        <select id="oc-kind" value={kind} onChange={(e) => setKind(e.target.value as OtherKind)}>
          <option value="pickup_delay">Pickup delay</option>
          <option value="truck_out">Truck out of service</option>
          <option value="dock_cut">Warehouse docks cut</option>
        </select>
      </Field>
      {kind === 'pickup_delay' && (
        <div className="form-row">
          <Field id="oc-ship" label="Shipment" error={err('shipment_id')}>
            <select id="oc-ship" value={shipment} onChange={(e) => setShipment(e.target.value)}>
              {board.shipments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}
                </option>
              ))}
            </select>
          </Field>
          <Field id="oc-delay" label="Delay, min" error={err('delay_min')}>
            <input
              id="oc-delay"
              inputMode="numeric"
              value={delay}
              onChange={(e) => setDelay(e.target.value)}
              aria-invalid={!!err('delay_min')}
              aria-describedby={describedBy('oc-delay', err('delay_min'))}
            />
          </Field>
        </div>
      )}
      {kind === 'truck_out' && (
        <fieldset className="truck-pick" aria-describedby={err('truck_ids') ? 'oc-trucks-err' : undefined}>
          <legend className="label">Trucks</legend>
          {(network?.trucks ?? []).map((t) => (
            <label key={t.id}>
              <input
                type="checkbox"
                checked={trucks.includes(t.id)}
                onChange={(e) => setTrucks((xs) => (e.target.checked ? [...xs, t.id] : xs.filter((x) => x !== t.id)))}
              />{' '}
              <span className="mono">{t.id}</span>
            </label>
          ))}
          {!network && <span className="form-hint">Loading trucks…</span>}
          {err('truck_ids') && (
            <span className="field-error" id="oc-trucks-err" role="alert">
              {err('truck_ids')}
            </span>
          )}
        </fieldset>
      )}
      {kind === 'dock_cut' && (
        <div className="form-row">
          <Field id="oc-wh" label="Warehouse" error={err('warehouse_id')}>
            <select id="oc-wh" value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
              {(network?.warehouses ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.id}, {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="oc-cut" label="Docks lost, %" error={err('capacity_cut')}>
            <input
              id="oc-cut"
              inputMode="numeric"
              value={cut}
              onChange={(e) => setCut(e.target.value)}
              aria-invalid={!!err('capacity_cut')}
              aria-describedby={describedBy('oc-cut', err('capacity_cut'))}
            />
          </Field>
        </div>
      )}
      <button type="submit" className="btn" disabled={busy || disabled}>
        {busy ? 'Adding…' : 'Add as unverified'}
      </button>
      {leftover(serverError, ['shipment_id', 'delay_min', 'truck_ids', 'warehouse_id', 'capacity_cut']) && (
        <p className="inline-error" role="alert">
          {leftover(serverError, ['shipment_id', 'delay_min', 'truck_ids', 'warehouse_id', 'capacity_cut'])}
        </p>
      )}
    </form>
  );
}
