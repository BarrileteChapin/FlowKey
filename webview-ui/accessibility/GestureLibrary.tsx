import React from 'react';
import type { GestureBinding, GestureReference } from '../../src/types';
import './GestureLibrary.css';

interface GestureLibraryProps {
  bindings: GestureBinding[];
  references: GestureReference[];
  onDelete: (gestureId: string) => void;
  onSelect: (gestureId: string) => void;
  selectedId?: string | null;
}

function renderMiniStroke(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  // Normalise to fit in 40×40 viewBox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const scale = 36 / Math.max(w, h);
  return points.map((p) => `${2 + (p.x - minX) * scale},${2 + (p.y - minY) * scale}`).join(' ');
}

export function GestureLibrary({ bindings, references, onDelete, onSelect, selectedId }: GestureLibraryProps) {
  const noBindings = bindings.length === 0;

  return (
    <div className="gesture-library" aria-label="Gesture library">
      {references.length > 0 && (
        <div className="gesture-library__section">
          <div className="gesture-library__section-title">Available Figures</div>
          <div className="gesture-library__reference-grid" role="list" aria-label="Available gesture figures">
            {references.map((reference) => (
              <button
                key={reference.id}
                className={`gesture-library__reference ${selectedId === reference.id ? 'gesture-library__reference--selected' : ''}`}
                onClick={() => onSelect(reference.id)}
                aria-label={`Show ${reference.label} figure`}
                title={reference.label}
              >
                <svg className="gesture-library__preview" viewBox="0 0 40 40" aria-hidden="true">
                  <polyline points={renderMiniStroke(reference.points)} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                </svg>
                <span>{reference.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="gesture-library__section">
        <div className="gesture-library__section-title">Your Bindings</div>
        {noBindings && (
          <div className="gesture-library gesture-library--empty">
            <i className="codicon codicon-gesture" aria-hidden="true" />
            <p className="gesture-library__empty-title">No gesture bindings configured.</p>
            <p className="gesture-library__empty-copy">Pick an available figure above, then link it to a HUD tile action to create your first gesture shortcut.</p>
          </div>
        )}
        {!noBindings && (
          <div role="list" aria-label="Gesture bindings">
            {bindings.map((binding) => (
              <div
                key={binding.gestureId}
                className={`gesture-library__item ${selectedId === binding.gestureId ? 'gesture-library__item--selected' : ''}`}
                role="listitem"
                onClick={() => onSelect(binding.gestureId)}
              >
                <svg className="gesture-library__preview" viewBox="0 0 40 40">
                  <polyline points={renderMiniStroke(binding.points)} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                </svg>
                <div className="gesture-library__info">
                  <span className="gesture-library__label">{binding.label}</span>
                  <span className="gesture-library__action">{binding.action.ref}</span>
                </div>
                <button
                  className="gesture-library__delete"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(binding.gestureId);
                  }}
                  aria-label={`Delete ${binding.label} binding`}
                  title={`Remove ${binding.label} binding`}
                >
                  <i className="codicon codicon-trash" aria-hidden="true" />
                  <span>Remove</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
