/**
 * aiBridge.ts — Conversational AI layer for the Command Page.
 *
 * After tool execution, sends the result back to the `ai-assistant` edge function
 * (mode: default, scope: command) so the agent can:
 *   • Read the tool output
 *   • Reason about it (commercial doctrine + KB + memory loaded server-side)
 *   • Produce a conversational comment (Italian, "Direttore Operativo" persona)
 *   • Suggest 2-4 concrete next actions
 *
 * This is the difference between a "tool-router" (regex → result template)
 * and a true conversational agent (router → execution → reasoning → reply).
 */
import { supabase } from "@/integrations/supabase/client";
import type { ToolResult } from "./tools/types";

export interface AiCommentRequest {
  /** What the user originally asked */
  userPrompt: string;
  /** Tool that was executed */
  toolId: string;
  toolLabel: string;
  /** Compact serialized result (for token efficiency) */
  resultSummary: string;
  /** Recent conversation context (last N turns) */
  history?: { role: "user" | "assistant"; content: string }[];
}

export interface SuggestedAction {
  label: string;
  prompt: string;
}

export interface AiCommentResponse {
  /** Conversational reply for chat + TTS */
  message: string;
  /** Spoken short version for TTS (≤200 char) */
  spokenSummary?: string;
  /** Suggested follow-up actions for the user */
  suggestedActions: SuggestedAction[];
}

/**
 * Stringifies a ToolResult into a compact JSON for the LLM next turn.
 * Truncates large arrays to their first 5 items + count, keeps meta and shape.
 */
export function serializeResultForAI(result: ToolResult): string {
  switch (result.kind) {
    case "table": {
      const sample = result.rows.slice(0, 5);
      return JSON.stringify({
        kind: "table",
        title: result.title,
        totalRows: result.rows.length,
        sample,
        meta: result.meta,
      });
    }
    case "card-grid": {
      const sample = result.cards.slice(0, 5);
      return JSON.stringify({
        kind: "card-grid",
        title: result.title,
        totalCards: result.cards.length,
        sample,
        meta: result.meta,
      });
    }
    case "timeline":
      return JSON.stringify({
        kind: "timeline",
        title: result.title,
        events: result.events.slice(0, 8),
        kpis: result.kpis,
        meta: result.meta,
      });
    case "flow":
      return JSON.stringify({
        kind: "flow",
        title: result.title,
        nodes: result.nodes.slice(0, 6),
        meta: result.meta,
      });
    case "composer":
      return JSON.stringify({
        kind: "composer",
        title: result.title,
        to: result.initialTo,
        subject: result.initialSubject,
        bodyPreview: result.initialBody.slice(0, 300),
      });
    case "approval":
      return JSON.stringify({
        kind: "approval",
        title: result.title,
        description: result.description,
        details: result.details,
        toolId: result.toolId,
      });
    case "report":
      return JSON.stringify({
        kind: "report",
        title: result.title,
        sections: result.sections.slice(0, 5),
        meta: result.meta,
      });
    case "result":
      return JSON.stringify({
        kind: "result",
        title: result.title,
        message: result.message,
        meta: result.meta,
      });
  }
}

/**
 * Calls ai-assistant in standard mode with scope:"command" to get a conversational
 * comment on the tool execution result + suggested next actions.
 *
 * The edge function loads the FULL system prompt (Direttore Operativo identity,
 * commercial doctrine, golden rules, KB tagged "command_scope" + "system_doctrine",
 * and user memory).
 */
export async function getAiComment(
  req: AiCommentRequest,
): Promise<AiCommentResponse> {
  const { userPrompt, toolId, toolLabel, resultSummary, history = [] } = req;

  const userTurn = `Hai appena eseguito il tool **${toolLabel}** (id: ${toolId}) per la richiesta dell'utente:
> "${userPrompt}"

Risultato dell'esecuzione (JSON compatto):
\`\`\`json
${resultSummary}
\`\`\`

Ora COMMENTA il risultato come Direttore Operativo:
1. In 2-4 frasi spiega cosa è emerso (cita numeri/nomi reali dal risultato, non inventare).
2. Se il risultato è vuoto, suggerisci alternative concrete (altri filtri, fonti).
3. Se il risultato è ricco, evidenzia 1-2 pattern interessanti.
4. Proponi 2-4 prossime azioni concrete come array JSON.

Rispondi SOLO con questo JSON valido (nessun altro testo):
{
  "message": "<risposta conversazionale completa, può usare markdown leggero>",
  "spokenSummary": "<versione vocale max 200 char, niente markdown>",
  "suggestedActions": [
    {"label": "<pulsante breve>", "prompt": "<comando completo da inviare se cliccato>"}
  ]
}`;

  try {
    const { data, error } = await supabase.functions.invoke("ai-assistant", {
      body: {
        messages: [
          ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: userTurn },
        ],
        scope: "command",
        context: {
          currentPage: "/v2/command",
          page: "command",
          mode: "tool-result-comment",
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    // ai-assistant returns { reply: "..." } or { message: "..." } depending on mode.
    // We try multiple shapes and parse the inner JSON.
    const raw =
      (typeof data === "object" && data !== null
        ? ((data as Record<string, unknown>).reply as string | undefined) ??
          ((data as Record<string, unknown>).message as string | undefined) ??
          ((data as Record<string, unknown>).content as string | undefined)
        : undefined) ?? "";

    if (!raw) {
      return fallbackComment(toolLabel);
    }

    // Try to extract JSON from the reply (it may be wrapped in ```json fences)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        message: raw,
        spokenSummary: raw.slice(0, 200),
        suggestedActions: [],
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<AiCommentResponse>;
      return {
        message: parsed.message ?? raw,
        spokenSummary: parsed.spokenSummary,
        suggestedActions: Array.isArray(parsed.suggestedActions)
          ? parsed.suggestedActions.filter(
              (a): a is SuggestedAction =>
                !!a && typeof a.label === "string" && typeof a.prompt === "string",
            )
          : [],
      };
    } catch {
      return {
        message: raw,
        spokenSummary: raw.slice(0, 200),
        suggestedActions: [],
      };
    }
  } catch (e: unknown) {
    console.warn("[aiBridge] getAiComment failed:", e);
    return fallbackComment(toolLabel);
  }
}

function fallbackComment(toolLabel: string): AiCommentResponse {
  return {
    message: `✅ **${toolLabel}** completato. Risultato disponibile nel canvas.`,
    spokenSummary: `${toolLabel} completato.`,
    suggestedActions: [],
  };
}
