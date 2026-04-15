/**
 * decideToolFromPrompt — Calls ai-assistant edge function in "tool-decision" mode
 * to let the LLM pick the best tool for a user prompt.
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
) {
  return invokeEdgeV2(
    "ai-assistant",
    {
      mode: "tool-decision",
      messages: [{ role: "user", content: prompt }],
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
