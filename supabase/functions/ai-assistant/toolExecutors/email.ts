/**
 * email.ts — Email classification, conversation context, and address rules.
 * Handles get_email_classifications, get_conversation_context, get_address_rules tools.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.39.3").createClient<any>>;

export async function executeGetEmailClassifications(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId?: string,
): Promise<unknown> {
  let q = supabase
    .from("email_classifications")
    .select(
      "id, email_address, category, confidence, ai_summary, sentiment, urgency, keywords, action_suggested, classified_at, partner_id",
    )
    .order("classified_at", { ascending: false })
    .limit(Math.min(Number(args.limit) || 20, 50));
  if (args.email_address) q = q.eq("email_address", args.email_address);
  if (args.partner_id) q = q.eq("partner_id", args.partner_id);
  if (args.category) q = q.eq("category", args.category);
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length, classifications: data };
}

export async function executeGetConversationContext(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId?: string,
): Promise<unknown> {
  let q = supabase
    .from("contact_conversation_context")
    .select("*")
    .eq("email_address", String(args.email_address));
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q.maybeSingle();
  if (error) return { error: error.message };
  if (!data) {
    return { message: "No conversation context found for this address." };
  }
  return data;
}

export async function executeGetAddressRules(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId?: string,
): Promise<unknown> {
  let q = supabase
    .from("email_address_rules")
    .select("*")
    .order("interaction_count", { ascending: false })
    .limit(Math.min(Number(args.limit) || 20, 50));
  if (args.email_address) q = q.eq("email_address", args.email_address);
  if (args.is_active !== undefined) q = q.eq("is_active", !!args.is_active);
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length, rules: data };
}
