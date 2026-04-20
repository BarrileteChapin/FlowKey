import * as vscode from 'vscode';
import { ProfileManager } from './core/profileManager';
import { CommandBroker } from './core/commandBroker';
import { TriggerWatcher } from './core/triggerWatcher';
import { PackManager } from './core/packManager';
import { initConfirmationGuard } from './security/confirmationGuard';
import { HudPanel } from './panels/HudPanel';
import { FlowEditorPanel } from './panels/FlowEditorPanel';
import { AccessibilityPanel } from './panels/AccessibilityPanel';
import { QuickActionsProvider } from './panels/QuickActionsProvider';
import { SettingsViewProvider } from './panels/SettingsViewProvider';
import { getBuiltInFlows } from './core/builtInFlows';
import { setUserCommands } from './security/commandWhitelist';
import { runCopilotAction } from './core/copilotActions';
import type { Flow } from './types';

let triggerWatcher: TriggerWatcher | undefined;
let launcherTriggerTimer: ReturnType<typeof setTimeout> | undefined;
let launcherTriggerCount = 0;
let launcherTriggerLastAt = 0;

export function activate(context: vscode.ExtensionContext): void {
  // Initialize security
  initConfirmationGuard(context.workspaceState);

  // Initialize core
  const profileManager = new ProfileManager(context.globalState);
  const commandBroker = new CommandBroker();
  const packManager = new PackManager(profileManager, context.workspaceState);

  // Restore custom whitelisted commands persisted from sidebar settings.
  const persistedCustomCommands = context.globalState.get<string[]>('flowkey.customCommands', []);
  setUserCommands(Array.isArray(persistedCustomCommands) ? persistedCustomCommands : []);

  migrateLegacyCommandIds(context.workspaceState);

  // Wire flow provider so commandBroker can execute flows
  commandBroker.setFlowProvider(() => context.workspaceState.get('flowkey.flows', []));

  // --- Sidebar views ---
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('flowkey.quickActions', new QuickActionsProvider()),
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SettingsViewProvider.viewType,
      new SettingsViewProvider(context.extensionUri, context.globalState),
    ),
  );

  // Mark keys for Settings Sync
  context.globalState.setKeysForSync([
    'flowkey.profiles',
    'flowkey.activeProfileId',
    'flowkey.gridCols',
    'flowkey.gridRows',
    'flowkey.density',
    'flowkey.transparency',
    'flowkey.tileShape',
    'flowkey.dockPosition',
    'flowkey.voiceAliases',
    'flowkey.customCommands',
    'flowkey.shortcuts',
  ]);

  // --- HUD Commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand('flowkey.openHud', () => {
      HudPanel.create(context.extensionUri, profileManager, commandBroker, context.globalState);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('flowkey.closeHud', () => {
      HudPanel.close();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('flowkey.toggleHud', () => {
      if (HudPanel.currentPanel) {
        HudPanel.close();
      } else {
        HudPanel.create(context.extensionUri, profileManager, commandBroker, context.globalState);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('flowkey.refreshHudState', () => {
      if (HudPanel.currentPanel) {
        HudPanel.currentPanel.sendState();
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('flowkey.previewHudSettings', (patch: unknown) => {
      if (!patch || typeof patch !== 'object') {
        return;
      }
      HudPanel.previewSettings(patch as Partial<import('./types').HudSettings>);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('flowkey.openSettings', async () => {
      await openFlowKeySettingsSidebar();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('flowkey.handleLauncherTrigger', async (payload: unknown) => {
      const source = readLauncherTriggerSource(payload);

      if (source === 'longpress' || source === 'device') {
        resetLauncherTriggerState();
        await vscode.commands.executeCommand('flowkey.openWindowLauncher', { triggerSource: source });
        return;
      }

      const now = Date.now();
      const repeatWindowMs = 360;
      const settleDelayMs = 280;
      launcherTriggerCount = now - launcherTriggerLastAt <= repeatWindowMs ? launcherTriggerCount + 1 : 1;
      launcherTriggerLastAt = now;

      if (launcherTriggerTimer) {
        clearTimeout(launcherTriggerTimer);
        launcherTriggerTimer = undefined;
      }

      launcherTriggerTimer = setTimeout(async () => {
        const triggerSource = launcherTriggerCount >= 2 ? 'longpress' : 'press';
        resetLauncherTriggerState();
        await vscode.commands.executeCommand('flowkey.openWindowLauncher', { triggerSource });
      }, settleDelayMs);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('flowkey.openWindowLauncher', async (payload: unknown) => {
      const triggerSource = readLauncherTriggerSource(payload);
      const titleSuffix = triggerSource === 'longpress'
        ? ' (Long Press)'
        : triggerSource === 'device'
          ? ' (Device Key)'
          : '';

      const actions: Array<vscode.QuickPickItem & { commandId: string }> = [
        {
          label: '$(layout) Toggle HUD',
          description: 'Show or hide the FlowKey HUD overlay',
          commandId: 'flowkey.toggleHud',
        },
        {
          label: '$(type-hierarchy) Open Flow Editor',
          description: 'Create and edit multi-step flows',
          commandId: 'flowkey.openFlowEditor',
        },
        {
          label: '$(accessibility) Open Accessibility',
          description: 'Manage gestures and voice aliases',
          commandId: 'flowkey.openAccessibility',
        },
        {
          label: '$(settings-gear) Open FlowKey Settings',
          description: 'Open the sidebar settings view',
          commandId: 'flowkey.openSettings',
        },
      ];

      const picked = await vscode.window.showQuickPick(actions, {
        title: `FlowKey Window Launcher${titleSuffix}`,
        placeHolder: 'Choose what to open',
      });

      if (!picked) {
        return;
      }

      await vscode.commands.executeCommand(picked.commandId);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('flowkey.ai.explainSelection', async () => {
      await runCopilotAction('explain');
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('flowkey.ai.fixSelection', async () => {
      await runCopilotAction('fix');
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('flowkey.ai.generateFromPrompt', async () => {
      await runCopilotAction('generate');
    }),
  );

  // --- Flow Editor Commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand('flowkey.openFlowEditor', async () => {
      const wasAlreadyOpen = Boolean(FlowEditorPanel.currentPanel);
      FlowEditorPanel.create(context.extensionUri, context.workspaceState, profileManager);
      if (!wasAlreadyOpen) {
        await maximizeFlowEditor();
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('flowkey.closeFlowEditor', () => {
      FlowEditorPanel.close();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('flowkey.loadExampleFlows', async () => {
      const existingFlows = context.workspaceState.get<Flow[]>('flowkey.flows', []);
      const examples = getBuiltInFlows();
      const existingIds = new Set(existingFlows.map((flow) => flow.id));

      const additions = examples.filter((flow) => !existingIds.has(flow.id));
      if (additions.length === 0) {
        vscode.window.showInformationMessage('FlowKey: Example flows are already available in this workspace.');
        return;
      }

      await context.workspaceState.update('flowkey.flows', [...existingFlows, ...additions]);
      if (FlowEditorPanel.currentPanel) {
        FlowEditorPanel.currentPanel.sendState();
      }
      vscode.window.showInformationMessage(`FlowKey: Added ${additions.length} example flow${additions.length === 1 ? '' : 's'}.`);
    }),
  );

  // --- Accessibility Commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand('flowkey.openAccessibility', () => {
      AccessibilityPanel.create(
        context.extensionUri,
        context.workspaceState,
        context.globalState,
        commandBroker,
        profileManager,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('flowkey.closeAccessibility', () => {
      AccessibilityPanel.close();
    }),
  );

  // --- Pack Commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand('flowkey.exportPack', async () => {
      const name = await vscode.window.showInputBox({ prompt: 'Pack name', value: 'My Pack' });
      if (name) {
        await packManager.exportToFile(name);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('flowkey.importPack', async () => {
      const pack = await packManager.importFromFile();
      if (!pack) return;

      const behaviour = await vscode.window.showQuickPick(['Merge', 'Replace'], {
        placeHolder: 'Import behaviour: merge with existing data or replace all?',
      });

      if (behaviour === 'Merge') {
        await packManager.applyMerge(pack);
        vscode.window.showInformationMessage(`FlowKey: Merged pack "${pack.name}".`);
      } else if (behaviour === 'Replace') {
        await packManager.applyReplace(pack);
        vscode.window.showInformationMessage(`FlowKey: Replaced all data with pack "${pack.name}".`);
      }

      // Refresh open panels
      if (HudPanel.currentPanel) HudPanel.currentPanel.sendState();
    }),
  );

  // --- Flow execution command (for commandBroker flow dispatch) ---
  context.subscriptions.push(
    vscode.commands.registerCommand('flowkey.runFlow', async (flowId: string) => {
      const { executeFlow } = await import('./core/flowEngine');
      const flows = context.workspaceState.get<import('./types').Flow[]>('flowkey.flows', []);
      const flow = flows.find((f) => f.id === flowId);
      if (flow) {
        const result = await executeFlow(flow, false);
        if (!result.success) {
          vscode.window.showErrorMessage(`FlowKey: Flow failed — ${result.error}`);
        }
      }
    }),
  );

  // Start context-based trigger watcher
  triggerWatcher = new TriggerWatcher(profileManager);
  triggerWatcher.onProfileSwitch = (profileId: string) => {
    if (HudPanel.currentPanel) {
      HudPanel.currentPanel.updateActiveProfile(profileId);
    }
  };
  triggerWatcher.start();
  context.subscriptions.push({ dispose: () => triggerWatcher?.dispose() });
}

export function deactivate(): void {
  triggerWatcher?.dispose();
  resetLauncherTriggerState();
}

async function maximizeFlowEditor(): Promise<void> {
  const availableCommands = new Set(await vscode.commands.getCommands(true));
  const candidates = [
    'workbench.action.maximizeEditor',
    'workbench.action.maximizeEditorHideSidebar',
  ];

  for (const commandId of candidates) {
    if (availableCommands.has(commandId)) {
      try {
        await vscode.commands.executeCommand(commandId);
      } catch {
        // Best-effort only: opening Flow Editor should still succeed if maximize fails.
      }
      return;
    }
  }
}

async function openFlowKeySettingsSidebar(): Promise<void> {
  const availableCommands = new Set(await vscode.commands.getCommands(true));
  try {
    await vscode.commands.executeCommand('workbench.view.extension.flowkey');
    if (availableCommands.has('flowkey.settings.focus')) {
      await vscode.commands.executeCommand('flowkey.settings.focus');
    }
  } catch {
    // Best effort only; users can still open settings from the activity bar.
  }
}

function migrateLegacyCommandIds(workspaceState: vscode.Memento): void {
  const flows = workspaceState.get<Flow[]>('flowkey.flows', []);
  if (flows.length === 0) {
    return;
  }

  let changed = false;
  const migrated = flows.map((flow) => {
    const nodes = flow.nodes.map((node) => {
      if (node.type !== 'command') {
        return node;
      }

      const commandId = String(node.data.commandId ?? '');
      let migratedId = commandId;

      if (commandId === 'github.copilot.interactiveSession.explain') {
        migratedId = 'flowkey.ai.explainSelection';
      } else if (commandId === 'github.copilot.interactiveSession.fix') {
        migratedId = 'flowkey.ai.fixSelection';
      } else if (commandId === 'github.copilot.interactiveSession.generate') {
        migratedId = 'flowkey.ai.generateFromPrompt';
      } else if (commandId === 'github.copilot.chat.explain') {
        migratedId = 'flowkey.ai.explainSelection';
      } else if (commandId === 'github.copilot.chat.fix') {
        migratedId = 'flowkey.ai.fixSelection';
      } else if (commandId === 'github.copilot.chat.generate') {
        migratedId = 'flowkey.ai.generateFromPrompt';
      }

      if (migratedId !== commandId) {
        changed = true;
        return {
          ...node,
          data: {
            ...node.data,
            commandId: migratedId,
          },
        };
      }

      return node;
    });

    return {
      ...flow,
      nodes,
    };
  });

  if (changed) {
    workspaceState.update('flowkey.flows', migrated);
  }
}

function resetLauncherTriggerState(): void {
  if (launcherTriggerTimer) {
    clearTimeout(launcherTriggerTimer);
    launcherTriggerTimer = undefined;
  }
  launcherTriggerCount = 0;
  launcherTriggerLastAt = 0;
}

function readLauncherTriggerSource(payload: unknown): 'primary' | 'press' | 'longpress' | 'device' {
  if (!payload || typeof payload !== 'object') {
    return 'primary';
  }

  const value = payload as Record<string, unknown>;
  const source = typeof value.source === 'string'
    ? value.source
    : typeof value.triggerSource === 'string'
      ? value.triggerSource
      : 'primary';

  if (source === 'press' || source === 'longpress' || source === 'device') {
    return source;
  }

  return 'primary';
}
