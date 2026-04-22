/**
 * partnersUpdateHandler.ts - Partner update and note tool handlers
 * Handles: update, add note, bulk update
 */

import { supabase, escapeLike } from "./supabaseClient.ts";

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
  args: Record<string, unknown>
): Promise<unknown> {
  const partner = await resolvePartnerId(args);
  if (!partner) return { error: "Partner non trovato" };
  const updates: Record<string, unknown> = {};
  if (args.is_favorite !== undefined) updates.is_favorite = args.is_favorite;
  if (args.lead_status) updates.lead_status = args.lead_status;
  if (args.rating !== undefined)
    updates.rating = Math.min(5, Math.max(0, Number(args.rating)));
  if (args.company_alias) updates.company_alias = args.company_alias;
  if (Object.keys(updates).length === 0) return { error: "Nessun campo da aggiornare" };
  updates.updated_at = new Date().toISOString();
  const { error } = await supabase.from("partners").update(updates).eq("id", partner.id);
  if (error) return { error: error.message };
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
  args: Record<string, unknown>
): Promise<unknown> {
  const updates: Record<string, unknown> = {};
  if (args.is_favorite !== undefined) updates.is_favorite = args.is_favorite;
  if (args.lead_status) updates.lead_status = args.lead_status;
  if (Object.keys(updates).length === 0) return { error: "Nessun aggiornamento" };
  updates.updated_at = new Date().toISOString();
  let query = supabase.from("partners").update(updates);
  if (args.partner_ids) query = query.in("id", args.partner_ids as string[]);
  else if (args.country_code)
    query = query.eq("country_code", String(args.country_code).toUpperCase());
  else return { error: "Specifica country_code o partner_ids" };
  const { error } = await query;
  if (error) return { error: error.message };
  return { success: true, message: "Partner aggiornati." };
}
