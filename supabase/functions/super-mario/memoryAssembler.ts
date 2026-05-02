/**
 * memoryAssembler.ts — Assembla il blocco MEMORY in 5 sezioni stabili.
 *
 * Sezioni:
 *   1. NARRATIVE_SUMMARY   — riassunto narrativo dei turni meno recenti
 *   2. RECENT_TURNS        — ultimi N turni verbatim
 *   3. LAST_TOOL_RESULT    — ultimo dato strutturato prodotto dai tool
 *   4. OPERATOR_MEMORY     — memoria persistente dell'operatore (mem L1)
 *   5. CURRENT_USER_REQUEST — il prompt utente del turno corrente
 *
 * Coverage esplicita: il summary copre messaggi [from..to], i RECENT_TURNS
 * coprono i successivi. Niente buchi.
 */

import { ensureSummaryCoverage, type SummaryCoverage } from "./summarizer.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface ConversationTurn {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  tool_id?: string;
  tool_result?: unknown;
  index: number;
}

export interface MemoryBlock {
  text: string;
  coverage: SummaryCoverage | null;
  recent_count: number;
  has_tool_result: boolean;
}

const RECENT_TURNS_KEEP = 10;

export async function assembleMemory(opts: {
  supabase: SupabaseClient;
  conversationId: string | null;
  turns: ConversationTurn[];
  currentUserRequest: string;
  operatorMemory?: string;
  modelForSummary: string;
}): Promise<MemoryBlock> {
  const { supabase, conversationId, turns, currentUserRequest, operatorMemory, modelForSummary } = opts;

  // 1. NARRATIVE_SUMMARY — coverage versionata via conversation_summaries
  let narrative = "";
  let coverage: SummaryCoverage | null = null;
  if (conversationId && turns.length > RECENT_TURNS_KEEP) {
    const splitIdx = turns.length - RECENT_TURNS_KEEP;
    coverage = await ensureSummaryCoverage({
      supabase,
      conversationId,
      turns: turns.slice(0, splitIdx),
      model: modelForSummary,
    });
    if (coverage) {
      narrative = `[Copre messaggi ${coverage.from_message_index}-${coverage.to_message_index}]\n${coverage.summary}`;
    }
  }

  // 2. RECENT_TURNS — verbatim
  const recent = turns.slice(-RECENT_TURNS_KEEP);
  const recentText = recent.length === 0
    ? "(nessun turno precedente)"
    : recent
        .map((t) => {
          const label = t.role === "user" ? "Utente" : t.role === "assistant" ? "Tu" : `[${t.role}]`;
          const body = t.content.length > 800 ? t.content.slice(0, 800) + "…" : t.content;
          return `${label}: ${body}`;
        })
        .join("\n");

  // 3. LAST_TOOL_RESULT — l'ultimo turno con tool_result strutturato
  const lastWithResult = [...turns].reverse().find((t) => t.tool_result != null);
  let toolResultText = "(nessun risultato tool recente)";
  let hasToolResult = false;
  if (lastWithResult) {
    hasToolResult = true;
    const summary = summarizeToolResult(lastWithResult.tool_result);
    toolResultText = `Tool: ${lastWithResult.tool_id ?? "?"}\n${summary}`;
  }

  // 4. OPERATOR_MEMORY
  const opMem = operatorMemory?.trim() || "(nessuna preferenza salvata)";

  // 5. CURRENT_USER_REQUEST
  const text = [
    "=== MEMORY ===",
    "",
    "## NARRATIVE_SUMMARY",
    narrative || "(nessun riassunto, conversazione corta)",
    "",
    `## RECENT_TURNS (${recent.length})`,
    recentText,
    "",
    "## LAST_TOOL_RESULT",
    toolResultText,
    "",
    "## OPERATOR_MEMORY",
    opMem,
    "",
    "## CURRENT_USER_REQUEST",
    currentUserRequest,
    "",
    "=== END MEMORY ===",
  ].join("\n");

  return { text, coverage, recent_count: recent.length, has_tool_result: hasToolResult };
}

function summarizeToolResult(result: unknown): string {
  if (result == null) return "(vuoto)";
  if (typeof result === "string") return result.slice(0, 1500);
  if (typeof result !== "object") return String(result);

  const r = result as Record<string, unknown>;

  // Forme comuni dai tool del Command
  const kind = typeof r.kind === "string" ? r.kind : null;
  const title = typeof r.title === "string" ? r.title : null;

  if (kind === "table") {
    const rows = Array.isArray(r.rows) ? r.rows : [];
    const sample = rows.slice(0, 5);
    return `kind=table title="${title ?? ""}" totalRows=${rows.length} sample=${JSON.stringify(sample)}`;
  }
  if (kind === "card-grid") {
    const cards = Array.isArray(r.cards) ? r.cards : [];
    return `kind=card-grid title="${title ?? ""}" totalCards=${cards.length} sample=${JSON.stringify(cards.slice(0, 5))}`;
  }
  if (kind === "composer") {
    const drafts = Array.isArray(r.drafts) ? r.drafts.length : 1;
    return `kind=composer title="${title ?? ""}" drafts=${drafts} subject="${r.initialSubject ?? ""}"`;
  }
  if (kind === "result") {
    return `kind=result title="${title ?? ""}" message="${String(r.message ?? "").slice(0, 300)}"`;
  }

  // Generic fallback truncato
  try {
    const json = JSON.stringify(result);
    return json.length > 1500 ? json.slice(0, 1500) + "…" : json;
  } catch {
    return "[unserializable]";
  }
}