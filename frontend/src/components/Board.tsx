// The shipment board: one ruled row per movement, fixed columns, status word at the row's end
// (reference: airport departures board).
import type { KeyboardEvent } from 'react';
import type { Board as BoardData, Network, ShipmentRow } from '../api/types';
import { clock } from '../lib/format';
import type { StripScale } from '../lib/strip';
import { AppointmentStrip, StripAxis } from './AppointmentStrip';
import './Board.css';

export const STATUS_WORD = { on_time: 'On time', tight: 'Tight', at_risk: 'At risk' } as const;

interface Props {
  board: BoardData;
  network: Network | null;
  scale: StripScale;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function Board({ board, network, scale, selectedId, onSelect }: Props) {
  const driver = (truckId: string | null) =>
    truckId ? (network?.trucks.find((t) => t.id === truckId)?.driver_label ?? '') : '';
  const atRisk = board.shipments.filter((s) => s.current.status === 'at_risk').length;

  return (
    <div className="board">
      <div className="board-title">
        <h2>Shipments today</h2>
        <p>
          {board.shipments.length} moves
          {atRisk > 0 && (
            <>
              , <strong className="board-title-risk">{atRisk} at risk</strong>
            </>
          )}
        </p>
      </div>
      <div className="board-grid" role="grid" aria-label="Shipments" aria-rowcount={board.shipments.length + 1}>
        <div className="board-row board-head" role="row">
          <span role="columnheader">Container</span>
          <span role="columnheader">Cargo</span>
          <span role="columnheader">From, to</span>
          <span role="columnheader">Truck</span>
          <span role="columnheader">Window</span>
          <span role="columnheader">Arrival</span>
          <span role="columnheader" className="col-strip">
            <span className="visually-hidden">Arrival against window</span>
            <StripAxis scale={scale} />
          </span>
          <span role="columnheader" className="col-status">Status</span>
        </div>
        {board.shipments.map((s) => (
          <Row
            key={s.id}
            row={s}
            driver={driver(s.current.truck_id)}
            scale={scale}
            selected={s.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  row,
  driver,
  scale,
  selected,
  onSelect,
}: {
  row: ShipmentRow;
  driver: string;
  scale: StripScale;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const c = row.current;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(row.id);
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      const next = (e.key === 'ArrowDown' ? el.nextElementSibling : el.previousElementSibling) as HTMLElement | null;
      if (next?.dataset.rowId) next.focus();
    }
  };
  const shifted = c.appt_shift_min > 0;

  return (
    <div
      className="board-row"
      role="row"
      tabIndex={0}
      aria-selected={selected}
      data-row-id={row.id}
      data-attention={row.attention}
      data-status={c.status}
      onClick={() => onSelect(row.id)}
      onKeyDown={onKey}
    >
      <span role="gridcell" className="col-id mono">
        {row.id}
      </span>
      <span role="gridcell" className="col-cargo">
        <span className="cargo-name">{row.cargo}</span>
        {row.priority === 'high' && <span className="cargo-priority">High priority</span>}
      </span>
      <span role="gridcell" className="col-lane mono">
        {row.terminal_id}
        <span className="lane-sep" aria-hidden="true">
          {' '}
          to{' '}
        </span>
        <span className="visually-hidden"> to </span>
        {row.warehouse_id}
      </span>
      <span role="gridcell" className="col-truck">
        {c.truck_id ? (
          <>
            <span className="mono">{c.truck_id}</span>
            <span className="truck-driver">{driver}</span>
          </>
        ) : (
          <span className="truck-none">No truck</span>
        )}
      </span>
      <span role="gridcell" className="col-window mono">
        <span>{clock(c.appt_start_min)}</span>
        <span className="window-to">to {clock(c.appt_end_min)}</span>
        {shifted && <span className="window-moved">moved {c.appt_shift_min} min</span>}
      </span>
      <span role="gridcell" className="col-eta mono">
        <span className="eta-est">est.</span> {clock(c.eta_min)}
        {c.late_min > 0 && <span className="eta-late">{c.late_min} min late</span>}
      </span>
      <span role="gridcell" className="col-strip">
        <AppointmentStrip evaluation={c} normal={row.normal} scale={scale} />
      </span>
      <span role="gridcell" className="col-status">
        <span className={`status-word status-${c.status}`}>{STATUS_WORD[c.status]}</span>
        {c.needs_review && <span className="status-unverified">Unverified</span>}
        {row.decision_id && <span className="status-decided">Response chosen</span>}
      </span>
    </div>
  );
}

/** Loading rows at the final column widths, so the layout does not move when data arrives. */
export function BoardSkeleton() {
  const w = ['70%', '80%', '75%', '60%', '85%', '70%', '100%', '80%'];
  return (
    <div className="board" aria-busy="true">
      <div className="board-title">
        <h2>Shipments today</h2>
        <p>Loading</p>
      </div>
      <div className="board-grid" role="grid" aria-label="Shipments, loading">
        <div className="board-row board-head" role="row">
          {['Container', 'Cargo', 'From, to', 'Truck', 'Window', 'Arrival', '', 'Status'].map((h, i) => (
            <span key={i} role="columnheader" className={i === 7 ? 'col-status' : undefined}>
              {h}
            </span>
          ))}
        </div>
        {Array.from({ length: 7 }, (_, r) => (
          <div key={r} className="board-row board-row-skel" role="row">
            {w.map((width, c) => (
              <span key={c} role="gridcell" className={c === 7 ? 'col-status' : undefined}>
                <span className="skel" style={{ width }} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
