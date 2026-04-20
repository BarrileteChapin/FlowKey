import * as vscode from 'vscode';

const COMMAND_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'github.copilot.interactiveSession.explain': [
    'github.copilot.chat.explain',
    'flowkey.ai.explainSelection',
    'workbench.panel.chat.view.copilot.focus',
  ],
  'github.copilot.interactiveSession.fix': [
    'github.copilot.chat.fix',
    'flowkey.ai.fixSelection',
    'workbench.panel.chat.view.copilot.focus',
  ],
  'github.copilot.interactiveSession.generate': [
    'github.copilot.chat.generate',
    'flowkey.ai.generateFromPrompt',
    'workbench.panel.chat.view.copilot.focus',
  ],
  'github.copilot.chat.explain': [
    'flowkey.ai.explainSelection',
    'workbench.panel.chat.view.copilot.focus',
  ],
  'github.copilot.chat.fix': [
    'flowkey.ai.fixSelection',
    'workbench.panel.chat.view.copilot.focus',
  ],
  'github.copilot.chat.generate': [
    'flowkey.ai.generateFromPrompt',
    'workbench.panel.chat.view.copilot.focus',
  ],
};

function isNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /not found/i.test(message);
}

export function getCommandCandidates(commandId: string): string[] {
  const candidates = [commandId, ...(COMMAND_ALIASES[commandId] ?? [])];
  return [...new Set(candidates.filter((id) => id.trim().length > 0))];
}

export async function executeCommandWithFallback(commandId: string, args: unknown[] = []): Promise<string> {
  const tried: string[] = [];
  const candidates = getCommandCandidates(commandId);

  for (const candidate of candidates) {
    tried.push(candidate);
    try {
      if (args.length > 0) {
        await vscode.commands.executeCommand(candidate, ...args);
      } else {
        await vscode.commands.executeCommand(candidate);
      }
      return candidate;
    } catch (error) {
      if (isNotFoundError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `Command "${commandId}" not found in this VS Code setup. Tried: ${tried.join(', ')}. ` +
    'Install/enable the related extension or add a valid command in FlowKey settings.',
  );
}
