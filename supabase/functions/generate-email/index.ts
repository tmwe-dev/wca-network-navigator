import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Quality = "fast" | "standard" | "premium";

/**
 * STRATEGIC ADVISOR — Intelligent KB Selection
 * 
 * Instead of dumping all KB entries, this selects entries contextually based on:
 * 1. The email type/category (primo_contatto → identita + vendita cards)
 * 2. Quality tier (fast=essentials only, premium=full arsenal)
 * 3. Interaction history (follow-up with no response → ghosting recovery techniques)
 */
async function fetchKbEntriesStrategic(
  supabase: any, 
  quality: Quality,
  context: {
    emailCategory?: string;
    hasInteractionHistory?: boolean;
    isFollowUp?: boolean;
    kb_categories?: string[];
  }
): Promise<{ text: string; sections_used: string[] }> {
  const limit = quality === "fast" ? 8 : quality === "standard" ? 18 : 40;
  
  // Build category filter based on context — using ACTUAL DB categories
  const categories: string[] = [];
  
  // Always include core identity/rules
  categories.push("regole_sistema", "filosofia");
  
  // Add context-specific categories
  if (context.kb_categories?.length) {
    categories.push(...context.kb_categories);
  } else {
    // Fallback: derive from email category
    switch (context.emailCategory) {
      case "primo_contatto":
        categories.push("struttura_email", "hook", "cold_outreach", "dati_partner");
        break;
      case "follow_up":
        categories.push("followup", "chris_voss", "struttura_email");
        break;
      case "richiesta":
        categories.push("struttura_email", "dati_partner");
        break;
      case "proposta_servizi":
        categories.push("negoziazione", "struttura_email", "chiusura", "dati_partner");
        break;
      case "partnership":
        categories.push("negoziazione", "chris_voss", "dati_partner");
        break;
      default:
        categories.push("struttura_email", "hook");
    }
  }
  
  // For follow-ups without response, add re-engagement techniques
  if (context.isFollowUp) {
    ["chris_voss", "followup", "obiezioni"].forEach(c => {
      if (!categories.includes(c)) categories.push(c);
    });
  }
  
  // For premium, add full arsenal
  if (quality === "premium") {
    ["negoziazione", "chris_voss", "arsenale", "persuasione", "tono", "frasi_modello", "obiezioni", "chiusura", "errori"].forEach(c => {
      if (!categories.includes(c)) categories.push(c);
    });
  }
  
  const uniqueCategories = [...new Set(categories)];
  
  const { data: entries } = await supabase
    .from("kb_entries")
    .select("title, content, category, chapter, tags")
    .eq("is_active", true)
    .in("category", uniqueCategories)
    .order("priority", { ascending: false })
    .order("sort_order")
    .limit(limit);

  if (!entries || entries.length === 0) return { text: "", sections_used: [] };

  const sectionsUsed = [...new Set(entries.map((e: any) => e.category))];
  
  const text = entries
    .map((e: any) => `### ${e.title} [${e.chapter}]\n${e.content}`)
    .join("\n\n---\n\n");

  return { text, sections_used: sectionsUsed };
}

/** Build the Strategic Advisor instructions based on context */
function buildStrategicAdvisor(context: {
  emailCategory?: string;
  hasHistory?: boolean;
  followUpCount?: number;
  hasEnrichmentData?: boolean;
}): string {
  const parts: string[] = [];
  
  parts.push(`
# STRATEGIC ADVISOR — Istruzioni di Intelligenza Autonoma

Sei un advisor strategico, non un semplice generatore di testo. Hai accesso a una Knowledge Base di tecniche di vendita, negoziazione e comunicazione B2B. DEVI usarla attivamente.

## Come usare la Knowledge Base:
1. LEGGI le tecniche fornite e SELEZIONA quelle più appropriate per il contesto
2. APPLICA almeno 2 tecniche per email (es. Label + Domanda Calibrata)
3. ADATTA la tecnica al destinatario specifico — non usarla in modo meccanico
4. Se hai dati dal profilo del destinatario, USA quei dati come leva per le tecniche

## Regole di autonomia:
- Se i dati sul destinatario sono ricchi → personalizza profondamente, usa tecniche avanzate
- Se i dati sono scarsi → resta generico ma professionale, usa tecniche universali (Label, Mirroring)
- Se c'è storia di interazioni → ANALIZZALA e NON ripetere approcci già usati
- Se è un follow-up senza risposta → usa tecniche di re-engagement (domanda "no", last attempt)`);

  if (context.hasHistory) {
    parts.push(`
## ATTENZIONE — Storia interazioni disponibile:
Hai accesso alla storia delle interazioni precedenti. DEVI:
1. Leggere cosa è stato già detto/proposto
2. NON ripetere lo stesso messaggio
3. Evolvere l'approccio: ogni comunicazione deve portare VALORE NUOVO`);
  }

  if (context.followUpCount && context.followUpCount >= 2) {
    parts.push(`
## FOLLOW-UP AVANZATO (${context.followUpCount}° tentativo):
Usa la tecnica del "No strategico": formula una domanda che permetta al destinatario di dire NO senza chiudere la porta.
Es: "Ha rinunciato all'idea di [obiettivo]?" — questo provoca una risposta correttiva.
Se è il 3°+ tentativo, considera la tecnica "last attempt".`);
  }

  if (!context.hasEnrichmentData) {
    parts.push(`
## DATI LIMITATI:
Non hai molte informazioni sul destinatario. In questo caso:
- NON inventare dettagli, presentazioni, eventi o fatti
- Usa tecniche universali: Label generico, domanda aperta, reciprocità
- Focalizza sul VALUE del mittente piuttosto che sulla personalizzazione`);
  }

  return parts.join("\n");
}

