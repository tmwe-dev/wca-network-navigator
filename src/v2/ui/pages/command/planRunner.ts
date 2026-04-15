import { TOOLS } from "./tools/registry";
import type { ToolResult } from "./tools/types";
import type { PlanStep } from "@/v2/io/edge/aiAssistant";

export interface PlanExecutionState {
  steps: PlanStep[];
  summary: string;
  results: Record<number, ToolResult>;
  currentStep: number;
  status: "planning" | "awaiting-approval" | "running" | "done" | "error";
  error?: string;
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

/**
 * Executes a plan step-by-step, calling onStepUpdate after each change.
 * All write tools are called with confirmed=true (approval is given on the whole plan).
 */
export async function executePlan(
  state: PlanExecutionState,
  onStepUpdate: (state: PlanExecutionState) => void,
): Promise<PlanExecutionState> {
  let current: PlanExecutionState = { ...state, status: "running" };
  onStepUpdate(current);

  for (const step of current.steps) {
    current = { ...current, currentStep: step.stepNumber };
    onStepUpdate(current);

    const tool = TOOLS.find((t) => t.id === step.toolId);
    if (!tool) {
      current = {
        ...current,
        status: "error",
        error: `Tool "${step.toolId}" non trovato`,
      };
      onStepUpdate(current);
      return current;
    }

    try {
      const resolvedParams = resolveParams(step.params, current.results);
      const promptText = JSON.stringify(resolvedParams);
      const result = await tool.execute(promptText, {
        confirmed: true,
        payload: resolvedParams,
      });
      current = {
        ...current,
        results: { ...current.results, [step.stepNumber]: result },
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "errore sconosciuto";
      current = {
        ...current,
        status: "error",
        error: `Step ${step.stepNumber} (${step.toolId}): ${msg}`,
      };
      onStepUpdate(current);
      return current;
    }
  }

  current = { ...current, status: "done" };
  onStepUpdate(current);
  return current;
}
