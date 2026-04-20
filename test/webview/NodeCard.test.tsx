import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NodeCard } from '../../webview-ui/flow-editor/NodeCard';
import type { FlowNode } from '../../src/types';

function makeNode(overrides: Partial<FlowNode> & Pick<FlowNode, 'id' | 'type'>): FlowNode {
  return { position: { x: 0, y: 0 }, data: {}, ...overrides };
}

describe('NodeCard', () => {
  it('renders the node label from data.label', () => {
    const node = makeNode({ id: 'n1', type: 'command', data: { label: 'Save File', commandId: 'files.save' } });
    render(<NodeCard node={node} selected={false} onSelect={() => {}} />);
    expect(screen.getByText('Save File')).toBeInTheDocument();
  });

  it('falls back to commandId when no label', () => {
    const node = makeNode({ id: 'n2', type: 'command', data: { commandId: 'git.push' } });
    render(<NodeCard node={node} selected={false} onSelect={() => {}} />);
    // Both title and meta show commandId — use getAllByText
    const elements = screen.getAllByText('git.push');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onSelect with node id when clicked', () => {
    const onSelect = vi.fn();
    const node = makeNode({ id: 'n3', type: 'terminal', data: { label: 'Run Tests', command: 'npm test' } });
    render(<NodeCard node={node} selected={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith('n3');
  });

  it('has selected class when selected', () => {
    const node = makeNode({ id: 'n4', type: 'notification', data: { label: 'Alert' } });
    render(<NodeCard node={node} selected={true} onSelect={() => {}} />);
    const card = screen.getByRole('button');
    expect(card.classList.contains('node-card--selected')).toBe(true);
  });

  it('shows meta info for condition nodes', () => {
    const node = makeNode({
      id: 'n5',
      type: 'condition',
      data: { label: 'Check Status', field: 'lastStatus', operator: 'equals', value: 'executed' },
    });
    render(<NodeCard node={node} selected={false} onSelect={() => {}} />);
    expect(screen.getByText(/lastStatus equals executed/)).toBeInTheDocument();
  });
});
