/**
 * useResultCommentary — Generate AI commentary on tool execution results
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { Message, CanvasType } from "../constants";
import type { ToolResult } from "../tools/types";
import { TOOLS } from "../tools/registry";
import { getAiComment, serializeResultForAI, type SuggestedAction } from "../aiBridge";
import { getLastSuccessfulQueryPlan } from "../tools/aiQueryTool";
import { tryLocalComment, tryLocalCommentMulti } from "../lib/localResultFormatter";
import { formatTraceLine, type TraceBuilder } from "../lib/toolTrace";
import { buildAuditFromTrace } from "../lib/auditFromTrace";
import type { QueryContext } from "../lib/queryContext";

interface CommentaryDeps {
  addMessage: (msg: Omit<Message, "id">) => void;
  ts: () => string;
  governance: { role: string; permission: string; policy: string };
  ttsSpeak: (text: string) => void;
  setVoiceSpeaking: (v: boolean) => void;
  buildHistory: () => { role: "user" | "assistant"; content: string }[];
  /** Live session context (for constraints + working set propagation). */
  getQueryContext?: () => QueryContext | null;
}

export function useResultCommentary(deps: CommentaryDeps) {
  const {
    addMessage, ts, governance, ttsSpeak, setVoiceSpeaking, buildHistory,
    getQueryContext,
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
        const local = result.kind === "multi"
          ? tryLocalCommentMulti(userPrompt, result.parts)
          : tryLocalComment(userPrompt, result, getLastSuccessfulQueryPlan());
        if (local) {
          const finalTrace = trace?.finish();
          const traceMeta = finalTrace ? formatTraceLine(finalTrace) : undefined;
          const audit = finalTrace ? buildAuditFromTrace(finalTrace) : undefined;
          // Filtra eventuali azioni LinkedIn se il vincolo è attivo.
          const ctx = getQueryContext?.();
          const filteredActions = ctx?.constraints?.noLinkedIn
            ? local.suggestedActions.filter(
                (a) => !/linkedin/i.test(a.label) && !/linkedin/i.test(a.prompt),
              )
            : local.suggestedActions;
          addMessage({
            role: "assistant",
            content: local.message,
            agentName: "Direttore",
            timestamp: ts(),
            meta: traceMeta ?? (result.meta?.sourceLabel ? `${result.meta.sourceLabel} · ${result.meta.count} record · LIVE` : undefined),
            governance: `Ruolo: ${governance.role} · Permesso: ${governance.permission} · Policy: ${governance.policy}`,
            suggestedActions: filteredActions,
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
      const ctx = getQueryContext?.();
      const comment = await getAiComment({
        userPrompt,
        toolId,
        toolLabel,
        resultSummary,
        history: buildHistory(),
        constraints: ctx?.constraints,
        workingSet:
          ctx?.workingSetIds && ctx.workingSetIds.length > 0
            ? { count: ctx.workingSetIds.length, label: ctx.setLabel }
            : undefined,
      });
      trace?.add({ source: "comment", label: "ai-comment", durationMs: Date.now() - t0 });

      const finalTrace = trace?.finish();
      const traceMeta = finalTrace ? formatTraceLine(finalTrace) : undefined;
      const audit = finalTrace ? buildAuditFromTrace(finalTrace) : undefined;

      // Filtra azioni LinkedIn anche dal commento AI se il vincolo è attivo.
      const aiActions = ctx?.constraints?.noLinkedIn
        ? comment.suggestedActions.filter(
            (a) => !/linkedin/i.test(a.label) && !/linkedin/i.test(a.prompt),
          )
        : comment.suggestedActions;

      addMessage({
        role: "assistant",
        content: comment.message,
        agentName: "Direttore",
        timestamp: ts(),
        meta: traceMeta ?? (result.meta?.sourceLabel ? `${result.meta.sourceLabel} · ${result.meta.count} record · LIVE` : undefined),
        governance: `Ruolo: ${governance.role} · Permesso: ${governance.permission} · Policy: ${governance.policy}`,
        suggestedActions: aiActions,
        spokenSummary: comment.spokenSummary ?? comment.message.replace(/\*\*/g, "").slice(0, 200),
        audit,
      });
      setVoiceSpeaking(false);
    },
    [addMessage, buildHistory, governance, setVoiceSpeaking, ts, ttsSpeak, getQueryContext],
  );

  return { commentOnResult };
}
