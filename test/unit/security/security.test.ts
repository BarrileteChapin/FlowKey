import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateMessage } from '../../../src/security/messageValidator';
import { isWhitelisted, resetUserCommands } from '../../../src/security/commandWhitelist';
import { CommandBroker } from '../../../src/core/commandBroker';
import type { TileAction } from '../../../src/types';

vi.mock('../../../src/security/commandWhitelist', async () => {
  const actual = await vi.importActual<typeof import('../../../src/security/commandWhitelist')>('../../../src/security/commandWhitelist');
  return actual;
});

vi.mock('../../../src/security/confirmationGuard', () => ({
  promptTerminalConfirmation: vi.fn(async () => false),
}));

describe('[security] Security tests', () => {
  beforeEach(() => {
    resetUserCommands();
    vi.clearAllMocks();
  });

  it('rejects a webview message with command: "eval"', () => {
    const result = validateMessage({ command: 'eval', payload: {} });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unknown command');
  });

  it('blocks a command outside the whitelist via commandBroker', async () => {
    const broker = new CommandBroker();
    const action: TileAction = { type: 'command', ref: 'unknown.notWhitelisted.command' };
    await expect(broker.dispatch(action)).rejects.toThrow('not whitelisted');
  });

  it('rejects a workspace pack payload with __proto__ key', () => {
    const maliciousPayload = {
      command: 'executeTile',
      payload: Object.create(null),
    };
    Object.defineProperty(maliciousPayload.payload, '__proto__', {
      value: 'attack',
      enumerable: true,
    });
    const result = validateMessage(maliciousPayload);
    expect(result.valid).toBe(false);
  });

  it('rejects a workspace pack payload with constructor key', () => {
    const payload: Record<string, unknown> = { tileId: 'test' };
    Object.defineProperty(payload, 'constructor', {
      value: 'evil',
      enumerable: true,
    });
    const msg = { command: 'executeTile', payload };
    const result = validateMessage(msg);
    expect(result.valid).toBe(false);
  });

  it('blocks a gesture binding pointing to an unknown command via commandBroker', async () => {
    const broker = new CommandBroker();
    const action: TileAction = { type: 'command', ref: 'unknown.dangerous.command' };
    await expect(broker.dispatch(action)).rejects.toThrow('not whitelisted');
  });

  it('rejects function values in payloads', () => {
    const msg = {
      command: 'executeTile',
      payload: { action: function malicious() {} },
    };
    const result = validateMessage(msg);
    expect(result.valid).toBe(false);
  });

  it('isWhitelisted returns false for dangerous strings', () => {
    expect(isWhitelisted('eval')).toBe(false);
    expect(isWhitelisted('shell.exec')).toBe(false);
    expect(isWhitelisted('process.exit')).toBe(false);
    expect(isWhitelisted('')).toBe(false);
  });
});
