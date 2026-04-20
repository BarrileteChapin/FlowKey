// VS Code API mock for unit tests
import { vi } from 'vitest';

const globalStateStore = new Map<string, unknown>();
const workspaceStateStore = new Map<string, unknown>();

export const mockGlobalState = {
  get: vi.fn((key: string, defaultValue?: unknown) => {
    return globalStateStore.has(key) ? globalStateStore.get(key) : defaultValue;
  }),
  update: vi.fn(async (key: string, value: unknown) => {
    globalStateStore.set(key, value);
  }),
  setKeysForSync: vi.fn(),
  keys: vi.fn(() => [...globalStateStore.keys()]),
  _store: globalStateStore,
};

export const mockWorkspaceState = {
  get: vi.fn((key: string, defaultValue?: unknown) => {
    return workspaceStateStore.has(key) ? workspaceStateStore.get(key) : defaultValue;
  }),
  update: vi.fn(async (key: string, value: unknown) => {
    workspaceStateStore.set(key, value);
  }),
  keys: vi.fn(() => [...workspaceStateStore.keys()]),
  _store: workspaceStateStore,
};

export function clearMockStores(): void {
  globalStateStore.clear();
  workspaceStateStore.clear();
}
