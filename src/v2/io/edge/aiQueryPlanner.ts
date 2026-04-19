/**
 * AI Query Planner client — chiama edge function `ai-query-planner`
 * che riceve prompt + schema KB e ritorna un QueryPlan strutturato.
 */
import { invokeEdgeV2 } from "./client";
import { QueryPlanSchema, type QueryPlan } from "@/v2/ui/pages/command/lib/safeQueryExecutor";

export type { QueryPlan };

export interface PlanQueryRequest {
  prompt: string;
  history?: { role: string; content: string }[];
  /** Optional structured hint about the previous query for follow-up handling */
  contextHint?: string;
}

export async function planQuery(req: PlanQueryRequest) {
  return invokeEdgeV2(
    "ai-query-planner",
    {
      prompt: req.prompt,
      history: (req.history ?? []).slice(-6),
      contextHint: req.contextHint ?? "",
    },
    QueryPlanSchema,
  );
}
