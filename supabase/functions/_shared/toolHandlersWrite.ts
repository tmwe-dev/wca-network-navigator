/**
 * Write/mutation tool handlers for AI assistants.
 * Extracted from ai-assistant/index.ts for maintainability.
 * Vol. I §5 — Guardrails: ogni modulo ha un unico scopo.
 */

import { escapeLike } from "./sqlEscape.ts";

type SupabaseClient = ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.39.3").createClient>;

export function createWriteHandlers(supabase: SupabaseClient) {

  async function resolvePartnerId(args: Record<string, unknown>): Promise<{ id: string; name: string } | null> {
    if (args.partner_id) {
      const { data } = await supabase.from("partners").select("id, company_name").eq("id", args.partner_id).single();
      return data ? { id: data.id, name: data.company_name } : null;
    }
    if (args.company_name) {
      const { data } = await supabase.from("partners").select("id, company_name").ilike("company_name", `%${escapeLike(args.company_name)}%`).limit(1).single();
      return data ? { id: data.id, name: data.company_name } : null;
    }
    return null;
  }

  async function executeUpdatePartner(args: Record<string, unknown>) {
    const partner = await resolvePartnerId(args);
    if (!partner) return { error: "Partner non trovato" };
    const updates: Record<string, unknown> = {};
    const changes: string[] = [];
    if (args.is_favorite !== undefined) { updates.is_favorite = args.is_favorite; changes.push(`preferito: ${args.is_favorite ? "sì" : "no"}`); }
    if (args.lead_status) { updates.lead_status = args.lead_status; changes.push(`lead status: ${args.lead_status}`); }
    if (args.rating !== undefined) { updates.rating = Math.min(5, Math.max(0, Number(args.rating))); changes.push(`rating: ${updates.rating}`); }
    if (args.company_alias) { updates.company_alias = args.company_alias; changes.push(`alias: ${args.company_alias}`); }
    if (Object.keys(updates).length === 0) return { error: "Nessun campo da aggiornare specificato" };
    updates.updated_at = new Date().toISOString();
    const { error } = await supabase.from("partners").update(updates).eq("id", partner.id);
    if (error) return { error: error.message };
    return { success: true, partner_id: partner.id, company_name: partner.name, changes, message: `Partner "${partner.name}" aggiornato: ${changes.join(", ")}` };
  }

  async function executeAddPartnerNote(args: Record<string, unknown>) {
    const partner = await resolvePartnerId(args);
    if (!partner) return { error: "Partner non trovato" };
    const { error } = await supabase.from("interactions").insert({
      partner_id: partner.id,
      interaction_type: String(args.interaction_type || "note"),
      subject: String(args.subject),
      notes: args.notes ? String(args.notes) : null,
    });
    if (error) return { error: error.message };
    return { success: true, partner_id: partner.id, company_name: partner.name, message: `Nota aggiunta a "${partner.name}": ${args.subject}` };
  }

  async function executeCreateReminder(args: Record<string, unknown>) {
    const partner = await resolvePartnerId(args);
    if (!partner) return { error: "Partner non trovato. Specifica partner_id o company_name." };
    const { error } = await supabase.from("reminders").insert({
      partner_id: partner.id, title: String(args.title),
      description: args.description ? String(args.description) : null,
      due_date: String(args.due_date), priority: String(args.priority || "medium"),
    });
    if (error) return { error: error.message };
    return { success: true, partner_id: partner.id, company_name: partner.name, due_date: args.due_date, priority: args.priority || "medium", message: `Reminder creato per "${partner.name}": "${args.title}" (scadenza: ${args.due_date})` };
  }

  async function executeUpdateLeadStatus(args: Record<string, unknown>) {
    const status = String(args.status);
    if (args.contact_ids && Array.isArray(args.contact_ids) && args.contact_ids.length > 0) {
      const ids = args.contact_ids as string[];
      const updates: Record<string, unknown> = { lead_status: status };
      if (status === "converted") updates.converted_at = new Date().toISOString();
      const { error, count } = await supabase.from("imported_contacts").update(updates).in("id", ids);
      if (error) return { error: error.message };
      return { success: true, updated_count: count || ids.length, status, message: `${count || ids.length} contatti aggiornati a "${status}"` };
    }
    let query = supabase.from("imported_contacts").select("id", { count: "exact" });
    if (args.company_name) query = query.ilike("company_name", `%${escapeLike(args.company_name)}%`);
    if (args.country) query = query.ilike("country", `%${escapeLike(args.country)}%`);
    const { data: matches, count } = await query.limit(200);
    if (!matches || matches.length === 0) return { error: "Nessun contatto trovato con i filtri specificati" };
    if (matches.length > 5) return { needs_confirmation: true, count: count || matches.length, status, message: `Trovati ${count || matches.length} contatti. Confermi l'aggiornamento a "${status}"?` };
    const ids = matches.map((c: any) => c.id);
    const updates: Record<string, unknown> = { lead_status: status };
    if (status === "converted") updates.converted_at = new Date().toISOString();
    const { error } = await supabase.from("imported_contacts").update(updates).in("id", ids);
    if (error) return { error: error.message };
    return { success: true, updated_count: ids.length, status, message: `${ids.length} contatti aggiornati a "${status}"` };
  }

  async function executeBulkUpdatePartners(args: Record<string, unknown>) {
    const updates: Record<string, unknown> = {};
    const changes: string[] = [];
    if (args.is_favorite !== undefined) { updates.is_favorite = args.is_favorite; changes.push(`preferito: ${args.is_favorite ? "sì" : "no"}`); }
    if (args.lead_status) { updates.lead_status = args.lead_status; changes.push(`lead status: ${args.lead_status}`); }
    if (Object.keys(updates).length === 0) return { error: "Nessun aggiornamento specificato" };
    updates.updated_at = new Date().toISOString();
    let countQuery = supabase.from("partners").select("id", { count: "exact", head: true });
    if (args.partner_ids && Array.isArray(args.partner_ids)) countQuery = countQuery.in("id", args.partner_ids as string[]);
    else if (args.country_code) countQuery = countQuery.eq("country_code", String(args.country_code).toUpperCase());
    else return { error: "Specifica country_code o partner_ids" };
    const { count } = await countQuery;
    if (!count || count === 0) return { error: "Nessun partner trovato" };
    if (count > 5) return { needs_confirmation: true, count, changes, message: `Trovati ${count} partner. Confermi l'aggiornamento: ${changes.join(", ")}?` };
    let updateQuery = supabase.from("partners").update(updates);
    if (args.partner_ids && Array.isArray(args.partner_ids)) updateQuery = updateQuery.in("id", args.partner_ids as string[]);
    else if (args.country_code) updateQuery = updateQuery.eq("country_code", String(args.country_code).toUpperCase());
    const { error } = await updateQuery;
    if (error) return { error: error.message };
    return { success: true, updated_count: count, changes, message: `${count} partner aggiornati: ${changes.join(", ")}` };
  }

  async function executeLinkBusinessCard(args: Record<string, unknown>) {
    const updates: Record<string, unknown> = { match_status: "manual", match_confidence: 100 };
    if (args.partner_id) updates.matched_partner_id = args.partner_id;
    if (args.contact_id) updates.matched_contact_id = args.contact_id;
    const { error } = await supabase.from("business_cards").update(updates).eq("id", args.card_id);
    if (error) return { error: error.message };
    return { success: true, card_id: args.card_id, message: "Biglietto da visita collegato manualmente." };
  }

  async function executeCreateActivity(args: Record<string, unknown>) {
    let partnerId = args.partner_id as string | null;
    let companyName = args.company_name as string || "";
    if (!partnerId && companyName) {
      const resolved = await resolvePartnerId(args);
      if (resolved) { partnerId = resolved.id; companyName = resolved.name; }
    }
    const sourceType = String(args.source_type || "partner");
    const sourceId = partnerId || crypto.randomUUID();
    const { data, error } = await supabase.from("activities").insert({
      title: String(args.title), description: args.description ? String(args.description) : null,
      activity_type: String(args.activity_type), source_type: sourceType, source_id: sourceId,
      partner_id: partnerId, due_date: args.due_date ? String(args.due_date) : null,
      priority: String(args.priority || "medium"),
      email_subject: args.email_subject ? String(args.email_subject) : null,
      email_body: args.email_body ? String(args.email_body) : null,
      source_meta: { company_name: companyName } as any,
    }).select("id").single();
    if (error) return { error: error.message };
    return { success: true, activity_id: data.id, message: `Attività "${args.title}" creata${companyName ? ` per ${companyName}` : ""}.` };
  }

  async function executeUpdateActivity(args: Record<string, unknown>) {
    const updates: Record<string, unknown> = {};
    if (args.status) { updates.status = args.status; if (args.status === "completed") updates.completed_at = new Date().toISOString(); }
    if (args.priority) updates.priority = args.priority;
    if (args.due_date) updates.due_date = args.due_date;
    if (Object.keys(updates).length === 0) return { error: "Nessun campo da aggiornare" };
    const { error } = await supabase.from("activities").update(updates).eq("id", args.activity_id);
    if (error) return { error: error.message };
    return { success: true, activity_id: args.activity_id, message: `Attività aggiornata.` };
  }

  async function executeManagePartnerContact(args: Record<string, unknown>) {
    const action = String(args.action);
    if (action === "delete" && args.contact_id) {
      const { error } = await supabase.from("partner_contacts").delete().eq("id", args.contact_id);
      if (error) return { error: error.message };
      return { success: true, message: "Contatto eliminato." };
    }
    if (action === "update" && args.contact_id) {
      const updates: Record<string, unknown> = {};
      if (args.name) updates.name = args.name;
      if (args.title) updates.title = args.title;
      if (args.email) updates.email = args.email;
      if (args.direct_phone) updates.direct_phone = args.direct_phone;
      if (args.mobile) updates.mobile = args.mobile;
      if (args.is_primary !== undefined) updates.is_primary = args.is_primary;
      const { error } = await supabase.from("partner_contacts").update(updates).eq("id", args.contact_id);
      if (error) return { error: error.message };
      return { success: true, message: "Contatto aggiornato." };
    }
    if (action === "add") {
      let partnerId = args.partner_id as string;
      if (!partnerId && args.company_name) {
        const resolved = await resolvePartnerId(args);
        if (resolved) partnerId = resolved.id;
      }
      if (!partnerId) return { error: "Partner non trovato" };
      if (!args.name) return { error: "Il nome del contatto è obbligatorio" };
      const { data, error } = await supabase.from("partner_contacts").insert({
        partner_id: partnerId, name: String(args.name), title: args.title ? String(args.title) : null,
        email: args.email ? String(args.email) : null, direct_phone: args.direct_phone ? String(args.direct_phone) : null,
        mobile: args.mobile ? String(args.mobile) : null, is_primary: !!args.is_primary,
      }).select("id").single();
      if (error) return { error: error.message };
      return { success: true, contact_id: data.id, message: `Contatto "${args.name}" aggiunto.` };
    }
    return { error: "Azione non valida" };
  }

  async function executeUpdateReminder(args: Record<string, unknown>) {
    if (args.delete) {
      const { error } = await supabase.from("reminders").delete().eq("id", args.reminder_id);
      if (error) return { error: error.message };
      return { success: true, message: "Reminder eliminato." };
    }
    const updates: Record<string, unknown> = {};
    if (args.status) updates.status = args.status;
    if (args.priority) updates.priority = args.priority;
    if (args.due_date) updates.due_date = args.due_date;
    updates.updated_at = new Date().toISOString();
    const { error } = await supabase.from("reminders").update(updates).eq("id", args.reminder_id);
    if (error) return { error: error.message };
    return { success: true, message: "Reminder aggiornato." };
  }

  async function executeDeleteRecords(args: Record<string, unknown>) {
    const table = String(args.table);
    const ids = args.ids as string[];
    if (!ids || ids.length === 0) return { error: "Nessun ID specificato" };
    if (ids.length > 5) return { needs_confirmation: true, count: ids.length, table, message: `Stai per eliminare ${ids.length} record da "${table}". Confermi?` };
    const validTables = ["partners", "imported_contacts", "prospects", "activities", "reminders"];
    if (!validTables.includes(table)) return { error: `Tabella non valida: ${table}` };
    const { error } = await supabase.from(table as any).delete().in("id", ids);
    if (error) return { error: error.message };
    return { success: true, deleted: ids.length, table, message: `${ids.length} record eliminati da "${table}".` };
  }

  // Proxy tools that call other edge functions
  async function executeGenerateOutreach(args: Record<string, unknown>, authHeader: string) {
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-outreach`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify(args),
    });
    const data = await response.json();
    if (!response.ok || data.error) return { error: data.error || "Errore generazione outreach" };
    return { success: true, channel: data.channel, subject: data.subject, body: data.body, language: data.language, message: `Messaggio ${args.channel} generato per ${args.contact_name} (${args.company_name}).` };
  }

  async function executeSendEmail(args: Record<string, unknown>, authHeader: string) {
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ to: args.to_email, toName: args.to_name, subject: args.subject, html: args.html_body }),
    });
    const data = await response.json();
    if (!response.ok || data.error) return { error: data.error || "Errore invio email" };
    if (args.partner_id) {
      await supabase.from("interactions").insert({ partner_id: args.partner_id, interaction_type: "email", subject: String(args.subject), notes: `Inviata a ${args.to_email}` });
    }
    return { success: true, message: `Email inviata a ${args.to_email} con oggetto "${args.subject}".` };
  }

  async function executeDeepSearchPartner(args: Record<string, unknown>, authHeader: string) {
    let partnerId = args.partner_id as string;
    if (!partnerId && args.company_name) { const resolved = await resolvePartnerId(args); if (resolved) partnerId = resolved.id; }
    if (!partnerId) return { error: "Partner non trovato" };
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/deep-search-partner`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ partner_id: partnerId, force: !!args.force }),
    });
    const data = await response.json();
    if (!response.ok || data.error) return { error: data.error || "Errore Deep Search" };
    return { success: true, partner_id: partnerId, ...data, message: `Deep Search completato per il partner.` };
  }

  async function executeDeepSearchContact(args: Record<string, unknown>, authHeader: string) {
    let contactId = args.contact_id as string;
    if (!contactId && args.contact_name) {
      const { data } = await supabase.from("imported_contacts").select("id").ilike("name", `%${escapeLike(args.contact_name)}%`).limit(1).single();
      if (data) contactId = data.id;
    }
    if (!contactId) return { error: "Contatto non trovato" };
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/deep-search-contact`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ contact_id: contactId }),
    });
    const data = await response.json();
    if (!response.ok || data.error) return { error: data.error || "Errore Deep Search contatto" };
    return { success: true, contact_id: contactId, ...data, message: `Deep Search completato per il contatto.` };
  }

  async function executeEnrichPartnerWebsite(args: Record<string, unknown>, authHeader: string) {
    let partnerId = args.partner_id as string;
    if (!partnerId && args.company_name) { const resolved = await resolvePartnerId(args); if (resolved) partnerId = resolved.id; }
    if (!partnerId) return { error: "Partner non trovato" };
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/enrich-partner-website`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ partner_id: partnerId }),
    });
    const data = await response.json();
    if (!response.ok || data.error) return { error: data.error || "Errore enrichment" };
    return { success: true, partner_id: partnerId, ...data, message: `Enrichment website completato.` };
  }

  async function executeScanDirectory(_args: Record<string, unknown>, _authHeader: string) {
    return { error: "Funzione scrape-wca-directory rimossa. Il download directory è ora gestito dal sistema esterno wca-app." };
  }

  async function executeGenerateAliases(args: Record<string, unknown>, authHeader: string) {
    const body: Record<string, unknown> = { type: args.type || "company" };
    if (args.partner_ids) body.partner_ids = args.partner_ids;
    if (args.country_code) body.country_code = String(args.country_code).toUpperCase();
    body.limit = Number(args.limit) || 20;
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-aliases`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || data.error) return { error: data.error || "Errore generazione alias" };
    return { success: true, ...data, message: `Alias generati con successo.` };
  }

  return {
    resolvePartnerId,
    executeUpdatePartner,
    executeAddPartnerNote,
    executeCreateReminder,
    executeUpdateLeadStatus,
    executeBulkUpdatePartners,
    executeLinkBusinessCard,
    executeCreateActivity,
    executeUpdateActivity,
    executeManagePartnerContact,
    executeUpdateReminder,
    executeDeleteRecords,
    executeGenerateOutreach,
    executeSendEmail,
    executeDeepSearchPartner,
    executeDeepSearchContact,
    executeEnrichPartnerWebsite,
    executeScanDirectory,
    executeGenerateAliases,
  };
}
