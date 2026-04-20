import * as vscode from 'vscode';
import { ProfileManager } from './profileManager';

export class TriggerWatcher {
  private disposables: vscode.Disposable[] = [];

  constructor(private profileManager: ProfileManager) {}

  start(): void {
    // Watch for debug session start → switch to Debug profile
    this.disposables.push(
      vscode.debug.onDidStartDebugSession(() => {
        const debugProfile = this.profileManager.getProfileByTrigger('onDebug');
        if (debugProfile) {
          this.profileManager.setActiveProfile(debugProfile.id);
          this.onProfileSwitch?.(debugProfile.id);
        }
      }),
    );

    // Watch for debug session end → revert to Navigation
    this.disposables.push(
      vscode.debug.onDidTerminateDebugSession(() => {
        this.profileManager.setActiveProfile('navigation');
        this.onProfileSwitch?.('navigation');
      }),
    );

    // Watch for active editor change → test file detection
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (!editor) {
          return;
        }
        const fileName = editor.document.fileName;
        const isTestFile =
          fileName.includes('.test.') ||
          fileName.includes('.spec.') ||
          fileName.includes('__tests__');

        if (isTestFile) {
          const testProfile = this.profileManager.getProfileByTrigger('onTestFile');
          if (testProfile) {
            this.profileManager.setActiveProfile(testProfile.id);
            this.onProfileSwitch?.(testProfile.id);
          }
        }
      }),
    );

    // Watch for SCM view becoming visible → switch to Git profile
    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors(() => {
        // Git trigger is checked via SCM view. For M1, we rely on manual switching
        // or a command-based trigger. Full onGit auto-detection will be refined.
      }),
    );
  }

  onProfileSwitch?: (profileId: string) => void;

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
