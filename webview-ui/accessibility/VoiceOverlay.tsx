import React from 'react';
import './VoiceOverlay.css';

interface VoiceOverlayProps {
  isListening: boolean;
  transcript: string | null;
  matchedPhrase: string | null;
  noMatch: boolean;
  onToggle: () => void;
}

export function VoiceOverlay({ isListening, transcript, matchedPhrase, noMatch, onToggle }: VoiceOverlayProps) {
  return (
    <div className="voice-overlay">
      <button
        className={`mic-button ${isListening ? 'mic-button--listening' : ''}`}
        onClick={onToggle}
        aria-label={isListening ? 'Stop listening' : 'Start listening'}
      >
        <i className={`codicon codicon-${isListening ? 'mic-filled' : 'mic'}`} aria-hidden="true" />
      </button>

      {isListening && (
        <div className="voice-overlay__wave" aria-hidden="true">
          <span /><span /><span /><span /><span />
        </div>
      )}

      {matchedPhrase && (
        <div className="voice-overlay__chip voice-overlay__chip--matched">
          {matchedPhrase}
        </div>
      )}

      {noMatch && (
        <div className="voice-overlay__chip voice-overlay__chip--nomatch">
          No match
        </div>
      )}

      {transcript && !matchedPhrase && !noMatch && (
        <div className="voice-overlay__chip voice-overlay__chip--transcript">
          "{transcript}"
        </div>
      )}
    </div>
  );
}
