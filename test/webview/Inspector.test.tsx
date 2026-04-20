import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Inspector } from '../../webview-ui/flow-editor/Inspector';

describe('Inspector', () => {
  it('renders a scrollable command list and applies a clicked command id', () => {
    const onChange = vi.fn();

    render(
      <Inspector
        node={{ id: 'node-1', type: 'command', data: { commandId: '' }, position: { x: 0, y: 0 } }}
        availableCommands={['workbench.action.files.save', 'editor.action.rename']}
        onChange={onChange}
        onClose={() => {}}
        onDeleteNode={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'editor.action.rename' }));

    expect(onChange).toHaveBeenCalledWith('node-1', { commandId: 'editor.action.rename' });
  });
});