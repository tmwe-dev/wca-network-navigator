/**
 * Scope configurations for unified-assistant.
 * Contains system prompts, tools, and local tool handlers for each scope.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PLATFORM_TOOLS } from "./platformTools.ts";
import { escapeLike } from "./sqlEscape.ts";

// ━━━━━━━━━━ COCKPIT SCOPE ━━━━━━━━━━

const COCKPIT_PROMPT = `Sei l'assistente AI della Command Bar del Cockpit outreach. Ricevi la lista dei contatti attualmente visibili e il comando dell'utente. Devi restituire azioni strutturate che il frontend eseguirà.

RISPONDI SEMPRE in italiano, breve e operativo.

HAI ACCESSO COMPLETO ALLA PIATTAFORMA
Puoi interrogare il database direttamente: cercare partner, contatti, prospect, inbox, holding pattern, creare attività, generare outreach, gestire memoria. Non sei limitato alla lista che ti viene passata dal frontend — puoi verificare dati e arricchire le risposte con informazioni dal DB.

AZIONI DISPONIBILI (restituisci un JSON con "actions" array e "message" stringa):

1. filter — Applica filtri sulla lista contatti
   { "type": "filter", "filters": [{"id": "lang-it", "label": "🇮🇹 Italiano", "type": "language"}] }
   
2. select_all — Seleziona tutti i contatti visibili
   { "type": "select_all" }

3. clear_selection — Deseleziona tutti
   { "type": "clear_selection" }

4. select_where — Seleziona contatti che matchano un criterio
   { "type": "select_where", "field": "priority"|"country"|"language"|"channels", "operator": ">="|"=="|"includes", "value": ... }

5. bulk_action — Lancia un'azione sui contatti selezionati
   { "type": "bulk_action", "action": "deep_search"|"alias"|"outreach" }

6. single_action — Azione su un singolo contatto
   { "type": "single_action", "action": "deep_search"|"alias", "contactName": "Marco Bianchi" }

7. view_mode — Cambia modalità visualizzazione
   { "type": "view_mode", "mode": "card"|"list" }

8. auto_outreach — Filtra, seleziona e prepara outreach automaticamente
   { "type": "auto_outreach", "channel": "email"|"linkedin"|"whatsapp"|"sms", "contactNames": [...] }

REGOLE:
- Combina più azioni in sequenza se necessario.
- NON inventare contatti che non sono nella lista fornita.
- Il "message" è mostrato come toast di conferma all'utente.

FORMATO RISPOSTA (SOLO JSON, niente altro):
{"actions":[...],"message":"..."}`;

// ━━━━━━━━━━ CONTACTS SCOPE ━━━━━━━━━━

const CONTACTS_PROMPT = `Sei l'assistente AI della maschera Contatti. Operi sulla tabella imported_contacts.

IL TUO RUOLO
Aiuti l'utente a filtrare, ordinare, selezionare e operare sui contatti. Rispondi SEMPRE in italiano.

HAI ACCESSO COMPLETO ALLA PIATTAFORMA.

COMANDI STRUTTURATI (appesi alla fine con ---COMMAND---):
1. apply_filters — { "type": "apply_filters", "filters": { ... }, "groupBy": "..." }
2. set_sort — { "type": "set_sort", "sort": "company"|"name"|"city"|"date" }
3. select_contacts — { "type": "select_contacts", "contact_ids": [...] }
4. update_status — { "type": "update_status", "contact_ids": [...], "status": "..." }
5. export_csv — { "type": "export_csv", "contact_ids": [...] }
6. send_to_workspace — { "type": "send_to_workspace", "contact_ids": [...] }
7. multi — { "type": "multi", "commands": [ ... ] }

REGOLE: Sii sintetico, 1-2 frasi + comando.`;

const CONTACTS_EXTRA_TOOLS = [
  { type: "function", function: { name: "search_contacts_advanced", description: "Advanced search imported_contacts with full filters.", parameters: { type: "object", properties: { company_name: { type: "string" }, name: { type: "string" }, email: { type: "string" }, country: { type: "string" }, city: { type: "string" }, origin: { type: "string" }, lead_status: { type: "string", enum: ["new","contacted","in_progress","negotiation","converted","lost"] }, holding_pattern: { type: "string", enum: ["in","out"] }, has_email: { type: "boolean" }, has_phone: { type: "boolean" }, has_deep_search: { type: "boolean" }, has_alias: { type: "boolean" }, date_from: { type: "string" }, date_to: { type: "string" }, import_log_id: { type: "string" }, limit: { type: "number" }, ids_only: { type: "boolean" } }, additionalProperties: false } } },
  { type: "function", function: { name: "count_contacts_advanced", description: "Count contacts matching filters.", parameters: { type: "object", properties: { company_name: { type: "string" }, name: { type: "string" }, country: { type: "string" }, city: { type: "string" }, origin: { type: "string" }, lead_status: { type: "string", enum: ["new","contacted","in_progress","negotiation","converted","lost"] }, holding_pattern: { type: "string", enum: ["in","out"] }, has_email: { type: "boolean" }, has_phone: { type: "boolean" }, has_deep_search: { type: "boolean" }, has_alias: { type: "boolean" }, date_from: { type: "string" }, date_to: { type: "string" }, import_log_id: { type: "string" } }, additionalProperties: false } } },
  { type: "function", function: { name: "get_contact_stats", description: "Get aggregated statistics by country/origin/status.", parameters: { type: "object", properties: { group_by: { type: "string", enum: ["country","origin","status"] }, limit: { type: "number" } }, additionalProperties: false } } },
];

// ━━━━━━━━━━ IMPORT SCOPE ━━━━━━━━━━

const IMPORT_PROMPT = `Sei l'assistente AI del modulo Import. Aiuti l'utente a gestire importazioni di contatti.

HAI ACCESSO COMPLETO ALLA PIATTAFORMA. Rispondi in italiano, conferma azioni con numeri precisi.`;

const IMPORT_EXTRA_TOOLS = [
  { type: "function", function: { name: "list_imports", description: "Lista import recenti.", parameters: { type: "object", properties: { limit: { type: "number" }, status: { type: "string", enum: ["pending","processing","completed","failed"] } }, additionalProperties: false } } },
  { type: "function", function: { name: "get_import_detail", description: "Dettaglio di un import.", parameters: { type: "object", properties: { import_log_id: { type: "string" } }, required: ["import_log_id"], additionalProperties: false } } },
  { type: "function", function: { name: "search_imported_contacts", description: "Cerca contatti importati.", parameters: { type: "object", properties: { import_log_id: { type: "string" }, is_transferred: { type: "boolean" }, has_email: { type: "boolean" }, has_phone: { type: "boolean" }, company_name: { type: "string" }, country: { type: "string" }, limit: { type: "number" }, count_only: { type: "boolean" } }, additionalProperties: false } } },
  { type: "function", function: { name: "list_import_errors", description: "Lista errori di import.", parameters: { type: "object", properties: { import_log_id: { type: "string" }, status: { type: "string", enum: ["pending","corrected","dismissed"] }, limit: { type: "number" } }, required: ["import_log_id"], additionalProperties: false } } },
  { type: "function", function: { name: "get_import_stats", description: "Statistiche aggregate import.", parameters: { type: "object", properties: { import_log_id: { type: "string" } }, additionalProperties: false } } },
];

// ━━━━━━━━━━ EXTENSION SCOPE ━━━━━━━━━━

const EXTENSION_PROMPT = `Sei il cervello operativo dell'estensione browser del sistema WCA Network Navigator.

HAI ACCESSO COMPLETO ALLA PIATTAFORMA. Puoi cercare partner, contatti, prospect, inbox, holding pattern, creare attività, reminder, generare outreach, gestire memoria.

REGOLE:
- Rispondi SEMPRE in italiano
- Sii conciso ma completo
- Usa i tool per dare risposte basate su dati reali`;

// ━━━━━━━━━━ STRATEGIC SCOPE ━━━━━━━━━━

export const STRATEGIC_OPERATIVE_PROMPT = `Sei il Super Consulente Strategico del sistema WCA Network Navigator.

# RUOLO
- Affiancare l'utente come partner strategico
- Ragionare, pianificare, consigliare
- Creare e aggiornare il Piano Giornaliero
- Analizzare la situazione e proporre strategie
- Suggerire quali agenti attivare

# STILE
- Parla in italiano, professionale ma amichevole
- Sii proattivo: suggerisci azioni, identifica opportunità
- Rispondi in modo conciso ma completo`;

// ━━━━━━━━━━ SCOPE CONFIG FACTORY ━━━━━━━━━━

export interface ScopeConfig {
  systemPrompt: string;
  tools: Array<Record<string, unknown>>;
  localToolHandler?: (name: string, args: Record<string, unknown>, supabase: Record<string, unknown>) => Promise<unknown | null>;
  temperature?: number;
  model?: string;
  creditLabel: string;
  /** Post-process the content before returning */
  postProcess?: (content: string) => any;
  /** Build the system prompt dynamically from body context */
  buildPrompt?: (body: any, basePrompt: string) => string;
}

