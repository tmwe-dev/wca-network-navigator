import { aiFetch } from "../_shared/aiCallShim.ts";
/**
 * summarizer.ts — Riassume i turni meno recenti in `conversation_summaries`
 * (versionato, coverage esplicita).
 *
 * Strategia:
 *  - Cerca l'ultimo summary per la conversazione.
 *  - Se copre già fino a turno N e abbiamo solo N+ε turni nuovi pre-RECENT_WINDOW,
 *    restituisce il summary esistente (cache implicita).
 *  - Altrimenti chiama il modello flash-lite per produrre un nuovo summary che
 *    copra [0..to_message_index] (riassume tutto, inclusi i precedenti — si
 *    appoggia al testo verbatim).
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const SUMMARY_MODEL_DEFAULT = "google/gemini-2.5-flash-lite";
const SUMMARY_VERSION = 1;
const REFRESH_EVERY_N_TURNS = 5;

export interface SummaryCoverage {
  from_message_index: number;
  to_message_index: number;
  summary: string;
  model: string;
  summary_version: number;
}

interface TurnLike {
  role: string;
  content: string;
  index: number;
}

export async function ensureSummaryCoverage(opts: {
  supabase: SupabaseClient;
  conversationId: string;
  turns: TurnLike[]; // turni che NON sono in RECENT_TURNS (cioè da riassumere)
  model?: string;
}): Promise<SummaryCoverage | null> {
  const { supabase, conversationId, turns } = opts;
  const model = opts.model ?? SUMMARY_MODEL_DEFAULT;
  if (turns.length === 0) return null;

  const targetTo = turns[turns.length - 1].index;
  const targetFrom = turns[0].index;

  // Fetch latest summary
  const { data: existing } = await supabase
    .from("conversation_summaries")
    .select("from_message_index, to_message_index, summary, model, summary_version")
    .eq("conversation_id", conversationId)
    .order("to_message_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && existing.to_message_index >= targetTo - REFRESH_EVERY_N_TURNS) {
    // Coverage abbastanza fresca, riusa
    return existing as SummaryCoverage;
  }

  // Genera nuovo summary
  const summaryText = await callSummarizer(turns, model);
  if (!summaryText) {
    return existing as SummaryCoverage | null;
  }

  const { data: inserted, error } = await supabase
    .from("conversation_summaries")
    .insert({
      conversation_id: conversationId,
      from_message_index: targetFrom,
      to_message_index: targetTo,
      summary: summaryText,
      model,
      summary_version: SUMMARY_VERSION,
    })
    .select("from_message_index, to_message_index, summary, model, summary_version")
    .maybeSingle();

  if (error || !inserted) {
    console.warn("[super-mario] summary insert failed", { error: error?.message });
    return existing as SummaryCoverage | null;
  }
  return inserted as SummaryCoverage;
}

async function callSummarizer(turns: TurnLike[], model: string): Promise<string | null> {
  const apiKey = (Deno.env.get("OPENAI_API_KEY") || Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("LOVABLE_API_KEY"));
  if (!apiKey) {
    console.warn("[super-mario] LOVABLE_API_KEY mancante, skip summarizer");
    return null;
  }

  const transcript = turns
    .map((t) => `${t.role === "user" ? "Utente" : "Direttore"}: ${t.content.slice(0, 600)}`)
    .join("\n");

  const systemMsg = `Sei un riassuntore di conversazioni operative CRM. Riassumi in 3-6 righe IN ITALIANO il senso narrativo di questi turni: cosa l'utente ha cercato, cosa ha deciso, quali entità/numeri sono emersi. Niente preamboli, solo il riassunto.`;

  try {
    const resp = await aiFetch({
        model,
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: transcript },
        ],
      });
    if (!resp.ok) {
      console.warn("[super-mario] summarizer http error", resp.status);
      return null;
    }
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === "string" ? text.trim() : null;
  } catch (e) {
    console.warn("[super-mario] summarizer call failed", e);
    return null;
  }
}