/**
 * contactManagementHandler.ts - Partner contact management tool handlers
 * Handles: add, update, delete partner contacts
 */

import { supabase } from "./supabaseClient.ts";

async function resolvePartnerId(
  args: Record<string, unknown>
): Promise<{ id: string; name: string } | null> {
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
      .ilike("company_name", `%${String(args.company_name)}%`)
      .limit(1)
      .single();
    if (data) return { id: data.id, name: data.company_name };
  }
  return null;
}

export async function handleManagePartnerContact(
  args: Record<string, unknown>
): Promise<unknown> {
  const action = String(args.action);
  if (action === "delete" && args.contact_id) {
    const { error } = await supabase.from("partner_contacts").delete().eq("id", args.contact_id);
    return error
      ? { error: error.message }
      : { success: true, message: "Contatto eliminato." };
  }
  if (action === "update" && args.contact_id) {
    const updates: Record<string, unknown> = {};
    if (args.name) updates.name = args.name;
    if (args.title) updates.title = args.title;
    if (args.email) updates.email = args.email;
    if (args.direct_phone) updates.direct_phone = args.direct_phone;
    if (args.mobile) updates.mobile = args.mobile;
    const { error } = await supabase
      .from("partner_contacts")
      .update(updates)
      .eq("id", args.contact_id);
    return error
      ? { error: error.message }
      : { success: true, message: "Contatto aggiornato." };
  }
  if (action === "add") {
    let pid = args.partner_id as string;
    if (!pid && args.company_name) {
      const r = await resolvePartnerId(args);
      if (r) pid = r.id;
    }
    if (!pid) return { error: "Partner non trovato" };
    const { error } = await supabase.from("partner_contacts").insert({
      partner_id: pid,
      name: String(args.name),
      title: args.title ? String(args.title) : null,
      email: args.email ? String(args.email) : null,
    });
    return error
      ? { error: error.message }
      : { success: true, message: `Contatto "${args.name}" aggiunto.` };
  }
  return { error: "Azione non valida" };
}
