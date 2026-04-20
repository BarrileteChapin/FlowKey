import * as vscode from 'vscode';
import { setUserCommands } from '../security/commandWhitelist';
import type { HudSettings } from '../types';

const FLOWKEY_SHORTCUTS_KEY = 'flowkey.shortcuts';

const FEATURE_COMMANDS = {
  hud: 'flowkey.toggleHud',
  flow: 'flowkey.openFlowEditor',
  accessibility: 'flowkey.openAccessibility',
} as const;

const RUNNABLE_ACTION_COMMANDS = new Set<string>([
  ...Object.values(FEATURE_COMMANDS),
  'flowkey.openSettings',
  'flowkey.openHud',
  'flowkey.openWindowLauncher',
]);

interface FeatureShortcutSettings {
  primary: string;
  longPress: string;
  device: string;
}

interface ShortcutSettings {
  hud: FeatureShortcutSettings;
  flow: FeatureShortcutSettings;
  accessibility: FeatureShortcutSettings;
}

const DEFAULT_SHORTCUTS: ShortcutSettings = {
  hud: { primary: 'ctrl+shift+h', longPress: '', device: '' },
  flow: { primary: 'ctrl+shift+f', longPress: '', device: '' },
  accessibility: { primary: 'ctrl+shift+a', longPress: '', device: '' },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normaliseShortcut(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return raw.length > 0 ? raw : fallback;
}

function normaliseOptionalShortcut(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function parseFeatureShortcutSettings(value: unknown, defaults: FeatureShortcutSettings): FeatureShortcutSettings {
  if (isRecord(value)) {
    return {
      primary: normaliseShortcut(value.primary, defaults.primary),
      longPress: normaliseOptionalShortcut(value.longPress),
      device: normaliseOptionalShortcut(value.device),
    };
  }

  return {
    primary: normaliseShortcut(value, defaults.primary),
    longPress: '',
    device: '',
  };
}

function stripJsonComments(input: string): string {
  let output = '';
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = i + 1 < input.length ? input[i + 1] : '';

    if (inLineComment) {
      if (ch === '\n' || ch === '\r') {
        inLineComment = false;
        output += ch;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      output += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      output += ch;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    output += ch;
  }

  return output;
}

function stripTrailingCommas(input: string): string {
  let output = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inString) {
      output += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      output += ch;
      continue;
    }

    if (ch === ',') {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) {
        j++;
      }
      const nextNonWhitespace = j < input.length ? input[j] : '';
      if (nextNonWhitespace === '}' || nextNonWhitespace === ']') {
        continue;
      }
    }

    output += ch;
  }

  return output;
}

function parseJsonArrayWithComments(text: string): Array<Record<string, unknown>> {
  const withoutComments = stripJsonComments(text);
  const normalised = stripTrailingCommas(withoutComments);

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalised);
  } catch {
    throw new Error('Workspace keybindings.json has syntax issues. Fix the file, then re-apply shortcuts.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Workspace keybindings file must contain a JSON array.');
  }

  return parsed.filter((entry): entry is Record<string, unknown> => isRecord(entry));
}

