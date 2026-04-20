import React, { useRef, useCallback, useState } from 'react';
import type { FlowNode, FlowEdge } from '../../src/types';
import { NodeCard } from './NodeCard';
import './Canvas.css';

interface CanvasProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  zoom: number;
  onZoomDelta: (delta: number) => void;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onAddEdge: (sourceId: string, targetId: string, label?: string) => void;
}

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 72;

export function Canvas({
  nodes,
  edges,
  zoom,
  onZoomDelta,
  selectedNodeId,
  onSelectNode,
  onMoveNode,
  onAddEdge,
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const [connecting, setConnecting] = useState<{ sourceId: string; x: number; y: number } | null>(null);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [panning, setPanning] = useState<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const toCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [pan.x, pan.y, zoom]);

  const getNodePos = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      return node ? node.position : { x: 0, y: 0 };
    },
    [nodes],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();

      if (e.button === 2) {
        // Right click → start connecting
        e.preventDefault();
        const pos = getNodePos(nodeId);
        setConnecting({ sourceId: nodeId, x: pos.x + NODE_WIDTH, y: pos.y + NODE_HEIGHT / 2 });
        return;
      }
      const point = toCanvasPoint(e.clientX, e.clientY);
      if (!point) return;
      const pos = getNodePos(nodeId);
      setDragging({ nodeId, offsetX: point.x - pos.x, offsetY: point.y - pos.y });
    },
    [getNodePos, toCanvasPoint],
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.button !== 1) {
        return;
      }

      const target = e.target as HTMLElement | null;
      if (target?.closest('.canvas__node-wrapper')) {
        return;
      }

      e.preventDefault();
      setPanning({
        startX: e.clientX,
        startY: e.clientY,
        originX: pan.x,
        originY: pan.y,
      });
    },
    [pan.x, pan.y],
  );

  const handleNodeClick = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      if (!e.shiftKey) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (connecting) {
        if (connecting.sourceId !== nodeId) {
          onAddEdge(connecting.sourceId, nodeId);
        }
        setConnecting(null);
        return;
      }

      const pos = getNodePos(nodeId);
      setConnecting({ sourceId: nodeId, x: pos.x + NODE_WIDTH, y: pos.y + NODE_HEIGHT / 2 });
    },
    [connecting, getNodePos, onAddEdge],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const point = toCanvasPoint(e.clientX, e.clientY);
      if (!point) return;

      if (dragging) {
        const x = Math.max(0, point.x - dragging.offsetX);
        const y = Math.max(0, point.y - dragging.offsetY);
        onMoveNode(dragging.nodeId, x, y);
      }

      if (panning) {
        setPan({
          x: panning.originX + (e.clientX - panning.startX),
          y: panning.originY + (e.clientY - panning.startY),
        });
      }

      if (connecting) {
        setConnecting({ ...connecting, x: point.x, y: point.y });
      }
    },
    [dragging, connecting, onMoveNode, panning, toCanvasPoint],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (connecting) {
        // Find if dropped on a node
        const point = toCanvasPoint(e.clientX, e.clientY);
        if (point) {
          const mx = point.x;
          const my = point.y;
          const target = nodes.find(
            (n) => mx >= n.position.x && mx <= n.position.x + NODE_WIDTH && my >= n.position.y && my <= n.position.y + NODE_HEIGHT,
          );
          if (target && target.id !== connecting.sourceId) {
            onAddEdge(connecting.sourceId, target.id);
          }
        }
        setConnecting(null);
      }
      setDragging(null);
      setPanning(null);
    },
    [connecting, nodes, onAddEdge, toCanvasPoint],
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) {
      return;
    }

    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    onZoomDelta(delta);
  }, [onZoomDelta]);

  return (
    <div
      className={`canvas ${panning ? 'canvas--panning' : ''}`}
      ref={canvasRef}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
      role="application"
      aria-label="Flow canvas"
    >
      <div className={`canvas__hint ${connecting ? 'canvas__hint--active' : ''}`}>
        {connecting
          ? 'Select target node to create connection'
          : `Tip: Drag background to pan • Shift+Click to connect • Ctrl/Cmd+Wheel to zoom (${Math.round(zoom * 100)}%)`}
      </div>
      <div className="canvas__viewport" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        <svg className="canvas__edges">
          {edges.map((edge) => {
            const sourcePos = getNodePos(edge.source);
            const targetPos = getNodePos(edge.target);
            const x1 = sourcePos.x + NODE_WIDTH;
            const y1 = sourcePos.y + NODE_HEIGHT / 2;
            const x2 = targetPos.x;
            const y2 = targetPos.y + NODE_HEIGHT / 2;
            return (
              <g key={edge.id}>
                <path className="edge-path" d={bezierPath(x1, y1, x2, y2)} />
                {edge.label && (
                  <text
                    className="edge-label"
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 6}
                    textAnchor="middle"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
          {connecting && (
            <path
              className="edge-path edge-path--active"
              d={bezierPath(
                getNodePos(connecting.sourceId).x + NODE_WIDTH,
                getNodePos(connecting.sourceId).y + NODE_HEIGHT / 2,
                connecting.x,
                connecting.y,
              )}
            />
          )}
        </svg>

        {nodes.map((node) => (
          <div
            key={node.id}
            className="canvas__node-wrapper"
            style={{ transform: `translate(${node.position.x}px, ${node.position.y}px)` }}
            onMouseDown={(e) => handleMouseDown(e, node.id)}
            onClick={(e) => handleNodeClick(e, node.id)}
          >
            <NodeCard
              node={node}
              selected={node.id === selectedNodeId}
              onSelect={onSelectNode}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
