import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
// TOOL DEFINITIONS (same as ai-assistant)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ALL_TOOLS: Record<string, any> = {
  search_partners: {
    type: "function",
    function: {
      name: "search_partners",
      description: "Search and filter partners. Supports country, city, name, rating, email/phone/profile presence, office type, favorites, services.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string" }, city: { type: "string" }, search_name: { type: "string" },
          has_email: { type: "boolean" }, has_phone: { type: "boolean" }, has_profile: { type: "boolean" },
          min_rating: { type: "number" }, office_type: { type: "string", enum: ["head_office", "branch"] },
          is_favorite: { type: "boolean" }, service: { type: "string" }, network_name: { type: "string" },
          sort_by: { type: "string", enum: ["rating", "name", "recent"] },
          limit: { type: "number" }, count_only: { type: "boolean" },
        },
      },
    },
  },
  get_partner_detail: {
    type: "function",
    function: {
      name: "get_partner_detail",
      description: "Get complete details of a partner: contacts, networks, services, certifications, social links.",
      parameters: { type: "object", properties: { partner_id: { type: "string" }, company_name: { type: "string" } } },
    },
  },
  get_country_overview: {
    type: "function",
    function: {
      name: "get_country_overview",
      description: "Aggregated statistics per country.",
      parameters: { type: "object", properties: { country_code: { type: "string" }, sort_by: { type: "string" }, limit: { type: "number" } } },
    },
  },
  get_directory_status: {
    type: "function",
    function: {
      name: "get_directory_status",
      description: "Directory scanning status for countries.",
      parameters: { type: "object", properties: { country_code: { type: "string" } } },
    },
  },
  list_jobs: {
    type: "function",
    function: {
      name: "list_jobs",
      description: "List download jobs with status and progress.",
      parameters: { type: "object", properties: { status: { type: "string" }, country_code: { type: "string" }, limit: { type: "number" } } },
    },
  },
  get_global_summary: {
    type: "function",
    function: {
      name: "get_global_summary",
      description: "High-level summary of the entire database.",
      parameters: { type: "object", properties: {} },
    },
  },
  check_blacklist: {
    type: "function",
    function: {
      name: "check_blacklist",
      description: "Search the blacklist for companies.",
      parameters: { type: "object", properties: { company_name: { type: "string" }, country: { type: "string" } } },
    },
  },
  list_reminders: {
    type: "function",
    function: {
      name: "list_reminders",
      description: "List reminders.",
      parameters: { type: "object", properties: { status: { type: "string" }, priority: { type: "string" }, partner_name: { type: "string" } } },
    },
  },
  get_partners_without_contacts: {
    type: "function",
    function: {
      name: "get_partners_without_contacts",
      description: "List partners with no contacts.",
      parameters: { type: "object", properties: { country_code: { type: "string" }, limit: { type: "number" } } },
    },
  },
  create_download_job: {
    type: "function",
    function: {
      name: "create_download_job",
      description: "Create a download job for a country.",
      parameters: {
        type: "object",
        properties: { country_code: { type: "string" }, country_name: { type: "string" }, mode: { type: "string" }, network_name: { type: "string" }, delay_seconds: { type: "number" } },
        required: ["country_code", "country_name"],
      },
    },
  },
  download_single_partner: {
    type: "function",
    function: {
      name: "download_single_partner",
      description: "Download a single partner's profile.",
      parameters: {
        type: "object",
        properties: { company_name: { type: "string" }, city: { type: "string" }, country_code: { type: "string" }, wca_id: { type: "number" } },
        required: ["company_name"],
      },
    },
  },
  save_memory: {
    type: "function",
    function: {
      name: "save_memory",
      description: "Save a memory to persistent storage.",
      parameters: {
        type: "object",
        properties: { content: { type: "string" }, memory_type: { type: "string" }, tags: { type: "array", items: { type: "string" } }, importance: { type: "number" } },
        required: ["content", "memory_type", "tags"],
      },
    },
  },
  search_memory: {
    type: "function",
    function: {
      name: "search_memory",
      description: "Search persistent memory.",
      parameters: { type: "object", properties: { tags: { type: "array", items: { type: "string" } }, search_text: { type: "string" }, limit: { type: "number" } } },
    },
  },
  update_partner: {
    type: "function",
    function: {
      name: "update_partner",
      description: "Update partner fields (favorite, lead_status, rating, alias).",
      parameters: {
        type: "object",
        properties: { partner_id: { type: "string" }, company_name: { type: "string" }, is_favorite: { type: "boolean" }, lead_status: { type: "string" }, rating: { type: "number" }, company_alias: { type: "string" } },
      },
    },
  },
  add_partner_note: {
    type: "function",
    function: {
      name: "add_partner_note",
      description: "Add a note/interaction to a partner.",
      parameters: {
        type: "object",
        properties: { partner_id: { type: "string" }, company_name: { type: "string" }, subject: { type: "string" }, notes: { type: "string" }, interaction_type: { type: "string" } },
        required: ["subject"],
      },
    },
  },
  create_reminder: {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Create a reminder for a partner.",
      parameters: {
        type: "object",
        properties: { partner_id: { type: "string" }, company_name: { type: "string" }, title: { type: "string" }, description: { type: "string" }, due_date: { type: "string" }, priority: { type: "string" } },
        required: ["title", "due_date"],
      },
    },
  },
  update_lead_status: {
    type: "function",
    function: {
      name: "update_lead_status",
      description: "Update lead status of contacts.",
      parameters: {
        type: "object",
        properties: { contact_ids: { type: "array", items: { type: "string" } }, company_name: { type: "string" }, country: { type: "string" }, status: { type: "string" } },
        required: ["status"],
      },
    },
  },
  bulk_update_partners: {
    type: "function",
    function: {
      name: "bulk_update_partners",
      description: "Update multiple partners at once.",
      parameters: {
        type: "object",
        properties: { country_code: { type: "string" }, partner_ids: { type: "array", items: { type: "string" } }, is_favorite: { type: "boolean" }, lead_status: { type: "string" } },
      },
    },
  },
  check_job_status: {
    type: "function",
    function: {
      name: "check_job_status",
      description: "Check download job status.",
      parameters: { type: "object", properties: { job_id: { type: "string" }, include_email_queue: { type: "boolean" } } },
    },
  },
  search_contacts: {
    type: "function",
    function: {
      name: "search_contacts",
      description: "Search imported contacts (CRM).",
      parameters: {
        type: "object",
        properties: { search_name: { type: "string" }, company_name: { type: "string" }, country: { type: "string" }, email: { type: "string" }, origin: { type: "string" }, lead_status: { type: "string" }, has_email: { type: "boolean" }, limit: { type: "number" }, count_only: { type: "boolean" } },
      },
    },
  },
  get_contact_detail: {
    type: "function",
    function: {
      name: "get_contact_detail",
      description: "Get full details of an imported contact.",
      parameters: { type: "object", properties: { contact_id: { type: "string" }, contact_name: { type: "string" } } },
    },
  },
  search_prospects: {
    type: "function",
    function: {
      name: "search_prospects",
      description: "Search Italian prospects.",
      parameters: {
        type: "object",
        properties: { company_name: { type: "string" }, city: { type: "string" }, province: { type: "string" }, codice_ateco: { type: "string" }, min_fatturato: { type: "number" }, lead_status: { type: "string" }, limit: { type: "number" }, count_only: { type: "boolean" } },
      },
    },
  },
  list_activities: {
    type: "function",
    function: {
      name: "list_activities",
      description: "List activities from the agenda.",
      parameters: {
        type: "object",
        properties: { status: { type: "string" }, activity_type: { type: "string" }, partner_name: { type: "string" }, due_before: { type: "string" }, due_after: { type: "string" }, limit: { type: "number" } },
      },
    },
  },
  create_activity: {
    type: "function",
    function: {
      name: "create_activity",
      description: "Create a new activity.",
      parameters: {
        type: "object",
        properties: { title: { type: "string" }, description: { type: "string" }, activity_type: { type: "string" }, partner_id: { type: "string" }, company_name: { type: "string" }, due_date: { type: "string" }, priority: { type: "string" }, email_subject: { type: "string" }, email_body: { type: "string" } },
        required: ["title", "activity_type"],
      },
    },
  },
  update_activity: {
    type: "function",
    function: {
      name: "update_activity",
      description: "Update an activity.",
      parameters: {
        type: "object",
        properties: { activity_id: { type: "string" }, status: { type: "string" }, priority: { type: "string" }, due_date: { type: "string" } },
        required: ["activity_id"],
      },
    },
  },
  generate_outreach: {
    type: "function",
    function: {
      name: "generate_outreach",
      description: "Generate outreach message (email, LinkedIn, WhatsApp, SMS).",
      parameters: {
        type: "object",
        properties: { channel: { type: "string" }, contact_name: { type: "string" }, contact_email: { type: "string" }, company_name: { type: "string" }, country_code: { type: "string" }, language: { type: "string" }, goal: { type: "string" }, quality: { type: "string" } },
        required: ["channel", "contact_name", "company_name"],
      },
    },
  },
  send_email: {
    type: "function",
    function: {
      name: "send_email",
      description: "Send an email.",
      parameters: {
        type: "object",
        properties: { to_email: { type: "string" }, to_name: { type: "string" }, subject: { type: "string" }, html_body: { type: "string" }, partner_id: { type: "string" } },
        required: ["to_email", "subject", "html_body"],
      },
    },
  },
  deep_search_partner: {
    type: "function",
    function: {
      name: "deep_search_partner",
      description: "Deep Search a partner (logo, social, web info).",
      parameters: { type: "object", properties: { partner_id: { type: "string" }, company_name: { type: "string" }, force: { type: "boolean" } } },
    },
  },
  deep_search_contact: {
    type: "function",
    function: {
      name: "deep_search_contact",
      description: "Deep Search a contact (LinkedIn, social).",
      parameters: { type: "object", properties: { contact_id: { type: "string" }, contact_name: { type: "string" } } },
    },
  },
  enrich_partner_website: {
    type: "function",
    function: {
      name: "enrich_partner_website",
      description: "Scrape and analyze a partner's website.",
      parameters: { type: "object", properties: { partner_id: { type: "string" }, company_name: { type: "string" } } },
    },
  },
  scan_directory: {
    type: "function",
    function: {
      name: "scan_directory",
      description: "Scan WCA directory for a country or search.",
      parameters: {
        type: "object",
        properties: { country_code: { type: "string" }, search_by: { type: "string" }, company_name: { type: "string" }, city: { type: "string" }, member_id: { type: "number" } },
      },
    },
  },
  generate_aliases: {
    type: "function",
    function: {
      name: "generate_aliases",
      description: "Generate aliases for partner companies or contacts.",
      parameters: {
        type: "object",
        properties: { partner_ids: { type: "array", items: { type: "string" } }, country_code: { type: "string" }, type: { type: "string" }, limit: { type: "number" } },
      },
    },
  },
  manage_partner_contact: {
    type: "function",
    function: {
      name: "manage_partner_contact",
      description: "Add, update, or delete a contact person for a partner.",
      parameters: {
        type: "object",
        properties: { action: { type: "string", enum: ["add", "update", "delete"] }, contact_id: { type: "string" }, partner_id: { type: "string" }, company_name: { type: "string" }, name: { type: "string" }, title: { type: "string" }, email: { type: "string" }, direct_phone: { type: "string" }, mobile: { type: "string" }, is_primary: { type: "boolean" } },
        required: ["action"],
      },
    },
  },
  update_reminder: {
    type: "function",
    function: {
      name: "update_reminder",
      description: "Update or delete a reminder.",
      parameters: {
        type: "object",
        properties: { reminder_id: { type: "string" }, status: { type: "string" }, priority: { type: "string" }, due_date: { type: "string" }, delete: { type: "boolean" } },
        required: ["reminder_id"],
      },
    },
  },
  delete_records: {
    type: "function",
    function: {
      name: "delete_records",
      description: "Delete records from the system.",
      parameters: {
        type: "object",
        properties: { table: { type: "string" }, ids: { type: "array", items: { type: "string" } } },
        required: ["table", "ids"],
      },
    },
  },
  search_business_cards: {
    type: "function",
    function: {
      name: "search_business_cards",
      description: "Search business cards.",
      parameters: { type: "object", properties: { event_name: { type: "string" }, company_name: { type: "string" }, contact_name: { type: "string" }, match_status: { type: "string" }, limit: { type: "number" } } },
    },
  },
  // ━━━ Management Tools (Director only) ━━━
  create_agent_task: {
    type: "function",
    function: {
      name: "create_agent_task",
      description: "Create a task for a subordinate agent. Specify agent by name or role.",
      parameters: {
        type: "object",
        properties: {
          agent_name: { type: "string", description: "Name of the target agent" },
          agent_role: { type: "string", description: "Role of the target agent (fallback if name not found)" },
          task_type: { type: "string", description: "Task type: outreach, download, research, analysis, call" },
          description: { type: "string", description: "Task description" },
          target_filters: { type: "object", description: "Target filters (country, status, etc)" },
        },
        required: ["description", "task_type"],
      },
    },
  },
  list_agent_tasks: {
    type: "function",
    function: {
      name: "list_agent_tasks",
      description: "List tasks across all agents. Filter by status or agent name.",
      parameters: {
        type: "object",
        properties: { status: { type: "string" }, agent_name: { type: "string" }, limit: { type: "number" } },
      },
    },
  },
  get_team_status: {
    type: "function",
    function: {
      name: "get_team_status",
      description: "Get team overview: all agents with their stats, active tasks, last activity.",
      parameters: { type: "object", properties: {} },
    },
  },
  update_agent_prompt: {
    type: "function",
    function: {
      name: "update_agent_prompt",
      description: "Update the system prompt of a subordinate agent.",
      parameters: {
        type: "object",
        properties: { agent_name: { type: "string" }, prompt_addition: { type: "string", description: "Text to append to the agent's system prompt" }, replace_prompt: { type: "string", description: "Complete new prompt (replaces existing)" } },
        required: ["agent_name"],
      },
    },
  },
  add_agent_kb_entry: {
    type: "function",
    function: {
      name: "add_agent_kb_entry",
      description: "Add a knowledge base entry to a subordinate agent.",
      parameters: {
        type: "object",
        properties: { agent_name: { type: "string" }, title: { type: "string" }, content: { type: "string" } },
        required: ["agent_name", "title", "content"],
      },
    },
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOOL EXECUTION (mirrors ai-assistant logic)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function resolvePartnerId(args: Record<string, unknown>): Promise<{ id: string; name: string } | null> {
  if (args.partner_id) {
    const { data } = await supabase.from("partners").select("id, company_name").eq("id", args.partner_id).single();
    return data ? { id: data.id, name: data.company_name } : null;
  }
  if (args.company_name) {
    const { data } = await supabase.from("partners").select("id, company_name").ilike("company_name", `%${args.company_name}%`).limit(1).single();
    return data ? { id: data.id, name: data.company_name } : null;
  }
  return null;
}

async function executeTool(name: string, args: Record<string, unknown>, userId: string, authHeader: string): Promise<unknown> {
  switch (name) {
    case "search_partners": {
      const isCount = !!args.count_only;
      let query = supabase.from("partners").select(
        isCount ? "id" : "id, company_name, city, country_code, country_name, email, phone, rating, wca_id, website, raw_profile_html, is_favorite, office_type, lead_status",
        isCount ? { count: "exact", head: true } : undefined
      );
      if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
      if (args.city) query = query.ilike("city", `%${args.city}%`);
      if (args.search_name) query = query.ilike("company_name", `%${args.search_name}%`);
      if (args.has_email === true) query = query.not("email", "is", null);
      if (args.has_profile === true) query = query.not("raw_profile_html", "is", null);
      if (args.has_profile === false) query = query.is("raw_profile_html", null);
      if (args.min_rating) query = query.gte("rating", Number(args.min_rating));
      if (args.office_type) query = query.eq("office_type", args.office_type);
      if (args.is_favorite === true) query = query.eq("is_favorite", true);
      query = query.order("rating", { ascending: false, nullsFirst: false }).limit(Math.min(Number(args.limit) || 20, 50));
      const { data, error, count } = await query;
      if (error) return { error: error.message };
      if (isCount) return { count };
      return { count: data?.length, partners: (data || []).map((p: any) => ({ id: p.id, company_name: p.company_name, city: p.city, country_code: p.country_code, country_name: p.country_name, email: p.email, rating: p.rating, has_profile: !!p.raw_profile_html, lead_status: p.lead_status })) };
    }

    case "get_partner_detail": {
      let partner: any = null;
      if (args.partner_id) { const { data } = await supabase.from("partners").select("*").eq("id", args.partner_id).single(); partner = data; }
      else if (args.company_name) { const { data } = await supabase.from("partners").select("*").ilike("company_name", `%${args.company_name}%`).limit(1).single(); partner = data; }
      if (!partner) return { error: "Partner non trovato" };
      const [contactsRes, networksRes, servicesRes] = await Promise.all([
        supabase.from("partner_contacts").select("name, email, title, direct_phone, mobile, is_primary").eq("partner_id", partner.id),
        supabase.from("partner_networks").select("network_name, expires").eq("partner_id", partner.id),
        supabase.from("partner_services").select("service_category").eq("partner_id", partner.id),
      ]);
      return {
        id: partner.id, company_name: partner.company_name, city: partner.city, country_code: partner.country_code,
        email: partner.email, phone: partner.phone, website: partner.website, rating: partner.rating,
        lead_status: partner.lead_status, has_profile: !!partner.raw_profile_html,
        profile_summary: partner.raw_profile_markdown?.substring(0, 1500) || null,
        contacts: contactsRes.data || [], networks: networksRes.data || [],
        services: (servicesRes.data || []).map((s: any) => s.service_category),
      };
    }

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
      if (args.company_name) query = query.ilike("company_name", `%${args.company_name}%`);
      if (args.country) query = query.ilike("country", `%${args.country}%`);
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

    case "get_partners_without_contacts": {
      let query = supabase.from("partners_no_contacts").select("wca_id, company_name, city, country_code, retry_count").eq("resolved", false).limit(Number(args.limit) || 30);
      if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data?.length || 0, partners: data || [] };
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
      return { success: true, job_id: job.id, total: wcaIds.length, message: `Job creato: ${wcaIds.length} partner per ${cn}.` };
    }

    case "download_single_partner": {
      const name = String(args.company_name || "").trim();
      if (!name) return { error: "Nome azienda obbligatorio" };
      const { data: found } = await supabase.from("partners").select("id, wca_id, company_name, country_code, country_name, raw_profile_html").ilike("company_name", `%${name}%`).limit(1);
      if (!found || found.length === 0) return { error: `"${name}" non trovata nel database.` };
      const p = found[0];
      if (p.raw_profile_html) return { success: true, already_downloaded: true, message: `"${p.company_name}" ha già il profilo.` };
      if (!p.wca_id) return { error: `"${p.company_name}" non ha wca_id.` };
      const { data: active } = await supabase.from("download_jobs").select("id").in("status", ["pending", "running"]).limit(1);
      if (active && active.length > 0) return { error: "C'è già un job attivo." };
      const { data: job, error } = await supabase.from("download_jobs").insert({ country_code: p.country_code, country_name: p.country_name, wca_ids: [p.wca_id] as any, total_count: 1, delay_seconds: 15, status: "pending" }).select("id").single();
      if (error) return { error: error.message };
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
      if (args.search_text) query = query.ilike("content", `%${args.search_text}%`);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data?.length || 0, memories: data || [] };
    }

    case "update_partner": {
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

    case "add_partner_note": {
      const partner = await resolvePartnerId(args);
      if (!partner) return { error: "Partner non trovato" };
      const { error } = await supabase.from("interactions").insert({ partner_id: partner.id, interaction_type: String(args.interaction_type || "note"), subject: String(args.subject), notes: args.notes ? String(args.notes) : null });
      if (error) return { error: error.message };
      return { success: true, message: `Nota aggiunta a "${partner.name}".` };
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

    case "bulk_update_partners": {
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
      if (args.search_name) query = query.ilike("name", `%${args.search_name}%`);
      if (args.company_name) query = query.ilike("company_name", `%${args.company_name}%`);
      if (args.country) query = query.ilike("country", `%${args.country}%`);
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
      else if (args.contact_name) { const { data } = await supabase.from("imported_contacts").select("*").ilike("name", `%${args.contact_name}%`).limit(1).single(); contact = data; }
      if (!contact) return { error: "Contatto non trovato" };
      return contact;
    }

    case "search_prospects": {
      let query = supabase.from("prospects").select("id, company_name, city, province, codice_ateco, fatturato, email, lead_status");
      if (args.company_name) query = query.ilike("company_name", `%${args.company_name}%`);
      if (args.city) query = query.ilike("city", `%${args.city}%`);
      if (args.codice_ateco) query = query.ilike("codice_ateco", `%${args.codice_ateco}%`);
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
      if (!cid && args.contact_name) { const { data } = await supabase.from("imported_contacts").select("id").ilike("name", `%${args.contact_name}%`).limit(1).single(); if (data) cid = data.id; }
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
      if (args.country_code) body.country_code = String(args.country_code).toUpperCase();
      if (args.search_by) body.searchBy = args.search_by;
      if (args.company_name) body.companyName = args.company_name;
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
      if (args.company_name) query = query.ilike("company_name", `%${args.company_name}%`);
      if (args.event_name) query = query.ilike("event_name", `%${args.event_name}%`);
      const { data, error } = await query;
      return error ? { error: error.message } : { count: data?.length || 0, cards: data || [] };
    }

    // ━━━ Management Tools ━━━
    case "create_agent_task": {
      // Find agent by name or role
      let agentQuery = supabase.from("agents").select("id, name").eq("user_id", userId);
      if (args.agent_name) agentQuery = agentQuery.ilike("name", `%${args.agent_name}%`);
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
      const { data: agents } = await supabase.from("agents").select("id, name, system_prompt").eq("user_id", userId).ilike("name", `%${args.agent_name}%`).limit(1);
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
      const { data: agents } = await supabase.from("agents").select("id, name, knowledge_base").eq("user_id", userId).ilike("name", `%${args.agent_name}%`).limit(1);
      if (!agents || agents.length === 0) return { error: `Agente "${args.agent_name}" non trovato.` };
      const agent = agents[0];
      const kb = (agent.knowledge_base as any[]) || [];
      kb.push({ title: String(args.title), content: String(args.content), added_at: new Date().toISOString() });
      const { error } = await supabase.from("agents").update({ knowledge_base: kb as any, updated_at: new Date().toISOString() }).eq("id", agent.id);
      if (error) return { error: error.message };
      return { success: true, agent_name: agent.name, kb_entries: kb.length, message: `KB entry "${args.title}" aggiunta a ${agent.name}.` };
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

    // Build system prompt with KB
    let systemPrompt = agent.system_prompt || "Sei un agente AI.";
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
