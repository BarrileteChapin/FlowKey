import React from 'react';
import type { Flow } from '../../src/types';
import './FlowToolbar.css';

interface FlowToolbarProps {
  flow: Flow | null;
  zoom: number;
  onNew: () => void;
  onLoadExamples: () => void;
  onRenameFlow: (name: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onRun: () => void;
  onSave: () => void;
  onDryRun: () => void;
  onClear: () => void;
  onDelete: () => void;
  onExit: () => void;
  onOpenSettings: () => void;
}

export function FlowToolbar({
  flow,
  zoom,
  onNew,
  onLoadExamples,
  onRenameFlow,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onRun,
  onSave,
  onDryRun,
  onClear,
  onDelete,
  onExit,
  onOpenSettings,
}: FlowToolbarProps) {
  const nodeCount = flow?.nodes.length ?? 0;
  const flowStateLabel = !flow
    ? 'No flow selected'
    : nodeCount === 0
      ? 'Blank canvas'
      : `${nodeCount} node${nodeCount === 1 ? '' : 's'}`;

  return (
    <div className="flow-toolbar" role="toolbar" aria-label="Flow toolbar">
      <div className="flow-toolbar__left">
        <label className="flow-toolbar__name-wrap">
          <span className="flow-toolbar__name-label">Flow</span>
          <input
            className="flow-toolbar__name"
            value={flow?.name ?? ''}
            onChange={(e) => onRenameFlow(e.target.value)}
            placeholder="Flow name"
            disabled={!flow}
            aria-label="Flow name"
          />
        </label>
        <span className="flow-toolbar__state" aria-live="polite">{flowStateLabel}</span>
        <div className="flow-toolbar__zoom">
          <button
            className="flow-toolbar__zoom-btn"
            onClick={onZoomOut}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <i className="codicon codicon-zoom-out" aria-hidden="true" />
          </button>
          <button
            className="flow-toolbar__zoom-reset"
            onClick={onZoomReset}
            aria-label="Reset zoom"
            title="Reset zoom (Ctrl/Cmd+0)"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            className="flow-toolbar__zoom-btn"
            onClick={onZoomIn}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <i className="codicon codicon-zoom-in" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="flow-toolbar__right">
        <button
          className="flow-toolbar__pill flow-toolbar__pill--new"
          onClick={onNew}
          title="Start a new blank flow"
        >
          <i className="codicon codicon-add" aria-hidden="true" /> New Flow
        </button>
        <button
          className="flow-toolbar__pill flow-toolbar__pill--preview"
          onClick={onLoadExamples}
          title="Load example flows"
        >
          <i className="codicon codicon-library" aria-hidden="true" /> Load Examples
        </button>
        <button
          className="flow-toolbar__pill flow-toolbar__pill--run"
          onClick={onRun}
          disabled={!flow || flow.nodes.length === 0}
          title="Run Flow"
        >
          <i className="codicon codicon-play" aria-hidden="true" /> Run
        </button>
        <button
          className="flow-toolbar__pill flow-toolbar__pill--preview"
          onClick={onDryRun}
          disabled={!flow || flow.nodes.length === 0}
          title="Run Preview"
        >
          <i className="codicon codicon-beaker" aria-hidden="true" /> Run Preview
        </button>
        <button
          className="flow-toolbar__pill flow-toolbar__pill--save"
          onClick={onSave}
          disabled={!flow}
          title="Save Action"
        >
          <i className="codicon codicon-save" aria-hidden="true" /> Save Action
        </button>
        <button
          className="flow-toolbar__pill flow-toolbar__pill--preview"
          onClick={onOpenSettings}
          title="Open FlowKey settings"
        >
          <i className="codicon codicon-gear" aria-hidden="true" /> Open Settings
        </button>
        <button
          className="flow-toolbar__pill flow-toolbar__pill--clear"
          onClick={onClear}
          disabled={!flow || flow.nodes.length === 0}
          title="Clear nodes and connections from the current flow"
        >
          <i className="codicon codicon-clear-all" aria-hidden="true" /> Clear Flow
        </button>
        <button
          className="flow-toolbar__pill flow-toolbar__pill--delete"
          onClick={onDelete}
          disabled={!flow}
          title="Delete saved flow"
        >
          <i className="codicon codicon-trash" aria-hidden="true" /> Delete Flow
        </button>
        <button
          className="flow-toolbar__pill flow-toolbar__pill--exit"
          onClick={onExit}
          title="Exit Flow Editor"
        >
          <i className="codicon codicon-close" aria-hidden="true" /> Exit
        </button>
      </div>
    </div>
  );
}
