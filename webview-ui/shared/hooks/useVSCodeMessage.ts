import { useState, useEffect, useCallback } from 'react';
import type { HudState } from '../../src/types';
import { onMessage, requestState } from '../bridge';

export function useVSCodeState(): HudState | null {
  const [state, setState] = useState<HudState | null>(null);

  useEffect(() => {
    const unsubscribe = onMessage((data) => {
      if (data.type === 'update' && data.state) {
        setState(data.state);
      } else if (data.type === 'settingsPreview' && data.patch) {
        setState((prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            settings: {
              ...prev.settings,
              ...data.patch,
            },
          };
        });
      }
    });

    // Request initial state
    requestState();

    return unsubscribe;
  }, []);

  return state;
}

export function useProfile(state: HudState | null) {
  const activeProfile = state
    ? state.profiles.find((p) => p.id === state.activeProfileId) ?? null
    : null;

  return {
    activeProfile,
    profiles: state?.profiles ?? [],
    activeProfileId: state?.activeProfileId ?? 'navigation',
  };
}
