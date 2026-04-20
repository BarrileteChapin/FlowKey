import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FlowToolbar } from '../../webview-ui/flow-editor/FlowToolbar';

describe('FlowToolbar', () => {
  it('shows visible settings and clear actions', () => {
    const onOpenSettings = vi.fn();
    const onClear = vi.fn();

    render(
      <FlowToolbar
        flow={{ id: 'flow-1', name: 'Build Flow', nodes: [{ id: 'n1', type: 'command', data: {}, position: { x: 0, y: 0 } }], edges: [], confirmedTerminalOnce: false }}
        zoom={1}
        onNew={() => {}}
        onLoadExamples={() => {}}
        onRenameFlow={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onZoomReset={() => {}}
        onRun={() => {}}
        onSave={() => {}}
        onDryRun={() => {}}
        onClear={onClear}
        onDelete={() => {}}
        onExit={() => {}}
        onOpenSettings={onOpenSettings}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /open settings/i }));
    fireEvent.click(screen.getByRole('button', { name: /clear flow/i }));

    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(onClear).toHaveBeenCalledOnce();
  });
});