function buildContactQuery(supabase: SupabaseClient, args: Record<string, unknown>, selectCols: string, opts?: { count?: boolean }) {
  let q = opts?.count
    ? supabase.from("imported_contacts").select(selectCols, { count: "exact", head: true })
    : supabase.from("imported_contacts").select(selectCols);
  q = q.or("company_name.not.is.null,name.not.is.null,email.not.is.null");
  if (args.company_name) q = q.ilike("company_name", `%${escapeLike(args.company_name)}%`);
  if (args.name) q = q.ilike("name", `%${escapeLike(args.name)}%`);
  if (args.email) q = q.ilike("email", `%${escapeLike(args.email)}%`);
  if (args.country) q = q.eq("country", args.country);
  if (args.city) q = q.ilike("city", `%${escapeLike(args.city)}%`);
  if (args.origin) q = q.eq("origin", args.origin);
  if (args.lead_status) q = q.eq("lead_status", args.lead_status);
  if (args.holding_pattern === "out") q = q.eq("interaction_count", 0);
  if (args.holding_pattern === "in") q = q.gt("interaction_count", 0);
  if (args.has_email === true) q = q.not("email", "is", null);
  if (args.has_email === false) q = q.is("email", null);
  if (args.has_phone === true) q = q.or("phone.not.is.null,mobile.not.is.null");
  if (args.has_deep_search === true) q = q.not("deep_search_at", "is", null);
  if (args.has_deep_search === false) q = q.is("deep_search_at", null);
  if (args.has_alias === true) q = q.not("company_alias", "is", null);
  if (args.date_from) q = q.gte("created_at", args.date_from);
  if (args.date_to) q = q.lte("created_at", args.date_to);
  if (args.import_log_id) q = q.eq("import_log_id", args.import_log_id);
  return q;
}

