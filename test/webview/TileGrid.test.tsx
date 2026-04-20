import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TileGrid } from '../../webview-ui/hud/TileGrid';
import type { Tile } from '../../src/types';

const mockTiles: Tile[] = [
  { id: 'tile-1', label: 'Search', icon: 'search', action: { type: 'command', ref: 'workbench.action.findInFiles' } },
  { id: 'tile-2', label: 'Go to File', icon: 'go-to-file', action: { type: 'command', ref: 'workbench.action.quickOpen' } },
  { id: 'tile-3', label: 'Errors', icon: 'error', action: { type: 'command', ref: 'workbench.action.problems.focus' } },
];

describe('TileGrid', () => {
  it('renders the correct number of tiles', () => {
    render(
      <TileGrid tiles={mockTiles} gridCols={4} gridRows={2} density="comfortable" tileShape="grid" onExecute={() => {}} />,
    );
    const tiles = screen.getAllByRole('gridcell');
    expect(tiles).toHaveLength(3);
  });

  it('calls onExecute handler with the tile id when clicked', () => {
    const onExecute = vi.fn();
    render(
      <TileGrid tiles={mockTiles} gridCols={4} gridRows={2} density="comfortable" tileShape="grid" onExecute={onExecute} />,
    );
    fireEvent.click(screen.getByLabelText('Search'));
    expect(onExecute).toHaveBeenCalledWith('tile-1');
  });

  it('renders tile labels', () => {
    render(
      <TileGrid tiles={mockTiles} gridCols={4} gridRows={2} density="comfortable" tileShape="grid" onExecute={() => {}} />,
    );
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Go to File')).toBeInTheDocument();
    expect(screen.getByText('Errors')).toBeInTheDocument();
  });

  it('applies octagon class when tileShape is octagon', () => {
    render(
      <TileGrid tiles={mockTiles} gridCols={4} gridRows={2} density="comfortable" tileShape="octagon" onExecute={() => {}} />,
    );
    const firstTile = screen.getAllByRole('gridcell')[0];
    expect(firstTile.classList.contains('tile--octagon')).toBe(true);
  });

  it('renders empty-state UI when profile has no tiles', () => {
    render(
      <TileGrid tiles={[]} gridCols={4} gridRows={2} density="comfortable" tileShape="grid" onExecute={() => {}} />,
    );
    expect(screen.getByText(/no tiles configured/i)).toBeInTheDocument();
  });

  it('uses role="grid" on the container', () => {
    render(
      <TileGrid tiles={mockTiles} gridCols={4} gridRows={2} density="comfortable" tileShape="grid" onExecute={() => {}} />,
    );
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('renders category and options metadata when available', () => {
    const richTiles: Tile[] = [
      {
        id: 'tile-flow',
        label: 'Build Flow',
        icon: 'play',
        category: 'Automation',
        options: ['Safe', 'Verbose'],
        action: { type: 'flow', ref: 'flow-build' },
      },
    ];

    render(
      <TileGrid tiles={richTiles} gridCols={2} gridRows={1} density="comfortable" tileShape="grid" onExecute={() => {}} />,
    );

    expect(screen.getByText('Automation')).toBeInTheDocument();
    expect(screen.getByText('Flow • Safe • Verbose')).toBeInTheDocument();
  });
});
