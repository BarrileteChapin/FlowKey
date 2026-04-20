import type { HudMessage, HudState } from '../../src/types';

interface VSCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeApi;

let vscodeApi: VSCodeApi | undefined;

export function getVSCodeApi(): VSCodeApi {
  if (!vscodeApi) {
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
}

export function postMessage(message: HudMessage): void {
  getVSCodeApi().postMessage(message);
}

export function onMessage(handler: (data: {
  type: string;
  state?: HudState;
  patch?: Record<string, unknown>;
}) => void): () => void {
  const listener = (event: MessageEvent) => {
    handler(event.data);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

export function requestState(): void {
  postMessage({ command: 'getState', payload: {} });
}

export function toggleHud(): void {
  postMessage({ command: 'toggleHud', payload: {} });
}

export function executeTile(tileId: string): void {
  postMessage({ command: 'executeTile', payload: { tileId } });
}

export function switchProfile(profileId: string): void {
  postMessage({ command: 'switchProfile', payload: { profileId } });
}

export function dockTo(position: string): void {
  postMessage({ command: 'dock', payload: { position } });
}

export function resize(gridCols: number, gridRows: number): void {
  postMessage({ command: 'resize', payload: { gridCols, gridRows } });
}
