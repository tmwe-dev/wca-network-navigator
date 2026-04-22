import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeLike, resolvePartnerId } from "../shared.ts";

interface ActivityRow { id: string; title: string; status: string; activity_type: string; scheduled_at: string | null; due_date: string | null; source_meta: Record<string, unknown> | null; partner_id: string | null; description: string | null; created_at: string; }
interface SourceMetaRecord { company_name?: string; scheduled?: boolean; [key: string]: unknown; }

export async function handleUpdatePartner(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  const partner = await resolvePartnerId(args);
  if (!partner) return { error: "Partner non trovato" };
  const updates: Record<string, unknown> = {};
  if (args.is_favorite !== undefined) updates.is_favorite = args.is_favorite;
  if (args.lead_status) updates.lead_status = args.lead_status;
  if (args.rating !== undefined) updates.rating = Math.min(5, Math.max(0, Number(args.rating)));
  if (args.company_alias) updates.company_alias = args.company_alias;
  if (Object.keys(updates).length === 0) return { error: "Nessun campo da aggiornare" };
  updates.updated_at = new Date().toISOString();
  const { error } = await supabase.from("partners").update(updates).eq("id", partner.id);
  if (error) return { error: error.message };
  return { success: true, partner: partner.name, message: `Partner "${partner.name}" aggiornato.` };
}

export async function handleAddPartnerNote(
  supabase: SupabaseClient,
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

export async function handleCreateReminder(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const partner = await resolvePartnerId(args);
  if (!partner) return { error: "Partner non trovato" };
  const { error } = await supabase.from("reminders").insert({
    partner_id: partner.id,
    title: String(args.title),
    description: args.description ? String(args.description) : null,
    due_date: String(args.due_date),
    priority: String(args.priority || "medium"),
    user_id: userId,
  });
  if (error) return { error: error.message };
  return { success: true, message: `Reminder creato per "${partner.name}".` };
}

export async function handleCreateActivity(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  let partnerId = args.partner_id as string | null;
  let companyName = args.company_name as string || "";
  if (!partnerId && companyName) {
    const r = await resolvePartnerId(args);
    if (r) {
      partnerId = r.id;
      companyName = r.name;
    }
  }
  const { data, error } = await supabase.from("activities").insert({
    title: String(args.title),
    description: args.description ? String(args.description) : null,
    activity_type: String(args.activity_type),
    source_type: "partner",
    source_id: partnerId || crypto.randomUUID(),
    partner_id: partnerId,
    due_date: args.due_date ? String(args.due_date) : null,
    priority: String(args.priority || "medium"),
    source_meta: { company_name: companyName } as Record<string, unknown>,
    user_id: userId,
  }).select("id").single();
  if (error) return { error: error.message };
  return { success: true, activity_id: data.id, message: `Attività "${args.title}" creata.` };
}

export async function handleUpdateActivity(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  const updates: Record<string, unknown> = {};
  if (args.status) {
    updates.status = args.status;
    if (args.status === "completed") updates.completed_at = new Date().toISOString();
  }
  if (args.priority) updates.priority = args.priority;
  if (args.due_date) updates.due_date = args.due_date;
  const { error } = await supabase.from("activities").update(updates).eq("id", args.activity_id);
  if (error) return { error: error.message };
  return { success: true, message: "Attività aggiornata." };
}

export async function handleListActivities(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  let query = supabase.from("activities").select("id, title, activity_type, status, priority, due_date, partner_id, source_meta, created_at").order("due_date", { ascending: true, nullsFirst: false }).limit(Number(args.limit) || 30);
  if (args.status) query = query.eq("status", args.status);
  if (args.activity_type) query = query.eq("activity_type", args.activity_type);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return {
    count: data?.length || 0,
    activities: (data || []).map((a: ActivityRow) => ({
      ...a,
      company_name: (a.source_meta as SourceMetaRecord | null)?.company_name || null,
    })),
  };
}

export async function handleManagePartnerContact(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  const action = String(args.action);
  if (action === "delete" && args.contact_id) {
    const { error } = await supabase.from("partner_contacts").delete().eq("id", args.contact_id);
    return error ? { error: error.message } : { success: true, message: "Contatto eliminato." };
  }
  if (action === "update" && args.contact_id) {
    const updates: Record<string, unknown> = {};
    if (args.name) updates.name = args.name;
    if (args.title) updates.title = args.title;
    if (args.email) updates.email = args.email;
    if (args.direct_phone) updates.direct_phone = args.direct_phone;
    if (args.mobile) updates.mobile = args.mobile;
    const { error } = await supabase.from("partner_contacts").update(updates).eq("id", args.contact_id);
    return error ? { error: error.message } : { success: true, message: "Contatto aggiornato." };
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
    return error ? { error: error.message } : { success: true, message: `Contatto "${args.name}" aggiunto.` };
  }
  return { error: "Azione non valida" };
}

export async function handleUpdateReminder(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  if (args.delete) {
    const { error } = await supabase.from("reminders").delete().eq("id", args.reminder_id);
    return error ? { error: error.message } : { success: true };
  }
  const updates: Record<string, unknown> = {};
  if (args.status) updates.status = args.status;
  if (args.priority) updates.priority = args.priority;
  if (args.due_date) updates.due_date = args.due_date;
  const { error } = await supabase.from("reminders").update(updates).eq("id", args.reminder_id);
  return error ? { error: error.message } : { success: true };
}

export async function handleUpdateLeadStatus(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  const status = String(args.status);
  if (args.contact_ids && Array.isArray(args.contact_ids)) {
    const { error } = await supabase.from("imported_contacts").update({ lead_status: status }).in("id", args.contact_ids as string[]);
    if (error) return { error: error.message };
    return { success: true, updated: (args.contact_ids as string[]).length };
  }
  return { error: "Specificare contact_ids" };
}

export async function handleBulkUpdatePartners(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  const updates: Record<string, unknown> = {};
  if (args.is_favorite !== undefined) updates.is_favorite = args.is_favorite;
  if (args.lead_status) updates.lead_status = args.lead_status;
  if (Object.keys(updates).length === 0) return { error: "Nessun aggiornamento" };
  updates.updated_at = new Date().toISOString();
  let query = supabase.from("partners").update(updates);
  if (args.partner_ids) query = query.in("id", args.partner_ids as string[]);
  else if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
  else return { error: "Specifica country_code o partner_ids" };
  const { error } = await query;
  if (error) return { error: error.message };
  return { success: true, message: "Partner aggiornati." };
}

export async function handleDeleteRecords(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const table = String(args.table);
  const ids = args.ids as string[];
  const valid = ["partners", "prospects", "activities", "reminders"];
  if (!valid.includes(table)) return { error: `Tabella non valida: ${table}` };
  const { error } = await supabase.from(table as "partners" | "prospects" | "activities" | "reminders").delete().eq("user_id", userId).in("id", ids);
  return error ? { error: error.message } : { success: true, deleted: ids.length };
}

export async function handleGetEmailClassifications(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  let q = supabase.from("email_classifications").select("id, email_address, category, confidence, ai_summary, sentiment, urgency, keywords, action_suggested, classified_at, partner_id").eq("user_id", userId).order("classified_at", { ascending: false }).limit(Math.min(Number(args.limit) || 20, 50));
  if (args.email_address) q = q.eq("email_address", args.email_address);
  if (args.partner_id) q = q.eq("partner_id", args.partner_id);
  if (args.category) q = q.eq("category", args.category);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length, classifications: data };
}

