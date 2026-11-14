import type { DragEvent } from 'react';
import { OBSTACLES, type ObstacleType } from './obstacleCatalog';

const MIME = 'application/x-dispatch-obstacle';

export function ObstaclePalette(props: {
  selected: ObstacleType | null;
  onSelect: (t: ObstacleType | null) => void;
  disabled?: boolean;
}) {
  const { selected, onSelect, disabled } = props;

  const onDragStart = (type: ObstacleType) => (e: DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData(MIME, type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const onChipClick = (type: ObstacleType) => {
    if (disabled) return;
    onSelect(selected === type ? null : type);
  };

  return (
    <div className={`obstacle-palette${disabled ? ' is-disabled' : ''}`} role="group" aria-label="Obstacles">
      <div className="obstacle-palette-label">Obstacles</div>
      <div className="obstacle-palette-chips">
        {OBSTACLES.map((o) => {
          const on = selected === o.type;
          return (
            <button
              key={o.type}
              type="button"
              className={`obstacle-chip${on ? ' on' : ''}`}
              data-obstacle-type={o.type}
              draggable={!disabled}
              aria-grabbed={on}
              aria-pressed={on}
              disabled={disabled}
              onDragStart={onDragStart(o.type)}
              onClick={() => onChipClick(o.type)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {selected && <div className="obstacle-palette-hint">Click a route on the map to place · Esc to cancel</div>}
    </div>
  );
}

export { MIME as OBSTACLE_MIME };
