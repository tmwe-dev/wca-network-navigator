/**
 * contactsHandler.ts - Contact/CRM-related tool handlers
 * Handles: search, detail, lead status updates
 */

import { supabase, escapeLike } from "./supabaseClient.ts";
import { applyLeadStatusChange } from "../leadStatusGuard.ts";

export async function handleSearchContacts(
  args: Record<string, unknown>
): Promise<unknown> {
  const isCount = !!args.count_only;
  let query = supabase.from("imported_contacts").select(
    isCount ? "id" : "id, name, company_name, email, phone, country, lead_status, created_at",
    isCount ? { count: "exact", head: true } : undefined
  );
  if (args.search_name)
    query = query.ilike("name", `%${escapeLike(String(args.search_name))}%`);
  if (args.company_name)
    query = query.ilike("company_name", `%${escapeLike(String(args.company_name))}%`);
  if (args.country) query = query.ilike("country", `%${escapeLike(String(args.country))}%`);
  if (args.email) query = query.ilike("email", `%${escapeLike(String(args.email))}%`);
  if (args.origin) query = query.eq("origin", args.origin);
  if (args.lead_status) query = query.eq("lead_status", args.lead_status);
  if (args.has_email === true) query = query.not("email", "is", null);
  query = query.or("company_name.not.is.null,name.not.is.null,email.not.is.null");
  query = query
    .order("created_at", { ascending: false })
    .limit(Math.min(Number(args.limit) || 20, 50));
  const { data, error, count } = await query;
  if (error) return { error: error.message };
  if (isCount) return { count };
  return { count: data?.length || 0, contacts: data || [] };
}

export async function handleGetContactDetail(
  args: Record<string, unknown>
): Promise<unknown> {
  let contact: Record<string, unknown> | null = null;
  if (args.contact_id) {
    const { data } = await supabase
      .from("imported_contacts")
      .select("*")
      .eq("id", args.contact_id as string)
      .single();
    contact = data as Record<string, unknown> | null;
  } else if (args.contact_name) {
    const { data } = await supabase
      .from("imported_contacts")
      .select("*")
      .ilike("name", `%${escapeLike(String(args.contact_name))}%`)
      .limit(1)
      .single();
    contact = data as Record<string, unknown> | null;
  }
  if (!contact) return { error: "Contatto non trovato" };
  return contact;
}

export async function handleUpdateLeadStatus(
  args: Record<string, unknown>,
  userId?: string
): Promise<unknown> {
  const status = String(args.status);
  if (args.contact_ids && Array.isArray(args.contact_ids)) {
    const contactIds = args.contact_ids as string[];
    let successCount = 0;
    let lastError: string | null = null;

    for (const contactId of contactIds) {
      const result = await applyLeadStatusChange(supabase, {
        table: "imported_contacts",
        recordId: contactId,
        newStatus: status,
        userId: userId || "unknown",
        actor: { type: "ai_agent", name: "platform-tools" },
        decisionOrigin: "ai_auto",
        trigger: "platform_tool_update",
      });

      if (!result.applied) {
        lastError = result.blockedReason || "Failed to update lead status";
      } else {
        successCount++;
      }
    }

    if (successCount === 0) {
      return { error: lastError || "Failed to update lead status" };
    }
    return { success: true, updated: successCount };
  }
  return { error: "Specificare contact_ids" };
}
