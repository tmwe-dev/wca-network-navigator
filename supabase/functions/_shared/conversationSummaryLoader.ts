/**
 * conversationSummaryLoader.ts — SSOT per leggere il riassunto relazione contatto.
 *
 * Usato da TUTTI gli edge che iniettano contesto storico nei prompt AI.
 * Sostituisce la lettura grezza di N messaggi (che esplodeva i token) con:
 *   1. `conversation_summary` narrativo + `last_exchanges` sintetici, se esiste.
 *   2. Fallback a max 5 messaggi recenti compatti, solo se il summary manca
 *      (primo bootstrap del contatto).
 *
 * Non lancia mai: in errore restituisce { block: "", source: "none" }.
 */
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface ConversationSummaryResult {
  block: string;
  source: "summary" | "fallback-history" | "none";
  interactionCount: number;
}

interface LoadOpts {
  partnerId?: string | null;
  emailAddress?: string | null;
  fallbackLimit?: number; // default 5 (NON 30)
}

export async function loadConversationSummary(
  supabase: SupabaseClient,
  userId: string | null | undefined,
  opts: LoadOpts,
): Promise<ConversationSummaryResult> {
  const partnerId = opts.partnerId ?? null;
  const emailAddress = opts.emailAddress ?? null;
  const fallbackLimit = Math.max(1, Math.min(10, opts.fallbackLimit ?? 5));

  if (!userId || (!partnerId && !emailAddress)) {
    return { block: "", source: "none", interactionCount: 0 };
  }

  // 1) Prova summary persistente
  try {
    let q = supabase
      .from("contact_conversation_context")
      .select("conversation_summary, last_exchanges, interaction_count, dominant_sentiment, response_rate, avg_response_time_hours, preferred_language, last_interaction_at")
      .eq("user_id", userId);
    if (partnerId) q = q.eq("partner_id", partnerId);
    else if (emailAddress) q = q.eq("email_address", emailAddress);
    const { data: ctx } = await q.maybeSingle();

    if (ctx?.conversation_summary) {
      const exchanges = Array.isArray(ctx.last_exchanges) ? ctx.last_exchanges.slice(0, 5) : [];
      const lines: string[] = [];
      lines.push(`SUMMARY RELAZIONE (${ctx.interaction_count ?? 0} interazioni totali, ultimo contatto ${ctx.last_interaction_at ?? "n/a"}):`);
      lines.push(ctx.conversation_summary);
      if (exchanges.length) {
        lines.push("");
        lines.push("ULTIMI SCAMBI CHIAVE:");
        for (const ex of exchanges) {
          const e = ex as Record<string, unknown>;
          lines.push(`- [${e.date ?? "?"}|${e.channel ?? "?"}|${e.direction ?? "?"}] ${e.gist ?? ""}`);
        }
      }
      const meta: string[] = [];
      if (ctx.dominant_sentiment) meta.push(`sentiment:${ctx.dominant_sentiment}`);
      if (ctx.response_rate != null) meta.push(`response_rate:${Math.round(Number(ctx.response_rate) * 100)}%`);
      if (ctx.avg_response_time_hours != null) meta.push(`avg_resp:${Number(ctx.avg_response_time_hours).toFixed(1)}h`);
      if (ctx.preferred_language) meta.push(`lang:${ctx.preferred_language}`);
      if (meta.length) {
        lines.push("");
        lines.push(`METRICHE: ${meta.join(" | ")}`);
      }
      return {
        block: lines.join("\n"),
        source: "summary",
        interactionCount: ctx.interaction_count ?? 0,
      };
    }
  } catch (_) { /* fail-safe */ }

  // 2) Fallback: max 5 messaggi recenti (NON 30) per il primo bootstrap
  try {
    let q = supabase
      .from("channel_messages")
      .select("channel,direction,subject,body_text,created_at")
      .order("created_at", { ascending: false })
      .limit(fallbackLimit);
    if (partnerId) q = q.eq("partner_id", partnerId);
    else if (emailAddress) q = q.or(`from_address.eq.${emailAddress},to_address.eq.${emailAddress}`);
    const { data: history } = await q;
    if (Array.isArray(history) && history.length) {
      const lines: string[] = [
        `STORIA RELAZIONE (bootstrap, ${history.length} messaggi recenti — summary non ancora generato):`,
      ];
      for (const m of history as Array<{ channel: string; direction: string; subject: string | null; body_text: string | null; created_at: string }>) {
        const subj = (m.subject ?? "").slice(0, 80);
        const excerpt = (m.body_text ?? "").replace(/\s+/g, " ").slice(0, 140);
        lines.push(`- [${m.created_at.slice(0, 10)}|${m.channel}|${m.direction}] ${subj} :: ${excerpt}`);
      }
      return { block: lines.join("\n"), source: "fallback-history", interactionCount: history.length };
    }
  } catch (_) { /* fail-safe */ }

  return { block: "", source: "none", interactionCount: 0 };
}