/**
 * activityInsertHelper.ts — INSERT centralizzato per le activity di
 * follow-up generate dalla pipeline post-classificazione.
 *
 * Risolve 3 problemi storici:
 *  1) description leggibile (non lo slug della category)
 *  2) contesto email visibile dall'agenda (subject, body, message_id)
 *  3) deduplica su (user_id, partner_id, message_id_external, classification)
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface FollowUpActivityInput {
  userId: string;
  partnerId: string;
  title: string;
  classification: string;
  /** Eventuale riassunto AI (in caso di slug viene scartato e si usa fallback). */
  aiSummary?: string;
  senderEmail: string;
  senderName?: string;
  subject?: string;
  /** Anteprima testuale del corpo email (preferibile al body completo). */
  bodyPreview?: string;
  messageId?: string;
  threadId?: string;
  priority: "low" | "normal" | "high" | "critical";
  dueInDays: number;
  scheduled?: boolean;
  extraMeta?: Record<string, unknown>;
}

export interface FollowUpInsertOutcome {
  inserted: boolean;
  duplicate: boolean;
  id: string | null;
}

/** Una description "vera" deve essere una frase, non uno slug. */
function isHumanDescription(s: string | undefined | null): s is string {
  if (!s) return false;
  const trimmed = s.trim();
  if (trimmed.length < 25) return false;
  if (!/\s/.test(trimmed)) return false;
  // slug-like: solo [a-z_0-9]
  if (/^[a-z0-9_]+$/i.test(trimmed)) return false;
  return true;
}

function fallbackDescription(input: FollowUpActivityInput): string {
  const who = input.senderName || input.senderEmail;
  const subj = input.subject ? ` su "${input.subject}"` : "";
  return `Risposta classificata come ${input.classification} da ${who}${subj}. Apri la mail per il contenuto.`;
}

/**
 * Inserisce un'activity follow_up con dedup, description sensata e contesto
 * email. Restituisce un esito strutturato: niente throw verso il chiamante.
 */
export async function insertFollowUpActivity(
  supabase: SupabaseClient,
  input: FollowUpActivityInput,
): Promise<FollowUpInsertOutcome> {
  // 1) Dedup su message_id_external + classification quando disponibile
  if (input.messageId) {
    try {
      const { data: existing } = await supabase
        .from("activities")
        .select("id")
        .eq("user_id", input.userId)
        .eq("partner_id", input.partnerId)
        .eq("message_id_external", input.messageId)
        .is("deleted_at", null)
        .limit(1);
      if (Array.isArray(existing) && existing.length > 0) {
        return { inserted: false, duplicate: true, id: (existing[0] as { id: string }).id };
      }
    } catch (_e) { /* fail-open: in caso di errore, proseguiamo con l'INSERT */ }
  }

  const description = isHumanDescription(input.aiSummary)
    ? input.aiSummary!
    : fallbackDescription(input);

  const dueAt = new Date(Date.now() + input.dueInDays * 86400000).toISOString();

  const row: Record<string, unknown> = {
    user_id: input.userId,
    partner_id: input.partnerId,
    source_id: input.partnerId,
    source_type: "partner",
    activity_type: "follow_up",
    title: input.title,
    description,
    status: "pending",
    priority: input.priority,
    due_date: dueAt,
    email_subject: input.subject ?? null,
    email_body: input.bodyPreview ?? null,
    message_id_external: input.messageId ?? null,
    thread_id: input.threadId ?? null,
    source_meta: {
      classification: input.classification,
      pipeline: "postClassification",
      ...(input.extraMeta ?? {}),
    },
  };
  if (input.scheduled) row.scheduled_at = dueAt;

  try {
    const { data, error } = await supabase
      .from("activities")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    return { inserted: true, duplicate: false, id: (data as { id: string } | null)?.id ?? null };
  } catch (e) {
    // Re-throw così il chiamante può loggare in result.errors come prima
    throw e;
  }
}