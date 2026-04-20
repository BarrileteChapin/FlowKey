import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Canvas } from '../../webview-ui/flow-editor/Canvas';
import type { FlowNode } from '../../src/types';

const nodes: FlowNode[] = [
  {
    id: 'n1',
    type: 'command',
    data: { label: 'Save', commandId: 'workbench.action.files.save' },
    position: { x: 40, y: 30 },
  },
];

function mockCanvasRect(canvas: HTMLDivElement): void {
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}

describe('Canvas', () => {
  it('pans viewport when dragging empty canvas space', () => {
    const onMoveNode = vi.fn();
    const { container } = render(
      <Canvas
        nodes={nodes}
        edges={[]}
        zoom={1}
        onZoomDelta={vi.fn()}
        selectedNodeId={null}
        onSelectNode={vi.fn()}
        onMoveNode={onMoveNode}
        onAddEdge={vi.fn()}
      />,
    );

    const canvas = container.querySelector('.canvas') as HTMLDivElement;
    const viewport = container.querySelector('.canvas__viewport') as HTMLDivElement;

    mockCanvasRect(canvas);

    fireEvent.mouseDown(canvas, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 160, clientY: 145 });
    fireEvent.mouseUp(canvas, { clientX: 160, clientY: 145 });

    expect(viewport.style.transform).toContain('translate(60px, 45px)');
    expect(onMoveNode).not.toHaveBeenCalled();
  });

  it('keeps node dragging behavior while panning is available', () => {
    const onMoveNode = vi.fn();
    const { container } = render(
      <Canvas
        nodes={nodes}
        edges={[]}
        zoom={1}
        onZoomDelta={vi.fn()}
        selectedNodeId={null}
        onSelectNode={vi.fn()}
        onMoveNode={onMoveNode}
        onAddEdge={vi.fn()}
      />,
    );

    const canvas = container.querySelector('.canvas') as HTMLDivElement;
    const node = container.querySelector('.canvas__node-wrapper') as HTMLDivElement;

    mockCanvasRect(canvas);

    fireEvent.mouseDown(node, { button: 0, clientX: 90, clientY: 70 });
    fireEvent.mouseMove(canvas, { clientX: 140, clientY: 110 });
    fireEvent.mouseUp(canvas, { clientX: 140, clientY: 110 });

    expect(onMoveNode).toHaveBeenCalled();
    const lastCall = onMoveNode.mock.calls[onMoveNode.mock.calls.length - 1];
    expect(lastCall[0]).toBe('n1');
    expect(lastCall[1]).toBe(90);
    expect(lastCall[2]).toBe(70);
  });
});
