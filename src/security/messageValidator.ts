import { HudMessage, MessageValidationResult } from '../types';

const VALID_COMMANDS: ReadonlySet<string> = new Set([
  // HUD
  'executeTile',
  'switchProfile',
  'dock',
  'resize',
  'getState',
  'toggleHud',
  // Flow Editor
  'saveFlow',
  'deleteFlow',
  'runFlow',
  'dryRunFlow',
  'getFlows',
  'getFlow',
  'getWhitelistedCommands',
  'bindFlowToTile',
  'openSettings',
  'loadExampleFlows',
  'closeFlowEditor',
  // Accessibility
  'recogniseGesture',
  'saveGestureBinding',
  'deleteGestureBinding',
  'getGestureBindings',
  'saveVoiceAlias',
  'deleteVoiceAlias',
  'getVoiceAliases',
  'startListening',
  'stopListening',
]);

// HUD commands use simple payloads (string/number/boolean values only)
const SIMPLE_PAYLOAD_COMMANDS: ReadonlySet<string> = new Set([
  'executeTile',
  'switchProfile',
  'dock',
  'resize',
  'getState',
  'toggleHud',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function containsNonSerializable(obj: Record<string, unknown>): boolean {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === 'function' || typeof value === 'symbol') {
      return true;
    }
    if (value !== null && typeof value === 'object') {
      if (
        value.constructor !== Object &&
        value.constructor !== Array &&
        !(typeof value === 'object' && value !== null)
      ) {
        return true;
      }
      if (isPlainObject(value) && containsNonSerializable(value)) {
        return true;
      }
    }
  }
  return false;
}

function hasPrototypePollution(obj: unknown): boolean {
  if (!isPlainObject(obj)) {
    return false;
  }
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return true;
    }
    if (isPlainObject(obj[key]) && hasPrototypePollution(obj[key])) {
      return true;
    }
  }
  return false;
}

export function validateMessage(message: unknown): MessageValidationResult {
  if (!isPlainObject(message)) {
    return { valid: false, error: 'Message must be a plain object.' };
  }

  if (!('command' in message) || typeof message.command !== 'string') {
    return { valid: false, error: 'Message must have a string "command" field.' };
  }

  if (!VALID_COMMANDS.has(message.command)) {
    return { valid: false, error: `Unknown command: "${message.command}".` };
  }

  if ('payload' in message) {
    if (!isPlainObject(message.payload)) {
      return { valid: false, error: 'Payload must be a plain object.' };
    }

    if (hasPrototypePollution(message.payload)) {
      return { valid: false, error: 'Payload contains forbidden keys.' };
    }

    const payload = message.payload as Record<string, unknown>;

    // For simple commands (HUD), values must be primitives only
    if (SIMPLE_PAYLOAD_COMMANDS.has(message.command as string)) {
      for (const key of Object.keys(payload)) {
        const val = payload[key];
        if (
          typeof val !== 'string' &&
          typeof val !== 'number' &&
          typeof val !== 'boolean'
        ) {
          return {
            valid: false,
            error: `Payload values must be string, number, or boolean. Key "${key}" has type "${typeof val}".`,
          };
        }
      }
    } else {
      // For complex commands (flow editor, accessibility), check for non-serializable values
      if (containsNonSerializable(payload)) {
        return { valid: false, error: 'Payload contains non-serializable values.' };
      }
    }
  }

  return { valid: true };
}

export function parseValidMessage(message: unknown): HudMessage | null {
  const result = validateMessage(message);
  if (!result.valid) {
    return null;
  }
  return message as HudMessage;
}
