import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandBroker } from '../../../src/core/commandBroker';
import type { TileAction } from '../../../src/types';

// Access the mocked vscode
import * as vscode from 'vscode';

// Mock the security modules
vi.mock('../../../src/security/commandWhitelist', () => ({
  isWhitelisted: vi.fn((id: string) => {
    const allowed = new Set([
      'workbench.action.files.save',
      'workbench.action.quickOpen',
      'git.stageAll',
      'github.copilot.interactiveSession.explain',
    ]);
    return allowed.has(id);
  }),
}));

vi.mock('../../../src/security/confirmationGuard', () => ({
  promptTerminalConfirmation: vi.fn(async () => true),
}));

describe('commandBroker', () => {
  let broker: CommandBroker;

  beforeEach(() => {
    broker = new CommandBroker();
    vi.clearAllMocks();
  });

  it('accepts a TileAction of type "command" and dispatches to vscode.commands.executeCommand', async () => {
    const action: TileAction = { type: 'command', ref: 'workbench.action.files.save' };
    await broker.dispatch(action);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.files.save');
  });

  it('passes arguments when present on command action', async () => {
    const action: TileAction = { type: 'command', ref: 'workbench.action.quickOpen', args: ['test'] };
    await broker.dispatch(action);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.quickOpen', 'test');
  });

  it('accepts a TileAction of type "terminal" and dispatches through confirmationGuard', async () => {
    const action: TileAction = { type: 'terminal', ref: 'npm test' };
    await broker.dispatch(action);
    const { promptTerminalConfirmation } = await import('../../../src/security/confirmationGuard');
    expect(promptTerminalConfirmation).toHaveBeenCalled();
  });

  it('accepts a TileAction of type "flow" and dispatches to flowEngine', async () => {
    const mockFlow = {
      id: 'flow-1',
      name: 'Test',
      nodes: [{ id: 'n1', type: 'command' as const, data: { commandId: 'workbench.action.files.save', label: 'Save' }, position: { x: 0, y: 0 } }],
      edges: [],
      confirmedTerminalOnce: false,
    };
    broker.setFlowProvider(() => [mockFlow]);
    const action: TileAction = { type: 'flow', ref: 'flow-1' };
    await broker.dispatch(action);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.files.save');
  });

  it('rejects actions with unknown types', async () => {
    const action = { type: 'eval', ref: 'bad' } as unknown as TileAction;
    await expect(broker.dispatch(action)).rejects.toThrow('Unknown action type');
  });

  it('rejects commands not in whitelist', async () => {
    const action: TileAction = { type: 'command', ref: 'workbench.action.openSettings' };
    await expect(broker.dispatch(action)).rejects.toThrow('not whitelisted');
  });

  it('falls back to modern Copilot command when legacy command id is missing', async () => {
    (vscode.commands.executeCommand as unknown as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("command 'github.copilot.interactiveSession.explain' not found"))
      .mockResolvedValueOnce(undefined);

    const action: TileAction = { type: 'command', ref: 'github.copilot.interactiveSession.explain' };
    await broker.dispatch(action);

    expect(vscode.commands.executeCommand).toHaveBeenNthCalledWith(1, 'github.copilot.interactiveSession.explain');
    expect(vscode.commands.executeCommand).toHaveBeenNthCalledWith(2, 'github.copilot.chat.explain');
  });
});
