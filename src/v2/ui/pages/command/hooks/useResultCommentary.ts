/**
 * useResultCommentary — Generate AI commentary on tool execution results
 */
import { useCallback } from "react";
import type { Message } from "../constants";
import type { ToolResult } from "../tools/types";
import { TOOLS } from "../tools/registry";
import { getAiComment, serializeResultForAI } from "../aiBridge";
import { getLastSuccessfulQueryPlan } from "../tools/aiQueryTool";
import { tryLocalComment, tryLocalCommentMulti } from "../lib/localResultFormatter";
import { formatTraceLine, type TraceBuilder } from "../lib/toolTrace";
import { buildAuditFromTrace } from "../lib/auditFromTrace";
import type { QueryPlan } from "../lib/safeQueryExecutor";

interface CommentaryDeps {
  addMessage: (msg: Omit<Message, "id">) => void;
  ts: () => string;
  governance: { role: string; permission: string; policy: string };
  ttsSpeak: (text: string) => void;
  setVoiceSpeaking: (v: boolean) => void;
  buildHistory: () => { role: "user" | "assistant"; content: string }[];
}

export function useResultCommentary(deps: CommentaryDeps) {
  const {
    addMessage, ts, governance, ttsSpeak, setVoiceSpeaking, buildHistory,
  } = deps;

  /** After tool execution, comment on the result + suggest next actions.
   *  Tries LOCAL formatter first (skips LLM), falls back to AI commentary. */
  const commentOnResult = useCallback(
    async (userPrompt: string, toolId: string, result: ToolResult, trace?: TraceBuilder) => {
      const tool = TOOLS.find((t) => t.id === toolId);
      const toolLabel = tool?.label ?? toolId;

      // Propaga eventuali audit refs dal risultato del tool al trace
      const refs = result.meta?.auditRefs;
      if (refs && trace) {
        for (const r of refs) {
          trace.addReference({ kind: r.kind, label: r.label, value: r.value });
        }
      }

      // Try LOCAL formatter (skip LLM for simple count/short list)
      if (toolId === "ai-query") {
        if (result.kind === "result") {
          const finalTrace = trace?.finish();
          const traceMeta = finalTrace ? formatTraceLine(finalTrace) : undefined;
          const audit = finalTrace ? buildAuditFromTrace(finalTrace) : undefined;
          addMessage({
            role: "assistant",
            content: result.message,
            agentName: "Direttore",
            timestamp: ts(),
            meta: traceMeta ?? (result.meta?.sourceLabel ? `${result.meta.sourceLabel} · ${result.meta.count} record · LIVE` : undefined),
            governance: `Ruolo: ${governance.role} · Permesso: ${governance.permission} · Policy: ${governance.policy}`,
            spokenSummary: result.message.replace(/[*_`#>❌]/g, "").slice(0, 200),
            audit,
          });
          setVoiceSpeaking(false);
          return;
        }
        const fallbackPlan: QueryPlan | null = result.kind === "table"
          ? {
              table: String(result.liveSource ?? "partners"),
              columns: [],
              filters: [...(result.queryFilters ?? [])] as QueryPlan["filters"],
              limit: 50,
              title: result.title,
            }
          : null;
        const localPlan = getLastSuccessfulQueryPlan() ?? (result.kind === "table"
          ? fallbackPlan
          : null);
        const local = result.kind === "multi"
          ? tryLocalCommentMulti(userPrompt, result.parts)
          : tryLocalComment(userPrompt, result, localPlan);
        if (local) {
          const finalTrace = trace?.finish();
          const traceMeta = finalTrace ? formatTraceLine(finalTrace) : undefined;
          const audit = finalTrace ? buildAuditFromTrace(finalTrace) : undefined;
          addMessage({
            role: "assistant",
            content: local.message,
            agentName: "Direttore",
            timestamp: ts(),
            meta: traceMeta ?? (result.meta?.sourceLabel ? `${result.meta.sourceLabel} · ${result.meta.count} record · LIVE` : undefined),
            governance: `Ruolo: ${governance.role} · Permesso: ${governance.permission} · Policy: ${governance.policy}`,
            suggestedActions: local.suggestedActions,
            spokenSummary: local.spokenSummary,
            audit,
          });
          setVoiceSpeaking(false);
          return;
        }
      }

      // Fallback: full AI commentary
      const t0 = Date.now();
      const resultSummary = serializeResultForAI(result);
      const comment = await Promise.race([
        getAiComment({
          userPrompt,
          toolId,
          toolLabel,
          resultSummary,
          history: buildHistory(),
        }),
        new Promise<{ message: string; suggestedActions?: never; spokenSummary?: never }>((resolve) =>
          setTimeout(
            () => resolve({ message: "_(Il motore AI non ha risposto in tempo, mostro il risultato grezzo.)_" }),
            25_000,
          ),
        ),
      ]);
      trace?.add({ source: "comment", label: "ai-comment", durationMs: Date.now() - t0 });

      const finalTrace = trace?.finish();
      const traceMeta = finalTrace ? formatTraceLine(finalTrace) : undefined;
      const audit = finalTrace ? buildAuditFromTrace(finalTrace) : undefined;

      addMessage({
        role: "assistant",
        content: comment.message,
        agentName: "Direttore",
        timestamp: ts(),
        meta: traceMeta ?? (result.meta?.sourceLabel ? `${result.meta.sourceLabel} · ${result.meta.count} record · LIVE` : undefined),
        governance: `Ruolo: ${governance.role} · Permesso: ${governance.permission} · Policy: ${governance.policy}`,
        suggestedActions: comment.suggestedActions,
        spokenSummary: comment.spokenSummary ?? comment.message.replace(/\*\*/g, "").slice(0, 200),
        audit,
      });
      setVoiceSpeaking(false);
    },
    [addMessage, buildHistory, governance, setVoiceSpeaking, ts, ttsSpeak],
  );

  return { commentOnResult };
}
