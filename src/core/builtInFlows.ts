import { Flow } from '../types';

export function getBuiltInFlows(): Flow[] {
  return [
    {
      id: 'builtin-git-commit-push',
      name: 'Git: Commit & Push',
      confirmedTerminalOnce: false,
      nodes: [
        { id: 'gcp-1', type: 'command', data: { label: 'Stage All', commandId: 'git.stageAll' }, position: { x: 40, y: 60 } },
        { id: 'gcp-2', type: 'command', data: { label: 'Commit', commandId: 'git.commit' }, position: { x: 260, y: 60 } },
        { id: 'gcp-3', type: 'command', data: { label: 'Push', commandId: 'git.push' }, position: { x: 480, y: 60 } },
        { id: 'gcp-4', type: 'notification', data: { label: 'Done', message: 'Pushed to remote ✓', severity: 'info' }, position: { x: 700, y: 60 } },
      ],
      edges: [
        { id: 'gcp-e1', source: 'gcp-1', target: 'gcp-2' },
        { id: 'gcp-e2', source: 'gcp-2', target: 'gcp-3' },
        { id: 'gcp-e3', source: 'gcp-3', target: 'gcp-4' },
      ],
    },
    {
      id: 'builtin-run-tests-problems',
      name: 'Run Tests → Open Problems',
      confirmedTerminalOnce: false,
      nodes: [
        { id: 'rtp-1', type: 'command', data: { label: 'Run All Tests', commandId: 'testing.runAll' }, position: { x: 40, y: 60 } },
        { id: 'rtp-2', type: 'condition', data: { label: 'Tests Failed?', field: 'lastStatus', operator: 'equals', value: 'error' }, position: { x: 260, y: 60 } },
        { id: 'rtp-3', type: 'command', data: { label: 'Open Problems', commandId: 'workbench.action.problems.focus' }, position: { x: 480, y: 20 } },
        { id: 'rtp-4', type: 'notification', data: { label: 'Tests Failed', message: 'Tests failed — check Problems panel', severity: 'error' }, position: { x: 700, y: 20 } },
        { id: 'rtp-5', type: 'notification', data: { label: 'Tests Passed', message: 'All tests passed ✓', severity: 'info' }, position: { x: 480, y: 140 } },
      ],
      edges: [
        { id: 'rtp-e1', source: 'rtp-1', target: 'rtp-2' },
        { id: 'rtp-e2', source: 'rtp-2', target: 'rtp-3', label: 'true' },
        { id: 'rtp-e3', source: 'rtp-3', target: 'rtp-4' },
        { id: 'rtp-e4', source: 'rtp-2', target: 'rtp-5', label: 'false' },
      ],
    },
    {
      id: 'builtin-ai-explain-refactor',
      name: 'AI: Explain → Refactor',
      confirmedTerminalOnce: false,
      nodes: [
        { id: 'aer-1', type: 'command', data: { label: 'Ask AI Explain', commandId: 'flowkey.ai.explainSelection' }, position: { x: 40, y: 60 } },
        { id: 'aer-2', type: 'delay', data: { label: 'Wait 2s', ms: 2000 }, position: { x: 260, y: 60 } },
        { id: 'aer-3', type: 'command', data: { label: 'Refactor', commandId: 'flowkey.ai.fixSelection' }, position: { x: 480, y: 60 } },
      ],
      edges: [
        { id: 'aer-e1', source: 'aer-1', target: 'aer-2' },
        { id: 'aer-e2', source: 'aer-2', target: 'aer-3' },
      ],
    },
  ];
}
