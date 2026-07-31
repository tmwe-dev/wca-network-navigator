/**
 * DAL — Email Classifications (Smart Inbox).
 * Estratto 1:1 da `SmartInboxView`: stesse tabelle, stessi select, filtri,
 * order/limit e semantica errori (list: throw; context: tollerante).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type EmailClassificationRow =
  Database["public"]["Tables"]["email_classifications"]["Row"] & {
    partners: { company_name: string } | null;
  };

/** Ultime 100 classificazioni, opzionalmente filtrate per categoria. */
export async function findEmailClassifications(
  categoryFilter: string,
): Promise<EmailClassificationRow[]> {
  let q = supabase
    .from("email_classifications")
    .select("*, partners(company_name)")
    .order("classified_at", { ascending: false })
    .limit(100);
  if (categoryFilter !== "all") q = q.eq("category", categoryFilter);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as EmailClassificationRow[];
}

/** Tutte le categorie (per i contatori di sidebar). */
export async function findEmailClassificationCategories(): Promise<Array<{ category: string }>> {
  const { data, error } = await supabase.from("email_classifications").select("category");
  if (error) throw error;
  return data ?? [];
}

/** Contesto conversazione per indirizzo email (può non esistere). */
export async function findConversationContextByEmail(
  emailAddress: string,
): Promise<Database["public"]["Tables"]["contact_conversation_context"]["Row"] | null> {
  const { data } = await supabase
    .from("contact_conversation_context")
    .select("*")
    .eq("email_address", emailAddress)
    .maybeSingle();
  return data ?? null;
}

export interface ClassificationApprovalInput {
  emailAddress: string;
  confidence: number | null;
  userId: string;
}

/** Registra l'approvazione umana di una classificazione. Ritorna l'errore, non lo lancia. */
export async function insertClassificationApproval(
  input: ClassificationApprovalInput,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from("ai_decision_log").insert({
    decision_type: "classify_email",
    email_address: input.emailAddress,
    user_review: "approved",
    confidence: input.confidence,
    user_id: input.userId,
  });
  return { error: error ? { message: error.message } : null };
}

/** Corregge la categoria di una classificazione. Ritorna l'errore, non lo lancia. */
export async function updateClassificationCategory(
  id: string,
  category: string,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase
    .from("email_classifications")
    .update({ category })
    .eq("id", id);
  return { error: error ? { message: error.message } : null };
}

/** Contesti conversazione ordinati per una colonna specifica (per profili sender). */
export async function findConversationContextsOrdered(
  orderColumn: "last_interaction_at" | "response_rate" | "interaction_count",
  limit: number,
): Promise<Database["public"]["Tables"]["contact_conversation_context"]["Row"][]> {
  const { data, error } = await supabase
    .from("contact_conversation_context")
    .select("*")
    .order(orderColumn, { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/**
 * Ultime 100 classificazioni (senza join partner), opzionalmente filtrate
 * per categoria. Usata da SmartClassificationView.
 */
export async function findEmailClassificationsPlain(
  categoryFilter: string,
): Promise<Database["public"]["Tables"]["email_classifications"]["Row"][]> {
  let q = supabase
    .from("email_classifications")
    .select("*")
    .order("classified_at", { ascending: false })
    .limit(100);
  if (categoryFilter !== "all") q = q.eq("category", categoryFilter);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as Database["public"]["Tables"]["email_classifications"]["Row"][];
}
