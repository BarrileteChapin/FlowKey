import React, { useState, useEffect, useCallback } from 'react';
import type { Flow, FlowNode, FlowEdge, FlowEditorState } from '../../src/types';
import { Canvas } from './Canvas';
import { NodePalette } from './NodePalette';
import { Inspector } from './Inspector';
import { FlowToolbar } from './FlowToolbar';
import {
  onFlowMessage,
  requestFlows,
  requestWhitelistedCommands,
  bindFlowToTile,
  saveFlow,
  deleteFlow,
  runFlow,
  dryRunFlow,
  openFlowSettings,
  loadExampleFlows,
  closeFlowEditor,
} from './bridge';
import '../shared/tokens.css';
import './App.css';

let idCounter = 0;
function genId(): string {
  return `node-${Date.now()}-${idCounter++}`;
}

function createEmptyFlow(): Flow {
  return {
    id: `flow-${Date.now()}-${idCounter++}`,
    name: 'New Flow',
    nodes: [],
    edges: [],
    confirmedTerminalOnce: false,
  };
}

export function App() {
  const [state, setState] = useState<FlowEditorState | null>(null);
  const [activeFlow, setActiveFlow] = useState<Flow | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [dryRunLog, setDryRunLog] = useState<unknown[] | null>(null);
  const [availableCommands, setAvailableCommands] = useState<string[]>([]);
  const [bindProfileId, setBindProfileId] = useState<string>('');
  const [bindTileId, setBindTileId] = useState<string>('');
  const [bindCategory, setBindCategory] = useState<string>('Automation');
  const [bindOptionsInput, setBindOptionsInput] = useState<string>('');
  const [bindStatus, setBindStatus] = useState<string>('');
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const unsub = onFlowMessage((data) => {
      if (data.type === 'update' && data.state) {
        setState(data.state as FlowEditorState);
      }
      if (data.type === 'flowDryRunResult' && data.result) {
        const r = data.result as { steps?: unknown[] };
        setDryRunLog(r.steps ?? []);
      }
      if (data.type === 'whitelistedCommands' && Array.isArray(data.commands)) {
        setAvailableCommands(data.commands);
      }
    });

    const onVisibilityChange = () => {
      if (!document.hidden) {
        requestWhitelistedCommands();
      }
    };

    requestFlows();
    requestWhitelistedCommands();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      unsub();
    };
  }, []);

  const flows = state?.flows ?? [];
  const profiles = state?.profiles ?? [];
  const selectedProfile = profiles.find((p) => p.id === bindProfileId) ?? null;
  const selectedTile = selectedProfile?.tiles.find((t) => t.id === bindTileId) ?? null;

  useEffect(() => {
    if (profiles.length === 0) {
      setBindProfileId('');
      setBindTileId('');
      return;
    }

    const selectedProfile = profiles.find((p) => p.id === bindProfileId) ?? profiles[0];
    if (selectedProfile.id !== bindProfileId) {
      setBindProfileId(selectedProfile.id);
    }

    const selectedTile = selectedProfile.tiles.find((t) => t.id === bindTileId) ?? selectedProfile.tiles[0];
    if (selectedTile && selectedTile.id !== bindTileId) {
      setBindTileId(selectedTile.id);
    }
    if (!selectedTile) {
      setBindTileId('');
    }
  }, [profiles, bindProfileId, bindTileId]);

  useEffect(() => {
    if (!bindStatus) {
      return;
    }
    const timer = window.setTimeout(() => setBindStatus(''), 2400);
    return () => window.clearTimeout(timer);
  }, [bindStatus]);

  useEffect(() => {
    if (!selectedTile) {
      setBindCategory('');
      setBindOptionsInput('');
      return;
    }

    setBindCategory(selectedTile.category ?? '');
    setBindOptionsInput((selectedTile.options ?? []).join(', '));
  }, [selectedTile]);

  useEffect(() => {
    if (activeFlow) {
      return;
    }

    if (flows.length > 0) {
      const first = flows[0];
      setActiveFlow({ ...first, nodes: [...first.nodes], edges: [...first.edges] });
      setSelectedNodeId(null);
      return;
    }

    // If the workspace has no saved flows yet, start from a blank canvas immediately.
    const blank = createEmptyFlow();
    setActiveFlow(blank);
    setSelectedNodeId(null);
  }, [activeFlow, flows]);

  const handleSelectFlow = useCallback(
    (flowId: string) => {
      const f = flows.find((fl) => fl.id === flowId);
      if (f) {
        setActiveFlow({ ...f, nodes: [...f.nodes], edges: [...f.edges] });
        setSelectedNodeId(null);
        setDryRunLog(null);
      }
    },
    [flows],
  );

  const handleNew = useCallback(() => {
    const f = createEmptyFlow();
    setActiveFlow(f);
    setSelectedNodeId(null);
    setDryRunLog(null);
  }, []);

  const handleAddNode = useCallback(
    (type: FlowNode['type']) => {
      if (!activeFlow) return;
      const node: FlowNode = {
        id: genId(),
        type,
        data: {},
        position: { x: 40 + Math.random() * 200, y: 40 + Math.random() * 200 },
      };
      setActiveFlow({ ...activeFlow, nodes: [...activeFlow.nodes, node] });
    },
    [activeFlow],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (!activeFlow) return;
      setActiveFlow({
        ...activeFlow,
        nodes: activeFlow.nodes.filter((n) => n.id !== nodeId),
        edges: activeFlow.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      });
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    },
    [activeFlow, selectedNodeId],
  );

  const handleMoveNode = useCallback(
    (nodeId: string, x: number, y: number) => {
      if (!activeFlow) return;
      setActiveFlow({
        ...activeFlow,
        nodes: activeFlow.nodes.map((n) => (n.id === nodeId ? { ...n, position: { x, y } } : n)),
      });
    },
    [activeFlow],
  );

  const handleAddEdge = useCallback(
    (sourceId: string, targetId: string, label?: string) => {
      if (!activeFlow) return;

      const exists = activeFlow.edges.some((e) => e.source === sourceId && e.target === targetId);
      if (exists) return;

      const sourceNode = activeFlow.nodes.find((n) => n.id === sourceId);
      const outgoingFromSource = activeFlow.edges.filter((e) => e.source === sourceId);

      let edgeLabel = label;
      if (sourceNode?.type === 'condition') {
        if (outgoingFromSource.length >= 2) {
          return;
        }
        if (outgoingFromSource.length === 0) {
          edgeLabel = 'true';
        } else if (outgoingFromSource.length === 1) {
          edgeLabel = outgoingFromSource[0].label === 'true' ? 'false' : 'true';
        }
      }

      const edge: FlowEdge = { id: genId(), source: sourceId, target: targetId, label: edgeLabel };
      setActiveFlow({ ...activeFlow, edges: [...activeFlow.edges, edge] });
    },
    [activeFlow],
  );

  const handleRenameFlow = useCallback(
    (name: string) => {
      if (!activeFlow) return;
      const nextName = name.trimStart();
      setActiveFlow({ ...activeFlow, name: nextName });
    },
    [activeFlow],
  );

  const handleNodeDataChange = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      if (!activeFlow) return;
      setActiveFlow({
        ...activeFlow,
        nodes: activeFlow.nodes.map((n) => (n.id === nodeId ? { ...n, data } : n)),
      });
    },
    [activeFlow],
  );

  const handleSave = useCallback(() => {
    if (!activeFlow) return;
    const normalized = {
      ...activeFlow,
      name: activeFlow.name.trim().length > 0 ? activeFlow.name.trim() : 'Untitled Flow',
    };
    setActiveFlow(normalized);
    saveFlow(normalized);
  }, [activeFlow]);

  const handleRun = useCallback(() => {
    if (!activeFlow) return;
    const normalized = {
      ...activeFlow,
      name: activeFlow.name.trim().length > 0 ? activeFlow.name.trim() : 'Untitled Flow',
    };
    setActiveFlow(normalized);
    saveFlow(normalized);
    runFlow(normalized.id);
  }, [activeFlow]);

  const handleDryRun = useCallback(() => {
    if (!activeFlow) return;
    const normalized = {
      ...activeFlow,
      name: activeFlow.name.trim().length > 0 ? activeFlow.name.trim() : 'Untitled Flow',
    };
    setActiveFlow(normalized);
    saveFlow(normalized);
    dryRunFlow(normalized.id);
  }, [activeFlow]);

  const handleDelete = useCallback(() => {
    if (activeFlow) {
      deleteFlow(activeFlow.id);
      setActiveFlow(null);
      setSelectedNodeId(null);
    }
  }, [activeFlow]);

  const handleClearFlow = useCallback(() => {
    if (!activeFlow) return;
    setActiveFlow({
      ...activeFlow,
      nodes: [],
      edges: [],
    });
    setSelectedNodeId(null);
    setDryRunLog(null);
  }, [activeFlow]);

  const handleOpenSettings = useCallback(() => {
    openFlowSettings();
  }, []);

  const handleLoadExamples = useCallback(() => {
    loadExampleFlows();
  }, []);

  const handleExitEditor = useCallback(() => {
    closeFlowEditor();
  }, []);

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.1, 2)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.1, 0.3)), []);
  const handleZoomReset = useCallback(() => setZoom(1), []);
  const handleZoomDelta = useCallback((delta: number) => {
    setZoom((z) => Math.max(0.3, Math.min(2, z + delta)));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = (target?.tagName ?? '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }

      const meta = event.ctrlKey || event.metaKey;
      if (!meta) {
        return;
      }

      if (event.key === '=' || event.key === '+') {
        event.preventDefault();
        handleZoomIn();
      } else if (event.key === '-') {
        event.preventDefault();
        handleZoomOut();
      } else if (event.key === '0') {
        event.preventDefault();
        handleZoomReset();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleZoomIn, handleZoomOut, handleZoomReset]);

  const selectedNode = activeFlow?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  const handleBindFlowToTile = useCallback(() => {
    if (!activeFlow || !bindProfileId || !bindTileId) {
      return;
    }

    const category = bindCategory.trim();
    const options = Array.from(
      new Set(
        bindOptionsInput
          .split(',')
          .map((option) => option.trim())
          .filter((option) => option.length > 0),
      ),
    ).slice(0, 8);

    bindFlowToTile(activeFlow.id, bindProfileId, bindTileId, category, options);

    const profileName = selectedProfile?.name ?? bindProfileId;
    const tileLabel = selectedTile?.label ?? bindTileId;
    const details = [category || 'Uncategorized', ...options].join(' • ');
    setBindStatus(`Bound to HUD: ${profileName} / ${tileLabel} (${details})`);
  }, [activeFlow, bindCategory, bindOptionsInput, bindProfileId, bindTileId, selectedProfile, selectedTile]);

  return (
    <div className="flow-editor-shell glass-panel" role="application" aria-label="FlowKey Flow Editor">
      <FlowToolbar
        flow={activeFlow}
        zoom={zoom}
        onNew={handleNew}
        onLoadExamples={handleLoadExamples}
        onRenameFlow={handleRenameFlow}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onRun={handleRun}
        onSave={handleSave}
        onDryRun={handleDryRun}
        onClear={handleClearFlow}
        onDelete={handleDelete}
        onExit={handleExitEditor}
        onOpenSettings={handleOpenSettings}
      />
      <div className="flow-editor-help" role="note" aria-label="Flow editor help">
        <span><strong>1.</strong> Add components from the left panel</span>
        <span><strong>2.</strong> Shift+Click node A then node B to connect</span>
        <span><strong>3.</strong> Condition nodes auto-map first branch to true, second to false</span>
        <span><strong>4.</strong> Click a node to edit its settings on the right</span>
        <span><strong>5.</strong> Drag empty canvas space to pan around your flow</span>
        <span><strong>6.</strong> Ctrl/Cmd + Wheel or +/- to zoom, Ctrl/Cmd+0 to reset</span>
        <span><strong>7.</strong> Use command picker suggestions to avoid blocked command IDs</span>
      </div>

      <div className="flow-bind glass-panel" role="group" aria-label="Bind flow to HUD tile">
        <span className="flow-bind__label">Publish Flow To HUD</span>
        <select
          className="flow-bind__select"
          value={bindProfileId}
          onChange={(e) => setBindProfileId(e.target.value)}
          aria-label="Select profile"
          disabled={profiles.length === 0}
        >
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>{profile.name}</option>
          ))}
        </select>
        <select
          className="flow-bind__select"
          value={bindTileId}
          onChange={(e) => setBindTileId(e.target.value)}
          aria-label="Select tile"
          disabled={!selectedProfile || selectedProfile.tiles.length === 0}
        >
          {(selectedProfile?.tiles ?? []).map((tile) => (
            <option key={tile.id} value={tile.id}>{tile.label}</option>
          ))}
        </select>
        <input
          className="flow-bind__input"
          list="flow-bind-categories"
          value={bindCategory}
          onChange={(e) => setBindCategory(e.target.value)}
          placeholder="Category"
          aria-label="Tile category"
          disabled={!selectedTile}
        />
        <datalist id="flow-bind-categories">
          <option value="Automation" />
          <option value="Navigation" />
          <option value="Debug" />
          <option value="Git" />
          <option value="AI" />
          <option value="Testing" />
          <option value="Custom" />
        </datalist>
        <input
          className="flow-bind__input flow-bind__input--wide"
          value={bindOptionsInput}
          onChange={(e) => setBindOptionsInput(e.target.value)}
          placeholder="Options (comma separated)"
          aria-label="Tile options"
          disabled={!selectedTile}
        />
        <button
          className="flow-bind__btn"
          onClick={handleBindFlowToTile}
          disabled={!activeFlow || !bindProfileId || !bindTileId}
          aria-label="Bind flow to selected HUD tile"
        >
          <i className="codicon codicon-link" aria-hidden="true" /> Bind
        </button>
        {bindStatus && <span className="flow-bind__status">{bindStatus}</span>}
      </div>

      <div className="flow-editor-body">
        <NodePalette onAddNode={handleAddNode} />
        <Canvas
          nodes={activeFlow?.nodes ?? []}
          edges={activeFlow?.edges ?? []}
          zoom={zoom}
          onZoomDelta={handleZoomDelta}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onMoveNode={handleMoveNode}
          onAddEdge={handleAddEdge}
        />
        <Inspector
          node={selectedNode}
          availableCommands={availableCommands}
          onChange={handleNodeDataChange}
          onClose={() => setSelectedNodeId(null)}
          onDeleteNode={handleDeleteNode}
        />
      </div>
      {dryRunLog && (
        <div className="flow-editor-log">
          <h4>Dry Run Preview</h4>
          <ul>
            {(dryRunLog as Array<{ label: string; status: string }>).map((step, i) => (
              <li key={i} className={`log-step log-step--${step.status}`}>
                {step.label} — <em>{step.status}</em>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bottom dock: saved flow selector */}
      <div className="flow-dock" role="navigation" aria-label="Flow dock">
        <div className="flow-dock__flows">
          {flows.length === 0 && <span className="flow-dock__empty">No saved flows yet.</span>}
          {flows.map((f) => (
            <button
              key={f.id}
              className={`flow-dock__chip ${activeFlow?.id === f.id ? 'flow-dock__chip--active' : ''}`}
              onClick={() => handleSelectFlow(f.id)}
              aria-label={f.name}
              title={f.name}
            >
              <i className="codicon codicon-zap" aria-hidden="true" />
              {f.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
