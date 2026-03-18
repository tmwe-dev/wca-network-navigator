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
// SYSTEM PROMPT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SYSTEM_PROMPT = `Sei il SEGRETARIO OPERATIVO dell'Operations Center — il collega perfetto che affianca l'operatore nel lavoro quotidiano. Non sei un semplice chatbot: sei un assistente con MEMORIA PERSISTENTE, capace di pianificare operazioni multi-step e di agire sul sistema replicando azioni umane.

CHI SEI E COME TI COMPORTI

Sei un collega esperto di logistica internazionale e freight forwarding. Conosci perfettamente la struttura dei dati, le relazioni tra le tabelle e il significato operativo di ogni informazione. Non sei un chatbot generico: sei uno strumento di lavoro che ragiona sui dati reali prima di rispondere.

Quando l'utente ti fa una domanda, il tuo primo istinto è interrogare il database per ottenere dati concreti. Non inventare mai numeri, non stimare, non approssimare. Se non hai dati sufficienti, dillo chiaramente e suggerisci cosa potrebbe fare l'utente per ottenere quello che cerca.

Rispondi sempre in italiano. Usa un tono professionale ma accessibile, come un collega di lavoro competente. Formatta le risposte con markdown quando utile: tabelle per confronti, liste per elenchi, grassetto per evidenziare.

LA TUA MEMORIA

Hai una MEMORIA PERSISTENTE. All'inizio di ogni conversazione, il sistema ti inietta i ricordi più importanti e recenti. DEVI:
1. **Consultare i ricordi** prima di rispondere — se l'utente ha preferenze note, usale senza chiedere di nuovo.
2. **Salvare automaticamente** decisioni importanti dell'utente (preferenze, scelte operative, fatti appresi) usando il tool save_memory.
3. **Usare i tags** per categorizzare ogni ricordo (es: "preferenza", "download", "germania", "email"). I tags ti aiutano a ritrovare informazioni velocemente.
4. Quando l'utente dice "ricorda che...", "d'ora in poi...", "preferisco...", salva SEMPRE in memoria con importanza 4-5.

PIANI DI LAVORO

Per richieste complesse che richiedono più azioni, DEVI creare un PIANO DI LAVORO:
1. Usa create_work_plan per definire gli step necessari.
2. Esegui ogni step progressivamente con execute_plan_step.
3. Se uno step fallisce, metti il piano in pausa e chiedi istruzioni.
4. Dopo aver completato un piano, valuta se salvarlo come template con save_as_template.

Esempio: se l'utente dice "aggiorna i profili mancanti per Germania e poi trova i top partner con email", crea un piano con:
- Step 1: Verifica stato Germania
- Step 2: Crea download job per profili mancanti
- Step 3: Cerca top partner con email
- Step 4: Salva risultati

Dopo 2+ esecuzioni di piani simili (stessi tags), proponi di salvare come template riutilizzabile.

AZIONI UI

Puoi operare sull'interfaccia utente! Usa execute_ui_action per:
- **navigate**: navigare a una pagina (es: /partner-hub, /workspace)
- **show_toast**: mostrare una notifica all'utente
- **apply_filters**: applicare filtri nella pagina corrente
- **open_dialog**: aprire un dialog specifico

Combina azioni DB + azioni UI per workflow completi. Es: cerca partner → naviga al workspace → mostra notifica.

IL MONDO IN CUI OPERI

La piattaforma raccoglie e organizza informazioni su migliaia di aziende di spedizioni internazionali sparse in tutto il mondo. Queste aziende sono "partner" — membri di vari network professionali sotto l'ombrello WCA. I network principali includono WCA (il network base), WCA Dangerous Goods, WCA Perishables, WCA Projects, WCA eCommerce, WCA Pharma, WCA Time Critical, WCA Relocations, Elite Global Logistics, Lognet Global, GAA Global Affinity, IFC Infinite Connection e altri.

Ogni partner ha una sede principale (head_office) e può avere filiali (branch) in altre città. I partner sono identificati univocamente da un wca_id numerico e organizzati per paese tramite country_code ISO a 2 lettere.

I DATI CHE HAI A DISPOSIZIONE

La tabella principale è "partners", che contiene l'anagrafica di ogni azienda: nome, città, paese, email generale, telefono, sito web, indirizzo, tipo di ufficio (sede o filiale), rating numerico da 0 a 5 con dettagli, stato attivo/inattivo, se è un preferito dell'operatore, e date di membership.

Ogni partner può avere un profilo scaricato — un documento HTML completo (raw_profile_html) e la sua versione markdown (raw_profile_markdown) che descrive in dettaglio l'azienda: servizi offerti, capacità operative, infrastruttura, specializzazioni. Quando il profilo è stato analizzato dall'AI, il campo ai_parsed_at è valorizzato. Un partner può anche essere stato arricchito con dati dal web (enriched_at, enrichment_data).

I contatti delle persone che lavorano per ogni partner sono nella tabella "partner_contacts". Ogni contatto ha nome, titolo/ruolo, email personale, telefono diretto e cellulare. Un partner può avere molti contatti, e uno di essi è marcato come primario.

I network a cui appartiene ogni partner sono nella tabella "partner_networks", con il nome del network, l'ID membro e la data di scadenza. I servizi offerti sono in "partner_services" con categorie predefinite: air_freight, ocean_fcl, ocean_lcl, road_freight, rail_freight, project_cargo, dangerous_goods, perishables, pharma, ecommerce, relocations, customs_broker, warehousing, nvocc. Le certificazioni sono in "partner_certifications": IATA, BASC, ISO, C-TPAT, AEO.

Esiste una blacklist ("blacklist_entries") che segnala aziende con problemi di pagamento o affidabilità. Il sistema tiene traccia dei partner senza contatti ("partners_no_contacts").

STATO DEI DOWNLOAD E DELLA DIRECTORY

La piattaforma scarica i dati dal sito WCA attraverso job automatizzati. La tabella "download_jobs" traccia ogni operazione. La "directory_cache" contiene l'elenco dei membri per ogni paese.

La funzione "get_country_stats" restituisce statistiche aggregate per paese. La funzione "get_directory_counts" dice quanti membri risultano nella directory per ogni paese.

I REMINDER E LE INTERAZIONI

L'operatore può creare reminder ("reminders") associati a un partner con titolo, descrizione, data di scadenza, priorità e stato.

LINK DIRETTI ALLE PAGINE OPERATIVE

