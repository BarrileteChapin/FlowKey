import { vi } from 'vitest';

const vscode = {
  commands: {
    executeCommand: vi.fn(),
    registerCommand: vi.fn(),
  },
  window: {
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    createTerminal: vi.fn(() => ({
      show: vi.fn(),
      sendText: vi.fn(),
      dispose: vi.fn(),
    })),
    createWebviewPanel: vi.fn(),
    activeColorTheme: { kind: 2 }, // Dark
    onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeVisibleTextEditors: vi.fn(() => ({ dispose: vi.fn() })),
  },
  debug: {
    onDidStartDebugSession: vi.fn(() => ({ dispose: vi.fn() })),
    onDidTerminateDebugSession: vi.fn(() => ({ dispose: vi.fn() })),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(),
      update: vi.fn(),
    })),
  },
  Uri: {
    joinPath: vi.fn((...args: unknown[]) => ({ fsPath: (args as string[]).join('/') })),
    file: vi.fn((path: string) => ({ fsPath: path })),
  },
  ViewColumn: {
    Active: 1,
    One: 1,
    Two: 2,
  },
  ColorThemeKind: {
    Light: 1,
    Dark: 2,
    HighContrast: 3,
    HighContrastLight: 4,
  },
};

export default vscode;
