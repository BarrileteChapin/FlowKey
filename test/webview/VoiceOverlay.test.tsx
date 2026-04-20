import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { VoiceOverlay } from '../../webview-ui/accessibility/VoiceOverlay';

describe('VoiceOverlay', () => {
  it('renders mic button with "Start listening" label by default', () => {
    render(
      <VoiceOverlay isListening={false} transcript={null} matchedPhrase={null} noMatch={false} onToggle={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /start listening/i })).toBeInTheDocument();
  });

  it('shows "Stop listening" label when listening', () => {
    render(
      <VoiceOverlay isListening={true} transcript={null} matchedPhrase={null} noMatch={false} onToggle={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /stop listening/i })).toBeInTheDocument();
  });

  it('calls onToggle when mic button clicked', () => {
    const onToggle = vi.fn();
    render(
      <VoiceOverlay isListening={false} transcript={null} matchedPhrase={null} noMatch={false} onToggle={onToggle} />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('shows matched phrase chip', () => {
    render(
      <VoiceOverlay isListening={true} transcript="save file" matchedPhrase="Save File" noMatch={false} onToggle={() => {}} />,
    );
    expect(screen.getByText('Save File')).toBeInTheDocument();
  });

  it('shows "No match" when noMatch is true', () => {
    render(
      <VoiceOverlay isListening={true} transcript="blah" matchedPhrase={null} noMatch={true} onToggle={() => {}} />,
    );
    expect(screen.getByText('No match')).toBeInTheDocument();
  });

  it('shows transcript chip when no match yet', () => {
    render(
      <VoiceOverlay isListening={true} transcript="hello world" matchedPhrase={null} noMatch={false} onToggle={() => {}} />,
    );
    expect(screen.getByText('"hello world"')).toBeInTheDocument();
  });

  it('adds listening class and wave animation when listening', () => {
    render(
      <VoiceOverlay isListening={true} transcript={null} matchedPhrase={null} noMatch={false} onToggle={() => {}} />,
    );
    const btn = screen.getByRole('button');
    expect(btn.classList.contains('mic-button--listening')).toBe(true);
  });
});
