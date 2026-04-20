import React, { useState, useEffect, useCallback } from 'react';
import type { AccessibilityState, GestureBinding, Point, TileAction } from '../../src/types';
import { GestureCanvas } from './GestureCanvas';
import { GestureLibrary } from './GestureLibrary';
import { VoiceOverlay } from './VoiceOverlay';
import { AliasTable } from './AliasTable';
import {
  onAccessibilityMessage,
  requestGestureBindings,
  recogniseGesture,
  saveGestureBinding,
  deleteGestureBinding,
  requestVoiceAliases,
  saveVoiceAlias,
  deleteVoiceAlias,
  startListening,
  stopListening,
} from './bridge';
import '../shared/tokens.css';
import './App.css';

type Tab = 'gesture' | 'voice';

export function App() {
  const [state, setState] = useState<AccessibilityState | null>(null);
  const [tab, setTab] = useState<Tab>('gesture');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [recognisedName, setRecognisedName] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [matchedPhrase, setMatchedPhrase] = useState<string | null>(null);
  const [noMatch, setNoMatch] = useState(false);
  const [selectedGestureId, setSelectedGestureId] = useState<string | null>(null);
  const [bindProfileId, setBindProfileId] = useState<string>('');
  const [bindTileId, setBindTileId] = useState<string>('');
  const [bindStatus, setBindStatus] = useState<string>('');

  useEffect(() => {
    const unsub = onAccessibilityMessage((data) => {
      if (data.type === 'update' && data.state) {
        setState(data.state as AccessibilityState);
      }
      if (data.type === 'gestureResult' && data.result) {
        const r = data.result as { name?: string; score?: number } | null;
        if (r && r.name) {
          setRecognisedName(r.name);
          setConfidence(r.score ?? null);
        } else {
          setRecognisedName(null);
          setConfidence(null);
        }
      }
      if (data.type === 'voiceTranscript' && data.result) {
        const r = data.result as { transcript?: string; matched?: string; noMatch?: boolean };
        setTranscript(r.transcript ?? null);
        setMatchedPhrase(r.matched ?? null);
        setNoMatch(r.noMatch ?? false);
      }
    });
    requestGestureBindings();
    requestVoiceAliases();
    return unsub;
  }, []);

  const handleRecognise = useCallback((points: Point[]) => {
    setRecognisedName(null);
    setConfidence(null);
    recogniseGesture(points);
  }, []);

  const handleClearGesture = useCallback(() => {
    setRecognisedName(null);
    setConfidence(null);
  }, []);

  const handleVoiceToggle = useCallback(() => {
    if (state?.isListening) {
      stopListening();
    } else {
      setTranscript(null);
      setMatchedPhrase(null);
      setNoMatch(false);
      startListening();
    }
  }, [state?.isListening]);

  const selectedHintPoints =
    state?.gestureBindings.find((binding) => binding.gestureId === selectedGestureId)?.points
    ?? state?.builtInGestures.find((gesture) => gesture.id === selectedGestureId)?.points
    ?? null;

  const selectedBinding = state?.gestureBindings.find((binding) => binding.gestureId === selectedGestureId) ?? null;
  const selectedReference = state?.builtInGestures.find((gesture) => gesture.id === selectedGestureId) ?? null;
  const selectedGestureLabel = selectedBinding?.label ?? selectedReference?.label ?? selectedGestureId ?? '';
  const profiles = state?.profiles ?? [];
  const selectedProfile = profiles.find((profile) => profile.id === bindProfileId) ?? null;
  const selectedTile = selectedProfile?.tiles.find((tile) => tile.id === bindTileId) ?? null;

  useEffect(() => {
    if (!selectedGestureId && state?.builtInGestures.length) {
      setSelectedGestureId(state.builtInGestures[0].id);
    }
  }, [selectedGestureId, state?.builtInGestures]);

  useEffect(() => {
    if (profiles.length === 0) {
      setBindProfileId('');
      setBindTileId('');
      return;
    }

    const profile = profiles.find((entry) => entry.id === bindProfileId) ?? profiles[0];
    if (profile.id !== bindProfileId) {
      setBindProfileId(profile.id);
    }

    const tile = profile.tiles.find((entry) => entry.id === bindTileId) ?? profile.tiles[0] ?? null;
    if (!tile) {
      setBindTileId('');
      return;
    }

    if (tile.id !== bindTileId) {
      setBindTileId(tile.id);
    }
  }, [profiles, bindProfileId, bindTileId]);

  useEffect(() => {
    if (!bindStatus) {
      return;
    }

    const timer = window.setTimeout(() => setBindStatus(''), 2800);
    return () => window.clearTimeout(timer);
  }, [bindStatus]);

  const handleBindFigureToHud = useCallback(() => {
    if (!state || !selectedGestureId || !selectedTile) {
      setBindStatus('Select a figure and a HUD tile first.');
      return;
    }

    const points = selectedBinding?.points ?? selectedReference?.points ?? null;
    if (!points || points.length < 3) {
      setBindStatus('Selected figure does not have enough points to bind.');
      return;
    }

    const action: TileAction = {
      type: selectedTile.action.type,
      ref: selectedTile.action.ref,
      args: Array.isArray(selectedTile.action.args) ? [...selectedTile.action.args] : undefined,
    };

    const binding: GestureBinding = {
      gestureId: selectedGestureId,
      label: selectedGestureLabel || selectedGestureId,
      points: points.map((point) => ({ ...point })),
      action,
    };

    saveGestureBinding(binding);
    setBindStatus(`Linked ${binding.label} -> ${selectedProfile?.name ?? 'HUD'} / ${selectedTile.label}`);
  }, [
    state,
    selectedGestureId,
    selectedBinding,
    selectedReference,
    selectedTile,
    selectedProfile?.name,
    selectedGestureLabel,
  ]);

  const handleRemoveBinding = useCallback(() => {
    if (!selectedBinding) {
      setBindStatus('Select an existing binding to remove it.');
      return;
    }

    deleteGestureBinding(selectedBinding.gestureId);
    setBindStatus(`Removed binding for ${selectedBinding.label}.`);
  }, [selectedBinding]);

  return (
    <div className="a11y-shell glass-panel" role="application" aria-label="FlowKey Accessibility">
      <div className="a11y-header">
        <div className="a11y-header__icon" aria-hidden="true">
          <i className="codicon codicon-accessibility" />
        </div>
        <div className="a11y-header__copy">
          <span className="a11y-header__eyebrow">FlowKey Accessibility</span>
          <h1 className="a11y-header__title">Gesture and voice access</h1>
          <p className="a11y-header__text">Map figures and spoken phrases to the same HUD actions you use every day, with visual guidance for discovery and repeatability.</p>
        </div>
        <div className="a11y-header__chips" aria-label="Accessibility features">
          <span className="a11y-header__chip"><i className="codicon codicon-gesture" aria-hidden="true" /> Figures</span>
          <span className="a11y-header__chip"><i className="codicon codicon-mic" aria-hidden="true" /> Voice aliases</span>
        </div>
      </div>
      <div className="a11y-tabs" role="tablist">
        <button
          className={`a11y-tab ${tab === 'gesture' ? 'a11y-tab--active' : ''}`}
          role="tab"
          aria-selected={tab === 'gesture'}
          onClick={() => setTab('gesture')}
        >
          <i className="codicon codicon-move" aria-hidden="true" /> Gestures
        </button>
        <button
          className={`a11y-tab ${tab === 'voice' ? 'a11y-tab--active' : ''}`}
          role="tab"
          aria-selected={tab === 'voice'}
          onClick={() => setTab('voice')}
        >
          <i className="codicon codicon-mic" aria-hidden="true" /> Voice
        </button>
      </div>

      {tab === 'gesture' && (
        <div className="a11y-panel" role="tabpanel">
          <GestureCanvas
            onRecognise={handleRecognise}
            onClear={handleClearGesture}
            hintPoints={selectedHintPoints}
            confidence={confidence}
            recognisedName={recognisedName}
          />
          <div className="a11y-bind glass-panel" role="group" aria-label="Bind figure to HUD action">
            <div className="a11y-bind__header">
              <span className="a11y-bind__title">Link Figure To HUD Action</span>
              <span className="a11y-bind__figure">{selectedGestureLabel || 'No figure selected'}</span>
            </div>
            <p className="a11y-bind__hint">
              Pick any available figure and map it to a HUD tile action (command, flow, or terminal).
            </p>
            <div className="a11y-bind__row">
              <label htmlFor="a11y-bind-profile">HUD Profile</label>
              <select
                id="a11y-bind-profile"
                value={bindProfileId}
                onChange={(event) => setBindProfileId(event.target.value)}
                disabled={profiles.length === 0}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                ))}
              </select>
            </div>
            <div className="a11y-bind__row">
              <label htmlFor="a11y-bind-tile">HUD Tile</label>
              <select
                id="a11y-bind-tile"
                value={bindTileId}
                onChange={(event) => setBindTileId(event.target.value)}
                disabled={!selectedProfile || selectedProfile.tiles.length === 0}
              >
                {(selectedProfile?.tiles ?? []).map((tile) => (
                  <option key={tile.id} value={tile.id}>
                    {tile.label} ({tile.action.type})
                  </option>
                ))}
              </select>
            </div>
            <button
              className="a11y-bind__btn"
              onClick={handleBindFigureToHud}
              disabled={!selectedGestureId || !selectedTile}
            >
              <i className="codicon codicon-link" aria-hidden="true" /> Bind Figure
            </button>
            <button
              className="a11y-bind__btn a11y-bind__btn--secondary"
              onClick={handleRemoveBinding}
              disabled={!selectedBinding}
            >
              <i className="codicon codicon-trash" aria-hidden="true" /> Remove Binding
            </button>
            {bindStatus && <div className="a11y-bind__status">{bindStatus}</div>}
          </div>
          <GestureLibrary
            bindings={state?.gestureBindings ?? []}
            references={state?.builtInGestures ?? []}
            onDelete={deleteGestureBinding}
            onSelect={setSelectedGestureId}
            selectedId={selectedGestureId}
          />
        </div>
      )}

      {tab === 'voice' && (
        <div className="a11y-panel" role="tabpanel">
          <VoiceOverlay
            isListening={state?.isListening ?? false}
            transcript={transcript}
            matchedPhrase={matchedPhrase}
            noMatch={noMatch}
            onToggle={handleVoiceToggle}
          />
          <AliasTable
            aliases={state?.voiceAliases ?? []}
            onSave={saveVoiceAlias}
            onDelete={deleteVoiceAlias}
          />
        </div>
      )}
    </div>
  );
}
