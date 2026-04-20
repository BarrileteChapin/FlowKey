import { describe, it, expect, beforeEach } from 'vitest';
import {
  isWhitelisted,
  addUserCommand,
  removeUserCommand,
  getWhitelistedCommands,
  resetUserCommands,
} from '../../../src/security/commandWhitelist';

describe('commandWhitelist', () => {
  beforeEach(() => {
    resetUserCommands();
  });

  it('returns true for a known built-in VS Code command ID', () => {
    expect(isWhitelisted('workbench.action.files.save')).toBe(true);
  });

  it('returns false for an unknown or dangerous string', () => {
    expect(isWhitelisted('eval')).toBe(false);
    expect(isWhitelisted('shell.exec')).toBe(false);
    expect(isWhitelisted('arbitrary.command')).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(isWhitelisted('Workbench.Action.Files.Save')).toBe(false);
    expect(isWhitelisted('WORKBENCH.ACTION.FILES.SAVE')).toBe(false);
  });

  it('can be extended at runtime with user-added command IDs', () => {
    expect(isWhitelisted('my.custom.command')).toBe(false);
    addUserCommand('my.custom.command');
    expect(isWhitelisted('my.custom.command')).toBe(true);
  });

  it('can remove user-added commands', () => {
    addUserCommand('my.custom.command');
    expect(isWhitelisted('my.custom.command')).toBe(true);
    removeUserCommand('my.custom.command');
    expect(isWhitelisted('my.custom.command')).toBe(false);
  });

  it('returns all whitelisted commands including user-added', () => {
    addUserCommand('my.custom.command');
    const all = getWhitelistedCommands();
    expect(all).toContain('workbench.action.files.save');
    expect(all).toContain('my.custom.command');
  });

  it('resets user commands correctly', () => {
    addUserCommand('my.custom.command');
    resetUserCommands();
    expect(isWhitelisted('my.custom.command')).toBe(false);
  });
});
