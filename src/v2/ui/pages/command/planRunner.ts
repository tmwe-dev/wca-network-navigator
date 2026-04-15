/**
 * planRunner.ts — Executes multi-step plans with per-step approval for write tools.
 *
 * Features:
 * - DAG ordering via dependsOn
 * - Max 8 steps
 * - 60s timeout per step
 * - Per-step approval: write tools pause and yield control back to caller
 * - Placeholder resolution {{stepN.result.path}}
 */
import { TOOLS } from "./tools/registry";
import { TOOL_METADATA } from "./tools/registry";
import type { ToolResult } from "./tools/types";
import type { PlanStep } from "@/v2/io/edge/aiAssistant";

export const MAX_PLAN_STEPS = 8;
const STEP_TIMEOUT_MS = 60_000;

export type PlanStepStatus =
  | "pending"
  | "running"
  | "done"
  | "blocked-on-approval"
  | "error";

export interface PlanStepState {
  step: PlanStep;
  status: PlanStepStatus;
  result?: ToolResult;
  error?: string;
  requiresApproval: boolean;
}

export interface PlanExecutionState {
  steps: PlanStep[];
  stepStates: PlanStepState[];
  summary: string;
  results: Record<number, ToolResult>;
  currentStep: number;
  status: "planning" | "awaiting-approval" | "running" | "done" | "error";
  error?: string;
  /** Which step is blocked on approval (1-indexed) */
  approvalStepNumber?: number;
}

/**
 * Resolves placeholders like {{step1.result.partnerId}} using prior step results
 */
function resolveParams(
  params: Record<string, unknown>,
  results: Record<number, ToolResult>,
): Record<string, unknown> {
  const json = JSON.stringify(params);
  const replaced = json.replace(
    /\{\{step(\d+)\.result\.([\w.]+)\}\}/g,
    (_match, stepNum, path) => {
      const result = results[parseInt(stepNum)];
      if (!result) return "null";
      const value = (path as string)
        .split(".")
        .reduce((acc: unknown, key: string) => {
          if (acc && typeof acc === "object" && key in acc) {
            return (acc as Record<string, unknown>)[key];
          }
          return null;
        }, result);
      return JSON.stringify(value ?? null);
    },
  );
  try {
    return JSON.parse(replaced);
  } catch {
    return params;
  }
}

function isWriteTool(toolId: string): boolean {
  const meta = TOOL_METADATA.find((t) => t.id === toolId);
  return meta?.requiresApproval ?? false;
}

/**
 * Topologically sort steps by dependsOn. Falls back to stepNumber order.
 */
