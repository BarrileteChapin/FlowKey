import * as vscode from 'vscode';
import { WorkspacePack, Profile, Flow, GestureBinding } from '../types';
import { ProfileManager } from './profileManager';

const FLOWS_KEY = 'flowkey.flows';
const GESTURE_BINDINGS_KEY = 'flowkey.gestureBindings';
const SUPPORTED_VERSIONS = new Set(['1.0']);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function hasPrototypePollution(obj: unknown): boolean {
  if (!isPlainObject(obj)) return false;
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return true;
    if (isPlainObject(obj[key]) && hasPrototypePollution(obj[key])) return true;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (hasPrototypePollution(item)) return true;
    }
  }
  return false;
}

function deepCheckPrototypePollution(obj: unknown): boolean {
  if (isPlainObject(obj)) {
    if (hasPrototypePollution(obj)) return true;
    for (const val of Object.values(obj)) {
      if (deepCheckPrototypePollution(val)) return true;
    }
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (deepCheckPrototypePollution(item)) return true;
    }
  }
  return false;
}

export interface PackValidationResult {
  valid: boolean;
  error?: string;
}

function validateProfile(p: unknown): p is Profile {
  if (!isPlainObject(p)) return false;
  return typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.tiles);
}

function validateFlow(f: unknown): f is Flow {
  if (!isPlainObject(f)) return false;
  return typeof f.id === 'string' && typeof f.name === 'string' && Array.isArray(f.nodes) && Array.isArray(f.edges);
}

function validateGestureBinding(g: unknown): g is GestureBinding {
  if (!isPlainObject(g)) return false;
  return typeof g.gestureId === 'string' && typeof g.label === 'string' && Array.isArray(g.points);
}

export function validatePack(data: unknown): PackValidationResult {
  if (!isPlainObject(data)) {
    return { valid: false, error: 'Pack must be a JSON object.' };
  }

  if (typeof data.version !== 'string' || !SUPPORTED_VERSIONS.has(data.version)) {
    return { valid: false, error: `Unsupported pack version: "${data.version}".` };
  }

  if (typeof data.name !== 'string' || !data.name) {
    return { valid: false, error: 'Pack must have a name.' };
  }

  if (deepCheckPrototypePollution(data)) {
    return { valid: false, error: 'Pack contains forbidden keys (__proto__, constructor, prototype).' };
  }

  if (!Array.isArray(data.profiles)) {
    return { valid: false, error: 'Pack must contain a profiles array.' };
  }
  for (const p of data.profiles as unknown[]) {
    if (!validateProfile(p)) {
      return { valid: false, error: 'Pack contains a malformed profile.' };
    }
  }

  if (!Array.isArray(data.flows)) {
    return { valid: false, error: 'Pack must contain a flows array.' };
  }
  for (const f of data.flows as unknown[]) {
    if (!validateFlow(f)) {
      return { valid: false, error: 'Pack contains a malformed flow.' };
    }
  }

  if (!Array.isArray(data.gestureBindings)) {
    return { valid: false, error: 'Pack must contain a gestureBindings array.' };
  }
  for (const g of data.gestureBindings as unknown[]) {
    if (!validateGestureBinding(g)) {
      return { valid: false, error: 'Pack contains a malformed gesture binding.' };
    }
  }

  if (typeof data.exportedAt !== 'string') {
    return { valid: false, error: 'Pack must have an exportedAt timestamp.' };
  }

  return { valid: true };
}

export class PackManager {
  constructor(
    private profileManager: ProfileManager,
    private workspaceState: vscode.Memento,
  ) {}

  // --- Export ---

  exportPack(name: string): WorkspacePack {
    return {
      version: '1.0',
      name,
      profiles: this.profileManager.getAllProfiles(),
      flows: this.workspaceState.get<Flow[]>(FLOWS_KEY, []),
      gestureBindings: this.workspaceState.get<GestureBinding[]>(GESTURE_BINDINGS_KEY, []),
      exportedAt: new Date().toISOString(),
    };
  }

  async exportToFile(name: string): Promise<void> {
    const pack = this.exportPack(name);
    const json = JSON.stringify(pack, null, 2);

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.flowkey`),
      filters: { 'FlowKey Pack': ['flowkey'] },
    });

    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf-8'));
      vscode.window.showInformationMessage(`FlowKey: Exported pack "${name}" successfully.`);
    }
  }

  // --- Import ---

  async importFromFile(): Promise<WorkspacePack | null> {
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectMany: false,
      filters: { 'FlowKey Pack': ['flowkey', 'json'] },
    });

    if (!uris || uris.length === 0) return null;

    const bytes = await vscode.workspace.fs.readFile(uris[0]);
    const text = Buffer.from(bytes).toString('utf-8');

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      vscode.window.showErrorMessage('FlowKey: Invalid JSON file.');
      return null;
    }

    const validation = validatePack(data);
    if (!validation.valid) {
      vscode.window.showWarningMessage(`FlowKey: ${validation.error}`);
      return null;
    }

    return data as WorkspacePack;
  }

  async applyMerge(pack: WorkspacePack): Promise<void> {
    // Profiles: add new ones only
    await this.profileManager.mergeProfiles(pack.profiles);

    // Flows: add new ones only
    const existing = this.workspaceState.get<Flow[]>(FLOWS_KEY, []);
    const existingIds = new Set(existing.map((f) => f.id));
    const newFlows = pack.flows.filter((f) => !existingIds.has(f.id));
    await this.workspaceState.update(FLOWS_KEY, [...existing, ...newFlows]);

    // Gesture bindings: add new only
    const existingBindings = this.workspaceState.get<GestureBinding[]>(GESTURE_BINDINGS_KEY, []);
    const existingGestureIds = new Set(existingBindings.map((g) => g.gestureId));
    const newBindings = pack.gestureBindings.filter((g) => !existingGestureIds.has(g.gestureId));
    await this.workspaceState.update(GESTURE_BINDINGS_KEY, [...existingBindings, ...newBindings]);
  }

  async applyReplace(pack: WorkspacePack): Promise<void> {
    // Profiles: replace all
    await this.profileManager.replaceProfiles(pack.profiles);

    // Flows: replace all
    await this.workspaceState.update(FLOWS_KEY, pack.flows);

    // Gesture bindings: replace all
    await this.workspaceState.update(GESTURE_BINDINGS_KEY, pack.gestureBindings);
  }
}
