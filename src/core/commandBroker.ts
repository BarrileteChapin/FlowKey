import * as vscode from 'vscode';
import { TileAction, Flow } from '../types';
import { isWhitelisted } from '../security/commandWhitelist';
import { promptTerminalConfirmation } from '../security/confirmationGuard';
import { executeCommandWithFallback } from './commandExecution';
import { executeFlow } from './flowEngine';

export class CommandBroker {
  private flowProvider?: () => Flow[];

  setFlowProvider(provider: () => Flow[]): void {
    this.flowProvider = provider;
  }

  async dispatch(action: TileAction, flowId?: string): Promise<void> {
    switch (action.type) {
      case 'command':
        return this.executeCommand(action);
      case 'terminal':
        return this.executeTerminal(action, flowId);
      case 'flow':
        return this.executeFlow(action);
      default:
        throw new Error(`Unknown action type: "${(action as TileAction).type}".`);
    }
  }

  private async executeCommand(action: TileAction): Promise<void> {
    if (!isWhitelisted(action.ref)) {
      throw new Error(`Command "${action.ref}" is not whitelisted.`);
    }

    const args = action.args ?? [];
    await executeCommandWithFallback(action.ref, args);
  }

  private async executeTerminal(action: TileAction, flowId?: string): Promise<void> {
    const id = flowId ?? `terminal-${action.ref}`;
    const allowed = await promptTerminalConfirmation(id, action.ref);
    if (!allowed) {
      return;
    }

    const terminal = vscode.window.createTerminal('FlowKey');
    terminal.show();
    terminal.sendText(action.ref);
  }

  private async executeFlow(action: TileAction): Promise<void> {
    if (!this.flowProvider) {
      throw new Error('Flow provider not configured.');
    }
    const flows = this.flowProvider();
    const flow = flows.find((f) => f.id === action.ref);
    if (!flow) {
      throw new Error(`Flow "${action.ref}" not found.`);
    }
    const result = await executeFlow(flow, false);
    if (!result.success) {
      throw new Error(result.error ?? 'Flow execution failed.');
    }
  }
}