function toHudSettingsPatch(key: string, value: unknown): Partial<HudSettings> | null {
  switch (key) {
    case 'flowkey.gridCols':
      return typeof value === 'number' ? { gridCols: value } : null;
    case 'flowkey.gridRows':
      return typeof value === 'number' ? { gridRows: value } : null;
    case 'flowkey.density':
      return typeof value === 'string' ? { density: value as HudSettings['density'] } : null;
    case 'flowkey.transparency':
      return typeof value === 'number' ? { transparency: value } : null;
    case 'flowkey.tileShape':
      return typeof value === 'string' ? { tileShape: value as HudSettings['tileShape'] } : null;
    case 'flowkey.dockPosition':
      return typeof value === 'string' ? { dockPosition: value as HudSettings['dockPosition'] } : null;
    default:
      return null;
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

export class SettingsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'flowkey.settings';

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly globalState: vscode.Memento,
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken,
  ): void {
    void context;
    void token;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (!isRecord(msg)) {
        return;
      }

      if (msg.command === 'getSetting') {
        const settingKey = String(msg.key ?? '');
        const value = this.globalState.get<unknown>(settingKey);
        webviewView.webview.postMessage({ type: 'setting', key: settingKey, value });
        return;
      }

      if (msg.command === 'getShortcuts') {
        webviewView.webview.postMessage({ type: 'shortcuts', value: this.getShortcuts() });
        return;
      }

      if (msg.command === 'runActionCommand') {
        const commandId = String(msg.commandId ?? '');
        if (RUNNABLE_ACTION_COMMANDS.has(commandId)) {
          try {
            await vscode.commands.executeCommand(commandId);
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            webviewView.webview.postMessage({
              type: 'shortcutResult',
              ok: false,
              message: `Unable to run command: ${errorMessage}`,
            });
          }
        }
        return;
      }

      if (msg.command === 'openWorkspaceKeybindings') {
        try {
          await this.openWorkspaceKeybindings();
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          webviewView.webview.postMessage({
            type: 'shortcutResult',
            ok: false,
            message: errorMessage,
          });
        }
        return;
      }

      if (msg.command === 'applyShortcuts') {
        try {
          const shortcuts = this.parseShortcuts(msg.value);
          await this.globalState.update(FLOWKEY_SHORTCUTS_KEY, shortcuts);
          await this.applyWorkspaceKeybindings(shortcuts);
          webviewView.webview.postMessage({
            type: 'shortcutResult',
            ok: true,
            message: 'Shortcuts applied to .vscode/keybindings.json',
          });
          webviewView.webview.postMessage({ type: 'shortcuts', value: shortcuts });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          webviewView.webview.postMessage({
            type: 'shortcutResult',
            ok: false,
            message: errorMessage,
          });
        }
        return;
      }

      if (msg.command === 'setSetting') {
        const settingKey = String(msg.key ?? '');

        if (msg.key === 'flowkey.customCommands' && Array.isArray(msg.value)) {
          const rawValues = msg.value as unknown[];
          const customCommands = rawValues
            .filter((v): v is string => typeof v === 'string')
            .map((v) => v.trim())
            .filter((v) => v.length > 0);
          await this.globalState.update(settingKey, customCommands);
          setUserCommands(customCommands);
          await vscode.commands.executeCommand('flowkey.refreshHudState');
          return;
        }

        const patch = toHudSettingsPatch(settingKey, msg.value);
        if (patch) {
          // Preview changes immediately while the value is being persisted.
          void vscode.commands.executeCommand('flowkey.previewHudSettings', patch);
        }

        await this.globalState.update(settingKey, msg.value);
        await vscode.commands.executeCommand('flowkey.refreshHudState');
        return;
      }
    });
  }

  private parseShortcuts(value: unknown): ShortcutSettings {
    const raw = isRecord(value) ? value : {};
    return {
      hud: parseFeatureShortcutSettings(raw.hud, DEFAULT_SHORTCUTS.hud),
      flow: parseFeatureShortcutSettings(raw.flow, DEFAULT_SHORTCUTS.flow),
      accessibility: parseFeatureShortcutSettings(raw.accessibility, DEFAULT_SHORTCUTS.accessibility),
    };
  }

  private getShortcuts(): ShortcutSettings {
    const persisted = this.globalState.get<unknown>(FLOWKEY_SHORTCUTS_KEY, DEFAULT_SHORTCUTS);
    return this.parseShortcuts(persisted);
  }

  private async openWorkspaceKeybindings(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('Open a workspace folder to configure FlowKey shortcuts.');
    }

    const vscodeDir = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode');
    await vscode.workspace.fs.createDirectory(vscodeDir);

    const keybindingsUri = vscode.Uri.joinPath(vscodeDir, 'keybindings.json');
    let exists = true;
    try {
      await vscode.workspace.fs.stat(keybindingsUri);
    } catch {
      exists = false;
    }

    if (!exists) {
      await vscode.workspace.fs.writeFile(keybindingsUri, Buffer.from('[]\n', 'utf8'));
    }

    const doc = await vscode.workspace.openTextDocument(keybindingsUri);
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  private async applyWorkspaceKeybindings(shortcuts: ShortcutSettings): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('Open a workspace folder to configure FlowKey shortcuts.');
    }

    const vscodeDir = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode');
    await vscode.workspace.fs.createDirectory(vscodeDir);

    const keybindingsUri = vscode.Uri.joinPath(vscodeDir, 'keybindings.json');
    let existingEntries: Array<Record<string, unknown>> = [];

    try {
      const bytes = await vscode.workspace.fs.readFile(keybindingsUri);
      const text = Buffer.from(bytes).toString('utf8').trim();
      if (text.length > 0) {
        existingEntries = parseJsonArrayWithComments(text);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const missing = message.includes('FileNotFound') || message.includes('ENOENT');
      if (!missing) {
        throw err;
      }
    }

    const managedCommands = new Set([
      ...Object.values(FEATURE_COMMANDS),
      'flowkey.handleLauncherTrigger',
      'flowkey.openWindowLauncher',
    ]);
    const retained = existingEntries.filter((entry) => {
      const command = entry.command;
      return !(typeof command === 'string' && managedCommands.has(command));
    });

    const desiredEntries = [
      { key: shortcuts.hud.primary, command: FEATURE_COMMANDS.hud },
      { key: shortcuts.hud.longPress, command: FEATURE_COMMANDS.hud },
      { key: shortcuts.hud.device, command: FEATURE_COMMANDS.hud },
      { key: shortcuts.flow.primary, command: FEATURE_COMMANDS.flow },
      { key: shortcuts.flow.longPress, command: FEATURE_COMMANDS.flow },
      { key: shortcuts.flow.device, command: FEATURE_COMMANDS.flow },
      { key: shortcuts.accessibility.primary, command: FEATURE_COMMANDS.accessibility },
      { key: shortcuts.accessibility.longPress, command: FEATURE_COMMANDS.accessibility },
      { key: shortcuts.accessibility.device, command: FEATURE_COMMANDS.accessibility },
    ]
      .map((entry) => ({ ...entry, key: entry.key.trim().toLowerCase() }))
      .filter((entry) => entry.key.length > 0)
      .filter((entry, index, entries) => {
        const first = entries.findIndex(
          (candidate) => candidate.command === entry.command
            && candidate.key === entry.key
        );
        return first === index;
      });

    const next = [...retained, ...desiredEntries];
    await vscode.workspace.fs.writeFile(
      keybindingsUri,
      Buffer.from(`${JSON.stringify(next, null, 2)}\n`, 'utf8'),
    );
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'),
    );
    const tokensUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'shared', 'tokens.css'),
    );

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
      style-src ${webview.cspSource} 'nonce-${nonce}' https://api.fontshare.com;
      font-src ${webview.cspSource} https://cdn.fontshare.com;
      script-src 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${codiconsUri}">
  <link rel="stylesheet" href="${tokensUri}">
  <style nonce="${nonce}">
    body {
      font-family: var(--font-body);
      font-size: var(--text-base);
      color: var(--text-primary);
      background: transparent;
      padding: 0;
    }
    .glass-panel {
      background: var(--glass-bg);
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-xl);
    }
    .settings-root {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      max-width: 980px;
      margin: 0 auto;
    }
    .settings-hero {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-4);
      background: color-mix(in srgb, var(--accent-navigation) 8%, var(--glass-bg));
    }
    .settings-hero__eyebrow,
    h3 {
      font-size: var(--text-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-secondary);
      margin: 0;
    }
    .settings-hero__title {
      font-size: var(--text-lg);
      font-weight: 700;
      color: var(--text-primary);
    }
    .settings-hero__copy,
    .section-note {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--text-secondary);
      line-height: 1.5;
    }
    .settings-hero__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-top: var(--space-1);
    }
    .settings-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px var(--space-2);
      border-radius: var(--radius-full);
      border: 1px solid var(--glass-border);
      background: var(--glass-surface-2);
      color: var(--text-secondary);
      font-size: var(--text-xs);
    }
    .settings-grid {
      display: grid;
      gap: var(--space-3);
    }
    .settings-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
    }
    .settings-card__header {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }
    .settings-card__title {
      font-size: var(--text-md);
      font-weight: 600;
      color: var(--text-primary);
    }
    .settings-preview {
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      padding: var(--space-3);
      background: var(--glass-surface);
      transition: opacity 120ms ease;
    }
    .settings-preview__meta {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      margin-bottom: var(--space-2);
      line-height: 1.4;
    }
    .settings-preview__grid {
      display: grid;
      gap: 8px;
    }
    .settings-preview__grid--compact {
      gap: 4px;
    }
    .settings-preview__grid--spacious {
      gap: 12px;
    }
    .settings-preview__tile {
      min-height: 26px;
      border-radius: var(--radius-md);
      border: 1px solid var(--glass-border);
      background: color-mix(in srgb, var(--glass-surface-2) 88%, transparent);
      color: var(--text-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--text-xs);
      font-weight: 600;
    }
    .settings-preview__tile--octagon {
      clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%);
      border-radius: 2px;
    }
    .setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .setting-row label {
      font-size: var(--text-sm);
      color: var(--text-secondary);
    }
    .setting-row select,
    .setting-row input[type="text"],
    .setting-row input[type="number"],
    .setting-row input[type="range"] {
      background: var(--glass-surface-2);
      color: var(--text-primary);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-sm);
      padding: 4px 8px;
      font-size: var(--text-sm);
    }
    .setting-row input[type="text"] {
      width: 154px;
      font-family: var(--font-body);
    }
    .setting-row select:focus-visible,
    .setting-row input[type="text"]:focus-visible,
    .command-input-row input:focus-visible,
    input[type="range"]:focus-visible {
      outline: 2px solid var(--profile-accent);
      outline-offset: 2px;
    }
    input[type="range"] {
      width: 100px;
      border: none;
      padding: 0;
    }
    .value-label {
      font-size: var(--text-xs);
      color: var(--text-secondary);
      min-width: 28px;
      text-align: right;
    }
    .command-access {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .command-input-row {
      display: flex;
      gap: 6px;
    }
    .command-input-row input {
      flex: 1;
      background: var(--glass-surface-2);
      color: var(--text-primary);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-sm);
      padding: 4px 6px;
      font-size: var(--text-sm);
    }
    .command-input-row button,
    .command-item button {
      background: color-mix(in srgb, var(--accent-navigation) 16%, var(--glass-surface-2));
      color: var(--text-primary);
      border: 1px solid color-mix(in srgb, var(--accent-navigation) 35%, var(--glass-border));
      border-radius: var(--radius-sm);
      padding: 4px 8px;
      cursor: pointer;
      font-size: var(--text-xs);
    }
    .command-input-row button:hover,
    .command-item button:hover,
    .action-row button:hover,
    .shortcut-record:hover,
    .command-hints button:hover {
      background: color-mix(in srgb, var(--accent-navigation) 24%, var(--glass-surface-2));
      color: var(--text-primary);
      border-color: color-mix(in srgb, var(--accent-navigation) 45%, var(--glass-border));
    }
    .action-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 8px;
    }
    .action-row button {
      background: color-mix(in srgb, var(--accent-navigation) 16%, var(--glass-surface-2));
      color: var(--text-primary);
      border: 1px solid color-mix(in srgb, var(--accent-navigation) 35%, var(--glass-border));
      border-radius: var(--radius-full);
      padding: 4px 8px;
      cursor: pointer;
      font-size: var(--text-xs);
    }
    .action-row button.secondary {
      background: var(--glass-surface-2);
      color: var(--text-secondary);
      border-color: var(--glass-border);
    }
    .action-row button.secondary:hover {
      background: var(--glass-border-hover);
      border-color: var(--glass-border-hover);
    }
    .shortcut-field {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .shortcut-field input {
      width: 154px;
      font-family: var(--vscode-editor-font-family);
    }
    .shortcut-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: var(--space-3);
      margin-bottom: 10px;
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      background: var(--glass-surface);
    }
    .shortcut-group__title {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-primary);
    }
    .shortcut-group .setting-row {
      margin-bottom: 0;
    }
    .shortcut-record {
      background: var(--glass-surface-2);
      color: var(--text-secondary);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-sm);
      padding: 4px 8px;
      cursor: pointer;
      font-size: var(--text-xs);
      white-space: nowrap;
    }
    .shortcut-record[data-capturing="true"] {
      background: color-mix(in srgb, var(--accent-navigation) 18%, var(--glass-surface-2));
      color: var(--text-primary);
      border-color: color-mix(in srgb, var(--accent-navigation) 40%, var(--glass-border));
    }
    .shortcut-status {
      margin-top: 6px;
      font-size: var(--text-xs);
      color: var(--text-secondary);
      min-height: 16px;
      line-height: 1.4;
    }
    .shortcut-status.error {
      color: var(--color-error);
    }
    .shortcut-status.success {
      color: var(--accent-git);
    }
    .command-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 148px;
      overflow: auto;
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-md);
      padding: 6px;
      background: var(--glass-surface);
    }
    .command-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-family: var(--font-body);
      font-size: var(--text-xs);
      padding: 2px 0;
    }
    .command-empty {
      font-size: var(--text-xs);
      color: var(--text-secondary);
      font-style: italic;
    }
    .command-hints {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .command-hints button {
      background: var(--glass-surface-2);
      color: var(--text-secondary);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-full);
      padding: 4px 8px;
      cursor: pointer;
      font-size: var(--text-xs);
    }
    .action-row button:focus-visible,
    .shortcut-record:focus-visible,
    .command-input-row button:focus-visible,
    .command-item button:focus-visible,
    .command-hints button:focus-visible {
      outline: 2px solid var(--profile-accent);
      outline-offset: 2px;
    }
    .info-text {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      margin-top: 0;
      line-height: 1.4;
    }
    @media (max-width: 680px) {
      .settings-root {
        padding: var(--space-3);
      }
      .setting-row,
      .a11y-bind__row {
        flex-direction: column;
        align-items: stretch;
      }
      .shortcut-field,
      .command-input-row {
        flex-wrap: wrap;
      }
      .setting-row input[type="text"],
      .shortcut-field input {
        width: 100%;
      }
    }
  </style>
 </head>