/** Legacy fallback: Extract sections from KB using <!-- SECTION:N --> markers */
function getKBSliceLegacy(fullKB: string, quality: Quality): string {
  if (!fullKB) return "";
  const sectionMap: Record<Quality, number[]> = {
    fast: [1, 5],
    standard: [1, 2, 3, 4, 5, 6, 7, 8],
    premium: [],
  };
  if (quality === "premium") return fullKB;
  const allowedSections = sectionMap[quality];
  const sectionRegex = /<!-- SECTION:(\d+) -->/g;
  const markers: { index: number; section: number }[] = [];
  let match;
  while ((match = sectionRegex.exec(fullKB)) !== null) {
    markers.push({ index: match.index, section: parseInt(match[1]) });
  }
  if (markers.length === 0) return fullKB;
  const parts: string[] = [];
  for (let i = 0; i < markers.length; i++) {
    if (allowedSections.includes(markers[i].section)) {
      const start = markers[i].index;
      const end = i + 1 < markers.length ? markers[i + 1].index : fullKB.length;
      parts.push(fullKB.substring(start, end).trim());
    }
  }
  return parts.join("\n\n---\n\n");
}

function getModel(quality: Quality): string {
  return quality === "fast" 
    ? "google/gemini-2.5-flash-lite" 
    : "google/gemini-3-flash-preview";
}

function getProfileTruncation(quality: Quality): { description: number; rawProfile: number } {
  switch (quality) {
    case "fast": return { description: 0, rawProfile: 0 };
    case "standard": return { description: 800, rawProfile: 0 };
    case "premium": return { description: 800, rawProfile: 1500 };
  }
}

/** Detect language from country code */
function detectLanguage(countryCode: string): { language: string; languageLabel: string } {
  const cc = (countryCode || "").toUpperCase().trim();
  const map: Record<string, { language: string; languageLabel: string }> = {
    IT: { language: "italiano", languageLabel: "Italian" },
    ES: { language: "español", languageLabel: "Spanish" },
    AR: { language: "español", languageLabel: "Spanish" },
    MX: { language: "español", languageLabel: "Spanish" },
    CO: { language: "español", languageLabel: "Spanish" },
    CL: { language: "español", languageLabel: "Spanish" },
    PE: { language: "español", languageLabel: "Spanish" },
    VE: { language: "español", languageLabel: "Spanish" },
    EC: { language: "español", languageLabel: "Spanish" },
    UY: { language: "español", languageLabel: "Spanish" },
    PY: { language: "español", languageLabel: "Spanish" },
    BO: { language: "español", languageLabel: "Spanish" },
    CR: { language: "español", languageLabel: "Spanish" },
    PA: { language: "español", languageLabel: "Spanish" },
    GT: { language: "español", languageLabel: "Spanish" },
    CU: { language: "español", languageLabel: "Spanish" },
    DO: { language: "español", languageLabel: "Spanish" },
    HN: { language: "español", languageLabel: "Spanish" },
    SV: { language: "español", languageLabel: "Spanish" },
    NI: { language: "español", languageLabel: "Spanish" },
    FR: { language: "français", languageLabel: "French" },
    BE: { language: "français", languageLabel: "French" },
    CI: { language: "français", languageLabel: "French" },
    SN: { language: "français", languageLabel: "French" },
    CM: { language: "français", languageLabel: "French" },
    MA: { language: "français", languageLabel: "French" },
    TN: { language: "français", languageLabel: "French" },
    DZ: { language: "français", languageLabel: "French" },
    DE: { language: "deutsch", languageLabel: "German" },
    AT: { language: "deutsch", languageLabel: "German" },
    CH: { language: "deutsch", languageLabel: "German" },
    PT: { language: "português", languageLabel: "Portuguese" },
    BR: { language: "português", languageLabel: "Portuguese" },
    AO: { language: "português", languageLabel: "Portuguese" },
    MZ: { language: "português", languageLabel: "Portuguese" },
    NL: { language: "nederlands", languageLabel: "Dutch" },
    RU: { language: "русский", languageLabel: "Russian" },
    JP: { language: "english", languageLabel: "English" },
    CN: { language: "english", languageLabel: "English" },
    KR: { language: "english", languageLabel: "English" },
    TR: { language: "türkçe", languageLabel: "Turkish" },
    PL: { language: "polski", languageLabel: "Polish" },
    RO: { language: "română", languageLabel: "Romanian" },
    GR: { language: "ελληνικά", languageLabel: "Greek" },
  };
  return map[cc] || { language: "english", languageLabel: "English" };
}

