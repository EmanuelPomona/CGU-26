import { useState } from 'react';
import { ApiError, deleteDecision } from '../api/client';
import type { Board } from '../api/types';
import { clock } from '../lib/format';
import { STATUS_WORD } from './Board';
import { SupervisorUpdate } from './SupervisorUpdate';

export function DecisionLog({ board, apply }: { board: Board; apply: (r: () => Promise<Board>) => Promise<Board> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const decisions = [...board.decisions].sort((a, b) => a.seq - b.seq);

  const undo = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await apply(() => deleteDecision(id));
    } catch (e) {
      setError({ id, message: e instanceof ApiError ? e.message : 'Undo failed.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="log" aria-labelledby="log-h">
      <h2 id="log-h">Decision log</h2>
      {decisions.length === 0 ? (
        <p className="log-empty">No decisions yet.</p>
      ) : (
        <ol className="log-list">
          {decisions.map((d) => (
            <li key={d.id} className="log-item">
              <div className="log-line">
                <span className="mono log-time">{clock(d.decided_at_clock_min)}</span>
                <span className="mono log-id">{d.shipment_id}</span>
                <span className="log-title">{d.option_title}</span>
                <button
                  type="button"
                  className="btn btn-quiet log-undo"
                  disabled={busy !== null}
                  aria-label={`Undo ${d.option_title} for ${d.shipment_id}`}
                  onClick={() => undo(d.id)}
                >
                  {busy === d.id ? 'Undoing…' : 'Undo'}
                </button>
              </div>
              <p className="log-why">{d.was_suggested ? 'Suggested response' : `Override: ${d.reason ?? ''}`}</p>
              <p className="log-change">
                <span className={`status-${d.before.status}`}>{STATUS_WORD[d.before.status]}</span>
                {' before, '}
                <span className={`status-${d.after.status}`}>{STATUS_WORD[d.after.status]}</span>
                {' after'}
                {d.also_affects.length > 0 && `; also changes ${d.also_affects.join(', ')}`}
              </p>
              <details className="log-sup">
                <summary>Supervisor update</summary>
                <SupervisorUpdate decision={d} compact />
              </details>
              {error?.id === d.id && (
                <p className="inline-error" role="alert">
                  {error.message}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
