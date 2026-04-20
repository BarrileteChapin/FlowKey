import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeFlow } from '../../../src/core/flowEngine';
import type { Flow, FlowNode, FlowEdge } from '../../../src/types';

import * as vscode from 'vscode';

vi.mock('../../../src/security/commandWhitelist', () => ({
  isWhitelisted: vi.fn((id: string) => {
    const allowed = new Set([
      'workbench.action.files.save',
      'git.stageAll',
      'git.push',
      'github.copilot.interactiveSession.explain',
    ]);
    return allowed.has(id);
  }),
}));

vi.mock('../../../src/security/confirmationGuard', () => ({
  promptTerminalConfirmation: vi.fn(async () => true),
}));

function makeNode(overrides: Partial<FlowNode> & { id: string; type: FlowNode['type'] }): FlowNode {
  return {
    position: { x: 0, y: 0 },
    data: {},
    ...overrides,
  };
}

function makeEdge(source: string, target: string, label?: string): FlowEdge {
  return { id: `${source}-${target}`, source, target, label };
}

describe('flowEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when flow has no nodes', async () => {
    const flow: Flow = { id: 'f1', name: 'Empty', nodes: [], edges: [], confirmedTerminalOnce: false };
    const result = await executeFlow(flow);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no start nodes/i);
  });

  it('executes a single command node', async () => {
    const flow: Flow = {
      id: 'f2',
      name: 'Single Command',
      nodes: [makeNode({ id: 'n1', type: 'command', data: { commandId: 'workbench.action.files.save', label: 'Save' } })],
      edges: [],
      confirmedTerminalOnce: false,
    };
    const result = await executeFlow(flow);
    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].status).toBe('executed');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.files.save');
  });

  it('rejects command not in whitelist', async () => {
    const flow: Flow = {
      id: 'f3',
      name: 'Bad command',
      nodes: [makeNode({ id: 'n1', type: 'command', data: { commandId: 'evil.command', label: 'Hack' } })],
      edges: [],
      confirmedTerminalOnce: false,
    };
    const result = await executeFlow(flow);
    expect(result.success).toBe(false);
    expect(result.steps[0].status).toBe('error');
    expect(result.steps[0].error).toMatch(/not whitelisted/i);
  });

  it('walks a chain of two command nodes', async () => {
    const flow: Flow = {
      id: 'f4',
      name: 'Chain',
      nodes: [
        makeNode({ id: 'n1', type: 'command', data: { commandId: 'git.stageAll', label: 'Stage' } }),
        makeNode({ id: 'n2', type: 'command', data: { commandId: 'git.push', label: 'Push' } }),
      ],
      edges: [makeEdge('n1', 'n2')],
      confirmedTerminalOnce: false,
    };
    const result = await executeFlow(flow);
    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].label).toBe('Stage');
    expect(result.steps[1].label).toBe('Push');
  });

  it('halts chain on error in first node', async () => {
    const flow: Flow = {
      id: 'f5',
      name: 'Error chain',
      nodes: [
        makeNode({ id: 'n1', type: 'command', data: { commandId: 'blocked.cmd', label: 'Bad' } }),
        makeNode({ id: 'n2', type: 'command', data: { commandId: 'git.stageAll', label: 'OK' } }),
      ],
      edges: [makeEdge('n1', 'n2')],
      confirmedTerminalOnce: false,
    };
    const result = await executeFlow(flow);
    expect(result.success).toBe(false);
    expect(result.steps).toHaveLength(1);
  });

  it('executes notification node with info severity', async () => {
    const flow: Flow = {
      id: 'f6',
      name: 'Notify',
      nodes: [makeNode({ id: 'n1', type: 'notification', data: { message: 'Hello!', severity: 'info', label: 'Notify' } })],
      edges: [],
      confirmedTerminalOnce: false,
    };
    const result = await executeFlow(flow);
    expect(result.success).toBe(true);
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Hello!');
  });

  it('dry-run mode does not actually execute commands', async () => {
    const flow: Flow = {
      id: 'f7',
      name: 'DryRun',
      nodes: [
        makeNode({ id: 'n1', type: 'command', data: { commandId: 'git.stageAll', label: 'Stage' } }),
        makeNode({ id: 'n2', type: 'terminal', data: { command: 'echo hi', label: 'Echo' } }),
      ],
      edges: [makeEdge('n1', 'n2')],
      confirmedTerminalOnce: false,
    };
    const result = await executeFlow(flow, true);
    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(2);
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    expect(vscode.window.createTerminal).not.toHaveBeenCalled();
  });

  it('handles condition node branching to true path', async () => {
    const flow: Flow = {
      id: 'f8',
      name: 'Condition',
      nodes: [
        makeNode({ id: 'n1', type: 'command', data: { commandId: 'git.stageAll', label: 'Stage' } }),
        makeNode({ id: 'cond1', type: 'condition', data: { field: 'lastStatus', operator: 'equals', value: 'executed', label: 'Check' } }),
        makeNode({ id: 'n3', type: 'notification', data: { message: 'Passed', severity: 'info', label: 'Pass' } }),
        makeNode({ id: 'n4', type: 'notification', data: { message: 'Failed', severity: 'error', label: 'Fail' } }),
      ],
      edges: [
        makeEdge('n1', 'cond1'),
        { id: 'cond1-true', source: 'cond1', target: 'n3', label: 'true' },
        { id: 'cond1-false', source: 'cond1', target: 'n4', label: 'false' },
      ],
      confirmedTerminalOnce: false,
    };
    const result = await executeFlow(flow);
    expect(result.success).toBe(true);
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Passed');
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalledWith('Failed');
  });

  it('executes terminal node with confirmation', async () => {
    const flow: Flow = {
      id: 'f9',
      name: 'Terminal',
      nodes: [makeNode({ id: 'n1', type: 'terminal', data: { command: 'npm test', label: 'Test' } })],
      edges: [],
      confirmedTerminalOnce: false,
    };
    const result = await executeFlow(flow);
    expect(result.success).toBe(true);
    expect(vscode.window.createTerminal).toHaveBeenCalled();
  });

  it('skips terminal node when user denies confirmation', async () => {
    const { promptTerminalConfirmation } = await import('../../../src/security/confirmationGuard');
    (promptTerminalConfirmation as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

    const flow: Flow = {
      id: 'f10',
      name: 'Denied Terminal',
      nodes: [makeNode({ id: 'n1', type: 'terminal', data: { command: 'rm -rf /', label: 'Danger' } })],
      edges: [],
      confirmedTerminalOnce: false,
    };
    const result = await executeFlow(flow);
    expect(result.success).toBe(true);
    expect(result.steps[0].status).toBe('skipped');
  });

  it('falls back to modern Copilot command when legacy command id is missing', async () => {
    (vscode.commands.executeCommand as unknown as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("command 'github.copilot.interactiveSession.explain' not found"))
      .mockResolvedValueOnce(undefined);

    const flow: Flow = {
      id: 'f11',
      name: 'Copilot Fallback',
      nodes: [
        makeNode({
          id: 'n1',
          type: 'command',
          data: { commandId: 'github.copilot.interactiveSession.explain', label: 'Explain' },
        }),
      ],
      edges: [],
      confirmedTerminalOnce: false,
    };

    const result = await executeFlow(flow);
    expect(result.success).toBe(true);
    expect(vscode.commands.executeCommand).toHaveBeenNthCalledWith(1, 'github.copilot.interactiveSession.explain');
    expect(vscode.commands.executeCommand).toHaveBeenNthCalledWith(2, 'github.copilot.chat.explain');
  });
});
