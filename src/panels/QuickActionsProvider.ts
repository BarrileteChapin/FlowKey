import * as vscode from 'vscode';

interface ActionItem {
  label: string;
  icon: string;
  command: string;
  args?: unknown[];
}

const ACTIONS: ActionItem[] = [
  { label: 'Window Launcher', icon: 'layout', command: 'flowkey.openWindowLauncher' },
  { label: 'Toggle HUD', icon: 'layout', command: 'flowkey.toggleHud' },
  { label: 'Open Flow Editor', icon: 'type-hierarchy', command: 'flowkey.openFlowEditor' },
  { label: 'Open Settings', icon: 'settings-gear', command: 'flowkey.openSettings' },
  { label: 'Accessibility', icon: 'accessibility', command: 'flowkey.openAccessibility' },
  { label: 'Export Pack', icon: 'cloud-upload', command: 'flowkey.exportPack' },
  { label: 'Import Pack', icon: 'cloud-download', command: 'flowkey.importPack' },
];

class ActionTreeItem extends vscode.TreeItem {
  constructor(action: ActionItem) {
    super(action.label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(action.icon);
    this.command = {
      command: action.command,
      title: action.label,
      arguments: action.args,
    };
  }
}

export class QuickActionsProvider implements vscode.TreeDataProvider<ActionTreeItem> {
  getTreeItem(element: ActionTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ActionTreeItem[] {
    return ACTIONS.map((a) => new ActionTreeItem(a));
  }
}