export async function handleAssignContactsToAgent(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const { data: agents } = await supabase.from("agents").select("id, name").eq("user_id", userId).ilike("name", `%${escapeLike(args.agent_name as string)}%`).limit(1);
  if (!agents || agents.length === 0) return { error: `Agente "${args.agent_name}" non trovato.` };
  const targetAgent = agents[0];
  const sourceType = String(args.source_type || "partner");
  let contactIds: { id: string; name: string }[] = [];

  if (sourceType === "partner") {
    let pq = supabase.from("partners").select("id, company_name").limit(Number(args.limit) || 20);
    if (args.country_code) pq = pq.eq("country_code", String(args.country_code).toUpperCase());
    if (args.lead_status) pq = pq.eq("lead_status", args.lead_status);
    const { data } = await pq;
    contactIds = (data || []).map((p: Record<string, unknown>) => ({ id: p.id, name: p.company_name }));
  } else {
    let cq = supabase.from("imported_contacts").select("id, name, company_name").limit(Number(args.limit) || 20);
    if (args.lead_status) cq = cq.eq("lead_status", args.lead_status);
    const { data } = await cq;
    contactIds = (data || []).map((c: { id: string; company_name: string | null; name: string | null }) => ({ id: c.id, name: c.company_name || c.name || "—" }));
  }

  if (contactIds.length === 0) return { error: "Nessun contatto trovato con i filtri specificati." };
  const assignments = contactIds.map((c) => ({ agent_id: targetAgent.id, source_type: sourceType, source_id: c.id, user_id: userId }));
  const { error } = await supabase.from("client_assignments").insert(assignments);
  if (error) return { error: error.message };
  return {
    success: true,
    agent_name: targetAgent.name,
    assigned_count: contactIds.length,
    contacts: contactIds.slice(0, 10).map((c) => c.name),
    message: `${contactIds.length} contatti assegnati a ${targetAgent.name}.`,
  };
}
