/**
 * planPreview — formatta il messaggio di anteprima piano multi-step.
 * Estratto da useCommandSubmit per mantenere il master control pulito.
 */
import type { PlanStep } from "@/v2/io/edge/aiAssistant";
import { TOOLS } from "../tools/registry";

export function buildPlanPreview(summary: string, steps: PlanStep[]): string {
  const lines = steps
    .map((s) => `${s.stepNumber}. **${TOOLS.find((t) => t.id === s.toolId)?.label ?? s.toolId}** — ${s.reasoning}`)
    .join("\n");
  return `**Piano in ${steps.length} step:** ${summary}\n\n${lines}`;
}

export function labelForToolId(toolId: string): string {
  return TOOLS.find((t) => t.id === toolId)?.label ?? toolId;
}
