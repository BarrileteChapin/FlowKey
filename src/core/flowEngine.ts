import * as vscode from 'vscode';
import { Flow, FlowNode, FlowEdge } from '../types';
import { isWhitelisted } from '../security/commandWhitelist';
import { promptTerminalConfirmation } from '../security/confirmationGuard';
import { executeCommandWithFallback } from './commandExecution';

export interface FlowExecutionStep {
  nodeId: string;
  nodeType: FlowNode['type'];
  label: string;
  status: 'executed' | 'skipped' | 'error';
  error?: string;
}

export interface FlowExecutionResult {
  success: boolean;
  steps: FlowExecutionStep[];
  error?: string;
}

function getStartNodes(flow: Flow): FlowNode[] {
  const targetIds = new Set(flow.edges.map((e) => e.target));
  return flow.nodes.filter((n) => !targetIds.has(n.id));
}

function getOutgoingEdges(flow: Flow, nodeId: string): FlowEdge[] {
  return flow.edges.filter((e) => e.source === nodeId);
}

function getNode(flow: Flow, nodeId: string): FlowNode | undefined {
  return flow.nodes.find((n) => n.id === nodeId);
}

function nodeLabel(node: FlowNode): string {
  return (node.data.label as string) ?? `${node.type}:${node.id}`;
}

