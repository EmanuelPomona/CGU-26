// Change a condition (preset, placed on the map, or a non-geographic change), see what is active,
// and return to the normal day. Every change starts unverified (docs/API.md section 3).
import { useEffect, useState } from 'react';
import { ApiError, createDisruption, deleteDisruption, getPresets, postReset, updateDisruption } from '../api/client';
import type { Area, Board, Disruption, DisruptionCreate, Network, Preset } from '../api/types';
import { SOURCE_WORD, VERIFICATION_WORD } from '../lib/mapStyle';
import { DisruptionForm, OtherChangeForm } from './DisruptionForm';
import './Conditions.css';

export interface PlaceDraft {
  kind: 'slowdown' | 'closure' | 'hazard';
  label: string;
  radius_km: number;
  slowdown_factor: number;
  confidence: number;
}

interface Props {
  board: Board;
  network: Network | null;
  apply: (request: () => Promise<Board>) => Promise<Board>;
  placing: PlaceDraft | null;
  placed: Area | null;
  onPlacing: (d: PlaceDraft | null) => void;
}

export const KIND_WORD: Record<Disruption['kind'], string> = {
  slowdown: 'Slowdown',
  closure: 'Closure',
  hazard: 'Hazard area',
  pickup_delay: 'Pickup delay',
  truck_out: 'Truck out',
  dock_cut: 'Dock cut',
};

export function Conditions({ board, network, apply, placing, placed, onPlacing }: Props) {
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ where: string; message: string; field?: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const loadPresets = () => {
    setPresetError(null);
    getPresets()
      .then((r) => setPresets(r.presets))
      .catch((e: unknown) => setPresetError(e instanceof ApiError ? e.message : 'Presets could not be loaded.'));
  };
  useEffect(loadPresets, []);

  const run = async (where: string, request: () => Promise<Board>) => {
    setBusy(where);
    setError(null);
    try {
      await apply(request);
      return true;
    } catch (e) {
      setError({ where, message: e instanceof ApiError ? e.message : 'The request failed.', field: e instanceof ApiError ? e.field : undefined });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const submit = (body: DisruptionCreate, where: string) => run(where, () => createDisruption(body));

  const activeIds = new Set(board.disruptions.filter((d) => d.verification !== 'dismissed').map((d) => d.id));

  return (
    <div className="cond">
      <section className="cond-section" aria-labelledby="cond-presets">
        <h2 id="cond-presets" className="cond-h">What-if presets</h2>
        {presetError && (
          <p className="inline-error">
            {presetError}{' '}
            <button type="button" className="btn btn-quiet" onClick={loadPresets}>
              Retry
            </button>
          </p>
        )}
        {!presets && !presetError && (
          <ul className="preset-list" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i}>
                <span className="skel" style={{ width: '70%' }} />
              </li>
            ))}
          </ul>
        )}
        {presets && (
          <ul className="preset-list">
            {presets.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="preset"
                  data-preset={p.id}
                  disabled={busy !== null}
                  aria-busy={busy === `preset:${p.id}`}
                  onClick={() => submit(p.disruption, `preset:${p.id}`)}
                >
                  <span className="preset-label">{busy === `preset:${p.id}` ? 'Adding…' : p.label}</span>
                  <span className="preset-desc">{p.description}</span>
                </button>
                {error?.where === `preset:${p.id}` && <p className="inline-error" role="alert">{error.message}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cond-section" aria-labelledby="cond-active">
        <h2 id="cond-active" className="cond-h">Changed conditions</h2>
        {board.disruptions.length === 0 ? (
          <p className="cond-empty">No changed conditions. This is the normal day.</p>
        ) : (
          <ul className="dz-list">
            {board.disruptions.map((d) => (
              <li key={d.id} className="dz" data-verification={d.verification}>
                <div className="dz-main">
                  <span className="dz-kind">{KIND_WORD[d.kind]}</span>
                  <span className="dz-label">{d.label}</span>
                  <span className="dz-meta">
                    <span className={`dz-ver dz-ver-${d.verification}`}>{VERIFICATION_WORD[d.verification]}</span>
                    {', '}
                    {d.affected_shipment_ids.length === 0
                      ? 'affects no shipment'
                      : `affects ${d.affected_shipment_ids.length} (${d.affected_shipment_ids.join(', ')})`}
                  </span>
                  <span className="dz-source">{SOURCE_WORD[d.source]}</span>
                  {d.note && <span className="dz-note">Note: {d.note}</span>}
                </div>
                <div className="dz-actions">
                  {d.verification !== 'unverified' && (
                    <button
                      type="button"
                      className="btn btn-quiet"
                      disabled={busy !== null}
                      onClick={() => run(`reopen:${d.id}`, () => updateDisruption(d.id, { verification: 'unverified' }))}
                    >
                      {busy === `reopen:${d.id}` ? 'Re-opening…' : 'Re-open'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-quiet"
                    aria-label={`Remove ${d.label}`}
                    disabled={busy !== null}
                    onClick={() => run(`remove:${d.id}`, () => deleteDisruption(d.id))}
                  >
                    {busy === `remove:${d.id}` ? 'Removing…' : 'Remove'}
                  </button>
                </div>
                {error && (error.where === `remove:${d.id}` || error.where === `reopen:${d.id}`) && (
                  <p className="inline-error" role="alert">{error.message}</p>
                )}
              </li>
            ))}
          </ul>
        )}
        {activeIds.size === 0 && board.disruptions.length > 0 && (
          <p className="cond-empty">Every report was dismissed. Figures are back to the normal day.</p>
        )}
      </section>

      <section className="cond-section" aria-labelledby="cond-place">
        <h2 id="cond-place" className="cond-h">Place a condition on the map</h2>
        <DisruptionForm
          placing={placing}
          placed={placed}
          onPlacing={onPlacing}
          busy={busy === 'place'}
          disabled={busy !== null && busy !== 'place'}
          onSubmit={(body) => submit(body, 'place')}
          serverError={error?.where === 'place' ? error : null}
        />
      </section>

      <section className="cond-section" aria-labelledby="cond-other">
        <h2 id="cond-other" className="cond-h">Other changes</h2>
        <OtherChangeForm
          network={network}
          board={board}
          busy={busy === 'other'}
          disabled={busy !== null && busy !== 'other'}
          onSubmit={(body) => submit(body, 'other')}
          serverError={error?.where === 'other' ? error : null}
        />
      </section>

      <section className="cond-section cond-reset">
        {!confirmReset ? (
          <button type="button" className="btn" disabled={busy !== null} onClick={() => setConfirmReset(true)}>
            Reset to normal day
          </button>
        ) : (
          <div className="reset-confirm" role="group" aria-label="Confirm reset">
            <p>Remove every changed condition and decision?</p>
            <div className="reset-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy !== null}
                onClick={async () => {
                  if (await run('reset', postReset)) setConfirmReset(false);
                }}
              >
                {busy === 'reset' ? 'Resetting…' : 'Yes, reset'}
              </button>
              <button type="button" className="btn" onClick={() => setConfirmReset(false)}>
                Keep the board
              </button>
            </div>
            {error?.where === 'reset' && <p className="inline-error" role="alert">{error.message}</p>}
          </div>
        )}
      </section>
    </div>
  );
}

