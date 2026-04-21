/**
 * useLabAgent — wrapper unified-assistant scope kb-supervisor con briefing Prompt Lab.
 */
import { useCallback, useState } from "react";
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Block } from "../types";

const PROMPT_LAB_BRIEFING = `Sei il Prompt Lab Architect. Migliori prompt, KB e configurazioni AI per WCA Network Navigator.

REGOLE:
- System Prompt: max 2000 chars, struttura RUOLO/REGOLE/DOTTRINA/OUTPUT
- KB Entry: max 800 chars, struttura REGOLA/PROCEDURA/ESEMPIO
- Email Prompt: max 500 chars, struttura TIPO/TONO/STRUTTURA/CTA
- Voice Prompt: linguaggio naturale conversazionale, no markdown, no bullet
- Playbook: max 600 chars, TRIGGER/STRATEGIA/AZIONI/VINCOLI

QUANDO MIGLIORI: elimina ridondanze, sostituisci frasi vaghe con istruzioni precise, aggiungi vincoli (cosa NON fare), verifica coerenza con dottrina commerciale (9 stati).

IMPORTANTE: rispondi SOLO con il testo migliorato del blocco richiesto, senza intro né commenti. Mantieni la struttura originale a meno che non sia esplicitamente sbagliata.`;

export interface LabChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface UnifiedAssistantResponse {
  content?: string;
  structured?: Record<string, unknown>;
}

interface ImproveOptions {
  block: Block;
  instruction?: string;
  tabLabel?: string;
}

export function useLabAgent() {
  const [messages, setMessages] = useState<LabChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const appendMessage = useCallback((m: Omit<LabChatMessage, "id" | "timestamp">) => {
    setMessages((prev) => [
      ...prev,
      { ...m, id: crypto.randomUUID(), timestamp: Date.now() },
    ]);
  }, []);

  const callAgent = useCallback(async (userPrompt: string, extraContext: Record<string, unknown> = {}) => {
    const result = await invokeEdge<UnifiedAssistantResponse>("unified-assistant", {
      body: {
        scope: "kb-supervisor",
        mode: "conversational",
        messages: [{ role: "user", content: userPrompt }],
        pageContext: "prompt-lab",
        operatorBriefing: PROMPT_LAB_BRIEFING,
        extra_context: extraContext,
      },
      context: "promptLabAgent",
    });
    return (result.content ?? "").trim();
  }, []);

  const improveBlock = useCallback(
    async ({ block, instruction, tabLabel }: ImproveOptions): Promise<string> => {
      const guidance = instruction?.trim() ?? "Migliora questo blocco mantenendo il senso ma rendendolo più chiaro, conciso e operativo.";
      const userPrompt = `Tab: ${tabLabel ?? "n/d"}
Blocco: ${block.label} (${block.id})

Istruzione: ${guidance}

--- TESTO ATTUALE ---
${block.content}
--- FINE TESTO ---

Restituisci SOLO il testo migliorato.`;

      return callAgent(userPrompt, {
        block_id: block.id,
        block_label: block.label,
        block_source: block.source,
        tab: tabLabel,
      });
    },
    [callAgent],
  );

  const sendChatMessage = useCallback(
    async (
      content: string,
      ctx: { tabLabel: string; blocks: ReadonlyArray<Block> },
    ): Promise<{ targetBlockId?: string; improvedText?: string; chat: string }> => {
      appendMessage({ role: "user", content });
      setLoading(true);
      try {
        // Prova a identificare il blocco target dal messaggio
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
          });
          appendMessage({
            role: "assistant",
            content: `Ho proposto un miglioramento per **${target.label}**. Verifica nella colonna destra.`,
          });
          return { targetBlockId: target.id, improvedText: improved, chat: improved };
        }

        // Fallback: chat libera
        const reply = await callAgent(content, {
          tab: ctx.tabLabel,
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
    clearMessages: () => setMessages([]),
  };
}