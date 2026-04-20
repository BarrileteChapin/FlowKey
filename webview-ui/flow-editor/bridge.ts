import type { FlowEditorState, Flow } from '../../src/types';

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

export function postFlowMessage(command: string, payload: Record<string, unknown> = {}): void {
  getApi().postMessage({ command, payload });
}

export function onFlowMessage(handler: (data: {
  type: string;
  state?: FlowEditorState;
  result?: unknown;
  flow?: unknown;
  commands?: string[];
}) => void): () => void {
  const listener = (event: MessageEvent) => {
    handler(event.data);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

export function requestFlows(): void {
  postFlowMessage('getFlows');
}

export function requestWhitelistedCommands(): void {
  postFlowMessage('getWhitelistedCommands');
}

export function saveFlow(flow: Flow): void {
  postFlowMessage('saveFlow', { flow });
}

export function deleteFlow(flowId: string): void {
  postFlowMessage('deleteFlow', { flowId });
}

export function runFlow(flowId: string): void {
  postFlowMessage('runFlow', { flowId });
}

export function dryRunFlow(flowId: string): void {
  postFlowMessage('dryRunFlow', { flowId });
}

export function bindFlowToTile(
  flowId: string,
  profileId: string,
  tileId: string,
  category: string,
  options: string[],
): void {
  postFlowMessage('bindFlowToTile', { flowId, profileId, tileId, category, options });
}

export function openFlowSettings(): void {
  postFlowMessage('openSettings');
}

export function loadExampleFlows(): void {
  postFlowMessage('loadExampleFlows');
}

export function closeFlowEditor(): void {
  postFlowMessage('closeFlowEditor');
}
