import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { escapeLike } from "../_shared/sqlEscape.ts";
import { ALL_TOOLS } from "./tools-schema.ts";
import { resolvePartnerId as resolvePartnerIdShared } from "./tools/shared.ts";
import { PARTNER_TOOLS, executePartnerTool } from "./tools/partners.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOOL EXECUTION (mirrors ai-assistant logic)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Wrapper locale che fissa il client `supabase` di modulo. La logica vive in
// `tools/shared.ts` per essere condivisibile con i moduli per-dominio.
const resolvePartnerId = (args: Record<string, unknown>) => resolvePartnerIdShared(supabase, args);

async function executeTool(name: string, args: Record<string, unknown>, userId: string, authHeader: string): Promise<unknown> {
  // Delega al modulo per-dominio: i tool strettamente "partners" vivono
  // in `tools/partners.ts`. Se il name matcha, ritorniamo direttamente.
  if (PARTNER_TOOLS.has(name)) return executePartnerTool(name, args, supabase);

  switch (name) {
    case "get_country_overview": {
      const { data, error } = await supabase.rpc("get_country_stats");
      if (error) return { error: error.message };
      let stats = data || [];
      if (args.country_code) stats = stats.filter((s: any) => s.country_code === String(args.country_code).toUpperCase());
      stats.sort((a: any, b: any) => (b.total_partners || 0) - (a.total_partners || 0));
      return { total_countries: stats.length, countries: stats.slice(0, Number(args.limit) || 30).map((s: any) => ({ country_code: s.country_code, total_partners: s.total_partners, with_profile: s.with_profile, without_profile: s.without_profile, with_email: s.with_email, with_phone: s.with_phone })) };
    }

    case "get_directory_status": {
      const { data: dirData } = await supabase.rpc("get_directory_counts");
      const { data: statsData } = await supabase.rpc("get_country_stats");
      const dirMap: Record<string, number> = {};
      for (const r of (dirData || []) as any[]) dirMap[r.country_code] = Number(r.member_count);
      const statsMap: Record<string, any> = {};
      for (const r of (statsData || []) as any[]) statsMap[r.country_code] = r;
      if (args.country_code) {
        const code = String(args.country_code).toUpperCase();
        return { country_code: code, directory_members: dirMap[code] || 0, db_partners: statsMap[code]?.total_partners || 0, gap: (dirMap[code] || 0) - (statsMap[code]?.total_partners || 0) };
      }
      const allCodes = [...new Set([...Object.keys(dirMap), ...Object.keys(statsMap)])];
      const gaps = allCodes.map(c => ({ country_code: c, dir: dirMap[c] || 0, db: statsMap[c]?.total_partners || 0, gap: (dirMap[c] || 0) - (statsMap[c]?.total_partners || 0) })).filter(r => r.gap > 0).sort((a, b) => b.gap - a.gap);
      return { countries_with_gaps: gaps.length, gaps: gaps.slice(0, 30) };
    }

    case "list_jobs": {
      let query = supabase.from("download_jobs").select("id, country_code, country_name, status, current_index, total_count, contacts_found_count, contacts_missing_count, last_processed_company, error_message, created_at").order("created_at", { ascending: false }).limit(Number(args.limit) || 20);
      if (args.status) query = query.eq("status", args.status);
      if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data?.length, jobs: (data || []).map((j: any) => ({ id: j.id, country: `${j.country_name} (${j.country_code})`, status: j.status, progress: `${j.current_index}/${j.total_count}`, found: j.contacts_found_count, missing: j.contacts_missing_count, last: j.last_processed_company, error: j.error_message })) };
    }

    case "get_global_summary": {
      const [statsRes, dirRes, jobsRes] = await Promise.all([
        supabase.rpc("get_country_stats"), supabase.rpc("get_directory_counts"),
        supabase.from("download_jobs").select("id, status").in("status", ["running", "pending"]),
      ]);
      const rows = statsRes.data || [];
      const totals = rows.reduce((acc: any, r: any) => ({ partners: acc.partners + (Number(r.total_partners) || 0), with_profile: acc.with_profile + (Number(r.with_profile) || 0), with_email: acc.with_email + (Number(r.with_email) || 0) }), { partners: 0, with_profile: 0, with_email: 0 });
      const dirTotal = (dirRes.data || []).reduce((s: number, r: any) => s + (Number(r.member_count) || 0), 0);
      return { total_countries: rows.length, total_partners: totals.partners, with_profile: totals.with_profile, with_email: totals.with_email, directory_members: dirTotal, active_jobs: jobsRes.data?.length || 0 };
    }

    case "check_blacklist": {
      let query = supabase.from("blacklist_entries").select("company_name, country, total_owed_amount, claims, status");
      if (args.company_name) query = query.ilike("company_name", `%${escapeLike(args.company_name)}%`);
      if (args.country) query = query.ilike("country", `%${escapeLike(args.country)}%`);
      const { data, error } = await query.limit(20);
      if (error) return { error: error.message };
      return { count: data?.length || 0, entries: data || [] };
    }

    case "list_reminders": {
      let query = supabase.from("reminders").select("id, title, description, due_date, priority, status, partner_id").order("due_date", { ascending: true }).limit(30);
      if (args.status) query = query.eq("status", args.status);
      if (args.priority) query = query.eq("priority", args.priority);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data?.length || 0, reminders: data || [] };
    }

    case "create_download_job": {
      const cc = String(args.country_code || "").toUpperCase();
      const cn = String(args.country_name || "");
      const mode = String(args.mode || "no_profile");
      const delay = Math.max(15, Number(args.delay_seconds) || 15);
      if (!cc || !cn) return { error: "country_code e country_name obbligatori" };
      const { data: active } = await supabase.from("download_jobs").select("id").in("status", ["pending", "running"]).limit(1);
      if (active && active.length > 0) return { error: "C'è già un job attivo." };
      // Simplified: get IDs based on mode
      let wcaIds: number[] = [];
      if (mode === "no_profile") {
        const { data } = await supabase.from("partners").select("wca_id").eq("country_code", cc).not("wca_id", "is", null).is("raw_profile_html", null);
        wcaIds = (data || []).map((p: any) => p.wca_id).filter(Boolean);
      } else {
        const { data } = await supabase.from("partners").select("wca_id").eq("country_code", cc).not("wca_id", "is", null);
        wcaIds = (data || []).map((p: any) => p.wca_id).filter(Boolean);
      }
      if (wcaIds.length === 0) return { error: `Nessun partner da scaricare per ${cn}.` };
      const { data: job, error } = await supabase.from("download_jobs").insert({ country_code: cc, country_name: cn, wca_ids: wcaIds as any, total_count: wcaIds.length, delay_seconds: delay, status: "pending" }).select("id").single();
      if (error) return { error: error.message };
      // Create items for V4 item-level tracking
      const jobItems = wcaIds.map((id: number, i: number) => ({ job_id: job.id, wca_id: id, position: i, status: "pending" }));
      for (let i = 0; i < jobItems.length; i += 500) { await supabase.from("download_job_items").insert(jobItems.slice(i, i + 500)); }
      return { success: true, job_id: job.id, total: wcaIds.length, message: `Job creato: ${wcaIds.length} partner per ${cn}.` };
    }

    case "download_single_partner": {
      const name = String(args.company_name || "").trim();
      if (!name) return { error: "Nome azienda obbligatorio" };
      const { data: found } = await supabase.from("partners").select("id, wca_id, company_name, country_code, country_name, raw_profile_html").ilike("company_name", `%${escapeLike(name)}%`).limit(1);
      if (!found || found.length === 0) return { error: `"${name}" non trovata nel database.` };
      const p = found[0];
      if (p.raw_profile_html) return { success: true, already_downloaded: true, message: `"${p.company_name}" ha già il profilo.` };
      if (!p.wca_id) return { error: `"${p.company_name}" non ha wca_id.` };
      const { data: active } = await supabase.from("download_jobs").select("id").in("status", ["pending", "running"]).limit(1);
      if (active && active.length > 0) return { error: "C'è già un job attivo." };
      const { data: job, error } = await supabase.from("download_jobs").insert({ country_code: p.country_code, country_name: p.country_name, wca_ids: [p.wca_id] as any, total_count: 1, delay_seconds: 15, status: "pending" }).select("id").single();
      if (error) return { error: error.message };
      // Create item for V4 tracking
      await supabase.from("download_job_items").insert({ job_id: job.id, wca_id: p.wca_id, position: 0, status: "pending" });
      return { success: true, job_id: job.id, message: `Download avviato per "${p.company_name}".` };
    }

    case "save_memory": {
      const { data, error } = await supabase.from("ai_memory").insert({ user_id: userId, content: String(args.content), memory_type: String(args.memory_type || "fact"), tags: (args.tags as string[]) || [], importance: Math.min(5, Math.max(1, Number(args.importance) || 3)) }).select("id").single();
      if (error) return { error: error.message };
      return { success: true, memory_id: data.id };
    }

    case "search_memory": {
      let query = supabase.from("ai_memory").select("content, memory_type, tags, importance, created_at").eq("user_id", userId).order("importance", { ascending: false }).limit(Number(args.limit) || 10);
      if (args.tags && (args.tags as string[]).length > 0) query = query.overlaps("tags", args.tags as string[]);
      if (args.search_text) query = query.ilike("content", `%${escapeLike(args.search_text)}%`);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data?.length || 0, memories: data || [] };
    }

    case "create_reminder": {
      const partner = await resolvePartnerId(args);
      if (!partner) return { error: "Partner non trovato" };
      const { error } = await supabase.from("reminders").insert({ partner_id: partner.id, title: String(args.title), description: args.description ? String(args.description) : null, due_date: String(args.due_date), priority: String(args.priority || "medium") });
      if (error) return { error: error.message };
      return { success: true, message: `Reminder creato per "${partner.name}".` };
    }

    case "update_lead_status": {
      const status = String(args.status);
      if (args.contact_ids && Array.isArray(args.contact_ids)) {
        const { error } = await supabase.from("imported_contacts").update({ lead_status: status }).in("id", args.contact_ids as string[]);
        if (error) return { error: error.message };
        return { success: true, updated: (args.contact_ids as string[]).length };
      }
      return { error: "Specificare contact_ids" };
    }

    case "check_job_status": {
      if (args.job_id) {
        const { data } = await supabase.from("download_jobs").select("id, status, current_index, total_count, contacts_found_count, last_processed_company, error_message").eq("id", args.job_id).single();
        return data || { error: "Job non trovato" };
      }
      const { data } = await supabase.from("download_jobs").select("id, country_name, status, current_index, total_count").in("status", ["running", "pending"]).limit(5);
      return { active_jobs: data || [] };
    }

    case "search_contacts": {
      const isCount = !!args.count_only;
      let query = supabase.from("imported_contacts").select(isCount ? "id" : "id, name, company_name, email, phone, country, lead_status, created_at", isCount ? { count: "exact", head: true } : undefined);
      if (args.search_name) query = query.ilike("name", `%${escapeLike(args.search_name)}%`);
      if (args.company_name) query = query.ilike("company_name", `%${escapeLike(args.company_name)}%`);
      if (args.country) query = query.ilike("country", `%${escapeLike(args.country)}%`);
      if (args.lead_status) query = query.eq("lead_status", args.lead_status);
      if (args.has_email === true) query = query.not("email", "is", null);
      query = query.or("company_name.not.is.null,name.not.is.null,email.not.is.null");
      query = query.order("created_at", { ascending: false }).limit(Math.min(Number(args.limit) || 20, 50));
      const { data, error, count } = await query;
      if (error) return { error: error.message };
      if (isCount) return { count };
      return { count: data?.length || 0, contacts: data || [] };
    }

    case "get_contact_detail": {
      let contact: any = null;
      if (args.contact_id) { const { data } = await supabase.from("imported_contacts").select("*").eq("id", args.contact_id).single(); contact = data; }
      else if (args.contact_name) { const { data } = await supabase.from("imported_contacts").select("*").ilike("name", `%${escapeLike(args.contact_name)}%`).limit(1).single(); contact = data; }
      if (!contact) return { error: "Contatto non trovato" };
      return contact;
    }

    case "search_prospects": {
      let query = supabase.from("prospects").select("id, company_name, city, province, codice_ateco, fatturato, email, lead_status");
      if (args.company_name) query = query.ilike("company_name", `%${escapeLike(args.company_name)}%`);
      if (args.city) query = query.ilike("city", `%${escapeLike(args.city)}%`);
      if (args.codice_ateco) query = query.ilike("codice_ateco", `%${escapeLike(args.codice_ateco)}%`);
      if (args.lead_status) query = query.eq("lead_status", args.lead_status);
      query = query.order("fatturato", { ascending: false, nullsFirst: false }).limit(Math.min(Number(args.limit) || 20, 50));
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data?.length || 0, prospects: data || [] };
    }

    case "list_activities": {
      let query = supabase.from("activities").select("id, title, activity_type, status, priority, due_date, partner_id, source_meta, created_at").order("due_date", { ascending: true, nullsFirst: false }).limit(Number(args.limit) || 30);
      if (args.status) query = query.eq("status", args.status);
      if (args.activity_type) query = query.eq("activity_type", args.activity_type);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data?.length || 0, activities: (data || []).map((a: any) => ({ ...a, company_name: (a.source_meta as any)?.company_name || null })) };
    }

    case "create_activity": {
      let partnerId = args.partner_id as string | null;
      let companyName = args.company_name as string || "";
      if (!partnerId && companyName) { const r = await resolvePartnerId(args); if (r) { partnerId = r.id; companyName = r.name; } }
      const { data, error } = await supabase.from("activities").insert({
        title: String(args.title), description: args.description ? String(args.description) : null,
        activity_type: String(args.activity_type), source_type: "partner", source_id: partnerId || crypto.randomUUID(),
        partner_id: partnerId, due_date: args.due_date ? String(args.due_date) : null,
        priority: String(args.priority || "medium"), source_meta: { company_name: companyName } as any,
      }).select("id").single();
      if (error) return { error: error.message };
      return { success: true, activity_id: data.id, message: `Attività "${args.title}" creata.` };
    }

    case "update_activity": {
      const updates: Record<string, unknown> = {};
      if (args.status) { updates.status = args.status; if (args.status === "completed") updates.completed_at = new Date().toISOString(); }
      if (args.priority) updates.priority = args.priority;
      if (args.due_date) updates.due_date = args.due_date;
      const { error } = await supabase.from("activities").update(updates).eq("id", args.activity_id);
      if (error) return { error: error.message };
      return { success: true, message: "Attività aggiornata." };
    }

    case "generate_outreach": {
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-outreach`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify(args),
      });
      const data = await response.json();
      if (!response.ok) return { error: data.error || "Errore generazione" };
      return { success: true, channel: data.channel, subject: data.subject, body: data.body };
    }

    case "send_email": {
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ to: args.to_email, toName: args.to_name, subject: args.subject, html: args.html_body }),
      });
      const data = await response.json();
      if (!response.ok) return { error: data.error || "Errore invio" };
      if (args.partner_id) await supabase.from("interactions").insert({ partner_id: args.partner_id, interaction_type: "email", subject: String(args.subject), notes: `Inviata a ${args.to_email}` });
      return { success: true, message: `Email inviata a ${args.to_email}.` };
    }

    case "deep_search_partner": {
      let pid = args.partner_id as string;
      if (!pid && args.company_name) { const r = await resolvePartnerId(args); if (r) pid = r.id; }
      if (!pid) return { error: "Partner non trovato" };
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/deep-search-partner`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ partner_id: pid, force: !!args.force }),
      });
      const data = await response.json();
      return response.ok ? { success: true, ...data } : { error: data.error || "Errore" };
    }

    case "deep_search_contact": {
      let cid = args.contact_id as string;
      if (!cid && args.contact_name) { const { data } = await supabase.from("imported_contacts").select("id").ilike("name", `%${escapeLike(args.contact_name)}%`).limit(1).single(); if (data) cid = data.id; }
      if (!cid) return { error: "Contatto non trovato" };
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/deep-search-contact`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ contact_id: cid }),
      });
      const data = await response.json();
      return response.ok ? { success: true, ...data } : { error: data.error || "Errore" };
    }

    case "enrich_partner_website": {
      let pid = args.partner_id as string;
      if (!pid && args.company_name) { const r = await resolvePartnerId(args); if (r) pid = r.id; }
      if (!pid) return { error: "Partner non trovato" };
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/enrich-partner-website`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ partner_id: pid }),
      });
      const data = await response.json();
      return response.ok ? { success: true, ...data } : { error: data.error || "Errore" };
    }

    case "scan_directory": {
      const body: Record<string, unknown> = {};
      if (args.country_code) body.countryCode = String(args.country_code).toUpperCase();
      if (args.network) body.network = args.network;
      if (args.search_by) body.searchBy = args.search_by;
      if (args.company_name) body.companyName = args.company_name;
      if (args.city) body.city = args.city;
      if (args.member_id) body.memberId = args.member_id;
      if (args.page_index) body.pageIndex = Number(args.page_index);
      if (args.page_size) body.pageSize = Number(args.page_size);
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/scrape-wca-directory`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return response.ok ? { success: true, ...data } : { error: data.error || "Errore" };
    }

    case "generate_aliases": {
      const body: Record<string, unknown> = { type: args.type || "company", limit: Number(args.limit) || 20 };
      if (args.partner_ids) body.partner_ids = args.partner_ids;
      if (args.country_code) body.country_code = String(args.country_code).toUpperCase();
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-aliases`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return response.ok ? { success: true, ...data } : { error: data.error || "Errore" };
    }

    case "manage_partner_contact": {
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
        if (!pid && args.company_name) { const r = await resolvePartnerId(args); if (r) pid = r.id; }
        if (!pid) return { error: "Partner non trovato" };
        const { error } = await supabase.from("partner_contacts").insert({ partner_id: pid, name: String(args.name), title: args.title ? String(args.title) : null, email: args.email ? String(args.email) : null });
        return error ? { error: error.message } : { success: true, message: `Contatto "${args.name}" aggiunto.` };
      }
      return { error: "Azione non valida" };
    }

    case "update_reminder": {
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

    case "delete_records": {
      const table = String(args.table);
      const ids = args.ids as string[];
      const valid = ["partners", "imported_contacts", "prospects", "activities", "reminders"];
      if (!valid.includes(table)) return { error: `Tabella non valida: ${table}` };
      const { error } = await supabase.from(table as any).delete().in("id", ids);
      return error ? { error: error.message } : { success: true, deleted: ids.length };
    }

    case "search_business_cards": {
      let query = supabase.from("business_cards").select("id, company_name, contact_name, email, event_name, match_status, created_at").order("created_at", { ascending: false }).limit(Number(args.limit) || 20);
      if (args.company_name) query = query.ilike("company_name", `%${escapeLike(args.company_name)}%`);
      if (args.event_name) query = query.ilike("event_name", `%${escapeLike(args.event_name)}%`);
      const { data, error } = await query;
      return error ? { error: error.message } : { count: data?.length || 0, cards: data || [] };
    }

    case "execute_ui_action": {
      const action = String(args.action || "toast");
      const target = String(args.target || "");
      const params = (args.params || {}) as Record<string, unknown>;
      return {
        success: true,
        ui_action: { action, target, params },
        message: action === "navigate" ? `Navigazione a ${target}` :
                 action === "toast" ? `Notifica: ${target}` :
                 `Filtro applicato: ${target}`,
      };
    }

    case "schedule_email": {
      const scheduledAt = String(args.scheduled_at);
      const { data, error } = await supabase.from("email_campaign_queue").insert({
        recipient_email: String(args.to_email),
        recipient_name: args.to_name ? String(args.to_name) : null,
        subject: String(args.subject),
        html_body: String(args.html_body),
        partner_id: args.partner_id ? String(args.partner_id) : "00000000-0000-0000-0000-000000000000",
        scheduled_at: scheduledAt,
        status: "pending",
        user_id: userId,
      } as any).select("id").single();
      if (error) return { error: error.message };
      // Also create an activity for tracking
      await supabase.from("activities").insert({
        title: `Email programmata: ${args.subject}`,
        activity_type: "email",
        source_type: "partner",
        source_id: args.partner_id || crypto.randomUUID(),
        partner_id: args.partner_id || null,
        scheduled_at: scheduledAt,
        status: "pending",
        user_id: userId,
        email_subject: String(args.subject),
        email_body: String(args.html_body),
        source_meta: { company_name: args.to_name || args.to_email, scheduled: true } as any,
      });
      return { success: true, queue_id: data.id, scheduled_at: scheduledAt, message: `Email programmata per ${scheduledAt} a ${args.to_email}.` };
    }

    case "get_operations_dashboard": {
      const [dlJobs, emailQ, agTasks, acts] = await Promise.all([
        supabase.from("download_jobs").select("id, country_name, status, current_index, total_count, contacts_found_count, error_message, created_at").order("created_at", { ascending: false }).limit(10),
        supabase.from("email_campaign_queue").select("id, status, scheduled_at, sent_at, recipient_email, subject").order("created_at", { ascending: false }).limit(20),
        supabase.from("agent_tasks").select("id, agent_id, description, status, task_type, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(15),
        supabase.from("activities").select("id, title, status, activity_type, scheduled_at, due_date").neq("status", "cancelled").order("created_at", { ascending: false }).limit(15),
      ]);
      
      const downloads = dlJobs.data || [];
      const emails = emailQ.data || [];
      const tasks = agTasks.data || [];
      const activities = acts.data || [];
      
      return {
        downloads: {
          active: downloads.filter((j: any) => ["running", "pending"].includes(j.status)).length,
          completed: downloads.filter((j: any) => j.status === "completed").length,
          failed: downloads.filter((j: any) => j.status === "failed").length,
          jobs: downloads.map((j: any) => ({ id: j.id, country: j.country_name, status: j.status, progress: `${j.current_index}/${j.total_count}`, found: j.contacts_found_count })),
        },
        emails: {
          pending: emails.filter((e: any) => e.status === "pending").length,
          sent: emails.filter((e: any) => e.status === "sent").length,
          scheduled: emails.filter((e: any) => e.scheduled_at && e.status === "pending").length,
          recent: emails.slice(0, 10).map((e: any) => ({ status: e.status, to: e.recipient_email, subject: e.subject, scheduled: e.scheduled_at })),
        },
        agent_tasks: {
          running: tasks.filter((t: any) => ["pending", "running"].includes(t.status)).length,
          completed: tasks.filter((t: any) => t.status === "completed").length,
          recent: tasks.slice(0, 8),
        },
        activities: {
          pending: activities.filter((a: any) => a.status === "pending").length,
          scheduled: activities.filter((a: any) => a.scheduled_at).length,
          recent: activities.slice(0, 8),
        },
      };
    }

    // ━━━ Management Tools ━━━
    case "create_agent_task": {
      // Find agent by name or role
      let agentQuery = supabase.from("agents").select("id, name").eq("user_id", userId);
      if (args.agent_name) agentQuery = agentQuery.ilike("name", `%${escapeLike(args.agent_name)}%`);
      else if (args.agent_role) agentQuery = agentQuery.eq("role", args.agent_role);
      const { data: agents } = await agentQuery.limit(1);
      if (!agents || agents.length === 0) return { error: `Agente "${args.agent_name || args.agent_role}" non trovato.` };
      const targetAgent = agents[0];
      const { data, error } = await supabase.from("agent_tasks").insert({
        agent_id: targetAgent.id, user_id: userId,
        task_type: String(args.task_type || "research"),
        description: String(args.description),
        target_filters: (args.target_filters || {}) as any,
      }).select("id").single();
      if (error) return { error: error.message };
      return { success: true, task_id: data.id, agent_name: targetAgent.name, message: `Task creato per ${targetAgent.name}: "${args.description}"` };
    }

    case "list_agent_tasks": {
      let query = supabase.from("agent_tasks").select("id, agent_id, task_type, description, status, result_summary, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(Number(args.limit) || 30);
      if (args.status) query = query.eq("status", args.status);
      const { data: tasks, error } = await query;
      if (error) return { error: error.message };
      // Resolve agent names
      const agentIds = [...new Set((tasks || []).map((t: any) => t.agent_id))];
      const { data: agentsData } = await supabase.from("agents").select("id, name").in("id", agentIds);
      const nameMap: Record<string, string> = {};
      for (const a of (agentsData || []) as any[]) nameMap[a.id] = a.name;
      let results = (tasks || []).map((t: any) => ({ ...t, agent_name: nameMap[t.agent_id] || "?" }));
      if (args.agent_name) results = results.filter((t: any) => t.agent_name.toLowerCase().includes(String(args.agent_name).toLowerCase()));
      return { count: results.length, tasks: results };
    }

    case "get_team_status": {
      const { data: agents } = await supabase.from("agents").select("id, name, role, is_active, stats, avatar_emoji, updated_at").eq("user_id", userId).order("name");
      if (!agents) return { error: "Nessun agente trovato" };
      // Get recent tasks per agent
      const agentIds = agents.map((a: any) => a.id);
      const { data: tasks } = await supabase.from("agent_tasks").select("agent_id, status").in("agent_id", agentIds);
      const taskStats: Record<string, { pending: number; running: number; completed: number; failed: number }> = {};
      for (const t of (tasks || []) as any[]) {
        if (!taskStats[t.agent_id]) taskStats[t.agent_id] = { pending: 0, running: 0, completed: 0, failed: 0 };
        if (taskStats[t.agent_id][t.status as keyof typeof taskStats[string]] !== undefined) taskStats[t.agent_id][t.status as keyof typeof taskStats[string]]++;
      }
      return {
        team_size: agents.length,
        active_agents: agents.filter((a: any) => a.is_active).length,
        agents: agents.map((a: any) => ({
          name: a.name, role: a.role, emoji: a.avatar_emoji, is_active: a.is_active,
          stats: a.stats, tasks: taskStats[a.id] || { pending: 0, running: 0, completed: 0, failed: 0 },
          last_activity: a.updated_at,
        })),
      };
    }

    case "update_agent_prompt": {
      const { data: agents } = await supabase.from("agents").select("id, name, system_prompt").eq("user_id", userId).ilike("name", `%${escapeLike(args.agent_name)}%`).limit(1);
      if (!agents || agents.length === 0) return { error: `Agente "${args.agent_name}" non trovato.` };
      const agent = agents[0];
      let newPrompt = agent.system_prompt;
      if (args.replace_prompt) newPrompt = String(args.replace_prompt);
      else if (args.prompt_addition) newPrompt += "\n\n" + String(args.prompt_addition);
      const { error } = await supabase.from("agents").update({ system_prompt: newPrompt, updated_at: new Date().toISOString() }).eq("id", agent.id);
      if (error) return { error: error.message };
      return { success: true, agent_name: agent.name, prompt_length: newPrompt.length, message: `Prompt di ${agent.name} aggiornato.` };
    }

    case "add_agent_kb_entry": {
      const { data: agents } = await supabase.from("agents").select("id, name, knowledge_base").eq("user_id", userId).ilike("name", `%${escapeLike(args.agent_name)}%`).limit(1);
      if (!agents || agents.length === 0) return { error: `Agente "${args.agent_name}" non trovato.` };
      const agent = agents[0];
      const kb = (agent.knowledge_base as any[]) || [];
      kb.push({ title: String(args.title), content: String(args.content), added_at: new Date().toISOString() });
      const { error } = await supabase.from("agents").update({ knowledge_base: kb as any, updated_at: new Date().toISOString() }).eq("id", agent.id);
      if (error) return { error: error.message };
      return { success: true, agent_name: agent.name, kb_entries: kb.length, message: `KB entry "${args.title}" aggiunta a ${agent.name}.` };
    }

    // ━━━ Strategic Tools ━━━
    case "create_work_plan": {
      const steps = (args.steps as any[] || []).map((s: any, i: number) => ({
        index: i, title: s.title || `Step ${i + 1}`, description: s.description || "", status: "pending",
      }));
      const { data, error } = await supabase.from("ai_work_plans").insert({
        user_id: userId, title: String(args.title),
        description: String(args.description || ""),
        steps: steps as any, status: "active",
        tags: (args.tags || []) as any,
        metadata: { created_by: "luca_director", created_at: new Date().toISOString() } as any,
      }).select("id, title").single();
      if (error) return { error: error.message };
      return { success: true, plan_id: data.id, title: data.title, total_steps: steps.length, message: `Piano "${data.title}" creato con ${steps.length} step.` };
    }

    case "list_work_plans": {
      let query = supabase.from("ai_work_plans").select("id, title, description, status, current_step, steps, tags, created_at, completed_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(Number(args.limit) || 20);
      if (args.status) query = query.eq("status", args.status);
      const { data, error } = await query;
      if (error) return { error: error.message };
      const plans = (data || []).map((p: any) => ({
        ...p, total_steps: Array.isArray(p.steps) ? p.steps.length : 0,
        completed_steps: Array.isArray(p.steps) ? p.steps.filter((s: any) => s.status === "completed").length : 0,
      }));
      if (args.tag) return { count: plans.filter((p: any) => p.tags?.includes(args.tag)).length, plans: plans.filter((p: any) => p.tags?.includes(args.tag)) };
      return { count: plans.length, plans };
    }

    case "update_work_plan": {
      const { data: plan, error: fetchErr } = await supabase.from("ai_work_plans").select("*").eq("id", args.plan_id).eq("user_id", userId).single();
      if (fetchErr || !plan) return { error: "Piano non trovato" };
      const updates: Record<string, unknown> = {};
      if (args.status) updates.status = args.status;
      if (args.advance_step) {
        const steps = (plan.steps as any[]) || [];
        if (plan.current_step < steps.length) {
          steps[plan.current_step].status = "completed";
          updates.steps = steps;
          updates.current_step = plan.current_step + 1;
          if (plan.current_step + 1 >= steps.length) { updates.status = "completed"; updates.completed_at = new Date().toISOString(); }
        }
      }
      if (args.metadata_note) {
        const meta = (plan.metadata as Record<string, unknown>) || {};
        const notes = (meta.notes as string[]) || [];
        notes.push(`[${new Date().toISOString()}] ${args.metadata_note}`);
        meta.notes = notes;
        updates.metadata = meta;
      }
      const { error } = await supabase.from("ai_work_plans").update(updates).eq("id", args.plan_id);
      if (error) return { error: error.message };
      return { success: true, message: `Piano aggiornato.`, updates: Object.keys(updates) };
    }

    case "manage_workspace_preset": {
      const action = String(args.action);
      if (action === "list") {
        const { data, error } = await supabase.from("workspace_presets").select("id, name, goal, base_proposal, created_at").eq("user_id", userId).order("created_at", { ascending: false });
        return error ? { error: error.message } : { count: data?.length || 0, presets: data || [] };
      }
      if (action === "create") {
        const { data, error } = await supabase.from("workspace_presets").insert({
          user_id: userId, name: String(args.name || "Nuovo preset"),
          goal: String(args.goal || ""), base_proposal: String(args.base_proposal || ""),
        }).select("id, name").single();
        return error ? { error: error.message } : { success: true, preset_id: data.id, message: `Preset "${data.name}" creato.` };
      }
      if (action === "update" && args.preset_id) {
        const updates: Record<string, unknown> = {};
        if (args.name) updates.name = args.name;
        if (args.goal) updates.goal = args.goal;
        if (args.base_proposal) updates.base_proposal = args.base_proposal;
        const { error } = await supabase.from("workspace_presets").update(updates).eq("id", args.preset_id).eq("user_id", userId);
        return error ? { error: error.message } : { success: true, message: "Preset aggiornato." };
      }
      if (action === "delete" && args.preset_id) {
        const { error } = await supabase.from("workspace_presets").delete().eq("id", args.preset_id).eq("user_id", userId);
        return error ? { error: error.message } : { success: true, message: "Preset eliminato." };
      }
      return { error: "Azione non valida. Usa: create, list, update, delete." };
    }

    case "get_system_analytics": {
      const results: Record<string, unknown> = {};
      // Partners
      const { count: totalPartners } = await supabase.from("partners").select("id", { count: "exact", head: true });
      const { count: partnersWithEmail } = await supabase.from("partners").select("id", { count: "exact", head: true }).not("email", "is", null);
      const { count: partnersWithProfile } = await supabase.from("partners").select("id", { count: "exact", head: true }).not("raw_profile_html", "is", null);
      const { count: partnersConverted } = await supabase.from("partners").select("id", { count: "exact", head: true }).eq("lead_status", "converted");
      const { count: partnersContacted } = await supabase.from("partners").select("id", { count: "exact", head: true }).eq("lead_status", "contacted");
      results.partners = { total: totalPartners, with_email: partnersWithEmail, with_profile: partnersWithProfile, converted: partnersConverted, contacted: partnersContacted };
      // Contacts
      const { count: totalContacts } = await supabase.from("imported_contacts").select("id", { count: "exact", head: true });
      const { count: contactsWithEmail } = await supabase.from("imported_contacts").select("id", { count: "exact", head: true }).not("email", "is", null);
      results.contacts = { total: totalContacts, with_email: contactsWithEmail };
      // Prospects
      const { count: totalProspects } = await supabase.from("prospects").select("id", { count: "exact", head: true });
      results.prospects = { total: totalProspects };
      // Email queue
      const { count: emailsPending } = await supabase.from("email_campaign_queue").select("id", { count: "exact", head: true }).eq("status", "pending");
      const { count: emailsSent } = await supabase.from("email_campaign_queue").select("id", { count: "exact", head: true }).eq("status", "sent");
      results.email_campaigns = { pending: emailsPending, sent: emailsSent };
      // Agent tasks
      const { data: taskData } = await supabase.from("agent_tasks").select("status").eq("user_id", userId);
      const taskCounts: Record<string, number> = {};
      for (const t of (taskData || []) as any[]) { taskCounts[t.status] = (taskCounts[t.status] || 0) + 1; }
      results.agent_tasks = taskCounts;
      // Activities
      const { count: activitiesPending } = await supabase.from("activities").select("id", { count: "exact", head: true }).eq("status", "pending");
      const { count: activitiesOverdue } = await supabase.from("activities").select("id", { count: "exact", head: true }).eq("status", "pending").lt("due_date", new Date().toISOString().split("T")[0]);
      results.activities = { pending: activitiesPending, overdue: activitiesOverdue };
      // Work plans
      const { count: plansActive } = await supabase.from("ai_work_plans").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active");
      results.work_plans = { active: plansActive };
      return results;
    }

    case "queue_outreach": {
      const channel = String(args.channel || "email");
      const body = String(args.body || "");
      if (!body) return { error: "body è obbligatorio" };
      const { data, error } = await supabase.from("outreach_queue").insert({
        user_id: userId,
        channel,
        recipient_name: args.recipient_name ? String(args.recipient_name) : null,
        recipient_email: args.recipient_email ? String(args.recipient_email) : null,
        recipient_phone: args.recipient_phone ? String(args.recipient_phone) : null,
        recipient_linkedin_url: args.recipient_linkedin_url ? String(args.recipient_linkedin_url) : null,
        partner_id: args.partner_id ? String(args.partner_id) : null,
        contact_id: args.contact_id ? String(args.contact_id) : null,
        subject: args.subject ? String(args.subject) : null,
        body,
        priority: Number(args.priority) || 0,
        created_by: "agent",
      }).select("id, channel, recipient_name, status").single();
      if (error) return { error: error.message };
      return { success: true, queue_id: data.id, channel: data.channel, recipient: data.recipient_name, message: `Messaggio ${channel} accodato per ${data.recipient_name || "destinatario"}. Il frontend lo invierà automaticamente.` };
    }

    // ━━━ Communication & Holding Pattern Tools ━━━
    case "get_inbox": {
      let query = supabase.from("channel_messages").select("id, channel, direction, from_address, to_address, subject, body_text, email_date, read_at, partner_id, category, created_at")
        .eq("user_id", userId).eq("direction", "inbound").order("email_date", { ascending: false }).limit(Math.min(Number(args.limit) || 20, 50));
      if (args.channel) query = query.eq("channel", args.channel);
      if (args.unread_only) query = query.is("read_at", null);
      if (args.partner_id) query = query.eq("partner_id", args.partner_id);
      if (args.from_date) query = query.gte("email_date", args.from_date);
      if (args.to_date) query = query.lte("email_date", args.to_date);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data?.length || 0, messages: (data || []).map((m: any) => ({ id: m.id, channel: m.channel, from: m.from_address, subject: m.subject, preview: m.body_text?.substring(0, 300) || "", date: m.email_date, read: !!m.read_at, partner_id: m.partner_id, category: m.category })) };
    }

    case "get_conversation_history": {
      let pid = args.partner_id as string;
      if (!pid && args.company_name) { const r = await resolvePartnerId(args); if (r) pid = r.id; }
      const timeline: any[] = [];
      if (pid) {
        // Emails
        const { data: emails } = await supabase.from("channel_messages").select("id, direction, from_address, to_address, subject, body_text, email_date, channel")
          .eq("user_id", userId).or(`partner_id.eq.${pid},from_address.ilike.%${pid}%`).order("email_date", { ascending: false }).limit(30);
        (emails || []).forEach((e: any) => timeline.push({ type: "email", direction: e.direction, subject: e.subject, from: e.from_address, date: e.email_date, channel: e.channel, preview: e.body_text?.substring(0, 200) }));
        // Activities
        const { data: acts } = await supabase.from("activities").select("id, title, activity_type, status, created_at, description")
          .or(`partner_id.eq.${pid},source_id.eq.${pid}`).order("created_at", { ascending: false }).limit(30);
        (acts || []).forEach((a: any) => timeline.push({ type: "activity", subtype: a.activity_type, title: a.title, status: a.status, date: a.created_at, description: a.description?.substring(0, 200) }));
        // Interactions
        const { data: ints } = await supabase.from("interactions").select("id, interaction_type, subject, notes, created_at")
          .eq("partner_id", pid).order("created_at", { ascending: false }).limit(30);
        (ints || []).forEach((i: any) => timeline.push({ type: "interaction", subtype: i.interaction_type, title: i.subject, notes: i.notes?.substring(0, 200), date: i.created_at }));
        // Sent emails
        const { data: sent } = await supabase.from("email_campaign_queue").select("id, subject, recipient_email, status, sent_at")
          .eq("partner_id", pid).eq("status", "sent").order("sent_at", { ascending: false }).limit(20);
        (sent || []).forEach((s: any) => timeline.push({ type: "email_sent", subject: s.subject, to: s.recipient_email, date: s.sent_at }));
      } else if (args.contact_id) {
        const { data: cInts } = await supabase.from("contact_interactions").select("id, interaction_type, title, description, outcome, created_at")
          .eq("contact_id", args.contact_id).order("created_at", { ascending: false }).limit(30);
        (cInts || []).forEach((i: any) => timeline.push({ type: "interaction", subtype: i.interaction_type, title: i.title, description: i.description?.substring(0, 200), outcome: i.outcome, date: i.created_at }));
      }
      timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return { count: timeline.length, timeline: timeline.slice(0, Number(args.limit) || 50) };
    }

    case "get_holding_pattern": {
      const items: any[] = [];
      const activeStatuses = ["contacted", "in_progress"];
      const now = new Date();
      // Partners (WCA)
      if (!args.source_type || args.source_type === "wca" || args.source_type === "all") {
        let pq = supabase.from("partners").select("id, company_name, country_code, city, email, lead_status, last_interaction_at, interaction_count")
          .in("lead_status", activeStatuses).order("last_interaction_at", { ascending: true, nullsFirst: true });
        if (args.country_code) pq = pq.eq("country_code", String(args.country_code).toUpperCase());
        const { data: partners } = await pq.limit(Number(args.limit) || 50);
        (partners || []).forEach((p: any) => {
          const days = p.last_interaction_at ? Math.floor((now.getTime() - new Date(p.last_interaction_at).getTime()) / 86400000) : 999;
          if (args.min_days_waiting && days < Number(args.min_days_waiting)) return;
          if (args.max_days_waiting && days > Number(args.max_days_waiting)) return;
          items.push({ id: p.id, source: "wca", name: p.company_name, country: p.country_code, city: p.city, email: p.email, status: p.lead_status, days_waiting: days, interactions: p.interaction_count });
        });
      }
      // Contacts (CRM)
      if (!args.source_type || args.source_type === "crm" || args.source_type === "all") {
        let cq = supabase.from("imported_contacts").select("id, name, company_name, country, city, email, lead_status, last_interaction_at, interaction_count")
          .in("lead_status", activeStatuses).order("last_interaction_at", { ascending: true, nullsFirst: true });
        const { data: contacts } = await cq.limit(Number(args.limit) || 50);
        (contacts || []).forEach((c: any) => {
          const days = c.last_interaction_at ? Math.floor((now.getTime() - new Date(c.last_interaction_at).getTime()) / 86400000) : 999;
          if (args.min_days_waiting && days < Number(args.min_days_waiting)) return;
          if (args.max_days_waiting && days > Number(args.max_days_waiting)) return;
          items.push({ id: c.id, source: "crm", name: c.company_name || c.name || "—", country: c.country, city: c.city, email: c.email, status: c.lead_status, days_waiting: days, interactions: c.interaction_count });
        });
      }
      items.sort((a, b) => b.days_waiting - a.days_waiting);
      return { count: items.length, items: items.slice(0, Number(args.limit) || 50) };
    }

    case "update_message_status": {
      const { error } = await supabase.from("channel_messages").update({ read_at: new Date().toISOString() }).eq("id", args.message_id).eq("user_id", userId);
      return error ? { error: error.message } : { success: true, message: "Messaggio marcato come letto." };
    }

    case "get_email_thread": {
      let messages: any[] = [];
      // Strategy 1: by thread_id
      if (args.thread_id) {
        const { data } = await supabase.from("channel_messages").select("id, direction, from_address, to_address, subject, body_text, email_date, channel")
          .eq("user_id", userId).eq("thread_id", args.thread_id).order("email_date", { ascending: true });
        messages = data || [];
      }
      // Strategy 2: by partner_id
      if (messages.length === 0 && args.partner_id) {
        const { data } = await supabase.from("channel_messages").select("id, direction, from_address, to_address, subject, body_text, email_date, channel, thread_id, in_reply_to")
          .eq("user_id", userId).eq("partner_id", args.partner_id).eq("channel", "email").order("email_date", { ascending: true }).limit(Number(args.limit) || 50);
        messages = data || [];
      }
      // Strategy 3: by email address with subject matching
      if (messages.length === 0 && args.email_address) {
        const { data } = await supabase.from("channel_messages").select("id, direction, from_address, to_address, subject, body_text, email_date, channel")
          .eq("user_id", userId).eq("channel", "email").or(`from_address.ilike.%${args.email_address}%,to_address.ilike.%${args.email_address}%`)
          .order("email_date", { ascending: true }).limit(Number(args.limit) || 50);
        messages = data || [];
      }
      return { count: messages.length, thread: messages.map((m: any) => ({ id: m.id, direction: m.direction, from: m.from_address, to: m.to_address, subject: m.subject, preview: m.body_text?.substring(0, 500), date: m.email_date })) };
    }

    case "analyze_incoming_email": {
      const { data: msg } = await supabase.from("channel_messages").select("from_address, to_address, subject, body_text, email_date, partner_id")
        .eq("id", args.message_id).eq("user_id", userId).single();
      if (!msg) return { error: "Messaggio non trovato" };

      // Check/lock exclusive agent for this email address
      let exclusiveAgentName: string | null = null;
      if (msg.from_address) {
        const fromAddr = msg.from_address.toLowerCase().trim();
        const { data: rule } = await supabase.from("email_address_rules")
          .select("id, exclusive_agent_id")
          .eq("email_address", fromAddr).eq("user_id", userId).maybeSingle();
        
        if (rule && !rule.exclusive_agent_id) {
          // Lock this address to the current executing agent
          const executingAgentId = context?.agent_id;
          if (executingAgentId) {
            await supabase.from("email_address_rules")
              .update({ exclusive_agent_id: executingAgentId })
              .eq("id", rule.id);
            const { data: ag } = await supabase.from("agents").select("name").eq("id", executingAgentId).single();
            exclusiveAgentName = ag?.name || null;
          }
        } else if (!rule) {
          const executingAgentId = context?.agent_id;
          if (executingAgentId) {
            await supabase.from("email_address_rules").insert({
              email_address: fromAddr, user_id: userId,
              exclusive_agent_id: executingAgentId, category: "auto",
            });
            const { data: ag } = await supabase.from("agents").select("name").eq("id", executingAgentId).single();
            exclusiveAgentName = ag?.name || null;
          }
        } else if (rule?.exclusive_agent_id) {
          const { data: ag } = await supabase.from("agents").select("name").eq("id", rule.exclusive_agent_id).single();
          exclusiveAgentName = ag?.name || null;
        }
      }

      // Use AI to analyze
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const analysisRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST", headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "Analizza questa email e rispondi SOLO con un JSON valido: {\"sentiment\": \"positive|neutral|negative\", \"intent\": \"interest|info_request|refusal|ooo|auto_reply|spam|other\", \"suggested_action\": \"follow_up|escalation|close|schedule_call|respond_info|ignore\", \"urgency\": 1-5, \"summary\": \"breve riassunto in italiano\"}" },
            { role: "user", content: `Da: ${msg.from_address}\nOggetto: ${msg.subject}\n\n${msg.body_text?.substring(0, 2000) || "(vuoto)"}` },
          ],
          max_tokens: 500,
        }),
      });
      if (!analysisRes.ok) return { error: "Errore analisi AI" };
      const analysisData = await analysisRes.json();
      const analysisText = analysisData.choices?.[0]?.message?.content || "{}";
      try {
        const parsed = JSON.parse(analysisText.replace(/```json\n?|\n?```/g, "").trim());
        return { success: true, message_id: args.message_id, from: msg.from_address, subject: msg.subject, date: msg.email_date, partner_id: msg.partner_id, exclusive_agent: exclusiveAgentName, analysis: parsed };
      } catch {
        return { success: true, message_id: args.message_id, from: msg.from_address, subject: msg.subject, exclusive_agent: exclusiveAgentName, analysis: { raw: analysisText } };
      }
    }

    case "assign_contacts_to_agent": {
      // Find agent
      const { data: agents } = await supabase.from("agents").select("id, name").eq("user_id", userId).ilike("name", `%${escapeLike(args.agent_name)}%`).limit(1);
      if (!agents || agents.length === 0) return { error: `Agente "${args.agent_name}" non trovato.` };
      const targetAgent = agents[0];
      // Get contacts to assign
      const sourceType = String(args.source_type || "partner");
      let contactIds: { id: string; name: string }[] = [];
      if (sourceType === "partner") {
        let pq = supabase.from("partners").select("id, company_name").limit(Number(args.limit) || 20);
        if (args.country_code) pq = pq.eq("country_code", String(args.country_code).toUpperCase());
        if (args.lead_status) pq = pq.eq("lead_status", args.lead_status);
        const { data } = await pq;
        contactIds = (data || []).map((p: any) => ({ id: p.id, name: p.company_name }));
      } else {
        let cq = supabase.from("imported_contacts").select("id, name, company_name").limit(Number(args.limit) || 20);
        if (args.lead_status) cq = cq.eq("lead_status", args.lead_status);
        const { data } = await cq;
        contactIds = (data || []).map((c: any) => ({ id: c.id, name: c.company_name || c.name || "—" }));
      }
      if (contactIds.length === 0) return { error: "Nessun contatto trovato con i filtri specificati." };
      // Create assignments
      const assignments = contactIds.map(c => ({ agent_id: targetAgent.id, source_type: sourceType, source_id: c.id, user_id: userId }));
      const { error } = await supabase.from("client_assignments").insert(assignments);
      if (error) return { error: error.message };
      return { success: true, agent_name: targetAgent.name, assigned_count: contactIds.length, contacts: contactIds.slice(0, 10).map(c => c.name), message: `${contactIds.length} contatti assegnati a ${targetAgent.name}.` };
    }

    case "create_campaign": {
      // Create work plan as campaign
      const steps: any[] = [];
      const contactType = String(args.contact_type || "all");
      const countryCodes = (args.country_codes as string[]) || [];
      steps.push({ index: 0, title: "Selezione contatti", description: `Tipo: ${contactType}, Paesi: ${countryCodes.join(", ") || "tutti"}`, status: "pending" });
      const agentNames = (args.agent_names as string[]) || [];
      if (agentNames.length > 0) steps.push({ index: 1, title: "Assegnazione agenti", description: `Agenti: ${agentNames.join(", ")}`, status: "pending" });
      const abTest = args.ab_test as any;
      if (abTest?.enabled && abTest?.variants?.length > 0) {
        steps.push({ index: steps.length, title: "Configurazione A/B Test", description: `Varianti: ${abTest.variants.map((v: any) => `${v.agent_name}(${v.tone}/${v.percentage}%)`).join(" vs ")}`, status: "pending" });
      }
      steps.push({ index: steps.length, title: "Invio outreach", description: "Esecuzione invii tramite agenti assegnati", status: "pending" });
      steps.push({ index: steps.length, title: "Monitoraggio circuito", description: "Verifica risposte e follow-up secondo workflow", status: "pending" });
      const { data, error } = await supabase.from("ai_work_plans").insert({
        user_id: userId, title: `Campagna: ${args.name}`, description: String(args.objective || ""),
        steps: steps as any, status: "active",
        tags: ["campaign", contactType, ...(countryCodes.map(c => `country:${c}`))],
        metadata: { campaign: true, contact_type: contactType, country_codes: countryCodes, agent_names: agentNames, ab_test: abTest || null, max_contacts: Number(args.max_contacts) || 100 } as any,
      }).select("id, title").single();
      if (error) return { error: error.message };
      return { success: true, campaign_id: data.id, name: data.title, steps: steps.length, message: `Campagna "${args.name}" creata con ${steps.length} step.` };
    }

    default:
      return { error: `Tool sconosciuto: ${name}` };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    
    // Auth
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    
    let userId: string;
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Non autenticato" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = claimsData.claims.sub as string;
    } else {
      // Fallback: getUser
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Non autenticato" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    const body = await req.json();
    const { agent_id, task_id, chat_messages } = body;

    if (!agent_id) {
      return new Response(JSON.stringify({ error: "agent_id richiesto" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load agent
    const { data: agent, error: agentErr } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agent_id)
      .eq("user_id", userId)
      .single();

    if (agentErr || !agent) {
      return new Response(JSON.stringify({ error: "Agente non trovato" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ━━━ Context Injection: User Profile + Memory + KB ━━━
    let contextBlock = "";
    try {
      // Load user profile from app_settings
      const { data: settings } = await supabase.from("app_settings").select("key, value").like("key", "ai_%");
      if (settings && settings.length > 0) {
        contextBlock += "\n\n--- PROFILO UTENTE ---\n";
        for (const s of settings) {
          const label = s.key.replace("ai_", "").replace(/_/g, " ").toUpperCase();
          if (s.value) contextBlock += `${label}: ${s.value}\n`;
        }
      }
      // Load top memories L2+L3
      const { data: memories } = await supabase.from("ai_memory").select("content, memory_type, tags, level, importance")
        .eq("user_id", userId).in("level", [2, 3]).order("importance", { ascending: false }).limit(5);
      if (memories && memories.length > 0) {
        contextBlock += "\n--- MEMORIA OPERATIVA ---\n";
        for (const m of memories) contextBlock += `- [L${m.level}/${m.memory_type}] ${m.content}\n`;
      }
      // Load global KB entries
      const { data: kbEntries } = await supabase.from("kb_entries").select("title, content")
        .eq("user_id", userId).eq("is_active", true).order("priority", { ascending: false }).limit(5);
      if (kbEntries && kbEntries.length > 0) {
        contextBlock += "\n--- KNOWLEDGE BASE GLOBALE ---\n";
        for (const k of kbEntries) contextBlock += `### ${k.title}\n${k.content.substring(0, 500)}\n\n`;
      }
      // Load mission history
      const { data: missions } = await supabase.from("outreach_missions").select("title, status, channel, total_contacts, processed_contacts, target_filters, ai_summary")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(5);
      if (missions?.length) {
        contextBlock += "\n--- STORICO MISSIONI ---\n";
        for (const m of missions) {
          const filters = m.target_filters as any;
          contextBlock += `- "${m.title}" [${m.status}] ${m.channel} — ${m.processed_contacts}/${m.total_contacts} — Paesi: ${filters?.countries?.join(", ") || "N/D"}\n`;
        }
      }
    } catch (e) { console.error("Context injection error:", e); }

    // Build system prompt with KB
    let systemPrompt = agent.system_prompt || "Sei un agente AI.";
    systemPrompt += contextBlock;
    systemPrompt += "\n\nRispondi SEMPRE in italiano. Usa markdown per formattare le risposte. Sei un agente operativo che agisce sul database reale — non simulare, esegui le azioni.";
    
    const kb = agent.knowledge_base as Array<{ title: string; content: string }> | null;
    if (kb && kb.length > 0) {
      systemPrompt += "\n\n--- KNOWLEDGE BASE ---\n";
      for (const entry of kb) {
        systemPrompt += `\n### ${entry.title}\n${entry.content}\n`;
      }
    }

    // Filter tools based on agent's assigned_tools
    const assignedTools = (agent.assigned_tools as string[]) || [];
    const agentTools = assignedTools
      .map((name: string) => ALL_TOOLS[name])
      .filter(Boolean);

    // Resolve AI provider
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const aiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };
    const fallbackModels = ["google/gemini-3-flash-preview", "google/gemini-2.5-flash", "openai/gpt-5-mini"];

    // ━━━ CHAT MODE ━━━
    if (chat_messages && Array.isArray(chat_messages)) {
      const allMessages = [
        { role: "system", content: systemPrompt },
        ...chat_messages.map((m: any) => ({ role: m.role, content: m.content })),
      ];

      // Call LLM with tools
      let response: Response | null = null;
      for (const model of fallbackModels) {
        response = await fetch(aiUrl, {
          method: "POST", headers: aiHeaders,
          body: JSON.stringify({
            model,
            messages: allMessages,
            ...(agentTools.length > 0 ? { tools: agentTools } : {}),
            max_tokens: 4000,
          }),
        });
        if (response.ok) break;
        await response.text(); // consume
      }

      if (!response || !response.ok) {
        return new Response(JSON.stringify({ error: "Errore AI", response: "Mi dispiace, tutti i modelli sono temporaneamente non disponibili." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let result = await response.json();
      let msg = result.choices?.[0]?.message;

      // Tool-calling loop (max 8 iterations)
      let iterations = 0;
      while (msg?.tool_calls?.length && iterations < 8) {
        iterations++;
        const toolResults = [];
        for (const tc of msg.tool_calls) {
          console.log(`[Agent ${agent.name}] Tool: ${tc.function.name}`);
          const args = JSON.parse(tc.function.arguments || "{}");
          const toolResult = await executeTool(tc.function.name, args, userId, authHeader);
          console.log(`[Agent ${agent.name}] Result:`, JSON.stringify(toolResult).substring(0, 300));
          toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(toolResult) });
        }
        allMessages.push(msg);
        allMessages.push(...toolResults);

        // Next LLM call
        let loopOk = false;
        for (const model of fallbackModels) {
          response = await fetch(aiUrl, {
            method: "POST", headers: aiHeaders,
            body: JSON.stringify({ model, messages: allMessages, ...(agentTools.length > 0 ? { tools: agentTools } : {}), max_tokens: 4000 }),
          });
          if (response!.ok) { loopOk = true; break; }
          await response!.text();
        }
        if (!loopOk) break;
        result = await response!.json();
        msg = result.choices?.[0]?.message;
      }

      const responseText = msg?.content || "Nessuna risposta.";
      return new Response(JSON.stringify({ response: responseText }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ━━━ TASK EXECUTION MODE ━━━
    if (task_id) {
      const { data: task, error: taskErr } = await supabase
        .from("agent_tasks")
        .select("*")
        .eq("id", task_id)
        .eq("user_id", userId)
        .single();

      if (taskErr || !task) {
        return new Response(JSON.stringify({ error: "Task non trovato" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark running
      await supabase.from("agent_tasks").update({ status: "running", started_at: new Date().toISOString() }).eq("id", task_id);

      const taskPrompt = `${systemPrompt}

--- COMPITO ASSEGNATO ---
Tipo: ${task.task_type}
Descrizione: ${task.description}
Filtri target: ${JSON.stringify(task.target_filters)}

Esegui il compito usando i tool disponibili. Agisci concretamente sul database. Restituisci un riepilogo delle azioni eseguite e dei risultati.`;

      const allMessages = [
        { role: "system", content: taskPrompt },
        { role: "user", content: "Esegui il compito assegnato." },
      ];

      let response: Response | null = null;
      for (const model of fallbackModels) {
        response = await fetch(aiUrl, {
          method: "POST", headers: aiHeaders,
          body: JSON.stringify({ model, messages: allMessages, ...(agentTools.length > 0 ? { tools: agentTools } : {}), max_tokens: 4000 }),
        });
        if (response.ok) break;
        await response.text();
      }

      let resultSummary = "Esecuzione completata.";
      let taskStatus = "completed";

      if (response && response.ok) {
        let result = await response.json();
        let msg = result.choices?.[0]?.message;

        // Tool-calling loop for task execution
        let iterations = 0;
        while (msg?.tool_calls?.length && iterations < 10) {
          iterations++;
          const toolResults = [];
          for (const tc of msg.tool_calls) {
            console.log(`[Agent ${agent.name} Task] Tool: ${tc.function.name}`);
            const args = JSON.parse(tc.function.arguments || "{}");
            const toolResult = await executeTool(tc.function.name, args, userId, authHeader);
            toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(toolResult) });
          }
          allMessages.push(msg);
          allMessages.push(...toolResults);

          let loopOk = false;
          for (const model of fallbackModels) {
            response = await fetch(aiUrl, {
              method: "POST", headers: aiHeaders,
              body: JSON.stringify({ model, messages: allMessages, ...(agentTools.length > 0 ? { tools: agentTools } : {}), max_tokens: 4000 }),
            });
            if (response!.ok) { loopOk = true; break; }
            await response!.text();
          }
          if (!loopOk) { taskStatus = "failed"; resultSummary = "Errore AI durante l'esecuzione."; break; }
          result = await response!.json();
          msg = result.choices?.[0]?.message;
        }

        if (msg?.content) resultSummary = msg.content;
      } else {
        taskStatus = "failed";
        resultSummary = "Errore durante l'esecuzione del task.";
      }

      // Update task
      const currentLog = (task.execution_log as any[]) || [];
      await supabase.from("agent_tasks").update({
        status: taskStatus,
        result_summary: resultSummary.slice(0, 5000),
        execution_log: [...currentLog, { ts: new Date().toISOString(), result: resultSummary.slice(0, 2000) }] as any,
        completed_at: new Date().toISOString(),
      }).eq("id", task_id);

      // Update agent stats
      const stats = (agent.stats as any) || {};
      await supabase.from("agents").update({
        stats: { ...stats, tasks_completed: (stats.tasks_completed || 0) + 1 } as any,
        updated_at: new Date().toISOString(),
      }).eq("id", agent_id);

      return new Response(JSON.stringify({ success: taskStatus === "completed", result: resultSummary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Specificare chat_messages o task_id" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("agent-execute error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Errore interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
