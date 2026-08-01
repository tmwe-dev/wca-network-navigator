/**
 * buildPlanState — factory unica per costruire PlanExecutionState.
 * Elimina la duplicazione tra ramo fallback ai-query e ramo plan multi-step.
 */
import type { PlanStep } from "@/v2/io/edge/aiAssistant";
import { buildInitialStepStates, MAX_PLAN_STEPS, type PlanExecutionState } from "../planRunner";

export function buildPlanState(steps: PlanStep[], summary: string): PlanExecutionState {
  const capped = steps.slice(0, MAX_PLAN_STEPS);
  return {
    steps: capped,
    stepStates: buildInitialStepStates(capped),
    summary,
    results: {},
    currentStep: 0,
    status: "running",
  };
}

/** Fallback plan a 1-step su ai-query quando il planner restituisce steps=[]. */
export function buildAiQueryFallbackPlan(): PlanExecutionState {
  return buildPlanState(
    [{ stepNumber: 1, toolId: "ai-query", reasoning: "Ricerca diretta sul database", params: {} }],
    "Ricerca diretta sul database",
  );
}