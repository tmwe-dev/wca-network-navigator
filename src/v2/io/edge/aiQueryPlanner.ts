/**
 * AI Query Planner client — chiama edge function `ai-query-planner`
 * che riceve prompt + schema KB e ritorna 1..N QueryPlan strutturati.
 */
import { z } from "zod";
import { invokeEdgeV2 } from "./client";
import { QueryPlanSchema, type QueryPlan } from "@/v2/ui/pages/command/lib/safeQueryExecutor";

export type { QueryPlan };

export interface PlanQueryRequest {
  prompt: string;
  history?: { role: string; content: string }[];
  /** Optional structured hint about the previous query for follow-up handling */
  contextHint?: string;
}

/**
 * Schema permissivo lato client: accetta sia il nuovo formato {plans:[...]}
 * sia il vecchio formato singolo (un solo QueryPlan a livello root) e lo
 * normalizza sempre in array. Cap difensivo a 4 piani.
 */
export const QueryPlanBatchSchema = z
  .union([
    z.object({ plans: z.array(QueryPlanSchema).min(1) }),
    QueryPlanSchema,
  ])
  .transform((v) => {
    if ("plans" in v) {
      return { plans: v.plans.slice(0, 4) };
    }
    return { plans: [v] };
  });

export type QueryPlanBatch = z.infer<typeof QueryPlanBatchSchema>;

export async function planQuery(req: PlanQueryRequest) {
  return invokeEdgeV2(
    "ai-query-planner",
    {
      prompt: req.prompt,
      history: (req.history ?? []).slice(-6),
      contextHint: req.contextHint ?? "",
    },
    QueryPlanBatchSchema,
  );
}
