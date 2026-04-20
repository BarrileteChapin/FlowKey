import * as vscode from 'vscode';
import { AccessibilityState, GestureBinding, VoiceAlias, Point } from '../types';
import { validateMessage } from '../security/messageValidator';
import { Recogniser, getBuiltInTemplates } from '../core/recogniser';
import { CommandBroker } from '../core/commandBroker';
import { ProfileManager } from '../core/profileManager';

const GESTURE_BINDINGS_KEY = 'flowkey.gestureBindings';
const VOICE_ALIASES_KEY = 'flowkey.voiceAliases';
const VOICE_ENABLED_KEY = 'flowkey.voiceEnabled';

export class AccessibilityPanel {
  public static currentPanel: AccessibilityPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private recogniser: Recogniser;
  private isListening = false;

  private constructor(
    panel: vscode.WebviewPanel,
    private extensionUri: vscode.Uri,
    private workspaceState: vscode.Memento,
    private globalState: vscode.Memento,
    private commandBroker: CommandBroker,
    private profileManager: ProfileManager,
  ) {
    this.panel = panel;
    this.recogniser = new Recogniser(
      this.getGestureBindings().map((b) => ({ name: b.gestureId, points: b.points })),
    );

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
    globalState: vscode.Memento,
    commandBroker: CommandBroker,
    profileManager: ProfileManager,
  ): AccessibilityPanel {
    if (AccessibilityPanel.currentPanel) {
      AccessibilityPanel.currentPanel.panel.reveal(vscode.ViewColumn.Active);
      return AccessibilityPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'flowkeyAccessibility',
      'FlowKey Accessibility',
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
    panel.iconPath = {
      light: vscode.Uri.joinPath(extensionUri, 'media', 'accessibility-light.svg'),
      dark: vscode.Uri.joinPath(extensionUri, 'media', 'accessibility-dark.svg'),
    };

    AccessibilityPanel.currentPanel = new AccessibilityPanel(
      panel,
      extensionUri,
      workspaceState,
      globalState,
      commandBroker,
      profileManager,
    );
    return AccessibilityPanel.currentPanel;
  }

  public static close(): void {
    if (AccessibilityPanel.currentPanel) {
      AccessibilityPanel.currentPanel.panel.dispose();
    }
  }

  // --- Gesture Bindings ---

  private getGestureBindings(): GestureBinding[] {
    return this.workspaceState.get<GestureBinding[]>(GESTURE_BINDINGS_KEY, []);
  }

  private async saveGestureBindings(bindings: GestureBinding[]): Promise<void> {
    await this.workspaceState.update(GESTURE_BINDINGS_KEY, bindings);
    this.recogniser = new Recogniser(
      bindings.map((b) => ({ name: b.gestureId, points: b.points })),
    );
  }

  // --- Voice Aliases ---

  private getVoiceAliases(): VoiceAlias[] {
    return this.globalState.get<VoiceAlias[]>(VOICE_ALIASES_KEY, []);
  }

  private async saveVoiceAliases(aliases: VoiceAlias[]): Promise<void> {
    await this.globalState.update(VOICE_ALIASES_KEY, aliases);
  }

  // --- State ---

  public sendState(): void {
    const state = this.buildState();
    this.panel.webview.postMessage({ type: 'update', state });
  }

  private buildState(): AccessibilityState {
    const builtInGestures = getBuiltInTemplates().map((template) => ({
      id: template.name,
      label: humanizeGestureName(template.name),
      points: template.points,
    }));

    return {
      gestureBindings: this.getGestureBindings(),
      builtInGestures,
      profiles: this.profileManager.getAllProfiles(),
      voiceAliases: this.getVoiceAliases(),
      voiceEnabled: this.globalState.get<boolean>(VOICE_ENABLED_KEY, false),
      isListening: this.isListening,
    };
  }

  // --- Message handling ---

  private async handleMessage(message: unknown): Promise<void> {
    const result = validateMessage(message);
    if (!result.valid) {
      console.warn('[FlowKey] Invalid accessibility message:', result.error);
      return;
    }

    const msg = message as { command: string; payload: Record<string, unknown> };

    switch (msg.command) {
      case 'recogniseGesture': {
        const points = msg.payload.points as Point[] | undefined;
        if (!points || !Array.isArray(points)) return;
        const recognition = this.recogniser.recognise(points);
        this.panel.webview.postMessage({ type: 'gestureResult', result: recognition });

        // If recognised and there's a binding, execute the action
        if (recognition) {
          const binding = this.getGestureBindings().find((b) => b.gestureId === recognition.name);
          if (binding) {
            try {
              await this.commandBroker.dispatch(binding.action);
            } catch (err) {
              vscode.window.showErrorMessage(`FlowKey: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
        break;
      }

      case 'saveGestureBinding': {
        const binding = msg.payload.binding as GestureBinding | undefined;
        if (!binding || !binding.gestureId) return;
        const bindings = this.getGestureBindings();
        const idx = bindings.findIndex((b) => b.gestureId === binding.gestureId);
        if (idx >= 0) {
          bindings[idx] = binding;
        } else {
          bindings.push(binding);
        }
        await this.saveGestureBindings(bindings);
        this.sendState();
        break;
      }

      case 'deleteGestureBinding': {
        const gestureId = String(msg.payload.gestureId);
        const bindings = this.getGestureBindings().filter((b) => b.gestureId !== gestureId);
        await this.saveGestureBindings(bindings);
        this.sendState();
        break;
      }

      case 'getGestureBindings': {
        this.sendState();
        break;
      }

      case 'saveVoiceAlias': {
        const alias = msg.payload.alias as VoiceAlias | undefined;
        if (!alias || !alias.id) return;
        const aliases = this.getVoiceAliases();
        const idx = aliases.findIndex((a) => a.id === alias.id);
        if (idx >= 0) {
          aliases[idx] = alias;
        } else {
          aliases.push(alias);
        }
        await this.saveVoiceAliases(aliases);
        this.sendState();
        break;
      }

      case 'deleteVoiceAlias': {
        const aliasId = String(msg.payload.aliasId);
        const aliases = this.getVoiceAliases().filter((a) => a.id !== aliasId);
        await this.saveVoiceAliases(aliases);
        this.sendState();
        break;
      }

      case 'getVoiceAliases': {
        this.sendState();
        break;
      }

      case 'startListening': {
        await this.startVoiceListening();
        break;
      }

      case 'stopListening': {
        this.isListening = false;
        this.sendState();
        break;
      }
    }
  }

  // --- Voice (VS Code Speech integration) ---

  private async startVoiceListening(): Promise<void> {
    // Check if Speech extension is installed
    const speechExt = vscode.extensions.getExtension('ms-vscode.vscode-speech');
    if (!speechExt) {
      const install = await vscode.window.showWarningMessage(
        'FlowKey Voice requires the VS Code Speech extension (ms-vscode.vscode-speech).',
        'Install',
        'Cancel',
      );
      if (install === 'Install') {
        await vscode.commands.executeCommand(
          'workbench.extensions.installExtension',
          'ms-vscode.vscode-speech',
        );
      }
      return;
    }

    this.isListening = true;
    this.sendState();

    try {
      // Use VS Code Speech API to listen
      // The Speech API may vary; we wrap in a try-catch for graceful degradation
      const api = speechExt.isActive ? speechExt.exports : await speechExt.activate();

      if (api && typeof api.listen === 'function') {
        const transcript: string = await api.listen();
        this.isListening = false;

        // Match against aliases
        const aliases = this.getVoiceAliases();
        const normalised = transcript.toLowerCase().trim();
        const matched = aliases.find((a) => normalised.includes(a.phrase));

        if (matched) {
          this.panel.webview.postMessage({
            type: 'voiceTranscript',
            result: { transcript, matched: matched.phrase, noMatch: false },
          });
          try {
            await this.commandBroker.dispatch(matched.action);
          } catch (err) {
            vscode.window.showErrorMessage(`FlowKey: ${err instanceof Error ? err.message : String(err)}`);
          }
        } else {
          this.panel.webview.postMessage({
            type: 'voiceTranscript',
            result: { transcript, matched: null, noMatch: true },
          });
        }
      } else {
        // Speech API not available as expected — graceful degradation
        this.isListening = false;
        vscode.window.showWarningMessage('FlowKey: VS Code Speech API is not available in this version.');
      }
    } catch {
      this.isListening = false;
      vscode.window.showWarningMessage('FlowKey: Voice listening failed. The Speech extension may not be ready.');
    }
    this.sendState();
  }

  // --- HTML ---

  private getHtmlContent(): string {
    const nonce = getNonce();
    const styleUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'accessibility', 'index.css'),
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
  <title>FlowKey Accessibility</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'accessibility', 'index.js'),
    )}"></script>
</body>
</html>`;
  }

  private dispose(): void {
    AccessibilityPanel.currentPanel = undefined;
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

function humanizeGestureName(name: string): string {
  if (name.length <= 2) {
    return name.toUpperCase();
  }

  return name
    .replace(/[-_]/g, ' ')
    .replace(/(^|\s)\w/g, (segment) => segment.toUpperCase());
}
