// "Notify and ask": one unverified report at a time, oldest first. Not a modal: the dispatcher can
// keep reading the board and map while deciding.
import { useState } from 'react';
import { ApiError, updateDisruption } from '../api/client';
import type { Board, Verification } from '../api/types';
import { SOURCE_WORD } from '../lib/mapStyle';
import { KIND_WORD } from './Conditions';
import './VerifyPrompt.css';

interface Props {
  board: Board;
  apply: (request: () => Promise<Board>) => Promise<Board>;
}

export function VerifyPrompt({ board, apply }: Props) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<Verification | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queue = board.pending_verification_ids.filter((id) => !skipped.includes(id));
  const d = board.disruptions.find((x) => x.id === queue[0]);
  if (!d) return null;

  const answer = async (verification: Verification) => {
    setBusy(verification);
    setError(null);
    try {
      await apply(() => updateDisruption(d.id, note.trim() ? { verification, note: note.trim() } : { verification }));
      setNote('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The answer could not be saved.');
    } finally {
      setBusy(null);
    }
  };

  const total = board.pending_verification_ids.length;
  const position = total - queue.length + 1;

  return (
    <section className="verify" aria-labelledby="verify-h" aria-live="polite">
      <div className="verify-head">
        <h2 id="verify-h">Is this report true?</h2>
        {total > 1 && (
          <span className="verify-count">
            {position} of {total}
          </span>
        )}
      </div>
      <p className="verify-report">
        <span className="verify-kind">{KIND_WORD[d.kind]}:</span> {d.label}
      </p>
      <dl className="verify-facts">
        <dt>Source</dt>
        <dd>{SOURCE_WORD[d.source]}</dd>
        <dt>Confidence</dt>
        <dd className="mono">{Math.round(d.confidence * 100)}%</dd>
        <dt>Affects</dt>
        <dd className="mono">{d.affected_shipment_ids.length ? d.affected_shipment_ids.join(', ') : 'no shipment'}</dd>
      </dl>
      <p className="verify-explain">
        Until you answer, affected arrivals assume a {Math.round(d.confidence * 100)}% chance it is true and are marked unverified.
      </p>
      <div className="field">
        <label htmlFor={`verify-note-${d.id}`}>Note (optional)</label>
        <input
          id={`verify-note-${d.id}`}
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Caltrans QuickMap shows it open"
        />
      </div>
      <div className="verify-actions">
        <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => answer('confirmed')}>
          {busy === 'confirmed' ? 'Confirming…' : 'Confirm'}
        </button>
        <button type="button" className="btn" disabled={busy !== null} onClick={() => answer('dismissed')}>
          {busy === 'dismissed' ? 'Dismissing…' : 'Dismiss, not true'}
        </button>
        <button
          type="button"
          className="btn btn-quiet"
          disabled={busy !== null}
          onClick={() => {
            setSkipped((s) => [...s, d.id]);
            setNote('');
          }}
        >
          Leave unverified
        </button>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
