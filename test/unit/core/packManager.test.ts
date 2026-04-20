import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validatePack, PackManager } from '../../../src/core/packManager';
import { ProfileManager } from '../../../src/core/profileManager';
import { mockGlobalState, mockWorkspaceState, clearMockStores } from '../../mocks/vscodeState';
import type { WorkspacePack, Profile, Flow, GestureBinding } from '../../../src/types';

function validPack(overrides: Partial<WorkspacePack> = {}): WorkspacePack {
  return {
    version: '1.0',
    name: 'Test Pack',
    profiles: [],
    flows: [],
    gestureBindings: [],
    exportedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeProfile(id: string): Profile {
  return {
    id,
    name: id,
    isBuiltIn: false,
    trigger: 'manual',
    accentColor: '#fff',
    tiles: [],
    layoutConfig: { gridCols: 4, gridRows: 2, density: 'comfortable', tileShape: 'grid' },
  };
}

function makeFlow(id: string): Flow {
  return { id, name: id, nodes: [], edges: [], confirmedTerminalOnce: false };
}

function makeBinding(gestureId: string): GestureBinding {
  return { gestureId, label: gestureId, points: [{ x: 0, y: 0 }], action: { type: 'command', ref: 'test' } };
}

describe('validatePack', () => {
  it('accepts a valid minimal pack', () => {
    expect(validatePack(validPack()).valid).toBe(true);
  });

  it('rejects non-object data', () => {
    expect(validatePack('string').valid).toBe(false);
    expect(validatePack(null).valid).toBe(false);
  });

  it('rejects unsupported version', () => {
    expect(validatePack(validPack({ version: '2.0' as '1.0' })).valid).toBe(false);
  });

  it('rejects missing name', () => {
    const pack = validPack();
    (pack as unknown as Record<string, unknown>).name = '';
    expect(validatePack(pack).valid).toBe(false);
  });

  it('detects prototype pollution keys', () => {
    const pack = validPack();
    (pack as unknown as Record<string, unknown>).__proto__ = { evil: true };
    // __proto__ is special in JS, so create a nested pollution
    const evilPack = validPack({ profiles: [{ __proto__: {} }] as unknown as Profile[] });
    // Actually test through nested data approach
    const directPollution = JSON.parse(JSON.stringify(validPack()));
    directPollution.constructor = 'bad';
    const result = validatePack(directPollution);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/forbidden keys/i);
  });

  it('rejects malformed profiles', () => {
    const pack = validPack({ profiles: [{ broken: true }] as unknown as Profile[] });
    expect(validatePack(pack).valid).toBe(false);
  });

  it('rejects malformed flows', () => {
    const pack = validPack({ flows: [{ broken: true }] as unknown as Flow[] });
    expect(validatePack(pack).valid).toBe(false);
  });

  it('rejects missing exportedAt', () => {
    const pack = validPack();
    delete (pack as unknown as Record<string, unknown>).exportedAt;
    expect(validatePack(pack).valid).toBe(false);
  });
});

describe('PackManager', () => {
  let pm: ProfileManager;
  let packMan: PackManager;

  beforeEach(() => {
    clearMockStores();
    vi.clearAllMocks();
    pm = new ProfileManager(mockGlobalState as unknown as import('vscode').Memento);
    packMan = new PackManager(pm, mockWorkspaceState as unknown as import('vscode').Memento);
  });

  it('exportPack returns valid pack with current data', () => {
    const pack = packMan.exportPack('My Pack');
    expect(pack.version).toBe('1.0');
    expect(pack.name).toBe('My Pack');
    expect(pack.profiles.length).toBeGreaterThan(0); // built-in profiles seeded
    expect(pack.exportedAt).toBeTruthy();
    expect(validatePack(pack).valid).toBe(true);
  });

  it('applyMerge adds new flows without removing existing', async () => {
    // Seed existing flow
    await mockWorkspaceState.update('flowkey.flows', [makeFlow('existing')]);

    const pack = {
      ...validPack({
        profiles: [makeProfile('new-profile')],
        flows: [makeFlow('new-flow')],
        gestureBindings: [makeBinding('new-gesture')],
      }),
    } as WorkspacePack;

    await packMan.applyMerge(pack);

    const flows = mockWorkspaceState.get('flowkey.flows', []) as Flow[];
    expect(flows).toHaveLength(2);
    expect(flows.map((f) => f.id)).toContain('existing');
    expect(flows.map((f) => f.id)).toContain('new-flow');
  });

  it('applyMerge skips duplicate IDs', async () => {
    await mockWorkspaceState.update('flowkey.flows', [makeFlow('dup')]);

    const pack = {
      ...validPack({ flows: [makeFlow('dup')], profiles: [], gestureBindings: [] }),
    } as WorkspacePack;

    await packMan.applyMerge(pack);

    const flows = mockWorkspaceState.get('flowkey.flows', []) as Flow[];
    expect(flows).toHaveLength(1);
  });

  it('applyReplace overwrites all data', async () => {
    await mockWorkspaceState.update('flowkey.flows', [makeFlow('old1'), makeFlow('old2')]);

    const pack = {
      ...validPack({
        profiles: [makeProfile('replaced')],
        flows: [makeFlow('new-only')],
        gestureBindings: [],
      }),
    } as WorkspacePack;

    await packMan.applyReplace(pack);

    const flows = mockWorkspaceState.get('flowkey.flows', []) as Flow[];
    expect(flows).toHaveLength(1);
    expect(flows[0].id).toBe('new-only');
  });
});
