import * as vscode from 'vscode';
import { ProfileManager } from '../core/profileManager';
import { CommandBroker } from '../core/commandBroker';
import { validateMessage } from '../security/messageValidator';
import { HudState, HudSettings } from '../types';

export class HudPanel {
  public static currentPanel: HudPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private extensionUri: vscode.Uri,
    private profileManager: ProfileManager,
    private commandBroker: CommandBroker,
    private globalState: vscode.Memento,
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtmlContent();

    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      null,
      this.disposables,
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Send initial state
    this.sendState();
  }

  public static create(
    extensionUri: vscode.Uri,
    profileManager: ProfileManager,
    commandBroker: CommandBroker,
    globalState: vscode.Memento,
  ): HudPanel {
    if (HudPanel.currentPanel) {
      HudPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside, true);
      return HudPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'flowkeyHud',
      'FlowKey HUD',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist', 'webview'),
          vscode.Uri.joinPath(extensionUri, 'webview-ui'),
        ],
      },
    );

    HudPanel.currentPanel = new HudPanel(
      panel,
      extensionUri,
      profileManager,
      commandBroker,
      globalState,
    );
    return HudPanel.currentPanel;
  }

  public static previewSettings(patch: Partial<HudSettings>): void {
    if (HudPanel.currentPanel) {
      HudPanel.currentPanel.panel.webview.postMessage({ type: 'settingsPreview', patch });
    }
  }

  public static close(): void {
    if (HudPanel.currentPanel) {
      HudPanel.currentPanel.panel.dispose();
    }
  }

  public sendState(): void {
    const state = this.buildState();
    this.panel.webview.postMessage({ type: 'update', state });
  }

  public updateActiveProfile(profileId: string): void {
    void profileId;
    this.sendState();
  }

  private buildState(): HudState {
    const settings = this.getSettings();
    return {
      activeProfileId: this.profileManager.getActiveProfileId(),
      profiles: this.profileManager.getAllProfiles(),
      settings,
    };
  }

  private getSettings(): HudSettings {
    return {
      gridCols: this.globalState.get<number>('flowkey.gridCols', 4),
      gridRows: this.globalState.get<number>('flowkey.gridRows', 2),
      density: this.globalState.get<'compact' | 'comfortable' | 'spacious'>('flowkey.density', 'comfortable'),
      transparency: this.globalState.get<number>('flowkey.transparency', 0.72),
      tileShape: this.globalState.get<'grid' | 'octagon'>('flowkey.tileShape', 'grid'),
      dockPosition: this.globalState.get<string>('flowkey.dockPosition', 'float') as HudSettings['dockPosition'],
    };
  }

  private async handleMessage(message: unknown): Promise<void> {
    const result = validateMessage(message);
    if (!result.valid) {
      console.warn('[FlowKey] Invalid message:', result.error);
      return;
    }

    const msg = message as { command: string; payload: Record<string, string | number | boolean> };

    switch (msg.command) {
      case 'executeTile': {
        const profile = this.profileManager.getProfile(
          this.profileManager.getActiveProfileId(),
        );
        if (!profile) {
          return;
        }
        const tile = profile.tiles.find((t) => t.id === msg.payload.tileId);
        if (!tile) {
          return;
        }
        try {
          await this.commandBroker.dispatch(tile.action);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`FlowKey: ${errorMsg}`);
        }
        break;
      }

      case 'switchProfile': {
        const profileId = String(msg.payload.profileId);
        try {
          await this.profileManager.setActiveProfile(profileId);
          this.sendState();
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`FlowKey: ${errorMsg}`);
        }
        break;
      }

      case 'dock': {
        const position = String(msg.payload.position);
        await this.globalState.update('flowkey.dockPosition', position);
        this.sendState();
        break;
      }

      case 'resize': {
        if (msg.payload.gridCols) {
          await this.globalState.update('flowkey.gridCols', Number(msg.payload.gridCols));
        }
        if (msg.payload.gridRows) {
          await this.globalState.update('flowkey.gridRows', Number(msg.payload.gridRows));
        }
        this.sendState();
        break;
      }

      case 'getState': {
        this.sendState();
        break;
      }

      case 'toggleHud': {
        HudPanel.close();
        break;
      }
    }
  }

  private getHtmlContent(): string {
    const webview = this.panel.webview;
    const nonce = getNonce();

    // Try to resolve built webview assets
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'hud', 'index.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'hud', 'index.css'),
    );
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        'node_modules',
        '@vscode/codicons',
        'dist',
        'codicon.css',
      ),
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
      style-src ${webview.cspSource} 'nonce-${nonce}';
      font-src ${webview.cspSource};
      script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${codiconsUri}">
  <link rel="stylesheet" href="${styleUri}">
  <title>FlowKey HUD</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private dispose(): void {
    HudPanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}

function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return nonce;
}
