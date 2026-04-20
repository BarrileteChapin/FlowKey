import * as vscode from 'vscode';
import { Flow, FlowEditorState } from '../types';
import { validateMessage } from '../security/messageValidator';
import { getWhitelistedCommands } from '../security/commandWhitelist';
import { executeFlow } from '../core/flowEngine';
import { ProfileManager } from '../core/profileManager';

const FLOWS_KEY = 'flowkey.flows';

export class FlowEditorPanel {
  public static currentPanel: FlowEditorPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private extensionUri: vscode.Uri,
    private workspaceState: vscode.Memento,
    private profileManager: ProfileManager,
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtmlContent();

    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      null,
      this.disposables,
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.sendState();
  }

  public static create(
    extensionUri: vscode.Uri,
    workspaceState: vscode.Memento,
    profileManager: ProfileManager,
  ): FlowEditorPanel {
    if (FlowEditorPanel.currentPanel) {
      FlowEditorPanel.currentPanel.panel.reveal(vscode.ViewColumn.Active);
      return FlowEditorPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'flowkeyFlowEditor',
      'FlowKey Flow Editor',
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist', 'webview'),
          vscode.Uri.joinPath(extensionUri, 'webview-ui'),
        ],
      },
    );

    FlowEditorPanel.currentPanel = new FlowEditorPanel(
      panel,
      extensionUri,
      workspaceState,
      profileManager,
    );
    return FlowEditorPanel.currentPanel;
  }

  public static close(): void {
    if (FlowEditorPanel.currentPanel) {
      FlowEditorPanel.currentPanel.panel.dispose();
    }
  }

  // --- State ---

  public getAllFlows(): Flow[] {
    return this.workspaceState.get<Flow[]>(FLOWS_KEY, []);
  }

  private async saveFlows(flows: Flow[]): Promise<void> {
    await this.workspaceState.update(FLOWS_KEY, flows);
  }

  public sendState(): void {
    const state = this.buildState();
    this.panel.webview.postMessage({ type: 'update', state });
  }

  private buildState(): FlowEditorState {
    return {
      flows: this.getAllFlows(),
      activeFlowId: null,
      profiles: this.profileManager.getAllProfiles(),
    };
  }

  // --- Message handling ---

  private async handleMessage(message: unknown): Promise<void> {
    const result = validateMessage(message);
    if (!result.valid) {
      console.warn('[FlowKey] Invalid flow editor message:', result.error);
      return;
    }

    const msg = message as { command: string; payload: Record<string, unknown> };

    switch (msg.command) {
      case 'saveFlow': {
        const flow = msg.payload.flow as Flow | undefined;
        if (!flow || !flow.id || !flow.name) {
          return;
        }
        const flows = this.getAllFlows();
        const idx = flows.findIndex((f) => f.id === flow.id);
        if (idx >= 0) {
          flows[idx] = flow;
        } else {
          flows.push(flow);
        }
        await this.saveFlows(flows);
        this.sendState();
        break;
      }

      case 'deleteFlow': {
        const flowId = String(msg.payload.flowId);
        const flows = this.getAllFlows().filter((f) => f.id !== flowId);
        await this.saveFlows(flows);
        this.sendState();
        break;
      }

      case 'runFlow': {
        const flowId = String(msg.payload.flowId);
        const flow = this.getAllFlows().find((f) => f.id === flowId);
        if (!flow) {
          vscode.window.showErrorMessage(`FlowKey: Flow "${flowId}" not found.`);
          return;
        }
        const execResult = await executeFlow(flow, false);
        this.panel.webview.postMessage({ type: 'flowResult', result: execResult });
        if (!execResult.success) {
          vscode.window.showErrorMessage(`FlowKey: Flow failed — ${execResult.error}`);
        }
        break;
      }

      case 'dryRunFlow': {
        const flowId = String(msg.payload.flowId);
        const flow = this.getAllFlows().find((f) => f.id === flowId);
        if (!flow) {
          vscode.window.showErrorMessage(`FlowKey: Flow "${flowId}" not found.`);
          return;
        }
        const dryResult = await executeFlow(flow, true);
        this.panel.webview.postMessage({ type: 'flowDryRunResult', result: dryResult });
        break;
      }

      case 'getFlows': {
        this.sendState();
        break;
      }

      case 'getFlow': {
        const flowId = String(msg.payload.flowId);
        const flow = this.getAllFlows().find((f) => f.id === flowId);
        this.panel.webview.postMessage({ type: 'flowDetail', flow: flow ?? null });
        break;
      }

      case 'getWhitelistedCommands': {
        const available = new Set(await vscode.commands.getCommands(true));
        const runnable = getWhitelistedCommands().filter((commandId) => available.has(commandId));
        this.panel.webview.postMessage({
          type: 'whitelistedCommands',
          commands: runnable.sort((a, b) => a.localeCompare(b)),
        });
        break;
      }

      case 'bindFlowToTile': {
        const flowId = String(msg.payload.flowId);
        const profileId = String(msg.payload.profileId);
        const tileId = String(msg.payload.tileId);
        const category = typeof msg.payload.category === 'string' ? msg.payload.category.trim() : '';
        const options = Array.isArray(msg.payload.options)
          ? msg.payload.options
            .filter((option): option is string => typeof option === 'string')
            .map((option) => option.trim())
            .filter((option) => option.length > 0)
            .slice(0, 8)
          : [];
        const flow = this.getAllFlows().find((f) => f.id === flowId);
        if (!flow) {
          return;
        }
        const profile = this.profileManager.getProfile(profileId);
        if (!profile) {
          return;
        }
        const tile = profile.tiles.find((t) => t.id === tileId);
        if (!tile) {
          return;
        }
        tile.action = { type: 'flow', ref: flowId };
        tile.category = category.length > 0 ? category : undefined;
        tile.options = options.length > 0 ? options : undefined;
        await this.profileManager.updateProfile(profileId, { tiles: profile.tiles });
        this.sendState();
        await vscode.commands.executeCommand('flowkey.refreshHudState');
        break;
      }

      case 'openSettings': {
        try {
          await vscode.commands.executeCommand('workbench.view.extension.flowkey');
          const availableCommands = new Set(await vscode.commands.getCommands(true));
          if (availableCommands.has('flowkey.settings.focus')) {
            await vscode.commands.executeCommand('flowkey.settings.focus');
          }
        } catch {
          // Best effort only; flow editor remains usable if opening settings fails.
        }
        break;
      }

      case 'loadExampleFlows': {
        await vscode.commands.executeCommand('flowkey.loadExampleFlows');
        this.sendState();
        break;
      }

      case 'closeFlowEditor': {
        this.panel.dispose();
        break;
      }
    }
  }

  // --- HTML ---

  private getHtmlContent(): string {
    const nonce = getNonce();
    const styleUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'flow-editor', 'index.css'),
    );
    const codiconsUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        'node_modules',
        '@vscode/codicons',
        'dist',
        'codicon.css',
      ),
    );
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
      style-src ${this.panel.webview.cspSource} 'unsafe-inline' https://api.fontshare.com;
      font-src ${this.panel.webview.cspSource} https://cdn.fontshare.com;
      script-src 'nonce-${nonce}';
      img-src ${this.panel.webview.cspSource};" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${codiconsUri}">
  <link rel="stylesheet" href="${styleUri}">
  <title>FlowKey Flow Editor</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'flow-editor', 'index.js'),
    )}"></script>
</body>
</html>`;
  }

  private dispose(): void {
    FlowEditorPanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
