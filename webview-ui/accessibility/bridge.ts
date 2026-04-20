import type { AccessibilityState, GestureBinding, VoiceAlias, Point } from '../../src/types';

interface VSCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeApi;

let vscodeApi: VSCodeApi | undefined;

function getApi(): VSCodeApi {
  if (!vscodeApi) {
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
}

function post(command: string, payload: Record<string, unknown> = {}): void {
  getApi().postMessage({ command, payload });
}

export function onAccessibilityMessage(
  handler: (data: { type: string; state?: AccessibilityState; result?: unknown }) => void,
): () => void {
  const listener = (event: MessageEvent) => {
    handler(event.data);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

export function requestGestureBindings(): void {
  post('getGestureBindings');
}

export function recogniseGesture(points: Point[]): void {
  post('recogniseGesture', { points });
}

export function saveGestureBinding(binding: GestureBinding): void {
  post('saveGestureBinding', { binding });
}

export function deleteGestureBinding(gestureId: string): void {
  post('deleteGestureBinding', { gestureId });
}

export function requestVoiceAliases(): void {
  post('getVoiceAliases');
}

export function saveVoiceAlias(alias: VoiceAlias): void {
  post('saveVoiceAlias', { alias });
}

export function deleteVoiceAlias(aliasId: string): void {
  post('deleteVoiceAlias', { aliasId });
}

export function startListening(): void {
  post('startListening');
}

export function stopListening(): void {
  post('stopListening');
}
