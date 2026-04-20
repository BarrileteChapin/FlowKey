import { describe, it, expect } from 'vitest';
import { validateMessage, parseValidMessage } from '../../../src/security/messageValidator';

describe('messageValidator', () => {
  describe('validateMessage', () => {
    it('passes a valid HudMessage with correct shape', () => {
      const msg = { command: 'executeTile', payload: { tileId: 'nav-1' } };
      const result = validateMessage(msg);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('passes a valid message without payload', () => {
      const msg = { command: 'getState' };
      const result = validateMessage(msg);
      expect(result.valid).toBe(true);
    });

    it('passes a valid toggleHud message', () => {
      const msg = { command: 'toggleHud', payload: {} };
      const result = validateMessage(msg);
      expect(result.valid).toBe(true);
    });

    it('passes a valid flow editor command without payload', () => {
      const msg = { command: 'getWhitelistedCommands' };
      const result = validateMessage(msg);
      expect(result.valid).toBe(true);
    });

    it('passes a valid openSettings command without payload', () => {
      const msg = { command: 'openSettings' };
      const result = validateMessage(msg);
      expect(result.valid).toBe(true);
    });

    it('passes a valid loadExampleFlows command without payload', () => {
      const msg = { command: 'loadExampleFlows' };
      const result = validateMessage(msg);
      expect(result.valid).toBe(true);
    });

    it('passes a valid closeFlowEditor command without payload', () => {
      const msg = { command: 'closeFlowEditor' };
      const result = validateMessage(msg);
      expect(result.valid).toBe(true);
    });

    it('rejects a message missing the command field', () => {
      const msg = { payload: { tileId: 'nav-1' } };
      const result = validateMessage(msg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('command');
    });

    it('rejects a non-object message', () => {
      expect(validateMessage('hello').valid).toBe(false);
      expect(validateMessage(null).valid).toBe(false);
      expect(validateMessage(42).valid).toBe(false);
      expect(validateMessage(undefined).valid).toBe(false);
    });

    it('rejects a message where payload contains a non-serialisable value', () => {
      const msg = { command: 'executeTile', payload: { fn: () => {} } };
      // The function gets caught as not string/number/boolean
      const result = validateMessage(msg);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('rejects a message with an unknown command string', () => {
      const msg = { command: 'eval', payload: {} };
      const result = validateMessage(msg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown command');
    });

    it('rejects a message where command field is not a string', () => {
      const result = validateMessage({ command: 123 });
      expect(result.valid).toBe(false);
    });

    it('rejects payload with __proto__ key', () => {
      const payload = Object.create(null);
      payload.tileId = 'test';
      payload.__proto__ = 'attack';
      const msg = { command: 'executeTile', payload };
      const result = validateMessage(msg);
      expect(result.valid).toBe(false);
    });

    it('rejects payload with constructor key', () => {
      const msg = { command: 'executeTile', payload: {} };
      Object.defineProperty(msg.payload, 'constructor', {
        value: 'evil',
        enumerable: true,
      });
      const result = validateMessage(msg);
      expect(result.valid).toBe(false);
    });

    it('returns a typed result object', () => {
      const valid = validateMessage({ command: 'getState' });
      expect(valid).toHaveProperty('valid');
      expect(typeof valid.valid).toBe('boolean');

      const invalid = validateMessage({});
      expect(invalid).toHaveProperty('valid');
      expect(invalid).toHaveProperty('error');
      expect(typeof invalid.error).toBe('string');
    });
  });

  describe('parseValidMessage', () => {
    it('returns the message for valid input', () => {
      const msg = { command: 'executeTile', payload: { tileId: 'nav-1' } };
      const result = parseValidMessage(msg);
      expect(result).toEqual(msg);
    });

    it('returns null for invalid input', () => {
      expect(parseValidMessage(null)).toBeNull();
      expect(parseValidMessage({ command: 'eval' })).toBeNull();
    });
  });
});
