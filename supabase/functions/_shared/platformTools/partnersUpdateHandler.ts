/**
 * partnersUpdateHandler.ts - Partner update and note tool handlers
 * Handles: update, add note, bulk update
 */

import { supabase, escapeLike } from "./supabaseClient.ts";
import { applyLeadStatusChange } from "../leadStatusGuard.ts";

interface ResolvedPartner {
  id: string;
  name: string;
}

async function resolvePartnerId(
  args: Record<string, unknown>
): Promise<ResolvedPartner | null> {
  if (args.partner_id) {
    const { data } = await supabase
      .from("partners")
      .select("id, company_name")
      .eq("id", args.partner_id as string)
      .single();
    if (data) return { id: data.id, name: data.company_name };
  }
  if (args.company_name) {
    const { data } = await supabase
      .from("partners")
      .select("id, company_name")
      .ilike("company_name", `%${escapeLike(String(args.company_name))}%`)
      .limit(1)
      .single();
    if (data) return { id: data.id, name: data.company_name };
  }
  return null;
}

export async function handleUpdatePartner(
  args: Record<string, unknown>,
  userId?: string
): Promise<unknown> {
  const partner = await resolvePartnerId(args);
  if (!partner) return { error: "Partner non trovato" };
  const updates: Record<string, unknown> = {};
  let leadStatusChange: string | null = null;
  if (args.is_favorite !== undefined) updates.is_favorite = args.is_favorite;
  if (args.lead_status) leadStatusChange = args.lead_status as string;
  if (args.rating !== undefined)
    updates.rating = Math.min(5, Math.max(0, Number(args.rating)));
  if (args.company_alias) updates.company_alias = args.company_alias;
  if (Object.keys(updates).length === 0 && !leadStatusChange) return { error: "Nessun campo da aggiornare" };
  updates.updated_at = new Date().toISOString();

  if (leadStatusChange) {
    const statusResult = await applyLeadStatusChange(supabase, {
      table: "partners",
      recordId: partner.id,
      newStatus: leadStatusChange,
      userId: userId || "unknown",
      actor: { type: "ai_agent", name: "platform-tools" },
      decisionOrigin: "ai_auto",
      trigger: "platform_tool_update",
    });
    if (statusResult.error) return { error: statusResult.error };
  }

  if (Object.keys(updates).length > 1) {
    const { error } = await supabase.from("partners").update(updates).eq("id", partner.id);
    if (error) return { error: error.message };
  }
  return {
    success: true,
    partner: partner.name,
    message: `Partner "${partner.name}" aggiornato.`,
  };
}

export async function handleAddPartnerNote(
  args: Record<string, unknown>
): Promise<unknown> {
  const partner = await resolvePartnerId(args);
  if (!partner) return { error: "Partner non trovato" };
  const { error } = await supabase.from("interactions").insert({
    partner_id: partner.id,
    interaction_type: String(args.interaction_type || "note"),
    subject: String(args.subject),
    notes: args.notes ? String(args.notes) : null,
  });
  if (error) return { error: error.message };
  return { success: true, message: `Nota aggiunta a "${partner.name}".` };
}

export async function handleBulkUpdatePartners(
  args: Record<string, unknown>,
  userId?: string
): Promise<unknown> {
  const updates: Record<string, unknown> = {};
  let leadStatusChange: string | null = null;
  if (args.is_favorite !== undefined) updates.is_favorite = args.is_favorite;
  if (args.lead_status) leadStatusChange = args.lead_status as string;
  if (Object.keys(updates).length === 0 && !leadStatusChange) return { error: "Nessun aggiornamento" };
  updates.updated_at = new Date().toISOString();

  let partnerIds: string[] = [];
  if (args.partner_ids) {
    partnerIds = args.partner_ids as string[];
  } else if (args.country_code) {
    const { data, error: fetchError } = await supabase
      .from("partners")
      .select("id")
      .eq("country_code", String(args.country_code).toUpperCase());
    if (fetchError) return { error: fetchError.message };
    partnerIds = (data || []).map((p) => p.id);
  } else {
    return { error: "Specifica country_code o partner_ids" };
  }

  if (leadStatusChange) {
    for (const partnerId of partnerIds) {
      const statusResult = await applyLeadStatusChange(supabase, {
        table: "partners",
        recordId: partnerId,
        newStatus: leadStatusChange,
        userId: userId || "unknown",
        actor: { type: "ai_agent", name: "platform-tools" },
        decisionOrigin: "ai_auto",
        trigger: "platform_tool_update",
      });
      if (statusResult.error) return { error: statusResult.error };
    }
  }

  if (Object.keys(updates).length > 1) {
    let query = supabase.from("partners").update(updates).in("id", partnerIds);
    const { error } = await query;
    if (error) return { error: error.message };
  }
  return { success: true, message: "Partner aggiornati." };
}
