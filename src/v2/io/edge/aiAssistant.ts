/**
 * decideToolFromPrompt — Calls ai-assistant edge function in "tool-decision" mode
 * planExecution — Calls ai-assistant in "plan-execution" mode for multi-step chaining
 */
import { invokeEdgeV2 } from "./client";
import { z } from "zod";

const AiDecisionSchema = z.object({
  toolId: z.string(),
  toolParams: z.record(z.string(), z.unknown()).optional(),
  reasoning: z.string().optional(),
});

export type AiToolDecision = z.infer<typeof AiDecisionSchema>;

export interface ToolDescriptor {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export async function decideToolFromPrompt(
  prompt: string,
  availableTools: readonly ToolDescriptor[],
  history: { role: string; content: string }[] = [],
) {
  return invokeEdgeV2(
    "ai-assistant",
    {
      mode: "tool-decision",
      messages: [
        ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: prompt },
      ],
      context: {
        tools: availableTools.map((t) => ({
          id: t.id,
          label: t.label,
          description: t.description,
        })),
      },
    },
    AiDecisionSchema,
  );
}

/* ─── Plan Execution ─── */

const PlanStepSchema = z.object({
  stepNumber: z.number(),
  toolId: z.string(),
  reasoning: z.string(),
  params: z.record(z.string(), z.unknown()).default({}),
});

const PlanSchema = z.object({
  steps: z.array(PlanStepSchema),
  summary: z.string(),
});

export type PlanStep = z.infer<typeof PlanStepSchema>;
export type Plan = z.infer<typeof PlanSchema>;

export interface ToolMetadataItem {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly requiresApproval: boolean;
}

export async function planExecution(
  prompt: string,
  tools: readonly ToolMetadataItem[],
  history: { role: string; content: string }[] = [],
) {
  return invokeEdgeV2(
    "ai-assistant",
    {
      mode: "plan-execution",
      context: {
        source: "CommandPage.planExecution",
        route: "/v2/command",
        mode: "plan-execution",
        userPrompt: prompt,
        tools: tools.map((t) => ({
          id: t.id,
          label: t.label,
          description: t.description,
          requiresApproval: t.requiresApproval,
        })),
        history: history.slice(-10),
      },
      scope: "command",
    },
    PlanSchema,
  );
}
