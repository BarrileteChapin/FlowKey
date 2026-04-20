import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { GestureLibrary } from '../../webview-ui/accessibility/GestureLibrary';

describe('GestureLibrary', () => {
  it('renders a visible remove button for existing bindings', () => {
    const onDelete = vi.fn();
    render(
      <GestureLibrary
        bindings={[
          {
            gestureId: 'circle',
            label: 'Circle',
            points: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }],
            action: { type: 'command', ref: 'workbench.action.files.save' },
          },
        ]}
        references={[]}
        onDelete={onDelete}
        onSelect={() => {}}
        selectedId="circle"
      />,
    );

    const removeButton = screen.getByRole('button', { name: /delete circle binding/i });
    expect(removeButton).toHaveTextContent('Remove');

    fireEvent.click(removeButton);
    expect(onDelete).toHaveBeenCalledWith('circle');
  });
});