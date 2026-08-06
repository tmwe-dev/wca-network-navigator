/**
 * DAL — contatori header di Email Intelligence.
 * Estratto 1:1 da `EmailIntelligencePage`: stessi select, filtri e head-count.
 */
import { supabase } from "@/integrations/supabase/client";

/** Indirizzi senza gruppo (solo `email_address`, intersecati client-side con l'allowlist). */
export async function findUncategorizedAddresses(): Promise<Array<{ email_address: string }>> {
  const { data } = await supabase.from("email_address_rules").select("email_address").is("group_id", null);
  return (data ?? []) as Array<{ email_address: string }>;
}

/** Indirizzi con suggerimento AI pendente (non accettato né rifiutato). */
export async function findPendingAiSuggestionAddresses(): Promise<Array<{ email_address: string }>> {
  const { data } = await supabase
    .from("email_address_rules")
    .select("email_address")
    .is("group_id", null)
    .not("ai_suggested_group", "is", null)
    .is("ai_suggestion_accepted", null);
  return (data ?? []) as Array<{ email_address: string }>;
}

/** Classificazioni odierne: pipeline legacy + Funnemail. */
export async function countClassificationsSince(isoDate: string): Promise<number> {
  const [legacy, funnemail] = await Promise.all([
    supabase.from("email_classifications").select("id", { count: "exact", head: true }).gte("classified_at", isoDate),
    supabase.from("funnemail_decisions").select("id", { count: "exact", head: true }).gte("created_at", isoDate),
  ]);
  return (legacy.count ?? 0) + (funnemail.count ?? 0);
}

/** Numero di regole indirizzo attive. */
export async function countActiveAddressRules(): Promise<number> {
  const { count } = await supabase
    .from("email_address_rules")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  return count ?? 0;
}
