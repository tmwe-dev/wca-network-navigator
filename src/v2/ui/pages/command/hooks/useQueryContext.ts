/**
 * useQueryContext — Manage conversational query context for follow-ups
 */
import { useCallback } from "react";
import type { QueryContext } from "../lib/queryContext";
import {
  buildContextFromPlan,
  isContextFresh,
} from "../lib/queryContext";
import { getLastSuccessfulQueryPlan, clearLastSuccessfulQueryPlan } from "../tools/aiQueryTool";

interface QueryContextDeps {
  setQueryContext: (v: QueryContext | null) => void;
  queryContext: QueryContext | null;
}

export function useQueryContext(deps: QueryContextDeps) {
  const { setQueryContext, queryContext } = deps;

  /** Persist last query plan into context for follow-ups */
  const updateQueryContextFromLastPlan = useCallback(() => {
    const plan = getLastSuccessfulQueryPlan();
    if (plan && plan.table !== "INVALID") {
      setQueryContext(buildContextFromPlan(plan));
    }
    clearLastSuccessfulQueryPlan();
  }, [setQueryContext]);

  /** Check if query context is still fresh and usable */
  const isContextUsable = useCallback((): boolean => {
    return isContextFresh(queryContext);
  }, [queryContext]);

  return {
    updateQueryContextFromLastPlan,
    isContextUsable,
    queryContext,
  };
}
