/**
 * useLabAgent — wrapper unified-assistant scope kb-supervisor con briefing Prompt Lab.
 *
 * Refactor 2026-05: barrel sottile che orchestra hook/funzioni in `useLabAgent/`.
 * - briefings.ts       — costanti prompt (PROMPT_LAB_BRIEFING, VOICE_ENFORCEMENT_RULES)
 * - promptHelpers.ts   — describeSource / summarizeNearby / contract / retry / briefing
 * - loaders.ts         — KB doctrine + voice template loaders
 * - callAgent.ts       — useCallAgent con retry/backoff
 * - improvers.ts       — improveBlock / improveBlockGlobal / analyzeBlockArchitect
 * - parseImprove.ts    — parseImproveResponse (OUTCOME_TYPE)
 * - types.ts           — ImproveOptions, BriefingPayload, LabChatMessage, …
 */
import { useCallback, useState } from "react";
import type { Block } from "../types";
import { type ArchitectDiagnosticV2 } from "./diagnostics";
import { useArchitectKb } from "./useArchitectKb";
import type { AgentRegistryEntry } from "@/data/agentPrompts";
import { useCallAgent } from "./useLabAgent/callAgent";
import {
  improveBlock as improveBlockImpl,
  improveBlockGlobal as improveBlockGlobalImpl,
  analyzeBlockArchitect as analyzeBlockArchitectImpl,
  type ImproveBlockGlobalParams,
} from "./useLabAgent/improvers";
import type { ImproveOptions, LabChatMessage, BriefingPayload } from "./useLabAgent/types";

export type { LabChatMessage, BriefingPayload, ImproveOptions, ParsedImproveResult } from "./useLabAgent/types";
export { parseImproveResponse } from "./useLabAgent/parseImprove";

export function useLabAgent() {
  const [messages, setMessages] = useState<LabChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  /**
   * mode — Fase 4 dell'evoluzione Atlas/Architect.
   *  - "standard": miglioramento blocco-per-blocco.
   *  - "architect": diagnosi strutturale via `lab_architect_procedure`.
   */
  const [mode, setMode] = useState<"standard" | "architect">("standard");
  const { loadProcedure: loadArchitectProcedure } = useArchitectKb();
  const callAgent = useCallAgent();

  const appendMessage = useCallback((m: Omit<LabChatMessage, "id" | "timestamp">) => {
    setMessages((prev) => [
      ...prev,
      { ...m, id: crypto.randomUUID(), timestamp: Date.now() },
    ]);
  }, []);

  const improveBlock = useCallback(
    (opts: ImproveOptions) => improveBlockImpl(callAgent, opts),
    [callAgent],
  );

  const improveBlockGlobal = useCallback(
    (params: ImproveBlockGlobalParams) => improveBlockGlobalImpl(callAgent, params),
    [callAgent],
  );

  const analyzeBlockArchitect = useCallback(
    (params: {
      block: Block;
      tabLabel?: string;
      tabActivation?: string;
      nearbyBlocks?: ReadonlyArray<Block>;
      systemMap?: string;
      doctrineFull?: string;
      goal?: string;
      agent?: AgentRegistryEntry;
    }): Promise<ArchitectDiagnosticV2[]> =>
      analyzeBlockArchitectImpl(callAgent, { ...params, mode, loadArchitectProcedure }),
    [callAgent, mode, loadArchitectProcedure],
  );

  const sendChatMessage = useCallback(
    async (
      content: string,
      ctx: { tabLabel: string; blocks: ReadonlyArray<Block>; tabActivation?: string },
    ): Promise<{ targetBlockId?: string; improvedText?: string; chat: string }> => {
      appendMessage({ role: "user", content });
      setLoading(true);
      try {
        const lower = content.toLowerCase();
        const target = ctx.blocks.find(
          (b) =>
            lower.includes(b.label.toLowerCase()) ||
            lower.includes(b.id.toLowerCase()),
        );

        if (target) {
          const improved = await improveBlock({
            block: target,
            instruction: content,
            tabLabel: ctx.tabLabel,
            tabActivation: ctx.tabActivation,
            nearbyBlocks: ctx.blocks,
            goal: content,
          });
          appendMessage({
            role: "assistant",
            content: `Ho proposto un miglioramento per **${target.label}**. Verifica nella colonna destra.`,
          });
          return { targetBlockId: target.id, improvedText: improved, chat: improved };
        }

        const reply = await callAgent(content, {
          tab: ctx.tabLabel,
          tab_activation: ctx.tabActivation,
          blocks: ctx.blocks.map((b) => ({ id: b.id, label: b.label })),
        });
        appendMessage({ role: "assistant", content: reply });
        return { chat: reply };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Errore Lab Agent";
        appendMessage({ role: "assistant", content: `❌ ${msg}` });
        return { chat: msg };
      } finally {
        setLoading(false);
      }
    },
    [appendMessage, callAgent, improveBlock],
  );

  return {
    messages,
    loading,
    sendChatMessage,
    improveBlock,
    improveBlockGlobal,
    analyzeBlockArchitect,
    mode,
    setMode,
    clearMessages: () => setMessages([]),
  };
}