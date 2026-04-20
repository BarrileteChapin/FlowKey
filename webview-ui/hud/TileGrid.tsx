import React from 'react';
import type { Tile } from '../../src/types';
import './TileGrid.css';

interface TileGridProps {
  tiles: Tile[];
  gridCols: number;
  gridRows: number;
  density: 'compact' | 'comfortable' | 'spacious';
  tileShape: 'grid' | 'octagon';
  onExecute: (tileId: string) => void;
}

export function TileGrid({ tiles, gridCols, gridRows, density, tileShape, onExecute }: TileGridProps) {
  if (tiles.length === 0) {
    return (
      <div className="tile-grid-empty" role="grid" aria-label="Tile grid">
        <div className="tile-grid-empty__card">
          <i className="codicon codicon-symbol-misc tile-grid-empty__icon" aria-hidden="true" />
          <p className="tile-grid-empty__title">No tiles configured for this profile.</p>
          <p className="tile-grid-empty__copy">Add or bind actions in FlowKey settings or the Flow Editor to turn this profile into a working HUD.</p>
        </div>
      </div>
    );
  }

  const safeCols = Math.max(1, Math.min(6, Math.round(gridCols || 1)));
  const safeRows = Math.max(1, Math.min(4, Math.round(gridRows || 1)));
  const densitySpec = density === 'compact'
    ? { rowHeight: 84, gap: 4 }
    : density === 'spacious'
      ? { rowHeight: 114, gap: 12 }
      : { rowHeight: 96, gap: 8 };
  const maxHeight = safeRows * densitySpec.rowHeight + Math.max(0, safeRows - 1) * densitySpec.gap;

  return (
    <div
      className={`tile-grid tile-grid--${density}`}
      role="grid"
      aria-label="Tile grid"
      style={{
        gridTemplateColumns: `repeat(${safeCols}, 1fr)`,
        maxHeight: `${maxHeight}px`,
      }}
    >
      {tiles.map((tile) => {
        const actionLabel = tile.action.type === 'flow'
          ? 'Flow'
          : tile.action.type === 'terminal'
            ? 'Terminal'
            : 'Command';
        const optionsLabel = (tile.options ?? []).slice(0, 2).join(' • ');

        return (
          <button
            key={tile.id}
            className={`tile ${tileShape === 'octagon' ? 'tile--octagon' : ''}`}
            role="gridcell"
            aria-label={tile.label}
            onClick={() => onExecute(tile.id)}
          >
            <span className="tile__icon-wrap" aria-hidden="true">
              <i className={`tile__icon codicon codicon-${tile.icon}`} aria-hidden="true" />
            </span>
            <span className="tile__label">{tile.label}</span>
            {tile.category && <span className="tile__category">{tile.category}</span>}
            <span className="tile__meta">
              {actionLabel}
              {optionsLabel ? ` • ${optionsLabel}` : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
