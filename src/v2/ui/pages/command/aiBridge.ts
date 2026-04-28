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

  const userTurn = `L'utente ti ha chiesto:
> "${userPrompt}"

Hai i dati pronti (li vedi tu, l'utente li vede nel canvas a fianco):
\`\`\`json
${resultSummary}
\`\`\`

Rispondi come stai PARLANDO con un collega, non come stai presentando un report.

REGOLE FERREE:
- "message": 1 frase diretta, max 20 parole, tono colloquiale ("ok, abbiamo X", "guarda, ne ho trovati Y", "niente, zero risultati"). NIENTE elenchi, NIENTE descrizione del risultato (i dati sono già visibili nel canvas), NIENTE "ho eseguito il tool", NIENTE markdown.
- "spokenSummary": versione PARLATA (max 150 char), naturale, come se lo dicessi a voce a un collega — frasi brevi, niente numeri formattati strani, niente "asterischi" né caratteri speciali.
- "suggestedActions": 2-3 prossime mosse concrete che l'utente potrebbe volere ORA dato il risultato (label max 3-4 parole). Se il risultato è vuoto, suggerisci alternative. Se è ricco, suggerisci la prossima azione operativa (filtra, contatta, esporta, approfondisci).

Esempi tono giusto:
- message: "Ok, sono 247 partner in Germania."  spoken: "Sono duecentoquarantasette partner in Germania."
- message: "Niente, nessun risultato. Provo allargando ai paesi limitrofi?"  spoken: "Nessun risultato. Allargo ai paesi vicini?"
- message: "Trovati 12, te li faccio vedere."  spoken: "Ne ho trovati dodici, guarda nel canvas."

Rispondi SOLO con questo JSON valido, niente altro testo:
{
  "message": "<frase colloquiale, max 20 parole, niente markdown>",
  "spokenSummary": "<frase parlata, max 150 char, naturale>",
  "suggestedActions": [
    {"label": "<3-4 parole>", "prompt": "<comando completo da inviare se cliccato>"}
  ]
}`;

  try {
    const data = await invokeAi<Record<string, unknown>>("ai-assistant", {
      scope: "command",
      body: {
        messages: [
          ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: userTurn },
        ],
      },
      context: {
        source: "aiBridge",
        route: "/v2/command",
        mode: "tool-result-comment",
      },
    }).catch((e: unknown) => {
      throw new Error(e instanceof Error ? e.message : String(e));
    });

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
