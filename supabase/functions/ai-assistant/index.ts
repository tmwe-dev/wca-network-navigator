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

const SYSTEM_PROMPT = `Sei l'assistente AI dell'Operations Center di WCA Network Navigator. Hai accesso diretto al database dei partner logistici mondiali della rete WCA.

CONTESTO DEL SISTEMA:
- La piattaforma gestisce partner di spedizioni internazionali (freight forwarders) organizzati per paese
- Ogni partner ha: company_name, city, country_code, country_name, email, phone, website, rating (0-5), wca_id
- I partner possono avere profili scaricati (raw_profile_html/raw_profile_markdown) con descrizioni dettagliate
- I contatti dei partner sono in una tabella separata (partner_contacts) con nome, email, telefono, titolo
- I download_jobs tracciano lo scaricamento dei dati dai network WCA
- I country_code sono codici ISO a 2 lettere (IT, US, BR, DE, etc.)

REGOLE:
- Rispondi SEMPRE in italiano
- Usa i tool per ottenere dati reali prima di rispondere
- Quando mostri liste di partner, includi: nome, citta', email se disponibile
- Per domande sui conteggi, usa search_partners con count_only=true
- Sii conciso ma completo
- Formatta le risposte con markdown (tabelle, liste, grassetto)
- Se non trovi risultati, dillo chiaramente`;