function topoSort(steps: PlanStep[]): PlanStep[] {
  const byNum = new Map(steps.map((s) => [s.stepNumber, s]));
  const visited = new Set<number>();
  const sorted: PlanStep[] = [];

  function visit(n: number) {
    if (visited.has(n)) return;
    visited.add(n);
    const step = byNum.get(n);
    if (!step) return;
    const deps = (step as PlanStep & { dependsOn?: number[] }).dependsOn ?? [];
    for (const d of deps) visit(d);
    sorted.push(step);
  }

  for (const s of steps) visit(s.stepNumber);
  return sorted;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout ${ms}ms per ${label}`)), ms),
    ),
  ]);
}

export function buildInitialStepStates(steps: PlanStep[]): PlanStepState[] {
  return steps.map((step) => ({
    step,
    status: "pending" as PlanStepStatus,
    requiresApproval: isWriteTool(step.toolId),
  }));
}

/**
 * Executes plan steps sequentially (topologically ordered).
 * When a write-step is reached, pauses and yields with status "awaiting-approval".
 * The caller must call `resumeAfterApproval` to continue.
 */
export async function executePlan(
  state: PlanExecutionState,
  onStepUpdate: (state: PlanExecutionState) => void,
  startFromStep?: number,
): Promise<PlanExecutionState> {
  const sorted = topoSort(state.steps);
  let current: PlanExecutionState = { ...state, status: "running" };
  onStepUpdate(current);

  const startIdx = startFromStep
    ? sorted.findIndex((s) => s.stepNumber === startFromStep)
    : 0;

  for (let i = startIdx; i < sorted.length; i++) {
    const step = sorted[i];
    const stepIdx = current.stepStates.findIndex((ss) => ss.step.stepNumber === step.stepNumber);

    // Update current step
    current = { ...current, currentStep: step.stepNumber };
    const newStates = [...current.stepStates];
    newStates[stepIdx] = { ...newStates[stepIdx], status: "running" };
    current = { ...current, stepStates: newStates };
    onStepUpdate(current);

    // If write tool → pause for approval
    if (isWriteTool(step.toolId)) {
      const pauseStates = [...current.stepStates];
      pauseStates[stepIdx] = { ...pauseStates[stepIdx], status: "blocked-on-approval" };
      current = {
        ...current,
        stepStates: pauseStates,
        status: "awaiting-approval",
        approvalStepNumber: step.stepNumber,
      };
      onStepUpdate(current);
      return current; // Caller must resume
    }

    // Execute read tool
    const tool = TOOLS.find((t) => t.id === step.toolId);
    if (!tool) {
      const errStates = [...current.stepStates];
      errStates[stepIdx] = { ...errStates[stepIdx], status: "error", error: `Tool "${step.toolId}" non trovato` };
      current = { ...current, stepStates: errStates, status: "error", error: `Tool "${step.toolId}" non trovato` };
      onStepUpdate(current);
      return current;
    }

    try {
      const resolvedParams = resolveParams(step.params, current.results);
      const promptText = JSON.stringify(resolvedParams);
      const result = await withTimeout(
        tool.execute(promptText, { confirmed: false, payload: resolvedParams }),
        STEP_TIMEOUT_MS,
        `Step ${step.stepNumber} (${step.toolId})`,
      );
      const doneStates = [...current.stepStates];
      doneStates[stepIdx] = { ...doneStates[stepIdx], status: "done", result };
      current = {
        ...current,
        stepStates: doneStates,
        results: { ...current.results, [step.stepNumber]: result },
      };
      onStepUpdate(current);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "errore sconosciuto";
      const errStates = [...current.stepStates];
      errStates[stepIdx] = { ...errStates[stepIdx], status: "error", error: msg };
      current = { ...current, stepStates: errStates, status: "error", error: `Step ${step.stepNumber} (${step.toolId}): ${msg}` };
      onStepUpdate(current);
      return current;
    }
  }

  current = { ...current, status: "done" };
  onStepUpdate(current);
  return current;
}

/**
 * Executes a single write step after approval, then continues the plan.
 */
export async function executeApprovedStep(
  state: PlanExecutionState,
  onStepUpdate: (state: PlanExecutionState) => void,
): Promise<PlanExecutionState> {
  const stepNum = state.approvalStepNumber;
  if (!stepNum) return state;

  const stepIdx = state.stepStates.findIndex((ss) => ss.step.stepNumber === stepNum);
  if (stepIdx === -1) return state;

  const step = state.stepStates[stepIdx].step;
  const tool = TOOLS.find((t) => t.id === step.toolId);
  if (!tool) {
    const errStates = [...state.stepStates];
    errStates[stepIdx] = { ...errStates[stepIdx], status: "error", error: `Tool "${step.toolId}" non trovato` };
    return { ...state, stepStates: errStates, status: "error", error: `Tool non trovato` };
  }

  let current = { ...state, status: "running" as const, approvalStepNumber: undefined };
  const runStates = [...current.stepStates];
  runStates[stepIdx] = { ...runStates[stepIdx], status: "running" as PlanStepStatus };
  current = { ...current, stepStates: runStates };
  onStepUpdate(current);

  try {
    const resolvedParams = resolveParams(step.params, current.results);
    const promptText = JSON.stringify(resolvedParams);
    const result = await withTimeout(
      tool.execute(promptText, { confirmed: true, payload: resolvedParams }),
      STEP_TIMEOUT_MS,
      `Step ${step.stepNumber} (${step.toolId})`,
    );
    const doneStates = [...current.stepStates];
    doneStates[stepIdx] = { ...doneStates[stepIdx], status: "done", result };
    current = {
      ...current,
      stepStates: doneStates,
      results: { ...current.results, [step.stepNumber]: result },
    };
    onStepUpdate(current);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "errore sconosciuto";
    const errStates = [...current.stepStates];
    errStates[stepIdx] = { ...errStates[stepIdx], status: "error", error: msg };
    current = { ...current, stepStates: errStates, status: "error", error: `Step ${step.stepNumber}: ${msg}` };
    onStepUpdate(current);
    return current;
  }

  // Continue from next step
  const sorted = state.steps.sort((a, b) => a.stepNumber - b.stepNumber);
  const nextIdx = sorted.findIndex((s) => s.stepNumber > stepNum);
  if (nextIdx === -1) {
    current = { ...current, status: "done" };
    onStepUpdate(current);
    return current;
  }

  return executePlan(current, onStepUpdate, sorted[nextIdx].stepNumber);
}
