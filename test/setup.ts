import { vi } from 'vitest';

const vscodeMock = {
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
    activeColorTheme: { kind: 2 },
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
  ViewColumn: { Active: 1, Beside: 2, One: 1, Two: 2 },
  ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 },
};

// Vitest global setup — mock vscode module
vi.mock('vscode', () => {
  return {
    default: vscodeMock,
    ...vscodeMock,
  };
});

// Mock the bridge module for webview tests (acquireVsCodeApi not available in test)
vi.mock('../webview-ui/shared/bridge', () => ({
  getVSCodeApi: vi.fn(() => ({
    postMessage: vi.fn(),
    getState: vi.fn(),
    setState: vi.fn(),
  })),
  postMessage: vi.fn(),
  onMessage: vi.fn(() => vi.fn()),
  requestState: vi.fn(),
  executeTile: vi.fn(),
  switchProfile: vi.fn(),
  dockTo: vi.fn(),
  resize: vi.fn(),
}));

class ResizeObserverMock {
  observe() {
    // no-op for test environment
  }

  unobserve() {
    // no-op for test environment
  }

  disconnect() {
    // no-op for test environment
  }
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as typeof globalThis & { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver = ResizeObserverMock;
}

const elementProto = globalThis.Element?.prototype as (Element & {
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
}) | undefined;

if (elementProto && typeof elementProto.setPointerCapture !== 'function') {
  elementProto.setPointerCapture = () => {
    // no-op for test environment
  };
}

if (elementProto && typeof elementProto.releasePointerCapture !== 'function') {
  elementProto.releasePointerCapture = () => {
    // no-op for test environment
  };
}
