import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initConfirmationGuard,
  isConfirmed,
  confirmFlow,
  resetConfirmation,
} from '../../../src/security/confirmationGuard';
import { mockWorkspaceState, clearMockStores } from '../../mocks/vscodeState';

describe('confirmationGuard', () => {
  beforeEach(() => {
    clearMockStores();
    initConfirmationGuard(mockWorkspaceState as any);
  });

  it('returns false for a new flow that has never been confirmed', () => {
    expect(isConfirmed('flow-1')).toBe(false);
  });

  it('returns true after confirm(flowId) is called', async () => {
    await confirmFlow('flow-1');
    expect(isConfirmed('flow-1')).toBe(true);
  });

  it('persists confirmation state in workspaceState', async () => {
    await confirmFlow('flow-1');
    expect(mockWorkspaceState.update).toHaveBeenCalled();
    const lastCall = mockWorkspaceState.update.mock.calls[
      mockWorkspaceState.update.mock.calls.length - 1
    ];
    expect(lastCall[0]).toBe('flowkey.confirmedFlows');
    expect(lastCall[1]).toEqual({ 'flow-1': true });
  });

  it('resets confirmation state when the flow is edited', async () => {
    await confirmFlow('flow-1');
    expect(isConfirmed('flow-1')).toBe(true);

    await resetConfirmation('flow-1');
    expect(isConfirmed('flow-1')).toBe(false);
  });

  it('handles multiple flows independently', async () => {
    await confirmFlow('flow-1');
    expect(isConfirmed('flow-1')).toBe(true);
    expect(isConfirmed('flow-2')).toBe(false);

    await confirmFlow('flow-2');
    expect(isConfirmed('flow-2')).toBe(true);
  });
});
