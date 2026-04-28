/**
 * contextLoaders.ts — Context data loaders for AI assistant.
 *
 * Loads:
 * - User profile from app_settings
 * - Mission history
 * - Knowledge base entries
 * - Operative prompts
 * - System doctrine
 */

import { extractErrorMessage } from "../_shared/handleEdgeError.ts";
import { loadOperativePrompts as loadOperativePromptsUnified, type PromptScope } from "../_shared/operativePromptsLoader.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export async function loadUserProfile(supabase: SupabaseClient, userId: string): Promise<string> {
  if (!userId) return "";
  const query = supabase.from("app_settings").select("key, value").like("key", "ai_%").eq("user_id", userId);
  const { data } = await query;
  if (!data?.length) return "";

  const settings: Record<string, string> = {};
  for (const row of data as Record<string, unknown>[]) settings[row.key as string] = (row.value as string) || "";

  const parts: string[] = [];
  const get = (k: string) => settings[k]?.trim() || "";

  if (get("ai_current_focus")) parts.push(`🎯 FOCUS CORRENTE: ${get("ai_current_focus")}`);
  if (get("ai_company_name") || get("ai_company_alias")) parts.push(`AZIENDA: ${get("ai_company_name")} (${get("ai_company_alias")})`);
  if (get("ai_contact_name") || get("ai_contact_alias")) parts.push(`REFERENTE: ${get("ai_contact_name")} (${get("ai_contact_alias")}) — ${get("ai_contact_role")}`);
  if (get("ai_sector")) parts.push(`SETTORE: ${get("ai_sector")}`);
  if (get("ai_networks")) parts.push(`NETWORK: ${get("ai_networks")}`);
  if (get("ai_company_activities")) parts.push(`ATTIVITÀ: ${get("ai_company_activities")}`);
  if (get("ai_business_goals")) parts.push(`OBIETTIVI ATTUALI: ${get("ai_business_goals")}`);
  if (get("ai_tone")) parts.push(`TONO: ${get("ai_tone")}`);
  if (get("ai_language")) parts.push(`LINGUA: ${get("ai_language")}`);
  if (get("ai_behavior_rules")) parts.push(`REGOLE COMPORTAMENTALI:\n${get("ai_behavior_rules")}`);
  if (get("ai_style_instructions")) parts.push(`ISTRUZIONI STILE: ${get("ai_style_instructions")}`);
  if (get("ai_sector_notes")) parts.push(`NOTE SETTORE: ${get("ai_sector_notes")}`);

  if (parts.length === 0) return "";
  return `\n\nPROFILO UTENTE E AZIENDA:\n${parts.join("\n")}`;
}

export async function loadMissionHistory(supabase: SupabaseClient, userId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from("outreach_missions")
      .select("title, status, channel, total_contacts, processed_contacts, target_filters, ai_summary, created_at, completed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (!data?.length) return "";
    let block = "\n\n--- STORICO MISSIONI RECENTI ---\n";
    for (const m of data as Record<string, unknown>[]) {
      const filters = m.target_filters as Record<string, unknown> | null;
      const countries = Array.isArray(filters?.countries) ? (filters.countries as string[]).join(", ") : "N/D";
      const progress = `${m.processed_contacts}/${m.total_contacts}`;
      block += `- "${m.title}" [${m.status}] — ${m.channel} — Paesi: ${countries} — Progresso: ${progress}`;
      if (m.ai_summary) block += ` — Riepilogo: ${String(m.ai_summary).substring(0, 100)}`;
      block += `\n`;
    }
    return block;
  } catch (e: unknown) {
    console.warn("loadMissionHistory failed:", extractErrorMessage(e));
    return "";
  }
}

export async function loadSystemDoctrine(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from("kb_entries")
    .select("title, content, tags, priority")
    .eq("category", "system_doctrine")
    .eq("is_active", true)
    .is("user_id", null)
    .order("priority", { ascending: false })
    .limit(10);

  if (!data?.length) return "";

  const entries = (data as Record<string, unknown>[]).map(e =>
    `### ${e.title}\n${e.content}`
  ).join("\n\n");

  return `\n\nDOTTRINA OPERATIVA (Knowledge Base Sistema):\n${entries}`;
}

/**
 * Load operative prompts via the SHARED loader so that the same context+tag
 * matching logic used by generate-email is applied here.
 *
 * The optional `scope` argument lets callers narrow the match (e.g. cockpit
 * vs strategic). When omitted, defaults to "general" which still resolves
 * universal/post-send prompts and OBBLIGATORIA rules tagged broadly.
 */
export async function loadOperativePrompts(
  supabase: SupabaseClient,
  userId: string,
  scope: PromptScope = "general",
): Promise<string> {
  const { block } = await loadOperativePromptsUnified(supabase, userId, {
    scope,
    includeUniversal: true,
    limit: 6,
  });
  return block ? `\n\n${block}` : "";
}
