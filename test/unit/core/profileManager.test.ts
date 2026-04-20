import { describe, it, expect, beforeEach } from 'vitest';
import { ProfileManager } from '../../../src/core/profileManager';
import { mockGlobalState, clearMockStores } from '../../mocks/vscodeState';
import type { Profile } from '../../../src/types';

describe('profileManager', () => {
  let manager: ProfileManager;

  beforeEach(() => {
    clearMockStores();
    manager = new ProfileManager(mockGlobalState as any);
  });

  it('returns built-in profiles on initialisation', () => {
    const profiles = manager.getAllProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(5);
    expect(profiles.find((p) => p.id === 'navigation')).toBeDefined();
    expect(profiles.find((p) => p.id === 'debug')).toBeDefined();
    expect(profiles.find((p) => p.id === 'git')).toBeDefined();
    expect(profiles.find((p) => p.id === 'ai-copilot')).toBeDefined();
    expect(profiles.find((p) => p.id === 'testing')).toBeDefined();
  });

  it('creates a new profile with required fields', async () => {
    const profile: Profile = {
      id: 'custom-1',
      name: 'My Profile',
      isBuiltIn: false,
      trigger: 'manual',
      accentColor: '--accent-custom',
      tiles: [],
      layoutConfig: { gridCols: 4, gridRows: 2, density: 'comfortable', tileShape: 'grid' },
    };
    await manager.createProfile(profile);
    expect(manager.getProfile('custom-1')).toBeDefined();
    expect(manager.getProfile('custom-1')?.name).toBe('My Profile');
  });

  it('rejects a profile with missing id or name', async () => {
    await expect(
      manager.createProfile({ id: '', name: 'Test', isBuiltIn: false, trigger: 'manual', accentColor: '', tiles: [], layoutConfig: { gridCols: 4, gridRows: 2, density: 'comfortable', tileShape: 'grid' } }),
    ).rejects.toThrow('id and name');

    await expect(
      manager.createProfile({ id: 'test', name: '', isBuiltIn: false, trigger: 'manual', accentColor: '', tiles: [], layoutConfig: { gridCols: 4, gridRows: 2, density: 'comfortable', tileShape: 'grid' } }),
    ).rejects.toThrow('id and name');
  });

  it('prevents deletion of built-in profiles', async () => {
    await expect(manager.deleteProfile('navigation')).rejects.toThrow('built-in');
  });

  it('allows deletion of custom profiles', async () => {
    const profile: Profile = {
      id: 'custom-2',
      name: 'Deletable',
      isBuiltIn: false,
      trigger: 'manual',
      accentColor: '--accent-custom',
      tiles: [],
      layoutConfig: { gridCols: 4, gridRows: 2, density: 'comfortable', tileShape: 'grid' },
    };
    await manager.createProfile(profile);
    await manager.deleteProfile('custom-2');
    expect(manager.getProfile('custom-2')).toBeUndefined();
  });

  it('correctly merges imported profiles without overwriting existing ones', async () => {
    const imported: Profile[] = [
      {
        id: 'navigation', // Already exists
        name: 'Navigation Overwrite',
        isBuiltIn: true,
        trigger: 'manual',
        accentColor: '--accent-navigation',
        tiles: [],
        layoutConfig: { gridCols: 4, gridRows: 2, density: 'comfortable', tileShape: 'grid' },
      },
      {
        id: 'imported-new',
        name: 'New Imported',
        isBuiltIn: false,
        trigger: 'manual',
        accentColor: '--accent-custom',
        tiles: [],
        layoutConfig: { gridCols: 4, gridRows: 2, density: 'comfortable', tileShape: 'grid' },
      },
    ];

    await manager.mergeProfiles(imported);

    // Navigation should NOT be overwritten
    const nav = manager.getProfile('navigation');
    expect(nav?.name).toBe('Navigation');

    // New profile should be added
    expect(manager.getProfile('imported-new')).toBeDefined();
  });

  it('replaces all profiles when replace mode is selected', async () => {
    const replacement: Profile[] = [
      {
        id: 'only-one',
        name: 'Only Profile',
        isBuiltIn: false,
        trigger: 'manual',
        accentColor: '--accent-custom',
        tiles: [],
        layoutConfig: { gridCols: 4, gridRows: 2, density: 'comfortable', tileShape: 'grid' },
      },
    ];

    await manager.replaceProfiles(replacement);
    const all = manager.getAllProfiles();
    expect(all.length).toBe(1);
    expect(all[0].id).toBe('only-one');
  });

  it('persists changes to globalState after mutation', async () => {
    const profile: Profile = {
      id: 'persist-test',
      name: 'Persist Test',
      isBuiltIn: false,
      trigger: 'manual',
      accentColor: '--accent-custom',
      tiles: [],
      layoutConfig: { gridCols: 4, gridRows: 2, density: 'comfortable', tileShape: 'grid' },
    };
    await manager.createProfile(profile);
    expect(mockGlobalState.update).toHaveBeenCalledWith(
      'flowkey.profiles',
      expect.arrayContaining([expect.objectContaining({ id: 'persist-test' })]),
    );
  });

  it('reads persisted state correctly on re-initialisation', async () => {
    const profile: Profile = {
      id: 'reload-test',
      name: 'Reload Test',
      isBuiltIn: false,
      trigger: 'manual',
      accentColor: '--accent-custom',
      tiles: [],
      layoutConfig: { gridCols: 4, gridRows: 2, density: 'comfortable', tileShape: 'grid' },
    };
    await manager.createProfile(profile);

    // Create a new manager that reads from the same store
    const manager2 = new ProfileManager(mockGlobalState as any);
    expect(manager2.getProfile('reload-test')).toBeDefined();
  });

  it('sets and gets active profile', async () => {
    await manager.setActiveProfile('debug');
    expect(manager.getActiveProfileId()).toBe('debug');
  });

  it('throws when setting active profile to non-existent id', async () => {
    await expect(manager.setActiveProfile('nonexistent')).rejects.toThrow('not found');
  });

  it('finds profile by trigger', () => {
    const debugProfile = manager.getProfileByTrigger('onDebug');
    expect(debugProfile).toBeDefined();
    expect(debugProfile?.id).toBe('debug');
  });
});