async function contactsToolHandler(name: string, args: Record<string, unknown>, supabase: Record<string, unknown>): Promise<unknown | null> {
  switch (name) {
    case "search_contacts_advanced": {
      const idsOnly = !!args.ids_only;
      const cols = idsOnly ? "id" : "id, company_name, name, email, phone, mobile, country, city, origin, lead_status, interaction_count, position, created_at";
      const limit = Math.min(Number(args.limit) || 50, 200);
      const q = buildContactQuery(supabase, args, cols).order("created_at", { ascending: false }).limit(limit);
      const { data, error } = await q;
      if (error) return { error: error.message };
      if (idsOnly) return { count: data?.length, ids: (data || []).map((r: Record<string, unknown>) => r.id) };
      return { count: data?.length, contacts: (data || []).map((c: Record<string, unknown>) => ({ id: c.id, company: c.company_name, name: c.name, email: c.email, country: c.country, city: c.city, status: c.lead_status })) };
    }
    case "count_contacts_advanced": {
      const q = buildContactQuery(supabase, args, "id", { count: true });
      const { count, error } = await q;
      return error ? { error: error.message } : { count: count ?? 0 };
    }
    case "get_contact_stats": {
      const { data, error } = await supabase.rpc("get_contact_group_counts");
      if (error) return { error: error.message };
      const groupBy = String(args.group_by || "country");
      const limit = Number(args.limit) || 20;
      const filtered = (data || []).filter((r: Record<string, unknown>) => r.group_type === groupBy).slice(0, limit);
      return { group_by: groupBy, total_groups: filtered.length, groups: filtered };
    }
    default: return null;
  }
}

