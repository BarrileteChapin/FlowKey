import React, { useEffect } from 'react';
import { useVSCodeState, useProfile } from '../shared/hooks/useVSCodeMessage';
import { TileGrid } from './TileGrid';
import { ProfileHeader } from './ProfileHeader';
import { switchProfile, executeTile, toggleHud } from '../shared/bridge';
import '../../webview-ui/shared/tokens.css';
import './App.css';

const ACCENT_MAP: Record<string, string> = {
  '--accent-navigation': 'var(--accent-navigation)',
  '--accent-debug': 'var(--accent-debug)',
  '--accent-git': 'var(--accent-git)',
  '--accent-ai': 'var(--accent-ai)',
  '--accent-testing': 'var(--accent-testing)',
  '--accent-custom': 'var(--accent-custom)',
};

export function App() {
  const state = useVSCodeState();
  const { activeProfile, profiles } = useProfile(state);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        toggleHud();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!state || !activeProfile) {
    return <div className="hud-loading">Loading...</div>;
  }

  const accentVar = ACCENT_MAP[activeProfile.accentColor] ?? 'var(--accent-navigation)';
  const dockPosition = state.settings.dockPosition;
  const dockLabel = String(dockPosition).replace('-', ' ').replace(/(^|\s)\w/g, (m) => m.toUpperCase());
  const transparencyLabel = `${Math.round(state.settings.transparency * 100)}%`;
  const densityLabel = `${state.settings.density[0].toUpperCase()}${state.settings.density.slice(1)}`;
  const dockClass = [
    'float',
    'top',
    'bottom',
    'left',
    'right',
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
  ].includes(dockPosition)
    ? dockPosition
    : 'float';

  return (
    <div className={`hud-root hud-root--${dockClass}`}>
      <div
        className="hud-shell glass-panel"
        role="dialog"
        aria-label="FlowKey HUD"
        style={{
          '--profile-accent': accentVar,
          '--hud-transparency': String(state.settings.transparency),
        } as React.CSSProperties}
      >
        <div className="hud-topbar" aria-label="HUD controls">
          <div className="hud-topbar__meta">
            <span className="hud-topbar__chip">
              <i className="codicon codicon-pin" aria-hidden="true" />
              {dockLabel}
            </span>
            <span className="hud-topbar__chip">
              <i className="codicon codicon-symbol-color" aria-hidden="true" />
              {transparencyLabel}
            </span>
            <span className="hud-topbar__chip">
              <i className="codicon codicon-symbol-array" aria-hidden="true" />
              {densityLabel}
            </span>
            <span className="hud-topbar__hint">
              <i className="codicon codicon-key" aria-hidden="true" />
              <span>Ctrl+Shift+H</span>
            </span>
          </div>
          <button
            className="hud-topbar__btn"
            onClick={toggleHud}
            aria-label="Hide HUD"
            title="Hide HUD (Ctrl+Shift+H or Esc)"
          >
            <i className="codicon codicon-chrome-minimize" aria-hidden="true" />
            Hide
          </button>
        </div>
        <ProfileHeader
          activeProfile={activeProfile}
          profiles={profiles}
          onSwitch={switchProfile}
        />
        <TileGrid
          tiles={activeProfile.tiles}
          gridCols={state.settings.gridCols}
          gridRows={state.settings.gridRows}
          density={state.settings.density}
          tileShape={state.settings.tileShape}
          onExecute={executeTile}
        />
        <div className="hud-footer-note">
          <i className="codicon codicon-gear" aria-hidden="true" />
          Adjust dock and transparency in FlowKey Settings.
        </div>
      </div>
    </div>
  );
}
