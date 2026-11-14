// Response comparison for the selected shipment, the dispatcher's choice, the supervisor update and the
// decision log. The suggestion carries the same visual weight as every other option.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, createDecision, getOptions } from '../api/client';
import type { Board, Decision, OptionsResponse, ResponseOption, Route, ShipmentRow } from '../api/types';
import type { StripScale } from '../lib/strip';
import { DecisionLog } from './DecisionLog';
import { rememberRoute } from './MapView';
import { OptionLabel } from './OptionLabel';
import { SupervisorUpdate } from './SupervisorUpdate';
import './Options.css';

interface Props {
  board: Board;
  row: ShipmentRow | null;
  scale: StripScale;
  apply: (request: () => Promise<Board>) => Promise<Board>;
  setBoard: (b: Board) => void;
  onPreview: (r: Route | null) => void;
  sheet: boolean;
  open: boolean;
}

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: OptionsResponse };

export function Options({ board, row, scale, apply, setBoard, onPreview, sheet, open }: Props) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastDecision, setLastDecision] = useState<Decision | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const seq = useRef(0);
  const rowId = row?.id ?? null;
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchOptions = useCallback(async (id: string) => {
    const n = ++seq.current;
    setLoad((l) => (l.state === 'ready' && l.data.shipment_id === id ? l : { state: 'loading' }));
    try {
      const data = await getOptions(id);
      if (n !== seq.current) return;
      data.options.forEach((o) => rememberRoute(o.route));
      setLoad({ state: 'ready', data });
    } catch (e) {
      if (n === seq.current) setLoad({ state: 'error', message: e instanceof ApiError ? e.message : 'Options could not be loaded.' });
    }
  }, []);

  // Reload whenever the selection or the board changes (conditions, decisions, verification).
  useEffect(() => {
    if (rowId) void fetchOptions(rowId);
  }, [rowId, board, fetchOptions]);

  useEffect(() => {
    setReasonFor(null);
    setReason('');
    setReasonError(null);
    setNotice(null);
    setPicked(null);
    setLastDecision((d) => (d && d.shipment_id === rowId ? d : null));
  }, [rowId]);

  // Sheet: move focus into it when it opens.
  useEffect(() => {
    if (sheet && open && rowId) {
      requestAnimationFrame(() => panelRef.current?.closest('.region-detail')?.querySelector<HTMLElement>('[data-autofocus]')?.focus());
    }
  }, [sheet, open, rowId]);

  const preview = (o: ResponseOption | null) => onPreview(o && o.id !== 'keep' ? o.route : null);

  const choose = async (o: ResponseOption, withReason?: string) => {
    if (!row) return;
    if (!o.suggested && withReason === undefined) {
      if (reasonFor !== o.id) setReason('');
      setReasonFor(o.id);
      setReasonError(null);
      return;
    }
    if (withReason !== undefined) {
      const r = withReason.trim();
      if (r.length < 3 || r.length > 300) {
        setReasonError('Give a reason of 3 to 300 characters.');
        return;
      }
    }
    setSubmitting(o.id);
    setNotice(null);
    try {
      const result = await createDecision({
        shipment_id: row.id,
        option_id: o.id,
        ...(withReason !== undefined ? { reason: withReason.trim() } : {}),
      });
      setBoard(result.board);
      setLastDecision(result.decision);
      setReasonFor(null);
      setReason('');
      setPicked(null);
      onPreview(null);
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      if (err?.status === 409) {
        setNotice(`${err.message} Options have been reloaded.`);
        setReasonFor(null);
        void fetchOptions(row.id);
      } else if (err?.status === 422 && err.field === 'reason') {
        setReasonFor(o.id);
        setReasonError(err.message);
      } else {
        setNotice(err?.message ?? 'The decision could not be saved.');
      }
    } finally {
      setSubmitting(null);
    }
  };

  const busy = submitting !== null;

  const chooseControls = (o: ResponseOption) => {
    if (!o.feasible) {
      return (
        <button type="button" className="btn ol-choose" disabled aria-disabled="true">
          Not available
        </button>
      );
    }
    if (reasonFor === o.id) {
      const id = `reason-${o.id}`;
      return (
        <form
          className="ol-reason"
          onSubmit={(e) => {
            e.preventDefault();
            void choose(o, reason);
          }}
          noValidate
        >
          <div className="field">
            <label htmlFor={id}>Why this response instead of the suggestion?</label>
            <textarea
              id={id}
              rows={2}
              value={reason}
              maxLength={300}
              autoFocus
              aria-invalid={!!reasonError}
              aria-describedby={reasonError ? `${id}-err` : undefined}
              onChange={(e) => setReason(e.target.value)}
            />
            {reasonError && (
              <span id={`${id}-err`} className="field-error" role="alert">
                {reasonError}
              </span>
            )}
          </div>
          <div className="ol-reason-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {submitting === o.id ? 'Saving…' : 'Choose with this reason'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => {
                setReasonFor(null);
                setReason('');
                setReasonError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      );
    }
    return (
      <button
        type="button"
        className="btn btn-primary ol-choose"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          void choose(o);
        }}
      >
        {submitting === o.id ? 'Choosing…' : 'Choose this response'}
      </button>
    );
  };

  if (!row) {
    return (
      <div className="opts" ref={panelRef}>
        <p className="opts-empty">Select a shipment on the board or map to compare responses.</p>
        <DecisionLog board={board} apply={apply} />
      </div>
    );
  }

  const data = load.state === 'ready' && load.data.shipment_id === row.id ? load.data : null;
  const pickedOption = data?.options.find((o) => o.id === picked) ?? null;
  const showDecision = lastDecision && lastDecision.shipment_id === row.id && board.decisions.some((d) => d.id === lastDecision.id);

  return (
    <div className="opts" ref={panelRef}>
      <div className="opts-head">
        <h2>
          Responses for <span className="mono">{row.id}</span>
        </h2>
        <p className="opts-sub">
          {row.cargo}, {row.terminal_id} to {row.warehouse_id}
        </p>
      </div>

      {showDecision && <SupervisorUpdate decision={lastDecision} />}

      {row.attention === 'none' && <p className="opts-note">No action needed. Arrival is inside the window.</p>}
      {notice && (
        <p className="opts-notice" role="alert">
          {notice}
        </p>
      )}

      {load.state === 'loading' && !data && (
        <div className="opts-loading" role="status" aria-label="Loading options">
          {[0, 1].map((i) => (
            <div key={i} className="ol ol-skel">
              <span className="skel" style={{ width: '55%', height: 20 }} />
              <span className="skel" style={{ width: '100%', height: 28 }} />
              {[0, 1, 2, 3, 4].map((j) => (
                <span key={j} className="skel" style={{ width: `${80 - j * 7}%` }} />
              ))}
            </div>
          ))}
        </div>
      )}

      {load.state === 'error' && (
        <div className="opts-error" role="alert">
          <p>{load.message}</p>
          <button type="button" className="btn" onClick={() => void fetchOptions(row.id)}>
            Retry
          </button>
        </div>
      )}

      {data && (
        <>
          <div className="opts-rationale">
            <p>{data.rationale}</p>
            <p className="opts-rule">Rule-based score from your priorities. You decide.</p>
          </div>
          <div className="opts-list" aria-busy={busy}>
            {data.options.map((o) => (
              <OptionLabel
                key={o.id}
                option={o}
                normal={row.normal}
                scale={scale}
                isKeep={o.id === 'keep'}
                onPreview={preview}
                picked={sheet && picked === o.id}
                onPick={sheet && o.feasible ? () => setPicked(o.id) : undefined}
                action={!sheet || reasonFor === o.id ? chooseControls(o) : undefined}
              />
            ))}
          </div>
        </>
      )}

      <DecisionLog board={board} apply={apply} />

      {sheet && data && !reasonFor && (
        <div className="opts-sticky">
          {pickedOption ? (
            <>
              <span className="opts-sticky-title">{pickedOption.title}</span>
              {chooseControls(pickedOption)}
            </>
          ) : (
            <span className="opts-sticky-title">Tap a response to choose it.</span>
          )}
        </div>
      )}
    </div>
  );
}
