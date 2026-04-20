import * as vscode from 'vscode';
import { Profile } from '../types';

const PROFILES_KEY = 'flowkey.profiles';
const ACTIVE_PROFILE_KEY = 'flowkey.activeProfileId';

function defaultLayout() {
  return {
    gridCols: 4,
    gridRows: 2,
    density: 'comfortable' as const,
    tileShape: 'grid' as const,
  };
}

function createBuiltInProfiles(): Profile[] {
  return [
    {
      id: 'navigation',
      name: 'Navigation',
      isBuiltIn: true,
      trigger: 'manual',
      accentColor: '--accent-navigation',
      tiles: [
        { id: 'nav-1', label: 'Search', icon: 'search', action: { type: 'command', ref: 'workbench.action.findInFiles' } },
        { id: 'nav-2', label: 'Go to File', icon: 'go-to-file', action: { type: 'command', ref: 'workbench.action.quickOpen' } },
        { id: 'nav-3', label: 'Go to Symbol', icon: 'symbol-method', action: { type: 'command', ref: 'workbench.action.gotoSymbol' } },
        { id: 'nav-4', label: 'Errors', icon: 'error', action: { type: 'command', ref: 'workbench.action.problems.focus' } },
        { id: 'nav-5', label: 'Peek', icon: 'eye', action: { type: 'command', ref: 'editor.action.peekDefinition' } },
        { id: 'nav-6', label: 'Split', icon: 'split-horizontal', action: { type: 'command', ref: 'workbench.action.splitEditor' } },
        { id: 'nav-7', label: 'Zoom In', icon: 'zoom-in', action: { type: 'command', ref: 'workbench.action.zoomIn' } },
        { id: 'nav-8', label: 'Close', icon: 'close', action: { type: 'command', ref: 'workbench.action.closeActiveEditor' } },
      ],
      layoutConfig: defaultLayout(),
    },
    {
      id: 'debug',
      name: 'Debug',
      isBuiltIn: true,
      trigger: 'onDebug',
      accentColor: '--accent-debug',
      tiles: [
        { id: 'dbg-1', label: 'Run', icon: 'play', action: { type: 'command', ref: 'workbench.action.debug.start' } },
        { id: 'dbg-2', label: 'Step In', icon: 'debug-step-into', action: { type: 'command', ref: 'workbench.action.debug.stepInto' } },
        { id: 'dbg-3', label: 'Step Over', icon: 'debug-step-over', action: { type: 'command', ref: 'workbench.action.debug.stepOver' } },
        { id: 'dbg-4', label: 'Continue', icon: 'debug-continue', action: { type: 'command', ref: 'workbench.action.debug.continue' } },
        { id: 'dbg-5', label: 'Stop', icon: 'debug-stop', action: { type: 'command', ref: 'workbench.action.debug.stop' } },
        { id: 'dbg-6', label: 'Restart', icon: 'debug-restart', action: { type: 'command', ref: 'workbench.action.debug.restart' } },
        { id: 'dbg-7', label: 'Inspect', icon: 'inspect', action: { type: 'command', ref: 'workbench.debug.action.toggleRepl' } },
        { id: 'dbg-8', label: 'Breakpoint', icon: 'debug-breakpoint', action: { type: 'command', ref: 'editor.debug.action.toggleBreakpoint' } },
      ],
      layoutConfig: defaultLayout(),
    },
    {
      id: 'git',
      name: 'Git',
      isBuiltIn: true,
      trigger: 'onGit',
      accentColor: '--accent-git',
      tiles: [
        { id: 'git-1', label: 'Stage', icon: 'add', action: { type: 'command', ref: 'git.stageAll' } },
        { id: 'git-2', label: 'Commit', icon: 'git-commit', action: { type: 'command', ref: 'git.commit' } },
        { id: 'git-3', label: 'Push', icon: 'cloud-upload', action: { type: 'command', ref: 'git.push' } },
        { id: 'git-4', label: 'Pull', icon: 'cloud-download', action: { type: 'command', ref: 'git.pull' } },
        { id: 'git-5', label: 'Branch', icon: 'git-branch', action: { type: 'command', ref: 'git.branch' } },
        { id: 'git-6', label: 'Merge', icon: 'git-merge', action: { type: 'command', ref: 'git.merge' } },
        { id: 'git-7', label: 'SCM', icon: 'source-control', action: { type: 'command', ref: 'workbench.view.scm' } },
        { id: 'git-8', label: 'Stash', icon: 'archive', action: { type: 'command', ref: 'git.stash' } },
      ],
      layoutConfig: defaultLayout(),
    },
    {
      id: 'ai-copilot',
      name: 'AI Copilot',
      isBuiltIn: true,
      trigger: 'manual',
      accentColor: '--accent-ai',
      tiles: [
        { id: 'ai-1', label: 'Ask AI', icon: 'comment-discussion', action: { type: 'command', ref: 'workbench.panel.chat.view.copilot.focus' } },
        { id: 'ai-2', label: 'Explain', icon: 'book', action: { type: 'command', ref: 'github.copilot.interactiveSession.explain' } },
        { id: 'ai-3', label: 'Refactor', icon: 'edit', action: { type: 'command', ref: 'github.copilot.interactiveSession.fix' } },
        { id: 'ai-4', label: 'Generate', icon: 'sparkle', action: { type: 'command', ref: 'github.copilot.interactiveSession.generate' } },
        { id: 'ai-5', label: 'Inline', icon: 'lightbulb', action: { type: 'command', ref: 'editor.action.inlineSuggest.trigger' } },
        { id: 'ai-6', label: 'Accept', icon: 'check', action: { type: 'command', ref: 'editor.action.inlineSuggest.accept' } },
      ],
      layoutConfig: defaultLayout(),
    },
    {
      id: 'testing',
      name: 'Testing',
      isBuiltIn: true,
      trigger: 'onTestFile',
      accentColor: '--accent-testing',
      tiles: [
        { id: 'test-1', label: 'Run All', icon: 'run-all', action: { type: 'command', ref: 'testing.runAll' } },
        { id: 'test-2', label: 'Run File', icon: 'play', action: { type: 'command', ref: 'testing.runCurrentFile' } },
        { id: 'test-3', label: 'Run Single', icon: 'play-circle', action: { type: 'command', ref: 'testing.runAtCursor' } },
        { id: 'test-4', label: 'Watch', icon: 'eye-watch', action: { type: 'command', ref: 'testing.toggleContinuousRun' } },
        { id: 'test-5', label: 'Coverage', icon: 'graph', action: { type: 'command', ref: 'testing.coverageAll' } },
        { id: 'test-6', label: 'Output', icon: 'output', action: { type: 'command', ref: 'testing.showMostRecentOutput' } },
        { id: 'test-7', label: 'Debug Test', icon: 'debug-alt', action: { type: 'command', ref: 'workbench.action.testing.debugAll' } },
      ],
      layoutConfig: defaultLayout(),
    },
  ];
}