/** Check if a string looks like a person's name (vs a job title/department) */
function isLikelyPersonName(value: string): boolean {
  if (!value || value.trim().length < 2) return false;
  const lower = value.toLowerCase().trim();
  const roleKeywords = [
    "department", "pricing", "business development", "manager", "director",
    "office", "logistics", "operations", "commercial", "sales", "admin",
    "accounting", "hr", "human resources", "finance", "marketing",
    "customer service", "general", "managing", "executive", "officer",
    "coordinator", "supervisor", "assistant", "secretary", "reception",
    "procurement", "purchasing", "supply chain", "warehouse", "import",
    "export", "freight", "shipping", "forwarding", "trade", "compliance",
    "legal", "it ", "information technology", "support", "helpdesk",
    "division", "unit", "team", "group", "section", "bureau", "desk",
    "rappresentante", "responsabile", "direttore", "ufficio", "reparto",
    "amministrazione", "commerciale", "operativo", "logistica",
    "contabilità", "segreteria", "acquisti", "vendite",
  ];
  // If it contains any role keyword, it's not a person name
  if (roleKeywords.some((kw) => lower.includes(kw))) return false;
  // If it contains "&" or "/" it's likely a department combo
  if (/[&\/]/.test(value)) return false;
  // If all words are capitalized short words (2-3 letters each), likely acronyms
  if (/^[A-Z]{2,4}(\s+[A-Z]{2,4})*$/.test(value.trim())) return false;
  return true;
}

