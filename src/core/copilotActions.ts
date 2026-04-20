import * as vscode from 'vscode';
import { executeCommandWithFallback } from './commandExecution';

type CopilotAction = 'explain' | 'fix' | 'generate';

function getSelectionContext(): { context: string; language: string; fileName: string } {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return {
      context: '',
      language: 'text',
      fileName: 'unknown file',
    };
  }

  const document = editor.document;
  const selection = editor.selection;
  const selectedText = document.getText(selection).trim();

  let context = selectedText;
  if (!context) {
    const line = selection.active.line;
    const startLine = Math.max(0, line - 6);
    const endLine = Math.min(document.lineCount - 1, line + 6);
    context = document.getText(new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length));
  }

  return {
    context: context.trim(),
    language: document.languageId,
    fileName: document.fileName.split(/[/\\]/).pop() ?? document.fileName,
  };
}

function buildPrompt(action: CopilotAction, userInstruction?: string): string {
  const { context, language, fileName } = getSelectionContext();

  if (action === 'generate') {
    const instruction = (userInstruction ?? '').trim();
    const prefix = instruction.length > 0
      ? `Instruction: ${instruction}`
      : 'Instruction: Generate code for this context.';

    return [
      prefix,
      `File: ${fileName}`,
      `Language: ${language}`,
      '',
      'Context:',
      context || '[No selection found. Use current file context.]',
    ].join('\n');
  }

  if (action === 'fix') {
    return [
      `Please propose a safe refactor/fix for this ${language} code from ${fileName}.`,
      'Explain the root cause and provide improved code.',
      '',
      'Context:',
      context || '[No selection found. Use current file context.]',
    ].join('\n');
  }

  return [
    `Please explain this ${language} code from ${fileName}.`,
    'Focus on intent, potential risks, and improvements.',
    '',
    'Context:',
    context || '[No selection found. Use current file context.]',
  ].join('\n');
}

async function openChatWithPrompt(prompt: string): Promise<boolean> {
  const attempts: Array<{ id: string; args: unknown[] }> = [
    { id: 'workbench.action.quickchat.open', args: [prompt] },
    { id: 'workbench.action.chat.open', args: [prompt] },
    { id: 'github.copilot.chat.open', args: [prompt] },
  ];

  for (const attempt of attempts) {
    try {
      await vscode.commands.executeCommand(attempt.id, ...attempt.args);
      return true;
    } catch {
      // Fall through and try next command candidate.
    }
  }

  return false;
}

export async function runCopilotAction(action: CopilotAction): Promise<void> {
  let prompt = '';

  if (action === 'generate') {
    const instruction = await vscode.window.showInputBox({
      prompt: 'What do you want Copilot to generate?',
      placeHolder: 'e.g. Generate Jest tests for selected function',
    });

    if (instruction === undefined) {
      return;
    }

    prompt = buildPrompt(action, instruction);
  } else {
    prompt = buildPrompt(action);
  }

  const opened = await openChatWithPrompt(prompt);
  if (opened) {
    return;
  }

  await vscode.env.clipboard.writeText(prompt);
  await executeCommandWithFallback('workbench.panel.chat.view.copilot.focus');
  vscode.window.showInformationMessage(
    'FlowKey: Copilot prompt with context copied to clipboard. Paste into chat and press Enter.',
  );
}
