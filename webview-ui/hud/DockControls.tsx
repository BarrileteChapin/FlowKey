import React from 'react';
import './DockControls.css';

interface DockControlsProps {
  currentPosition: string;
  onDock: (position: string) => void;
}

const DOCK_OPTIONS = [
  { id: 'float', label: 'Float', icon: 'move' },
  { id: 'top', label: 'Top', icon: 'arrow-up' },
  { id: 'bottom', label: 'Bottom', icon: 'arrow-down' },
  { id: 'left', label: 'Left', icon: 'arrow-left' },
  { id: 'right', label: 'Right', icon: 'arrow-right' },
];

export function DockControls({ currentPosition, onDock }: DockControlsProps) {
  return (
    <div className="dock-controls">
      {DOCK_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          className={`dock-controls__btn ${currentPosition === opt.id ? 'dock-controls__btn--active' : ''}`}
          onClick={() => onDock(opt.id)}
          aria-label={`Dock ${opt.label}`}
          title={opt.label}
        >
          <i className={`codicon codicon-${opt.icon}`} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
