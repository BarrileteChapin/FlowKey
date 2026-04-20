import React from 'react';
import type { FlowNode } from '../../src/types';
import './NodeCard.css';

const NODE_COLORS: Record<string, string> = {
  command: 'var(--node-command)',
  terminal: 'var(--node-terminal)',
  condition: 'var(--node-condition)',
  notification: 'var(--node-notification)',
  delay: 'var(--node-delay)',
};

const NODE_ICONS: Record<string, string> = {
  command: 'terminal',
  terminal: 'console',
  condition: 'git-compare',
  notification: 'bell',
  delay: 'watch',
};

interface NodeCardProps {
  node: FlowNode;
  selected: boolean;
  onSelect: (nodeId: string) => void;
  onDragStart?: (e: React.DragEvent, nodeId: string) => void;
}

function getNodeLabel(node: FlowNode): string {
  if (node.data.label) return String(node.data.label);
  if (node.type === 'command') return String(node.data.commandId ?? 'Command');
  if (node.type === 'terminal') return String(node.data.command ?? 'Terminal');
  if (node.type === 'notification') return String(node.data.message ?? 'Notification');
  if (node.type === 'delay') return `Delay ${node.data.ms ?? 0}ms`;
  if (node.type === 'condition') return 'Condition';
  return node.type;
}

function getNodeMeta(node: FlowNode): string {
  if (node.type === 'command') return String(node.data.commandId ?? '');
  if (node.type === 'terminal') return String(node.data.command ?? '');
  if (node.type === 'notification') return String(node.data.severity ?? 'info');
  if (node.type === 'delay') return `${node.data.ms ?? 0}ms`;
  if (node.type === 'condition') {
    return `${node.data.field ?? 'lastStatus'} ${node.data.operator ?? 'equals'} ${node.data.value ?? ''}`;
  }
  return '';
}

export function NodeCard({ node, selected, onSelect, onDragStart }: NodeCardProps) {
  const color = NODE_COLORS[node.type] ?? 'var(--node-command)';
  const icon = NODE_ICONS[node.type] ?? 'symbol-event';
  const nodeMeta = getNodeMeta(node);

  return (
    <div
      className={`node-card ${selected ? 'node-card--selected' : ''}`}
      style={{ '--node-type-color': color } as React.CSSProperties}
      role="button"
      tabIndex={0}
      aria-label={getNodeLabel(node)}
      onClick={() => onSelect(node.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(node.id); }}
      draggable
      onDragStart={(e) => onDragStart?.(e, node.id)}
    >
      <div className="node-card__type-bar">{node.type}</div>
      <div className="node-card__body">
        <div className="node-card__header">
          <i className={`codicon codicon-${icon}`} aria-hidden="true" />
          <span className="node-card__title">{getNodeLabel(node)}</span>
        </div>
        <span className="node-card__meta" title={nodeMeta}>{nodeMeta}</span>
      </div>
    </div>
  );
}