async function executeCommandNode(
  node: FlowNode,
  dryRun: boolean,
): Promise<FlowExecutionStep> {
  const commandId = node.data.commandId as string;
  const args = (node.data.args as unknown[]) ?? [];
  const label = nodeLabel(node);

  if (dryRun) {
    return { nodeId: node.id, nodeType: node.type, label, status: 'executed' };
  }

  if (!isWhitelisted(commandId)) {
    return {
      nodeId: node.id,
      nodeType: node.type,
      label,
      status: 'error',
      error: `Command "${commandId}" is not whitelisted.`,
    };
  }

  try {
    await executeCommandWithFallback(commandId, args);
    return { nodeId: node.id, nodeType: node.type, label, status: 'executed' };
  } catch (err) {
    return {
      nodeId: node.id,
      nodeType: node.type,
      label,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function executeTerminalNode(
  node: FlowNode,
  flowId: string,
  dryRun: boolean,
): Promise<FlowExecutionStep> {
  const commandString = node.data.command as string;
  const label = nodeLabel(node);

  if (dryRun) {
    return { nodeId: node.id, nodeType: node.type, label, status: 'executed' };
  }

  const allowed = await promptTerminalConfirmation(flowId, commandString);
  if (!allowed) {
    return { nodeId: node.id, nodeType: node.type, label, status: 'skipped' };
  }

  try {
    const terminal = vscode.window.createTerminal('FlowKey');
    terminal.show();
    terminal.sendText(commandString);
    return { nodeId: node.id, nodeType: node.type, label, status: 'executed' };
  } catch (err) {
    return {
      nodeId: node.id,
      nodeType: node.type,
      label,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function evaluateCondition(node: FlowNode, lastResult: FlowExecutionStep | undefined): boolean {
  const field = (node.data.field as string) ?? 'lastStatus';
  const operator = (node.data.operator as string) ?? 'equals';
  const expected = node.data.value;

  let actual: unknown;
  if (field === 'lastStatus') {
    actual = lastResult?.status ?? 'executed';
  } else if (field === 'lastError') {
    actual = lastResult?.error ?? '';
  } else {
    actual = lastResult?.status ?? '';
  }

  switch (operator) {
    case 'equals':
      return actual === expected;
    case 'notEquals':
      return actual !== expected;
    case 'contains':
      return typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected);
    default:
      return false;
  }
}

async function executeConditionNode(
  node: FlowNode,
  flow: Flow,
  lastResult: FlowExecutionStep | undefined,
  dryRun: boolean,
  steps: FlowExecutionStep[],
  flowId: string,
): Promise<FlowExecutionStep> {
  const label = nodeLabel(node);
  const result = evaluateCondition(node, lastResult);
  const outgoing = getOutgoingEdges(flow, node.id);

  const branchLabel = result ? 'true' : 'false';
  const branchEdge = outgoing.find((e) => e.label === branchLabel);

  if (branchEdge) {
    const nextNode = getNode(flow, branchEdge.target);
    if (nextNode) {
      await walkNode(nextNode, flow, dryRun, steps, flowId, { nodeId: node.id, nodeType: node.type, label: `${label} → ${branchLabel}`, status: 'executed' });
    }
  }

  return { nodeId: node.id, nodeType: node.type, label: `${label} → ${branchLabel}`, status: 'executed' };
}

async function executeNotificationNode(
  node: FlowNode,
  dryRun: boolean,
): Promise<FlowExecutionStep> {
  const message = (node.data.message as string) ?? '';
  const severity = (node.data.severity as string) ?? 'info';
  const label = nodeLabel(node);

  if (dryRun) {
    return { nodeId: node.id, nodeType: node.type, label, status: 'executed' };
  }

  switch (severity) {
    case 'warning':
      await vscode.window.showWarningMessage(message);
      break;
    case 'error':
      await vscode.window.showErrorMessage(message);
      break;
    default:
      await vscode.window.showInformationMessage(message);
  }

  return { nodeId: node.id, nodeType: node.type, label, status: 'executed' };
}

async function executeDelayNode(
  node: FlowNode,
  dryRun: boolean,
): Promise<FlowExecutionStep> {
  const ms = (node.data.ms as number) ?? 0;
  const label = nodeLabel(node);

  if (!dryRun && ms > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  return { nodeId: node.id, nodeType: node.type, label, status: 'executed' };
}

async function walkNode(
  node: FlowNode,
  flow: Flow,
  dryRun: boolean,
  steps: FlowExecutionStep[],
  flowId: string,
  lastResult?: FlowExecutionStep,
): Promise<void> {
  let step: FlowExecutionStep;

  switch (node.type) {
    case 'command':
      step = await executeCommandNode(node, dryRun);
      break;
    case 'terminal':
      step = await executeTerminalNode(node, flowId, dryRun);
      break;
    case 'condition':
      step = await executeConditionNode(node, flow, lastResult, dryRun, steps, flowId);
      steps.push(step);
      return; // condition node handles its own branching
    case 'notification':
      step = await executeNotificationNode(node, dryRun);
      break;
    case 'delay':
      step = await executeDelayNode(node, dryRun);
      break;
    default:
      step = {
        nodeId: node.id,
        nodeType: node.type,
        label: nodeLabel(node),
        status: 'error',
        error: `Unknown node type: "${node.type}".`,
      };
  }

  steps.push(step);

  if (step.status === 'error') {
    return; // halt on error
  }

  // Follow outgoing edges (non-condition nodes have simple sequential edges)
  const outgoing = getOutgoingEdges(flow, node.id);
  for (const edge of outgoing) {
    const nextNode = getNode(flow, edge.target);
    if (nextNode) {
      await walkNode(nextNode, flow, dryRun, steps, flowId, step);
    }
  }
}

export async function executeFlow(
  flow: Flow,
  dryRun: boolean = false,
): Promise<FlowExecutionResult> {
  const steps: FlowExecutionStep[] = [];

  const startNodes = getStartNodes(flow);
  if (startNodes.length === 0) {
    return { success: false, steps, error: 'Flow has no start nodes.' };
  }

  try {
    for (const startNode of startNodes) {
      await walkNode(startNode, flow, dryRun, steps, flow.id, undefined);

      // Halt on first error
      const errStep = steps.find((s) => s.status === 'error');
      if (errStep) {
        return { success: false, steps, error: errStep.error };
      }
    }
    return { success: true, steps };
  } catch (err) {
    return {
      success: false,
      steps,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
