import React from 'react';
import type { FlowNode } from '../../src/types';
import './Inspector.css';

interface InspectorProps {
  node: FlowNode | null;
  availableCommands: string[];
  onChange: (nodeId: string, data: Record<string, unknown>) => void;
  onClose: () => void;
  onDeleteNode: (nodeId: string) => void;
}

export function Inspector({ node, availableCommands, onChange, onClose, onDeleteNode }: InspectorProps) {
  if (!node) {
    return (
      <div className="inspector inspector--empty">
        <p>Select a node to inspect.</p>
      </div>
    );
  }

  const update = (key: string, value: unknown) => {
    onChange(node.id, { ...node.data, [key]: value });
  };

  const selectCommandId = (commandId: string) => {
    update('commandId', commandId);
  };

  const commandIdValue = String(node.data.commandId ?? '');
  const commandIsKnown = commandIdValue.length === 0 || availableCommands.includes(commandIdValue);

  return (
    <div className="inspector" role="form" aria-label="Node inspector">
      <div className="inspector__header">
        <div className="inspector__header-info">
          <h3 className="inspector__title">Inspector</h3>
          <span className="inspector__subtitle">{node.type} node</span>
        </div>
        <button className="inspector__close" onClick={onClose} aria-label="Close inspector" title="Close">
          <i className="codicon codicon-close" aria-hidden="true" />
        </button>
      </div>

      <div className="inspector__divider" />

      <label className="inspector__field">
        <span>Label</span>
        <input
          type="text"
          value={String(node.data.label ?? '')}
          onChange={(e) => update('label', e.target.value)}
          placeholder={node.type}
        />
      </label>

      {node.type === 'command' && (
        <>
          <label className="inspector__field">
            <span>Command ID</span>
            <input
              type="text"
              list="flowkey-command-list"
              value={commandIdValue}
              onChange={(e) => update('commandId', e.target.value)}
              placeholder="Select or type command id"
            />
            <datalist id="flowkey-command-list">
              {availableCommands.map((command) => (
                <option key={command} value={command} />
              ))}
            </datalist>
          </label>
          {availableCommands.length > 0 && (
            <div className="inspector__command-picker" role="list" aria-label="Available command IDs">
              {availableCommands.map((command) => (
                <button
                  key={command}
                  type="button"
                  className={`inspector__command-option ${command === commandIdValue ? 'inspector__command-option--selected' : ''}`}
                  onClick={() => selectCommandId(command)}
                  title={command}
                >
                  {command}
                </button>
              ))}
            </div>
          )}
          <p className="inspector__hint">
            Only whitelisted command IDs are executable.
          </p>
          {!commandIsKnown && (
            <p className="inspector__warning">
              This command is currently blocked. Add it in FlowKey sidebar settings under Command Access.
            </p>
          )}
        </>
      )}

      {node.type === 'terminal' && (
        <label className="inspector__field">
          <span>Script</span>
          <textarea
            value={String(node.data.command ?? '')}
            onChange={(e) => update('command', e.target.value)}
            placeholder="#!/bin/bash\nnpm run build"
          />
        </label>
      )}

      {node.type === 'condition' && (
        <>
          <label className="inspector__field">
            <span>Field</span>
            <select
              value={String(node.data.field ?? 'lastStatus')}
              onChange={(e) => update('field', e.target.value)}
            >
              <option value="lastStatus">Last Status</option>
              <option value="lastError">Last Error</option>
            </select>
          </label>
          <label className="inspector__field">
            <span>Operator</span>
            <select
              value={String(node.data.operator ?? 'equals')}
              onChange={(e) => update('operator', e.target.value)}
            >
              <option value="equals">Equals</option>
              <option value="notEquals">Not Equals</option>
              <option value="contains">Contains</option>
            </select>
          </label>
          <label className="inspector__field">
            <span>Value</span>
            <input
              type="text"
              value={String(node.data.value ?? '')}
              onChange={(e) => update('value', e.target.value)}
            />
          </label>
        </>
      )}

      {node.type === 'notification' && (
        <>
          <label className="inspector__field">
            <span>Message</span>
            <input
              type="text"
              value={String(node.data.message ?? '')}
              onChange={(e) => update('message', e.target.value)}
            />
          </label>
          <label className="inspector__field">
            <span>Severity</span>
            <select
              value={String(node.data.severity ?? 'info')}
              onChange={(e) => update('severity', e.target.value)}
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </label>
        </>
      )}

      {node.type === 'delay' && (
        <label className="inspector__field">
          <span>Delay (ms)</span>
          <input
            type="number"
            value={String(node.data.ms ?? 0)}
            onChange={(e) => update('ms', Number(e.target.value))}
            min={0}
            step={100}
          />
        </label>
      )}

      <button
        className="inspector__delete"
        onClick={() => onDeleteNode(node.id)}
        aria-label="Delete node"
      >
        Delete Node
      </button>
    </div>
  );
}