/** Validate URL: only allow http/https, block private IPs */
function isValidPublicUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname;
    // Block private/internal IPs
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|169\.254\.|localhost|::1|fc|fd)/i.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Generate aliases inline via AI if missing — lightweight single-item call */
async function generateAliasesInline(
  apiKey: string,
  companyName: string,
  contactName: string | null,
  contactTitle: string | null,
): Promise<{ company_alias: string; contact_alias: string }> {
  const prompt = `Genera alias per:
- Azienda: "${companyName}" → rimuovi suffissi legali (SRL, LLC, Ltd, GmbH, etc.) e città dal nome
- Contatto: "${contactName || ""}" (ruolo: ${contactTitle || "N/A"}) → usa SOLO il cognome, rimuovi titoli (Mr., Mrs., Dr., etc.). Se sembra un ruolo e non un nome di persona, restituisci ""

Rispondi SOLO con JSON: {"company_alias":"...","contact_alias":"..."}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
      }),
    });
    if (!resp.ok) return { company_alias: "", contact_alias: "" };
    const result = await resp.json();
    const text = result.choices?.[0]?.message?.content || "";
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Inline alias generation failed:", e);
  }
  return { company_alias: "", contact_alias: "" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth check (REQUIRED) ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { activity_id, goal, base_proposal, language, document_ids, reference_urls, quality: rawQuality, oracle_type, oracle_tone, use_kb, deep_search, standalone, recipient_count, recipient_countries, recipient_name, recipient_company } = await req.json();

    const quality: Quality = (["fast", "standard", "premium"].includes(rawQuality) ? rawQuality : "standard") as Quality;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Use service role for data queries (user is already authenticated above)
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let partner: any = null;
    let contact: any = null;
    let contactEmail: string | null = null;
    let sourceType = "partner";
    let activity: any = null;

    if (standalone) {
      // ── STANDALONE MODE: detect language from recipient_countries ──
      const firstCountry = (recipient_countries || "").split(/[,;\s]+/).find((s: string) => s.trim().length === 2) || "IT";
      partner = {
        id: null,
        company_name: recipient_company || "Destinatario generico",
        company_alias: recipient_company || null,
        country_code: firstCountry.toUpperCase().trim(),
        country_name: recipient_countries || "Vari",
        city: "",
        email: null,
        phone: null,
        website: null,
        profile_description: null,
        rating: null,
        raw_profile_markdown: null,
      };
      // If a recipient name was provided (e.g. manual entry), create a synthetic contact
      if (recipient_name) {
        contact = {
          name: recipient_name,
          contact_alias: recipient_name,
          title: null,
          email: null,
          direct_phone: null,
          mobile: null,
        };
      } else {
        contact = null;
      }
      contactEmail = "destinatario@email.com";
      sourceType = "standalone";
    } else {
      // ── ACTIVITY MODE: original logic ──
      if (!activity_id) throw new Error("activity_id is required");

    // Fetch activity
    const { data: actData, error: actErr } = await supabase
      .from("activities")
      .select(`
        *,
        partners(
          id, company_name, company_alias, country_code, country_name, city,
          email, phone, website, profile_description, rating,
          raw_profile_markdown
        ),
        selected_contact:partner_contacts!activities_selected_contact_id_fkey(
          id, name, email, direct_phone, mobile, title, contact_alias
        )
      `)
      .eq("id", activity_id)
      .single();

    if (actErr || !actData) throw new Error("Activity not found");
    activity = actData;

    sourceType = activity.source_type || "partner";
    partner = activity.partners;
    contact = activity.selected_contact;

    // For contact-source activities, fetch from imported_contacts
    if (sourceType === "contact" && activity.source_id) {
      const { data: importedContact } = await supabase
        .from("imported_contacts")
        .select("id, company_name, company_alias, name, contact_alias, email, phone, mobile, country, city, position, origin, note")
        .eq("id", activity.source_id)
        .single();
      if (importedContact) {
        partner = {
          id: importedContact.id,
          company_name: importedContact.company_name || "Azienda sconosciuta",
          company_alias: importedContact.company_alias,
          country_code: importedContact.country || "??",
          country_name: importedContact.country || "Sconosciuto",
          city: importedContact.city || "",
          email: importedContact.email,
          phone: importedContact.phone,
          website: null,
          profile_description: importedContact.note,
          rating: null,
          raw_profile_markdown: null,
        };
        contact = {
          id: importedContact.id,
          name: importedContact.name || importedContact.company_name || "",
          email: importedContact.email,
          direct_phone: importedContact.phone,
          mobile: importedContact.mobile,
          title: importedContact.position,
          contact_alias: importedContact.contact_alias,
        };
        contactEmail = importedContact.email;
      }
    }

    // For prospect-source activities, fetch from prospects
    if (sourceType === "prospect" && activity.source_id) {
      const { data: prospect } = await supabase
        .from("prospects")
        .select("id, company_name, city, province, region, email, phone, website, codice_ateco, descrizione_ateco, fatturato, dipendenti")
        .eq("id", activity.source_id)
        .single();
      if (prospect) {
        partner = {
          id: prospect.id,
          company_name: prospect.company_name,
          company_alias: null,
          country_code: "IT",
          country_name: "Italia",
          city: [prospect.city, prospect.province].filter(Boolean).join(", "),
          email: prospect.email,
          phone: prospect.phone,
          website: prospect.website,
          profile_description: [
            prospect.descrizione_ateco,
            prospect.fatturato ? `Fatturato: €${(prospect.fatturato / 1_000_000).toFixed(1)}M` : null,
            prospect.dipendenti ? `Dipendenti: ${prospect.dipendenti}` : null,
          ].filter(Boolean).join(" · "),
          rating: null,
          raw_profile_markdown: null,
        };
        contact = null;
        contactEmail = prospect.email;

        // Try to find prospect contacts
        const { data: pContacts } = await supabase
          .from("prospect_contacts")
          .select("name, email, phone, role")
          .eq("prospect_id", prospect.id)
          .limit(1);
        if (pContacts?.[0]) {
          const pc = pContacts[0];
          contact = {
            id: prospect.id,
            name: pc.name,
            email: pc.email,
            direct_phone: pc.phone,
            mobile: null,
            title: pc.role,
            contact_alias: null,
          };
          contactEmail = pc.email || prospect.email;
        }
      }
    }

    // For partner source (default), keep existing logic
    if (sourceType === "partner" || !contactEmail) {
      contactEmail = contact?.email || partner?.email || null;
    }

    if (!partner) throw new Error("Source entity not found");
    } // end non-standalone

    // --- VALIDATION: partner source MUST have a selected contact ---
    if (!standalone && sourceType === "partner" && !contact) {
      return new Response(
        JSON.stringify({
          error: "no_contact",
          message: "Nessun contatto selezionato. Seleziona un contatto prima di generare l'email.",
          partner_name: partner.company_name,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- VALIDATION: check contact has email ---
    if (!standalone && !contactEmail) {
      return new Response(
        JSON.stringify({
          error: "no_email",
          message: "Nessun indirizzo email disponibile per questo contatto/partner",
          partner_name: partner.company_name,
          contact_name: contact?.name || null,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── AUTO-GENERATE ALIASES IF MISSING ──
    const needsCompanyAlias = !standalone && !partner.company_alias;
    const needsContactAlias = contact && !contact.contact_alias;

    if (needsCompanyAlias || needsContactAlias) {
      console.log(`Auto-generating aliases for ${partner.company_name} (company: ${needsCompanyAlias}, contact: ${needsContactAlias})`);
      const generated = await generateAliasesInline(
        LOVABLE_API_KEY,
        partner.company_name,
        contact?.name || null,
        contact?.title || null,
      );

      if (generated.company_alias && needsCompanyAlias) {
        partner.company_alias = generated.company_alias;
        if (sourceType === "partner") {
          await supabase.from("partners").update({ company_alias: generated.company_alias }).eq("id", partner.id);
        } else if (sourceType === "contact") {
          await supabase.from("imported_contacts").update({ company_alias: generated.company_alias }).eq("id", partner.id);
        }
      }
      if (generated.contact_alias && needsContactAlias && contact) {
        contact.contact_alias = generated.contact_alias;
        if (sourceType === "partner") {
          await supabase.from("partner_contacts").update({ contact_alias: generated.contact_alias }).eq("id", contact.id);
        } else if (sourceType === "contact") {
          await supabase.from("imported_contacts").update({ contact_alias: generated.contact_alias }).eq("id", contact.id);
        }
      }
      console.log(`Aliases generated — company: "${generated.company_alias}", contact: "${generated.contact_alias}"`);
    }

    // Fetch partner networks, services, social links, settings in parallel
    const isPartnerSource = !standalone && sourceType === "partner" && activity?.partner_id;
    const [networksRes, servicesRes, settingsRes, socialRes] = await Promise.all([
      isPartnerSource
        ? supabase.from("partner_networks").select("network_name").eq("partner_id", partner.id)
        : Promise.resolve({ data: [] }),
      isPartnerSource && quality !== "fast"
        ? supabase.from("partner_services").select("service_category").eq("partner_id", partner.id)
        : Promise.resolve({ data: [] }),
      supabase.from("app_settings").select("key, value").like("key", "ai_%"),
      isPartnerSource && quality === "premium"
        ? supabase.from("partner_social_links").select("platform, url, contact_id").eq("partner_id", partner.id)
        : Promise.resolve({ data: [] }),
    ]);

    const networks = networksRes.data || [];
    const services = servicesRes.data || [];
    const socialLinks = socialRes.data || [];

    const settings: Record<string, string> = {};
    (settingsRes.data || []).forEach((r: any) => { settings[r.key] = r.value || ""; });

    // ─── Style Preferences from AI Memory (learned from user edits) ───
    let stylePreferencesContext = "";
    const { data: styleMemories } = await supabase
      .from("ai_memory")
      .select("content, confidence, access_count")
      .eq("user_id", userId)
      .contains("tags", ["style_preference"])
      .gte("confidence", 30)
      .order("access_count", { ascending: false })
      .limit(5);
    if (styleMemories && styleMemories.length > 0) {
      stylePreferencesContext = `\nPREFERENZE DI STILE APPRESE (dall'editing dell'utente):\n${styleMemories.map((m: any) => `- ${m.content}`).join("\n")}\nAPPLICA queste preferenze nella generazione.\n`;
    }

    // ─── Import commercial intelligence modules ───
    const { checkSameLocationContacts, getSameCompanyBranches, analyzeRelationshipHistory, buildInterlocutorTypeBlock, buildBranchCoordinationBlock, buildRelationshipAnalysisBlock } = await import("../_shared/sameLocationGuard.ts");

    // ─── Same-Location Guard: prevent duplicate comms to same branch ───
    const effectivePartnerId = isPartnerSource ? activity?.partner_id : partner?.id;
    
    if (!standalone && effectivePartnerId) {
      const guardResult = await checkSameLocationContacts(
        supabase, effectivePartnerId, contactEmail, userId
      );
      if (!guardResult.allowed) {
        return new Response(
          JSON.stringify({
            error: "duplicate_branch",
            message: guardResult.reason,
            recent_contact: guardResult.recentContact,
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ─── Enhanced Relationship History (semantic analysis) ───
    let historyContext = "";
    let relationshipBlock = "";
    let branchBlock = "";
    let interlocutorBlock = "";
    
    if (effectivePartnerId) {
      const { metrics, historyText } = await analyzeRelationshipHistory(supabase, effectivePartnerId, userId);
      if (historyText) historyContext = `\n${historyText}\n`;
      relationshipBlock = buildRelationshipAnalysisBlock(metrics);
      
      // Branch coordination
      const branches = await getSameCompanyBranches(supabase, effectivePartnerId);
      branchBlock = buildBranchCoordinationBlock(branches, partner?.city);
    }
    
    // ─── Interlocutor Type (Partner vs End Client) ───
    interlocutorBlock = buildInterlocutorTypeBlock(sourceType);

    // ─── Cached Enrichment Data (website/LinkedIn summaries from DB) ───
    let cachedEnrichmentContext = "";
    if (isPartnerSource && activity?.partner_id) {
      const { data: partnerEd } = await supabase
        .from("partners")
        .select("enrichment_data")
        .eq("id", activity!.partner_id)
        .single();
      if (partnerEd?.enrichment_data) {
        const ed = partnerEd.enrichment_data as Record<string, any>;
        if (ed.website_summary) {
          cachedEnrichmentContext += `\nINFORMAZIONI DAL SITO AZIENDALE:\n${String(ed.website_summary).slice(0, 600)}\n`;
        }
        if (ed.linkedin_summary) {
          cachedEnrichmentContext += `\nPROFILO LINKEDIN:\n${String(ed.linkedin_summary).slice(0, 500)}\n`;
        }
        if (ed.deep_search_summary) {
          cachedEnrichmentContext += `\nDEEP SEARCH:\n${String(ed.deep_search_summary).slice(0, 400)}\n`;
        }
      }
    }

    // Fetch workspace documents text — skip for "fast"
    let documentsContext = "";
    if (quality !== "fast" && document_ids && document_ids.length > 0) {
      const { data: docs } = await supabase
        .from("workspace_documents")
        .select("file_name, extracted_text")
        .in("id", document_ids);
      if (docs && docs.length > 0) {
        const docTexts = docs
          .filter((d: any) => d.extracted_text)
          .map((d: any) => `--- ${d.file_name} ---\n${d.extracted_text.substring(0, 3000)}`)
          .join("\n\n");
        if (docTexts) {
          documentsContext = `\nDOCUMENTI DI RIFERIMENTO:\n${docTexts}\n`;
        }
      }
    }

    // Reference URLs — use cached data only (no live scraping)
    let linksContext = "";
    // Firecrawl removed — reference URLs are no longer scraped live

    // LinkedIn context — only for premium
    let linkedinContext = "";
    if (quality === "premium") {
      const companyLinkedIn = socialLinks.find((l: any) => l.platform === "linkedin" && !l.contact_id);
      const contactLinkedIn = contact
        ? socialLinks.find((l: any) => l.platform === "linkedin" && l.contact_id === contact.id)
        : null;
      if (companyLinkedIn || contactLinkedIn) {
        linkedinContext = "\nLINKEDIN:\n";
        if (companyLinkedIn) linkedinContext += `- Azienda: ${companyLinkedIn.url}\n`;
        if (contactLinkedIn) linkedinContext += `- Contatto: ${contactLinkedIn.url}\n`;
      }
    }

    // --- USE ALIASES as primary names, but validate they're actual person names ---
    let recipientName: string;
    if (contact) {
      const alias = contact.contact_alias;
      const name = contact.name;
      if (alias && isLikelyPersonName(alias)) {
        recipientName = alias;
      } else if (name && isLikelyPersonName(name)) {
        recipientName = name;
      } else {
        // Neither alias nor name is a person name — use generic greeting
        recipientName = "";
      }
    } else {
      recipientName = "";
    }
    const recipientCompany = partner.company_alias || partner.company_name;
    const senderAlias = settings.ai_contact_alias || settings.ai_contact_name || "";
    const senderCompanyAlias = settings.ai_company_alias || settings.ai_company_name || "";

    // Build context with quality-aware truncation
    const trunc = getProfileTruncation(quality);

    const partnerContext = `
AZIENDA DESTINATARIA:
- Nome: ${recipientCompany}${partner.company_name !== recipientCompany ? ` (ragione sociale: ${partner.company_name})` : ""}
- Città: ${partner.city}, ${partner.country_name} (${partner.country_code})
${quality !== "fast" ? `- Sito web: ${partner.website || "N/A"}` : ""}
- Email: ${contactEmail}
${quality !== "fast" ? `- Rating: ${partner.rating ? `${partner.rating}/5` : "N/A"}` : ""}
- Network: ${networks.map((n: any) => n.network_name).join(", ") || "N/A"}
${quality !== "fast" ? `- Servizi: ${services.map((s: any) => s.service_category.replace(/_/g, " ")).join(", ") || "N/A"}` : ""}
${trunc.description > 0 && partner.profile_description ? `- Descrizione: ${partner.profile_description.substring(0, trunc.description)}` : ""}
${trunc.rawProfile > 0 && partner.raw_profile_markdown ? `\nPROFILO COMPLETO (estratto):\n${partner.raw_profile_markdown.substring(0, trunc.rawProfile)}` : ""}
${linkedinContext}`;

    const contactContext = contact ? `
CONTATTO DESTINATARIO:
${recipientName ? `- Nome da usare nel saluto: ${recipientName} (IMPORTANTE: usa SOLO questo nome, mai il nome completo con cognome)` : `- ATTENZIONE: il nome del contatto non è disponibile o è un titolo/ruolo aziendale. Usa "Gentile responsabile" o equivalente nella lingua dell'email.`}
- Ruolo: ${contact.title || "N/A"}
- Email: ${contact.email || contactEmail}
${quality !== "fast" ? `- Telefono: ${contact.direct_phone || contact.mobile || "N/A"}` : ""}

REGOLA ASSOLUTA: ${recipientName ? `Rivolgiti SEMPRE alla persona (${recipientName}), MAI all'azienda nel saluto.` : `Non hai un nome di persona valido. Usa un saluto generico come "Gentile responsabile" o equivalente. MAI usare nomi di ruoli/dipartimenti come se fossero persone.`} L'email è personale, diretta al contatto. Non scrivere mai "Cara azienda", "Gentile società", "Dear Company" o simili.
` : `ATTENZIONE: Nessun contatto selezionato. Rivolgiti comunque in modo generico ma MAI usando "Cara/Dear" + nome azienda. Usa "Gentile responsabile" o equivalente nella lingua richiesta.`;

    // --- SIGNATURE BLOCK ---
    let signatureBlock = settings.ai_email_signature_block || "";
    if (!signatureBlock.trim()) {
      const sigParts: string[] = [];
      if (senderAlias) sigParts.push(senderAlias);
      if (settings.ai_contact_role) sigParts.push(settings.ai_contact_role);
      if (senderCompanyAlias) sigParts.push(senderCompanyAlias);
      if (settings.ai_phone_signature) sigParts.push(`Tel: ${settings.ai_phone_signature}`);
      if (settings.ai_email_signature) sigParts.push(`Email: ${settings.ai_email_signature}`);
      if (sigParts.length > 0) {
        signatureBlock = sigParts.join("\n");
      }
    }

    // Sales KB — Strategic contextual injection
    const emailCategory = oracle_type || "primo_contatto";
    const prevActCount = historyContext ? (historyContext.match(/\[/g) || []).length : 0;
    const kbResult = await fetchKbEntriesStrategic(supabase, quality, {
      emailCategory,
      hasInteractionHistory: !!historyContext,
      isFollowUp: emailCategory === "follow_up" || prevActCount > 0,
      kb_categories: undefined, // Will use emailCategory fallback
    });
    const fullSalesKB = settings.ai_sales_knowledge_base || "";
    const salesKBSlice = kbResult.text || getKBSliceLegacy(fullSalesKB, quality);

    // Build Strategic Advisor instructions
    const strategicAdvisor = buildStrategicAdvisor({
      emailCategory,
      hasHistory: !!historyContext,
      followUpCount: prevActCount,
      hasEnrichmentData: !!cachedEnrichmentContext,
    });

    const senderContext = `
MITTENTE (TU):
- Nome da usare: ${senderAlias}
- Azienda: ${senderCompanyAlias}
- Ruolo: ${settings.ai_contact_role || "N/A"}
- Email: ${settings.ai_email_signature || "N/A"}
${quality !== "fast" ? `- Telefono: ${settings.ai_phone_signature || "N/A"}` : ""}
- Settore: ${settings.ai_sector || "freight_forwarding"}
- Network: ${settings.ai_networks || "N/A"}

KNOWLEDGE BASE AZIENDALE:
${use_kb !== false ? (settings.ai_knowledge_base || "Non configurata") : "(Knowledge Base disattivata dall'utente)"}
${use_kb !== false && salesKBSlice ? `\n# ARSENAL STRATEGICO (${kbResult.sections_used.join(", ") || "legacy"}):\nLeggi ATTENTAMENTE queste tecniche e APPLICALE nel messaggio.\n\n${salesKBSlice}\n` : ""}
STILE DI COMUNICAZIONE:
- Tono: ${oracle_tone || settings.ai_tone || "professionale"}
- Lingua: ${settings.ai_language || "italiano"}
${settings.ai_style_instructions ? `- Istruzioni: ${settings.ai_style_instructions}` : ""}
${settings.ai_sector_notes ? `- Note settoriali: ${settings.ai_sector_notes}` : ""}
`;

    // Auto-detect language from recipient's country code
    const detected = detectLanguage(partner.country_code);
    const effectiveLanguage = language || detected.language;

    const systemPrompt = `Sei un esperto copywriter e stratega di vendita B2B nel settore della logistica e del freight forwarding internazionale.
NON sei un semplice generatore di testo — sei un consulente che applica tecniche avanzate di vendita e negoziazione.

${strategicAdvisor}

# ISTRUZIONI DI GENERAZIONE EMAIL

## Formato output:
- Prima riga: "Subject: ..." (testo puro, non HTML)
- Dopo l'oggetto: corpo email in HTML semplice (<p>, <br>, <strong>, <ul>/<li>)
- NON usare markdown nel corpo. NON usare \\n, usa tag HTML.
- NON includere firma — viene aggiunta automaticamente dal sistema.
- Chiudi con saluto + nome mittente, NIENT'ALTRO.

## Regole critiche:
1. LINGUA: Scrivi INTERAMENTE in ${effectiveLanguage} (${partner.country_code} → ${detected.languageLabel}). Oggetto, saluto, corpo, chiusura — TUTTO nella stessa lingua.
2. PERSONALIZZAZIONE: Usa i dati del destinatario per personalizzare. Se hai dati dal profilo, dal sito, dalla deep search — USALI come leva.
3. ALIAS: Usa SEMPRE l'alias/nome breve nel saluto (es. "Dear Marco" non "Dear Marco Rossi"). Se il nome sembra un ruolo/titolo → usa "Gentile responsabile" o equivalente.
4. CONCISIONE: L'email deve essere pronta per l'invio, non un template. Massimo 10-15 righe per il corpo.
5. ZERO ALLUCINAZIONI — REGOLA ASSOLUTA: NON inventare MAI nomi di prodotti, servizi, eventi, fiere, presentazioni, statistiche o fatti. Se i dati sono insufficienti, scrivi in modo generico ma VERO. Ogni affermazione DEVE essere supportata dai dati forniti.
6. NETWORK: Se ci sono network condivisi, usali come punto di connessione.
7. CTA: Ogni email DEVE avere una call-to-action chiara. Domande aperte > domande chiuse.`;

    const userPrompt = `${senderContext}

${partnerContext}

${contactContext}
${interlocutorBlock}
${relationshipBlock}
${historyContext}
${branchBlock}
${cachedEnrichmentContext}
${documentsContext}
${linksContext}
${stylePreferencesContext}
GOAL DELLA COMUNICAZIONE:
${goal || "Presentazione aziendale e proposta di collaborazione"}

PROPOSTA DI BASE:
${base_proposal || "Proposta generica di collaborazione nel settore freight forwarding"}

OBIETTIVO COMMERCIALE FINALE:
L'obiettivo ultimo di ogni comunicazione è CONVERTIRE il lead in cliente attivo.
Le leve principali sono: invitare ad usare i nostri sistemi, proporre apertura account,
evidenziare tariffe privilegiate, mostrare come semplifichiamo tempi e operatività.

ISTRUZIONI DAL TIPO EMAIL SELEZIONATO:
${goal || "Nessuna istruzione specifica — genera un'email professionale basata sul goal e la proposta."}

Genera l'email completa con oggetto e corpo. Applica le tecniche dalla Knowledge Base.`;

    const model = getModel(quality);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit raggiunto, riprova tra poco." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI error:", status, text);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    // Consume credits atomically
    if (result.usage) {
      const inputTokens = result.usage.prompt_tokens || 0;
      const outputTokens = result.usage.completion_tokens || 0;
      const totalCredits = Math.max(1, Math.ceil((inputTokens + outputTokens * 2) / 1000));
      await supabase.rpc("deduct_credits", {
        p_user_id: userId,
        p_amount: totalCredits,
        p_operation: "ai_call",
        p_description: `generate-email (${quality}): ${inputTokens} in + ${outputTokens} out`,
      });
    }

    let subject = "";
    let body = content;
    const subjectMatch = content.match(/^Subject:\s*(.+)/i);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      body = content.substring(subjectMatch[0].length).trim();
    }

    // Post-processing: convert plain text newlines to HTML if AI didn't use HTML tags
    if (!/<(p|br|div|ul|ol|h[1-6])\b/i.test(body)) {
      body = body
        .split(/\n\n+/)
        .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
        .join("\n");
    }

    // Clean up excessive whitespace/formatting from AI output
    body = body
      // Remove empty paragraphs (with optional whitespace/nbsp/br inside)
      .replace(/<p>\s*(<br\s*\/?>|\s|&nbsp;)*\s*<\/p>/gi, "")
      // Collapse 3+ consecutive <br> into 2
      .replace(/(<br\s*\/?\s*>[\s\n]*){3,}/gi, "<br><br>")
      // Remove leading/trailing <br> inside <p> tags
      .replace(/<p>\s*(<br\s*\/?\s*>)+/gi, "<p>")
      .replace(/(<br\s*\/?\s*>)+\s*<\/p>/gi, "</p>")
      // Remove whitespace-only text nodes between tags
      .replace(/>\s{2,}</g, "> <")
      .trim();

    // Append signature block to body (as HTML)
    if (signatureBlock.trim()) {
      const sigHtml = signatureBlock.replace(/\n/g, "<br>");
      body = body + `<br><br>${sigHtml}`;
    }

    return new Response(
      JSON.stringify({
        subject,
        body,
        full_content: content,
        partner_name: partner.company_name,
        contact_name: contact?.contact_alias || contact?.name || null,
        contact_email: contactEmail,
        has_contact: !!contact,
        used_partner_email: !contact?.email && !!partner.email,
        quality,
        model,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-email error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
