/**
 * useQueryContext — Manage conversational query context for follow-ups
 */
import { useCallback } from "react";
import type { QueryContext, SessionConstraints } from "../lib/queryContext";
import {
  buildContextFromPlan,
  buildContextWithRows,
  isContextFresh,
  deriveConstraints,
} from "../lib/queryContext";
import { getLastSuccessfulQueryPlan, clearLastSuccessfulQueryPlan } from "../tools/aiQueryTool";
import type { ToolResult } from "../tools/types";
import {
  setLastQueryResultContext,
  extractCountryCodeFromFilters,
} from "../lib/lastQueryResultContext";

interface QueryContextDeps {
  setQueryContext: (v: QueryContext | null) => void;
  queryContext: QueryContext | null;
}

export function useQueryContext(deps: QueryContextDeps) {
  const { setQueryContext, queryContext } = deps;

  /** Persist last query plan + result snapshot into context for follow-ups.
   *  When `result` is provided and is a table, rows are snapshotted (capped). */
  const updateQueryContextFromLastPlan = useCallback((result?: ToolResult) => {
    const plan = getLastSuccessfulQueryPlan();
    const carryConstraints: SessionConstraints | undefined = queryContext?.constraints;
    if (plan && plan.table !== "INVALID") {
      // Bridge per compose-email: salva il country (se presente nei filtri)
      // e il conteggio righe, così follow-up tipo "scrivi a tutti loro"
      // possono ereditare il paese senza nominarlo nel prompt.
      const countryCode = extractCountryCodeFromFilters(plan.filters);
      const rowCount =
        result && result.kind === "table"
          ? result.rows.length
          : result && result.kind === "multi"
            ? result.parts.reduce((acc, p) => acc + (p.rows?.length ?? 0), 0)
            : 0;
      setLastQueryResultContext({
        table: plan.table,
        countryCode,
        rowCount,
      });
      if (result && result.kind === "table") {
        const ctx = buildContextWithRows(plan, result.rows, result.title);
        setQueryContext({ ...ctx, constraints: carryConstraints });
      } else if (result && result.kind === "multi") {
        // Snapshot the first non-error part (mirrors aiQueryTool cache behaviour).
        const firstOk = result.parts.find((p) => !p.error);
        if (firstOk) {
          const ctx = buildContextWithRows(plan, firstOk.rows, firstOk.title);
          setQueryContext({ ...ctx, constraints: carryConstraints });
        } else {
          setQueryContext({ ...buildContextFromPlan(plan), constraints: carryConstraints });
        }
      } else {
        setQueryContext({ ...buildContextFromPlan(plan), constraints: carryConstraints });
      }
    }
    clearLastSuccessfulQueryPlan();
  }, [setQueryContext, queryContext?.constraints]);

  /** Aggiorna i constraint sticky basandosi sull'ultimo prompt utente. */
  const updateConstraintsFromPrompt = useCallback((prompt: string) => {
    const next = deriveConstraints(queryContext?.constraints, prompt);
    if (queryContext) {
      setQueryContext({ ...queryContext, constraints: next });
    } else {
      // Crea un contesto minimale che porta solo i vincoli, in modo che le
      // proposte successive (anche prima della prima query) siano coerenti.
      setQueryContext({
        table: "_constraints_only",
        filters: [],
        mode: "list",
        ts: Date.now(),
        constraints: next,
      });
    }
  }, [queryContext, setQueryContext]);

  /** Check if query context is still fresh and usable */
  const isContextUsable = useCallback((): boolean => {
    return isContextFresh(queryContext);
  }, [queryContext]);

  return {
    updateQueryContextFromLastPlan,
    updateConstraintsFromPrompt,
    isContextUsable,
    queryContext,
  };
}
