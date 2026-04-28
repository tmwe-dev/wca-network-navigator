/**
 * useFastLane — Direct tool execution for simple queries (skips plan-execution AI hop)
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { Message, CanvasType, FlowPhase } from "../constants";
import type { ToolResult } from "../tools/types";
import type { ExecutionStep } from "@/components/workspace/ExecutionFlow";
import { aiQueryTool } from "../tools/aiQueryTool";
import { startTrace, type TraceBuilder } from "../lib/toolTrace";

interface FastLaneDeps {
  addMessage: (msg: Omit<Message, "id">) => void;
  ts: () => string;
  setFlowPhase: (p: FlowPhase) => void;
  setExecProgress: (v: number) => void;
  setLiveResult: (v: ToolResult | null) => void;
  setCanvas: (c: CanvasType | null) => void;
  setShowTools: (v: boolean) => void;
  setActiveToolKey: (v: string | null) => void;
  setToolPhase: (v: "activating" | "active" | "done") => void;
  setChainHighlight: (v: number | undefined | ((prev: number | undefined) => number | undefined)) => void;
  setExecSteps: (v: ExecutionStep[] | ((prev: ExecutionStep[]) => ExecutionStep[])) => void;
  buildHistory: () => { role: "user" | "assistant"; content: string }[];
  canvasForResult: (result: ToolResult) => CanvasType;
}

export function useFastLane(deps: FastLaneDeps) {
  const {
    addMessage, ts, setFlowPhase, setExecProgress, setLiveResult, setCanvas, setShowTools,
    setActiveToolKey, setToolPhase, setChainHighlight, setExecSteps, buildHistory, canvasForResult,
  } = deps;

  /** FAST LANE: run aiQueryTool directly (skips plan-execution AI hop). */
  const runFastLane = useCallback(
    async (
      userPrompt: string,
      hint: string,
      onCommentNeeded: (userPrompt: string, toolId: string, result: ToolResult, trace?: TraceBuilder) => Promise<void>,
      onContextUpdate: () => void,
    ) => {
      setActiveToolKey("ai-query");
      setShowTools(true);
      setToolPhase("active");
      setChainHighlight(3);
      setFlowPhase("executing");
      setExecSteps([{ label: "Ricerca AI", detail: "Query DB diretta", status: "pending" as const }]);

      const trace = startTrace(userPrompt);
      trace.setPhase("fast-lane");
      trace.setDriver("ai-query");

      try {
        const tFast = Date.now();
        const result = await aiQueryTool.execute(userPrompt, {
          confirmed: false,
          originalPrompt: userPrompt,
          contextHint: hint,
          history: buildHistory(),
        });
        if (result.kind === "multi") {
          // Un step per ogni query parallela, etichetta = tabella.
          result.parts.forEach((p, i) => {
            trace.add({
              source: "fast-lane",
              label: `ai-query · ${p.table}`,
              toolId: "ai-query",
              stepNumber: i + 1,
              status: p.error ? "failed" : "ok",
              durationMs: p.durationMs ?? 0,
              reasoning: p.error ?? undefined,
            });
          });
        } else {
          trace.add({
            source: "fast-lane",
            label: "ai-query",
            toolId: "ai-query",
            stepNumber: 1,
            status: "ok",
            durationMs: Date.now() - tFast,
          });
        }

        // Propaga eventuali audit refs dal tool (es. compose-email lo fa)
        const refs = result.meta?.auditRefs;
        if (refs) {
          for (const r of refs) {
            trace.addReference({ kind: r.kind, label: r.label, value: r.value });
          }
        }

        setLiveResult(result);
        setCanvas(canvasForResult(result));
        setFlowPhase("done");
        setExecProgress(100);
        setShowTools(false);

        // Update query context
        onContextUpdate();

        // Show step recap
        const countLabel = result.meta && "count" in result.meta ? ` · ${result.meta.count}` : "";
        addMessage({
          role: "assistant",
          content: `🔧 Ricerca AI${countLabel}`,
          agentName: "Automation",
          timestamp: ts(),
        });

        if (result.kind !== "approval") {
          await onCommentNeeded(userPrompt, "ai-query", result, trace);
        } else {
          trace.finish();
        }
      } catch (err: unknown) {
        trace.finish();
        const msg = err instanceof Error ? err.message : "Errore sconosciuto";
        toast.error(msg);
        addMessage({
          role: "assistant",
          content: `❌ Errore ricerca AI: ${msg}`,
          agentName: "Orchestratore",
          timestamp: ts(),
        });
        setFlowPhase("idle");
        setShowTools(false);
      }
    },
    [
      addMessage, buildHistory, setActiveToolKey, setCanvas, setChainHighlight,
      setExecProgress, setExecSteps, setFlowPhase, setLiveResult, setShowTools, setToolPhase, ts, canvasForResult,
    ],
  );

  return { runFastLane };
}