export class ProfileManager {
  private profiles: Map<string, Profile> = new Map();

  constructor(private storage: vscode.Memento) {
    this.loadProfiles();
  }

  private loadProfiles(): void {
    const saved = this.storage.get<Profile[]>(PROFILES_KEY);
    if (saved && saved.length > 0) {
      for (const profile of saved) {
        this.profiles.set(profile.id, profile);
      }
    } else {
      this.seedBuiltInProfiles();
    }
  }

  private seedBuiltInProfiles(): void {
    const builtIns = createBuiltInProfiles();
    for (const profile of builtIns) {
      this.profiles.set(profile.id, profile);
    }
    this.persist();
  }

  private async persist(): Promise<void> {
    await this.storage.update(PROFILES_KEY, this.getAllProfiles());
  }

  getAllProfiles(): Profile[] {
    return Array.from(this.profiles.values());
  }

  getProfile(id: string): Profile | undefined {
    return this.profiles.get(id);
  }

  getActiveProfileId(): string {
    return this.storage.get<string>(ACTIVE_PROFILE_KEY, 'navigation');
  }

  async setActiveProfile(id: string): Promise<void> {
    if (!this.profiles.has(id)) {
      throw new Error(`Profile "${id}" not found.`);
    }
    await this.storage.update(ACTIVE_PROFILE_KEY, id);
  }

  async createProfile(profile: Profile): Promise<void> {
    if (!profile.id || !profile.name) {
      throw new Error('Profile must have an id and name.');
    }
    if (this.profiles.has(profile.id)) {
      throw new Error(`Profile with id "${profile.id}" already exists.`);
    }
    this.profiles.set(profile.id, profile);
    await this.persist();
  }

  async updateProfile(id: string, updates: Partial<Profile>): Promise<void> {
    const existing = this.profiles.get(id);
    if (!existing) {
      throw new Error(`Profile "${id}" not found.`);
    }
    const updated = { ...existing, ...updates, id };
    this.profiles.set(id, updated);
    await this.persist();
  }

  async deleteProfile(id: string): Promise<void> {
    const profile = this.profiles.get(id);
    if (!profile) {
      throw new Error(`Profile "${id}" not found.`);
    }
    if (profile.isBuiltIn) {
      throw new Error('Cannot delete built-in profiles.');
    }
    this.profiles.delete(id);
    await this.persist();
  }

  async mergeProfiles(imported: Profile[]): Promise<void> {
    for (const profile of imported) {
      if (!this.profiles.has(profile.id)) {
        this.profiles.set(profile.id, profile);
      }
    }
    await this.persist();
  }

  async replaceProfiles(imported: Profile[]): Promise<void> {
    this.profiles.clear();
    for (const profile of imported) {
      this.profiles.set(profile.id, profile);
    }
    await this.persist();
  }

  getProfileByTrigger(trigger: string): Profile | undefined {
    for (const profile of this.profiles.values()) {
      if (profile.trigger === trigger) {
        return profile;
      }
    }
    return undefined;
  }
}