<body>
  <main class="settings-root">
    <header class="settings-hero glass-panel">
      <span class="settings-hero__eyebrow">FlowKey Settings</span>
      <div class="settings-hero__title">Appearance, triggers, and command access</div>
      <p class="settings-hero__copy">This view controls how FlowKey looks and how its three main features open. The goal is direct access, not hidden configuration.</p>
      <div class="settings-hero__chips">
        <span class="settings-chip"><i class="codicon codicon-layout" aria-hidden="true"></i> HUD layout</span>
        <span class="settings-chip"><i class="codicon codicon-key" aria-hidden="true"></i> Direct feature shortcuts</span>
        <span class="settings-chip"><i class="codicon codicon-terminal" aria-hidden="true"></i> Command hints</span>
      </div>
    </header>

    <section class="settings-card glass-panel">
      <div class="settings-card__header">
        <h3>Layout And Appearance</h3>
        <p class="section-note">These controls affect the HUD panel immediately. Open the HUD preview to verify the result with the current profile.</p>
      </div>
      <div class="action-row">
        <button id="action-open-hud-preview" type="button">Open HUD Preview</button>
      </div>
      <div class="setting-row">
        <label>Grid Columns</label>
        <select id="gridCols">
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4" selected>4</option>
          <option value="5">5</option>
          <option value="6">6</option>
        </select>
      </div>
      <div class="setting-row">
        <label>Grid Rows</label>
        <select id="gridRows">
          <option value="1">1</option>
          <option value="2" selected>2</option>
          <option value="3">3</option>
          <option value="4">4</option>
        </select>
      </div>
      <div class="setting-row">
        <label>Density</label>
        <select id="density">
          <option value="compact">Compact</option>
          <option value="comfortable" selected>Comfortable</option>
          <option value="spacious">Spacious</option>
        </select>
      </div>
      <div class="setting-row">
        <label>Tile Shape</label>
        <select id="tileShape">
          <option value="grid" selected>Grid</option>
          <option value="octagon">Octagon</option>
        </select>
      </div>
      <div class="setting-row">
        <label>Transparency</label>
        <input type="range" id="transparency" min="40" max="95" value="72" />
        <span class="value-label" id="transpVal">72%</span>
      </div>
      <div class="setting-row">
        <label>Dock Position</label>
        <select id="dockPosition">
          <option value="float" selected>Float</option>
          <option value="top">Top</option>
          <option value="bottom">Bottom</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
          <option value="top-left">Top Left</option>
          <option value="top-right">Top Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="bottom-right">Bottom Right</option>
        </select>
      </div>

      <div class="settings-card__header">
        <h3>Live Preview</h3>
        <p class="section-note">This preview uses the same layout variables as the HUD, so changes here should match what you see in the real panel.</p>
      </div>
      <div id="settingsPreview" class="settings-preview" role="status" aria-live="polite">
        <div id="settingsPreviewMeta" class="settings-preview__meta"></div>
        <div id="settingsPreviewGrid" class="settings-preview__grid"></div>
      </div>
    </section>

    <section class="settings-card glass-panel">
      <div class="settings-card__header">
        <h3>Feature Access</h3>
        <p class="section-note">FlowKey should open its features directly. Primary shortcuts are the defaults, long press is stored as a double-press chord, and external device keys support macro pads or media buttons.</p>
      </div>
      <div class="action-row">
        <button id="action-open-window-launcher" type="button">Open Window Launcher</button>
      </div>

      <h3>Keyboard Shortcuts</h3>
      <div class="shortcut-group">
    <div class="shortcut-group__title">Toggle HUD</div>
    <div class="setting-row">
      <label>Primary Shortcut</label>
      <div class="shortcut-field">
        <input id="shortcutHudPrimary" type="text" placeholder="ctrl+shift+h" />
        <button class="shortcut-record" id="record-shortcutHudPrimary" data-input="shortcutHudPrimary" type="button">Record</button>
      </div>
    </div>
    <div class="setting-row">
      <label>Long Press</label>
      <div class="shortcut-field">
        <input id="shortcutHudLongPress" type="text" placeholder="ctrl+shift+h ctrl+shift+h" />
        <button class="shortcut-record" id="record-shortcutHudLongPress" data-input="shortcutHudLongPress" type="button">Record</button>
        <button class="shortcut-record" data-double-press-feature="hud" type="button">Use Double Press</button>
      </div>
    </div>
    <div class="setting-row">
      <label>External Device Key</label>
      <div class="shortcut-field">
        <input id="shortcutHudDevice" type="text" placeholder="f13 or mediaplaypause" />
        <button class="shortcut-record" id="record-shortcutHudDevice" data-input="shortcutHudDevice" type="button">Record</button>
      </div>
    </div>
  </div>
  <div class="shortcut-group">
    <div class="shortcut-group__title">Open Flow Editor</div>
    <div class="setting-row">
      <label>Primary Shortcut</label>
      <div class="shortcut-field">
        <input id="shortcutFlowPrimary" type="text" placeholder="ctrl+shift+f" />
        <button class="shortcut-record" id="record-shortcutFlowPrimary" data-input="shortcutFlowPrimary" type="button">Record</button>
      </div>
    </div>
    <div class="setting-row">
      <label>Long Press</label>
      <div class="shortcut-field">
        <input id="shortcutFlowLongPress" type="text" placeholder="ctrl+shift+f ctrl+shift+f" />
        <button class="shortcut-record" id="record-shortcutFlowLongPress" data-input="shortcutFlowLongPress" type="button">Record</button>
        <button class="shortcut-record" data-double-press-feature="flow" type="button">Use Double Press</button>
      </div>
    </div>
    <div class="setting-row">
      <label>External Device Key</label>
      <div class="shortcut-field">
        <input id="shortcutFlowDevice" type="text" placeholder="f14" />
        <button class="shortcut-record" id="record-shortcutFlowDevice" data-input="shortcutFlowDevice" type="button">Record</button>
      </div>
    </div>
  </div>
  <div class="shortcut-group">
    <div class="shortcut-group__title">Open Accessibility</div>
    <div class="setting-row">
      <label>Primary Shortcut</label>
      <div class="shortcut-field">
        <input id="shortcutAccessibilityPrimary" type="text" placeholder="ctrl+shift+a" />
        <button class="shortcut-record" id="record-shortcutAccessibilityPrimary" data-input="shortcutAccessibilityPrimary" type="button">Record</button>
      </div>
    </div>
    <div class="setting-row">
      <label>Long Press</label>
      <div class="shortcut-field">
        <input id="shortcutAccessibilityLongPress" type="text" placeholder="ctrl+shift+a ctrl+shift+a" />
        <button class="shortcut-record" id="record-shortcutAccessibilityLongPress" data-input="shortcutAccessibilityLongPress" type="button">Record</button>
        <button class="shortcut-record" data-double-press-feature="accessibility" type="button">Use Double Press</button>
      </div>
    </div>
    <div class="setting-row">
      <label>External Device Key</label>
      <div class="shortcut-field">
        <input id="shortcutAccessibilityDevice" type="text" placeholder="f15" />
        <button class="shortcut-record" id="record-shortcutAccessibilityDevice" data-input="shortcutAccessibilityDevice" type="button">Record</button>
      </div>
    </div>
  </div>
  <div class="action-row">
    <button id="apply-shortcuts" type="button">Apply To Workspace</button>
    <button id="open-workspace-keybindings" class="secondary" type="button">Open keybindings.json</button>
  </div>
  <p class="section-note">Long press is emulated as a double-press chord because VS Code keybindings do not expose physical hold duration.</p>
  <div id="shortcutStatus" class="shortcut-status"></div>

    </section>

    <section class="settings-card glass-panel">
      <div class="settings-card__header">
        <h3>Command Access</h3>
        <p class="section-note">Add safe external command IDs that FlowKey can expose. If the command name is not obvious, start from one of the hints below and adjust it.</p>
      </div>
      <div class="command-access">
    <div class="command-input-row">
      <input id="customCommandInput" type="text" placeholder="e.g. editor.action.rename" />
      <button id="add-custom-command" type="button">Add</button>
    </div>
    <p class="section-note">Command examples: editor.action.rename, workbench.action.quickOpen, workbench.action.files.save, git.pull.</p>
    <div class="command-hints">
      <button data-command-hint="editor.action.rename" type="button">Rename Symbol</button>
      <button data-command-hint="workbench.action.quickOpen" type="button">Quick Open</button>
      <button data-command-hint="workbench.action.files.save" type="button">Save File</button>
      <button data-command-hint="git.pull" type="button">Git Pull</button>
    </div>
    <div class="command-list" id="customCommandsList">
      <div class="command-empty">No custom commands added.</div>
    </div>
      </div>

      <p class="info-text">
        <i class="codicon codicon-info"></i>
        HUD settings apply in real-time. Use the direct feature shortcuts above or open the Window Launcher when you want a single chooser.
      </p>
    </section>
  </main>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const settingKeys = [
      'flowkey.gridCols',
      'flowkey.gridRows',
      'flowkey.density',
      'flowkey.tileShape',
      'flowkey.transparency',
      'flowkey.dockPosition',
      'flowkey.customCommands',
    ];

    let customCommands = [];
    let capturingShortcutInputId = null;
    const defaultShortcuts = {
      hud: { primary: 'ctrl+shift+h', longPress: '', device: '' },
      flow: { primary: 'ctrl+shift+f', longPress: '', device: '' },
      accessibility: { primary: 'ctrl+shift+a', longPress: '', device: '' },
    };
    const currentSettings = {
      gridCols: 4,
      gridRows: 2,
      density: 'comfortable',
      tileShape: 'grid',
      transparency: 0.72,
      dockPosition: 'float',
    };

    function formatDockLabel(value) {
      return String(value || 'float').replace(/-/g, ' ');
    }

    function applySettingToState(key, value) {
      switch (key) {
        case 'flowkey.gridCols':
          currentSettings.gridCols = clampNumber(Number(value), 2, 6, 4);
          break;
        case 'flowkey.gridRows':
          currentSettings.gridRows = clampNumber(Number(value), 1, 4, 2);
          break;
        case 'flowkey.density':
          currentSettings.density = String(value || 'comfortable');
          break;
        case 'flowkey.tileShape':
          currentSettings.tileShape = String(value || 'grid');
          break;
        case 'flowkey.transparency':
          currentSettings.transparency = clampNumber(Number(value), 0.4, 0.95, 0.72);
          break;
        case 'flowkey.dockPosition':
          currentSettings.dockPosition = String(value || 'float');
          break;
      }
    }

    function syncSettingsForm() {
      document.getElementById('gridCols').value = String(currentSettings.gridCols);
      document.getElementById('gridRows').value = String(currentSettings.gridRows);
      document.getElementById('density').value = currentSettings.density;
      document.getElementById('tileShape').value = currentSettings.tileShape;
      document.getElementById('dockPosition').value = currentSettings.dockPosition;
      document.getElementById('transparency').value = String(Math.round(currentSettings.transparency * 100));
      document.getElementById('transpVal').textContent = String(Math.round(currentSettings.transparency * 100)) + '%';
    }

    function update(key, value) {
      applySettingToState(key, value);
      syncSettingsForm();
      vscode.postMessage({ command: 'setSetting', key, value });
      if (key !== 'flowkey.customCommands') {
        renderSettingsPreview();
      }
    }

    function requestSetting(key) {
      vscode.postMessage({ command: 'getSetting', key });
    }

    function normaliseCommand(command) {
      return String(command || '').trim();
    }

    function normaliseShortcut(shortcut) {
      return String(shortcut || '').trim().toLowerCase();
    }

    function clampNumber(value, min, max, fallback) {
      if (!Number.isFinite(value)) {
        return fallback;
      }
      return Math.max(min, Math.min(max, value));
    }

    function renderSettingsPreview() {
      const preview = document.getElementById('settingsPreview');
      const previewMeta = document.getElementById('settingsPreviewMeta');
      const previewGrid = document.getElementById('settingsPreviewGrid');

      if (!preview || !previewMeta || !previewGrid) {
        return;
      }

      const cols = currentSettings.gridCols;
      const rows = currentSettings.gridRows;
      const density = currentSettings.density;
      const tileShape = currentSettings.tileShape;
      const dockPosition = currentSettings.dockPosition;
      const transparencyPct = Math.round(currentSettings.transparency * 100);

      previewGrid.className = 'settings-preview__grid settings-preview__grid--' + density;
      previewGrid.style.gridTemplateColumns = 'repeat(' + String(cols) + ', minmax(0, 1fr))';

      const tileCount = Math.max(1, Math.min(cols * rows, 8));
      previewGrid.innerHTML = Array.from({ length: tileCount }, (_, index) => {
        const tileClass = tileShape === 'octagon'
          ? 'settings-preview__tile settings-preview__tile--octagon'
          : 'settings-preview__tile';
        return '<div class="' + tileClass + '"><span>' + String(index + 1) + '</span></div>';
      }).join('');

      previewMeta.textContent =
        'Cols ' + String(cols)
        + ' • Rows ' + String(rows)
        + ' • ' + density
        + ' • ' + tileShape
        + ' • Dock ' + formatDockLabel(dockPosition)
        + ' • ' + String(transparencyPct) + '%';

      preview.style.opacity = String(Math.max(0.58, Math.min(1, transparencyPct / 100)));
    }

    function normaliseShortcutKey(key) {
      const value = String(key || '').toLowerCase();
      const aliases = {
        ' ': 'space',
        arrowup: 'up',
        arrowdown: 'down',
        arrowleft: 'left',
        arrowright: 'right',
        escape: 'esc',
        enter: 'enter',
        backspace: 'backspace',
        delete: 'delete',
        tab: 'tab',
        pageup: 'pageup',
        pagedown: 'pagedown',
        mediaplaypause: 'mediaplaypause',
        mediatracknext: 'medianexttrack',
        mediatrackprevious: 'mediaprevioustrack',
        mediastop: 'mediastop',
        audiovolumeup: 'audiovolumeup',
        audiovolumedown: 'audiovolumedown',
        audiovolumemute: 'audiomute',
        browserback: 'browserback',
        browserforward: 'browserforward',
      };

      if (aliases[value]) {

          function isModifierKey(key) {
            return key === 'ctrl' || key === 'cmd' || key === 'alt' || key === 'shift';
          }
        return aliases[value];
      }

      if (value === '+' || value === '=') {
        return '+';
      }

      if (value === '-') {
        return '-';
      }

      if (/^f\\d{1,2}$/.test(value)) {
        return value;
      }

      if (value.length === 1 && /[a-z0-9]/.test(value)) {
        return value;
      }

      return value.replace(/\\s+/g, '');
    }

    function allowUnmodifiedCapture(inputId) {
      return inputId.endsWith('LongPress') || inputId.endsWith('Device');
    }

    function buildDoublePressShortcut(shortcut) {
      const base = normaliseShortcut(shortcut);
      if (!base) {
        return '';
      }
      return base + ' ' + base;
    }

    function shortcutFromEvent(event, allowSingleKey, isLongPressMode) {
      const parts = [];
      if (event.ctrlKey) parts.push('ctrl');
      if (event.metaKey) parts.push('cmd');
      if (event.altKey) parts.push('alt');
      if (event.shiftKey) parts.push('shift');

      const key = normaliseShortcutKey(event.key);
      if (!key || isModifierKey(key)) {
        return '';
      }

      if (!allowSingleKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        return '';
      }

      parts.push(key);
      const base = parts.join('+');
      if (!isLongPressMode) {
        return base;
      }
      return buildDoublePressShortcut(base);
    }

    function setCaptureState(inputId, capturing) {
      document.querySelectorAll('.shortcut-record').forEach((button) => {
        const isCurrent = button.getAttribute('data-input') === inputId;
        button.setAttribute('data-capturing', String(capturing && isCurrent));
      });
    }

    function stopShortcutCapture(message, kind) {
      const activeInputId = capturingShortcutInputId;
      capturingShortcutInputId = null;
      if (activeInputId) {
        setCaptureState(activeInputId, false);
      }
      if (message) {
        setShortcutStatus(message, kind || '');
      }
    }

    function startShortcutCapture(inputId) {
      if (capturingShortcutInputId === inputId) {
        stopShortcutCapture('Shortcut capture cancelled.', '');
        return;
      }

      stopShortcutCapture('', '');
      capturingShortcutInputId = inputId;
      setCaptureState(inputId, true);
      if (inputId.endsWith('LongPress')) {
        setShortcutStatus('Press the base shortcut. It will be saved as a double-press chord.', '');
      } else if (allowUnmodifiedCapture(inputId)) {
        setShortcutStatus('Press a key or key combination (Esc to cancel).', '');
      } else {
        setShortcutStatus('Press a key combination (Esc to cancel).', '');
      }

      const input = document.getElementById(inputId);
      if (input) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        input.focus();
        input.select();
      }
    }

    function setShortcutStatus(message, kind) {
      const status = document.getElementById('shortcutStatus');
      if (!status) return;
      status.textContent = message || '';
      status.classList.remove('error', 'success');
      if (kind === 'error') {
        status.classList.add('error');
      } else if (kind === 'success') {
        status.classList.add('success');
      }
    }

    function shortcutInputId(feature, kind) {
      return 'shortcut' + feature.charAt(0).toUpperCase() + feature.slice(1) + kind;
    }

    function readShortcutInputs() {
      return {
        hud: {
          primary: normaliseShortcut(document.getElementById('shortcutHudPrimary').value) || defaultShortcuts.hud.primary,
          longPress: normaliseShortcut(document.getElementById('shortcutHudLongPress').value),
          device: normaliseShortcut(document.getElementById('shortcutHudDevice').value),
        },
        flow: {
          primary: normaliseShortcut(document.getElementById('shortcutFlowPrimary').value) || defaultShortcuts.flow.primary,
          longPress: normaliseShortcut(document.getElementById('shortcutFlowLongPress').value),
          device: normaliseShortcut(document.getElementById('shortcutFlowDevice').value),
        },
        accessibility: {
          primary: normaliseShortcut(document.getElementById('shortcutAccessibilityPrimary').value) || defaultShortcuts.accessibility.primary,
          longPress: normaliseShortcut(document.getElementById('shortcutAccessibilityLongPress').value),
          device: normaliseShortcut(document.getElementById('shortcutAccessibilityDevice').value),
        },
      };
    }

    function renderShortcuts(shortcuts) {
      if (!shortcuts) return;
      document.getElementById('shortcutHudPrimary').value = normaliseShortcut(shortcuts.hud?.primary) || defaultShortcuts.hud.primary;
      document.getElementById('shortcutHudLongPress').value = normaliseShortcut(shortcuts.hud?.longPress);
      document.getElementById('shortcutHudDevice').value = normaliseShortcut(shortcuts.hud?.device);
      document.getElementById('shortcutFlowPrimary').value = normaliseShortcut(shortcuts.flow?.primary) || defaultShortcuts.flow.primary;
      document.getElementById('shortcutFlowLongPress').value = normaliseShortcut(shortcuts.flow?.longPress);
      document.getElementById('shortcutFlowDevice').value = normaliseShortcut(shortcuts.flow?.device);
      document.getElementById('shortcutAccessibilityPrimary').value = normaliseShortcut(shortcuts.accessibility?.primary) || defaultShortcuts.accessibility.primary;
      document.getElementById('shortcutAccessibilityLongPress').value = normaliseShortcut(shortcuts.accessibility?.longPress);
      document.getElementById('shortcutAccessibilityDevice').value = normaliseShortcut(shortcuts.accessibility?.device);
    }

    function setDoublePressFromPrimary(feature) {
      const primaryInput = document.getElementById(shortcutInputId(feature, 'Primary'));
      const longPressInput = document.getElementById(shortcutInputId(feature, 'LongPress'));
      const doublePress = buildDoublePressShortcut(primaryInput ? primaryInput.value : '');
      if (!doublePress) {
        setShortcutStatus('Set the primary shortcut first.', 'error');
        return;
      }
      longPressInput.value = doublePress;
      setShortcutStatus('Long press trigger set to double-press: ' + doublePress, 'success');
    }

    function applyShortcuts() {
      stopShortcutCapture('', '');
      setShortcutStatus('Applying shortcuts...', '');
      vscode.postMessage({ command: 'applyShortcuts', value: readShortcutInputs() });
    }

    function runActionCommand(commandId) {
      vscode.postMessage({ command: 'runActionCommand', commandId });
    }

    function openWorkspaceKeybindings() {
      vscode.postMessage({ command: 'openWorkspaceKeybindings' });
    }

    function useCommandHint(command) {
      const input = document.getElementById('customCommandInput');
      if (!input) {
        return;
      }
      input.value = normaliseCommand(command);
      input.focus();
    }

    function renderCustomCommands() {
      const list = document.getElementById('customCommandsList');
      if (!list) return;

      if (customCommands.length === 0) {
        list.innerHTML = '<div class="command-empty">No custom commands added.</div>';
        return;
      }

      list.innerHTML = '';
      customCommands.forEach((cmd, index) => {
        const item = document.createElement('div');
        item.className = 'command-item';

        const label = document.createElement('span');
        label.textContent = cmd;

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.textContent = 'Remove';
        removeButton.addEventListener('click', () => removeCustomCommandByIndex(index));

        item.appendChild(label);
        item.appendChild(removeButton);
        list.appendChild(item);
      });
    }

    function addCustomCommand() {
      const input = document.getElementById('customCommandInput');
      if (!input) return;

      const command = normaliseCommand(input.value);
      if (!command) return;
      if (!customCommands.includes(command)) {
        customCommands = [...customCommands, command].sort((a, b) => a.localeCompare(b));
        update('flowkey.customCommands', customCommands);
        renderCustomCommands();
      }
      input.value = '';
    }

    function removeCustomCommand(command) {
      customCommands = customCommands.filter((c) => c !== command);
      update('flowkey.customCommands', customCommands);
      renderCustomCommands();
    }

    function removeCustomCommandByIndex(index) {
      const command = customCommands[Number(index)];
      if (!command) {
        return;
      }
      removeCustomCommand(command);
    }

    function bindSettingControl(id, eventName, key, transform) {
      const element = document.getElementById(id);
      if (!element) {
        return;
      }
      element.addEventListener(eventName, (event) => {
        const target = event.target;
        update(key, transform(target));
      });
    }

    function bindButton(id, handler) {
      const element = document.getElementById(id);
      if (!element) {
        return;
      }
      element.addEventListener('click', handler);
    }

    bindButton('action-open-hud-preview', () => runActionCommand('flowkey.openHud'));
    bindButton('action-open-window-launcher', () => runActionCommand('flowkey.openWindowLauncher'));
    bindButton('apply-shortcuts', applyShortcuts);
    bindButton('open-workspace-keybindings', openWorkspaceKeybindings);
    bindButton('add-custom-command', addCustomCommand);

    bindSettingControl('gridCols', 'change', 'flowkey.gridCols', (target) => Number(target.value));
    bindSettingControl('gridRows', 'change', 'flowkey.gridRows', (target) => Number(target.value));
    bindSettingControl('density', 'change', 'flowkey.density', (target) => String(target.value));
    bindSettingControl('tileShape', 'change', 'flowkey.tileShape', (target) => String(target.value));
    bindSettingControl('dockPosition', 'change', 'flowkey.dockPosition', (target) => String(target.value));
    bindSettingControl('transparency', 'input', 'flowkey.transparency', (target) => Number(target.value) / 100);

    document.querySelectorAll('[data-input]').forEach((button) => {
      button.addEventListener('click', () => {
        const inputId = button.getAttribute('data-input');
        if (inputId) {
          startShortcutCapture(inputId);
        }
      });
    });

    document.querySelectorAll('.shortcut-field input').forEach((input) => {
      input.addEventListener('input', (event) => {
        const target = event.target;
        if (!target) {
          return;
        }

        const normalised = normaliseShortcut(target.value);
        if (target.value !== normalised) {
          target.value = normalised;
        }

        if (capturingShortcutInputId === target.id) {
          stopShortcutCapture('', '');
        }
      });
    });

    document.querySelectorAll('[data-double-press-feature]').forEach((button) => {
      button.addEventListener('click', () => {
        const feature = button.getAttribute('data-double-press-feature');
        if (feature) {
          setDoublePressFromPrimary(feature);
        }
      });
    });

    document.querySelectorAll('[data-command-hint]').forEach((button) => {
      button.addEventListener('click', () => {
        const command = button.getAttribute('data-command-hint');
        if (command) {
          useCommandHint(command);
        }
      });
    });

    window.addEventListener('keydown', (event) => {
      if (!capturingShortcutInputId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }

      if (event.key === 'Escape') {
        stopShortcutCapture('Shortcut capture cancelled.', '');
        return;
      }

      const key = normaliseShortcutKey(event.key);
      if (isModifierKey(key)) {
        setShortcutStatus('Hold modifiers, then press the final key.', '');
        return;
      }

      const allowSingle = allowUnmodifiedCapture(capturingShortcutInputId);
      const isLongPressMode = capturingShortcutInputId.endsWith('LongPress');
      const shortcut = shortcutFromEvent(event, allowSingle, isLongPressMode);
      if (!shortcut) {
        if (allowSingle) {
          setShortcutStatus('Press any supported key (letters, Fx, media keys) or key combination.', 'error');
        } else {
          setShortcutStatus('Use Ctrl/Cmd or Alt with another key.', 'error');
        }
        return;
      }

      const input = document.getElementById(capturingShortcutInputId);
      if (input) {
        input.value = shortcut;
      }
      stopShortcutCapture('Captured: ' + shortcut, 'success');
    }, true);

    window.addEventListener('blur', () => {
      if (capturingShortcutInputId) {
        stopShortcutCapture('Shortcut capture stopped because focus moved away.', '');
      }
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === 'setting') {
        switch (msg.key) {
          case 'flowkey.gridCols':
            applySettingToState(msg.key, msg.value);
            break;
          case 'flowkey.gridRows':
            applySettingToState(msg.key, msg.value);
            break;
          case 'flowkey.density':
            applySettingToState(msg.key, msg.value);
            break;
          case 'flowkey.tileShape':
            applySettingToState(msg.key, msg.value);
            break;
          case 'flowkey.transparency':
            applySettingToState(msg.key, msg.value);
            break;
          case 'flowkey.dockPosition':
            applySettingToState(msg.key, msg.value);
            break;
          case 'flowkey.customCommands':
            if (Array.isArray(msg.value)) {
              customCommands = msg.value
                .filter((v) => typeof v === 'string')
                .map((v) => normaliseCommand(v))
                .filter((v) => v.length > 0)
                .sort((a, b) => a.localeCompare(b));
              renderCustomCommands();
            }
            break;
        }

        syncSettingsForm();
        renderSettingsPreview();
      }

      if (msg.type === 'shortcuts') {
        renderShortcuts(msg.value);
      }

      if (msg.type === 'shortcutResult') {
        if (msg.ok) {
          setShortcutStatus(String(msg.message || 'Shortcuts updated.'), 'success');
        } else {
          setShortcutStatus(String(msg.message || 'Unable to apply shortcuts.'), 'error');
        }
      }
    });

    document.getElementById('customCommandInput').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addCustomCommand();
      }
    });

    settingKeys.forEach(requestSetting);
    vscode.postMessage({ command: 'getShortcuts' });
    syncSettingsForm();
    renderSettingsPreview();
  </script>
</body>
</html>`;
  }
}