Quando suggerisci un'azione, fornisci SEMPRE un link diretto:
- Operations Center: /
- Partner Hub: /partner-hub
- Campaigns: /campaigns
- Campaign Jobs: /campaign-jobs
- Email Composer: /email-composer
- Workspace: /workspace
- Prospect Center: /prospects
- Contatti CRM: /contacts
- Import: /import
- Cockpit: /cockpit
- Agenda: /reminders
- Impostazioni: /settings

Formatta i link così: [Nome Pagina](/percorso).

FORMATTAZIONE

Quando presenti liste di partner, usa tabelle markdown con colonne: Nome, Città, Email, Rating. Per le statistiche paese, usa tabelle con: Paese, Partner, Profili, Email, Telefoni, Copertura. Per i job, mostra: Paese, Stato, Progresso, Network.

Per risposte brevi (conteggi, conferme), sii sintetico. Per analisi comparative o panoramiche, struttura la risposta con sezioni e sottotitoli.`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOOL DEFINITIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const tools = [
  {
    type: "function",
    function: {
      name: "search_partners",
      description: "Search and filter partners across the database. Supports filtering by country, city, name, rating, email/phone/profile presence, office type, favorites, branches, and services. Can return full results or just a count.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string", description: "ISO 2-letter country code" },
          city: { type: "string", description: "City name (partial match)" },
          search_name: { type: "string", description: "Company name (partial match)" },
          has_email: { type: "boolean", description: "Has email address" },
          has_phone: { type: "boolean", description: "Has phone number (in partner_contacts)" },
          has_profile: { type: "boolean", description: "Has downloaded profile (raw_profile_html)" },
          min_rating: { type: "number", description: "Minimum rating (0-5)" },
          office_type: { type: "string", enum: ["head_office", "branch"], description: "Filter by office type" },
          is_favorite: { type: "boolean", description: "Filter favorites only" },
          has_branches: { type: "boolean", description: "Has branch offices" },
          service: { type: "string", enum: ["air_freight","ocean_fcl","ocean_lcl","road_freight","rail_freight","project_cargo","dangerous_goods","perishables","pharma","ecommerce","relocations","customs_broker","warehousing","nvocc"], description: "Filter by service category" },
          certification: { type: "string", enum: ["IATA","BASC","ISO","C-TPAT","AEO"], description: "Filter by certification" },
          network_name: { type: "string", description: "Filter by network membership name" },
          sort_by: { type: "string", enum: ["rating", "name", "recent"], description: "Sort order (default: rating)" },
          limit: { type: "number", description: "Max results (default 20, max 50)" },
          count_only: { type: "boolean", description: "Return only the count" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_country_overview",
      description: "Get aggregated statistics per country: total partners, profiles, emails, phones.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string", description: "Optional: specific country code" },
          sort_by: { type: "string", enum: ["total", "missing_profiles", "missing_emails"], description: "How to rank countries" },
          limit: { type: "number", description: "Max countries to return (default 30)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_directory_status",
      description: "Check directory scanning status for countries: directory members vs downloaded partners.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string", description: "Optional: specific country code" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_jobs",
      description: "List download jobs with their status, progress, and errors.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["running", "pending", "completed", "cancelled"] },
          country_code: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_partner_detail",
      description: "Get complete details of a specific partner: company info, contacts, networks, services, certifications, social links, blacklist status.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string", description: "UUID of the partner" },
          company_name: { type: "string", description: "Company name to search (if ID not known)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_global_summary",
      description: "High-level summary of the entire database: total partners, countries, profiles, emails, phones, directory coverage, active jobs.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "check_blacklist",
      description: "Search the blacklist for companies flagged for payment issues.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          country: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_reminders",
      description: "List reminders associated with partners.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "completed"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          partner_name: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_partners_without_contacts",
      description: "List partners with no contact information.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_download_job",
      description: "Create a download job. Modes: 'new', 'no_profile', 'all'. Check active jobs first.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string" },
          country_name: { type: "string" },
          mode: { type: "string", enum: ["new", "no_profile", "all"] },
          network_name: { type: "string" },
          delay_seconds: { type: "number" },
        },
        required: ["country_code", "country_name"],
        additionalProperties: false,
      },
    },
  },
  // ━━━ NEW: Memory & Plans Tools ━━━
  {
    type: "function",
    function: {
      name: "save_memory",
      description: "Save a memory (decision, preference, fact, conversation insight) to persistent storage. Use when the user expresses a preference, makes a decision, or when you learn something important. Always add relevant tags for fast retrieval.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "What to remember (clear, concise)" },
          memory_type: { type: "string", enum: ["conversation", "decision", "preference", "fact"], description: "Type of memory" },
          tags: { type: "array", items: { type: "string" }, description: "Semantic tags for fast retrieval (e.g. 'download', 'germania', 'email')" },
          importance: { type: "number", description: "1-5 scale, 5 = critical preference" },
          context_page: { type: "string", description: "Page context where this was learned" },
        },
        required: ["content", "memory_type", "tags"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_memory",
      description: "Search persistent memory by tags or text. Use to recall user preferences, past decisions, or operational history before answering.",
      parameters: {
        type: "object",
        properties: {
          tags: { type: "array", items: { type: "string" }, description: "Tags to search for (OR match)" },
          search_text: { type: "string", description: "Text to search in memory content" },
          memory_type: { type: "string", enum: ["conversation", "decision", "preference", "fact"] },
          limit: { type: "number", description: "Max results (default 10)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_work_plan",
      description: "Create a multi-step work plan. Each step defines an action with parameters. The plan will be executed step by step. Use for complex multi-action requests.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Plan title" },
          description: { type: "string", description: "What this plan accomplishes" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action: { type: "string", description: "Tool name or action to execute" },
                params: { type: "object", description: "Parameters for the action" },
                description: { type: "string", description: "Human-readable step description" },
              },
              required: ["action", "description"],
            },
            description: "Ordered list of steps",
          },
          tags: { type: "array", items: { type: "string" }, description: "Tags for categorization and template matching" },
        },
        required: ["title", "steps", "tags"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_plan_step",
      description: "Execute the next pending step of an active work plan. Returns the step result and updates plan progress.",
      parameters: {
        type: "object",
        properties: {
          plan_id: { type: "string", description: "UUID of the work plan" },
        },
        required: ["plan_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_active_plans",
      description: "List active work plans (draft, running, paused). Shows progress and current step.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_as_template",
      description: "Save a completed work plan as a reusable template for future use.",
      parameters: {
        type: "object",
        properties: {
          plan_id: { type: "string", description: "UUID of the completed plan to templatize" },
          name: { type: "string", description: "Template name" },
          description: { type: "string", description: "What this template does" },
        },
        required: ["plan_id", "name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_templates",
      description: "Search saved plan templates by tags or name. Returns reusable workflow blueprints.",
      parameters: {
        type: "object",
        properties: {
          tags: { type: "array", items: { type: "string" } },
          search_name: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_ui_action",
      description: "Execute a UI action on the frontend: navigate to a page, show a toast notification, apply filters, or open a dialog. The action will be dispatched as a CustomEvent to the frontend.",
      parameters: {
        type: "object",
        properties: {
          action_type: { type: "string", enum: ["navigate", "show_toast", "apply_filters", "open_dialog"], description: "Type of UI action" },
          path: { type: "string", description: "For navigate: the route path (e.g. /partner-hub)" },
          message: { type: "string", description: "For show_toast: the notification message" },
          toast_type: { type: "string", enum: ["default", "success", "error"], description: "Toast variant" },
          filters: { type: "object", description: "For apply_filters: filter key-value pairs" },
          dialog: { type: "string", description: "For open_dialog: dialog identifier" },
        },
        required: ["action_type"],
        additionalProperties: false,
      },
    },
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOOL EXECUTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function executeSearchPartners(args: Record<string, unknown>) {
  const isCount = !!args.count_only;
  let partnerIdFilter: string[] | null = null;

  if (args.service) {
    const { data } = await supabase.from("partner_services").select("partner_id").eq("service_category", args.service);
    partnerIdFilter = (data || []).map((r: any) => r.partner_id);
    if (partnerIdFilter.length === 0) return isCount ? { count: 0 } : { count: 0, partners: [] };
  }
  if (args.certification) {
    const { data } = await supabase.from("partner_certifications").select("partner_id").eq("certification", args.certification);
    const certIds = (data || []).map((r: any) => r.partner_id);
    partnerIdFilter = partnerIdFilter ? partnerIdFilter.filter(id => certIds.includes(id)) : certIds;
    if (partnerIdFilter.length === 0) return isCount ? { count: 0 } : { count: 0, partners: [] };
  }
  if (args.network_name) {
    const { data } = await supabase.from("partner_networks").select("partner_id").ilike("network_name", `%${args.network_name}%`);
    const netIds = (data || []).map((r: any) => r.partner_id);
    partnerIdFilter = partnerIdFilter ? partnerIdFilter.filter(id => netIds.includes(id)) : netIds;
    if (partnerIdFilter.length === 0) return isCount ? { count: 0 } : { count: 0, partners: [] };
  }
  if (args.has_phone !== undefined && args.has_phone) {
    const { data } = await supabase.from("partner_contacts").select("partner_id").or("direct_phone.not.is.null,mobile.not.is.null");
    const phoneIds = [...new Set((data || []).map((r: any) => r.partner_id))];
    partnerIdFilter = partnerIdFilter ? partnerIdFilter.filter(id => phoneIds.includes(id)) : phoneIds;
    if (partnerIdFilter.length === 0) return isCount ? { count: 0 } : { count: 0, partners: [] };
  }

  let query = supabase.from("partners").select(
    isCount ? "id" : "id, company_name, city, country_code, country_name, email, phone, rating, wca_id, website, raw_profile_html, is_favorite, office_type, has_branches",
    isCount ? { count: "exact", head: true } : undefined
  );

  if (partnerIdFilter) query = query.in("id", partnerIdFilter.slice(0, 500));
  if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
  if (args.city) query = query.ilike("city", `%${args.city}%`);
  if (args.search_name) query = query.ilike("company_name", `%${args.search_name}%`);
  if (args.has_email === true) query = query.not("email", "is", null);
  if (args.has_email === false) query = query.is("email", null);
  if (args.has_profile === true) query = query.not("raw_profile_html", "is", null);
  if (args.has_profile === false) query = query.is("raw_profile_html", null);
  if (args.min_rating) query = query.gte("rating", Number(args.min_rating));
  if (args.office_type) query = query.eq("office_type", args.office_type);
  if (args.is_favorite === true) query = query.eq("is_favorite", true);
  if (args.has_branches === true) query = query.eq("has_branches", true);

  const sortBy = String(args.sort_by || "rating");
  if (sortBy === "name") query = query.order("company_name", { ascending: true });
  else if (sortBy === "recent") query = query.order("created_at", { ascending: false });
  else query = query.order("rating", { ascending: false, nullsFirst: false });

  const limit = Math.min(Number(args.limit) || 20, 50);
  query = query.limit(limit);

  const { data, error, count } = await query;
  if (error) return { error: error.message };
  if (isCount) return { count };

  return {
    count: data?.length,
    partners: (data || []).map((p: any) => ({
      id: p.id, company_name: p.company_name, city: p.city,
      country: `${p.country_name} (${p.country_code})`,
      email: p.email || null, phone: p.phone || null, rating: p.rating ?? null,
      has_profile: !!p.raw_profile_html, website: p.website || null,
      is_favorite: p.is_favorite, office_type: p.office_type, has_branches: p.has_branches,
    })),
  };
}

async function executeCountryOverview(args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc("get_country_stats");
  if (error) return { error: error.message };
  let stats = data || [];
  if (args.country_code) stats = stats.filter((s: any) => s.country_code === String(args.country_code).toUpperCase());
  const sortBy = String(args.sort_by || "total");
  if (sortBy === "missing_profiles") stats.sort((a: any, b: any) => (b.without_profile || 0) - (a.without_profile || 0));
  else if (sortBy === "missing_emails") stats.sort((a: any, b: any) => ((b.total_partners - b.with_email) || 0) - ((a.total_partners - a.with_email) || 0));
  else stats.sort((a: any, b: any) => (b.total_partners || 0) - (a.total_partners || 0));
  const limit = Number(args.limit) || 30;
  return {
    total_countries: stats.length,
    countries: stats.slice(0, limit).map((s: any) => ({
      country_code: s.country_code, total_partners: s.total_partners, hq: s.hq_count, branches: s.branch_count,
      with_profile: s.with_profile, without_profile: s.without_profile, with_email: s.with_email, with_phone: s.with_phone,
      profile_coverage: s.total_partners ? `${Math.round((s.with_profile / s.total_partners) * 100)}%` : "0%",
    })),
  };
}

async function executeDirectoryStatus(args: Record<string, unknown>) {
  const { data: dirData } = await supabase.rpc("get_directory_counts");
  const { data: statsData } = await supabase.rpc("get_country_stats");
  const dirMap: Record<string, { members: number; verified: boolean }> = {};
  for (const r of (dirData || []) as any[]) dirMap[r.country_code] = { members: Number(r.member_count), verified: r.is_verified };
  const statsMap: Record<string, any> = {};
  for (const r of (statsData || []) as any[]) statsMap[r.country_code] = r;
  const allCodes = [...new Set([...Object.keys(dirMap), ...Object.keys(statsMap)])];
  if (args.country_code) {
    const code = String(args.country_code).toUpperCase();
    const dir = dirMap[code]; const db = statsMap[code];
    return {
      country_code: code, directory_members: dir?.members || 0, directory_verified: dir?.verified || false,
      db_partners: db?.total_partners || 0, db_with_profile: db?.with_profile || 0, db_without_profile: db?.without_profile || 0,
      gap: (dir?.members || 0) - (db?.total_partners || 0),
      status: !dir && !db ? "mai_esplorato" : !dir ? "no_directory" : (db?.total_partners || 0) >= (dir?.members || 0) && (db?.without_profile || 0) === 0 ? "completato" : "incompleto",
    };
  }
  const results = allCodes.map(code => ({
    country_code: code, directory_members: dirMap[code]?.members || 0, db_partners: statsMap[code]?.total_partners || 0,
    gap: (dirMap[code]?.members || 0) - (statsMap[code]?.total_partners || 0), profiles_missing: statsMap[code]?.without_profile || 0,
  })).filter(r => r.gap > 0 || r.profiles_missing > 0).sort((a, b) => b.gap - a.gap);
  return { countries_with_gaps: results.length, gaps: results.slice(0, 30) };
}

async function executeListJobs(args: Record<string, unknown>) {
  let query = supabase.from("download_jobs")
    .select("id, country_code, country_name, status, job_type, current_index, total_count, contacts_found_count, contacts_missing_count, created_at, updated_at, last_processed_company, error_message, network_name")
    .order("created_at", { ascending: false }).limit(Number(args.limit) || 20);
  if (args.status) query = query.eq("status", args.status);
  if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
  const { data, error } = await query;
  if (error) return { error: error.message };
  return {
    count: data?.length,
    jobs: (data || []).map((j: any) => ({
      id: j.id, country: `${j.country_name} (${j.country_code})`, status: j.status, type: j.job_type,
      progress: `${j.current_index}/${j.total_count}`, found: j.contacts_found_count, missing: j.contacts_missing_count,
      last_company: j.last_processed_company || null, network: j.network_name, error: j.error_message || null, created: j.created_at,
    })),
  };
}

async function executePartnerDetail(args: Record<string, unknown>) {
  let partner: any = null;
  if (args.partner_id) {
    const { data } = await supabase.from("partners").select("*").eq("id", args.partner_id).single();
    partner = data;
  } else if (args.company_name) {
    const { data } = await supabase.from("partners").select("*").ilike("company_name", `%${args.company_name}%`).limit(1).single();
    partner = data;
  }
  if (!partner) return { error: "Partner non trovato" };
  const [contactsRes, networksRes, servicesRes, certsRes, socialsRes, blacklistRes] = await Promise.all([
    supabase.from("partner_contacts").select("name, email, title, direct_phone, mobile, is_primary").eq("partner_id", partner.id),
    supabase.from("partner_networks").select("network_name, expires, network_id").eq("partner_id", partner.id),
    supabase.from("partner_services").select("service_category").eq("partner_id", partner.id),
    supabase.from("partner_certifications").select("certification").eq("partner_id", partner.id),
    supabase.from("partner_social_links").select("platform, url").eq("partner_id", partner.id),
    supabase.from("blacklist_entries").select("company_name, total_owed_amount, claims, status").eq("matched_partner_id", partner.id),
  ]);
  return {
    id: partner.id, company_name: partner.company_name, alias: partner.company_alias, city: partner.city,
    country: `${partner.country_name} (${partner.country_code})`, address: partner.address || null,
    email: partner.email || null, phone: partner.phone || null, mobile: partner.mobile || null, fax: partner.fax || null,
    website: partner.website || null, rating: partner.rating, rating_details: partner.rating_details,
    office_type: partner.office_type, has_branches: partner.has_branches, branch_cities: partner.branch_cities,
    is_favorite: partner.is_favorite, is_active: partner.is_active, wca_id: partner.wca_id,
    member_since: partner.member_since, membership_expires: partner.membership_expires,
    has_profile: !!partner.raw_profile_html,
    profile_summary: partner.raw_profile_markdown ? String(partner.raw_profile_markdown).substring(0, 2000) : null,
    contacts: (contactsRes.data || []).map((c: any) => ({ name: c.name, title: c.title, email: c.email, phone: c.direct_phone || c.mobile, is_primary: c.is_primary })),
    networks: (networksRes.data || []).map((n: any) => ({ name: n.network_name, expires: n.expires })),
    services: (servicesRes.data || []).map((s: any) => s.service_category),
    certifications: (certsRes.data || []).map((c: any) => c.certification),
    social_links: (socialsRes.data || []).map((s: any) => ({ platform: s.platform, url: s.url })),
    blacklist_matches: (blacklistRes.data || []).map((b: any) => ({ company: b.company_name, owed: b.total_owed_amount, claims: b.claims, status: b.status })),
  };
}

async function executeGlobalSummary() {
  const [statsRes, dirRes, jobsRes] = await Promise.all([
    supabase.rpc("get_country_stats"), supabase.rpc("get_directory_counts"),
    supabase.from("download_jobs").select("id, status").in("status", ["running", "pending"]),
  ]);
  const rows = statsRes.data || [];
  const totals = rows.reduce((acc: any, r: any) => ({
    partners: acc.partners + (Number(r.total_partners) || 0), with_profile: acc.with_profile + (Number(r.with_profile) || 0),
    without_profile: acc.without_profile + (Number(r.without_profile) || 0), with_email: acc.with_email + (Number(r.with_email) || 0),
    with_phone: acc.with_phone + (Number(r.with_phone) || 0),
  }), { partners: 0, with_profile: 0, without_profile: 0, with_email: 0, with_phone: 0 });
  const dirRows = dirRes.data || [];
  const dirTotal = dirRows.reduce((sum: number, r: any) => sum + (Number(r.member_count) || 0), 0);
  return {
    total_countries_with_data: rows.length, total_partners: totals.partners,
    with_profile: totals.with_profile, without_profile: totals.without_profile,
    with_email: totals.with_email, with_phone: totals.with_phone,
    profile_coverage: totals.partners ? `${Math.round((totals.with_profile / totals.partners) * 100)}%` : "0%",
    email_coverage: totals.partners ? `${Math.round((totals.with_email / totals.partners) * 100)}%` : "0%",
    directory_members_total: dirTotal, directory_countries_scanned: dirRows.length,
    download_gap: dirTotal - totals.partners, active_jobs: jobsRes.data?.length || 0,
  };
}

async function executeCheckBlacklist(args: Record<string, unknown>) {
  let query = supabase.from("blacklist_entries").select("company_name, country, city, total_owed_amount, claims, status, blacklist_no, matched_partner_id");
  if (args.company_name) query = query.ilike("company_name", `%${args.company_name}%`);
  if (args.country) query = query.ilike("country", `%${args.country}%`);
  query = query.order("total_owed_amount", { ascending: false, nullsFirst: false }).limit(20);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return {
    count: data?.length || 0,
    entries: (data || []).map((b: any) => ({
      company: b.company_name, country: b.country, city: b.city, owed: b.total_owed_amount,
      claims: b.claims, status: b.status, has_matched_partner: !!b.matched_partner_id,
    })),
  };
}

async function executeListReminders(args: Record<string, unknown>) {
  let query = supabase.from("reminders").select("id, title, description, due_date, priority, status, partner_id, created_at")
    .order("due_date", { ascending: true }).limit(30);
  if (args.status) query = query.eq("status", args.status);
  if (args.priority) query = query.eq("priority", args.priority);
  const { data, error } = await query;
  if (error) return { error: error.message };
  const partnerIds = [...new Set((data || []).map((r: any) => r.partner_id))];
  const { data: partners } = await supabase.from("partners").select("id, company_name").in("id", partnerIds);
  const nameMap: Record<string, string> = {};
  for (const p of (partners || []) as any[]) nameMap[p.id] = p.company_name;
  let results = (data || []).map((r: any) => ({
    id: r.id, title: r.title, description: r.description, due_date: r.due_date,
    priority: r.priority, status: r.status, partner: nameMap[r.partner_id] || "Sconosciuto",
  }));
  if (args.partner_name) {
    const search = String(args.partner_name).toLowerCase();
    results = results.filter(r => r.partner.toLowerCase().includes(search));
  }
  return { count: results.length, reminders: results };
}

async function executePartnersWithoutContacts(args: Record<string, unknown>) {
  let query = supabase.from("partners_no_contacts").select("wca_id, company_name, city, country_code, retry_count, scraped_at")
    .eq("resolved", false).order("scraped_at", { ascending: false }).limit(Number(args.limit) || 30);
  if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
  const { data, error } = await query;
  if (error) return { error: error.message };
  return {
    count: data?.length || 0,
    partners: (data || []).map((p: any) => ({
      wca_id: p.wca_id, company_name: p.company_name, city: p.city, country_code: p.country_code,
      retry_count: p.retry_count, last_scraped: p.scraped_at,
    })),
  };
}

async function executeCreateDownloadJob(args: Record<string, unknown>) {
  const countryCode = String(args.country_code || "").toUpperCase();
  const countryName = String(args.country_name || "");
  const mode = String(args.mode || "no_profile");
  const networkName = String(args.network_name || "Tutti");
  const delaySec = Math.max(10, Number(args.delay_seconds) || 15);

  if (!countryCode || !countryName) return { error: "country_code e country_name sono obbligatori" };

  const { data: activeJobs } = await supabase.from("download_jobs").select("id, country_code, status").in("status", ["pending", "running"]).limit(5);
  if (activeJobs && activeJobs.length > 0) {
    const sameCountry = activeJobs.find((j: any) => j.country_code === countryCode);
    if (sameCountry) return { error: `Esiste già un job attivo per ${countryName} (${countryCode}).`, active_job_id: sameCountry.id };
    if (activeJobs.length >= 3) return { error: `Ci sono già ${activeJobs.length} job attivi. Attendi il completamento.` };
  }

  let wcaIds: number[] = [];
  if (mode === "new") {
    const { data: cacheRows } = await supabase.from("directory_cache").select("members").eq("country_code", countryCode);
    if (!cacheRows || cacheRows.length === 0) return { error: `Nessuna directory cache per ${countryName}. Esegui prima una scansione directory.` };
    const dirIds: number[] = [];
    for (const row of cacheRows) { const members = row.members as any[]; if (Array.isArray(members)) for (const m of members) { const id = typeof m === "object" ? m.wca_id || m.id : m; if (id) dirIds.push(Number(id)); } }
    const { data: existing } = await supabase.from("partners").select("wca_id").eq("country_code", countryCode).not("wca_id", "is", null);
    const existingSet = new Set((existing || []).map((p: any) => p.wca_id));
    wcaIds = [...new Set(dirIds)].filter(id => !existingSet.has(id));
  } else if (mode === "no_profile") {
    const { data: noProfile } = await supabase.from("partners").select("wca_id").eq("country_code", countryCode).not("wca_id", "is", null).is("raw_profile_html", null);
    wcaIds = (noProfile || []).map((p: any) => p.wca_id).filter(Boolean);
    const { data: cacheRows } = await supabase.from("directory_cache").select("members").eq("country_code", countryCode);
    if (cacheRows && cacheRows.length > 0) {
      const { data: allExisting } = await supabase.from("partners").select("wca_id").eq("country_code", countryCode).not("wca_id", "is", null);
      const existingSet = new Set((allExisting || []).map((p: any) => p.wca_id));
      for (const row of cacheRows) { const members = row.members as any[]; if (Array.isArray(members)) for (const m of members) { const id = typeof m === "object" ? m.wca_id || m.id : m; if (id && !existingSet.has(Number(id))) wcaIds.push(Number(id)); } }
    }
    wcaIds = [...new Set(wcaIds)];
  } else {
    const { data: dbPartners } = await supabase.from("partners").select("wca_id").eq("country_code", countryCode).not("wca_id", "is", null);
    wcaIds = (dbPartners || []).map((p: any) => p.wca_id).filter(Boolean);
    const { data: cacheRows } = await supabase.from("directory_cache").select("members").eq("country_code", countryCode);
    if (cacheRows) for (const row of cacheRows) { const members = row.members as any[]; if (Array.isArray(members)) for (const m of members) { const id = typeof m === "object" ? m.wca_id || m.id : m; if (id) wcaIds.push(Number(id)); } }
    wcaIds = [...new Set(wcaIds)];
  }

  if (wcaIds.length === 0) {
    const modeLabels: Record<string, string> = { new: "nuovi", no_profile: "senza profilo", all: "tutti" };
    return { success: false, message: `Nessun partner da scaricare in modalità "${modeLabels[mode] || mode}" per ${countryName}.` };
  }

  const { data: job, error } = await supabase.from("download_jobs").insert({
    country_code: countryCode, country_name: countryName, network_name: networkName,
    wca_ids: wcaIds as any, total_count: wcaIds.length, delay_seconds: delaySec, status: "pending",
  }).select("id").single();

  if (error) return { error: `Errore creazione job: ${error.message}` };

  const modeLabels: Record<string, string> = { new: "Nuovi partner", no_profile: "Solo profili mancanti", all: "Aggiorna tutti" };
  return {
    success: true, job_id: job.id, country: `${countryName} (${countryCode})`, mode: modeLabels[mode] || mode,
    total_partners: wcaIds.length, delay_seconds: delaySec,
    estimated_time_minutes: Math.ceil(wcaIds.length * (delaySec + 5) / 60),
    message: `Job creato! ${wcaIds.length} partner da scaricare per ${countryName}. Il download partirà automaticamente.`,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NEW TOOL EXECUTION — Memory, Plans, Templates, UI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function executeSaveMemory(args: Record<string, unknown>, userId: string) {
  const { data, error } = await supabase.from("ai_memory").insert({
    user_id: userId,
    content: String(args.content),
    memory_type: String(args.memory_type || "fact"),
    tags: (args.tags as string[]) || [],
    importance: Math.min(5, Math.max(1, Number(args.importance) || 3)),
    context_page: args.context_page ? String(args.context_page) : null,
  }).select("id").single();
  if (error) return { error: error.message };
  return { success: true, memory_id: data.id, message: "Ricordo salvato." };
}

async function executeSearchMemory(args: Record<string, unknown>, userId: string) {
  let query = supabase.from("ai_memory").select("id, content, memory_type, tags, importance, context_page, created_at")
    .eq("user_id", userId)
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(Number(args.limit) || 10);

  if (args.memory_type) query = query.eq("memory_type", args.memory_type);
  if (args.tags && (args.tags as string[]).length > 0) query = query.overlaps("tags", args.tags as string[]);
  if (args.search_text) query = query.ilike("content", `%${args.search_text}%`);

  // Filter out expired
  query = query.or("expires_at.is.null,expires_at.gt.now()");

  const { data, error } = await query;
  if (error) return { error: error.message };
  return { count: data?.length || 0, memories: data || [] };
}

async function executeCreateWorkPlan(args: Record<string, unknown>, userId: string) {
  const steps = ((args.steps as any[]) || []).map((s: any, i: number) => ({
    index: i, action: s.action, params: s.params || {}, description: s.description || "",
    status: "pending", result: null, started_at: null, completed_at: null,
  }));

  const { data, error } = await supabase.from("ai_work_plans").insert({
    user_id: userId,
    title: String(args.title),
    description: args.description ? String(args.description) : null,
    steps: steps as any,
    tags: (args.tags as string[]) || [],
    status: "running",
    current_step: 0,
  }).select("id, title, status, steps, current_step").single();

  if (error) return { error: error.message };
  return { success: true, plan: data, message: `Piano "${args.title}" creato con ${steps.length} step. Eseguirò gli step progressivamente.` };
}

async function executeExecutePlanStep(args: Record<string, unknown>, userId: string) {
  const { data: plan, error } = await supabase.from("ai_work_plans").select("*")
    .eq("id", args.plan_id).eq("user_id", userId).single();
  if (error || !plan) return { error: "Piano non trovato" };
  if (plan.status === "completed") return { error: "Piano già completato", plan_id: plan.id };
  if (plan.status === "failed") return { error: "Piano fallito. Crea un nuovo piano." };

  const steps = plan.steps as any[];
  const currentIdx = plan.current_step;
  if (currentIdx >= steps.length) {
    await supabase.from("ai_work_plans").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", plan.id);
    return { success: true, status: "completed", message: "Tutti gli step completati!" };
  }

  const step = steps[currentIdx];
  step.status = "running";
  step.started_at = new Date().toISOString();

  // Execute the step action
  let stepResult: any;
  try {
    if (step.action === "execute_ui_action") {
      // UI actions are returned to frontend, not executed server-side
      stepResult = { ui_action: step.params, message: "Azione UI da eseguire sul frontend" };
    } else {
      stepResult = await executeTool(step.action, step.params || {});
    }
    step.status = "done";
    step.result = stepResult;
  } catch (e) {
    step.status = "failed";
    step.result = { error: e instanceof Error ? e.message : "Errore sconosciuto" };
  }
  step.completed_at = new Date().toISOString();

  const nextIdx = currentIdx + 1;
  const allDone = nextIdx >= steps.length;
  const newStatus = step.status === "failed" ? "paused" : allDone ? "completed" : "running";

  await supabase.from("ai_work_plans").update({
    steps: steps as any,
    current_step: nextIdx,
    status: newStatus,
    ...(allDone ? { completed_at: new Date().toISOString() } : {}),
  }).eq("id", plan.id);

  return {
    success: step.status === "done",
    plan_id: plan.id,
    step_index: currentIdx,
    step_description: step.description,
    step_result: stepResult,
    plan_status: newStatus,
    remaining_steps: steps.length - nextIdx,
    ...(stepResult?.ui_action ? { ui_action: stepResult.ui_action } : {}),
  };
}

async function executeGetActivePlans(userId: string) {
  const { data, error } = await supabase.from("ai_work_plans")
    .select("id, title, description, status, steps, current_step, tags, created_at")
    .eq("user_id", userId)
    .in("status", ["draft", "running", "paused"])
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return { error: error.message };
  return {
    count: data?.length || 0,
    plans: (data || []).map((p: any) => ({
      id: p.id, title: p.title, status: p.status,
      total_steps: (p.steps as any[]).length, current_step: p.current_step,
      progress: `${p.current_step}/${(p.steps as any[]).length}`,
      tags: p.tags, created_at: p.created_at,
    })),
  };
}

async function executeSaveAsTemplate(args: Record<string, unknown>, userId: string) {
  const { data: plan } = await supabase.from("ai_work_plans").select("steps, tags")
    .eq("id", args.plan_id).eq("user_id", userId).single();
  if (!plan) return { error: "Piano non trovato" };

  const stepsTemplate = ((plan.steps as any[]) || []).map((s: any) => ({
    action: s.action, params: s.params, description: s.description,
  }));

  const { data, error } = await supabase.from("ai_plan_templates").insert({
    user_id: userId,
    name: String(args.name),
    description: args.description ? String(args.description) : null,
    steps_template: stepsTemplate as any,
    tags: plan.tags || [],
  }).select("id, name").single();

  if (error) return { error: error.message };
  return { success: true, template_id: data.id, name: data.name, message: `Template "${args.name}" salvato!` };
}

async function executeSearchTemplates(args: Record<string, unknown>, userId: string) {
  let query = supabase.from("ai_plan_templates").select("id, name, description, steps_template, tags, use_count, last_used_at")
    .eq("user_id", userId).order("use_count", { ascending: false }).limit(10);
  if (args.tags && (args.tags as string[]).length > 0) query = query.overlaps("tags", args.tags as string[]);
  if (args.search_name) query = query.ilike("name", `%${args.search_name}%`);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return {
    count: data?.length || 0,
    templates: (data || []).map((t: any) => ({
      id: t.id, name: t.name, description: t.description, steps_count: (t.steps_template as any[]).length,
      tags: t.tags, use_count: t.use_count, last_used: t.last_used_at,
    })),
  };
}

function executeUiAction(args: Record<string, unknown>) {
  // This is a pass-through — the result will be sent back to the frontend which handles the actual UI action
  return {
    ui_action: {
      action_type: args.action_type,
      path: args.path,
      message: args.message,
      toast_type: args.toast_type || "default",
      filters: args.filters,
      dialog: args.dialog,
    },
    success: true,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UNIFIED TOOL DISPATCHER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function executeTool(name: string, args: Record<string, unknown>, userId?: string): Promise<unknown> {
  switch (name) {
    case "search_partners": return executeSearchPartners(args);
    case "get_country_overview": return executeCountryOverview(args);
    case "get_directory_status": return executeDirectoryStatus(args);
    case "list_jobs": return executeListJobs(args);
    case "get_partner_detail": return executePartnerDetail(args);
    case "get_global_summary": return executeGlobalSummary();
    case "check_blacklist": return executeCheckBlacklist(args);
    case "list_reminders": return executeListReminders(args);
    case "get_partners_without_contacts": return executePartnersWithoutContacts(args);
    case "create_download_job": return executeCreateDownloadJob(args);
    // New memory & plan tools
    case "save_memory": return userId ? executeSaveMemory(args, userId) : { error: "Auth required" };
    case "search_memory": return userId ? executeSearchMemory(args, userId) : { error: "Auth required" };
    case "create_work_plan": return userId ? executeCreateWorkPlan(args, userId) : { error: "Auth required" };
    case "execute_plan_step": return userId ? executeExecutePlanStep(args, userId) : { error: "Auth required" };
    case "get_active_plans": return userId ? executeGetActivePlans(userId) : { error: "Auth required" };
    case "save_as_template": return userId ? executeSaveAsTemplate(args, userId) : { error: "Auth required" };
    case "search_templates": return userId ? executeSearchTemplates(args, userId) : { error: "Auth required" };
    case "execute_ui_action": return executeUiAction(args);
    default: return { error: `Tool sconosciuto: ${name}` };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CREDIT CONSUMPTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function consumeCredits(userId: string, usage: { prompt_tokens?: number; completion_tokens?: number }) {
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;
  if (inputTokens === 0 && outputTokens === 0) return;
  const rates = { input: 1, output: 2 };
  const totalCredits = Math.ceil(inputTokens / 1000 * rates.input) + Math.ceil(outputTokens / 1000 * rates.output);
  if (totalCredits <= 0) return;
  const { data: apiKey } = await supabase.from("user_api_keys").select("api_key").eq("user_id", userId).eq("provider", "google").eq("is_active", true).maybeSingle();
  if (apiKey?.api_key) return;
  const { data: deductResult } = await supabase.rpc("deduct_credits", {
    p_user_id: userId, p_amount: totalCredits, p_operation: "ai_call",
    p_description: `AI Assistant: ${inputTokens} in + ${outputTokens} out tokens (${totalCredits} crediti)`,
  });
  const row = deductResult?.[0];
  console.log(`[CREDITS] User ${userId}: -${totalCredits} credits (success: ${row?.success}, balance: ${row?.new_balance})`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOAD MEMORY CONTEXT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function loadMemoryContext(userId: string): Promise<string> {
  const { data: memories } = await supabase.from("ai_memory")
    .select("content, memory_type, tags, importance, created_at")
    .eq("user_id", userId)
    .or("expires_at.is.null,expires_at.gt.now()")
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: plans } = await supabase.from("ai_work_plans")
    .select("id, title, status, current_step, steps, tags")
    .eq("user_id", userId)
    .in("status", ["running", "paused"])
    .limit(5);

  let context = "";

  if (memories && memories.length > 0) {
    context += "\n\nMEMORIA OPERATIVA (ricordi salvati dall'utente e dall'AI):\n";
    for (const m of memories) {
      const typeEmoji: Record<string, string> = { preference: "⭐", decision: "🎯", fact: "📌", conversation: "💬" };
      context += `${typeEmoji[m.memory_type] || "📝"} [${m.memory_type}] ${m.content} (tags: ${(m.tags || []).join(", ")})\n`;
    }
  }

  if (plans && plans.length > 0) {
    context += "\n\nPIANI DI LAVORO ATTIVI:\n";
    for (const p of plans) {
      const steps = p.steps as any[];
      context += `🔄 "${p.title}" — stato: ${p.status}, progresso: ${p.current_step}/${steps.length} (tags: ${(p.tags || []).join(", ")})\n`;
      const nextStep = steps[p.current_step];
      if (nextStep) context += `   → Prossimo step: ${nextStep.description}\n`;
    }
  }

  return context;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId: string = claimsData.claims.sub as string;

    // Credit check
    if (userId) {
      const { data: apiKey } = await supabase.from("user_api_keys").select("api_key").eq("user_id", userId).eq("provider", "google").eq("is_active", true).maybeSingle();
      if (!apiKey?.api_key) {
        const { data: credits } = await supabase.from("user_credits").select("balance").eq("user_id", userId).single();
        if (credits && credits.balance <= 0) {
          return new Response(JSON.stringify({ error: "Crediti AI esauriti. Acquista crediti extra o aggiungi le tue chiavi API nelle impostazioni." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build system prompt with memory context
    let systemPrompt = SYSTEM_PROMPT;

    // Load persistent memory
    const memoryContext = await loadMemoryContext(userId);
    if (memoryContext) systemPrompt += memoryContext;

    // Add page/selection context
    if (context) {
      systemPrompt += "\n\nCONTESTO CORRENTE DELL'UTENTE:";
      if (context.currentPage) systemPrompt += `\nPagina attiva: ${context.currentPage}`;
      if (context.source === "partner_hub") {
        systemPrompt += `\nL'utente è nella Rubrica Partner.`;
        if (context.viewLevel) systemPrompt += ` Vista: ${context.viewLevel}.`;
        if (context.selectedCountry) systemPrompt += ` Paese selezionato: ${context.selectedCountry}.`;
        if (context.totalPartners !== undefined) systemPrompt += ` Partner visibili: ${context.totalPartners}.`;
        if (context.selectedCount) systemPrompt += ` Partner selezionati: ${context.selectedCount}.`;
      }
      if (context.selectedCountries?.length) {
        systemPrompt += `\nPaesi selezionati: ${context.selectedCountries.map((c: any) => `${c.name} (${c.code})`).join(", ")}.`;
      }
      if (context.filterMode && context.filterMode !== "all" && !context.filterMode.startsWith("/")) {
        const filterLabels: Record<string, string> = { todo: "paesi con dati incompleti", no_profile: "paesi con profili mancanti", missing: "paesi mai esplorati" };
        systemPrompt += `\nFiltro attivo: ${filterLabels[context.filterMode] || context.filterMode}.`;
      }
    }

    const allMessages = [{ role: "system", content: systemPrompt }, ...messages];

    // First call with tools
    let response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: allMessages, tools }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      const errorMsg = status === 429 ? "Troppe richieste, riprova tra poco." : status === 402 ? "Crediti AI esauriti." : "Errore AI gateway";
      return new Response(JSON.stringify({ error: errorMsg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let result = await response.json();
    let assistantMessage = result.choices?.[0]?.message;

    let totalUsage = { prompt_tokens: 0, completion_tokens: 0 };
    if (result.usage) {
      totalUsage.prompt_tokens += result.usage.prompt_tokens || 0;
      totalUsage.completion_tokens += result.usage.completion_tokens || 0;
    }

    // Tool calling loop
    let iterations = 0;
    let lastPartnerResult: any = null;
    let lastJobCreated: any = null;
    let uiActions: any[] = [];

    while (assistantMessage?.tool_calls?.length && iterations < 8) {
      iterations++;
      const toolResults = [];

      for (const tc of assistantMessage.tool_calls) {
        console.log(`Tool: ${tc.function.name}`, tc.function.arguments);
        const args = JSON.parse(tc.function.arguments || "{}");
        const toolResult = await executeTool(tc.function.name, args, userId);
        console.log(`Result ${tc.function.name}:`, JSON.stringify(toolResult).substring(0, 500));
        toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(toolResult) });

        const tr = toolResult as any;

        // Track partner list results
        if (tr?.partners && Array.isArray(tr.partners) && tr.partners.length > 0 && tc.function.name === "search_partners") {
          const partnerIds = tr.partners.map((p: any) => p.id);
          const [svcRes, certRes] = await Promise.all([
            supabase.from("partner_services").select("partner_id, service_category").in("partner_id", partnerIds),
            supabase.from("partner_certifications").select("partner_id, certification").in("partner_id", partnerIds),
          ]);
          const svcMap: Record<string, string[]> = {};
          for (const s of (svcRes.data || []) as any[]) { if (!svcMap[s.partner_id]) svcMap[s.partner_id] = []; svcMap[s.partner_id].push(s.service_category); }
          const certMap: Record<string, string[]> = {};
          for (const c of (certRes.data || []) as any[]) { if (!certMap[c.partner_id]) certMap[c.partner_id] = []; certMap[c.partner_id].push(c.certification); }
          lastPartnerResult = tr.partners.map((p: any) => ({
            ...p, country_code: p.country?.match(/\(([A-Z]{2})\)/)?.[1] || "", country_name: p.country?.replace(/\s*\([A-Z]{2}\)/, "") || "",
            services: svcMap[p.id] || [], certifications: certMap[p.id] || [],
          }));
        }

        // Track job creation
        if (tc.function.name === "create_download_job" && tr?.success && tr?.job_id) {
          lastJobCreated = { job_id: tr.job_id, country: tr.country, mode: tr.mode, total_partners: tr.total_partners, estimated_time_minutes: tr.estimated_time_minutes };
        }

        // Track UI actions
        if (tr?.ui_action) uiActions.push(tr.ui_action);
        if (tr?.step_result?.ui_action) uiActions.push(tr.step_result.ui_action);
      }

      allMessages.push(assistantMessage);
      allMessages.push(...toolResults);

      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: allMessages, tools }),
      });

      if (!response.ok) {
        console.error("AI error on tool response:", response.status, await response.text());
        return new Response(JSON.stringify({ error: "Errore durante l'elaborazione" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      result = await response.json();
      assistantMessage = result.choices?.[0]?.message;
      if (result.usage) {
        totalUsage.prompt_tokens += result.usage.prompt_tokens || 0;
        totalUsage.completion_tokens += result.usage.completion_tokens || 0;
      }
    }

    // Build final content
    let finalContent = assistantMessage?.content || "";
    if (lastPartnerResult && lastPartnerResult.length > 0) {
      finalContent += `\n\n---STRUCTURED_DATA---\n${JSON.stringify({ type: "partners", data: lastPartnerResult })}`;
    }
    if (lastJobCreated) {
      finalContent += `\n\n---JOB_CREATED---\n${JSON.stringify(lastJobCreated)}`;
    }
    if (uiActions.length > 0) {
      finalContent += `\n\n---UI_ACTIONS---\n${JSON.stringify(uiActions)}`;
    }

    if (finalContent) {
      if (userId) await consumeCredits(userId, totalUsage);
      return new Response(JSON.stringify({ content: finalContent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    allMessages.push(assistantMessage);
    const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: allMessages }),
    });

    if (!finalResponse.ok) {
      return new Response(JSON.stringify({ error: "Errore finale" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const finalResult = await finalResponse.json();
    if (finalResult.usage) {
      totalUsage.prompt_tokens += finalResult.usage.prompt_tokens || 0;
      totalUsage.completion_tokens += finalResult.usage.completion_tokens || 0;
    }

    let finalText = finalResult.choices?.[0]?.message?.content || "Nessuna risposta";
    if (lastPartnerResult && lastPartnerResult.length > 0) {
      finalText += `\n\n---STRUCTURED_DATA---\n${JSON.stringify({ type: "partners", data: lastPartnerResult })}`;
    }
    if (lastJobCreated) {
      finalText += `\n\n---JOB_CREATED---\n${JSON.stringify(lastJobCreated)}`;
    }
    if (uiActions.length > 0) {
      finalText += `\n\n---UI_ACTIONS---\n${JSON.stringify(uiActions)}`;
    }

    if (userId) await consumeCredits(userId, totalUsage);
    return new Response(JSON.stringify({ content: finalText }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
