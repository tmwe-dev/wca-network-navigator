/**
 * DAL — ai_interaction_log + ai_message_feedback
 * Centralized logging of all AI interactions (text & voice) and quality feedback.
 */
import { supabase } from "@/integrations/supabase/client";

export type AiInteractionType =
  | "chat_text"
  | "voice_tts"
  | "voice_conversation"
  | "voice_stt"
  | "edge_ai";

export type AiInteractionRole = "user" | "assistant" | "system" | "tool";

export interface AiInteractionLogInput {
  interaction_type: AiInteractionType;
  role: AiInteractionRole;
  content: string;
  surface?: string | null;
  conversation_id?: string | null;
  agent_id?: string | null;
  model_id?: string | null;
  voice_id?: string | null;
  language?: string | null;
  duration_ms?: number | null;
  tokens_in?: number | null;
  tokens_out?: number | null;
  metadata?: Record<string, unknown>;
  page_context?: string | null;
}

export interface AiInteractionLogRow extends AiInteractionLogInput {
  id: string;
  user_id: string;
  operator_id: string | null;
  created_at: string;
}

/**
 * Best-effort: never throw. Logging must never break the user flow.
 */
export async function logAiInteraction(input: AiInteractionLogInput): Promise<string | null> {
  try {
    const { data: userData } = await supabase.auth.getSession();
    const userId = userData.session?.user?.id;
    if (!userId) return null;

    const payload = {
      user_id: userId,
      interaction_type: input.interaction_type,
      role: input.role,
      content: (input.content ?? "").slice(0, 50_000),
      surface: input.surface ?? null,
      conversation_id: input.conversation_id ?? null,
      agent_id: input.agent_id ?? null,
      model_id: input.model_id ?? null,
      voice_id: input.voice_id ?? null,
      language: input.language ?? null,
      duration_ms: input.duration_ms ?? null,
      tokens_in: input.tokens_in ?? null,
      tokens_out: input.tokens_out ?? null,
      metadata: input.metadata ?? {},
      page_context: input.page_context ?? (typeof window !== "undefined" ? window.location.pathname : null),
    };

    const { data, error } = await supabase
      .from("ai_interaction_log" as never)
      .insert(payload as never)
      .select("id")
      .maybeSingle();
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[aiInteractionLog] insert failed", error.message);
      return null;
    }
    return (data as { id: string } | null)?.id ?? null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[aiInteractionLog] threw", err);
    return null;
  }
}

export interface AiLogFilters {
  from?: string;
  to?: string;
  interaction_type?: AiInteractionType | "all";
  surface?: string | "all";
  search?: string;
  hasNegativeFeedback?: boolean;
  limit?: number;
}

export async function listAiInteractions(filters: AiLogFilters = {}): Promise<AiInteractionLogRow[]> {
  const limit = Math.min(filters.limit ?? 1000, 5000);
  let q = supabase
    .from("ai_interaction_log" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", filters.to);
  if (filters.interaction_type && filters.interaction_type !== "all") {
    q = q.eq("interaction_type", filters.interaction_type);
  }
  if (filters.surface && filters.surface !== "all") {
    q = q.eq("surface", filters.surface);
  }
  if (filters.search && filters.search.trim()) {
    q = q.ilike("content", `%${filters.search.trim()}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as AiInteractionLogRow[]) ?? [];
}

export interface AiFeedbackRow {
  id: string;
  interaction_id: string;
  user_id: string;
  rating: -1 | 1;
  note: string | null;
  created_at: string;
}

export async function listFeedbackForInteractions(ids: string[]): Promise<AiFeedbackRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("ai_message_feedback" as never)
    .select("*")
    .in("interaction_id", ids);
  if (error) throw error;
  return (data as unknown as AiFeedbackRow[]) ?? [];
}

export async function upsertFeedback(params: {
  interaction_id: string;
  rating: -1 | 1;
  note?: string;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getSession();
  const userId = userData.session?.user?.id;
  if (!userId) throw new Error("not authenticated");

  const { error } = await supabase
    .from("ai_message_feedback" as never)
    .upsert(
      {
        interaction_id: params.interaction_id,
        user_id: userId,
        rating: params.rating,
        note: params.note ?? null,
      } as never,
      { onConflict: "interaction_id,user_id" } as never,
    );
  if (error) throw error;
}

export async function deleteFeedback(interactionId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getSession();
  const userId = userData.session?.user?.id;
  if (!userId) return;
  const { error } = await supabase
    .from("ai_message_feedback" as never)
    .delete()
    .eq("interaction_id", interactionId)
    .eq("user_id", userId);
  if (error) throw error;
}