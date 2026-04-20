import * as vscode from 'vscode';

const CONFIRMED_KEY = 'flowkey.confirmedFlows';

let storage: vscode.Memento | null = null;

export function initConfirmationGuard(workspaceState: vscode.Memento): void {
  storage = workspaceState;
}

function getConfirmedFlows(): Record<string, boolean> {
  if (!storage) {
    return {};
  }
  return storage.get<Record<string, boolean>>(CONFIRMED_KEY, {});
}

export function isConfirmed(flowId: string): boolean {
  const confirmed = getConfirmedFlows();
  return confirmed[flowId] === true;
}

export async function confirmFlow(flowId: string): Promise<void> {
  if (!storage) {
    throw new Error('ConfirmationGuard not initialized.');
  }
  const confirmed = getConfirmedFlows();
  confirmed[flowId] = true;
  await storage.update(CONFIRMED_KEY, confirmed);
}

export async function resetConfirmation(flowId: string): Promise<void> {
  if (!storage) {
    throw new Error('ConfirmationGuard not initialized.');
  }
  const confirmed = getConfirmedFlows();
  delete confirmed[flowId];
  await storage.update(CONFIRMED_KEY, confirmed);
}

export async function promptTerminalConfirmation(flowId: string, commandString: string): Promise<boolean> {
  if (isConfirmed(flowId)) {
    return true;
  }

  const result = await vscode.window.showWarningMessage(
    `FlowKey: This flow wants to run a terminal command:\n"${commandString}"\n\nAllow this flow to run terminal commands?`,
    { modal: true },
    'Allow',
  );

  if (result === 'Allow') {
    await confirmFlow(flowId);
    return true;
  }

  return false;
}