const tools = [
  {
    type: "function",
    function: {
      name: "search_partners",
      description:
        "Search partners by country, rating, email/profile presence. Returns partner list or count.",
      parameters: {
        type: "object",
        properties: {
          country_code: {
            type: "string",
            description: "ISO 2-letter country code (e.g. IT, US, BR)",
          },
          has_email: {
            type: "boolean",
            description: "Filter by email presence",
          },
          has_profile: {
            type: "boolean",
            description: "Filter by profile (raw_profile_html) presence",
          },
          min_rating: {
            type: "number",
            description: "Minimum rating (0-5)",
          },
          search_name: {
            type: "string",
            description: "Search by company name (partial match)",
          },
          limit: {
            type: "number",
            description: "Max results to return (default 20)",
          },
          count_only: {
            type: "boolean",
            description: "Return only the count, not the full list",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_country_overview",
      description:
        "Get aggregated statistics for all countries or a specific country: total partners, with/without profile, with email, with phone.",
      parameters: {
        type: "object",
        properties: {
          country_code: {
            type: "string",
            description:
              "Optional ISO 2-letter country code. If omitted, returns all countries.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_jobs",
      description:
        "List download jobs, optionally filtered by status (running, pending, completed, cancelled).",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["running", "pending", "completed", "cancelled"],
            description: "Filter by job status",
          },
          country_code: {
            type: "string",
            description: "Filter by country code",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_partner_detail",
      description:
        "Get full details of a specific partner including contacts, networks, and profile summary.",
      parameters: {
        type: "object",
        properties: {
          partner_id: {
            type: "string",
            description: "UUID of the partner",
          },
          company_name: {
            type: "string",
            description:
              "Company name to search (used if partner_id not provided)",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_global_summary",
      description:
        "Get a high-level summary of the entire database: total partners, countries scanned, profiles downloaded, emails available.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
];

// ── Tool Execution ──

async function executeSearchPartners(args: Record<string, unknown>) {
  let query = supabase.from("partners").select(
    args.count_only
      ? "id"
      : "id, company_name, city, country_code, country_name, email, phone, rating, wca_id, website, raw_profile_html",
    args.count_only ? { count: "exact", head: true } : undefined
  );

  if (args.country_code)
    query = query.eq("country_code", String(args.country_code).toUpperCase());
  if (args.has_email === true) query = query.not("email", "is", null);
  if (args.has_email === false) query = query.is("email", null);
  if (args.has_profile === true)
    query = query.not("raw_profile_html", "is", null);
  if (args.has_profile === false) query = query.is("raw_profile_html", null);
  if (args.min_rating) query = query.gte("rating", Number(args.min_rating));
  if (args.search_name)
    query = query.ilike("company_name", `%${args.search_name}%`);

  query = query
    .order("rating", { ascending: false, nullsFirst: false })
    .limit(Number(args.limit) || 20);

  const { data, error, count } = await query;
  if (error) return { error: error.message };

  if (args.count_only) return { count };

  return {
    count: data?.length,
    partners: (data || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      company_name: p.company_name,
      city: p.city,
      country: p.country_name,
      email: p.email || "N/A",
      phone: p.phone || "N/A",
      rating: p.rating ?? "N/A",
      has_profile: !!p.raw_profile_html,
      website: p.website || "N/A",
    })),
  };
}

async function executeCountryOverview(args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc("get_country_stats");
  if (error) return { error: error.message };

  let stats = data || [];
  if (args.country_code) {
    stats = stats.filter(
      (s: Record<string, unknown>) =>
        s.country_code === String(args.country_code).toUpperCase()
    );
  }

  // Sort by total_partners desc
  stats.sort(
    (a: Record<string, unknown>, b: Record<string, unknown>) =>
      (Number(b.total_partners) || 0) - (Number(a.total_partners) || 0)
  );

  return {
    total_countries: stats.length,
    countries: stats.slice(0, 50).map((s: Record<string, unknown>) => ({
      country_code: s.country_code,
      total_partners: s.total_partners,
      with_profile: s.with_profile,
      without_profile: s.without_profile,
      with_email: s.with_email,
      with_phone: s.with_phone,
    })),
  };
}

async function executeListJobs(args: Record<string, unknown>) {
  let query = supabase
    .from("download_jobs")
    .select(
      "id, country_code, country_name, status, job_type, current_index, total_count, contacts_found_count, contacts_missing_count, created_at, updated_at, last_processed_company, error_message, network_name"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (args.status) query = query.eq("status", args.status);
  if (args.country_code)
    query = query.eq("country_code", String(args.country_code).toUpperCase());

  const { data, error } = await query;
  if (error) return { error: error.message };

  return {
    count: data?.length,
    jobs: (data || []).map((j: Record<string, unknown>) => ({
      id: j.id,
      country: `${j.country_name} (${j.country_code})`,
      status: j.status,
      type: j.job_type,
      progress: `${j.current_index}/${j.total_count}`,
      found: j.contacts_found_count,
      missing: j.contacts_missing_count,
      last_company: j.last_processed_company || "N/A",
      network: j.network_name,
      error: j.error_message || null,
    })),
  };
}

async function executePartnerDetail(args: Record<string, unknown>) {
  let partner: Record<string, unknown> | null = null;

  if (args.partner_id) {
    const { data } = await supabase
      .from("partners")
      .select("*")
      .eq("id", args.partner_id)
      .single();
    partner = data;
  } else if (args.company_name) {
    const { data } = await supabase
      .from("partners")
      .select("*")
      .ilike("company_name", `%${args.company_name}%`)
      .limit(1)
      .single();
    partner = data;
  }

  if (!partner) return { error: "Partner non trovato" };

  // Get contacts
  const { data: contacts } = await supabase
    .from("partner_contacts")
    .select("name, email, title, direct_phone, mobile")
    .eq("partner_id", partner.id as string);

  // Get networks
  const { data: networks } = await supabase
    .from("partner_networks")
    .select("network_name, expires")
    .eq("partner_id", partner.id as string);

  return {
    id: partner.id,
    company_name: partner.company_name,
    city: partner.city,
    country: `${partner.country_name} (${partner.country_code})`,
    email: partner.email || "N/A",
    phone: partner.phone || "N/A",
    website: partner.website || "N/A",
    rating: partner.rating ?? "N/A",
    address: partner.address || "N/A",
    has_profile: !!partner.raw_profile_html,
    profile_summary: partner.raw_profile_markdown
      ? String(partner.raw_profile_markdown).substring(0, 1500)
      : null,
    contacts: (contacts || []).map((c: Record<string, unknown>) => ({
      name: c.name,
      title: c.title || "N/A",
      email: c.email || "N/A",
      phone: c.direct_phone || c.mobile || "N/A",
    })),
    networks: (networks || []).map((n: Record<string, unknown>) => ({
      name: n.network_name,
      expires: n.expires,
    })),
    wca_id: partner.wca_id,
    member_since: partner.member_since,
  };
}

async function executeGlobalSummary() {
  const { data: stats } = await supabase.rpc("get_country_stats");
  const rows = stats || [];

  const totals = rows.reduce(
    (
      acc: Record<string, number>,
      r: Record<string, unknown>
    ) => ({
      partners: acc.partners + (Number(r.total_partners) || 0),
      with_profile: acc.with_profile + (Number(r.with_profile) || 0),
      without_profile: acc.without_profile + (Number(r.without_profile) || 0),
      with_email: acc.with_email + (Number(r.with_email) || 0),
      with_phone: acc.with_phone + (Number(r.with_phone) || 0),
    }),
    {
      partners: 0,
      with_profile: 0,
      without_profile: 0,
      with_email: 0,
      with_phone: 0,
    }
  );

  const { data: dirData } = await supabase.rpc("get_directory_counts");
  const dirRows = dirData || [];
  const dirTotal = dirRows.reduce(
    (sum: number, r: Record<string, unknown>) =>
      sum + (Number(r.member_count) || 0),
    0
  );

  const { data: activeJobs } = await supabase
    .from("download_jobs")
    .select("id")
    .in("status", ["running", "pending"]);

  return {
    total_countries_scanned: rows.length,
    total_partners_in_db: totals.partners,
    with_profile: totals.with_profile,
    without_profile: totals.without_profile,
    with_email: totals.with_email,
    with_phone: totals.with_phone,
    profile_coverage: totals.partners
      ? `${Math.round((totals.with_profile / totals.partners) * 100)}%`
      : "0%",
    email_coverage: totals.partners
      ? `${Math.round((totals.with_email / totals.partners) * 100)}%`
      : "0%",
    directory_total: dirTotal,
    directory_countries: dirRows.length,
    active_jobs: activeJobs?.length || 0,
  };
}

async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "search_partners":
      return executeSearchPartners(args);
    case "get_country_overview":
      return executeCountryOverview(args);
    case "list_jobs":
      return executeListJobs(args);
    case "get_partner_detail":
      return executePartnerDetail(args);
    case "get_global_summary":
      return executeGlobalSummary();
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── Main Handler ──

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build context-aware system prompt
    let systemPrompt = SYSTEM_PROMPT;
    if (context) {
      systemPrompt += `\n\nCONTESTO CORRENTE DELL'UTENTE:`;
      if (context.selectedCountries?.length) {
        systemPrompt += `\n- Paesi selezionati: ${context.selectedCountries
          .map((c: { code: string; name: string }) => `${c.name} (${c.code})`)
          .join(", ")}`;
      }
      if (context.filterMode) {
        systemPrompt += `\n- Filtro attivo: ${context.filterMode}`;
      }
    }

    const allMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // First call with tools
    let response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: allMessages,
          tools,
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Troppe richieste, riprova tra poco." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Crediti AI esauriti." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Errore AI gateway" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result = await response.json();
    let assistantMessage = result.choices?.[0]?.message;

    // Tool calling loop (max 5 iterations)
    let iterations = 0;
    while (assistantMessage?.tool_calls?.length && iterations < 5) {
      iterations++;
      const toolResults = [];

      for (const tc of assistantMessage.tool_calls) {
        console.log(`Tool call: ${tc.function.name}`, tc.function.arguments);
        const args = JSON.parse(tc.function.arguments || "{}");
        const toolResult = await executeTool(tc.function.name, args);
        console.log(`Tool result for ${tc.function.name}:`, JSON.stringify(toolResult).substring(0, 500));
        toolResults.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(toolResult),
        });
      }

      // Send tool results back for final answer (streaming)
      allMessages.push(assistantMessage);
      allMessages.push(...toolResults);

      response = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: allMessages,
            tools,
            stream: true,
          }),
        }
      );

      if (!response.ok) {
        const t = await response.text();
        console.error("AI gateway error on tool response:", response.status, t);
        return new Response(
          JSON.stringify({ error: "Errore durante l'elaborazione" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if it's streaming (text/event-stream) or JSON
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream")) {
        // Stream directly to client
        return new Response(response.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      // Non-streaming response, check for more tool calls
      result = await response.json();
      assistantMessage = result.choices?.[0]?.message;
    }

    // If we exhausted tool calls without streaming, do a final streaming call
    if (assistantMessage?.content) {
      // Return as a simple JSON response
      return new Response(
        JSON.stringify({ content: assistantMessage.content }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: make a final streaming call
    allMessages.push(assistantMessage);
    const finalResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: allMessages,
          stream: true,
        }),
      }
    );

    return new Response(finalResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Errore sconosciuto",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
