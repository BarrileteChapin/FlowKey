import React from 'react';
import type { FlowNode } from '../../src/types';
import './NodePalette.css';

const NODE_TYPES: { type: FlowNode['type']; label: string; desc: string; icon: string; color: string }[] = [
  { type: 'command', label: 'Command', desc: 'Execute action', icon: 'terminal', color: 'var(--node-command)' },
  { type: 'terminal', label: 'Terminal', desc: 'Run script', icon: 'console', color: 'var(--node-terminal)' },
  { type: 'condition', label: 'Logic', desc: 'Branching gate', icon: 'git-compare', color: 'var(--node-condition)' },
  { type: 'notification', label: 'Notify', desc: 'System alert', icon: 'bell', color: 'var(--node-notification)' },
  { type: 'delay', label: 'Delay', desc: 'Pause flow', icon: 'watch', color: 'var(--node-delay)' },
];

interface NodePaletteProps {
  onAddNode: (type: FlowNode['type']) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  return (
    <div className="node-palette" role="toolbar" aria-label="Component palette">
      <span className="node-palette__title">Components</span>
      {NODE_TYPES.map((nt) => (
        <button
          key={nt.type}
          className="node-palette__item"
          onClick={() => onAddNode(nt.type)}
          aria-label={`Add ${nt.label} node`}
          title={nt.label}
        >
          <span className="node-palette__icon" style={{ color: nt.color }}>
            <i className={`codicon codicon-${nt.icon}`} aria-hidden="true" />
          </span>
          <span className="node-palette__info">
            <span className="node-palette__label">{nt.label}</span>
            <span className="node-palette__desc">{nt.desc}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
