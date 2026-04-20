import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TriggerWatcher } from '../../../src/core/triggerWatcher';
import { ProfileManager } from '../../../src/core/profileManager';
import { mockGlobalState, clearMockStores } from '../../mocks/vscodeState';

// Get the mocked vscode module
import * as vscode from 'vscode';

describe('triggerWatcher', () => {
  let profileManager: ProfileManager;
  let watcher: TriggerWatcher;

  // Callback storages for mocked VS Code events
  let debugStartCallback: (() => void) | undefined;
  let debugTerminateCallback: (() => void) | undefined;
  let editorChangeCallback: ((editor: unknown) => void) | undefined;

  beforeEach(() => {
    clearMockStores();
    vi.clearAllMocks();
    profileManager = new ProfileManager(mockGlobalState as any);

    // Capture event callbacks
    (vscode.debug.onDidStartDebugSession as any).mockImplementation((cb: () => void) => {
      debugStartCallback = cb;
      return { dispose: vi.fn() };
    });
    (vscode.debug.onDidTerminateDebugSession as any).mockImplementation((cb: () => void) => {
      debugTerminateCallback = cb;
      return { dispose: vi.fn() };
    });
    (vscode.window.onDidChangeActiveTextEditor as any).mockImplementation((cb: (e: unknown) => void) => {
      editorChangeCallback = cb;
      return { dispose: vi.fn() };
    });

    watcher = new TriggerWatcher(profileManager);
  });

  it('switches to Debug profile when debug session starts', () => {
    const switchSpy = vi.fn();
    watcher.onProfileSwitch = switchSpy;
    watcher.start();

    debugStartCallback?.();
    expect(switchSpy).toHaveBeenCalledWith('debug');
  });

  it('reverts to Navigation profile when debug session ends', () => {
    const switchSpy = vi.fn();
    watcher.onProfileSwitch = switchSpy;
    watcher.start();

    debugTerminateCallback?.();
    expect(switchSpy).toHaveBeenCalledWith('navigation');
  });

  it('switches to Testing profile when a test file is opened', () => {
    const switchSpy = vi.fn();
    watcher.onProfileSwitch = switchSpy;
    watcher.start();

    editorChangeCallback?.({
      document: { fileName: '/project/src/utils.test.ts' },
    });
    expect(switchSpy).toHaveBeenCalledWith('testing');
  });

  it('does not switch for non-test files', () => {
    const switchSpy = vi.fn();
    watcher.onProfileSwitch = switchSpy;
    watcher.start();

    editorChangeCallback?.({
      document: { fileName: '/project/src/utils.ts' },
    });
    expect(switchSpy).not.toHaveBeenCalled();
  });

  it('handles null editor gracefully', () => {
    watcher.start();
    expect(() => editorChangeCallback?.(null)).not.toThrow();
  });

  it('disposes all subscriptions', () => {
    watcher.start();
    watcher.dispose();
    // After dispose, internal disposables should be empty — no error on double dispose
    expect(() => watcher.dispose()).not.toThrow();
  });
});