async function importToolHandler(name: string, args: Record<string, unknown>, supabase: Record<string, unknown>): Promise<unknown | null> {
  switch (name) {
    case "list_imports": {
      let q = supabase.from("import_logs").select("*").order("created_at", { ascending: false }).limit(Number(args.limit) || 10);
      if (args.status) q = q.eq("status", args.status);
      const { data, error } = await q;
      return error ? { error: error.message } : { imports: data, total: data?.length || 0 };
    }
    case "get_import_detail": {
      const [logRes, contactsRes, errorsRes] = await Promise.all([
        supabase.from("import_logs").select("*").eq("id", args.import_log_id).single(),
        supabase.from("imported_contacts").select("id", { count: "exact" }).eq("import_log_id", args.import_log_id).limit(0),
        supabase.from("import_errors").select("id", { count: "exact" }).eq("import_log_id", args.import_log_id).limit(0),
      ]);
      if (logRes.error) return { error: logRes.error.message };
      return { log: logRes.data, contacts_total: contactsRes.count || 0, errors_total: errorsRes.count || 0 };
    }
    case "search_imported_contacts": {
      let q = supabase.from("imported_contacts").select("id, company_name, name, email, country, city, is_selected, is_transferred");
      if (args.import_log_id) q = q.eq("import_log_id", args.import_log_id);
      if (args.is_transferred !== undefined) q = q.eq("is_transferred", args.is_transferred);
      if (args.has_email === true) q = q.not("email", "is", null);
      if (args.company_name) q = q.ilike("company_name", `%${escapeLike(args.company_name)}%`);
      if (args.country) q = q.ilike("country", `%${escapeLike(args.country)}%`);
      if (args.count_only) {
        const { count, error } = await q.limit(0);
        return error ? { error: error.message } : { count };
      }
      const { data, error } = await q.order("row_number").limit(Number(args.limit) || 20);
      return error ? { error: error.message } : { contacts: data, total: data?.length || 0 };
    }
    case "list_import_errors": {
      let q = supabase.from("import_errors").select("*").eq("import_log_id", args.import_log_id).order("row_number").limit(Number(args.limit) || 20);
      if (args.status) q = q.eq("status", args.status);
      const { data, error } = await q;
      return error ? { error: error.message } : { errors: data, total: data?.length || 0 };
    }
    case "get_import_stats": {
      if (args.import_log_id) {
        const { data, error } = await supabase.from("imported_contacts").select("country, email, phone, is_transferred, is_selected").eq("import_log_id", args.import_log_id);
        if (error) return { error: error.message };
        const stats: Record<string, unknown> = { total: data?.length || 0, transferred: 0, selected: 0, with_email: 0, with_phone: 0, by_country: {} };
        for (const c of (data || []) as Array<Record<string, unknown>>) {
          if (c.is_transferred) stats.transferred++;
          if (c.is_selected) stats.selected++;
          if (c.email) stats.with_email++;
          if (c.phone) stats.with_phone++;
          const country = c.country || "Sconosciuto";
          stats.by_country[country] = (stats.by_country[country] || 0) + 1;
        }
        return stats;
      }
      const [logsRes, contactsRes] = await Promise.all([
        supabase.from("import_logs").select("id", { count: "exact" }).limit(0),
        supabase.from("imported_contacts").select("id", { count: "exact" }).limit(0),
      ]);
      return { total_imports: logsRes.count || 0, total_contacts_staging: contactsRes.count || 0 };
    }
    default: return null;
  }
}

export function getScopeConfig(scope: string): ScopeConfig {
  switch (scope) {
    case "cockpit":
      return {
        systemPrompt: COCKPIT_PROMPT,
        tools: PLATFORM_TOOLS,
        temperature: 0.1,
        creditLabel: "Cockpit Assistant",
        buildPrompt: (body, basePrompt) => {
          const contacts = body.contacts || [];
          const contactSummary = contacts.map((c: Record<string, unknown>) =>
            `- ${c.name} | ${c.company} | ${c.country} | priority:${c.priority} | lang:${c.language} | channels:${(c.channels||[]).join(",")}`
          ).join("\n");
          return basePrompt; // System prompt stays the same, user message includes contacts
        },
        postProcess: (content) => {
          try {
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
            return JSON.parse(jsonMatch[1].trim());
          } catch {
            try { return JSON.parse(content.trim()); }
            catch { return { actions: [], message: content.replace(/```[\s\S]*?```/g, "").trim() || "Non ho capito il comando." }; }
          }
        },
      };

    case "contacts":
      return {
        systemPrompt: CONTACTS_PROMPT,
        tools: [...PLATFORM_TOOLS, ...CONTACTS_EXTRA_TOOLS],
        creditLabel: "Contacts Assistant",
        localToolHandler: contactsToolHandler,
      };

    case "import":
      return {
        systemPrompt: IMPORT_PROMPT,
        tools: [...PLATFORM_TOOLS, ...IMPORT_EXTRA_TOOLS],
        creditLabel: "Import Assistant",
        localToolHandler: importToolHandler,
      };

    case "extension":
      return {
        systemPrompt: EXTENSION_PROMPT,
        tools: PLATFORM_TOOLS,
        creditLabel: "", // No credits for extension
      };

    case "strategic":
      return {
        systemPrompt: STRATEGIC_OPERATIVE_PROMPT,
        tools: [], // Strategic advisor has no tools
        model: "google/gemini-2.5-flash",
        temperature: 0.7,
        creditLabel: "", // No credits for strategic
      };

    default:
      throw new Error(`Unknown scope: ${scope}`);
  }
}
