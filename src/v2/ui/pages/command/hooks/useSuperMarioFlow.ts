/**
 * useSuperMarioFlow — Percorso Command alternativo basato su super-mario edge.
 *
 * Iterazione 1 (sicura, no rotture):
 *  - Chiama super-mario con la conversazione completa.
 *  - Mostra il `message` come risposta del Direttore.
 *  - Se super-mario propone tool_calls READ noti al registry locale, le esegue
 *    in sequenza (stessa interfaccia execute(prompt, ctx) dei tool esistenti).
 *  - Se propone WRITE/SEND, mostra pendingApproval con il primo tool.
 *  - Su errore, ricade silenziosamente sul percorso classico (caller decide).
 *
 * Iterazioni future: arguments strutturati invece di prompt, multi-step plan,
 * rimozione regex / planExecution / useResultCommentary.
 */
import { useCallback } from "react";
import { invokeSuperMario, type SuperMarioTurn } from "@/v2/ai/superMario";
import { TOOLS } from "../tools/registry";
import type { ToolResult } from "../tools/types";
import type { Message, CanvasType, FlowPhase } from "../constants";
import type { ConversationMessage } from "@/v2/io/supabase/queries/conversations";

interface FlowDeps {
  addMessage: (msg: Omit<Message, "id">) => void;
  ts: () => string;
  setFlowPhase: (p: FlowPhase) => void;
  setShowTools: (v: boolean) => void;
  setLiveResult: (v: ToolResult | null) => void;
  setCanvas: (c: CanvasType) => void;
  setPendingApproval: (
    v: { toolId: string; payload: Record<string, unknown>; prompt: string } | null,
  ) => void;
  messages: Message[];
  persistedMessages?: ConversationMessage[];
  conversationId?: string | null;
}

function buildTurns(
  ramMessages: Message[],
  persisted: ConversationMessage[],
): SuperMarioTurn[] {
  // Preferisci il DB se disponibile (memoria piena), altrimenti la RAM (ultimi N).
  if (persisted.length > 0) {
    return persisted.map((m, i) => ({
      role: (m.role as SuperMarioTurn["role"]) ?? "assistant",
      content: m.content ?? "",
      tool_id: m.tool_id ?? undefined,
      tool_result: m.tool_result ?? undefined,
      index: i,
    }));
  }
  return ramMessages
    .filter((m) => !m.thinking && m.content)
    .map((m, i) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
      index: i,
    }));
}

export function useSuperMarioFlow(deps: FlowDeps) {
  const {
    addMessage, ts, setFlowPhase, setShowTools, setLiveResult, setCanvas,
    setPendingApproval, messages, persistedMessages, conversationId,
  } = deps;

  const runSuperMario = useCallback(
    async (userMessage: string): Promise<{ ok: boolean; reason?: string }> => {
      setFlowPhase("thinking");
      setShowTools(false);

      try {
        const turns = buildTurns(messages, persistedMessages ?? []);
        const result = await invokeSuperMario({
          source: "useCommandSubmit",
          scope: "command",
          conversationId: conversationId ?? null,
          userMessage,
          turns,
          route: typeof window !== "undefined" ? window.location.pathname : undefined,
        });

        const { response, meta, domain, trace_id } = result;

        // 1. Mostra il messaggio del Direttore
        addMessage({
          role: "assistant",
          content: response.message || "(nessuna risposta)",
          agentName: "Direttore",
          timestamp: ts(),
          meta: `super-mario · ${domain} · ${meta.latency_ms}ms · KB ${meta.kb_cards} · trace ${trace_id.slice(0, 8)}`,
        });

        // 2. Warnings (se presenti)
        if (response.warnings.length > 0) {
          addMessage({
            role: "assistant",
            content: `Avvisi: ${response.warnings.join("; ")}`,
            agentName: "Sistema",
            timestamp: ts(),
            meta: "guard",
          });
        }

        // 3. Tool calls
        if (response.tool_calls.length === 0) {
          setFlowPhase("idle");
          return { ok: true };
        }

        const first = response.tool_calls[0];
        const tool = TOOLS.find((t) => t.id === first.tool_name);
        if (!tool) {
          addMessage({
            role: "assistant",
            content: `Tool "${first.tool_name}" non disponibile in questa pagina.`,
            agentName: "Sistema",
            timestamp: ts(),
          });
          setFlowPhase("idle");
          return { ok: true };
        }

        if (response.needs_user_confirmation) {
          setPendingApproval({
            toolId: tool.id,
            payload: first.arguments,
            prompt: userMessage,
          });
          setFlowPhase("idle");
          return { ok: true };
        }

        // READ tool: esegui subito
        setFlowPhase("executing");
        const toolResult = await tool.execute(userMessage, {
          payload: first.arguments,
          originalPrompt: userMessage,
        });
        setLiveResult(toolResult);
        if (toolResult.kind === "table") setCanvas("table");
        else if (toolResult.kind === "card-grid") setCanvas("card-grid");
        else if (toolResult.kind === "composer") setCanvas("composer");
        else setCanvas("dashboard");
        setFlowPhase("idle");

        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Errore sconosciuto";
        setFlowPhase("idle");
        return { ok: false, reason: msg };
      }
    },
    [
      addMessage, ts, setFlowPhase, setShowTools, setLiveResult, setCanvas,
      setPendingApproval, messages, persistedMessages, conversationId,
    ],
  );

  return { runSuperMario };
}
