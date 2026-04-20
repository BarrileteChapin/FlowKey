/**
 * Command whitelist for FlowKey.
 * Only whitelisted VS Code command IDs may be executed through the HUD.
 */

const BUILT_IN_COMMANDS: ReadonlySet<string> = new Set([
  // Navigation
  'workbench.action.quickOpen',
  'workbench.action.gotoSymbol',
  'workbench.action.gotoLine',
  'editor.action.peekDefinition',
  'workbench.action.splitEditor',
  'workbench.action.zoomIn',
  'workbench.action.zoomOut',
  'workbench.action.closeActiveEditor',
  'workbench.action.showAllEditorsByMostRecentlyUsed',
  'workbench.action.files.save',
  'workbench.action.files.saveAll',
  'workbench.action.findInFiles',
  'workbench.action.problems.focus',
  'workbench.action.showCommands',
  'workbench.action.openSettings',
  'workbench.action.openSettingsJson',
  'workbench.action.navigateBack',
  'workbench.action.navigateForward',
  'workbench.action.reopenClosedEditor',
  'workbench.action.toggleSidebarVisibility',
  'workbench.action.togglePanel',
  'editor.action.quickFix',
  'editor.action.rename',
  'editor.action.refactor',
  'editor.action.formatDocument',
  'editor.action.organizeImports',
  'workbench.action.terminal.new',
  'workbench.action.terminal.focus',
  'workbench.action.terminal.runSelectedText',
  'workbench.action.tasks.runTask',

  // Debug
  'workbench.action.debug.start',
  'workbench.action.debug.stepInto',
  'workbench.action.debug.stepOver',
  'workbench.action.debug.stepOut',
  'workbench.action.debug.continue',
  'workbench.action.debug.stop',
  'workbench.action.debug.restart',
  'editor.debug.action.toggleBreakpoint',
  'workbench.debug.action.toggleRepl',

  // Git
  'git.stage',
  'git.stageAll',
  'git.commit',
  'git.push',
  'git.pull',
  'git.branch',
  'git.merge',
  'git.stash',
  'git.unstash',
  'git.fetch',
  'git.sync',
  'workbench.view.scm',

  // Testing
  'testing.runAll',
  'testing.runCurrentFile',
  'testing.runAtCursor',
  'testing.toggleContinuousRun',
  'testing.showMostRecentOutput',
  'workbench.action.testing.debugAll',
  'testing.coverageAll',
  'testing.reRunLastRun',

  // AI / Copilot
  'flowkey.ai.explainSelection',
  'flowkey.ai.fixSelection',
  'flowkey.ai.generateFromPrompt',
  'github.copilot.chat.explain',
  'github.copilot.chat.fix',
  'github.copilot.chat.generate',
  'github.copilot.interactiveSession.explain',
  'github.copilot.interactiveSession.fix',
  'github.copilot.interactiveSession.generate',
  'editor.action.inlineSuggest.trigger',
  'editor.action.inlineSuggest.accept',
  'workbench.action.chat.open',
  'workbench.panel.chat.view.copilot.focus',
]);

let userCommands: Set<string> = new Set();

function normalise(commandId: string): string {
  return commandId.trim();
}

export function isWhitelisted(commandId: string): boolean {
  const id = normalise(commandId);
  return BUILT_IN_COMMANDS.has(id) || userCommands.has(id);
}

export function addUserCommand(commandId: string): void {
  const id = normalise(commandId);
  if (id.length > 0) {
    userCommands.add(id);
  }
}

export function removeUserCommand(commandId: string): void {
  userCommands.delete(normalise(commandId));
}

export function getWhitelistedCommands(): string[] {
  return [...BUILT_IN_COMMANDS, ...userCommands];
}

export function getUserCommands(): string[] {
  return [...userCommands];
}

export function setUserCommands(commands: string[]): void {
  userCommands = new Set(
    commands
      .map((c) => normalise(c))
      .filter((c) => c.length > 0 && !BUILT_IN_COMMANDS.has(c)),
  );
}

export function resetUserCommands(): void {
  userCommands = new Set();
}
